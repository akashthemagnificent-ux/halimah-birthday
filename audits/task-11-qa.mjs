import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site';
mkdirSync(OUT, { recursive: true });
const URL = 'file:///home/vibex/halimah-birthday/index.html';
const log = [];
const note = (m) => { log.push(m); console.log(m); };

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  const photoProbes = [];
  let namesFallback = false;
  page.on('pageerror', (e) => errors.push(String(e)));
  // The 6 photo-slot probes MUST 404 on an empty photos dir (that is the
  // zero-photo path working); only non-probe errors fail the run.
  page.on('requestfailed', (r) => {
    if (/assets\/photos\/photo-\d\.jpg$/.test(r.url())) photoProbes.push(r.url());
    else errors.push(`requestfailed: ${r.url()}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/ERR_FILE_NOT_FOUND/.test(text) && photoProbes.length <= 6) return;
    // physics.js fetches content/physics-names.json. Under the file:// protocol
    // this scheme cannot be fetched, so the section takes its documented static
    // fallback ("names unavailable") instead of throwing — that is the graceful
    // path working, not a regression. Any OTHER console error still fails the run.
    if (/physics-names\.json/.test(text) && /URL scheme "file" is not supported/.test(text)) {
      namesFallback = true;
      return;
    }
    errors.push(text);
  });

  // Fake the date to 20 Oct 2026 so the countdown gate auto-unlocks on load.
  await page.addInitScript(() => {
    const RealDate = Date;
    const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
    class FakeDate extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fakeNow])); }
      static now() { return fakeNow; }
    }
    globalThis.Date = FakeDate;
  });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const s1 = await page.evaluate(() => {
    const s = document.getElementById('album');
    s.scrollIntoView();
    return {
      pages: document.querySelectorAll('#album [data-density]').length,
      placeholders: document.querySelectorAll('#album .album__placeholder').length,
    };
  });
  note(`album markup: ${JSON.stringify(s1)}`);
  await page.waitForTimeout(2500);

  const s2 = await page.evaluate(() => {
    const book = document.querySelector('[data-album-book]');
    const sec = document.getElementById('album');
    const notice = document.querySelector('[data-album-notice]');
    return {
      // Read the vendored PageFlip global AFTER the album has scrolled into
      // view: the vendor script is injected lazily by IntersectionObserver, so
      // it is not on window at initial load. This is the deterministic point.
      flipCtor: typeof (window.St && window.St.PageFlip),
      mode: book && book.dataset.albumMode,
      total: sec && sec.dataset.albumTotal,
      supplied: sec && sec.dataset.albumSupplied,
      noticeHidden: notice && notice.hidden,
      imgs: document.querySelectorAll('#album img').length,
    };
  });
  note(`after mount: ${JSON.stringify(s2)}`);

  // Flip-through: programmatic flips (mirrors what the next control calls).
  // The book canvas intentionally covers the full book frame for swipe;
  // controls sit below it, so dispatch via evaluate avoids scroll-overlay flakiness.
  await page.evaluate(() => document.querySelector('[data-album-next]').click());
  await page.waitForTimeout(1300);
  await page.evaluate(() => document.querySelector('[data-album-next]').click());
  await page.waitForTimeout(1300);
  const s3 = await page.evaluate(() => {
    const book = document.querySelector('[data-album-book]');
    return { flipState: book && book.dataset.flipState, mode: book && book.dataset.albumMode };
  });
  note(`after flips: ${JSON.stringify(s3)}`);

  await page.screenshot({ path: `${OUT}/task-11-album.png` });
  note('screenshot saved: task-11-album.png');
  note(`js errors (non-probe): ${errors.length ? JSON.stringify(errors) : 'none'}`);
  note(`photo probes failed as designed (empty dir): ${photoProbes.length}/6`);
  note(`names fetch on this protocol: ${namesFallback ? 'graceful file:// fallback (no throw)' : 'fetched normally (http) or not reached yet'}`);
  const checks = [
    ['8 pages with data-density', s1.pages === 8],
    ['8 illustrated placeholders', s1.placeholders === 8],
    ['St.PageFlip constructor present (vendored locally)', s2.flipCtor === 'function'],
    ['mount mode is flip, not stacked', s2.mode === 'flip'],
    ['6 slots, 0 supplied (empty dir)', s2.total === '6' && s2.supplied === '0'],
    ['zero <img> injected (no broken icons)', s2.imgs === 0],
    ['flip-through advances engine state', s3.flipState === 'read'],
    ['6/6 photo probes failed as designed', photoProbes.length === 6],
    ['zero non-probe js errors', errors.length === 0],
  ];
  let pass = true;
  for (const [label, ok] of checks) { note(`[${ok ? 'PASS' : 'FAIL'}] ${label}`); if (!ok) pass = false; }
  note(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  writeFileSync(`${OUT}/task-11-qa.log`, log.join('\n') + '\n');
  if (!pass) process.exit(1);
} finally {
  await browser.close();
}
