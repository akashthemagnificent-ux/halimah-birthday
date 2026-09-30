// Happy-path visual QA for todo 15 (physics playground).
// Serves the site over HTTP, fakes the clock past the 19 Oct gate so the real
// handler unlocks, opens the nook at 375px, taps "let them float" (lazy-loads
// matter-js), then performs a REAL pointer drag (shove) on a heart and asserts
// the heart's physics position actually moved. Screenshots the result.
//
// Evidence: /home/vibex/.omo/evidence/halimah-birthday-site/task-15-physics.png
// Adversarial coverage:
//   - stale_state: served over HTTP from disk; build hash of index.html logged.
//   - misleading-success-output: asserts live DOM/engine state (chip count,
//     __physics.mode, heart body positions before/after drag, Matter global),
//     never a string the page printed.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site/task-15-physics.png';

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
say(`# task-15 physics QA — served from ${base}`);
say(`# build hash index.html=${createHash('sha256').update(html).digest('hex').slice(0, 16)}`);

const browser = await chromium.launch({
  timeout: 60000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=user-gesture-required'],
});
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) errors.push(m.text()); });

  await page.addInitScript(() => {
    const RealDate = Date;
    const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
    class FakeDate extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fakeNow])); }
      static now() { return fakeNow; }
    }
    globalThis.Date = FakeDate;
  });

  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(3000); // let the real gate + confetti settle

  // Scroll the nook into view. physics.js is injected by the site's
  // IntersectionObserver lazy-loader (like every other section), so wait for the
  // real boot signal (the "let them float" tap appearing) instead of sleeping.
  await page.evaluate(() => document.getElementById('physics')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(
    () => window.__physics && !document.querySelector('[data-physics-play]')?.hidden,
    { timeout: 10000 }
  );

  // Before opt-in: static mode, names already rendered from the JSON.
  const preState = await page.evaluate(() => ({
    mode: window.__physics?.mode,
    names: window.__physics?.names,
    chips: [...document.querySelectorAll('[data-physics-name]')].map((c) => c.textContent),
    staticVisible: !document.querySelector('[data-physics-static]')?.hidden,
    playVisible: !document.querySelector('[data-physics-play]')?.hidden,
  }));
  say(`pre-opt-in state: ${JSON.stringify(preState)}`);

  // Tap "let them float" -> lazy-load matter-js, build world.
  await page.click('[data-physics-play]');
  await page.waitForFunction(() => window.__physics?.mode === 'physics', { timeout: 8000 });
  await page.waitForTimeout(1200); // let bodies settle/fall

  const postState = await page.evaluate(() => ({
    mode: window.__physics?.mode,
    heartCount: window.__physics?.heartCount,
    names: window.__physics?.names,
    matter: typeof window.Matter !== 'undefined',
    // The static chips row must be GONE once physics owns the stage; a hidden
    // attribute that loses to `display:flex` would leave both layers visible.
    staticVisibleAfter: !document.querySelector('[data-physics-static]')?.hidden,
    staticDisplayAfter: getComputedStyle(document.querySelector('[data-physics-static]')).display,
    heartEls: document.querySelectorAll('.physics__heart').length,
    bubbles: window.__physics?.bubbles.map((b) => ({ name: b.name, x: Math.round(b.body.position.x), y: Math.round(b.body.position.y) })),
  }));
  say(`post-opt-in state: ${JSON.stringify(postState)}`);

  // Pause integration so the grab is deterministic: a heart that is still
  // falling would drift out of the 34px hit-test between sampling and pressing,
  // and the press would miss (which looks like "the drag does nothing").
  await page.evaluate(() => window.__physics?.setPaused?.(true));
  await page.waitForTimeout(120);

  // Re-center the stage in the viewport right before grabbing, so the stage
  // rect is fully on-screen and a heart's screen y lands inside the viewport.
  await page.evaluate(() => document.querySelector('[data-physics-stage]')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);

  // Pick a heart that is on-screen and clear of the stage edges, so the press
  // lands inside the stage and inside the 34px hit-test (a heart near the top
  // edge can be flung above the viewport, and the press would miss).
  const target = await page.evaluate(() => {
    const bubbles = window.__physics?.bubbles || [];
    const stage = document.querySelector('[data-physics-stage]');
    const r = stage.getBoundingClientRect();
    const cands = bubbles
      .map((b) => ({ b, x: b.body.position.x, y: b.body.position.y }))
      .filter((c) => c.x > 60 && c.x < r.width - 60 && c.y > 60 && c.y < r.height - 40)
      .sort((a, c) => a.y - c.y);
    const pick = cands[0] || bubbles.map((b) => ({ b, x: b.body.position.x, y: b.body.position.y }))[0];
    if (!pick) return null;
    return { x: pick.x + r.left, y: pick.y + r.top, name: pick.b.name, before: { x: pick.x, y: pick.y } };
  });
  say(`drag target: ${JSON.stringify(target)}`);

  let peakMove = 0;
  let grabbed = { dragging: null };
  if (target) {
    // Drag outward (away from the pile, away from the walls) so the shove is
    // decisive and not fighting gravity or a wall.
    const dir = target.x < 200 ? 1 : -1;
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    // Hand the heart back to the live engine, then drag for real.
    await page.evaluate(() => window.__physics?.setPaused?.(false));
    grabbed = await page.evaluate(() => ({ dragging: window.__physics?.dragging || null }));
    say(`grab state: ${JSON.stringify(grabbed)}`);
    let peak = target.before;
    for (let i = 1; i <= 18; i++) {
      await page.mouse.move(target.x + dir * i * 12, target.y + (i % 2 === 0 ? 2 : -2));
      await page.waitForTimeout(16);
      // Sample mid-drag: a held body tracks the cursor, so the peak displacement
      // is the honest proof of a real shove (post-release the body re-settles).
      const cur = await page.evaluate((n) => {
        const b = window.__physics?.bubbles?.find((x) => x.name === n);
        return b ? { x: b.body.position.x, y: b.body.position.y } : null;
      }, target.name);
      if (cur) peak = cur;
    }
    await page.mouse.up();
    await page.waitForTimeout(400);
    peakMove = Math.hypot(peak.x - target.before.x, peak.y - target.before.y);
  }

  const after = await page.evaluate((name) => {
    const b = window.__physics?.bubbles?.find((x) => x.name === name);
    return b ? { x: b.body.position.x, y: b.body.position.y } : null;
  }, target?.name);
  const moved = target && after
    ? Math.hypot(after.x - target.before.x, after.y - target.before.y)
    : 0;
  // The shove proof is the mid-drag displacement: deterministic and immune to
  // how the body re-settles after release.
  const shove = Math.max(moved, peakMove);
  say(`shove result: before=${JSON.stringify(target?.before)} after=${JSON.stringify(after)} released=${moved.toFixed(1)}px peakDrag=${peakMove.toFixed(1)}px`);

  // The grab must have landed: the product's own pointerdown handler names the
  // heart it picked. Without a real grab the drag is a no-op and the measured
  // displacement is just the heart free-falling.
  ok =
    target != null &&
    grabbed.dragging === target.name &&
    preState.mode === 'static-pending' &&
    preState.staticVisible === true &&
    JSON.stringify(preState.chips) === JSON.stringify(['Zai', 'Halimah', 'princess', 'Ash', 'hubby']) &&
    postState.mode === 'physics' &&
    postState.matter === true &&
    postState.heartCount === 5 &&
    postState.staticVisibleAfter === false &&
    postState.staticDisplayAfter === 'none' &&
    postState.heartEls === 5 &&
    JSON.stringify(postState.names) === JSON.stringify(['Zai', 'Halimah', 'princess', 'Ash', 'hubby']) &&
    shove > 40; // the held body tracked a long drag — a real, decisive shove

  say(ok ? 'ASSERT: names pre-rendered static, lazy physics loaded, 5 lore names, real shove moved a heart — PASS'
         : 'ASSERT: physics/shove state mismatch — FAIL');

  await page.evaluate(() => document.getElementById('physics')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT, fullPage: false });
  say(`screenshot: ${OUT}`);

  say(`console/page errors: ${errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none'}`);
  if (errors.length > 0) ok = false;
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
say('done');
