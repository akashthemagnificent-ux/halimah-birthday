// Task-9 QA: serve from disk (build hash logged = anti-stale-state),
// unlock the countdown gate with a post-target clock, tap Begin,
// screenshot the gags room at 375px, assert real DOM state.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globSync } from 'node:fs';

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
await mkdir(evidence, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  try {
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

const html = await readFile(join(root, 'index.html'));
console.log(`# task-9 QA served from ${base}`);
console.log(`# build hash index.html=${createHash('sha256').update(html).digest('hex').slice(0, 16)}`);

const browser = await chromium.launch({ timeout: 60000, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
// Post-target clock: 20 Oct 2026, so the gate unlocks on load (proves the
// screenshot shows the real unlocked room, not the locked shell).
await page.addInitScript(() => {
  const RealDate = Date;
  const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fakeNow);
      else super(...args);
    }
    static now() { return fakeNow; }
  }
  globalThis.Date = FakeDate;
});
await page.goto(base, { waitUntil: 'load' });
// Post-target clock: boot() unlocks immediately and hides the overlay,
// so there is no Begin button to click — assert that real unlocked state.
await page.waitForSelector('#gags .gags__card', { timeout: 10000 });

const state = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#gags .gags__card')].map((c) => ({
    key: c.getAttribute('data-gags-card'),
    gag: !!c.querySelector('blockquote'),
    closer: !!c.querySelector('.gags__closer'),
  }));
  return {
    cards,
    spiderSvg: !!document.querySelector('[data-testid="gag-spider-svg"]'),
    spiderImg: document.querySelectorAll('#gags img').length,
    boopH: document.querySelector('[data-testid="gag-spider-boop"]')?.getBoundingClientRect().height ?? 0,
    unlocked: document.documentElement.getAttribute('data-unlocked'),
  };
});
console.log(JSON.stringify(state, null, 2));
if (state.cards.length !== 4) throw new Error(`expected 4 cards, got ${state.cards.length}`);
for (const c of state.cards) {
  if (!c.gag || !c.closer) throw new Error(`card ${c.key} missing gag or closer`);
}
if (!state.spiderSvg) throw new Error('spider SVG missing');
if (state.spiderImg !== 0) throw new Error('unexpected <img> in gags room');
if (state.boopH < 44) throw new Error(`boop target ${state.boopH}px < 44px`);

// Let the unlock confetti settle, scroll the room into view so the
// reveal fires, then capture the gags element itself (not the viewport).
await page.waitForTimeout(2500);
await page.evaluate(() => document.getElementById('gags').scrollIntoView({ block: 'start' }));
await page.waitForTimeout(1200);
// Walk every card through the viewport so the reveal fires for each,
// assert visibility (proves no card is stuck invisible), then capture.
const keys = ['buddy', 'goodboy', 'hashbrown', 'spider'];
for (const key of keys) {
  await page.evaluate((k) => document.querySelector(`[data-gags-card="${k}"]`).scrollIntoView({ block: 'center' }), key);
  await page.waitForTimeout(600);
  const vis = await page.evaluate((k) => document.querySelector(`[data-gags-card="${k}"]`).classList.contains('is-visible'), key);
  if (!vis) throw new Error(`card ${key} never revealed on scroll`);
}
console.log('# all 4 cards revealed on scroll');
// 375px viewport proofs: header + first two cards, then the spider card.
await page.evaluate(() => document.getElementById('gags').scrollIntoView({ block: 'start' }));
await page.waitForTimeout(800);
await page.screenshot({ path: join(evidence, 'task-9-gags.png') });
await page.evaluate(() => document.querySelector('[data-gags-card="spider"]').scrollIntoView({ block: 'center' }));
await page.waitForTimeout(800);
await page.screenshot({ path: join(evidence, 'task-9-gags-spider.png') });
const gagsEl = page.locator('#gags');
await gagsEl.screenshot({ path: join(evidence, 'task-9-gags-tall.png') });
await page.evaluate(() => document.getElementById('gags').scrollIntoView({ block: 'end' }));
await page.waitForTimeout(600);
await gagsEl.screenshot({ path: join(evidence, 'task-9-gags-full.png') });
const room = await page.evaluate(() => {
  const el = document.getElementById('gags');
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height };
});
console.log(`# room top=${Math.round(room.top)} height=${Math.round(room.height)}`);
// Reduced-motion pass: cards must be fully readable, no reveal class, no wiggle.
const rmCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
await rmCtx.addInitScript(() => {
  const RealDate = Date;
  const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
  class FakeDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(fakeNow); else super(...args); }
    static now() { return fakeNow; }
  }
  globalThis.Date = FakeDate;
});
const rmPage = await rmCtx.newPage();
await rmPage.goto(base, { waitUntil: 'load' });
await rmPage.waitForSelector('#gags .gags__card', { timeout: 10000 });
const rmState = await rmPage.evaluate(() => {
  const cards = [...document.querySelectorAll('#gags .gags__card')];
  return {
    jsGags: document.documentElement.classList.contains('js-gags'),
    visible: cards.map((c) => getComputedStyle(c).opacity),
  };
});
console.log(JSON.stringify(rmState));
if (rmState.jsGags) throw new Error('js-gags applied under reduced-motion');
if (!rmState.visible.every((o) => o === '1')) throw new Error(`cards hidden under reduced-motion: ${rmState.visible}`);
console.log('# reduced-motion: 4/4 cards readable, no reveal');
await rmCtx.close();
await browser.close();
server.close();
console.log('PASS task-9 QA: 4 cards verified in live DOM, screenshots saved');
