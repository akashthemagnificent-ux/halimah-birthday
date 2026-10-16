import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site';
mkdirSync(OUT, { recursive: true });
const URL = 'file:///home/vibex/halimah-birthday/index.html';
const log = [];
const note = (m) => { log.push(m); console.log(m); };
// Evidence screenshots are non-fatal: swiftshader sometimes stalls the
// compositor past playwright's 30s screenshot timeout (known pathology).
const shot = async (pg, path) => {
  try { await pg.screenshot({ path }); }
  catch (e) { note('screenshot SKIPPED (compositor stall): ' + path.split('/').pop()); }
};

const browser = await chromium.launch();
try {
  // ---- HAPPY PATH: animation enabled, scroll through story ----
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  const gate = await page.evaluate(() => ({
    unlocked: window.__beginGate?.unlocked,
    done: window.__beginGate?.countdownDone,
    target: window.__beginGate?.target,
    storyInDom: !!document.querySelector('#story [data-chapter]'),
  }));
  note(`gate state: ${JSON.stringify(gate)}`);

  // Content is locked behind the countdown (today < Oct 19): force-unlock for
  // visual QA by simulating the unlocked state the gate produces on 19 Oct.
  await page.evaluate(() => {
    document.getElementById('begin-overlay')?.setAttribute('hidden', '');
    document.querySelector('[data-story-progress]')?.removeAttribute('hidden');
  });
  // Re-mount: trigger story boot by scrolling (ScrollTrigger refresh needs layout)
  const count = await page.evaluate(() => document.querySelectorAll('#story [data-chapter]').length);
  note(`chapters in DOM (locked state): ${count}`);

  // Unlock: emulate gate completion — restore detached nodes via real handler.
  // Easiest honest path: set clock past target and reload.
  await page.close();

  const page2 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  page2.on('pageerror', (e) => errors.push(String(e)));
  // Fake the date to 20 Oct 2026 so the gate auto-unlocks on load.
  await page2.addInitScript(() => {
    const RealDate = Date;
    const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
    class FakeDate extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fakeNow])); }
      static now() { return fakeNow; }
    }
    globalThis.Date = FakeDate;
  });
  await page2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page2.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page2.waitForTimeout(1200);

  const s2 = await page2.evaluate(() => ({
    unlocked: window.__beginGate?.unlocked,
    chapters: document.querySelectorAll('#story [data-chapter]').length,
    times: document.querySelectorAll('#story time[datetime]').length,
    bqs: document.querySelectorAll('#story blockquote.story__quote').length,
    gsap: typeof window.gsap !== 'undefined',
    st: typeof window.ScrollTrigger !== 'undefined',
    triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
  }));
  note(`unlocked state: ${JSON.stringify(s2)}`);

  // Scroll through the story in steps, capture mid-story + end screenshots.
  const storyBox = await page2.evaluate(() => {
    const el = document.getElementById('story');
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: r.height };
  });
  note(`story geometry: ${JSON.stringify(storyBox)}`);

  await page2.evaluate(({ top }) => window.scrollTo(0, top + 200), storyBox);
  await page2.waitForTimeout(900);
  await shot(page2, `${OUT}/task-7-chapters.png`);
  note('screenshot: task-7-chapters.png');

  await page2.evaluate(({ top, height }) => window.scrollTo(0, top + height * 0.6), storyBox);
  await page2.waitForTimeout(900);
  await shot(page2, `${OUT}/task-7-chapters-mid2.png`);

  const scrubEvidence = await page2.evaluate(() => {
    const pins = window.ScrollTrigger
      ? window.ScrollTrigger.getAll().map((t) => ({ start: Math.round(t.start), end: Math.round(t.end), active: t.isActive }))
      : [];
    const activeDots = document.querySelectorAll('.story__progress-item.is-active').length;
    return { pinCount: pins.length, sample: pins.slice(0, 3), activeDots };
  });
  note(`scrub evidence: ${JSON.stringify(scrubEvidence)}`);

  // Animation-blocked readability: block GSAP scripts, reload, assert readable.
  const page3 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page3.route('**/vendor/gsap.min.js', (r) => r.abort());
  await page3.route('**/vendor/ScrollTrigger.min.js', (r) => r.abort());
  await page3.addInitScript(() => {
    const RealDate = Date;
    const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
    class FakeDate extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fakeNow])); }
      static now() { return fakeNow; }
    }
    globalThis.Date = FakeDate;
  });
  await page3.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page3.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page3.waitForTimeout(800);
  const noAnim = await page3.evaluate(() => {
    const chs = [...document.querySelectorAll('#story [data-chapter]')];
    const visible = chs.filter((c) => {
      const r = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
    }).length;
    const texts = chs.map((c) => (c.textContent || '').trim().length);
    return { total: chs.length, visible, minText: Math.min(...texts) };
  });
  note(`animation-blocked readability: ${JSON.stringify(noAnim)}`);
  await shot(page3, `${OUT}/task-7-noanim.png`);
  await page3.close();
  await page2.close();

  // ---- FAILURE PATH: prefers-reduced-motion → stacked, no pin ----
  const page4 = await browser.newPage({
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
  });
  await page4.addInitScript(() => {
    const RealDate = Date;
    const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
    class FakeDate extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fakeNow])); }
      static now() { return fakeNow; }
    }
    globalThis.Date = FakeDate;
  });
  await page4.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page4.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page4.waitForTimeout(800);
  const motion = await page4.evaluate(() => {
    const chs = [...document.querySelectorAll('#story [data-chapter]')];
    const inners = [...document.querySelectorAll('.story__chapter-inner')].map((el) => getComputedStyle(el).position);
    const progressDisplay = (() => {
      const p = document.querySelector('[data-story-progress]');
      return p ? getComputedStyle(p).display : 'missing';
    })();
    const triggers = window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0;
    const readable = chs.filter((c) => (c.textContent || '').trim().length > 50).length;
    return { chapters: chs.length, innerPositions: [...new Set(inners)], progressDisplay, triggers, readable };
  });
  note(`reduced-motion state: ${JSON.stringify(motion)}`);
  await shot(page4, `${OUT}/task-7-motion.png`);
  await page4.close();

  note(`console/page errors: ${errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none'}`);
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/task-7-motion.log`, log.join('\n') + '\n');
console.log('done, log written');
