/* Task 10 manual QA.
   HAPPY  (Evidence task-10-scratch.png): 375px, real pointer scratching to
          past the threshold, screenshot of the revealed panel.
   FAILURE (Evidence task-10-source.log): view-source of the page shows no
          secret, in both the locked and the unlocked (worst-case) state. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ROOT = '/home/vibex/halimah-birthday';
const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site';
mkdirSync(OUT, { recursive: true });
const URL = `file://${ROOT}/index.html`;
const log = [];
const note = (m) => { log.push(m); console.log(m); };

const secret = (() => {
  const js = readFileSync(`${ROOT}/sections/scratch.js`, 'utf8');
  const m = js.match(/const SECRET_TEXT =([\s\S]*?);\s*\n\s*const SECRET_SOURCE/);
  return m[1]
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      let p = l.replace(/\s*\+\s*$/, '');
      if (p.startsWith("'") || p.startsWith('"')) p = p.slice(1);
      if (p.endsWith("'") || p.endsWith('"')) p = p.slice(0, -1);
      return p;
    })
    .join(' ').replace(/\s+/g, ' ').trim();
})();

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
  // ============ HAPPY PATH ============
  note('=== HAPPY PATH: 375px scratch to unlock ===');
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(fakeClock);
  await page.goto(URL, { waitUntil: 'load' });
  // scratch.js is lazy-loaded on first scroll into view (index.html
  // LAZY_SECTIONS), so bring the section into view before waiting for the
  // panel, otherwise the wait races a script that has not been fetched yet.
  await page.evaluate(() => document.getElementById('scratch')?.scrollIntoView());
  await page.waitForFunction(() => window.__scratchPanel?.ready === true, null, { timeout: 10000 });

  await page.locator('#scratch').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const pre = await page.evaluate(() => ({
    unlocked: window.__scratchPanel.unlocked,
    percent: window.__scratchPanel.percent,
    mode: window.__scratchPanel.mode,
  }));
  note(`before scratching: ${JSON.stringify(pre)}`);

  await page.screenshot({ path: `${OUT}/task-10-before.png` });
  note('screenshot: task-10-before.png (foil intact)');

  // Real thumb scratching: sweep rows until the threshold trips.
  const box = await page.locator('[data-scratch-cover]').boundingBox();
  const rowStep = box.height / 6;
  for (let row = 0; row < 6; row += 1) {
    const y = box.y + rowStep * (row + 0.5);
    await page.mouse.move(box.x + 6, y);
    await page.mouse.down();
    for (let x = box.x + 6; x <= box.x + box.width - 6; x += 14) {
      await page.mouse.move(x, y);
    }
    await page.mouse.up();
    const st = await page.evaluate(() => ({
      p: window.__scratchPanel.percent,
      u: window.__scratchPanel.unlocked,
    }));
    note(`  row ${row + 1}: percent=${st.p} unlocked=${st.u}`);
    if (st.u) break;
  }
  await page.waitForTimeout(500);

  const post = await page.evaluate(() => ({
    unlocked: window.__scratchPanel.unlocked,
    method: window.__scratchPanel.method,
    percent: window.__scratchPanel.percent,
    source: window.__scratchPanel.source,
    revealed: document.querySelector('[data-scratch-reveal-text]')?.textContent ?? '',
    replayVisible: document.querySelector('[data-scratch-replay]')?.classList.contains('is-visible'),
  }));
  note(`after scratching: ${JSON.stringify({ ...post, revealed: `${post.revealed.slice(0, 50)}...` })}`);
  note(`secret matches on-screen reveal: ${post.revealed === secret}`);

  // Frame the whole section for the evidence shot.
  await page.locator('.scratch__content').screenshot({ path: `${OUT}/task-10-scratch.png` });
  note('EVIDENCE: task-10-scratch.png (section, unlocked)');
  await page.screenshot({ path: `${OUT}/task-10-scratch-viewport.png` });
  note('screenshot: task-10-scratch-viewport.png (375px full viewport)');
  note(`page errors: ${errors.length === 0 ? 'none' : errors.join(' | ')}`);
  await page.close();

  // ============ FAILURE QA: view-source shows no secret ============
  note('');
  note('=== FAILURE QA: view-source contains no secret ===');

  // (a) raw bytes served as source, i.e. what view-source shows
  const rawHtml = readFileSync(`${ROOT}/index.html`, 'utf8');
  note(`[a] raw index.html bytes: secret present = ${rawHtml.includes(secret)}`);

  // (b) the browser's own rendered source in BOTH gate states
  for (const [label, clock] of [
    ['locked (pre-19 Oct, no clock override)', null],
    ['unlocked (20 Oct, worst case)', fakeClock],
  ]) {
    const p = await browser.newPage({ viewport: { width: 375, height: 812 } });
    if (clock) await p.addInitScript(clock);
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    const res = await p.evaluate((s) => {
      const src = new XMLSerializer().serializeToString(document.documentElement);
      return {
        gateUnlocked: window.__beginGate?.unlocked === true,
        chapters: document.querySelectorAll('#story [data-chapter]').length,
        secretInSerializedSource: src.includes(s),
        secretInBodyText: document.body.textContent.includes(s),
        secretInInnerHTML: document.body.innerHTML.includes(s),
      };
    }, secret);
    note(`[b] ${label}: gateUnlocked=${res.gateUnlocked} chapters=${res.chapters} ` +
      `secretInSource=${res.secretInSerializedSource} secretInBodyText=${res.secretInBodyText} ` +
      `secretInInnerHTML=${res.secretInInnerHTML}`);
    await p.close();
  }

  // (c) the secret is assembled at runtime from concatenated JS string parts in
  // scratch.js, so it is NOT a contiguous literal in any file. Prove the parts
  // are only in the JS and the assembled text is in no HTML.
  const jsSrc = readFileSync(`${ROOT}/sections/scratch.js`, 'utf8');
  const firstFragment = secret.split(' ').slice(0, 6).join(' ');
  note(`[c] contiguous secret literal in scratch.js (expected false, it is built from parts): ${jsSrc.includes(secret)}`);
  note(`[c] a secret fragment IS present in scratch.js (expected true): ${jsSrc.includes(firstFragment)}`);
  note(`[c] assembled secret present in index.html (expected false): ${rawHtml.includes(secret)}`);
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/task-10-source.log`, log.join('\n') + '\n');
console.log(`\nwrote ${OUT}/task-10-source.log`);
