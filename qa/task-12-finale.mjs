// Task-12b browser QA: finale Awwwards rebuild — galaxy, masked heading,
// scramble lede, envelope tilt, reveals, unseal, print, no-JS fallback.
//
// Conventions copied from qa/task-12-qa.mjs: serve the static dir over
// HTTP from disk, log a sha256 build hash first (stale-state guard), read
// only real page state, close everything before exit (cleanup receipt).
// Usage: node qa/task-12-finale.mjs [happy|nojs]  (default happy)
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
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
};

const log = [];
const say = (s = '') => { log.push(s); console.log(s); };
let failures = 0;
const assert = (cond, label, detail = '') => {
  if (!cond) failures += 1;
  say(`[${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ' \u2014 ' + detail : ''}`);
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (p === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  const file = join(root, normalize(p).replace(/^(\.\.[\/\\])+/, ''));
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
  viewport: { width: 1440, height: 900 },
  javaScriptEnabled: mode !== 'nojs',
});
await ctx.addInitScript(clockScript);
const page = await ctx.newPage();
const consoleErrors = [];
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

await page.goto(base, { waitUntil: 'commit', timeout: 120000 }).catch((e) => {
  say(`# goto failed: ${e.message.split('\n')[0]}`);
});
try { await page.waitForLoadState('domcontentloaded', { timeout: 120000 }); }
catch (e) { say('# domcontentloaded wait timed out (non-fatal, state read below)'); }
await page.waitForTimeout(1500);

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
  say(`# begin overlay already clear (overlayShowing=${began.overlayShowing}, btnVisible=${began.btnVisible})`);
}

const finalePresent = await page.evaluate(() => !!document.getElementById('finale'));
assert(finalePresent === true, 'finale section restored in DOM past target');

await page.evaluate(() => document.getElementById('finale')?.scrollIntoView({ block: 'start' }));
try {
  await page.waitForFunction(
    () => document.documentElement.classList.contains('js-finale'),
    null,
    { timeout: 8000 },
  );
  say('# finale.js booted (html.js-finale present)');
} catch {
  say('# js-finale class never appeared (non-fatal, state read below)');
}
await page.waitForTimeout(9000);

if (mode === 'happy') {
  const fx = await page.evaluate(() => {
    const gal = document.querySelector('.finale__galaxy .galaxy-canvas');
    const masked = document.querySelector('[data-finale-heading] .masked-heading');
    const fb = document.querySelector('[data-finale-heading] .finale__headline');
    const chars = document.querySelectorAll('.finale__lede .world__char').length;
    const wb = gal ? gal.getBoundingClientRect() : null;
    return {
      jsFinale: document.documentElement.classList.contains('js-finale'),
      galaxyCanvas: !!gal,
      galaxyBox: wb ? { w: Math.round(wb.width), h: Math.round(wb.height) } : null,
      maskedHeading: !!masked,
      staticFallback: !!fb,
      scrambleChars: chars,
      gsap: typeof window.gsap !== 'undefined',
    };
  });
  say('# fx real state: ' + JSON.stringify(fx));
  assert(fx.jsFinale === true, 'finale.js opted in (html.js-finale present)');
  assert(fx.galaxyCanvas === true, 'galaxy canvas mounted in finale backdrop');
  assert(fx.galaxyBox && fx.galaxyBox.w > 100 && fx.galaxyBox.h > 100, 'galaxy canvas has real size', JSON.stringify(fx.galaxyBox));
  // Draw-path proof: the vendor only allocates the backing store + calls
  // draw()/kick() after a live WebGL2 context; the no-GL stub leaves the
  // default 300x150. (drawImage readback is void without preserveDrawingBuffer.)
  const store = await page.evaluate(() => {
    const c = document.querySelector('.finale__galaxy .galaxy-canvas');
    return c ? { w: c.width, h: c.height } : null;
  });
  say('# galaxy backing store: ' + JSON.stringify(store));
  assert(store && store.w > 300 && store.h > 300, 'galaxy draw path alive (backing store allocated)', JSON.stringify(store));
  assert(fx.staticFallback === true || fx.maskedHeading === true, 'headline readable (masked upgrade or static fallback)');
  if (fx.gsap) {
    assert(fx.maskedHeading === true, 'masked heading upgraded (gsap present)');
  } else {
    say('# gsap missing: static h2 fallback accepted');
  }
  assert(fx.scrambleChars > 5, 'scramble lede split into chars', `chars=${fx.scrambleChars}`);

  const rev = await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    const out = {};
    for (const s of ['.finale__eyebrow', '.finale__heading', '.finale__lede', '.finale__keepsakes']) {
      const el = document.querySelector(s);
      if (!el) { out[s] = 'missing'; continue; }
      el.scrollIntoView({ block: 'center' });
      const t0 = performance.now();
      while (!el.classList.contains('is-in') && performance.now() - t0 < 10000) {
        await new Promise((r) => setTimeout(r, 150));
      }
      out[s] = el.classList.contains('is-in');
    }
    return out;
  });
  say('# reveals: ' + JSON.stringify(rev));
  for (const [s, v] of Object.entries(rev)) assert(v === true, `reveal fired: ${s}`);

  const tilt = await page.evaluate(() => {
    const el = document.querySelector('.finale__envelope');
    if (!el) return { ok: false, reason: 'no envelope' };
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, clientX: r.left + r.width * 0.8, clientY: r.top + r.height * 0.2,
    }));
    const t = el.style.transform || '';
    el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    const cleared = (el.style.transform || '') === '';
    return { ok: /perspective/.test(t), transform: t.slice(0, 80), cleared };
  });
  say('# tilt: ' + JSON.stringify(tilt));
  assert(tilt.ok === true, 'envelope tilts on pointermove', tilt.transform);
  assert(tilt.cleared === true, 'envelope transform clears on leave');

  const sealed = await page.evaluate(() => ({
    stageOpen: document.querySelector('[data-finale-stage]')?.classList.contains('is-open'),
    envelopeDisplay: (() => {
      const el = document.querySelector('.finale__envelope');
      return el ? getComputedStyle(el).display : 'missing';
    })(),
  }));
  assert(sealed.stageOpen === false, 'stage starts sealed (is-open absent)');
  assert(sealed.envelopeDisplay === 'block', 'envelope rendered pre-open', `display=${sealed.envelopeDisplay}`);

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
  assert(clicked === 'clicked', 'unseal button actionable and clicked', clicked);
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
  say('# post-open: ' + JSON.stringify(opened));
  assert(opened.stageOpen === true, 'stage carries is-open after tap');
  assert(opened.openBtnDisplay === 'none', 'unseal button hides after opening');
  assert(opened.paraCount >= 7, 'letter paragraphs rendered', `paras=${opened.paraCount}`);
  // letter redesign: staged paper reveal + signature wipe must resolve
  const paper = await page.evaluate(async () => {
    const sal = document.querySelector('.finale__salutation');
    const names = document.querySelector('.finale__sign-names');
    const vow = document.querySelector('.finale__vow');
    const t0 = performance.now();
    while (performance.now() - t0 < 9000) {
      const so = sal ? parseFloat(getComputedStyle(sal).opacity) : -1;
      const nc = names ? getComputedStyle(names).clipPath : 'none';
      if (so > 0.9 && (!nc || nc === 'none' || !/100%/.test(nc))) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    return {
      salutationOpacity: sal ? parseFloat(getComputedStyle(sal).opacity) : -1,
      namesClip: names ? getComputedStyle(names).clipPath : 'missing',
      vowVisible: vow ? parseFloat(getComputedStyle(vow).opacity) : -1,
      paperBg: document.querySelector('.finale__letter') ? getComputedStyle(document.querySelector('.finale__letter')).backgroundImage.includes('linear-gradient') : false
    };
  });
  say('# paper letter: ' + JSON.stringify(paper));
  assert(paper.salutationOpacity > 0.9, 'salutation reveal resolves', `opacity=${paper.salutationOpacity}`);
  assert(paper.vowVisible > 0.9, 'vow pull-quote reveal resolves', `opacity=${paper.vowVisible}`);
  assert(paper.namesClip !== 'missing' && !/100%/.test(paper.namesClip), 'signature wipe completes', paper.namesClip);
  assert(paper.paperBg === true, 'letter carries paper gradient');

  await page.evaluate(() => document.getElementById('finale').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(evidence, 'task-12b-finale.png'), timeout: 60000 }).catch((e) => {
    say(`# finale screenshot failed (non-fatal): ${e.message.split('\n')[0]}`);
  });
  say('# screenshot -> .omo/evidence/halimah-birthday-site/task-12b-finale.png');

  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(600);
  const printState = await page.evaluate(() => {
    const letter = document.querySelector('[data-finale-letter]');
    const disp = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'absent'; };
    return {
      keepsakesDisplay: disp('.finale__keepsakes'),
      slotDisplay: disp('.finale__slot'),
      envelopeDisplay: disp('.finale__envelope'),
      galaxyDisplay: disp('.finale__galaxy'),
      letterVisible: getComputedStyle(letter).visibility,
    };
  });
  say('# print-media: ' + JSON.stringify(printState));
  assert(printState.keepsakesDisplay === 'none', 'keepsake panel suppressed in print');
  assert(printState.slotDisplay === 'none' || printState.slotDisplay === 'absent', 'owner-slot marginalia suppressed in print', printState.slotDisplay);
  assert(printState.envelopeDisplay === 'none', 'envelope suppressed in print');
  assert(printState.galaxyDisplay === 'none', 'galaxy suppressed in print');
  assert(printState.letterVisible === 'visible', 'letter visible in print');
  await page.emulateMedia({ media: 'screen' });
} else {
  const nojs = await page.evaluate(() => {
    const paras = [...document.querySelectorAll('.finale__letter .finale__para, .finale__letter .finale__salutation, .finale__letter .finale__signoff')];
    const text = paras.map((p) => p.innerText).join('\n');
    return {
      jsFinale: document.documentElement.classList.contains('js-finale'),
      paraCount: paras.length,
      letterDisplay: getComputedStyle(document.querySelector('.finale__letter')).display,
      hasGreeting: text.includes('My Halimah'),
      hasJourney: text.includes('Throughout your journey,'),
      hasVow: text.includes('IN THE END YOU'),
      hasSignoff: text.includes('your Akash'),
      hasSlots: (document.body.innerText.match(/\[OWNER:/g) || []).length,
      headlineText: (document.querySelector('[data-finale-heading]')?.innerText || '').trim(),
      ledeText: (document.querySelector('.finale__lede')?.innerText || '').trim(),
    };
  });
  say('# no-JS: ' + JSON.stringify(nojs));
  assert(nojs.jsFinale === false, 'no js-finale opt-in class without JS');
  assert(nojs.letterDisplay !== 'none', 'letter not hidden without JS', `display=${nojs.letterDisplay}`);
  assert(nojs.paraCount >= 7, 'all letter paragraphs in DOM without JS', `paras=${nojs.paraCount}`);
  assert(nojs.hasGreeting === true, 'greeting readable without JS');
  assert(nojs.hasJourney === true, 'reassurance line readable without JS');
  assert(nojs.hasVow === true, 'vow readable without JS');
  assert(nojs.hasSignoff === true, 'sign-off readable without JS');
  assert(nojs.headlineText.includes('one last thing, zai'), 'static headline readable without JS');
  assert(nojs.ledeText.includes('unseal it slowly'), 'static lede readable without JS');
  await page.evaluate(() => document.getElementById('finale').scrollIntoView());
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(evidence, 'task-12b-nojs.png'), timeout: 60000 }).catch((e) => {
    say(`# nojs screenshot failed (non-fatal): ${e.message.split('\n')[0]}`);
  });
  say('# screenshot -> .omo/evidence/halimah-birthday-site/task-12b-nojs.png');
}

const unexplained = resourceErrorLines.length - photoProbeUrls.size;
say(`# resource errors: ${resourceErrorLines.length} console line(s); photo-probe 404s seen: ${photoProbeUrls.size}/6; unexplained: ${unexplained}`);
assert(
  resourceErrorLines.length === photoProbeUrls.size && unexplained === 0,
  'every resource error explained by a designed empty-photo 404',
);
assert(consoleErrors.length === 0, 'zero console/page errors', consoleErrors.slice(0, 3).join(' | ').slice(0, 300));

await browser.close();
await new Promise((resolve) => server.close(resolve));
say(failures === 0 ? 'SMOKE: ALL CHECKS PASSED' : `SMOKE: ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
