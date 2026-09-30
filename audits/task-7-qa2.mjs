import { writeFileSync, mkdirSync } from 'node:fs';
import { globSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const pwMod = await (async () => {
  try {
    return await import('playwright');
  } catch {
    const hits = globSync('/home/vibex/.npm/_npx/*/node_modules/playwright/index.mjs');
    if (!hits.length) throw new Error('playwright not found in npx cache');
    return await import(pathToFileURL(hits[0]).href);
  }
})();
const chromium = pwMod.chromium ?? pwMod.default?.chromium;
if (!chromium) throw new Error('chromium export not found in playwright module');
const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site';
mkdirSync(OUT, { recursive: true });
const URL = 'file:///home/vibex/halimah-birthday/index.html';
const log = [];
const note = (m) => { log.push(m); console.log(m); };
const fakeDate = () => {
  const RealDate = Date;
  const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
  class FakeDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fakeNow])); }
    static now() { return fakeNow; }
  }
  globalThis.Date = FakeDate;
};
const browser = await chromium.launch({
  timeout: 45000,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const p = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(fakeDate);
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForTimeout(1000);
  const s = await p.evaluate(() => ({
    unlocked: window.__beginGate?.unlocked,
    chapters: document.querySelectorAll('#story [data-chapter]').length,
    gsap: typeof window.gsap !== 'undefined',
    triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
  }));
  note(`unlocked: ${JSON.stringify(s)}`);
  const box = await p.evaluate(() => {
    const el = document.getElementById('story');
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top + window.scrollY) };
  });
  await p.evaluate(({ top }) => window.scrollTo(0, top + 300), box);
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${OUT}/task-7-chapters.png` });
  note('shot task-7-chapters.png');
  const scrub = await p.evaluate(() => ({
    pins: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
    dots: document.querySelectorAll('.story__progress-item').length,
  }));
  note(`scrub: ${JSON.stringify(scrub)}`);
  note(`errors: ${errs.length ? errs.join(' | ') : 'none'}`);
  await p.close();

  const q = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  await q.addInitScript(fakeDate);
  await q.goto(URL, { waitUntil: 'load' });
  await q.waitForTimeout(800);
  const m = await q.evaluate(() => ({
    chapters: document.querySelectorAll('#story [data-chapter]').length,
    readable: [...document.querySelectorAll('#story [data-chapter]')].filter((c) => (c.textContent || '').length > 50).length,
    innerPos: [...new Set([...document.querySelectorAll('.story__chapter-inner')].map((e) => getComputedStyle(e).position))],
    progressDisplay: (() => { const el = document.querySelector('[data-story-progress]'); return el ? getComputedStyle(el).display : 'missing'; })(),
    triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
  }));
  note(`reduced-motion: ${JSON.stringify(m)}`);
  await q.evaluate(() => document.getElementById('chapter-1')?.scrollIntoView({ block: 'start' }));
  await q.waitForTimeout(600);
  await q.screenshot({ path: `${OUT}/task-7-motion.png` });
  await q.close();

  const r3 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await r3.route('**/vendor/gsap.min.js', (r) => r.abort());
  await r3.route('**/vendor/ScrollTrigger.min.js', (r) => r.abort());
  await r3.addInitScript(fakeDate);
  await r3.goto(URL, { waitUntil: 'load' });
  await r3.waitForTimeout(700);
  const n = await r3.evaluate(() => {
    const chs = [...document.querySelectorAll('#story [data-chapter]')];
    return { total: chs.length, readable: chs.filter((c) => (c.textContent || '').trim().length > 50).length };
  });
  note(`no-anim readable: ${JSON.stringify(n)}`);
  await r3.close();
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/task-7-motion.log`, log.join('\n') + '\n');
console.log('done');
