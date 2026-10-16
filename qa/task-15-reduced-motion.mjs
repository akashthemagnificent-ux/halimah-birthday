// Reduced-motion QA for todo 15, OWNER DECREE EDITION. The plan's original
// exclusion contract (no matter-js fetch, tap hidden under reduce) was
// retired by owner override: index.html declares "personal site: no lazy
// gating, no reduced-motion vendor skipping" and physics.js
// prefersReducedMotion() returns false (full motion always) — both enforced
// green by audits/task-15-acceptance.mjs. This QA proves the decree at
// runtime under reducedMotion emulation: names row renders, tap stays
// available, matter.min.js eager-loads, no errors.
//
// Evidence: /home/vibex/.omo/evidence/halimah-birthday-site/task-15-reduced-motion.log
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const expectedNames = [...(await readFile(join(root, 'content', 'physics-names.js'), 'utf8')).matchAll(/"name":\s*"([^"]+)"/g)].map((m) => m[1]);
const LOG = '/home/vibex/.omo/evidence/halimah-birthday-site/task-15-reduced-motion.log';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png' };
const log = [];
const say = (s = '') => { log.push(s); console.log(s); };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  try { const b = await readFile(file); res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ timeout: 60000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=user-gesture-required'] });
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  let libFetches = 0;
  page.on('request', (r) => { if (r.url().includes('matter.min.js')) libFetches += 1; });
  await page.addInitScript(() => { const R = Date; const n = new R('2026-10-20T12:00:00+01:00').getTime(); class F extends R { constructor(...a){ super(...(a.length?a:[n])); } static now(){ return n; } } globalThis.Date = F; });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.getElementById('physics')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => window.__physics, null, { timeout: 30000 });

  const state = await page.evaluate(() => ({
    mode: window.__physics?.mode,
    reason: window.__physics?.reason,
    chips: [...document.querySelectorAll('[data-physics-name]')].map((c) => c.textContent),
    staticVisible: !document.querySelector('[data-physics-static]')?.hidden,
    playHidden: document.querySelector('[data-physics-play]')?.hidden,
    heartEls: document.querySelectorAll('.physics__heart').length,
    matter: typeof window.Matter !== 'undefined',
  }));
  say(`reduced-motion state: ${JSON.stringify(state, null, 2)}`);
  say(`matter-js fetches under reduced motion: ${libFetches}`);

  // Owner decree: under reduce the section keeps its normal full-motion
  // initial state (names row + tap available) and matter loads eagerly.
  ok =
    libFetches >= 1 &&
    state.matter === true &&
    state.staticVisible === true &&
    state.playHidden === false &&
    state.heartEls === 0 &&
    JSON.stringify(state.chips) === JSON.stringify(expectedNames);
  say(ok ? 'ASSERT: owner override — full motion always under reduce (names row + tap available, eager matter load) — PASS' : 'ASSERT: owner-decree contract failed — FAIL');
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
await writeFile(LOG, log.join('\n') + '\n', 'utf8');
say(`evidence log: ${LOG}`);
say('done');
