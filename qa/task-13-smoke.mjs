// End-to-end file:// smoke QA for the rebuilt #world (todo 13).
// Real clock so IntersectionObserver + CSS transitions run. Unlock via Begin;
// poll boot generously (swiftshader rAF can starve the countdown unlock).
// Kill ScrollTriggers (world has 0) + instant scroll; scroll each reveal target
// into view, wait for IO to add is-in, then wait for the transition to finish.
import { chromium } from 'playwright-core';
const URL = 'file:///home/vibex/halimah-birthday/index.html';
const say = (s = '') => console.log(s);
const browser = await chromium.launch({
  timeout: 60000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=user-gesture-required'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const jsErrors = [];
  const resourceErrors = [];
  page.on('pageerror', (e) => jsErrors.push('PAGEERROR ' + String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|CORS policy|net::ERR_FAILED/.test(t)) resourceErrors.push(t.slice(0, 80));
    else jsErrors.push('CONSOLE ' + t);
  });
  await page.goto(URL, { waitUntil: 'load' });
  const btn = await page.$('#begin-button');
  if (btn) { try { await page.click('#begin-button', { noWaitAfter: true, timeout: 4000 }); } catch {} }
  let booted = true;
  try { await page.waitForFunction(() => document.documentElement.classList.contains('js-world'), null, { timeout: 60000 }); }
  catch { booted = false; }
  say('booted (html.js-world): ' + booted);
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (window.ScrollTrigger) window.ScrollTrigger.getAll().forEach((t) => { try { t.kill(); } catch {} }); document.documentElement.style.scrollBehavior = 'auto'; });
  const reveal = await page.evaluate(async () => {
    const out = {};
    for (const sel of ['.world__stage', '.world__singers', '.world__horror', '.world__closer-block']) {
      const el = document.querySelector('#world ' + sel);
      if (!el) { out[sel] = 'missing'; continue; }
      el.scrollIntoView({ block: 'center' });
      const t0 = performance.now();
      let inClass = false;
      while (performance.now() - t0 < 3000) { if (el.classList.contains('is-in')) { inClass = true; break; } await new Promise((r) => setTimeout(r, 60)); }
      // Headless swiftshader never advances compositor opacity transitions, so
      // disable the transition and confirm the .is-in rule resolves to opacity 1.
      el.style.transition = 'none';
      void el.offsetHeight;
      const rect = el.getBoundingClientRect();
      out[sel] = { isin: inClass, op: Math.round(parseFloat(getComputedStyle(el).opacity)*100)/100, inView: rect.top < window.innerHeight && rect.bottom > 0 };
    }
    return out;
  });
  say('REVEAL ' + JSON.stringify(reveal));
  const probe = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const gcs = (el) => (el ? getComputedStyle(el) : null);
    const silk = q('.silk-canvas');
    const mh = q('.masked-heading');
    const holo = q('.holo-card');
    return {
      silk: silk ? { w: silk.clientWidth, h: silk.clientHeight } : null,
      mhFs: mh ? gcs(mh).fontSize : null,
      holo: holo ? { w: holo.clientWidth, name: !!q('.world__holo-name') } : null,
      slots: document.querySelectorAll('#world .scroll-stack__slot').length,
      stackCards: document.querySelectorAll('#world .scroll-stack-card').length,
      songs: document.querySelectorAll('#world .world__song').length,
      bentoCells: document.querySelectorAll('#world .magic-bento__cell').length,
      bentoCards: document.querySelectorAll('#world .magic-bento__card').length,
      glitch: document.querySelectorAll('#world .glitch').length,
      tickets: document.querySelectorAll('#world .world__ticket').length,
      heart: !!q('#world .pulse-heart'),
      scrollW: document.documentElement.scrollWidth, winW: window.innerWidth,
    };
  });
  say('PROBE ' + JSON.stringify(probe));
  const revOk = Object.values(reveal).every((v) => v !== 'missing' && v.isin && v.op > 0.5);
  const overflow = probe.scrollW > probe.winW + 2;
  const ok = booted
    && probe.silk && probe.silk.w > 100 && probe.silk.h > 100
    && probe.mhFs && parseFloat(probe.mhFs) > 24
    && probe.holo && probe.holo.w > 80 && probe.holo.name
    && probe.slots === 11 && probe.stackCards === 11 && probe.songs === 11
    && probe.bentoCells === 8 && probe.bentoCards === 8
    && probe.glitch === 3 && probe.tickets === 3
    && probe.heart && revOk && !overflow;
  say('overflow: ' + overflow + ' (scrollW=' + probe.scrollW + ' winW=' + probe.winW + ')');
  say('excluded resource errors (' + resourceErrors.length + '): pre-existing album file:// CORS, not world');
  say('JS errors (' + jsErrors.length + '): ' + (jsErrors.length ? JSON.stringify(jsErrors.slice(0, 6)) : 'none'));
  say(ok && jsErrors.length === 0 ? 'RESULT: SMOKE PASS' : 'RESULT: SMOKE FAIL');
  if (!ok || jsErrors.length > 0) process.exitCode = 1;
} finally { await browser.close(); }
say('done');
