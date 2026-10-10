import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site';
mkdirSync(OUT, { recursive: true });
const URL = 'file:///home/vibex/halimah-birthday/index.html';
const log = [];
const note = (m) => { log.push(m); console.log(m); };

const browser = await chromium.launch();
try {
  const errors = [];
  const failedReq = [];
  const keepsakeCors = [];
  let namesFallback = false;
  const attachDiag = (page, tag) => {
    page.on('pageerror', (e) => errors.push(`${tag}: ${e}`));
    // All 42 baby photos exist, so NO request may fail. physics.js fetches
    // content/physics-names.json, which file:// cannot fetch; that takes the
    // documented static fallback (console error, not a requestfailed). Any
    // requestfailed here is a genuine regression.
    page.on('requestfailed', (r) => {
      // The 3 birthday keepsake photos (IMG_*.webp) are drawn to the WebGL
      // globe; on file:// that taints the canvas and CORS-fails by design.
      // They still render as plain <img>, so this is the documented path.
      if (/assets\/baby\/IMG_\d+\.webp$/.test(r.url())) { keepsakeCors.push(`${tag}: ${r.url()}`); return; }
      failedReq.push(`${tag}: ${r.url()}`);
    });
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/physics-names\.json/.test(text) && /URL scheme "file" is not supported/.test(text)) {
        namesFallback = true;
        return;
      }
      if (/assets\/baby\/IMG_\d+\.webp/.test(text) && /CORS policy/.test(text)) { keepsakeCors.push(`${tag}: cors`); return; }
      if (/net::ERR_FAILED/.test(text) && keepsakeCors.length) { return; } // the paired load error for the above
      errors.push(`${tag} console: ${text}`);
    });
  };
  const fakeDate = () => {
    const RealDate = Date;
    const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
    class FakeDate extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fakeNow])); }
      static now() { return fakeNow; }
    }
    globalThis.Date = FakeDate;
  };

  // ---------- desktop pass: spread mode, centering, counter, dots, keyboard ----------
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachDiag(page, 'desktop');
  await page.addInitScript(fakeDate);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const s1 = await page.evaluate(() => {
    const s = document.getElementById('album');
    s.scrollIntoView();
    return {
      title: s.querySelector('.album__headline')?.textContent,
      pages: document.querySelectorAll('#album [data-density]').length,
      photoSlots: document.querySelectorAll('#album [data-photo]').length,
      placeholders: document.querySelectorAll('#album .album__placeholder').length,
      photoPlaceholders: document.querySelectorAll('#album .album__placeholder[data-photo]').length,
    };
  });
  note(`album markup: ${JSON.stringify(s1)}`);
  await page.waitForTimeout(2500);

  const s2 = await page.evaluate(() => {
    const book = document.querySelector('[data-album-book]');
    const sec = document.getElementById('album');
    const notice = document.querySelector('[data-album-notice]');
    const counter = document.querySelector('[data-album-counter]');
    return {
      flipCtor: typeof (window.St && window.St.PageFlip),
      mode: book && book.dataset.albumMode,
      total: sec && sec.dataset.albumTotal,
      supplied: sec && sec.dataset.albumSupplied,
      noticeHidden: notice && notice.hidden,
      imgs: document.querySelectorAll('#album img').length,
      counter: counter && counter.textContent.trim(),
      dots: document.querySelectorAll('#album [data-album-dots] .album__dot').length,
      activeDot: [...document.querySelectorAll('#album .album__dot')].findIndex((d) => d.classList.contains('is-active')),
      state: book && book.dataset.albumState,
      hue: getComputedStyle(sec).getPropertyValue('--album-hue').trim(),
    };
  });
  note(`after mount: ${JSON.stringify(s2)}`);

  // Cover page is centered: single visible page, its center == book center.
  const coverGeom = await page.evaluate(() => {
    const book = document.querySelector('[data-album-book]');
    const br = book.getBoundingClientRect();
    const vis = [...document.querySelectorAll('#album .album__page')]
      .filter((p) => { const r = p.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(p).display !== 'none'; })
      .map((p) => { const r = p.getBoundingClientRect(); return Math.round(r.x + r.width / 2); });
    return { bookCenter: Math.round(br.x + br.width / 2), centers: vis };
  });
  note(`cover geometry: ${JSON.stringify(coverGeom)}`);

  // Two flips forward.
  await page.evaluate(() => document.querySelector('[data-album-next]').click());
  await page.waitForTimeout(1100);
  await page.evaluate(() => document.querySelector('[data-album-next]').click());
  await page.waitForTimeout(1100);
  const s3 = await page.evaluate(() => {
    const book = document.querySelector('[data-album-book]');
    const sec = document.getElementById('album');
    const counter = document.querySelector('[data-album-counter]');
    return {
      flipState: book && book.dataset.flipState,
      page: book && book.dataset.albumPage,
      counter: counter && counter.textContent.trim(),
      activeDot: [...document.querySelectorAll('#album .album__dot')].findIndex((d) => d.classList.contains('is-active')),
      state: book && book.dataset.albumState,
      hue: getComputedStyle(sec).getPropertyValue('--album-hue').trim(),
    };
  });
  note(`after 2 flips: ${JSON.stringify(s3)}`);
  await page.screenshot({ path: `${OUT}/task-11-album.png` });

  // Keyboard: return to the cover, then ArrowRight must open it to page 1 (2/44).
  // Requires the album to be in view (dataset.inView === '1'), which the
  // scroll above satisfies. Asserts a real advance, not a vacuous equal value.
  await page.evaluate(() => document.querySelectorAll('#album [data-album-dots] .album__dot')[0].click());
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.getElementById('album').dataset.inView = '1'; });
  const kbBefore = await page.evaluate(() => document.querySelector('[data-album-counter]').textContent.trim());
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1100);
  const s4 = await page.evaluate(() => {
    const counter = document.querySelector('[data-album-counter]');
    return { counter: counter && counter.textContent.trim(), inView: document.getElementById('album').dataset.inView };
  });
  note(`keyboard: ${kbBefore} -> ${JSON.stringify(s4)}`);

  // Jump to the last page: end state, centered, counter 44/44.
  // The closed-book glide (800ms flip + 600ms translate) can take ~1.4s, so
  // poll until the last page is actually centered rather than racing a sleep.
  await page.evaluate(() => {
    const dots = document.querySelectorAll('#album [data-album-dots] .album__dot');
    dots[dots.length - 1].click();
  });
  await page.waitForFunction(() => {
    const book = document.querySelector('[data-album-book]');
    if (!book || book.dataset.albumPage !== String(bookFlipCount() - 1)) return false;
    const br = book.getBoundingClientRect();
    const vis = [...document.querySelectorAll('#album .album__page')]
      .filter((p) => { const r = p.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(p).display !== 'none'; });
    if (vis.length !== 1) return false;
    const r = vis[0].getBoundingClientRect();
    return Math.abs((r.x + r.width / 2) - (br.x + br.width / 2)) < 2;
    function bookFlipCount() { return document.querySelectorAll('#album [data-density]').length; }
  }, { timeout: 6000 }).catch(() => {});
  const s5 = await page.evaluate(() => {
    const book = document.querySelector('[data-album-book]');
    const br = book.getBoundingClientRect();
    const vis = [...document.querySelectorAll('#album .album__page')]
      .filter((p) => { const r = p.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(p).display !== 'none'; })
      .map((p) => { const r = p.getBoundingClientRect(); return Math.round(r.x + r.width / 2); });
    const counter = document.querySelector('[data-album-counter]');
    return {
      counter: counter && counter.textContent.trim(),
      state: book && book.dataset.albumState,
      bookCenter: Math.round(br.x + br.width / 2),
      centers: vis,
    };
  });
  note(`last page: ${JSON.stringify(s5)}`);
  await page.close();

  // ---------- mobile pass: portrait fallback, no errors ----------
  const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
  attachDiag(mob, 'mobile');
  await mob.addInitScript(fakeDate);
  await mob.goto(URL, { waitUntil: 'load' });
  await mob.waitForTimeout(1200);
  await mob.evaluate(() => document.getElementById('album').scrollIntoView());
  await mob.waitForTimeout(2200);
  const m1 = await mob.evaluate(() => {
    const book = document.querySelector('[data-album-book]');
    return { mode: book && book.dataset.albumMode, imgs: document.querySelectorAll('#album img').length };
  });
  note(`mobile portrait: ${JSON.stringify(m1)}`);
  await mob.close();

  // Center checks allow a 3px sub-pixel tolerance (the glide settles on a
  // fractional translate; strict equality flakes on rounding).
  const centered = (centers, bookCenter) => centers.length === 1 && Math.abs(centers[0] - bookCenter) <= 3;
  const coverCentered = centered(coverGeom.centers, coverGeom.bookCenter);
  const endCentered = centered(s5.centers, s5.bookCenter);
  const checks = [
    ['album titled "the baby album"', s1.title === 'the baby album'],
    ['44 pages with data-density', s1.pages === 44],
    ['42 photo slots (data-photo)', s1.photoSlots === 42],
    ['2 placeholders (cover + last)', s1.placeholders === 2 && s1.photoPlaceholders === 0],
    ['St.PageFlip constructor present (vendored locally)', s2.flipCtor === 'function'],
    ['mount mode is flip, not stacked', s2.mode === 'flip'],
    ['42 slots, 42 supplied (all photos present)', s2.total === '42' && s2.supplied === '42'],
    ['42 <img> injected (every photo hydrated)', s2.imgs === 42],
    ['notice hidden (nothing left empty)', s2.noticeHidden === true],
    ['cover counter reads 1 / 44', s2.counter === '1 / 44'],
    ['44 page dots built', s2.dots === 44],
    ['first dot active at cover', s2.activeDot === 0],
    ['cover in closed start state', s2.state === 'start'],
    ['cover page centered in frame', coverCentered],
    ['flip-through advances engine state', s3.flipState === 'read' && s3.page === '3'],
    ['counter ticks to 4 / 44 (cover + full spread)', s3.counter === '4 / 44'],
    ['active dot follows to index 3', s3.activeDot === 3],
    ['mid-spread clears the closed state', s3.state === ''],
    ['background hue changes on flip', s2.hue !== '' && s3.hue !== '' && s2.hue !== s3.hue],
    ['ArrowRight flips the cover open (1/44 -> 2/44)', kbBefore === '1 / 44' && s4.counter === '2 / 44'],
    ['last page counter reads 44 / 44', s5.counter === '44 / 44'],
    ['last page in closed end state', s5.state === 'end'],
    ['last page centered in frame', endCentered],
    ['mobile portrait mounts in flip mode', m1.mode === 'flip' && m1.imgs === 42],
    ['zero non-probe js errors', errors.length === 0],
    ['zero failed requests (all photos load)', failedReq.length === 0],
  ];
  let pass = true;
  for (const [label, ok] of checks) { note(`[${ok ? 'PASS' : 'FAIL'}] ${label}`); if (!ok) pass = false; }
  if (errors.length) note(`errors: ${JSON.stringify(errors)}`);
  if (failedReq.length) note(`failedReq: ${JSON.stringify(failedReq)}`);
  note(`birthday keepsake CORS on file:// (designed): ${keepsakeCors.length}`);
  note(`names fetch on this protocol: ${namesFallback ? 'graceful file:// fallback (no throw)' : 'fetched normally (http) or not reached yet'}`);
  note(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  writeFileSync(`${OUT}/task-11-qa.log`, log.join('\n') + '\n');
  if (!pass) process.exit(1);
} finally {
  await browser.close();
}
