/**
 * task-7-qa3-story.mjs — extended spectacle QA for the story rebuild (plan todo 5).
 *
 * Lanes:
 *   375x812, 768x1024, 1280x800  — trigger topology (29), rail fill signal,
 *                                 canvas animates in view / frozen out of view,
 *                                 zero console+page errors,
 *                                 + FLOOR checks per lane (todo 7, folded in):
 *                                 zero clipping (scrollWidth<=clientWidth+1 on
 *                                 every .story__msg/.story__letter/.story__voiceover),
 *                                 375px-only nav-rail bbox overlap check,
 *                                 3 scroll depths (ch1 top, ch11 quote mid,
 *                                 ch14 bottom) => task-7-floor-*.png (EXACT 9).
 *   static top: scrim/backdrop-filter asserts on sections/story.css.
 *   tail: 320px narrow-viewport boundary probe (logged, NOT fixed).
 *   gsap-abort  (kill-switch)   — chapters readable with GSAP routes aborted.
 *   reducedMotion:'reduce'      — 0 triggers, canvas display:none, readable.
 *
 * Known race (pre-existing, reproduced with baseline): the page lazy-loader can
 * boot sections/story.js before vendor/gsap.min.js resolves, hitting !hasGsap()
 * and building 0 triggers. Every lane therefore waits on a ready-poll for
 * (gsap && ScrollTrigger && Motion.hasGsap() && getAll().length > 0) for up to
 * 15s, and re-injects the section scripts + re-polls once before any assert.
 * Never assert on the first paint.
 *
 * Must NOT modify: index.html, sections/story.css, sections/story.js,
 * js/motion.js, js/begin.js, tokens.css, or any sibling audit harness.
 * Evidence only under /home/vibex/.omo/evidence/halimah-story-rebuild/.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { globSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const OUT = '/home/vibex/.omo/evidence/halimah-story-rebuild';
mkdirSync(OUT, { recursive: true });

const URL = 'file:///home/vibex/halimah-birthday/index.html';
// Story owns 29 triggers; #birthday adds 5 of its own (3 headline-mask
// reveals top 82%, 1 manifesto scrub top 78%->bottom 45%, 1 pinned bridge
// top top+=180%). Full-motion lanes therefore expect 34 total.
const EXPECTED_STORY_TRIGGERS = 29;
const EXPECTED_BIRTHDAY_TRIGGERS = 5;
const EXPECTED_TRIGGERS = EXPECTED_STORY_TRIGGERS + EXPECTED_BIRTHDAY_TRIGGERS;
const READY_TIMEOUT_MS = 15000;

const log = [];
const floorLog = [];
const failures = [];
let checks = 0;
const note = (m) => { log.push(m); console.log(m); };
// Floor lines are dual-written so the todo-7 evidence log stays complete after
// this harness absorbed audits/task-7-floor.mjs.
const floorNote = (m) => { floorLog.push(m); log.push(m); console.log(m); };
const check = (name, ok, detail) => {
  checks += 1;
  if (ok) {
    note(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    note(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
  return ok;
};

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

function fakeDate() {
  const RealDate = Date;
  const fakeNow = new RealDate('2026-10-20T12:00:00+01:00').getTime();
  class FakeDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fakeNow])); }
    static now() { return fakeNow; }
  }
  globalThis.Date = FakeDate;
}

/** Attach console+pageerror listeners to EVERY page (closes the qa.mjs page4 gap). */
function watchErrors(page, bucket) {
  // Excused-noise URLs seen on requestfailed (album probes + physics fetch).
  // Their matching console "Failed to load resource" messages carry no URL
  // in m.text(), so correlate by draining one token per generic console error.
  const excusedNoise = [];
  page.on('pageerror', (e) => bucket.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const txt = m.text();
    const loc = (() => { try { return m.location()?.url ?? ''; } catch { return ''; } })();
    // Aborted vendor routes in the kill-switch lane also surface as console
    // "Failed to load resource" errors — intentional, same as requestfailed.
    if (/Failed to load resource/.test(txt) && /gsap|ScrollTrigger/i.test(loc)) return;
    // Correlated noise: bare "Failed to load resource" with one excused
    // requestfailed token outstanding => same known file:// probe, excuse it.
    if (/Failed to load resource/.test(txt) && !/gsap|ScrollTrigger/i.test(txt) && excusedNoise.length > 0) {
      excusedNoise.shift();
      return;
    }
    // Pre-existing out-of-story noise under file:// (see requestfailed
    // filter above): physics section fetch + missing album placeholder
    // photos fail identically on the pre-rebuild baseline.
    if (/physics-names\.json/.test(txt)) return;
    if (/assets\/photos\//.test(txt)) return;
    bucket.push(`console: ${txt.slice(0, 300)}`);
  });
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    // Aborted vendor routes are intentional in the kill-switch lane.
    if (err === 'net::ERR_FAILED' && /gsap|ScrollTrigger/.test(r.url())) return;
    // Pre-existing out-of-story noise (verified: sections/physics.js + album
    // placeholder markup are byte-identical to the pre-rebuild baseline and
    // outside the story edit surface): physics-names.json fetch and
    // assets/photos/* placeholder 404s under file:// are not story regressions.
    if (/content\/physics-names\.json/.test(r.url())) { excusedNoise.push(r.url()); return; }
    if (/assets\/photos\//.test(r.url())) { excusedNoise.push(r.url()); return; }
    bucket.push(`requestfailed: ${r.url().slice(0, 160)} (${err})`);
  });
}

/**
 * Wait until the real story motion layer is live: gsap + ScrollTrigger present,
 * Motion.hasGsap() true, and at least one ScrollTrigger built. Retries by
 * re-injecting the section scripts (mirrors the loader's re-init intent) once
 * before giving up. Returns the observed state for logging.
 */
async function waitForMotionReady(page, { label }) {
  const started = Date.now();
  let state = null;
  let reinjected = false;

  const poll = () =>
    page.evaluate(() => ({
      gsap: typeof window.gsap !== 'undefined',
      st: typeof window.ScrollTrigger !== 'undefined',
      hasGsap: window.Motion && typeof window.Motion.hasGsap === 'function'
        ? window.Motion.hasGsap()
        : null,
      triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
      chapters: document.querySelectorAll('#story [data-chapter]').length,
      unlocked: document.documentElement.getAttribute('data-unlocked') === 'true',
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      canvas: !!document.querySelector('#story canvas.story__ambient'),
    }));

  for (;;) {
    state = await poll();
    // Full page expected: 29 story + 5 birthday triggers. Break only when
    // the complete topology is present, so partial loads (birthday-only or
    // story-only) keep polling instead of asserting against half the page.
    if (state.gsap && state.st && state.hasGsap === true && state.triggers >= EXPECTED_TRIGGERS) break;
    if (Date.now() - started > READY_TIMEOUT_MS / 2 && !reinjected) {
      reinjected = true;
      note(`  ..ready-poll timeout at ${Math.round((Date.now() - started) / 1000)}s; re-injecting sections/story.js (${label})`);
      // Re-inject only; vendor libs are already resolved by this point in the
      // normal path. This rebuilds the triggers through the real boot().
      await page.addScriptTag({ url: 'sections/story.js' }).catch((e) => {
        note(`  ..re-inject failed: ${String(e).slice(0, 160)}`);
      });
      await page.waitForTimeout(500);
    }
    if (Date.now() - started > READY_TIMEOUT_MS) break;
    await page.waitForTimeout(250);
  }
  state.waitMs = Date.now() - started;
  state.reinjected = reinjected;
  return state;
}

const READ = () => ({
  triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
  // Topology: the exact start/end strings for each built trigger.
  topology: window.ScrollTrigger
    ? window.ScrollTrigger.getAll().map((t) => `${t.vars.trigger?.id || t.vars.trigger?.tagName || '?'}|${t.vars.start}|${t.vars.end}|scrub:${!!t.vars.scrub}`)
    : [],
  railFill: (() => {
    const p = document.querySelector('#story [data-story-progress]');
    if (!p) return null;
    return p.style.getPropertyValue('--story-rail-progress') || null;
  })(),
  railVisible: !!document.querySelector('#story [data-story-progress].is-visible'),
  atmProgress: (() => {
    const a = document.querySelector('#story .story__atmosphere');
    return a ? a.style.getPropertyValue('--story-atm-progress') || null : null;
  })(),
  atmDepth: (() => {
    const a = document.querySelector('#story .story__atmosphere');
    return a ? a.style.getPropertyValue('--story-atm-depth') || null : null;
  })(),
  activeDots: document.querySelectorAll('#story .story__progress-item.is-active').length,
  chapterOpacity: [...document.querySelectorAll('#story [data-chapter]')].map(
    (c) => Math.round(parseFloat(getComputedStyle(c).opacity) * 100) / 100
  ),
  isInStory: document.body.classList.contains('is-in-story'),
  canvasDisplay: (() => {
    const c = document.querySelector('#story canvas.story__ambient');
    return c ? getComputedStyle(c).display : 'missing';
  })(),
});

const canvasDataUrl = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('#story canvas.story__ambient');
    if (!c) return null;
    return c.toDataURL();
  });

const browser = await chromium.launch({
  timeout: 45000,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

// ---- FLOOR static asserts (from task-7-floor.mjs): legibility scrim rules ----
{
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('/home/vibex/halimah-birthday/sections/story.css', 'utf8');
  const cssOk = (name, cond) => {
    checks += 1;
    const line = `${cond ? '  PASS' : '  FAIL'}  floor static: ${name}`;
    floorLog.push(line); log.push(line); console.log(line);
    if (!cond) failures.push(`floor static: ${name}`);
    return cond;
  };
  cssOk('css scrim var --story-scrim present', css.includes('--story-scrim'));
  cssOk('css backdrop-filter present', css.includes('backdrop-filter'));
}

try {
  const LANES = [
    { name: '375x812', width: 375, height: 812 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1280x800', width: 1280, height: 800 },
  ];

  for (const lane of LANES) {
    note(`\n=== LANE ${lane.name} (story motion, full loader) ===`);
    const errs = [];
    const page = await browser.newPage({ viewport: { width: lane.width, height: lane.height } });
    watchErrors(page, errs);
    await page.addInitScript(fakeDate);
    await page.goto(URL, { waitUntil: 'load' });

    // 1) Motion readiness (never assert on first paint).
    const ready = await waitForMotionReady(page, { label: lane.name });
    note(
      `ready: gsap=${ready.gsap} st=${ready.st} hasGsap=${ready.hasGsap} triggers=${ready.triggers} ` +
      `chapters=${ready.chapters} unlocked=${ready.unlocked} wait=${ready.waitMs}ms reinjected=${ready.reinjected}`
    );
    check(`${lane.name} gate unlocked`, ready.unlocked === true, `data-unlocked=${ready.unlocked}`);
    check(`${lane.name} 14 chapters in DOM`, ready.chapters === 14, `got ${ready.chapters}`);

    // 2) Trigger count + topology.
    const s0 = await page.evaluate(READ);
    check(
      `${lane.name} ScrollTrigger.getAll().length === ${EXPECTED_TRIGGERS}`,
      s0.triggers === EXPECTED_TRIGGERS,
      `got ${s0.triggers}`
    );
    // 14 chapter scrub (top 85% -> top 35%), 14 dot toggles (top center -> bottom center), 1 section toggle (top 60% -> bottom 40%).
    const scrub = s0.topology.filter((t) => t.includes('scrub:true') && t.includes('|top 85%|top 35%|'));
    const dot = s0.topology.filter((t) => t.includes('|top center|bottom center|'));
    const sect = s0.topology.filter((t) => t.includes('|top 60%|bottom 40%|'));
    check(`${lane.name} 14 chapter scrub triggers (top 85%->top 35%)`, scrub.length === 14, `got ${scrub.length}`);
    check(`${lane.name} 14 dot toggle triggers (top center->bottom center)`, dot.length === 14, `got ${dot.length}`);
    check(`${lane.name} 1 section toggle trigger (top 60%->bottom 40%)`, sect.length === 1, `got ${sect.length}`);
    // Birthday extras: 3 headline masks (top 82%), 1 manifesto scrub (top 78%->bottom 45%), 1 pinned bridge (top top->+=180%).
    const mask = s0.topology.filter((t) => t.includes('|top 82%|'));
    const mani = s0.topology.filter((t) => t.includes('|top 78%|bottom 45%|'));
    const bridge = s0.topology.filter((t) => t.includes('|top top|+=180%|'));
    check(`${lane.name} 3 birthday mask reveals (top 82%)`, mask.length === 3, `got ${mask.length}`);
    check(`${lane.name} 1 birthday manifesto scrub (top 78%->bottom 45%)`, mani.length === 1, `got ${mani.length}`);
    check(`${lane.name} 1 birthday pinned bridge (top top->+=180%)`, bridge.length === 1, `got ${bridge.length}`);

    // 3) Rail fill progress signal goes live when scrolled into the story.
    const storyTop = await page.evaluate(() => Math.round(document.getElementById('story').getBoundingClientRect().top + window.scrollY));
    await page.evaluate((t) => window.scrollTo(0, t + 200), storyTop);
    await page.waitForTimeout(1200);
    const s1 = await page.evaluate(READ);
    const railNum = s1.railFill == null ? -1 : parseFloat(s1.railFill);
    check(
      `${lane.name} rail fill progress signal live (--story-rail-progress > 0)`,
      Number.isFinite(railNum) && railNum > 0,
      `railFill=${s1.railFill} railVisible=${s1.railVisible}`
    );
    check(`${lane.name} section active (body.is-in-story)`, s1.isInStory === true, `is-in-story=${s1.isInStory}`);

    // 4) Canvas animates while #story is in view.
    const cA = await canvasDataUrl(page);
    await page.waitForTimeout(600);
    const cB = await canvasDataUrl(page);
    check(`${lane.name} canvas canvas.story__ambient present`, !!cA, cA ? 'found' : 'missing');
    check(`${lane.name} canvas ANIMATES in view (toDataURL changes)`, cA && cB && cA !== cB, 'two frames 600ms apart differ');

    // 5) Canvas freezes once #story is fully out of view (scrolled to document bottom).
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800); // let the IntersectionObserver fire + resize settle
    const storyBox = await page.evaluate(() => {
      const r = document.getElementById('story').getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight };
    });
    check(
      `${lane.name} #story fully out of view after scroll-to-bottom`,
      storyBox.bottom < 0 || storyBox.top > storyBox.vh,
      `top=${storyBox.top} bottom=${storyBox.bottom} vh=${storyBox.vh}`
    );
    const fA = await canvasDataUrl(page);
    await page.waitForTimeout(600);
    const fB = await canvasDataUrl(page);
    check(`${lane.name} canvas FROZEN out of view (toDataURL identical 600ms)`, fA && fB && fA === fB, 'frames identical');

    // 6) Zero console + page errors on this page.
    check(`${lane.name} zero console/page errors`, errs.length === 0, errs.length ? errs.slice(0, 3).join(' | ') : 'clean');

    // 7) FLOOR runtime checks (from task-7-floor.mjs): zero clipping on every
    //    quote/pull/voiceover, plus 375px-only nav-rail overlap.
    const clips = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.story__msg, .story__letter, .story__voiceover')];
      const bad = [];
      els.forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 1) {
          bad.push(`${el.tagName}.${String(el.className).split(' ')[0]} sw=${el.scrollWidth} cw=${el.clientWidth} :: ${(el.textContent || '').slice(0, 50)}`);
        }
      });
      return { total: els.length, bad };
    });
    {
      checks += 1;
      const ok = clips.bad.length === 0;
      const line = `${ok ? '  PASS' : '  FAIL'}  floor ${lane.name} zero clipping violations — checked=${clips.total} bad=${clips.bad.length}${clips.bad.length ? ' :: ' + clips.bad.slice(0, 3).join(' | ') : ''}`;
      floorLog.push(line); log.push(line); console.log(line);
      if (!ok) failures.push(`floor ${lane.name} zero clipping violations`);
    }
    if (lane.name === '375x812') {
      const ov = await page.evaluate(() => {
        const rail = document.querySelector('.story__progress');
        if (!rail) return { rail: 'missing', overlaps: [] };
        const rr = rail.getBoundingClientRect();
        const cs = getComputedStyle(rail);
        const vis = rr.width > 0 && rr.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        const els = [...document.querySelectorAll('.story__msg, .story__letter, .story__voiceover')];
        const overlaps = [];
        els.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > window.innerHeight) return;
          if (r.left < rr.right && r.right > rr.left && r.top < rr.bottom && r.bottom > rr.top) {
            overlaps.push(`${el.tagName}.${String(el.className).split(' ')[0]} :: ${(el.textContent || '').slice(0, 50)}`);
          }
        });
        return { railVisible: vis, overlaps };
      });
      checks += 1;
      const ok = ov.overlaps.length === 0;
      const line = `${ok ? '  PASS' : '  FAIL'}  floor 375px zero nav-rail overlaps — railVisible=${ov.railVisible} overlaps=${ov.overlaps.length}${ov.overlaps.length ? ' :: ' + ov.overlaps.slice(0, 3).join(' | ') : ''}`;
      floorLog.push(line); log.push(line); console.log(line);
      if (!ok) failures.push('floor 375px zero nav-rail overlaps');
    }

    await page.screenshot({ path: `${OUT}/task-7-qa3-story-${lane.name}.png` });
    note(`  screenshot: task-7-qa3-story-${lane.name}.png`);

    // 8) FLOOR 3 scroll depths (from task-7-floor.mjs): ch1 top, ch11 quote
    //    mid, ch14 bottom => task-7-floor-{top,mid,bottom}-{w}x{h}.png (EXACT 9).
    {
      const pos = await page.evaluate(() => {
        const y = (el) => el.getBoundingClientRect().top + window.scrollY;
        const hh = (el) => el.getBoundingClientRect().height;
        const ch1 = document.getElementById('chapter-1');
        const quote = document.getElementById('chapter-11').querySelector('.story__quote');
        const ch14 = document.getElementById('chapter-14');
        return { ch1Top: y(ch1), beat3Mid: y(quote) + hh(quote) / 2, ch14Bot: y(ch14) + hh(ch14) };
      });
      const depths = [
        ['top', Math.max(0, pos.ch1Top - 60)],
        ['mid', Math.max(0, pos.beat3Mid - lane.height / 2)],
        ['bottom', Math.max(0, pos.ch14Bot - lane.height + 40)],
      ];
      for (const [label, y] of depths) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${OUT}/task-7-floor-${label}-${lane.width}x${lane.height}.png` });
        floorNote(`  screenshot: task-7-floor-${label}-${lane.width}x${lane.height}.png @y=${Math.round(y)}`);
      }
    }
    await page.close();
  }

  // ---- Kill-switch lane: GSAP routes aborted, chapters must stay readable ----
  note(`\n=== LANE gsap-abort (kill-switch readability) ===`);
  {
    const errs = [];
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    watchErrors(page, errs);
    await page.route('**/vendor/gsap.min.js', (r) => r.abort());
    await page.route('**/vendor/ScrollTrigger.min.js', (r) => r.abort());
    await page.addInitScript(fakeDate);
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const chs = [...document.querySelectorAll('#story [data-chapter]')];
      const readable = chs.filter((c) => {
        const cs = getComputedStyle(c);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
      }).length;
      const longText = chs.filter((c) => (c.textContent || '').trim().length > 50).length;
      return {
        total: chs.length,
        readable,
        longText,
        triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
        hasGsap: typeof window.gsap !== 'undefined',
      };
    });
    note(`gsap-abort: ${JSON.stringify(r)}`);
    check('gsap-abort 0 triggers (GSAP never loaded)', r.triggers === 0 && r.hasGsap === false, `triggers=${r.triggers} hasGsap=${r.hasGsap}`);
    check('gsap-abort all 14 chapters visible (opacity>0.05)', r.readable === 14, `readable=${r.readable}`);
    check('gsap-abort all 14 chapters text length>50', r.longText === 14, `longText=${r.longText}`);
    check('gsap-abort zero console/page errors', errs.length === 0, errs.length ? errs.slice(0, 3).join(' | ') : 'clean');
    await page.screenshot({ path: `${OUT}/task-7-qa3-story-gsap-abort.png` });
    note('  screenshot: task-7-qa3-story-gsap-abort.png');
    await page.close();
  }

  // ---- Reduced-motion lane: 0 triggers, canvas hidden, chapters readable ----
  note(`\n=== LANE reducedMotion:reduce ===`);
  {
    const errs = [];
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    watchErrors(page, errs);
    await page.addInitScript(fakeDate);
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const chs = [...document.querySelectorAll('#story [data-chapter]')];
      const readable = chs.filter((c) => {
        const cs = getComputedStyle(c);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
      }).length;
      const longText = chs.filter((c) => (c.textContent || '').trim().length > 50).length;
      const c = document.querySelector('#story canvas.story__ambient');
      const progress = document.querySelector('#story [data-story-progress]');
      return {
        total: chs.length,
        readable,
        longText,
        triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
        canvasDisplay: c ? getComputedStyle(c).display : 'missing',
        railHidden: progress ? (progress.hidden === true || getComputedStyle(progress).display === 'none') : null,
      };
    });
    note(`reduced-motion: ${JSON.stringify(r)}`);
    check('reduced-motion 0 triggers (early return)', r.triggers === 0, `triggers=${r.triggers}`);
    check('reduced-motion canvas display:none', r.canvasDisplay === 'none', `canvas=${r.canvasDisplay}`);
    check('reduced-motion progress rail hidden', r.railHidden === true, `railHidden=${r.railHidden}`);
    check('reduced-motion all 14 chapters readable', r.readable === 14, `readable=${r.readable}`);
    check('reduced-motion all 14 chapters text length>50', r.longText === 14, `longText=${r.longText}`);
    check('reduced-motion zero console/page errors', errs.length === 0, errs.length ? errs.slice(0, 3).join(' | ') : 'clean');
    await page.evaluate(() => document.getElementById('chapter-1')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/task-7-qa3-story-reduced-motion.png` });
    note('  screenshot: task-7-qa3-story-reduced-motion.png');
    await page.close();
  }

  // ---- FLOOR failure-inject: 320px narrow viewport, log WITHOUT fixing ----
  {
    floorNote('\n=== INJECT 320px (boundary probe, no fix) ===');
    const np = await browser.newPage({ viewport: { width: 320, height: 812 } });
    const nerr = [];
    watchErrors(np, nerr);
    await np.addInitScript(fakeDate);
    await np.goto(URL, { waitUntil: 'load' });
    await np.evaluate(() => {
      const el = document.getElementById('story');
      const r = el.getBoundingClientRect();
      window.scrollTo(0, r.top + window.scrollY + 200);
    });
    await np.waitForTimeout(600);
    const ready320 = await waitForMotionReady(np, { label: '320px' });
    floorNote(`  320px ready: unlocked=${ready320.unlocked} chapters=${ready320.chapters} triggers=${ready320.triggers}`);
    const inj = await np.evaluate(() => {
      const els = [...document.querySelectorAll('.story__msg, .story__letter, .story__voiceover')];
      const bad = [];
      els.forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 1) {
          bad.push(`${el.tagName}.${String(el.className).split(' ')[0]} sw=${el.scrollWidth} cw=${el.clientWidth} :: ${(el.textContent || '').slice(0, 50)}`);
        }
      });
      return { total: els.length, bad };
    });
    floorNote(`  320px inject: checked=${inj.total} violations=${inj.bad.length}${inj.bad.length ? ' :: ' + inj.bad.slice(0, 5).join(' | ') : ''} (logged, NOT fixed) errors=${nerr.length ? nerr.slice(0, 3).join(' | ') : 'clean'}`);
    await np.close();
  }
} finally {
  await browser.close();
}

note(`\n=== SUMMARY ===`);
note(`checks: ${checks}, failures: ${failures.length}`);
if (failures.length) {
  note('FAILED CHECKS:');
  failures.forEach((f) => note(`  - ${f}`));
}
note(failures.length === 0 ? 'QA3: ALL GREEN' : 'QA3: RED');

writeFileSync(`${OUT}/task-7-qa3-story.log`, log.join('\n') + '\n');
writeFileSync(`${OUT}/task-7-floor.log`, floorLog.join('\n') + '\n');
console.log(`\nlog written: ${OUT}/task-7-qa3-story.log + ${OUT}/task-7-floor.log`);
if (failures.length) process.exitCode = 1;
