import { globSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const pwMod = await (async () => {
  const hits = globSync('/home/vibex/.npm/_npx/*/node_modules/playwright/index.mjs');
  if (!hits.length) throw new Error('playwright not found in npx cache');
  return await import(pathToFileURL(hits[0]).href);
})();
const chromium = pwMod.chromium ?? pwMod.default?.chromium;
const browser = await chromium.launch({
  timeout: 45000,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
console.log('launched');
const p = await browser.newPage({ viewport: { width: 375, height: 812 } });
await p.addInitScript(() => {
  const RealDate = Date;
  const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
  class FakeDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fakeNow])); }
    static now() { return fakeNow; }
  }
  globalThis.Date = FakeDate;
});
await p.goto('file:///home/vibex/halimah-birthday/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
await p.waitForTimeout(1500);
const s = await p.evaluate(() => ({
  unlocked: window.__beginGate?.unlocked,
  chapters: document.querySelectorAll('#story [data-chapter]').length,
  gsap: typeof window.gsap !== 'undefined',
  triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
}));
console.log(JSON.stringify(s));
await browser.close();
console.log('closed clean');
