// Happy-path visual QA for todo 13 (her-world strip).
// Serves the site over HTTP from disk, fakes the clock past the 19 Oct
// gate so the content region unlocks via the REAL gate handler, scrolls
// each motif card into view (firing the real IntersectionObserver
// reveal), then screenshots at 375px.
//
// Evidence: .omo/evidence/halimah-birthday-site/task-13-world.png
// Adversarial coverage: stale_state (build hash logged from disk bytes;
// served over HTTP, never file://); misleading-success-output (asserts
// read live DOM counts, computed styles, and real reveal state — card
// count, motif attributes, .is-in + opacity per card — never a string
// the page printed).
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site/task-13-world.png';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const log = [];
const say = (s = '') => { log.push(s); console.log(s); };

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
say(`# task-13 world screenshot QA — served from ${base}`);
say(`# build hash index.html=${createHash('sha256').update(html).digest('hex').slice(0, 16)}`);

const browser = await chromium.launch({
  timeout: 60000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=user-gesture-required'],
});
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const seen404 = new Set();
  page.on('response', (r) => {
    if (r.status() >= 400 && !/assets\/(photos|music)\//.test(r.url())) {
      const tag = `HTTP ${r.status()} ${r.url().split('/').slice(-2).join('/')}`;
      if (!seen404.has(tag)) { seen404.add(tag); errors.push(tag); }
    }
  });
  // Console 404 text carries no URL; the response hook above attributes
  // them instead, so drop bare console 404s to avoid double counting.
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource.*404/.test(m.text())) return;
    errors.push(m.text());
  });
  // Fake the date to 20 Oct 2026 so the REAL gate handler auto-unlocks.
  await page.addInitScript(() => {
    const RealDate = Date;
    const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
    class FakeDate extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fakeNow])); }
      static now() { return fakeNow; }
    }
    globalThis.Date = FakeDate;
  });
  await page.goto(base, { waitUntil: 'load', timeout: 60000 });
  // html{scroll-behavior:smooth} makes every scrollIntoView animate (and
  // starve/interrupt under swiftshader); force instant scrolls for the walk.
  await page.evaluate(() => {
    const sb = document.createElement('style');
    sb.textContent = 'html { scroll-behavior: auto !important; }';
    document.head.appendChild(sb);
  });
  // Let the unlock confetti cannon (real gate behavior) settle first.
  await page.waitForTimeout(3500);

  const dom = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#world [data-motif]')];
    return {
      unlocked: window.__beginGate?.unlocked,
      cards: cards.length,
      motifs: cards.map((c) => c.getAttribute('data-motif')),
      stubs: document.querySelectorAll('#world .world__stub-title').length,
      badges: document.querySelectorAll('#world .world__badge').length,
      dmQuotes: document.querySelectorAll('#world blockquote.world__dm').length,
    };
  });
  say(`live DOM state: ${JSON.stringify(dom)}`);

  // sections/world.js is a lazy section: it only runs (and only then attaches
  // its reveal IntersectionObserver and adds html.js-world) once the world
  // section scrolls into view. Bring it in and wait for the opt-in class so the
  // per-card reveal below is measuring the real observer, not a section whose
  // script has not loaded yet.
  await page.evaluate(() => document.getElementById('world')?.scrollIntoView({ block: 'center' }));
  try {
    await page.waitForFunction(
      () => document.documentElement.classList.contains('js-world'),
      null,
      { timeout: 8000 },
    );
    say('# world.js lazy-loaded and observing (html.js-world present)');
  } catch {
    say('# js-world class never appeared (non-fatal, state read below)');
  }

  // Walk each card through the viewport so the real IO reveal fires,
  // then let the last stagger (90ms) + transition (600ms) fully settle.
  await page.evaluate(async () => {
    const cards = [...document.querySelectorAll(
      '#world .world__stage, #world .world__singers, #world .world__horror, #world .world__closer-block',
    )];
    // Freeze-aware poll (swiftshader main-thread freezes): count only alive
    // time, nudge rAF each tick so IntersectionObserver gets a rendering step
    // to deliver on, and stay on the block until is-in actually lands.
    const until = async (ms, test) => {
      let alive = 0;
      let last = performance.now();
      const t0 = last;
      while (alive < ms && performance.now() - t0 < ms * 4) {
        if (test()) return true;
        requestAnimationFrame(() => {});
        await new Promise((r) => setTimeout(r, 60));
        const now = performance.now();
        const gap = now - last;
        if (gap < 1000) alive += gap;
        last = now;
      }
      return test();
    };
    for (const card of cards) {
      card.scrollIntoView({ block: 'center' });
      await until(3000, () => card.classList.contains('is-in'));
    }
    await until(4000, () => cards.every(
      (c) => parseFloat(getComputedStyle(c).opacity) > 0.5,
    ));
  });

  const revealed = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(
      '#world .world__stage, #world .world__singers, #world .world__horror, #world .world__closer-block',
    )];
    return cards.map((c) => ({
      block: c.className.split(' ').filter((k) => k.startsWith('world__') && k !== 'world__block')[0] || c.className,
      in: c.classList.contains('is-in'),
      op: Math.round(parseFloat(getComputedStyle(c).opacity) * 100) / 100,
    }));
  });
  say(`reveal state: ${JSON.stringify(revealed)}`);

  // Current world contract (post-rebuild): 5 blocks (character, music,
  // singers, horror, bento); the 4 bento cells are upgraded into
  // .magic-bento__content by upgradeBento; 0 stubs, 1 badge, 3 DM quotes;
  // reveal is the four .world__* blocks above.
  const bento = await page.evaluate(() => ({
    cells: document.querySelectorAll('#world .magic-bento__content').length,
  }));
  say(`magic-bento cells: ${JSON.stringify(bento)}`);
  const ok =
    dom.unlocked === true &&
    dom.cards === 5 &&
    dom.stubs === 0 &&
    dom.badges === 1 &&
    dom.dmQuotes === 3 &&
    bento.cells === 4 &&
    revealed.length === 4 &&
    revealed.every((r) => r.in && r.op > 0.5);
  say(ok ? 'ASSERT: unlocked + 5 blocks + 4 magic-bento cells, 4 revealed (0 stubs, 1 badge, 3 DM quotes) — PASS'
         : `ASSERT: world state mismatch — FAIL (${JSON.stringify({dom, bento, revealed})})`);

  // Frame 1: section header + first cards.
  await page.evaluate(() => document.getElementById('world')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT, fullPage: false });
  say(`screenshot: ${OUT}`);

  // Frame 2: shelf bottom (last cards + closer).
  await page.evaluate(() => {
    document.querySelector('#world .world__closer-block')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT.replace('.png', '-bottom.png') });
  say(`screenshot: ${OUT.replace('.png', '-bottom.png')}`);

  say(`console/page errors (excl. album placeholder probes): ${errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none'}`);
  if (!ok || errors.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
say('done');
