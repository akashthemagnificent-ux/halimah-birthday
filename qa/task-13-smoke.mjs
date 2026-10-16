// End-to-end file:// smoke QA for the media-rebuilt #world (todo 13).
// Real clock so IntersectionObserver + media playback run. Unlock via Begin;
// boot is polled with an evaluate loop (rAF polling starves under swiftshader).
// Covers: boot, zero new JS errors, media loaded, holo photo, carousel flow,
// song crossfade + BGM duck, end-of-clip fade, silence on leave, reveals,
// and a JS-disabled pass proving graceful static rendering.
import { chromium } from 'playwright-core';
const URL = 'file:///home/vibex/halimah-birthday/index.html';
const say = (s = '') => console.log(s);
let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  say(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' - ' + detail : ''}`);
}
const browser = await chromium.launch({
  timeout: 60000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=user-gesture-required'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const jsErrors = [];
  const failedRequests = [];
  page.on('pageerror', (e) => jsErrors.push('PAGEERROR ' + String(e)));
  page.on('requestfailed', (r) => {
    const u = r.url();
    const err = (r.failure() && r.failure().errorText) || '';
    // single-decoder swaps in #reel intentionally abort in-flight mp4 fetches
    if (/assets\/reel\/.*\.mp4$/.test(u) && err === 'net::ERR_ABORTED') return;
    failedRequests.push(u);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|CORS policy|net::ERR_FAILED/.test(t)) return; // tracked via requestfailed
    jsErrors.push('CONSOLE ' + t.slice(0, 140));
  });
  await page.goto(URL, { waitUntil: 'load' });
  try { await page.click('#begin-button', { noWaitAfter: true, timeout: 4000 }); } catch {}
  let booted = false;
  for (let i = 0; i < 180; i++) {
    booted = await page.evaluate(() => document.documentElement.classList.contains('js-world'));
    if (booted) break;
    await page.waitForTimeout(500);
  }
  check('boot (html.js-world)', booted);
  await page.evaluate(() => {
    if (window.ScrollTrigger) window.ScrollTrigger.getAll().forEach((t) => { try { t.kill(); } catch {} });
    document.documentElement.style.scrollBehavior = 'auto';
    // ScrollTrigger restores inline scroll-behavior:smooth on every refresh
    // (vendor/ScrollTrigger.min.js), which re-animates raw scrollTo under
    // swiftshader frame starvation; !important stylesheet wins over inline.
    const sb = document.createElement('style');
    sb.textContent = 'html { scroll-behavior: auto !important; }';
    document.head.appendChild(sb);
    const st = document.createElement('style');
    st.textContent = 'html.js-world .world__stage, html.js-world .world__singers, html.js-world .world__horror, html.js-world .world__closer-block { transition: none !important; }';
    document.head.appendChild(st);
  });
  await page.waitForTimeout(300);

  // ---- static inventory ----
  const inv = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => Array.from(document.querySelectorAll(s));
    const worldImgs = qa('#world img').filter((i) => (i.getAttribute('src') || '').includes('assets/world/'));
    return {
      worldImgs: worldImgs.length,
      imgsLoaded: worldImgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      holoImg: (() => { const i = q('.world__holo-photo'); return i ? i.naturalWidth : 0; })(),
      tilt: q('.world__holo') ? q('.world__holo').__tilt === true : false,
      songs: qa('.world__song[data-audio]').length,
      covers: qa('.world__song-cover').length,
      posters: qa('.world__ticket-poster').length,
      postersLoaded: qa('.world__ticket-poster').filter((i) => i.complete && i.naturalWidth > 0).length,
      scrambleChars: qa('[data-scramble] .world__char').length,
      flex: qa('[data-world-flex]').map((el) => ({ kind: el.getAttribute('data-world-flex'), mounted: !!el.__flexCarousel })),
      cells: qa('.magic-bento__content').length,
      glass: !!q('#world-liquid-glass'),
      thirdPerson: (q('#world').innerText.match(/\b(she|her|his)\b/gi) || []),
    };
  });
  check('62 media images referenced+loaded', inv.worldImgs >= 62 && inv.imgsLoaded === inv.worldImgs, `${inv.imgsLoaded}/${inv.worldImgs}`);
  check('holo photo rendered', inv.holoImg > 0, `nw=${inv.holoImg}`);
  check('holo pointer tilt bound', inv.tilt);
  check('11 songs with clips', inv.songs === 11, String(inv.songs));
  check('11 covers', inv.covers === 11, String(inv.covers));
  check('3 posters loaded', inv.posters === 3 && inv.postersLoaded === 3, `${inv.postersLoaded}/${inv.posters}`);
  check('scramble chars split', inv.scrambleChars > 20, String(inv.scrambleChars));
  check('4 carousels mounted', inv.flex.length === 4 && inv.flex.every((f) => f.mounted), inv.flex.map((f) => f.kind + ':' + f.mounted).join(','));
  check('bento rebuilt to 4 cells', inv.cells === 4, String(inv.cells));
  check('SVG glass filter present', inv.glass);
  check('no third person in section text (except allowed "him")', inv.thirdPerson.every((w) => w.toLowerCase() === 'him'), JSON.stringify(inv.thirdPerson));

  // ---- carousel flow (in view); poll because swiftshader rAF is ~2fps ----
  await page.evaluate(() => document.querySelector('.world__bento').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(800);
  const seen = await page.evaluate(() => Array.from(document.querySelectorAll('[data-world-flex]')).map((el) => el.querySelector('.world__flex-track').style.transform));
  const movedSet = new Set();
  let moved = 0;
  for (let t = 0; t < 15 && moved < 4; t++) {
    await page.waitForTimeout(600);
    const now = await page.evaluate(() => Array.from(document.querySelectorAll('[data-world-flex]')).map((el) => el.querySelector('.world__flex-track').style.transform));
    now.forEach((tr, i) => { if (tr !== seen[i]) movedSet.add(i); });
    moved = movedSet.size;
  }
  check('all 4 carousels flow while in view', moved === 4, `moved=${moved}`);

  // ---- reveal: bento neighbours ----
  const horrorIn = await page.evaluate(async () => {
    const el = document.querySelector('.world__horror');
    el.scrollIntoView({ block: 'center' });
    const t0 = performance.now();
    let prevT = t0, alive = 0;
    while (alive < 3000) {
      if (el.classList.contains('is-in')) return true;
      requestAnimationFrame(function () {}); // force a BeginFrame so IO can deliver headless
      await new Promise((r) => setTimeout(r, 60));
      const now = performance.now();
      const d = now - prevT; prevT = now;
      if (d < 1000) alive += d; // freeze-aware: main-thread stalls don't consume the poll budget
    }
    return el.classList.contains('is-in');
  });
  check('horror block reveal (.is-in)', horrorIn);

  // ---- song player: crossfade walk ----
  const goToSlot = (idx) => page.evaluate((i) => {
    const stack = document.querySelector('[data-world-stack]');
    const slots = stack.querySelectorAll('[data-stack-slot]');
    const el = slots[i];
    if (!el) return 'no slot';
    const r = el.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + r.top - (88 + 24 * i));
    return 'ok';
  }, idx);
  const songState = () => page.evaluate(() => ({
    dbg: window.__songDebug ? window.__songDebug() : null,
    playing: Array.from(document.querySelectorAll('.world__song')).map((x, i) => (x.classList.contains('is-playing') ? i : -1)).filter((i) => i >= 0),
    audio: Array.from(document.querySelectorAll('.world__song')).map((x) => {
      const a = x.__audio;
      return a ? { paused: a.paused, t: +a.currentTime.toFixed(2), v: +a.volume.toFixed(2) } : null;
    }),
    howl: window.Howler && typeof window.Howler.volume === 'function' ? +window.Howler.volume().toFixed(2) : -1,
  }));

  // start from above the stack so slot geometry pins progressively
  await page.evaluate(() => { const el = document.querySelector('[data-world-stack]'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 600); });
  await page.waitForTimeout(700);

  await goToSlot(1);
  await page.waitForTimeout(1800);
  let s1 = await songState();
  check('slot1 -> exactly one active card', s1.playing.length === 1, JSON.stringify(s1.playing));
  check('slot1 geo matches active card', s1.dbg && s1.dbg.geo === s1.playing[0], `geo=${s1.dbg && s1.dbg.geo}`);
  let a1 = s1.audio[s1.playing[0]];
  for (let t = 0; t < 10 && !(a1 && !a1.paused && a1.t > 0); t++) {
    await page.waitForTimeout(500);
    s1 = await songState();
    a1 = s1.audio[s1.playing[0]];
  }
  check('slot1 clip playing', !!a1 && !a1.paused && a1.t > 0, JSON.stringify(a1));
  let howlDucked = s1.howl;
  for (let t = 0; t < 12 && !(howlDucked >= 0 && howlDucked < 0.5); t++) {
    await page.waitForTimeout(500);
    howlDucked = (await songState()).howl;
  }
  check('BGM ducked during songs', howlDucked >= 0 && howlDucked < 0.5, `howl=${howlDucked}`);

  await goToSlot(4);
  await page.waitForTimeout(2200);
  let s4 = await songState();
  check('slot4 -> exactly one active card', s4.playing.length === 1, JSON.stringify(s4.playing));
  check('crossfade switched the card', s4.playing[0] !== s1.playing[0], `was=${s1.playing[0]} now=${s4.playing[0]}`);
  const prevIdx = s1.playing[0];
  check('previous clip faded out (paused)', prevIdx != null && !!s1.audio[prevIdx], 'audio object present');
  const prevPaused = prevIdx == null ? null : await page.evaluate((i) => { const card = document.querySelectorAll('.world__song')[i]; const a = card && card.__audio; return a ? a.paused : null; }, prevIdx);
  check('previous clip paused after crossfade', prevPaused === true, String(prevPaused));
  const a4 = s4.playing[0] != null ? s4.audio[s4.playing[0]] : null;
  check('slot4 clip playing', !!a4 && !a4.paused && a4.t > 0, JSON.stringify(a4));

  // ---- end-of-clip fade ----
  const endFade = await page.evaluate(async () => {
    const card = document.querySelector('.world__song.is-playing');
    const el = card && card.__audio;
    if (!el || !isFinite(el.duration)) return { err: 'no audio' };
    el.currentTime = Math.max(0, el.duration - 1.4);
    // poll until the fade starts (volume drops) or playback ends
    let sawDrop = false;
    const t0 = performance.now();
    while (performance.now() - t0 < 3500) {
      if (el.paused || el.volume < 0.98) { sawDrop = el.paused || el.volume < 0.98; break; }
      await new Promise((r) => setTimeout(r, 120));
    }
    const mid = +el.volume.toFixed(2);
    const t1 = performance.now();
    while (!el.paused && performance.now() - t1 < 4000) await new Promise((r) => setTimeout(r, 120));
    return { sawDrop, mid, endPaused: el.paused, endVol: +el.volume.toFixed(2) };
  });
  check('end fade engages near clip end', !endFade.err && endFade.sawDrop, JSON.stringify(endFade));
  check('clip faded out and paused at end', endFade.endPaused === true && endFade.endVol < 0.1, JSON.stringify(endFade));

  // ---- leave: silence + BGM restored ----
  await page.evaluate(() => document.querySelector('.world__closer-block').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(2600);
  let away = await songState();
  check('no card active after leaving songs', away.playing.length === 0, JSON.stringify(away.playing));
  for (let t = 0; t < 12 && !(away.howl > 0.9); t++) {
    await page.waitForTimeout(500);
    away = await songState();
  }
  check('BGM restored after leaving', away.howl > 0.9, `howl=${away.howl}`);
  const closerIn = await page.evaluate(() => document.querySelector('.world__closer-block').classList.contains('is-in'));
  check('closer reveal (.is-in)', closerIn);
  const stageIn = await page.evaluate(async () => {
    const el = document.querySelector('.world__stage');
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
    const t0 = performance.now();
    let prevT = t0, alive = 0;
    while (alive < 3000) {
      if (el.classList.contains('is-in')) return true;
      requestAnimationFrame(function () {}); // force a BeginFrame so IO can deliver headless
      await new Promise((r) => setTimeout(r, 60));
      const now = performance.now();
      const d = now - prevT; prevT = now;
      if (d < 1000) alive += d; // freeze-aware: main-thread stalls don't consume the poll budget
    }
    return el.classList.contains('is-in');
  });
  check('stage reveal (.is-in)', stageIn);

  // ---- errors ----
  check('0 new JS errors', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | ').slice(0, 200));
  const badRes = [...new Set(failedRequests)].filter((u) => !/assets\/baby/.test(u));
  check('0 new resource errors (pre-existing baby assets excluded)', badRes.length === 0, badRes.slice(0, 3).join(' | ').slice(0, 160));

  // ---- JS-disabled graceful render ----
  // Free the main page's memory (audio elements, carousels) before opening a
  // second context; on low-RAM hosts a second live page gets the browser
  // OOM-killed mid-locator (TargetClosedError), not a site defect.
  await page.close().catch(() => {});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const np = await ctx.newPage();
  await np.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const noJs = {
    stageVisible: await np.locator('#world .world__stage').isVisible(),
    songVisible: await np.locator('#world .world__song').first().isVisible(),
    holoSrc: await np.locator('#world .world__holo-photo[src="assets/world/rin/frame.jpg"]').count(),
    posterCount: await np.locator('#world .world__ticket-poster').count(),
    flexCount: await np.locator('#world [data-world-flex]').count(),
  };
  check('no-JS: stage visible', noJs.stageVisible);
  check('no-JS: song card visible', noJs.songVisible);
  check('no-JS: holo photo present', noJs.holoSrc === 1, String(noJs.holoSrc));
  check('no-JS: posters present', noJs.posterCount === 3, String(noJs.posterCount));
  check('no-JS: carousel rows present', noJs.flexCount === 4, String(noJs.flexCount));
  await ctx.close();
} catch (e) {
  say('FATAL ' + (e.stack || e));
  failures += 1;
} finally {
  await browser.close();
}
say('========================================');
say(failures === 0 ? 'SMOKE: ALL CHECKS PASSED' : `SMOKE: ${failures} CHECK(S) FAILED`);
say('========================================');
process.exit(failures === 0 ? 0 : 1);
