// Task-12 browser QA: finale letter happy path + no-JS failure path.
//
// Happy  — unlocked page at 375px, click "open the letter", assert the
//          sealed->open transition from LIVE DOM state (classList, not
//          copy), screenshot the letter, emulate print CSS and screenshot
//          that as the print-to-PDF render.
//          Usage: node qa/task-12-qa.mjs happy
// Failure — same server, JavaScript disabled in the context: assert the
//          full letter text is in the DOM and visible (no sealed cover
//          can exist without the js-finale opt-in class).
//          Usage: node qa/task-12-qa.mjs nojs
//
// Conventions copied from qa/task-2-qa.mjs: serve the static dir over
// HTTP from disk, log a sha256 build hash first (stale-state guard), read
// only real page state, close everything before exit (cleanup receipt).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globSync } from 'node:fs';

const pw = await (async () => {
  const pick = (m) => (m && m.chromium ? m : m && m.default ? m.default : null);
  try {
    return pick(await import('playwright'));
  } catch {}
  const hits = globSync('/home/vibex/.npm/_npx/*/node_modules/playwright/index.js');
  for (const hit of hits) {
    try {
      const m = pick(await import(pathToFileURL(hit).href));
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
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
};

const log = [];
const say = (s = '') => { log.push(s); console.log(s); };
let failures = 0;
const assert = (cond, label, detail = '') => {
  if (!cond) failures += 1;
  say(`[${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (p === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('nf');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/index.html`;

// Stale-state guard: hash the exact bytes we serve.
const hash = createHash('sha256');
for (const f of ['index.html', 'sections/finale.css', 'sections/finale.js']) {
  hash.update(await readFile(join(root, f)));
}
say(`# build sha256(index+finale.css+finale.js) = ${hash.digest('hex').slice(0, 16)}`);
say(`# mode = ${mode}`);

const browser = await chromium.launch();

// Past-target clock so the countdown gate restores the finale section.
const clockScript = `(() => {
  const RealDate = Date;
  const T = RealDate.parse('2026-10-19T00:00:05+01:00');
  function FakeDate(...a) { return a.length === 0 ? new RealDate(T) : new RealDate(...a); }
  FakeDate.now = () => T;
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  FakeDate.prototype = RealDate.prototype;
  window.Date = FakeDate;
})();`;

const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  javaScriptEnabled: mode !== 'nojs',
});
await ctx.addInitScript(clockScript);
const page = await ctx.newPage();
const consoleErrors = [];
// The six album photo probes (assets/photos/photo-N.jpg) 404 by design while
// the owner's photo folder is empty — that is the zero-photo path working, not
// a regression. Their generic "Failed to load resource" console lines are held
// aside and only forgiven if the matching 404 photo-probe responses are seen;
// any OTHER 404 or console error still fails the run.
const photoProbeUrls = new Set();
const resourceErrorLines = [];
page.on('response', (r) => {
  if (r.status() === 404 && /assets\/photos\/photo-\d+\.jpg$/.test(r.url())) {
    photoProbeUrls.add(r.url());
  }
});
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const text = m.text();
  if (/Failed to load resource/.test(text)) { resourceErrorLines.push(text); return; }
  consoleErrors.push(text);
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

await page.goto(base, { waitUntil: 'domcontentloaded' }).catch((e) => {
  say(`# goto failed: ${e.message.split('\n')[0]}`);
});
await page.waitForTimeout(1500);

// Dismiss the begin overlay only if it is actually showing. Past the target
// the gate auto-unlocks on load (overlay hidden, data-locked absent), so there
// is nothing to click; a forced click on the zero-size button times out. Click
// only when the overlay is present and the button has real hit area.
const began = await page.evaluate(() => {
  const ov = document.getElementById('begin-overlay');
  const btn = document.getElementById('begin-button');
  const overlayShowing = !!ov && getComputedStyle(ov).display !== 'none' && !ov.hidden;
  const btnVisible = !!btn && !btn.hidden && btn.getBoundingClientRect().width > 0;
  return { overlayShowing, btnVisible };
});
if (began.overlayShowing && began.btnVisible) {
  try {
    await page.click('#begin-button', { timeout: 5000 });
    await page.waitForTimeout(1200);
    say('# begin overlay dismissed by tap');
  } catch (e) {
    say(`# begin click skipped: ${e.message.split('\n')[0]}`);
  }
} else {
  say(`# begin overlay already clear (overlayShowing=${began.overlayShowing}, btnVisible=${began.btnVisible}) — gate auto-unlocked past target`);
}

const finalePresent = await page.evaluate(() => !!document.getElementById('finale'));
assert(finalePresent === true, 'finale section restored in DOM past target');

// sections/finale.js is a lazy section: it only runs once the finale scrolls
// into view (IntersectionObserver), and until it runs the CSS keeps the sealed
// state (envelope + open button hidden). Scroll it in and wait for the
// js-finale opt-in class before touching the open button.
await page.evaluate(() => document.getElementById('finale')?.scrollIntoView());
try {
  await page.waitForFunction(
    () => document.documentElement.classList.contains('js-finale'),
    null,
    { timeout: 8000 },
  );
  say('# finale.js lazy-loaded and opted in (html.js-finale present)');
} catch {
  say('# js-finale class never appeared (non-fatal, state read below)');
}

if (mode === 'happy') {
  const sealed = await page.evaluate(() => ({
    jsFinale: document.documentElement.classList.contains('js-finale'),
    stageOpen: document.querySelector('[data-finale-stage]')?.classList.contains('is-open'),
    envelopeVisible: (() => {
      const el = document.querySelector('.finale__envelope');
      if (!el) return 'missing';
      return getComputedStyle(el).display;
    })(),
  }));
  say('# pre-open real state: ' + JSON.stringify(sealed));
  assert(sealed.jsFinale === true, 'finale.js opted in (html.js-finale present)');
  assert(sealed.stageOpen === false, 'stage starts sealed (is-open absent)');
  assert(sealed.envelopeVisible === 'block', 'envelope rendered pre-open', `display=${sealed.envelopeVisible}`);

  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelector('[data-finale-stage]')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(1500);
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-finale-open]');
    if (!btn) return 'missing';
    const r = btn.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(btn).display === 'none') return 'not-actionable';
    btn.click();
    return 'clicked';
  });
  say('# unseal click: ' + clicked);
  try {
    await page.waitForFunction(
      () => document.querySelector('[data-finale-stage]')?.classList.contains('is-open'),
      null,
      { timeout: 5000 },
    );
  } catch {
    say('# open transition did not settle (non-fatal, state read below)');
  }
  const opened = await page.evaluate(() => ({
    stageOpen: document.querySelector('[data-finale-stage]')?.classList.contains('is-open'),
    openBtnDisplay: getComputedStyle(document.querySelector('[data-finale-open]')).display,
    paraCount: document.querySelectorAll('.finale__letter .finale__para').length,
  }));
  say('# post-open real state: ' + JSON.stringify(opened));
  assert(opened.stageOpen === true, 'stage carries is-open after tap');
  assert(opened.openBtnDisplay === 'none', 'unseal button hides after opening');
  assert(opened.paraCount >= 7, 'letter paragraphs rendered', `paras=${opened.paraCount}`);

  await page.evaluate(() => document.getElementById('finale').scrollIntoView());
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(evidence, 'task-12-letter.png'), timeout: 15000 }).catch((e) => {
    say(`# letter screenshot failed (non-fatal): ${e.message.split('\n')[0]}`);
  });
  say('# screenshot -> .omo/evidence/halimah-birthday-site/task-12-letter.png');

  // Print-to-PDF render: emulate print media, screenshot the isolated letter.
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(600);
  const printState = await page.evaluate(() => {
    const letter = document.querySelector('[data-finale-letter]');
    const r = letter.getBoundingClientRect();
    const disp = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'absent'; };
    const keepsakesDisplay = disp('.finale__keepsakes');
    const slotDisplay = disp('.finale__slot');
    const envelopeDisplay = disp('.finale__envelope');
    return {
      letterTop: Math.round(r.top),
      letterHeight: Math.round(r.height),
      keepsakesDisplay,
      slotDisplay,
      envelopeDisplay,
      letterVisible: getComputedStyle(letter).visibility,
    };
  });
  say('# print-media real state: ' + JSON.stringify(printState));
  assert(printState.keepsakesDisplay === 'none', 'keepsake panel suppressed in print');
  assert(printState.slotDisplay === 'none' || printState.slotDisplay === 'absent', 'owner-slot marginalia suppressed in print');
  assert(printState.envelopeDisplay === 'none', 'envelope suppressed in print');
  assert(printState.letterVisible === 'visible', 'letter visible in print');
  await page.screenshot({ path: join(evidence, 'task-12-letter-print.png'), timeout: 15000, fullPage: false }).catch((e) => {
    say(`# print screenshot failed (non-fatal): ${e.message.split('\n')[0]}`);
  });
  say('# screenshot -> .omo/evidence/halimah-birthday-site/task-12-letter-print.png');
  await page.emulateMedia({ media: 'screen' });
} else {
  // No-JS failure path: letter must be fully in the DOM and visible.
  const nojs = await page.evaluate(() => {
    const paras = [...document.querySelectorAll('.finale__letter .finale__para, .finale__letter .finale__salutation, .finale__letter .finale__signoff')];
    const text = paras.map((p) => p.innerText).join('\n');
    const letterDisplay = getComputedStyle(document.querySelector('.finale__letter')).display;
    return {
      jsFinale: document.documentElement.classList.contains('js-finale'),
      paraCount: paras.length,
      letterDisplay,
      hasGreeting: text.includes('My Halimah'),
      hasJourney: text.includes("Throughout your journey,"),
      hasVow: text.includes('IN THE END YOU'),
      hasSignoff: text.includes('your Akash'),
      hasSlots: (document.body.innerText.match(/\[OWNER:/g) || []).length,
      textLen: text.length,
    };
  });
  say('# no-JS real state: ' + JSON.stringify(nojs));
  assert(nojs.jsFinale === false, 'no js-finale opt-in class without JS');
  assert(nojs.letterDisplay !== 'none', 'letter not hidden without JS', `display=${nojs.letterDisplay}`);
  assert(nojs.paraCount >= 7, 'all letter paragraphs in DOM without JS', `paras=${nojs.paraCount}`);
  assert(nojs.hasGreeting === true, 'greeting readable without JS');
  assert(nojs.hasJourney === true, 'reassurance line readable without JS');
  assert(nojs.hasVow === true, 'vow readable without JS');
  assert(nojs.hasSignoff === true, 'sign-off readable without JS');
  await page.evaluate(() => document.getElementById('finale').scrollIntoView());
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(evidence, 'task-12-nojs.png'), timeout: 15000 }).catch((e) => {
    say(`# nojs screenshot failed (non-fatal): ${e.message.split('\n')[0]}`);
  });
  say('# screenshot -> .omo/evidence/halimah-birthday-site/task-12-nojs.png');
}

// Reconcile the resource errors: every "Failed to load resource" line must be
// explained by a designed empty-photo 404. Any unexplained one is a real break.
const unexplained = resourceErrorLines.length - photoProbeUrls.size;
say(`# resource errors: ${resourceErrorLines.length} console line(s); photo-probe 404s seen: ${photoProbeUrls.size}/6; unexplained: ${unexplained}`);
assert(
  resourceErrorLines.length === photoProbeUrls.size && unexplained === 0,
  'every failed-resource 404 is a designed empty photo probe',
  `${resourceErrorLines.length} resource error line(s) vs ${photoProbeUrls.size} photo 404(s)`,
);
assert(consoleErrors.length === 0, 'no console errors during run', consoleErrors.join(' | '));
say(`# RESULT: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);

const { writeFile, mkdir } = await import('node:fs/promises');
await mkdir(evidence, { recursive: true });
await writeFile(join(evidence, mode === 'happy' ? 'task-12-happy.log' : 'task-12-nojs.log'), log.join('\n') + '\n');

await browser.close();
server.close();
say('# cleanup: browser closed, server closed, no processes left');
process.exit(failures === 0 ? 0 : 1);
