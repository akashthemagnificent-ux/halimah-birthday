/* Task 10 QA: scratch-off panel interaction + 3D camera card.
   Covers, on file:// and http://localhost (self-served):
     - entrance pre-hide + pop-in (anim hidden -> popping -> idle)
     - pointer tilt with relax-to-neutral
     - scratch works, RESUMES after release/pause (the reported bug)
     - progress survives viewport resizes (mobile URL bar)
     - full sweep to unlock at the 97% threshold: display reads 100%,
       foil dissolves (is-done), reveal + replay appear
     - replay re-arms and re-pops; panel is scratchable again
     - mobile 390x844 leg: resume + unlock
   Fails loudly (non-zero exit) on any violation. */
import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const ROOT = '/home/vibex/halimah-birthday';
const HTTP_PORT = 9034;
const FILE_URL = 'file://' + ROOT + '/index.html';

const pwBase = (process.env.HOME || '') + '/.cache/ms-playwright';
const rev = readdirSync(pwBase).filter((d) => d.startsWith('chromium-')).pop();
const exe = [`${pwBase}/${rev}/chrome-linux64/chrome`, `${pwBase}/${rev}/chrome-linux/chrome`]
  .find((p) => existsSync(p));

let failures = 0;
function check(label, ok, detail = '') {
  const pass = Boolean(ok);
  if (!pass) failures += 1;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${label}${detail ? ' :: ' + detail : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function settleCard(page) {
  await page.waitForFunction(() => window.__scratchPanel?.anim === 'idle', null, { timeout: 9000 });
  await page.waitForTimeout(250);
}

async function boxOf(page) {
  return page.locator('[data-scratch-cover]').boundingBox();
}

async function dragRow(page, box, yFrac, step = 8) {
  const y = box.y + box.height * yFrac;
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  for (let x = box.x + 4; x <= box.x + box.width - 4; x += step) {
    await page.mouse.move(x, y);
  }
  await page.mouse.up();
}

async function sweepUntilUnlock(page, box, maxRows = 16) {
  const rows = 14;
  const rowStep = box.height / rows;
  for (let row = 0; row < maxRows; row += 1) {
    if (await page.evaluate(() => window.__scratchPanel.unlocked)) return;
    const y = box.y + rowStep * ((row % rows) + 0.5);
    await page.mouse.move(box.x + 4, y);
    await page.mouse.down();
    for (let x = box.x + 4; x <= box.x + box.width - 4; x += 10) {
      await page.mouse.move(x, y);
    }
    await page.mouse.up();
    await page.waitForTimeout(40);
  }
}

async function desktopLeg(browser, url, tag) {
  console.log(`\n--- ${tag} desktop leg ---`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.getElementById('begin-button')?.click());
  await page.waitForFunction(() => window.__scratchPanel?.ready === true, null, { timeout: 8000 });

  const pre = await page.evaluate(() => ({
    anim: window.__scratchPanel.anim,
    gsap: typeof window.gsap,
    mode: window.__scratchPanel.mode,
    threshold: window.__scratchPanel.threshold,
  }));
  check(`${tag}: panel ready, gsap present, mode scratch`, pre.gsap !== 'undefined' && pre.mode === 'scratch', `gsap=${pre.gsap} mode=${pre.mode}`);
  check(`${tag}: threshold is 97 (scratch to (nearly) 100%)`, pre.threshold === 97, String(pre.threshold));
  check(`${tag}: card pre-hidden before scroll (pop will run)`, pre.anim === 'hidden', pre.anim);

  await page.locator('[data-scratch-cover]').scrollIntoViewIfNeeded();
  const t0 = Date.now();
  await settleCard(page);
  check(`${tag}: pop-in ran and settled (hidden -> idle)`, Date.now() - t0 > 150, `${Date.now() - t0}ms`);
  const styleAfter = await page.evaluate(() => document.querySelector('[data-scratch-card]').getAttribute('style') || '');
  check(`${tag}: entrance cleared its inline transform when done`, !/transform/.test(styleAfter), styleAfter.slice(0, 60));

  // tilt: hover upper-right of card, transform must pick up rotateY
  let box = await boxOf(page);
  await page.mouse.move(box.x + box.width * 0.92, box.y + box.height * 0.2);
  const tilted = await page.waitForFunction(() => {
    const m = /rotateY\(([-\d.]+)deg\)/.exec(document.querySelector('[data-scratch-card]').style.transform || '');
    return m ? Math.abs(parseFloat(m[1])) > 2 : false;
  }, null, { timeout: 5000 }).then(() => true).catch(() => false);
  check(`${tag}: card tilts toward the pointer`, tilted);
  // relax: move outside the section
  await page.mouse.move(10, 10);
  const relaxed = await page.waitForFunction(() => {
    const t = document.querySelector('[data-scratch-card]').style.transform || '';
    const m = /rotateY\(([-\d.]+)deg\)/.exec(t);
    return !m || Math.abs(parseFloat(m[1])) < 0.5;
  }, null, { timeout: 12000 }).then(() => true).catch(() => false);
  check(`${tag}: tilt relaxes to neutral when the pointer leaves`, relaxed);

  // scratch: two strokes with a pause between (resume is the core fix)
  box = await boxOf(page);
  await dragRow(page, box, 0.18);
  await page.waitForTimeout(400);
  const s1 = await page.evaluate(() => ({ p: window.__scratchPanel.percent, u: window.__scratchPanel.unlocked }));
  check(`${tag}: first stroke erases`, s1.p > 0 && !s1.u, `percent=${s1.p}`);
  await sleep(600); // release + idle pause, exactly the reported bug scenario
  await dragRow(page, box, 0.5);
  await page.waitForTimeout(400);
  const s2 = await page.evaluate(() => ({ p: window.__scratchPanel.percent, u: window.__scratchPanel.unlocked }));
  check(`${tag}: scratching RESUMES after release (percent grows)`, s2.p > s1.p && !s2.u, `${s1.p} -> ${s2.p}`);

  // resize must not wipe progress
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.waitForTimeout(500);
  const s3 = await page.evaluate(() => window.__scratchPanel.percent);
  check(`${tag}: progress survives a viewport resize`, s3 === s2.p, `${s2.p} -> ${s3}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // full sweep -> unlock
  box = await boxOf(page);
  await sweepUntilUnlock(page, box);
  const done = await page.evaluate(() => ({
    u: window.__scratchPanel.unlocked,
    m: window.__scratchPanel.method,
    p: window.__scratchPanel.percent,
    display: document.querySelector('.scratch__percent')?.textContent,
    isDone: document.querySelector('[data-scratch-cover]').classList.contains('is-done'),
    reveal: document.querySelector('[data-scratch-reveal]').classList.contains('is-visible'),
    revealLen: (document.querySelector('[data-scratch-reveal-text]')?.textContent || '').length,
    hintHidden: document.querySelector('[data-scratch-hint]')?.hidden,
    replay: document.querySelector('[data-scratch-replay]').classList.contains('is-visible'),
    dataset: document.getElementById('scratch').dataset.scratchPercent,
  }));
  check(`${tag}: full sweep unlocks via scratch`, done.u && done.m === 'scratch', `method=${done.m}`);
  check(`${tag}: reads a full 100% clear`, done.p === 100 && done.display === '100% cleared' && done.dataset === '100', `${done.p} "${done.display}"`);
  check(`${tag}: foil dissolves (is-done) and reveal+replay appear`, done.isDone && done.reveal && done.replay && done.hintHidden, JSON.stringify({ isDone: done.isDone, reveal: done.reveal, replay: done.replay }));
  check(`${tag}: secret written into reveal by JS (length only, not logged)`, done.revealLen > 150, `${done.revealLen} chars`);
  await settleCard(page); // flourish must settle back to idle
  check(`${tag}: unlock flourish settles to idle`, (await page.evaluate(() => window.__scratchPanel.anim)) === 'idle');

  // replay re-arms and re-pops
  const rp = await page.evaluate(() => {
    document.querySelector('[data-scratch-replay]').click();
    return {
      anim: window.__scratchPanel.anim,
      u: window.__scratchPanel.unlocked,
      p: window.__scratchPanel.percent,
      reveal: document.querySelector('[data-scratch-reveal]').classList.contains('is-visible'),
      leak: document.body.textContent.toLowerCase().includes('worth living'),
      display: document.querySelector('.scratch__percent').textContent,
    };
  });
  check(`${tag}: replay re-arms panel and starts a fresh pop`, rp.anim === 'popping' && !rp.u && rp.p === 0 && !rp.reveal, `anim=${rp.anim} p=${rp.p}`);
  check(`${tag}: replay purges the secret from the DOM`, rp.leak === false, `leak=${rp.leak}`);
  check(`${tag}: replay clears the 100% display`, rp.display === '', `"${rp.display}"`);
  await settleCard(page);

  // and the fresh card is scratchable again
  box = await boxOf(page);
  await dragRow(page, box, 0.3);
  await page.waitForTimeout(400);
  const again = await page.evaluate(() => window.__scratchPanel.percent);
  check(`${tag}: panel scratchable again after replay`, again > 0, `percent=${again}`);

  check(`${tag}: zero page errors`, errors.length === 0, errors.join(' | '));
  await page.close();
}

async function mobileLeg(browser, url) {
  console.log('\n--- mobile 390x844 leg ---');
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.getElementById('begin-button')?.click());
  await page.waitForFunction(() => window.__scratchPanel?.ready === true, null, { timeout: 8000 });
  check('mobile: card pre-hidden before scroll', (await page.evaluate(() => window.__scratchPanel.anim)) === 'hidden');
  await page.locator('[data-scratch-cover]').scrollIntoViewIfNeeded();
  await settleCard(page);
  const box = await boxOf(page);
  check('mobile: card fits the viewport', box && box.y >= 0 && box.y + box.height <= 844 && box.width >= 250,
    box ? `${Math.round(box.width)}x${Math.round(box.height)} at y=${Math.round(box.y)}` : 'no box');
  await dragRow(page, box, 0.2, 7);
  await page.waitForTimeout(400);
  const m1 = await page.evaluate(() => window.__scratchPanel.percent);
  await sleep(500);
  await dragRow(page, box, 0.55, 7);
  await page.waitForTimeout(400);
  const m2 = await page.evaluate(() => ({ p: window.__scratchPanel.percent, u: window.__scratchPanel.unlocked }));
  check('mobile: resume works after release', m2.p > m1 && !m2.u, `${m1} -> ${m2.p}`);
  await sweepUntilUnlock(page, box);
  const mu = await page.evaluate(() => ({
    u: window.__scratchPanel.unlocked,
    p: window.__scratchPanel.percent,
    display: document.querySelector('.scratch__percent')?.textContent,
  }));
  check('mobile: full sweep unlocks and reads 100%', mu.u && mu.p === 100 && mu.display === '100% cleared', JSON.stringify(mu));
  check('mobile: zero page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function main() {
  const server = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1', '--directory', ROOT],
    { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 20 && !up; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${HTTP_PORT}/index.html`);
      up = res.ok;
    } catch { await sleep(250); }
  }
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    if (!up) throw new Error('http server did not come up on ' + HTTP_PORT);
    await desktopLeg(browser, FILE_URL, 'file://');
    await desktopLeg(browser, `http://127.0.0.1:${HTTP_PORT}/index.html?preview=1`, 'http');
    await mobileLeg(browser, `http://127.0.0.1:${HTTP_PORT}/index.html?preview=1`);
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
  console.log('\n========================================');
  console.log(failures === 0 ? 'RESULT: ALL CHECKS PASSED' : `RESULT: ${failures} CHECK(S) FAILED`);
  console.log('========================================');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
