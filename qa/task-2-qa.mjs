// Adversarial browser QA for todo 2 (tap-to-begin + countdown gate).
//
// Probes, per the task brief:
//   - misleading-success-output: every assertion reads REAL state from the
//     live DOM / Audio element / Howler, never a string the page printed.
//   - stale_state: the page is served over HTTP from disk and a build hash
//     is logged, so the evidence is provably from this build's bytes.
//
// Usage: node qa/task-2-qa.mjs <mode>   where mode is 'happy' | 'locked'
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globSync } from 'node:fs';

// Playwright is not a dependency of this static site; it lives in the npx
// cache. Resolve it from there so no node_modules symlink is needed and
// nothing is left behind after the run.
const pw = await (async () => {
  const normalize = (m) => (m && m.chromium ? m : m && m.default ? m.default : null);
  try {
    return normalize(await import('playwright'));
  } catch {}
  const hits = globSync('/home/vibex/.npm/_npx/*/node_modules/playwright/index.js');
  for (const hit of hits) {
    try {
      const m = normalize(await import(pathToFileURL(hit).href));
      if (m) return m;
    } catch {}
  }
  throw new Error('playwright not found in npx cache');
})();
const { chromium } = pw;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = join(root, '..', '.omo', 'evidence', 'halimah-birthday-site');
const mode = process.argv[2] || 'happy';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const log = [];
const say = (s = '') => { log.push(s); console.log(s); };

// A real WAV fixture so the "audio actually plays" claim is provable without
// shipping a music file (todo 6 owns the real track).
const WAV = (() => {
  const rate = 8000, secs = 2, n = rate * secs;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
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
    if (p === '/assets/music/song.mp3' && mode === 'happy') {
      // Serve the fixture under the real slot name so the happy path can
      // prove a genuinely playing track.
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
say(`# task-2 QA — mode=${mode}`);
say(`# served from ${base} (root=${root})`);

const html = await readFile(join(root, 'index.html'));
const jsBytes = await readFile(join(root, 'js', 'begin.js'));
say(`# build hash index.html=${createHash('sha256').update(html).digest('hex').slice(0, 16)} js/begin.js=${createHash('sha256').update(jsBytes).digest('hex').slice(0, 16)}`);

const browser = await chromium.launch({
  // WSL2 hosts are slow to warm a headless shell; give it room but not 3 min.
  timeout: 60000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  reducedMotion: 'no-preference',
});

let failures = 0;
const assert = (cond, label, detail) => {
  const line = `${cond ? '[PASS]' : '[FAIL]'} ${label}${detail ? ' :: ' + detail : ''}`;
  say(line);
  if (!cond) failures++;
};

// Freeze the clock so the gate decision is deterministic.
const FIXED_NOW = mode === 'locked'
  ? Date.parse('2026-10-18T20:00:00+01:00')   // one day before the gate
  : Date.parse('2026-09-29T09:00:00+01:00');   // today, gate pending

const clockScript = `(() => {
  const fixed = ${FIXED_NOW};
  const RealDate = Date;
  // Mutable clock: a class that EXTENDS the real Date (never a Proxy).
  // gsap/ScrollTrigger do feature detection against the Date constructor and
  // throw ("k is not a function") when it is a Proxy, so the unlock step below
  // moves time by mutating __clockNow instead of replacing window.Date.
  window.__clockNow = fixed;
  class FakeDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(window.__clockNow); else super(...args); }
    static now() { return window.__clockNow; }
  }
  Object.setPrototypeOf(FakeDate, RealDate);
  window.Date = FakeDate;
  // requestAnimationFrame keeps its real clock; only Date is frozen.
})();`;

await ctx.addInitScript(clockScript);
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__beginGate, null, { timeout: 10000 });

// ── Gate target correctness, read from the live page ──
const target = await page.evaluate(() => window.__beginGate.target);
const tz = await page.evaluate(() => window.__beginGate.timeZone);
assert(target === '2026-10-18T23:00:00.000Z', 'countdown resolves to 2026-10-19T00:00 Europe/London (BST=UTC+1)', `target=${target} tz=${tz}`);

// ── Real spoiler scan against the LIVE locked DOM ──
const spoilerProbe = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    text,
    sectionCount: document.querySelectorAll('#content-region > section').length,
    contentChildren: document.getElementById('content-region').childElementCount,
    starmapInDom: !!document.getElementById('starmap'),
  };
});

const SPOILERS = [
  'YES A MILLION TIMES YES', '26/08/2026', 'Kakegurui', 'I LOVE YOU',
  'hashbrown', 'zai', 'wifey', 'princess', 'hubby', 'buddy', 'spider',
  'Halimah',
];
// Ignore the closing 2 Oct case: only match whole words, and never flag the
// neutral countdown date the gate itself is allowed to show.
const found = SPOILERS.filter((s) => {
  if (s === 'Halimah' && !text_hasName()) return false;
  const re = new RegExp('\\b' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  return re.test(spoilerProbe.text);
});
function text_hasName() { return /halimah/i.test(spoilerProbe.text); }

say(`# locked DOM: content-region children=${spoilerProbe.contentChildren} sections=${spoilerProbe.sectionCount} starmapPresent=${spoilerProbe.starmapInDom}`);

if (mode === 'locked') {
  assert(spoilerProbe.contentChildren === 0, 'content region fully detached while locked');
  assert(!spoilerProbe.starmapInDom, 'star map not in DOM while locked');
  assert(found.length === 0, 'zero spoiler strings in live DOM text', found.join(' | '));
  const lockedAttr = await page.getAttribute('html', 'data-locked');
  assert(lockedAttr === 'true', 'html[data-locked=true] set', `value=${lockedAttr}`);
  const countdownVisible = await page.isVisible('#countdown-panel');
  assert(countdownVisible === false, 'countdown panel hidden before Begin is tapped');
  const overlayVisible = await page.isVisible('#begin-overlay');
  assert(overlayVisible === true, 'begin overlay visible in locked state');
  const value = await page.textContent('#countdown-value');
  say(`# countdown readout (rendered at load, pre-tap): "${value}"`);
} else {
  // ── Happy path: tap Begin, then read REAL audio + confetti state ──
  const preClick = await page.evaluate(() => ({
    audioState: window.__beginGate.audioState,
    musicPlaying: window.__beginGate.musicPlaying,
    el: window.__beginGate.audioElement,
  }));
  assert(preClick.musicPlaying === false, 'no audio playing BEFORE the gesture', `playing=${preClick.musicPlaying}`);
  assert(preClick.audioState === 'idle', 'audio state is idle before the gesture', `state=${preClick.audioState}`);

  // Count confetti calls by instrumenting before the click.
  await page.evaluate(() => {
    window.__confettiCalls = 0;
    const real = window.confetti;
    window.confetti = function (...a) { window.__confettiCalls++; return real.apply(this, a); };
  });

  await page.click('#begin-button');

  // Wait for the observable condition (audio decoded AND clock advancing)
  // rather than a fixed sleep, so this never passes or fails on timing luck.
  let audioLive = false;
  try {
    await page.waitForFunction(() => {
      const el = window.__beginGate.audioElement;
      return !!el && el.readyState >= 2 && el.currentTime > 0 && el.paused === false;
    }, null, { timeout: 15000 });
    audioLive = true;
  } catch { audioLive = false; }

  const post = await page.evaluate(() => ({
    audioState: window.__beginGate.audioState,
    musicPlaying: window.__beginGate.musicPlaying,
    el: window.__beginGate.audioElement,
    confettiCalls: window.__confettiCalls,
    overlayHidden: document.getElementById('begin-overlay').hidden,
    countdownVisible: !document.getElementById('countdown-panel').hidden,
    countdownValue: document.getElementById('countdown-value').textContent,
    fallbackVisible: window.__beginGate.fallbackVisible,
    musicControlVisible: !document.getElementById('music-control').hidden,
    contentChildren: window.__beginGate.contentChildCount,
    dataLocked: document.documentElement.getAttribute('data-locked'),
  }));

  say('# post-click real state: ' + JSON.stringify(post, null, 2));
  say('# real <audio> element: ' + JSON.stringify(post.el));

  assert(post.overlayHidden === true, 'begin overlay dismissed after tap');
  assert(post.confettiCalls >= 1, 'confetti burst fired inside the click handler', `calls=${post.confettiCalls}`);
  assert(post.musicPlaying === true, 'Howler reports playing after gesture', `playing=${post.musicPlaying}`);
  assert(audioLive, 'audio decoded and clock advanced (readyState>=2, currentTime>0, not paused)',
    `el=${JSON.stringify(post.el)}`);
  assert(post.el && post.el.paused === false, 'audio element is not paused', `paused=${post.el && post.el.paused}`);
  assert(post.fallbackVisible === false, 'no play fallback shown when audio started');
  assert(post.musicControlVisible === true, 'music control revealed once playing');
  assert(post.countdownVisible === true, 'countdown panel visible after tap');
  assert(/^\d+d \d{2}h \d{2}m \d{2}s$/.test(post.countdownValue.trim()), 'countdown ticking in d/h/m/s', `value="${post.countdownValue}"`);
  assert(post.contentChildren === 0, 'content still locked (clock is before target)', `children=${post.contentChildren}`);
  assert(post.dataLocked === 'true', 'html[data-locked] still true before target');

  // Screenshot must not hang on the Google Fonts request.
  await page.screenshot({ path: join(evidence, 'task-2-begin.png'), timeout: 15000, animations: 'allow' }).catch((e) => {
    say(`# screenshot failed (non-fatal): ${e.message.split('\n')[0]}`);
  });
  say('# screenshot -> .omo/evidence/halimah-birthday-site/task-2-begin.png');
}

// ── Unlock probe: jump the clock past the target and confirm the gate opens ──
if (mode === 'happy') {
  await page.evaluate(() => {
    // Move "now" past the target by updating the mutable clock value.
    window.__clockNow = Date.parse('2026-10-19T00:00:05+01:00');
  });
  await page.waitForTimeout(800);
  const unlocked = await page.evaluate(() => ({
    unlocked: window.__beginGate.unlocked,
    dataUnlocked: document.documentElement.getAttribute('data-unlocked'),
    contentChildren: window.__beginGate.contentChildCount,
    sections: document.querySelectorAll('#content-region > section').length,
    starmapBack: !!document.getElementById('starmap'),
    confettiCalls: window.__confettiCalls,
    countdownHidden: document.getElementById('countdown-panel').hidden,
  }));
  say('# post-target real state: ' + JSON.stringify(unlocked));
  assert(unlocked.unlocked === true, 'gate reports unlocked at/after target');
  assert(unlocked.sections === 9, 'all 9 content sections restored in order', `sections=${unlocked.sections}`);
  assert(unlocked.starmapBack === true, 'star map restored into DOM after unlock');
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('#content-region > section')].map((s) => s.id).join(',')
  );
  assert(order === 'story,quotes,gags,physics,scratch,album,starmap,world,finale', 'sections restored in source order', order);
}

assert(consoleErrors.length === 0, 'no console errors during run', consoleErrors.join(' | '));

say(`# RESULT: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);

await writeFileSafe(join(evidence, mode === 'happy' ? 'task-2-audio.log' : 'task-2-locked.log'), log.join('\n') + '\n');

await browser.close();
server.close();
process.exit(failures === 0 ? 0 : 1);

async function writeFileSafe(p, body) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, body);
}
