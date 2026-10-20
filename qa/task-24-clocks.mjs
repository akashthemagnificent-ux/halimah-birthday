// Task-24 browser QA: the clocks page — live counters, rollover,
// WebGL-less fallback, no-JS fallback, and clean release from the
// pinned track.
//
// Usage: node qa/task-24-clocks.mjs [happy|nowebgl|nojs]
//
// Conventions copied from qa/task-12-finale.mjs: serve the static dir
// over HTTP from disk, log a sha256 build hash first (stale-state
// guard), read only real page state, close everything before exit.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EXE = '/root/.cache/ms-playwright/chromium-1243/chrome-linux-arm64/chrome';

const pw = await (async () => {
  const pick = (m) => (m && m.chromium ? m : m && m.default && m.default.chromium ? m.default : null);
  try { const p = pick(await import('playwright')); if (p) return p; } catch {}
  // This box has no standalone playwright package; the copy shipped with
  // omniroute is a real client. Point it at the patchright chromium build.
  const hit = '/usr/local/lib/node_modules/omniroute/node_modules/playwright/index.js';
  const m = pick(await import(pathToFileURL(hit).href));
  if (!m) throw new Error('playwright not found');
  return m;
})();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'happy';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.webp': 'image/webp', '.mp4': 'video/mp4'
};

let failures = 0;
const say = (s = '') => console.log(s);
const assert = (cond, label, detail = '') => {
  if (!cond) failures += 1;
  say(`[${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const file = join(root, normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const hash = createHash('sha256');
for (const f of ['index.html', 'sections/clocks.js', 'sections/clocks.css',
                 'sections/clocks-core.js', 'content/milestones.js']) {
  hash.update(await readFile(join(root, f)));
}
say(`# build sha256 = ${hash.digest('hex').slice(0, 16)}`);
say(`# mode = ${mode}`);

const browser = await pw.chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

// Shifted clock: real time offset so "now" is 2027-01-15T12:00:00Z at
// load. Shifted rather than frozen so the seconds still advance — the
// counters must be driven by the clock, and still move.
const clockScript = `(() => {
  const RealDate = Date;
  const OFFSET = RealDate.parse('2027-01-15T12:00:00Z') - RealDate.now();
  function FakeDate(...a) {
    return a.length === 0 ? new RealDate(RealDate.now() + OFFSET) : new RealDate(...a);
  }
  FakeDate.now = () => RealDate.now() + OFFSET;
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  FakeDate.prototype = RealDate.prototype;
  window.Date = FakeDate;
})();`;

const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  javaScriptEnabled: mode !== 'nojs'
});
if (mode !== 'nojs') await ctx.addInitScript(clockScript);
if (mode === 'nowebgl') {
  // three.js r160 asks for 'webgl2', then 'webgl', then the legacy name
  // 'experimental-webgl' — which does NOT start with 'webgl'. Test for the
  // substring, or the renderer still gets a context and reports "on".
  await ctx.addInitScript(`(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).indexOf('webgl') !== -1) return null;
      return orig.call(this, type, ...rest);
    };
  })();`);
}

const page = await ctx.newPage();
const consoleErrors = [];
const httpFailures = [];
// Headless chromium cannot hold a WebGL context on this box (the site falls
// back to the CSS ground, which is the path we assert). These are environment
// noise, all three reproduced on the pre-clocks baseline (630eae9) while
// scrolling the reels: three.js logging the context-creation failure, the
// intermittent THREE.WebGLProgram VALIDATE_STATUS failure, and the
// birthday.js instanced-mesh path that hits `Cannot read properties of null
// (reading 'trim')`. They pass on real devices. See the plan's Task 5 note.
const isNoise = (text) =>
  /WebGLRenderer|WebGL context could not be created|Error creating WebGL context|Cannot read properties of null \(reading 'trim'\)|Shader Error|VALIDATE_STATUS/.test(text) ||
  // bg-ballpit's own catch logs `[bg-ballpit] init failed: Error: no webgl2`
  // and hides its canvas — that IS the documented no-WebGL fallback path,
  // so it is only "noise" when we deliberately removed the context.
  (mode === 'nowebgl' && /\[bg-ballpit\] init failed/.test(text));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const text = m.text();
  if (isNoise(text)) return;
  consoleErrors.push(text);
});
page.on('pageerror', (e) => {
  if (isNoise(e.message || '')) return;
  consoleErrors.push('pageerror: ' + e.message);
});
page.on('response', (r) => { if (r.status() >= 400) httpFailures.push(r.status() + ' ' + r.url()); });

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

if (mode !== 'nojs') {
  try {
    await page.click('#begin-button', { timeout: 4000 });
    await page.waitForTimeout(1200);
  } catch { say('# begin click skipped'); }
}

// index.html sets `scroll-behavior: smooth`, and the clocks track is ~60k px
// down the page — a raw scrollTo would still be travelling when the assertions
// run, leaving the section (correctly) out of view and its loop stopped.
// Kill the smooth animation before seeking, as qa/task-13-smoke.mjs does.
await page.evaluate(() => {
  const sb = document.createElement('style');
  sb.textContent = 'html { scroll-behavior: auto !important; }';
  document.head.appendChild(sb);
});

// Scroll to the clocks section.
const scrolled = await page.evaluate(() => {
  const el = document.getElementById('clocks');
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, top + 10);
  return true;
});
assert(scrolled, 'clocks section exists');
await page.waitForTimeout(1200);

if (mode === 'nojs') {
  const text = await page.evaluate(() => {
    const el = document.getElementById('clocks');
    return el ? el.textContent : '';
  });
  assert(/26 august 2026/i.test(text), 'no-JS shows the together anchor');
  assert(/19 october/i.test(text), 'no-JS shows the birthday anchor');
  assert(/26 august 2027/i.test(text), 'no-JS shows the anniversary anchor');
} else {
  const first = await page.evaluate(() => {
    const r = document.querySelector('#clocks [data-milestone="together"]');
    return {
      days: r.querySelector('[data-unit="days"]').textContent,
      secs: r.querySelector('[data-unit="seconds"]').textContent,
      birthdayDays: document.querySelector('#clocks [data-milestone="birthday"] [data-unit="days"]').textContent,
      annivDays: document.querySelector('#clocks [data-milestone="anniversary"] [data-unit="days"]').textContent,
      webgl: document.getElementById('clocks').getAttribute('data-webgl')
    };
  });
  say(`# sample ${JSON.stringify(first)}`);

  assert(first.days !== '—' && first.days !== '', 'together shows a number', first.days);
  // 26 Aug 2026 00:00 London -> 15 Jan 2027 12:00Z = 142 days
  assert(Number(first.days) === 142, 'together days correct at the shifted clock', first.days);
  // 15 Jan 2027 12:00Z -> 19 Oct 2027 00:00 London = 276 days
  assert(Number(first.birthdayDays) === 276, 'birthday days correct', first.birthdayDays);
  // 15 Jan 2027 12:00Z -> 26 Aug 2027 00:00 London = 222 days
  assert(Number(first.annivDays) === 222, 'anniversary days correct', first.annivDays);

  await page.waitForTimeout(1600);
  const second = await page.evaluate(() =>
    document.querySelector('#clocks [data-milestone="together"] [data-unit="seconds"]').textContent);
  assert(second !== first.secs, 'seconds advance', `${first.secs} -> ${second}`);

  // A tab that comes back while the section is far offscreen must not
  // restart the loop — only IntersectionObserver gets to decide that.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const offscreenA = await page.evaluate(() =>
    document.querySelector('#clocks [data-milestone="together"] [data-unit="seconds"]').textContent);
  await page.waitForTimeout(2200);
  const offscreenB = await page.evaluate(() =>
    document.querySelector('#clocks [data-milestone="together"] [data-unit="seconds"]').textContent);
  assert(offscreenA === offscreenB, 'tab return does not tick while offscreen',
    `${offscreenA} -> ${offscreenB}`);

  // Back into view: the loop must resume.
  await page.evaluate(() => {
    const el = document.getElementById('clocks');
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 10);
  });
  await page.waitForTimeout(1200);
  const backA = await page.evaluate(() =>
    document.querySelector('#clocks [data-milestone="together"] [data-unit="seconds"]').textContent);
  await page.waitForTimeout(2200);
  const backB = await page.evaluate(() =>
    document.querySelector('#clocks [data-milestone="together"] [data-unit="seconds"]').textContent);
  assert(backA !== backB, 'loop resumes when scrolled back into view', `${backA} -> ${backB}`);

  if (mode === 'nowebgl') {
    assert(first.webgl === 'off', 'no-WebGL sets data-webgl="off"');
    assert(first.days === '142', 'counters still correct without WebGL');
  }

  // Scroll ~40% through the track so at least the first ring is in view
  // before measuring where the numerals actually land.
  await page.evaluate(() => {
    const sec = document.getElementById('clocks');
    const tr = sec.querySelector('[data-clocks-track]');
    window.scrollTo(0, sec.getBoundingClientRect().top + window.scrollY +
      Math.max(0, tr.offsetHeight - window.innerHeight) * 0.42);
  });
  await page.waitForTimeout(1200);

  // Geometry guards. Both of these shipped broken once:
  //  - the stage collapsed to a ~40px strip because the base .section is a
  //    flex column whose children shrink to fit;
  //  - the numerals were positioned against the collapsed .clocks__rings
  //    box instead of the stage, so every block landed hundreds of pixels
  //    below its ring and the third one sat off-screen.
  const geo = await page.evaluate(() => {
    const sec = document.getElementById('clocks');
    const stage = sec.querySelector('[data-clocks-stage]');
    const rings = sec.querySelector('.clocks__rings');
    const sr = stage.getBoundingClientRect();
    const rr = rings.getBoundingClientRect();
    const scroll = (els) => Math.max(...els.map((el) => {
      const b = el.getBoundingClientRect();
      return b.bottom + window.scrollY;
    }));
    const tops = [...sec.querySelectorAll('.clocks__ring')].map((el) => el.getBoundingClientRect().top);
    const sorted = tops.every((t, i) => i === 0 || t > tops[i - 1]);
    return {
      stageW: sr.width, viewportW: window.innerWidth,
      ringsT: rr.top, ringsH: rr.height, stageT: sr.top, stageH: sr.height,
      live: stage.classList.contains('is-live'),
      aboveFold: tops.filter((t) => t > -1 && t < window.innerHeight).length,
      sorted,
      stageScrollY: sr.top + window.scrollY,
      ringsScrollY: rr.top + window.scrollY
    };
  });

  assert(geo.stageW >= geo.viewportW * 0.9,
    'stage spans the viewport, not a strip', `${geo.stageW} of ${geo.viewportW}`);
  assert(geo.sorted, 'the three numeral blocks stack in DOM order');
  assert(geo.aboveFold >= 1, 'at least one numeral sits in the viewport', `${geo.aboveFold} visible`);
  if (geo.live) {
    // In live mode the JS writes stage-pixel transforms, so the container
    // must be the stage box or the numbers drift off their rings.
    assert(Math.abs(geo.ringsT - geo.stageT) <= 2 && Math.abs(geo.ringsH - geo.stageH) <= 2,
      'live numeral container is the stage box',
      JSON.stringify({ ringsT: geo.ringsT, stageT: geo.stageT, ringsH: geo.ringsH, stageH: geo.stageH }));
  }
}

// Release from the pinned track: past the section, the next element
// must not be overlapped by a stuck sticky stage. Three steps rather
// than one promise-returning evaluate — a page with JS disabled has no
// event loop for Playwright to awaitPromise against, and the browser
// dies mid-call.
const releaseSeek = await page.evaluate(() => {
  const el = document.getElementById('clocks');
  if (!el) return false;
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + el.offsetHeight + 200);
  return true;
});
if (releaseSeek) {
  await page.waitForTimeout(400);
  const release = await page.evaluate(() => {
    const stage = document.getElementById('clocks').querySelector('[data-clocks-stage]');
    const r = stage.getBoundingClientRect();
    return { stageBottom: r.bottom, viewport: window.innerHeight };
  });
  assert(release.stageBottom <= release.viewport + 2,
    'sticky stage releases after the track', JSON.stringify(release));
}

assert(httpFailures.length === 0, 'no HTTP >= 400', httpFailures.slice(0, 3).join(', '));
assert(consoleErrors.length === 0, 'no console/page errors', consoleErrors.slice(0, 3).join(' | '));

await ctx.close();
await browser.close();
server.close();

say(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
