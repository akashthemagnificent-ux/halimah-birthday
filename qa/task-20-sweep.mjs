/* Task 20 sweep: 4-viewport screenshots + cold-load timing + reduced-motion.
 *
 * Screenshots: 375 / 768 / 1280 / 1920, taken past-target so the full
 * unlocked page is captured (that is what she will actually see).
 *
 * Cold-load timing: measured from a real navigation with an empty HTTP cache
 * and a throttled link, reading the browser's own navigation + paint metrics.
 * Nothing here is computed from a budget estimate.
 *
 * Reduced motion: a separate context with reducedMotion:'reduce' must render
 * every chapter card static and readable with no motion module work.
 *
 * Usage: bun qa/task-20-sweep.mjs
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globSync } from 'node:fs';

const pw = await (async () => {
  const pick = (m) => (m && m.chromium ? m : m && m.default ? m.default : null);
  try { return pick(await import('playwright')); } catch {}
  for (const hit of globSync('/home/vibex/.npm/_npx/*/node_modules/playwright/index.js')) {
    try { const m = pick(await import(pathToFileURL(hit).href)); if (m) return m; } catch {}
  }
  throw new Error('playwright not found in npx cache');
})();
const { chromium } = pw;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = join(root, '..', '.omo', 'evidence', 'halimah-birthday-site');
await mkdir(evidence, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
};

let failures = 0;
const assert = (cond, label, detail = '') => {
  if (!cond) failures += 1;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ' :: ' + detail : ''}`);
};

// The six album photo probes 404 by design while the owner folder is empty.
const isPhotoProbe = (u) => /assets\/photos\/photo-\d+\.jpg$/.test(u);

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('nf');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const html = await readFile(join(root, 'index.html'));
const buildHash = createHash('sha256').update(html).digest('hex').slice(0, 16);
console.log(`# task-20 sweep — build sha256(index.html)=${buildHash}`);
console.log(`# served from ${base}`);

// Past-target clock: the gate auto-unlocks, which is the real 19 Oct state.
const clock = `(() => {
  const R = Date; const T = R.parse('2026-10-20T12:00:00+01:00');
  function F(...a) { return a.length === 0 ? new R(T) : new R(...a); }
  F.now = () => T; F.parse = R.parse; F.UTC = R.UTC; F.prototype = R.prototype;
  window.Date = F;
})();`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

// ── 1. Four viewports ──────────────────────────────────────────────
const VIEWPORTS = [
  { w: 375, h: 812, label: 'mobile' },
  { w: 768, h: 1024, label: 'tablet' },
  { w: 1280, h: 800, label: 'laptop' },
  { w: 1920, h: 1080, label: 'desktop' },
];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  await ctx.addInitScript(clock);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && !isPhotoProbe(r.url())) {
      errs.push(`HTTP ${r.status()} ${r.url().split('/').slice(-2).join('/')}`);
    }
  });
  await page.goto(base, { waitUntil: 'load' });
  // Wait for the gate to actually restore the content region.
  await page.waitForFunction(() => window.__beginGate?.unlocked === true, null, { timeout: 10000 });

  // The unlock fires a confetti burst. Screenshotting into it captures a wall
  // of particles, which proves nothing about layout. Wait for the burst to
  // actually stop (observable: the confetti canvas stops changing), then
  // scroll to real content so the frame shows the page, not an empty canvas.
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas');
    if (!c) return true;
    const ctx2 = c.getContext('2d');
    if (!ctx2) return true;
    const d = ctx2.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4 * 97) { if (d[i] > 8) lit++; }
    return lit === 0;
  }, null, { timeout: 15000, polling: 400 }).catch(() => {});
  await page.waitForTimeout(400);

  await page.evaluate(() => document.getElementById('story')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(900);

  const overflow = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    sections: document.querySelectorAll('#content-region > section').length,
    chapterText: (document.querySelector('#story .story__headline, #story .story__quote')?.textContent || '').trim().length,
  }));
  const file = `task-20-${vp.w}.png`;
  await page.screenshot({ path: join(evidence, file), fullPage: false });
  console.log(`# ${vp.w}x${vp.h} (${vp.label}) -> ${file} :: sections=${overflow.sections} scrollW=${overflow.docW} winW=${overflow.winW} storyTextLen=${overflow.chapterText}`);
  assert(overflow.docW <= overflow.winW + 1, `no horizontal overflow at ${vp.w}px`, `scrollW=${overflow.docW} winW=${overflow.winW}`);
  assert(overflow.sections === 9, `all 9 sections present at ${vp.w}px`, `sections=${overflow.sections}`);
  // Guards against a "passing" screenshot that shows only confetti/empty canvas.
  assert(overflow.chapterText > 0, `story content is on screen at ${vp.w}px`, `storyTextLen=${overflow.chapterText}`);
  assert(errs.length === 0, `no page/HTTP errors at ${vp.w}px`, errs.slice(0, 4).join(' | '));
  await ctx.close();
}

// ── 2. Cold-load timing (empty cache + throttled link) ──────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(clock);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  // Real network throttling: Fast 3G-ish, plus an empty cache.
  await cdp.send('Network.enable');
  await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__beginGate?.unlocked === true, null, { timeout: 20000 });

  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      ttfb: Math.round(nav.responseStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      firstPaint: fcp ? Math.round(fcp.startTime) : null,
      transferBytes: nav.transferSize,
    };
  });
  console.log('# cold-load (throttled, empty cache): ' + JSON.stringify(timing));
  assert(timing.ttfb < 1500, 'TTFB under 1.5s on a throttled cold load', `${timing.ttfb}ms`);
  assert(timing.load < 8000, 'load event under 8s on a throttled cold load', `${timing.load}ms`);
  assert(timing.firstPaint !== null && timing.firstPaint < 3000, 'first contentful paint under 3s', `${timing.firstPaint}ms`);
  await ctx.close();
}

// ── 3. Reduced motion ──────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(clock);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__beginGate?.unlocked === true, null, { timeout: 10000 });
  await page.waitForTimeout(1500);

  const rm = await page.evaluate(() => {
    const chapters = [...document.querySelectorAll('#story .story__chapter')];
    const visible = chapters.filter((c) => {
      const s = getComputedStyle(c);
      return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.5;
    });
    const inner = [...document.querySelectorAll('#story .story__chapter-inner')].map((e) => getComputedStyle(e).position);
    return {
      total: chapters.length,
      visible: visible.length,
      innerPositions: [...new Set(inner)],
      confettiRan: typeof window.confetti === 'function',
    };
  });
  console.log('# reduced motion: ' + JSON.stringify(rm));
  // Under reduced motion there is no pinned scrub, so the page is a plain
  // static column — scroll to a real chapter before capturing, otherwise the
  // frame is an empty canvas and proves nothing.
  await page.evaluate(() => document.querySelector('#story .story__chapter')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(700);
  const rmShot = await page.evaluate(() => {
    const c = document.querySelector('#story .story__quote');
    return { quoteText: (c?.textContent || '').trim().length };
  });
  await page.screenshot({ path: join(evidence, 'task-20-reduced-motion.png') });
  assert(rm.total > 0 && rm.visible === rm.total, 'all story chapters readable under reduced motion', `visible=${rm.visible}/${rm.total}`);
  assert(rm.innerPositions.every((p) => p === 'static'), 'no pinned/scrubbed positioning under reduced motion', rm.innerPositions.join(','));
  // The reduced-motion screenshot must show a real chapter, not an empty canvas.
  assert(rmShot.quoteText > 0, 'reduced-motion frame shows real chapter text', `quoteTextLen=${rmShot.quoteText}`);
  assert(errs.length === 0, 'no page errors under reduced motion', errs.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(`# cleanup: browser closed, server closed`);
console.log(`# RESULT: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
