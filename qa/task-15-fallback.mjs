// Failure-path QA for todo 15 (physics playground): library blocked.
// Blocks the vendor/matter.min.js request to simulate a CDN/offline failure,
// then taps "let them float" and asserts the section falls back to the static
// names layout (chips visible, a note shown, no Matter global).
//
// Evidence: /home/vibex/.omo/evidence/halimah-birthday-site/task-15-fallback.log
// Adversarial coverage:
//   - stale_state: served over HTTP from disk; build hash of index.html logged.
//   - misleading-success-output: asserts live DOM state (chips present, static
//     wrap not hidden, Matter undefined) after the real blocked request, not a
//     string the page printed.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG = '/home/vibex/.omo/evidence/halimah-birthday-site/task-15-fallback.log';

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
say(`# task-15 fallback QA (library blocked) — served from ${base}`);
say(`# build hash index.html=${createHash('sha256').update(html).digest('hex').slice(0, 16)}`);

const browser = await chromium.launch({
  timeout: 60000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=user-gesture-required'],
});
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

  // Simulate the library being blocked/offline.
  let blocked = 0;
  await page.route('**/vendor/matter.min.js', (route) => {
    blocked += 1;
    route.abort();
  });

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
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.getElementById('physics')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(
    () => window.__physics || !document.querySelector('[data-physics-play]')?.hidden,
    { timeout: 10000 }
  );

  // Opt in -> the lazy fetch is blocked -> must fall back to static.
  await page.click('[data-physics-play]');
  await page.waitForFunction(() => window.__physics?.mode === 'static', { timeout: 8000 });

  const state = await page.evaluate(() => ({
    mode: window.__physics?.mode,
    reason: window.__physics?.reason,
    names: window.__physics?.names,
    matter: typeof window.Matter !== 'undefined',
    staticVisible: !document.querySelector('[data-physics-static]')?.hidden,
    staticDisplay: getComputedStyle(document.querySelector('[data-physics-static]')).display,
    chips: [...document.querySelectorAll('[data-physics-name]')].map((c) => c.textContent),
    note: document.querySelector('[data-physics-note]')?.textContent || '',
    heartEls: document.querySelectorAll('.physics__heart').length,
  }));
  say(`blocked requests: ${blocked}`);
  say(`fallback state: ${JSON.stringify(state, null, 2)}`);

  ok =
    blocked >= 1 &&
    state.mode === 'static' &&
    state.matter === false &&
    state.staticVisible === true &&
    state.staticDisplay !== 'none' &&
    JSON.stringify(state.chips) === JSON.stringify(['Zai', 'Halimah', 'princess', 'Ash', 'hubby']) &&
    state.heartEls === 0 &&
    /physics stayed asleep/i.test(state.note);

  say(ok ? 'ASSERT: blocked library -> static names layout shown (5 lore names, no Matter) — PASS'
         : 'ASSERT: fallback did not engage as expected — FAIL');
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

await writeFile(LOG, log.join('\n') + '\n', 'utf8');
say(`evidence log: ${LOG}`);
say('done');
