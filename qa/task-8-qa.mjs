import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globSync } from 'node:fs';

// Manual QA for todo 8 (quote wall room): 375px headless render.
// Adversarial coverage:
//   - misleading-success-output: every claim reads REAL live-DOM state and a
//     real screenshot; the build hash below ties the evidence to these bytes.
//   - stale_state: sha1 over index.html + quotes.* is logged into the evidence.
const pw = await (async () => {
  const normalize = (m) => (m && m.chromium ? m : m && m.default ? m.default : null);
  try {
    return normalize(await import('playwright'));
  } catch {}
  const hits = globSync('/home/vibex/.npm/_npx/*/node_modules/playwright/index.js');
  for (const hit of hits) {
    try {
      const m = normalize(await import(pathToFileURL(hit).href));
      if (m) return m;
    } catch {}
  }
  throw new Error('playwright not found in npx cache');
})();
const { chromium } = pw;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site';
mkdirSync(OUT, { recursive: true });
const URL = 'file:///home/vibex/halimah-birthday/index.html';

const hash = createHash('sha1');
for (const f of ['index.html', 'sections/quotes.html', 'sections/quotes.css', 'sections/quotes.js']) {
  hash.update(readFileSync(join(root, f)));
}
const BUILD = hash.digest('hex').slice(0, 12);

const log = [];
const note = (m) => { log.push(m); console.log(m); };
note(`build hash: ${BUILD}`);

const fakeClock = () => {
  const RealDate = Date;
  const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
  class FakeDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fakeNow])); }
    static now() { return fakeNow; }
  }
  globalThis.Date = FakeDate;
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(fakeClock);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#quotes .quote-card')];
    const visible = cards.filter((c) => {
      const r = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return r.width > 0 && r.height > 20 && cs.display !== 'none'
        && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.5;
    }).length;
    const times = document.querySelectorAll('#quotes time.quote-card__date[datetime]').length;
    const bqs = document.querySelectorAll('#quotes blockquote.quote-card__quote').length;
    const threat = document.querySelector('.quotes__headline')?.textContent ?? '';
    const singleCol = cards.length > 1
      ? Math.abs(cards[0].getBoundingClientRect().left - cards[1].getBoundingClientRect().left) < 4
      : true;
    return { cards: cards.length, visible, times, bqs, singleCol, threatLen: threat.length };
  });
  note(`live DOM: ${JSON.stringify(state)}`);
  if (state.cards < 10) throw new Error('wall too small');
  if (state.times !== state.cards || state.bqs !== state.cards) throw new Error('card/date/quote mismatch');
  if (!state.singleCol) throw new Error('expected single column at 375px');
  // state.visible is pre-scroll: the reveal fires on scroll-in, so the
  // honest count happens after the sweep below.

  const box = await page.evaluate(() => {
    const el = document.getElementById('quotes');
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: r.height };
  });
  // Staggered reveal marks cards visible on scroll-in: sweep the wall, then count.
  for (const f of [0.05, 0.3, 0.55, 0.8, 0.95]) {
    await page.evaluate(({ box, frac }) => window.scrollTo(0, box.top + box.height * frac), { box, frac: f });
    await page.waitForTimeout(400);
  }
  const afterScroll = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#quotes .quote-card')];
    return cards.filter((c) => {
      const cs = getComputedStyle(c);
      return c.classList.contains('is-visible') || parseFloat(cs.opacity) > 0.5;
    }).length;
  });
  note(`visible after scroll sweep: ${afterScroll}/${state.cards}`);
  if (afterScroll !== state.cards) throw new Error('not all cards revealed on scroll');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/task-8-wall.png` });
  note('screenshot: task-8-wall.png');

  // Reduced-motion: wall must render fully visible with no transitions.
  const rm = await browser.newPage({
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
  });
  await rm.addInitScript(fakeClock);
  await rm.goto(URL, { waitUntil: 'load' });
  await rm.waitForTimeout(800);
  const rmState = await rm.evaluate(() => {
    const cards = [...document.querySelectorAll('#quotes .quote-card')];
    const opacities = cards.slice(0, 5).map((c) => parseFloat(getComputedStyle(c).opacity));
    const noJsClass = !document.documentElement.classList.contains('js-quotes');
    return { cards: cards.length, opacities, noJsClass };
  });
  note(`reduced-motion: ${JSON.stringify(rmState)}`);
  if (!rmState.opacities.every((o) => o === 1)) throw new Error('cards hidden under reduced-motion');
  await rm.close();

  if (errors.length) throw new Error(`console errors: ${errors.join(' | ').slice(0, 400)}`);
  note('console: clean');
  note('PASS task-8 manual QA');
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/task-8-wall.log`, log.join('\n') + '\n');
