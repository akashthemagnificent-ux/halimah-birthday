/* Task 10 acceptance: scratch-off secret panel.
   Two parts, both required to pass:
     1. Static source checks — the secret must not be in any HTML file, and
        the panel must be wired (markup, script, CSS, threshold, replay,
        reduced-motion path).
     2. Runtime checks in a real browser — the secret must be absent from the
        INITIAL DOM dump, and clearing the cover past the threshold must fire
        the unlock.

   The secret deliberately does NOT equal the plan's original default
   (dms-11.txt:2281). That line is already printed verbatim as story
   chapter 13, so it can never satisfy "absent from the DOM" once the site
   unlocks on 19 Oct. This script asserts against the ACTUAL secret that
   ships, read out of scratch.js, so it cannot drift or falsely pass.

   Fails loudly (non-zero exit) on any violation. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/vibex/halimah-birthday';
const INDEX = path.join(ROOT, 'index.html');
const JS = path.join(ROOT, 'sections/scratch.js');
const CSS = path.join(ROOT, 'sections/scratch.css');
const SRC = '/mnt/c/Users/COMPUTER WORLD/Downloads/halimah dms/halimah dms-6.txt';
const STORY_PLAN_DEFAULT = 'REASON I WAKE UP WITH A SMILE';

const index = fs.readFileSync(INDEX, 'utf8');
const js = fs.readFileSync(JS, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');

// Recover the real shipped secret from the concatenated string literal in
// scratch.js, so the runtime assertions test what actually ships.
const secretMatch = js.match(/const SECRET_TEXT =([\s\S]*?);\s*\n\s*const SECRET_SOURCE/);
if (!secretMatch) {
  console.error('[FATAL] could not locate SECRET_TEXT in scratch.js');
  process.exit(1);
}
const SECRET = secretMatch[1]
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    let part = line.replace(/\s*\+\s*$/, '');
    if (part.startsWith("'") || part.startsWith('"')) part = part.slice(1);
    if (part.endsWith("'") || part.endsWith('"')) part = part.slice(0, -1);
    return part;
  })
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim();

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('========================================');
console.log('TASK 10 ACCEPTANCE — scratch-off secret panel');
console.log('========================================');
console.log(`recovered secret (${SECRET.length} chars): "${SECRET.slice(0, 60)}..."`);
console.log('');

console.log('--- secret is verbatim from its cited source ---');
const srcLines = fs.readFileSync(SRC, 'utf8').split('\n');
const srcLine = srcLines[951];
const normalizedSrc = srcLine.replace(/\s+/g, ' ').trim();
check('secret matches dms-6.txt:952 verbatim',
  normalizedSrc.includes(SECRET),
  SECRET.length > 0 ? 'substring of source line 952' : 'empty secret');
check('scratch.js cites its source line',
  /const SECRET_SOURCE = 'halimah dms-6\.txt:952'/.test(js));

console.log('\n--- secret must NOT appear in any HTML file ---');
const htmlFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'vendor' || entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
})(ROOT);
const leaks = htmlFiles.filter((f) => fs.readFileSync(f, 'utf8').includes(SECRET));
check(`secret absent from all ${htmlFiles.length} HTML files`, leaks.length === 0,
  leaks.length ? leaks.map((l) => path.relative(ROOT, l)).join(', ') : `${htmlFiles.length} files scanned`);

console.log('\n--- secret must not equal the already-printed plan default ---');
const planDefault = js.match(/dms-11\.txt:2281[^\n]*/);
check('SECRET_TEXT is not the story-printed 2281 default',
  !index.includes(SECRET) || !index.toUpperCase().includes(STORY_PLAN_DEFAULT) === false
    ? SECRET.toUpperCase().includes(STORY_PLAN_DEFAULT) === false
    : true,
  'chapter 13 already prints 2281 in the DOM');
check('the 2281 collision is documented in scratch.js header',
  /dms-11\.txt:2281/.test(js) && /chapter 13/.test(js));

console.log('\n--- panel wiring ---');
check('index.html links sections/scratch.css',
  /<link rel="stylesheet" href="sections\/scratch\.css" \/>/.test(index));
const hasDeferredScratch = /<script src="sections\/scratch\.js" defer><\/script>/.test(index);
const hasLazyScratch = /['"]sections\/scratch\.js['"]/.test(index);
check('index.html loads sections/scratch.js (deferred tag or lazy-manifest)',
  hasDeferredScratch || hasLazyScratch,
  hasDeferredScratch ? 'deferred <script> tag' : hasLazyScratch ? 'lazy-manifest registration' : 'not found');
check('#scratch anchor exists with an aria-label',
  /id="scratch"[\s\S]{0,120}?aria-label="Secret"/.test(index));
check('scratch section is inside #content-region (gate-controlled)',
  /<div id="content-region">[\s\S]*id="scratch"/.test(index));
check('secret canvas present and marked decorative',
  /data-scratch-secret[^>]*aria-hidden="true"/.test(index));
check('cover canvas present (the scratchable layer)',
  /data-scratch-cover/.test(index));
check('replay button present',
  /data-scratch-replay/.test(index));
check('reduced-motion tap button present and hidden in markup',
  /data-scratch-tap[^>]*hidden/.test(index));
check('reveal container starts empty (no secret text in markup)',
  /class="scratch__reveal-text" data-scratch-reveal-text><\/p>/.test(index));
check('placeholder text is gone from the scratch section',
  !/id="scratch"[\s\S]{0,900}?TODO: scratch-off panel/.test(index));

console.log('\n--- behaviour contract in source ---');
check('clear threshold is defined and > 0',
  /const CLEAR_THRESHOLD = (\d+)/.test(js) && Number(js.match(/const CLEAR_THRESHOLD = (\d+)/)[1]) > 0,
  js.match(/const CLEAR_THRESHOLD = (\d+)/)?.[1]);
check('cleared-% is measured from canvas alpha',
  /getImageData/.test(js) && /data\[i\] === 0/.test(js));
check('unlock fires at/above the threshold',
  /if \(p >= CLEAR_THRESHOLD\) unlock\('scratch'\)/.test(js));
check('exactly one unlock definition (no duplicated path)',
  (js.match(/function unlock\(/g) || []).length === 1,
  `${(js.match(/function unlock\(/g) || []).length} definition(s)`);
check('replay re-arms the panel',
  /if \(nodes\.replay\) \{\s*\n\s*nodes\.replay\.addEventListener\('click'/.test(js)
    && /classList\.remove\('is-done'\)/.test(js)
    && /repaint\(\)/.test(js));
check('reduced-motion is read and switches to tap mode',
  /prefers-reduced-motion: reduce/.test(js) && /scratchMode.*'tap'|'tap'/.test(js));
check('reduced-motion tap calls the same unlock path',
  /unlock\('tap'\)/.test(js));
check('tap button visibility is driven by [hidden], not a class',
  !/classList\.toggle\('is-reduced-motion'/.test(js) && !/\.is-reduced-motion\s*\{/.test(css),
  'avoids out-specifying the [hidden] attribute');
check('card is thumb-sized (min 240px wide)',
  /width: min\(2\d\dpx/.test(css) || /width: min\(280px/.test(css),
  css.match(/width: min\((\d+px)/)?.[1]);
check('cover has touch-action none so scratching never scrolls the page',
  /touch-action: none/.test(css));
check('CSS honors prefers-reduced-motion',
  /@media \(prefers-reduced-motion: reduce\)/.test(css));
check('CSS defines every class the markup uses', (() => {
  const used = new Set();
  for (const m of index.matchAll(/class="(scratch[^"]*)"/g)) m[1].split(/\s+/).forEach((c) => used.add(c));
  const styled = new Set(css.match(/\.(scratch__[a-z-]+)/g)?.map((s) => s.slice(1)) ?? []);
  const missing = [...used].filter((c) => !styled.has(c));
  return missing.length === 0;
})(), 'no unstyled scratch class');

check('there is no QA method that can force the unlock',
  !/scrub/.test(js) && !/_forceUnlock/.test(js) && !/forceUnlock/.test(js),
  'real threshold logic is the only way in');
check('panel mounts only against a connected, gate-unlocked section',
  /function tryMount\(\)/.test(js)
    && /gate\.unlocked !== true/.test(js)
    && /!section \|\| !section\.isConnected/.test(js));
check('locked-state mount is guarded (no panel cached while detached)',
  /watchForSection/.test(js) && /MutationObserver/.test(js));

console.log('\n--- runtime (Chromium, real DOM + real threshold logic) ---');
let runtimeNote = 'skipped';
try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // Fake the clock past 19 Oct so the gate auto-unlocks and the real
    // post-unlock DOM (with chapter 13 present) is what we inspect.
    await page.addInitScript(() => {
      const RealDate = Date;
      const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
      class FakeDate extends RealDate {
        constructor(...a) { super(...(a.length ? a : [fakeNow])); }
        static now() { return fakeNow; }
      }
      globalThis.Date = FakeDate;
    });
    await page.goto('file:///home/vibex/halimah-birthday/index.html', { waitUntil: 'load' });
    // scroll to #scratch so the IntersectionObserver in the lazy-loader fires
    // and scratch.js gets loaded (lazy-manifest pattern from todo 17)
    await page.evaluate(() => document.getElementById('scratch')?.scrollIntoView());
    // give the lazy-loader a moment to inject the script and for scratch.js to mount
    await page.waitForFunction(() => window.__scratchPanel?.ready === true, null, { timeout: 10000 });
    runtimeNote = 'ran';

    const initial = await page.evaluate(() => {
      document.getElementById('scratch')?.scrollIntoView();
      return {
        unlocked: window.__beginGate?.unlocked,
        chapters: document.querySelectorAll('#story [data-chapter]').length,
        domText: document.documentElement.outerHTML,
        textContent: document.body.textContent,
        unlockedFlag: window.__scratchPanel.unlocked,
        percent: window.__scratchPanel.percent,
        mode: window.__scratchPanel.mode,
        threshold: window.__scratchPanel.threshold,
      };
    });

    check('gate is unlocked (post-19 Oct) so this is the real worst case',
      initial.unlocked === true, `unlocked=${initial.unlocked}`);
    check('story chapters are in the DOM (the leak-prone state)',
      initial.chapters === 14, `${initial.chapters} chapters`);
    check('secret absent from the INITIAL DOM after unlock',
      !initial.domText.includes(SECRET), 'outerHTML');
    check('secret absent from initial body text after unlock',
      !initial.textContent.includes(SECRET), 'textContent');
    check('panel is locked before scratching',
      initial.unlockedFlag === false && initial.percent === 0,
      `unlocked=${initial.unlockedFlag} percent=${initial.percent}`);
    check('scratch mode is active (not reduced-motion)',
      initial.mode === 'scratch', initial.mode);

    // Drive the REAL scratch path: scroll the card into view, then dispatch
    // real pointer events across the cover so the product's own erase and
    // threshold logic run. A synthetic band-fill would only re-test the mock.
    await page.locator('[data-scratch-cover]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const box = await page.locator('[data-scratch-cover]').boundingBox();
    const vp = page.viewportSize();
    check('cover canvas has a real on-screen box',
      Boolean(box) && box.width > 100 && box.height > 50 && box.y >= 0 && box.y + box.height <= vp.height,
      box ? `${Math.round(box.width)}x${Math.round(box.height)} at y=${Math.round(box.y)}` : 'no box');
    const topIsCover = await page.evaluate(() => {
      const c = document.querySelector('[data-scratch-cover]');
      const r = c.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === c;
    });
    check('cover canvas is the top element at its own centre (not covered)', topIsCover);
    const rowStep = box.height / 6;
    for (let row = 0; row < 6 && !(await page.evaluate(() => window.__scratchPanel.unlocked)); row += 1) {
      const y = box.y + rowStep * (row + 0.5);
      await page.mouse.move(box.x + 4, y);
      await page.mouse.down();
      for (let x = box.x + 4; x <= box.x + box.width - 4; x += 16) {
        await page.mouse.move(x, y);
      }
      await page.mouse.up();
    }

    const scratchResult = await page.evaluate(() => ({
      unlocked: window.__scratchPanel.unlocked,
      method: window.__scratchPanel.method,
      percent: window.__scratchPanel.percent,
      revealedText: document.querySelector('[data-scratch-reveal-text]')?.textContent ?? '',
      revealVisible: document.querySelector('[data-scratch-reveal]')?.classList.contains('is-visible'),
      replayVisible: document.querySelector('[data-scratch-replay]')?.classList.contains('is-visible'),
      sectionFlag: document.getElementById('scratch')?.dataset.scratchUnlocked,
    }));
    check('unlock FIRES at the clear threshold',
      scratchResult.unlocked === true, `method=${scratchResult.method}`);
    check('unlock was triggered by scratching, not by a bypass',
      scratchResult.method === 'scratch', scratchResult.method);
    check('percent reached the threshold',
      scratchResult.percent >= initial.threshold,
      `${scratchResult.percent} >= ${initial.threshold}`);
    check('secret appears in the DOM only AFTER unlock',
      scratchResult.revealedText.includes(SECRET), 'reveal text written by JS');
    check('reveal and replay become visible',
      scratchResult.revealVisible === true && scratchResult.replayVisible === true);
    check('section state flag is set', scratchResult.sectionFlag === 'true');

    // Replay re-arms.
    const afterReplay = await page.evaluate((secret) => {
      document.querySelector('[data-scratch-replay]').click();
      const text = document.querySelector('[data-scratch-reveal-text]')?.textContent ?? '';
      return {
        unlocked: window.__scratchPanel.unlocked,
        percent: window.__scratchPanel.percent,
        revealVisible: document.querySelector('[data-scratch-reveal]')?.classList.contains('is-visible'),
        textAfterReplay: text,
        secretStillInDom: document.body.textContent.includes(secret),
      };
    }, SECRET);
    check('replay re-arms the panel', afterReplay.unlocked === false && afterReplay.percent === 0,
      `unlocked=${afterReplay.unlocked} percent=${afterReplay.percent}`);
    check('replay hides the revealed text', afterReplay.revealVisible === false && afterReplay.textAfterReplay === '');
    check('replay purges the secret from the DOM entirely',
      afterReplay.secretStillInDom === false, 'no secret text left behind');

    check('no page errors during the whole run', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
  }

  // Reduced-motion path in its own context.
  const rmBrowser = await chromium.launch();
  try {
    const rmContext = await rmBrowser.newContext({
      viewport: { width: 375, height: 812 },
      reducedMotion: 'reduce',
    });
    const rmPage = await rmContext.newPage();
    await rmPage.addInitScript(() => {
      const RealDate = Date;
      const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
      class FakeDate extends RealDate {
        constructor(...a) { super(...(a.length ? a : [fakeNow])); }
        static now() { return fakeNow; }
      }
      globalThis.Date = FakeDate;
    });
    await rmPage.goto('file:///home/vibex/halimah-birthday/index.html', { waitUntil: 'load' });
    await rmPage.evaluate(() => document.getElementById('scratch')?.scrollIntoView());
    await rmPage.waitForFunction(() => window.__scratchPanel?.ready === true, null, { timeout: 10000 });
    const rm = await rmPage.evaluate(async () => {
      const btn = document.querySelector('[data-scratch-tap]');
      const before = {
        mode: window.__scratchPanel.mode,
        btnHidden: btn.hidden,
        cardHidden: document.querySelector('[data-scratch-card]').hidden,
        btnVisible: btn.offsetParent !== null,
      };
      btn.click();
      await new Promise((r) => setTimeout(r, 120));
      return {
        ...before,
        unlocked: window.__scratchPanel.unlocked,
        method: window.__scratchPanel.method,
        btnVisibleAfter: btn.offsetParent !== null,
        text: document.querySelector('[data-scratch-reveal-text]')?.textContent ?? '',
      };
    });
    check('reduced motion switches the panel to tap mode', rm.mode === 'tap', rm.mode);
    check('reduced motion hides the scratch card', rm.cardHidden === true);
    check('reduced motion shows a real, visible tap button',
      rm.btnHidden === false && rm.btnVisible === true,
      `hidden=${rm.btnHidden} visible=${rm.btnVisible}`);
    check('tap reveals the secret without any scratching',
      rm.unlocked === true && rm.method === 'tap', `method=${rm.method}`);
    check('tap reveal writes the secret', rm.text.includes(SECRET));
    check('tap button disappears after use', rm.btnVisibleAfter === false,
      'the [hidden] fix holds');
  } finally {
    await rmBrowser.close();
  }

  // ---- STALE STATE: locked -> live unlock must still mount and work ----
  const ssBrowser = await chromium.launch();
  try {
    const ssPage = await ssBrowser.newPage({ viewport: { width: 375, height: 812 } });
    const ssErrors = [];
    ssPage.on('pageerror', (e) => ssErrors.push(String(e)));
    // Load one minute BEFORE the gate target: the section is detached, so a
    // panel mounted here would be a cached reference to a detached subtree.
    await ssPage.addInitScript(() => {
      const RealDate = Date;
      const before = new RealDate('2026-10-18T23:59:00+01:00').getTime();
      class FakeDate extends RealDate {
        constructor(...a) { super(...(a.length ? a : [before])); }
        static now() { return before; }
      }
      globalThis.Date = FakeDate;
    });
    await ssPage.goto('file:///home/vibex/halimah-birthday/index.html', { waitUntil: 'load' });
    await ssPage.waitForTimeout(700);
    const lockedState = await ssPage.evaluate(() => ({
      gateUnlocked: window.__beginGate?.unlocked === true,
      scratchInDom: !!document.getElementById('scratch'),
      panelExists: typeof window.__scratchPanel !== 'undefined',
    }));
    check('locked page: gate holds the section out of the DOM',
      lockedState.gateUnlocked === false && lockedState.scratchInDom === false,
      JSON.stringify(lockedState));
    check('locked page: NO panel is cached while the section is detached',
      lockedState.panelExists === false,
      'guards against a stale reference into a detached subtree');

    // Cross the target live, the way the countdown gate really does it.
    await ssPage.evaluate(() => {
      const RealDate = Date;
      const after = new RealDate('2026-10-19T00:01:00+01:00').getTime();
      class FakeDate extends RealDate {
        constructor(...a) { super(...(a.length ? a : [after])); }
        static now() { return after; }
      }
      globalThis.Date = FakeDate;
      document.getElementById('begin-button')?.click();
    });
    // The gate restored the section, but scratch.js is lazy-loaded on first
    // scroll into view (index.html LAZY_SECTIONS). Scroll it in, the way a
    // reader does, so the loader fetches and mounts the panel.
    await ssPage.locator('#scratch').scrollIntoViewIfNeeded();
    await ssPage.waitForFunction(
      () => typeof window.__scratchPanel !== 'undefined' && !!document.getElementById('scratch'),
      null,
      { timeout: 8000 },
    );
    const liveState = await ssPage.evaluate(() => ({
      gateUnlocked: window.__beginGate?.unlocked === true,
      panelExists: typeof window.__scratchPanel !== 'undefined',
      locked: window.__scratchPanel?.unlocked,
    }));
    check('live unlock mounts the panel on the re-inserted section',
      liveState.gateUnlocked === true && liveState.panelExists === true && liveState.locked === false,
      JSON.stringify(liveState));

    await ssPage.locator('[data-scratch-cover]').scrollIntoViewIfNeeded();
    await ssPage.waitForTimeout(250);
    const ssBox = await ssPage.locator('[data-scratch-cover]').boundingBox();
    for (let row = 0; row < 8; row += 1) {
      const y = ssBox.y + (ssBox.height / 8) * (row + 0.5);
      await ssPage.mouse.move(ssBox.x + 6, y);
      await ssPage.mouse.down();
      for (let x = ssBox.x + 6; x <= ssBox.x + ssBox.width - 6; x += 14) {
        await ssPage.mouse.move(x, y);
      }
      await ssPage.mouse.up();
      if (await ssPage.evaluate(() => window.__scratchPanel.unlocked)) break;
    }
    const ssAfter = await ssPage.evaluate(() => ({
      unlocked: window.__scratchPanel.unlocked,
      method: window.__scratchPanel.method,
      text: document.querySelector('[data-scratch-reveal-text]')?.textContent ?? '',
    }));
    check('panel still works after the live unlock (no stale state)',
      ssAfter.unlocked === true && ssAfter.method === 'scratch', JSON.stringify({ ...ssAfter, text: '' }));
    check('secret reveals correctly after the live unlock', ssAfter.text.includes(SECRET));
    check('no page errors during the locked-to-unlocked run', ssErrors.length === 0, ssErrors.join(' | '));
  } finally {
    await ssBrowser.close();
  }
} catch (err) {
  check('runtime checks executed', false, String(err && err.message ? err.message : err));
}

console.log(`\nruntime: ${runtimeNote}`);
console.log('\n========================================');
console.log(failures === 0 ? 'RESULT: ALL CHECKS PASSED' : `RESULT: ${failures} CHECK(S) FAILED`);
console.log('========================================');
process.exit(failures === 0 ? 0 : 1);
