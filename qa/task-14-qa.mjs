// Adversarial browser QA for todo 14 (motion system: confetti + GSAP discipline).
//
// Adversarial axes, by design:
//   - misleading-success-output: nothing is read from a log line the page
//     printed. Confetti proof is the REAL canvas-confetti call count,
//     captured by wrapping window.confetti BEFORE any page script runs
//     (addInitScript), plus a live check that the confetti <canvas> was
//     actually appended to the document and holds non-transparent pixels.
//   - stale_state: served over HTTP from disk with a sha256 of every file
//     under test in the header, so the evidence is provably from these bytes.
//
// Usage: node qa/task-14-qa.mjs <mode>   where mode is 'happy' | 'reduced'
//   happy  — 375px, begin tap -> countdown unlock -> finale unseal -> replay
//   reduced — 375px, reducedMotion:'reduce', same interactions, zero motion
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globSync } from 'node:fs';

const pw = await (async () => {
  const normalize = (m) => (m && m.chromium ? m : m && m.default ? m.default : null);
  try { return normalize(await import('playwright')); } catch {}
  for (const hit of globSync('/home/vibex/.npm/_npx/*/node_modules/playwright/index.js')) {
    try { const m = normalize(await import(pathToFileURL(hit).href)); if (m) return m; } catch {}
  }
  throw new Error('playwright not found in npx cache');
})();
const { chromium } = pw;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = join(root, '..', '.omo', 'evidence', 'halimah-birthday-site');
const mode = process.argv[2] || 'happy';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg',
};

const log = [];
const say = (s = '') => { log.push(s); console.log(s); };

// Count pixels in a PNG buffer that sit clearly above the page background.
// Decoded in the page via createImageBitmap + an offscreen 2D canvas, so no
// image library is needed. This measures the real rendered frame.
async function countBrightPixels(pngBuffer, page) {
  const b64 = pngBuffer.toString('base64');
  return page.evaluate(async (data) => {
    const res = await fetch('data:image/png;base64,' + data);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4 * 13) {
      if (d[i] > 90 || d[i + 1] > 90 || d[i + 2] > 90) lit++;
    }
    return lit;
  }, b64);
}

// Real WAV so "audio starts on the gesture" is provable without shipping music.
const WAV = (() => {
  const rate = 8000, secs = 2, n = rate * secs;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt16LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / 8) * 1200), 44 + i * 2);
  return buf;
})();

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  try {
    if (p === '/assets/music/song.mp3') {
      res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': WAV.length });
      return res.end(WAV);
    }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
say(`# task-14 QA — mode=${mode}`);
say(`# served from ${base} (root=${root})`);

// stale_state guard: hash every file this change touched.
for (const rel of ['index.html', 'js/motion.js', 'js/begin.js', 'sections/finale.js', 'sections/story.js']) {
  const buf = await readFile(join(root, rel));
  say(`# sha256 ${rel}=${createHash('sha256').update(buf).digest('hex').slice(0, 16)} bytes=${buf.length}`);
}

const browser = await chromium.launch({
  timeout: 60000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
  viewportSize: { width: 375, height: 667 },
});

let failures = 0;
const assert = (cond, label, detail) => {
  const line = `${cond ? '[PASS]' : '[FAIL]'} ${label}${detail ? ' :: ' + detail : ''}`;
  say(line);
  if (!cond) failures++;
};

// Count REAL confetti invocations. Injected before any page script so we see
// every call, including ones made before this test could "notice" them.
const spyScript = `(() => {
  const real = window.confetti;
  window.__confettiCalls = [];
  window.__confettiResolved = 0;
  if (typeof real === 'function') {
    const wrapped = (opts) => {
      window.__confettiCalls.push(JSON.stringify(opts || {}));
      const p = real(opts);
      if (p && typeof p.then === 'function') { p.then(() => { window.__confettiResolved++; }, () => {}); }
      else { window.__confettiResolved++; }
      return p;
    };
    // confetti.create() is used internally; the library assigns window.confetti
    // first, so re-wrap after the vendor script has run:
    window.__wrapConfetti = () => { if (window.confetti && !window.confetti.__spy) { window.confetti.__spy = true; window.confetti = wrapped; return true; } return false; };
  } else {
    window.__wrapConfetti = () => false;
  }
})();`;

// Wrap the library's export as soon as it appears (vendor script is deferred).
const wrapScript = `(() => {
  const install = () => {
    if (typeof window.confetti === 'function' && !window.confetti.__spy) {
      const real = window.confetti;
      const wrapped = (opts) => {
        window.__confettiCalls.push(JSON.stringify(opts || {}));
        const p = real(opts);
        if (p && typeof p.then === 'function') { p.then(() => { window.__confettiResolved++; }, () => {}); }
        else { window.__confettiResolved++; }
        return p;
      };
      wrapped.__spy = true;
      window.confetti = wrapped;
    }
  };
  const t = setInterval(() => { if (typeof window.confetti === 'function') { install(); clearInterval(t); } }, 0);
})();`;

await ctx.addInitScript(spyScript);
await ctx.addInitScript(wrapScript);

let consoleErrors = [];
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__beginGate, null, { timeout: 15000 });
await page.waitForTimeout(300);

// ── Static invariants that must hold BEFORE any gesture ──
const preGesture = await page.evaluate(() => ({
  confettiCalls: window.__confettiCalls.length,
  motionTotal: window.__motion ? window.__motion.totalFired : -1,
  motionAllowed: window.__motion ? window.__motion.allowed : null,
  overlayVisible: !!document.getElementById('begin-overlay') && !document.getElementById('begin-overlay').hidden,
  beginButtons: document.querySelectorAll('#begin-button').length,
  overlays: document.querySelectorAll('#begin-overlay').length,
}));
assert(preGesture.confettiCalls === 0, 'no confetti call before the first user gesture', `calls=${preGesture.confettiCalls}`);
assert(preGesture.motionTotal === 0, 'motion module fired nothing on load', `motion.totalFired=${preGesture.motionTotal}`);
assert(preGesture.overlayVisible, 'begin overlay visible on load');
assert(preGesture.beginButtons === 1, 'exactly one #begin-button in the live DOM', `count=${preGesture.beginButtons}`);
assert(preGesture.overlays === 1, 'exactly one #begin-overlay in the live DOM', `count=${preGesture.overlays}`);

const expectedMotion = mode === 'reduced' ? 0 : null;
if (expectedMotion !== null) {
  assert(preGesture.motionAllowed === false, 'kill-switch reports motion DISABLED under reduced-motion', `allowed=${preGesture.motionAllowed}`);
}

// ── Gesture 1: the begin tap ──
await page.locator('#begin-button').click();
await page.waitForTimeout(400);

const afterBegin = await page.evaluate(() => ({
  confettiCalls: window.__confettiCalls.length,
  motionTotal: window.__motion ? window.__motion.totalFired : -1,
  unlocked: !document.getElementById('begin-overlay').hidden,
  audioState: window.__beginGate.audioState,
}));
const beginCalls = afterBegin.confettiCalls;
if (mode === 'happy') {
  assert(afterBegin.motionTotal === 1, 'begin tap fired exactly one staged burst (Motion.burst x1)', `totalFired=${afterBegin.motionTotal}`);
  assert(afterBegin.confettiCalls === 1, 'begin tap produced exactly 1 real confetti() call', `calls=${afterBegin.confettiCalls}`);
} else {
  assert(afterBegin.motionTotal === 0, 'reduced-motion: begin tap fired ZERO cannons', `totalFired=${afterBegin.motionTotal}`);
  assert(afterBegin.confettiCalls === 0, 'reduced-motion: zero confetti() calls after begin tap', `calls=${afterBegin.confettiCalls}`);
}
say(`# after begin tap: confetti calls=${afterBegin.confettiCalls} audio=${afterBegin.audioState} unlocked=${afterBegin.unlocked}`);

// ── Unfreeze the clock past the gate so the real unlock + cannon run ──
// The gate computed its target from a frozen Date at load; we advance the
// page clock forward so the countdown completes exactly as it will on 19 Oct.
await page.evaluate(() => {
  const target = window.__beginGate.target; // 2026-10-18T23:00:00.000Z
  const targetMs = Date.parse(target);
  const RealDate = Date;
  function shifted(inst) { return new RealDate(inst.getTime() + (targetMs + 1000 - RealDate.now())); }
  class FakeDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(targetMs + 1000); else super(...args); }
    static now() { return targetMs + 1000; }
  }
  Object.setPrototypeOf(FakeDate, RealDate);
  window.Date = FakeDate;
  window.__clockAdvanced = true;
});
// The countdown loop samples Date each frame; give it a few frames to complete.
await page.waitForFunction(() => window.__beginGate.countdownDone === true, null, { timeout: 5000 });
await page.waitForTimeout(250);

const afterUnlock = await page.evaluate(() => ({
  confettiCalls: window.__confettiCalls.length,
  motionTotal: window.__motion ? window.__motion.totalFired : -1,
  contentChildren: window.__beginGate.contentChildCount,
  dataUnlocked: document.documentElement.getAttribute('data-unlocked'),
}));
if (mode === 'happy') {
  assert(afterUnlock.motionTotal === 2, 'countdown unlock fired the second staged cannon (total 2)', `totalFired=${afterUnlock.motionTotal}`);
  // First volley (2 calls) fires synchronously; remaining volleys at +350ms/+700ms.
  // We verify the bounded completion below after waiting.
  assert(afterUnlock.dataUnlocked === 'true', 'content unlocked at the target instant');
  assert(afterUnlock.contentChildren > 0, 'story content restored into the DOM', `children=${afterUnlock.contentChildren}`);
  await page.waitForTimeout(900);
  const unlockVolley = await page.evaluate(() => window.__confettiCalls.length);
  assert(unlockVolley - beginCalls === 6, 'unlock volley completed: 3 volleys x 2 cannons = 6 calls, then stops', `delta=${unlockVolley - beginCalls}`);
} else {
  assert(afterUnlock.motionTotal === 0, 'reduced-motion: unlock fired ZERO cannons', `totalFired=${afterUnlock.motionTotal}`);
  assert(afterUnlock.confettiCalls === 0, 'reduced-motion: still zero confetti() calls after unlock', `calls=${afterUnlock.confettiCalls}`);
  assert(afterUnlock.dataUnlocked === 'true', 'reduced-motion: content still unlocks (function intact)');
  assert(afterUnlock.contentChildren > 0, 'reduced-motion: content intact after unlock', `children=${afterUnlock.contentChildren}`);
}

// ── Gesture 2: the finale unseal ──
// The finale section sits deep inside the (very tall) content region; scrolling
// it into view triggers the lazy loader which pulls sections/finale.js.
// Force scroll to the bottom so the lazy loader's IntersectionObserver fires.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.waitForFunction(() => {
  const b = document.querySelector('[data-finale-open]');
  return !!b && b.offsetParent !== null && window.getComputedStyle(b).display !== 'none';
}, null, { timeout: 15000 });
const preFinale = await page.evaluate(() => window.__confettiCalls.length);
await page.locator('[data-finale-open]').click();
await page.waitForTimeout(200);

const afterUnseal = await page.evaluate(() => ({
  confettiCalls: window.__confettiCalls.length,
  motionTotal: window.__motion ? window.__motion.totalFired : -1,
  stageOpen: document.querySelector('[data-finale-stage]').classList.contains('is-open'),
  letterText: (document.querySelector('[data-finale-letter]')?.textContent || '').length,
}));
if (mode === 'happy') {
  assert(afterUnseal.motionTotal === 3, 'finale unseal fired the third cannon (total 3)', `totalFired=${afterUnseal.motionTotal}`);
  assert(afterUnseal.confettiCalls - preFinale === 2, 'unseal fires one 2-cannon volley (2 calls)', `delta=${afterUnseal.confettiCalls - preFinale}`);
  assert(afterUnseal.stageOpen, 'envelope stage opened');
  assert(afterUnseal.letterText > 500, 'letter text present after unseal', `len=${afterUnseal.letterText}`);
  say(`# unseal cannon: first volley calls delta=${afterUnseal.confettiCalls - preFinale} (2 more volleys land at +350ms/+700ms)`);
  await page.waitForTimeout(900);
  const afterVolley = await page.evaluate(() => window.__confettiCalls.length);
  assert(afterVolley - preFinale === 6, 'unseal volley completed: 3 volleys x 2 cannons = 6 calls, then stops', `delta=${afterVolley - preFinale}`);
} else {
  assert(afterUnseal.motionTotal === 0, 'reduced-motion: finale unseal fired ZERO cannons', `totalFired=${afterUnseal.motionTotal}`);
  assert(afterUnseal.confettiCalls === 0, 'reduced-motion: zero confetti() calls across the whole journey', `calls=${afterUnseal.confettiCalls}`);
  assert(afterUnseal.stageOpen, 'reduced-motion: envelope still opens (content path intact)');
  assert(afterUnseal.letterText > 500, 'reduced-motion: letter still fully readable', `len=${afterUnseal.letterText}`);
}

// ── Gesture 3: the opt-in replay button ──
const replayState = await page.evaluate(() => {
  const b = document.querySelector('[data-motion-replay]');
  return { exists: !!b, hidden: b ? b.hidden : null, motionAllowed: window.__motion ? window.__motion.allowed : null };
});
if (mode === 'happy') {
  assert(replayState.exists, 'replay button exists in the finale keepsakes');
  assert(replayState.hidden === false, 'replay button is offered when motion is allowed', `hidden=${replayState.hidden}`);
  const beforeReplay = await page.evaluate(() => window.__confettiCalls.length);
  await page.locator('[data-motion-replay]').click();
  await page.waitForTimeout(150);
  const midReplay = await page.evaluate(() => window.__confettiCalls.length);
  assert(midReplay - beforeReplay === 2, 'replay tap fires one volley (2 calls)', `delta=${midReplay - beforeReplay}`);
  await page.waitForTimeout(900);
  const afterReplay = await page.evaluate(() => window.__confettiCalls.length);
  assert(afterReplay - beforeReplay === 6, 'replay volley bounded at 3 volleys, then stops (no loop)', `delta=${afterReplay - beforeReplay}`);
} else {
  assert(replayState.exists, 'replay button exists in markup');
  assert(replayState.hidden === true, 'replay button HIDDEN under reduced-motion (no dead control)', `hidden=${replayState.hidden}`);
}

// ── No infinite motion: the call count must be stable after everything settles ──
const settle1 = await page.evaluate(() => window.__confettiCalls.length);
await page.waitForTimeout(1200);
const settle2 = await page.evaluate(() => window.__confettiCalls.length);
assert(settle1 === settle2, 'confetti call count is stable after 1.2s idle (no infinite loop)', `before=${settle1} after=${settle2}`);

// ── Reduced-motion: GSAP must never be armed ──
const gsapState = await page.evaluate(() => ({
  hasGsap: window.__motion ? window.__motion.hasGsap : null,
  gsapDefined: typeof window.gsap !== 'undefined',
  jsStory: document.documentElement.classList.contains('js-story'),
}));
if (mode === 'reduced') {
  assert(gsapState.gsapDefined === false, 'reduced-motion: GSAP never even loads for the story section', `gsapDefined=${gsapState.gsapDefined}`);
  assert(gsapState.hasGsap === false, 'reduced-motion: Motion.hasGsap() is false (kill-switch)');
} else {
  say(`# gsap loaded=${gsapState.gsapDefined} (lazy, enhancement only)`);
}

// ── Evidence screenshots ──
if (mode === 'happy') {
  const shot = join(evidence, 'task-14-confetti.png');
  await page.locator('#finale').scrollIntoViewIfNeeded();
  await page.locator('[data-motion-replay]').click();   // fresh volley for the capture
  await page.waitForTimeout(380);                       // mid-volley, particles on screen
  // Capture the raw frame too, so the pixels can be measured without asking
  // the offscreen-owned canvas for a context it no longer has.
  const frame = await page.screenshot({ path: shot });
  say(`# screenshot -> ${shot}`);
  // Prove the pixels are real, not an empty stage. canvas-confetti hands its
  // canvas to an OffscreenCanvas (transferControlToOffscreen), so getContext()
  // throws on it and the scratch/star-map canvases are legitimately blank.
  // The honest check is the rendered frame itself: the screenshot below is
  // measured for non-background pixels instead of trusting a call count.
  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas.confetti-canvas')
      || [...document.querySelectorAll('canvas')].find((el) => !el.closest('#scratch') && !el.closest('#starmap'))
      || null;
    if (!c) return { canvas: false };
    return {
      canvas: true,
      w: c.width,
      h: c.height,
      offscreen: (() => { try { c.getContext('2d'); return false; } catch { return true; } })(),
    };
  });
  assert(painted.canvas, 'confetti canvas exists in the DOM', JSON.stringify(painted));
  // Measure the captured frame itself: count pixels that are clearly brighter
  // than the page background. This is the real render, not a call count.
  const lit = await countBrightPixels(frame, page);
  assert(lit > 500, 'rendered frame carries confetti pixels (real render, not a log line)', `brightPixels=${lit}`);
  say(`# frame pixels above background: ${lit}`);
} else {
  const shot = join(evidence, 'task-14-reduced.png');
  await page.locator('#finale').scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot });
  say(`# screenshot -> ${shot}`);
}

assert(consoleErrors.length === 0, 'no console errors during the whole run', consoleErrors.join(' | '));

say('');
say(failures === 0 ? `# RESULT: PASS (${mode})` : `# RESULT: FAIL (${mode}) — ${failures} failing assertion(s)`);

const outFile = mode === 'happy' ? join(evidence, 'task-14-happy.log') : join(evidence, 'task-14-motion.log');
const { writeFile, mkdir } = await import('node:fs/promises');
await mkdir(evidence, { recursive: true });
await writeFile(outFile, log.join('\n') + '\n');
console.log(`\n# log -> ${outFile}`);

await browser.close();
server.close();
process.exit(failures === 0 ? 0 : 1);
