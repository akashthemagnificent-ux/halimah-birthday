# Clocks Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a final page to the birthday site — three live counters (together, next birthday, one-year anniversary) on a scroll-pinned three-ring WebGL stage.

**Architecture:** One new section `#clocks` placed after `#finale`. Pure date math lives in a standalone UMD module so it can be unit-tested under Node without a browser. The DOM carries the numerals; three.js draws only the rings and positions each numeral block by projecting its ring's world position to screen space. The frame loop is wall-clock driven, gated by IntersectionObserver, and fully disposed on `pagehide`.

**Tech Stack:** Vanilla ES5-flavoured JavaScript (no build step), `vendor/three.min.js` r160 UMD, CSS custom properties from `tokens.css`, `node:test` for unit tests, Playwright for browser QA.

**Spec:** `docs/superpowers/specs/2026-10-20-clocks-page-design.md`

## Global Constraints

- No new dependencies. No bundler, no npm install, no import maps.
- Classic `<script>` tags only; every new script must work when loaded in document order.
- Time zone is `Europe/London` for every day boundary.
- Anchors: together since **26 August 2026**; next birthday **19 October**; anniversary **26 August 2027**.
- The section lives **inside `#content-region`**, after `#finale`, so it stays behind the begin-tap unlock gate.
- `js/begin.js` must not be modified — it is on the unlock critical path.
- `prefers-reduced-motion` is deliberately **not** gated (owner directive in `js/motion.js`, matches `sections/bg-orb.js`).
- DPR cap 1.75. rAF stops when the section is offscreen or the document is hidden.
- Numerals are DOM text (never canvas textures). Ticking digits are `aria-hidden`; one `.sr-only` sentence per ring updates once per minute.
- Never render a negative duration.
- Cache-bust new asset URLs with a `?v=` query string on first ship (`?v=clocks1`).
- Run all commands from `/root/halimah-birthday`. Do **not** run Python from `/tmp`.

## Review Focus

These are the failure modes most likely to bite the person using this page. Each has a test in the task that owns the code.

1. **Phone sleeps for hours, then wakes.** The counters must show the true elapsed time on the first frame back, not a value built from accumulated ticks.
2. **The anniversary passes while the page is open.** 26 August 2027 00:00 London must flip the counter from counting down to counting up, with no negative number and no reload.
3. **The birthday rolls over at midnight London, across the DST boundary.** Days remaining must step by exactly one day per calendar day, and must not drift by an hour on 25 October.
4. **The device has no WebGL.** The rings vanish but every number must still be correct and legible over a CSS ground.
5. **JavaScript is disabled entirely.** The section must still read as true statements ("together since 26 August 2026") rather than an empty box.
6. **She scrolls past the pinned track.** The section must release cleanly — no pinned stage left floating over the next page, no dead space after it.

---

### Task 1: Pure date math (`sections/clocks-core.js`)

The whole page is only as trustworthy as its date arithmetic, so it is built and proven first, with no DOM and no WebGL involved.

**Files:**
- Create: `sections/clocks-core.js`
- Test: `qa/clocks-core.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: a UMD module exposing (on `window.ClocksMath` in browsers, `module.exports` in Node):
  - `TZ` — the string `'Europe/London'`
  - `zonedParts(date: Date, tz: string) -> {year,month,day,hour,minute,second}`
  - `instantFor(year: number, month: number, day: number, tz: string) -> Date` (local midnight)
  - `decompose(ms: number) -> {days,hours,minutes,seconds}`
  - `lapProgress(nowMs: number, tz: string, lap: 'day'|'hour'|'minute') -> number` in `[0,1)`
  - `milestoneState(milestone: object, nowMs: number, tz: string) -> {ms,direction,parts,progress}`
  - `formatAria(parts: object) -> string`
  - `pad2(n: number) -> string`

- [ ] **Step 1: Write the failing tests**

Create `qa/clocks-core.test.mjs`:

```js
// Unit tests for sections/clocks-core.js — pure date math, no browser.
// Run: node --test qa/clocks-core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../sections/clocks-core.js');

const TOGETHER = { id: 'together', mode: 'elapsed',
  anchor: { y: 2026, m: 8, d: 26 }, lap: 'day' };
const BIRTHDAY = { id: 'birthday', mode: 'annual',
  anchor: { y: 2026, m: 10, d: 19 }, lap: 'hour' };
const ANNIV = { id: 'anniversary', mode: 'until',
  anchor: { y: 2026, m: 8, d: 26 }, target: { y: 2027, m: 8, d: 26 }, lap: 'minute' };

test('decompose splits into days, hours, minutes, seconds', () => {
  assert.deepEqual(M.decompose(258652000),
    { days: 2, hours: 23, minutes: 50, seconds: 52 });
});

test('decompose never returns a negative', () => {
  assert.deepEqual(M.decompose(-5000),
    { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test('instantFor resolves London midnight in BST as 23:00Z the day before', () => {
  const d = M.instantFor(2026, 10, 19, M.TZ);
  assert.equal(d.toISOString(), '2026-10-18T23:00:00.000Z');
});

test('instantFor resolves London midnight in GMT as 00:00Z', () => {
  const d = M.instantFor(2027, 1, 15, M.TZ);
  assert.equal(d.toISOString(), '2027-01-15T00:00:00.000Z');
});

test('instantFor handles 29 February in a leap year', () => {
  // February in London is GMT (UTC+0), so local midnight is 00:00Z.
  const d = M.instantFor(2028, 2, 29, M.TZ);
  assert.equal(d.toISOString(), '2028-02-29T00:00:00.000Z');
});

test('instantFor does not crash on 29 February in a non-leap year', () => {
  const d = M.instantFor(2027, 2, 29, M.TZ);
  assert.ok(d instanceof Date);
  assert.ok(Number.isFinite(d.getTime()));
});

test('elapsed counts up from the anchor', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const s = M.milestoneState(TOGETHER, now, M.TZ);
  assert.equal(s.direction, 'up');
  assert.equal(s.parts.days, 55);
});

test('annual targets this year before the date', () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  const s = M.milestoneState(BIRTHDAY, now, M.TZ);
  assert.equal(s.direction, 'down');
  assert.equal(s.parts.days, 17);
});

test('annual rolls to the following year the instant the date passes', () => {
  const before = M.milestoneState(BIRTHDAY,
    Date.parse('2027-10-18T12:00:00Z'), M.TZ);   // 13:00 London, the 18th
  const after = M.milestoneState(BIRTHDAY,
    Date.parse('2027-10-19T23:00:01Z'), M.TZ);   // 00:00:01 London, the 20th
  assert.equal(before.parts.days, 0, 'still counting down to the 19th');
  assert.equal(after.parts.days, 364, 'now targeting 2028');
});

test('annual steps one day per calendar day across the DST fall-back', () => {
  // Both instants target 2027-10-19 London; the two-day gap must
  // read as exactly two days, not 2 days +/- an hour.
  const a = M.milestoneState(BIRTHDAY, Date.parse('2026-10-24T12:00:00Z'), M.TZ);
  const b = M.milestoneState(BIRTHDAY, Date.parse('2026-10-26T12:00:00Z'), M.TZ);
  assert.equal(a.parts.days - b.parts.days, 2);
});

test('until counts down before the target', () => {
  const s = M.milestoneState(ANNIV, Date.parse('2027-08-01T12:00:00Z'), M.TZ);
  assert.equal(s.direction, 'down');
  assert.ok(s.ms > 0);
});

test('until flips to counting up the moment the target passes', () => {
  const s = M.milestoneState(ANNIV, Date.parse('2027-08-26T12:00:00Z'), M.TZ);
  assert.equal(s.direction, 'up');
  assert.ok(s.ms > 0, 'elapsed time since, not a negative countdown');
  assert.ok(s.ms < 86400000);
});

test('until renders zero for an instant, never a negative', () => {
  const at = M.instantFor(2027, 8, 26, M.TZ).getTime();
  const s = M.milestoneState(ANNIV, at, M.TZ);
  assert.equal(s.ms, 0);
  assert.equal(s.parts.days, 0);
});

test('lapProgress stays within [0, 1)', () => {
  for (const lap of ['day', 'hour', 'minute']) {
    const p = M.lapProgress(Date.parse('2026-10-20T13:37:41Z'), M.TZ, lap);
    assert.ok(p >= 0 && p < 1, lap + ' out of range: ' + p);
  }
});

test('lapProgress for minute equals the second of the minute over 60', () => {
  const now = Date.parse('2026-10-20T13:37:41Z'); // 14:37:41 London
  assert.ok(Math.abs(M.lapProgress(now, M.TZ, 'minute') - 41 / 60) < 1e-9);
});

test('formatAria reads as a sentence', () => {
  assert.equal(M.formatAria({ days: 55, hours: 7, minutes: 42, seconds: 19 }),
    '55 days, 7 hours, 42 minutes and 19 seconds');
});

test('formatAria uses singular units', () => {
  assert.equal(M.formatAria({ days: 1, hours: 1, minutes: 1, seconds: 1 }),
    '1 day, 1 hour, 1 minute and 1 second');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test qa/clocks-core.test.mjs`
Expected: FAIL — `Cannot find module '../sections/clocks-core.js'`.

- [ ] **Step 3: Write the implementation**

Create `sections/clocks-core.js`:

```js
/* ============================================================
   clocks-core — pure date math for the clocks page.

   No DOM, no WebGL, no globals beyond one UMD export. Kept
   separate from sections/clocks.js so the arithmetic can be
   unit-tested under Node (qa/clocks-core.test.mjs) — this is
   the part of the page that can be silently wrong for months.

   Every calendar boundary is resolved in Europe/London, using
   the same two-pass offset correction as js/begin.js:54, so
   the clocks flip at the same instant the countdown gate did.
   ============================================================ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.ClocksMath = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TZ = 'Europe/London';

  var FMT = null;
  function formatter() {
    if (!FMT) {
      FMT = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      });
    }
    return FMT;
  }

  function zonedParts(date, tz) {
    var f = (tz === TZ || !tz) ? formatter()
      : new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false
        });
    var out = {};
    var parts = f.formatToParts(date);
    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].type !== 'literal') out[parts[i].type] = parts[i].value;
    }
    return {
      year: Number(out.year),
      month: Number(out.month),
      day: Number(out.day),
      hour: Number(out.hour) % 24,
      minute: Number(out.minute),
      second: Number(out.second)
    };
  }

  /* Two-pass offset correction: guess the instant, read the zone's
     offset there, correct, re-read. The second pass settles the
     answer across a DST transition. */
  function instantFor(year, month, day, tz) {
    var midnightUtcFields = Date.UTC(year, month - 1, day, 0, 0, 0);
    var guess = midnightUtcFields;
    for (var pass = 0; pass < 2; pass += 1) {
      var p = zonedParts(new Date(guess), tz || TZ);
      var asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
      guess = midnightUtcFields - (asIfUtc - guess);
    }
    return new Date(guess);
  }

  function decompose(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60
    };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* Next occurrence of month/day strictly after `nowMs`. Recomputed
     from scratch every call, so no stored state can go stale. */
  function nextAnnual(month, day, nowMs, tz) {
    var p = zonedParts(new Date(nowMs), tz);
    var candidate = instantFor(p.year, month, day, tz);
    if (candidate.getTime() <= nowMs) {
      candidate = instantFor(p.year + 1, month, day, tz);
    }
    return candidate;
  }

  function milestoneState(milestone, nowMs, tz) {
    var zone = tz || TZ;
    var ms = 0;
    var direction = 'down';

    if (milestone.mode === 'elapsed') {
      var since = instantFor(milestone.anchor.y, milestone.anchor.m, milestone.anchor.d, zone);
      ms = Math.max(0, nowMs - since.getTime());
      direction = 'up';
    } else if (milestone.mode === 'annual') {
      var next = nextAnnual(milestone.anchor.m, milestone.anchor.d, nowMs, zone);
      ms = Math.max(0, next.getTime() - nowMs);
      direction = 'down';
    } else {
      var target = instantFor(milestone.target.y, milestone.target.m, milestone.target.d, zone);
      var delta = target.getTime() - nowMs;
      if (delta > 0) {
        ms = delta;
        direction = 'down';
      } else {
        ms = -delta;
        direction = 'up';
      }
    }

    return {
      ms: ms,
      direction: direction,
      parts: decompose(ms),
      progress: lapProgress(nowMs, zone, milestone.lap)
    };
  }

  /* How far through the current lap we are. Each ring turns at a
     rate that means something: a day, an hour, a minute. */
  function lapProgress(nowMs, tz, lap) {
    var p = zonedParts(new Date(nowMs), tz || TZ);
    if (lap === 'minute') return p.second / 60;
    if (lap === 'hour') return (p.minute * 60 + p.second) / 3600;
    return (p.hour * 3600 + p.minute * 60 + p.second) / 86400;
  }

  function plural(n, word) { return n === 1 ? word : word + 's'; }

  function formatAria(parts) {
    return parts.days + ' ' + plural(parts.days, 'day') + ', ' +
      parts.hours + ' ' + plural(parts.hours, 'hour') + ', ' +
      parts.minutes + ' ' + plural(parts.minutes, 'minute') + ' and ' +
      parts.seconds + ' ' + plural(parts.seconds, 'second');
  }

  return {
    TZ: TZ,
    zonedParts: zonedParts,
    instantFor: instantFor,
    decompose: decompose,
    lapProgress: lapProgress,
    milestoneState: milestoneState,
    formatAria: formatAria,
    pad2: pad2
  };
}));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test qa/clocks-core.test.mjs`
Expected: PASS — 17 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add sections/clocks-core.js qa/clocks-core.test.mjs
git commit -m "feat(clocks): pure date math for the live counters"
```

---

### Task 2: Milestone data and the section shell

Builds the page structure, its styling, and its no-JS/no-WebGL fallback. No ticking yet — the static dates are already true statements, which is the fallback.

**Files:**
- Create: `content/milestones.js`
- Create: `sections/clocks.css`
- Modify: `index.html` (stylesheet link after line 26; section after `#finale`, before `</div><!-- /#content-region -->` around line 1458; script tag after `sections/finale.js`)
- Modify: `js/section-music.js` (ROUTE object, ~line 43)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the DOM contract every later task depends on — `#clocks`, `[data-clocks-canvas]`, `[data-clocks-stage]`, three `[data-milestone]` blocks whose `data-milestone` equals a `window.MILESTONES[].id`, and within each block `[data-unit="days|hours|minutes|seconds"]`, `[data-clocks-label]`, `[data-clocks-sr]`. Also the global `window.MILESTONES` array with fields `{id, label, mode, anchor, target?, lap}`.

- [ ] **Step 1: Write the milestone data**

Create `content/milestones.js`:

```js
/* The three milestones the clocks page counts. Dates are calendar
   dates in Europe/London (see sections/clocks-core.js).

   mode:
     elapsed — counts up from `anchor` forever
     annual  — counts down to the next occurrence of anchor.m/anchor.d,
               rolling to the following year the moment it passes
     until   — counts down to `target`, then flips to counting up

   lap: how long one full turn of that ring takes. Each ring is a
   dial, so its rotation means something rather than decorating. */
window.MILESTONES = [
  {
    id: 'together',
    label: 'us, so far',
    mode: 'elapsed',
    anchor: { y: 2026, m: 8, d: 26 },
    lap: 'day'
  },
  {
    id: 'birthday',
    label: 'your next birthday',
    mode: 'annual',
    anchor: { y: 2026, m: 10, d: 19 },
    lap: 'hour'
  },
  {
    id: 'anniversary',
    label: 'one year of us',
    mode: 'until',
    anchor: { y: 2026, m: 8, d: 26 },
    target: { y: 2027, m: 8, d: 26 },
    lap: 'minute'
  }
];
```

- [ ] **Step 2: Add the section markup**

In `index.html`, insert immediately after the closing `</section>` of `#finale` (line 1458) and before `</div><!-- /#content-region -->`:

```html
<!-- 12. clocks — live counters (post-letter).
     Numbers are DOM text, so they stay readable, selectable and
     accessible; three.js draws only the rings behind them. With
     JS off the anchor dates still tell the truth. -->
<section id="clocks" class="section section--clocks" aria-label="How much time">
  <div class="clocks__track" data-clocks-track>
    <div class="clocks__stage" data-clocks-stage>
      <canvas class="clocks__canvas" data-clocks-canvas aria-hidden="true"></canvas>
      <div class="clocks__ground" aria-hidden="true"></div>
      <div class="clocks__grain" aria-hidden="true"></div>

      <div class="clocks__rings">
        <div class="clocks__ring" data-milestone="together">
          <span class="clocks__hero" data-unit="days">—</span>
          <span class="clocks__sub" aria-hidden="true">
            <span data-unit="hours">--</span><i>:</i><span data-unit="minutes">--</span><i>:</i><span data-unit="seconds">--</span>
          </span>
          <span class="clocks__label" data-clocks-label>us, so far</span>
          <span class="clocks__note">together since 26 august 2026</span>
          <span class="sr-only" data-clocks-sr></span>
        </div>

        <div class="clocks__ring" data-milestone="birthday">
          <span class="clocks__hero" data-unit="days">—</span>
          <span class="clocks__sub" aria-hidden="true">
            <span data-unit="hours">--</span><i>:</i><span data-unit="minutes">--</span><i>:</i><span data-unit="seconds">--</span>
          </span>
          <span class="clocks__label" data-clocks-label>your next birthday</span>
          <span class="clocks__note">19 october, every year</span>
          <span class="sr-only" data-clocks-sr></span>
        </div>

        <div class="clocks__ring" data-milestone="anniversary">
          <span class="clocks__hero" data-unit="days">—</span>
          <span class="clocks__sub" aria-hidden="true">
            <span data-unit="hours">--</span><i>:</i><span data-unit="minutes">--</span><i>:</i><span data-unit="seconds">--</span>
          </span>
          <span class="clocks__label" data-clocks-label>one year of us</span>
          <span class="clocks__note">26 august 2027</span>
          <span class="sr-only" data-clocks-sr></span>
        </div>
      </div>

      <p class="clocks__closer">and it keeps counting</p>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Add the stylesheet and scripts**

In `index.html` line 26, after the finale stylesheet:

```html
<link rel="stylesheet" href="sections/clocks.css?v=clocks1" />
```

At the end of the script block, after `<script src="sections/finale.js"></script>`:

```html
<script src="content/milestones.js?v=clocks1"></script>
<script src="sections/clocks-core.js?v=clocks1"></script>
<script src="sections/clocks.js?v=clocks1"></script>
```

- [ ] **Step 4: Create the stylesheet**

Create `sections/clocks.css`:

```css
/* ============================================================
   clocks — the live counters that close the site.

   Layout: a tall track gives the scroll distance; the stage is
   sticky inside it, so one screen is pinned while the camera
   travels between rings. The rings are stacked vertically (not
   in a circle) because the phone is the primary device and a
   horizontal ring of rings falls outside a portrait field of view.

   The numerals are ordinary DOM text laid over the canvas. When
   the WebGL scene runs it adds .is-live to the stage and takes
   over each ring's transform; without it, the CSS grid below is
   a complete, readable fallback.
   ============================================================ */

.section--clocks {
  position: relative;
  background: var(--color-bg);
  color: var(--color-text, #f5ede4);
}

.clocks__track {
  position: relative;
  height: 300vh;
  height: 300dvh;
}

.clocks__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: grid;
  place-items: center;
}

/* ---- fallback ground (always present, the canvas sits above it) ---- */
.clocks__ground {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 90% at 50% 18%, rgb(240 152 74 / 0.10), transparent 70%),
    radial-gradient(110% 80% at 50% 52%, rgb(255 209 102 / 0.06), transparent 72%),
    radial-gradient(120% 90% at 50% 88%, rgb(255 111 145 / 0.09), transparent 70%);
}

.clocks__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  display: block;
}

.clocks__grain {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.5;
  background-image:
    repeating-linear-gradient(0deg, rgb(255 255 255 / 0.012) 0 1px, transparent 1px 3px);
  mix-blend-mode: overlay;
}

/* ---- the numbers ---- */
.clocks__rings {
  position: relative;
  z-index: 3;
  width: 100%;
  padding: var(--space-6) var(--space-5);
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: var(--space-4);
  align-items: center;
  justify-items: center;
  text-align: center;
}

.clocks__ring {
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  will-change: transform;
}

/* Live mode: the JS positions each block over its ring. */
.clocks__stage.is-live .clocks__ring {
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(-50%, -50%);
  width: min(88vw, 30rem);
}

.clocks__hero {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: clamp(3.2rem, 15vw, 6.5rem);
  line-height: 0.92;
  letter-spacing: -0.03em;
  color: var(--color-text, #f5ede4);
  text-shadow: 0 0 2.4rem rgb(240 152 74 / 0.22);
}

.clocks__ring[data-milestone="birthday"] .clocks__hero {
  text-shadow: 0 0 2.4rem rgb(255 209 102 / 0.22);
}

.clocks__ring[data-milestone="anniversary"] .clocks__hero {
  text-shadow: 0 0 2.4rem rgb(255 111 145 / 0.22);
}

.clocks__sub {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: clamp(0.85rem, 3.4vw, 1.15rem);
  letter-spacing: 0.18em;
  color: rgb(245 237 228 / 0.62);
}

.clocks__sub i { font-style: normal; opacity: 0.45; margin: 0 0.35em; }

.clocks__label {
  font-family: var(--font-display);
  font-style: italic;
  font-size: clamp(0.95rem, 3.6vw, 1.25rem);
  color: rgb(245 237 228 / 0.82);
  margin-top: 0.15rem;
}

.clocks__note {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  letter-spacing: 0.16em;
  text-transform: lowercase;
  color: rgb(245 237 228 / 0.38);
}

.clocks__closer {
  position: absolute;
  bottom: var(--space-8);
  left: 0;
  right: 0;
  z-index: 3;
  text-align: center;
  font-family: var(--font-display);
  font-style: italic;
  font-size: clamp(0.9rem, 3.2vw, 1.1rem);
  color: rgb(245 237 228 / 0.5);
  pointer-events: none;
}

.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 40rem) {
  .clocks__rings { gap: var(--space-2); }
  .clocks__hero { font-size: clamp(2.8rem, 17vw, 4.2rem); }
  .clocks__note { display: none; }
}
```

- [ ] **Step 5: Route the music**

In `js/section-music.js`, inside the `ROUTE` object (after the `finale: 8` line), add:

```js
    clocks: 8
```

and update the `finale: 8` line's trailing comma so the object stays valid.

- [ ] **Step 6: Create the script placeholder**

`sections/clocks.js` is implemented in Task 3, but the `<script>` tag added in
Step 3 would 404 until then. Create it empty now:

```bash
printf '/* implemented in task 3 */\n' > sections/clocks.js
```

- [ ] **Step 7: Verify the shell renders**

```bash
cd /root/halimah-birthday && python3 -m http.server 8911 >/dev/null 2>&1 &
sleep 1
curl -s http://127.0.0.1:8911/index.html | grep -c 'data-milestone='
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8911/sections/clocks.css
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8911/content/milestones.js
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8911/sections/clocks.js
kill %1
```

Expected: `3` (one per ring), `200`, `200`, `200`.

- [ ] **Step 7: Commit**

```bash
git add index.html sections/clocks.css content/milestones.js sections/clocks.js js/section-music.js
git commit -m "feat(clocks): section shell, styling, and no-JS fallback"
```

---

### Task 3: Ticking numerals

Makes the numbers live and correct. Still no WebGL — this is the version that must be perfect, because it is the fallback every WebGL-less device gets.

**Files:**
- Modify: `sections/clocks.js` (currently a placeholder)

**Interfaces:**
- Consumes: `window.ClocksMath` (Task 1), `window.MILESTONES` (Task 2), the DOM contract from Task 2.
- Produces: `window.ClocksPage` with `{ start(), stop(), tickNow(nowMs) }`. Task 4 uses `tickNow` as the scene's clock source and `window.ClocksPage.rings` — an array of `{ id, el, worldY }` — to place the meshes.

- [ ] **Step 1: Write the implementation**

Replace `sections/clocks.js`:

```js
/* ============================================================
   clocks — the live counters that close the site.

   Numbers are DOM text; three.js (added in the next task) draws
   only the rings behind them. This file owns the truth:

   - Every frame recomputes from Date.now(). Nothing is
     accumulated, so a phone that slept for six hours shows the
     correct value on its first frame back.
   - The loop only runs while the section is on screen and the
     document is visible.
   - With no WebGL the numbers still tick, over the CSS ground.
   ============================================================ */
(function () {
  'use strict';

  var M = window.ClocksMath;
  if (!M) return;

  var srTickAt = 0;         /* last minute boundary written to .sr-only */
  var section = null;
  var stage = null;
  var blocks = [];
  var running = false;
  var rafId = 0;

  function readBlocks() {
    var out = [];
    var nodes = document.querySelectorAll('#clocks [data-milestone]');
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      var id = el.getAttribute('data-milestone');
      var milestone = null;
      for (var j = 0; j < window.MILESTONES.length; j += 1) {
        if (window.MILESTONES[j].id === id) { milestone = window.MILESTONES[j]; break; }
      }
      if (!milestone) continue;
      out.push({
        id: id,
        el: el,
        milestone: milestone,
        days: el.querySelector('[data-unit="days"]'),
        hours: el.querySelector('[data-unit="hours"]'),
        minutes: el.querySelector('[data-unit="minutes"]'),
        seconds: el.querySelector('[data-unit="seconds"]'),
        sr: el.querySelector('[data-clocks-sr]'),
        worldY: 0
      });
    }
    return out;
  }

  function paint(block, state) {
    var p = state.parts;
    if (block.days) block.days.textContent = String(p.days);
    if (block.hours) block.hours.textContent = M.pad2(p.hours);
    if (block.minutes) block.minutes.textContent = M.pad2(p.minutes);
    if (block.seconds) block.seconds.textContent = M.pad2(p.seconds);
  }

  function paintAria(block, state) {
    if (!block.sr) return;
    block.sr.textContent = M.formatAria(state.parts) + ' ' +
      (state.direction === 'up' ? 'and counting' : 'to go');
  }

  /* Recompute everything for `nowMs`. Exposed so the scene loop
     can drive the numbers from the same clock it animates. */
  function tickNow(nowMs) {
    var states = [];
    for (var i = 0; i < blocks.length; i += 1) {
      var state = M.milestoneState(blocks[i].milestone, nowMs, M.TZ);
      paint(blocks[i], state);
      states.push(state);
    }
    /* The screen-reader sentence changes once a minute, not once a
       second — announcing a number every tick is hostile. */
    if (nowMs - srTickAt >= 60000) {
      srTickAt = nowMs;
      for (var k = 0; k < blocks.length; k += 1) paintAria(blocks[k], states[k]);
    }
    return states;
  }

  function frame() {
    if (!running) return;
    tickNow(Date.now());
    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function boot() {
    section = document.getElementById('clocks');
    if (!section || !window.MILESTONES) return;
    stage = section.querySelector('[data-clocks-stage]');
    blocks = readBlocks();
    if (!blocks.length) return;

    tickNow(Date.now());

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i += 1) {
          if (entries[i].isIntersecting) start(); else stop();
        }
      }, { rootMargin: '100%' });
      io.observe(section);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); } else { tickNow(Date.now()); start(); }
    });

    window.ClocksPage = {
      rings: blocks,
      stage: stage,
      section: section,
      tickNow: tickNow,
      start: start,
      stop: stop,
      M: M
    };

    window.dispatchEvent(new CustomEvent('clocks:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
```

- [ ] **Step 2: Verify the numbers appear and advance**

```bash
cd /root/halimah-birthday && python3 -m http.server 8912 >/dev/null 2>&1 &
sleep 1
node -e "
const { chromium } = require('/usr/lib/node_modules/playwright');
" 2>/dev/null || echo "playwright resolution deferred to qa harness"
kill %1
```

Browser verification happens in Task 5's harness. At this step, confirm the file parses and the math it depends on is sound:

Run: `node --check sections/clocks.js`
Expected: no output (success).

Run: `node -e "global.window={}; require('./sections/clocks-core.js'); console.log(typeof window.ClocksMath.milestoneState)"`
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add sections/clocks.js
git commit -m "feat(clocks): wall-clock tick loop with minute-granularity a11y text"
```

---

### Task 4: The WebGL rings

Adds the three rings behind the numbers. Every failure path leaves Task 3's numbers intact.

**Files:**
- Modify: `sections/clocks.js` (append a scene module and call it from `boot`)

**Interfaces:**
- Consumes: `window.ClocksPage` from Task 3 (`.rings`, `.stage`, `.section`, `.tickNow`), `window.THREE`.
- Produces: nothing consumed by later tasks. Sets `data-webgl="on|off"` on `#clocks` for QA.

- [ ] **Step 1: Append the scene**

Add before the closing `}());` of `sections/clocks.js` — replace the final `}());` with the scene code followed by it:

```js
  /* ------------------------------------------------------------
     Scene: three rings, stacked vertically.
     ------------------------------------------------------------
     Each ring turns at a rate that means something (a day, an
     hour, a minute) and carries an arc showing how far through
     that lap we are. The camera travels down the stack with
     scroll. The DOM numerals ride on top, positioned by
     projecting each ring's world position to screen space.

     Every exit path here leaves the numbers ticking: if WebGL is
     unavailable, or the context is lost, the canvas is hidden and
     the CSS ground stays. */

  var RING_Y = [2.1, 0, -2.1];
  var RING_COLOR = [0xf0984a, 0xffd166, 0xff6f91];
  var CAMERA_Z = 7.4;
  var FOV = 42;

  var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform float uProgress;',
    'uniform float uTime;',
    'uniform vec3  uColor;',
    'uniform float uOpacity;',
    'const float TAU = 6.28318530718;',
    'void main() {',
    '  vec2 p = vUv * 2.0 - 1.0;',
    '  float r = length(p);',
    '  float a = atan(p.x, p.y);',          /* 0 at top, clockwise */
    '  if (a < 0.0) a += TAU;',
    '  float ang = a / TAU;',
    /* the annulus */
    '  float band = smoothstep(0.62, 0.68, r) * (1.0 - smoothstep(0.94, 1.0, r));',
    /* the travelled arc, trailing edge softened */
    '  float travelled = step(ang, uProgress);',
    '  float arc = band * mix(0.10, 0.55, travelled);',
    /* tick marks every 1/60 of the lap */
    '  float tick = step(0.992, fract(ang * 60.0)) * band;',
    '  vec3 col = uColor * (0.55 + arc * 1.6 + tick * 1.1);',
    '  float alpha = (band * 0.20 + arc * 0.75 + tick * 0.55) * uOpacity;',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  function createScene(page) {
    var THREE = window.THREE;
    if (!THREE) return false;

    var canvas = page.section.querySelector('[data-clocks-canvas]');
    var stage = page.stage;
    if (!canvas || !stage) return false;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, RING_Y[0], CAMERA_Z);

    var ringGeo = new THREE.RingGeometry(0.62, 1.0, 128, 1);
    var meshes = [];

    for (var i = 0; i < RING_Y.length; i += 1) {
      var mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(RING_COLOR[i]) },
          uOpacity: { value: 1 }
        }
      });
      var mesh = new THREE.Mesh(ringGeo, mat);
      mesh.position.set(0, RING_Y[i], 0);
      mesh.rotation.x = -0.34;
      scene.add(mesh);
      meshes.push(mesh);
    }

    /* Dust: bounded to the section, additive, quiet. */
    var dustCount = 420;
    var dustPos = new Float32Array(dustCount * 3);
    for (var d = 0; d < dustCount; d += 1) {
      dustPos[d * 3] = (Math.random() - 0.5) * 16;
      dustPos[d * 3 + 1] = (Math.random() - 0.5) * 14;
      dustPos[d * 3 + 2] = -6 - Math.random() * 10;
    }
    var dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    var dustMat = new THREE.PointsMaterial({
      color: 0xffd8b0, size: 0.035, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    var dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    /* ---- sizing ---- */
    function resize() {
      var w = stage.clientWidth;
      var h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    /* ---- scroll progress across the track ---- */
    var track = page.section.querySelector('[data-clocks-track]');
    var progress = 0;
    function readProgress() {
      if (!track) return;
      var rect = track.getBoundingClientRect();
      var travel = rect.height - window.innerHeight;
      if (travel <= 0) { progress = 0; return; }
      progress = Math.min(1, Math.max(0, -rect.top / travel));
    }
    readProgress();
    window.addEventListener('scroll', readProgress, { passive: true });

    /* ---- pointer parallax (additive, coarse pointers ignore it) ---- */
    var pointer = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', function (e) {
        target.x = (e.clientX / window.innerWidth - 0.5) * 2;
        target.y = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    /* ---- projected numeral anchors ---- */
    var sizes = { w: 1, h: 1 };
    var v = new THREE.Vector3();

    /* Camera and numerals share one projection pass: set the pose,
       update the matrices, then project. */
    function placeNumerals() {
      camera.updateMatrixWorld();
      for (var i = 0; i < meshes.length; i += 1) {
        v.copy(meshes[i].position).project(camera);
        var x = (v.x * 0.5 + 0.5) * sizes.w;
        var y = (-v.y * 0.5 + 0.5) * sizes.h;
        var block = page.rings[i];
        if (!block || !block.el) continue;
        block.el.style.transform =
          'translate(-50%, -50%) translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)';
      }
    }

    /* ---- loop ---- */
    var live = false;
    var sceneRaf = 0;
    var damping = 0.055;
    var lastT = 0;
    var placed = false;

    function render(now) {
      if (!live) return;
      var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
      lastT = now;

      /* refresh-rate-correct damping */
      var k = 1 - Math.pow(1 - damping, dt * 60);
      pointer.x += (target.x - pointer.x) * k;
      pointer.y += (target.y - pointer.y) * k;

      readProgress();

      sizes.w = stage.clientWidth;
      sizes.h = stage.clientHeight;

      /* camera travels down the stack */
      var focusY = RING_Y[0] + (RING_Y[RING_Y.length - 1] - RING_Y[0]) * progress;
      var eyeY = focusY - pointer.y * 0.25;
      camera.position.x = pointer.x * 0.45;
      camera.position.y = eyeY;
      camera.lookAt(0, focusY, 0);

      var states = page.tickNow(Date.now());
      for (var i = 0; i < meshes.length; i += 1) {
        var u = meshes[i].material.uniforms;
        u.uTime.value = now / 1000;
        u.uProgress.value = states[i] ? states[i].progress : 0;
        meshes[i].rotation.z = -0.35 * progress + i * 0.18;
      }
      dust.rotation.y = now / 90000;

      placeNumerals();
      renderer.render(scene, camera);
      sceneRaf = window.requestAnimationFrame(render);
    }

    function startScene() {
      if (live) return;
      live = true;
      stage.classList.add('is-live');
      page.section.setAttribute('data-webgl', 'on');
      lastT = 0;
      sceneRaf = window.requestAnimationFrame(render);
    }

    function stopScene() {
      live = false;
      if (sceneRaf) window.cancelAnimationFrame(sceneRaf);
      sceneRaf = 0;
    }

    /* stop the scene when the section leaves the viewport */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i += 1) {
          if (entries[i].isIntersecting) startScene(); else stopScene();
        }
      }, { rootMargin: '50%' });
      io.observe(page.section);
    } else {
      startScene();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopScene(); else startScene();
    });

    /* context loss: hide the canvas, keep the numbers */
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      stopScene();
      stage.classList.remove('is-live');
      page.section.setAttribute('data-webgl', 'off');
      canvas.style.display = 'none';
    });

    window.addEventListener('pagehide', function () {
      stopScene();
      ringGeo.dispose();
      for (var i = 0; i < meshes.length; i += 1) meshes[i].material.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
    });

    startScene();
    return true;
  }
```
```

Then, inside `boot()`, after `window.ClocksPage = {...}` and before `window.dispatchEvent(...)`, add:

```js
    if (!createScene(window.ClocksPage)) {
      section.setAttribute('data-webgl', 'off');
      canvasFallback();
    }
```

and add this helper next to `boot`:

```js
  function canvasFallback() {
    var canvas = section.querySelector('[data-clocks-canvas]');
    if (canvas) canvas.style.display = 'none';
  }
```

Note: `createScene` and the constants must be declared before `boot` runs. Place the whole scene block above the `function boot()` definition. `boot` is called from the bottom of the IIFE, so declaration order is satisfied.

- [ ] **Step 2: Check it parses**

Run: `node --check sections/clocks.js`
Expected: no output.

- [ ] **Step 3: Verify the fallback path still works without WebGL**

Run the Task 5 harness in `nowebgl` mode once it exists (Task 5). At this step, confirm by reading: every `return false` from `createScene` is followed by `canvasFallback()`, which only hides the canvas and never touches the numbers.

- [ ] **Step 4: Commit**

```bash
git add sections/clocks.js
git commit -m "feat(clocks): three-ring WebGL stage with projected numerals"
```

---

### Task 5: Browser QA and final verification

**Files:**
- Create: `qa/task-24-clocks.mjs`

**Interfaces:**
- Consumes: everything above. Run with `node qa/task-24-clocks.mjs [happy|nowebgl|nojs]`.

- [ ] **Step 1: Write the harness**

Follow the conventions in `qa/task-12-finale.mjs` exactly: in-process static server, sha256 build hash logged first, real page state only, everything closed before exit. Create `qa/task-24-clocks.mjs`:

```js
// Task-24 browser QA: the clocks page — live counters, rollover,
// WebGL-less fallback, no-JS fallback, and clean release from the
// pinned track.
//
// Usage: node qa/task-24-clocks.mjs [happy|nowebgl|nojs]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globSync } from 'node:fs';

const pw = await (async () => {
  const pick = (m) => (m && m.chromium ? m : m && m.default ? m.default : null);
  try { return pick(await import('playwright')); } catch {}
  for (const hit of globSync('/home/vibex/.npm/_npx/*/node_modules/playwright/index.js')) {
    try { const m = pick(await import(pathToFileURL(hit).href)); if (m) return m; } catch {}
  }
  throw new Error('playwright not found');
})();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'happy';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.webp': 'image/webp', '.mp4': 'video/mp4'
};

let failures = 0;
const say = (s = '') => console.log(s);
const assert = (cond, label, detail = '') => {
  if (!cond) failures += 1;
  say(`[${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = join(root, normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const hash = createHash('sha256');
for (const f of ['index.html', 'sections/clocks.js', 'sections/clocks.css',
                 'sections/clocks-core.js', 'content/milestones.js']) {
  hash.update(await readFile(join(root, f)));
}
say(`# build sha256 = ${hash.digest('hex').slice(0, 16)}`);
say(`# mode = ${mode}`);

const browser = await pw.chromium.launch();

// Shifted clock: real time offset so "now" is 2027-01-15T12:00:00Z at
// load. Shifted rather than frozen so the seconds still advance — the
// counters must be driven by the clock, and still move.
const clockScript = `(() => {
  const RealDate = Date;
  const OFFSET = RealDate.parse('2027-01-15T12:00:00Z') - RealDate.now();
  function FakeDate(...a) {
    return a.length === 0 ? new RealDate(RealDate.now() + OFFSET) : new RealDate(...a);
  }
  FakeDate.now = () => RealDate.now() + OFFSET;
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  FakeDate.prototype = RealDate.prototype;
  window.Date = FakeDate;
})();`;

const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  javaScriptEnabled: mode !== 'nojs'
});
if (mode !== 'nojs') await ctx.addInitScript(clockScript);
if (mode === 'nowebgl') {
  await ctx.addInitScript(`(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).indexOf('webgl') === 0) return null;
      return orig.call(this, type, ...rest);
    };
  })();`);
}

const page = await ctx.newPage();
const consoleErrors = [];
const httpFailures = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) httpFailures.push(r.status() + ' ' + r.url()); });

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

if (mode !== 'nojs') {
  try {
    await page.click('#begin-button', { timeout: 4000 });
    await page.waitForTimeout(1200);
  } catch { say('# begin click skipped'); }
}

// Scroll to the clocks section.
const scrolled = await page.evaluate(() => {
  const el = document.getElementById('clocks');
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, top + 10);
  return true;
});
assert(scrolled, 'clocks section exists');
await page.waitForTimeout(900);

if (mode === 'nojs') {
  const text = await page.evaluate(() => {
    const el = document.getElementById('clocks');
    return el ? el.textContent : '';
  });
  assert(/26 august 2026/i.test(text), 'no-JS shows the together anchor');
  assert(/19 october/i.test(text), 'no-JS shows the birthday anchor');
  assert(/26 august 2027/i.test(text), 'no-JS shows the anniversary anchor');
} else {
  const first = await page.evaluate(() => {
    const r = document.querySelector('#clocks [data-milestone="together"]');
    return {
      days: r.querySelector('[data-unit="days"]').textContent,
      secs: r.querySelector('[data-unit="seconds"]').textContent,
      birthdayDays: document.querySelector('#clocks [data-milestone="birthday"] [data-unit="days"]').textContent,
      annivDays: document.querySelector('#clocks [data-milestone="anniversary"] [data-unit="days"]').textContent,
      webgl: document.getElementById('clocks').getAttribute('data-webgl')
    };
  });
  say(`# sample ${JSON.stringify(first)}`);

  assert(first.days !== '—' && first.days !== '', 'together shows a number', first.days);
  // 26 Aug 2026 00:00 London -> 15 Jan 2027 12:00Z = 142 days
  assert(Number(first.days) === 142, 'together days correct at the shifted clock', first.days);
  // 15 Jan 2027 12:00Z -> 19 Oct 2027 00:00 London = 276 days
  assert(Number(first.birthdayDays) === 276, 'birthday days correct', first.birthdayDays);
  // 15 Jan 2027 12:00Z -> 26 Aug 2027 00:00 London = 222 days
  assert(Number(first.annivDays) === 222, 'anniversary days correct', first.annivDays);

  await page.waitForTimeout(1600);
  const second = await page.evaluate(() =>
    document.querySelector('#clocks [data-milestone="together"] [data-unit="seconds"]').textContent);
  assert(second !== first.secs, 'seconds advance', `${first.secs} -> ${second}`);

  if (mode === 'nowebgl') {
    assert(first.webgl === 'off', 'no-WebGL sets data-webgl="off"');
    assert(first.days === '142', 'counters still correct without WebGL');
  }
}

// Release from the pinned track: past the section, the next element
// must not be overlapped by a stuck sticky stage.
const release = await page.evaluate(() => {
  const el = document.getElementById('clocks');
  if (!el) return null;
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + el.offsetHeight + 200);
  return new Promise((resolve) => setTimeout(() => {
    const stage = el.querySelector('[data-clocks-stage]');
    const r = stage.getBoundingClientRect();
    resolve({ stageBottom: r.bottom, viewport: window.innerHeight });
  }, 400));
});
if (release) {
  assert(release.stageBottom <= release.viewport + 2,
    'sticky stage releases after the track', JSON.stringify(release));
}

assert(httpFailures.length === 0, 'no HTTP >= 400', httpFailures.slice(0, 3).join(', '));
assert(consoleErrors.length === 0, 'no console/page errors', consoleErrors.slice(0, 3).join(' | '));

await ctx.close();
await browser.close();
server.close();

say(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run the unit tests**

Run: `node --test qa/clocks-core.test.mjs`
Expected: PASS — 17 tests.

- [ ] **Step 3: Run the browser QA in all three modes**

```bash
node qa/task-24-clocks.mjs happy
node qa/task-24-clocks.mjs nowebgl
node qa/task-24-clocks.mjs nojs
```

Expected: `ALL PASS` in all three. If `happy` reports `data-webgl="off"`, this box's headless Chromium has no WebGL — that is expected here; the numbers must still be correct, and the ring rendering is confirmed on the phone.

- [ ] **Step 4: Commit**

```bash
git add qa/task-24-clocks.mjs
git commit -m "test(clocks): browser QA for counters, fallbacks, and track release"
```

- [ ] **Step 5: Ship**

```bash
git push origin master
```

Then verify the deployed files:

```bash
curl -s https://akashthemagnificent-ux.github.io/halimah-birthday/index.html | grep -c 'id="clocks"'
curl -s -o /dev/null -w '%{http_code}\n' https://akashthemagnificent-ux.github.io/halimah-birthday/sections/clocks-core.js
```

Expected: `1` and `200`.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §4 data model, three modes | Task 1 (`milestoneState`), Task 2 (`content/milestones.js`) |
| §4 decomposition | Task 1 (`decompose` + tests) |
| §5 structure | Task 2 |
| §6 scene, rings, dust, camera, palette | Task 4 |
| §6 DOM numerals by projection | Task 4 (`placeNumerals`) |
| §7 wall-clock ticking, IO gating, teardown | Task 3 (tick), Task 4 (scene teardown) |
| §8 fallbacks | Task 2 (no-JS markup), Task 4 (`canvasFallback`), Task 5 (modes) |
| §9 accessibility | Task 3 (`paintAria` at minute granularity) |
| §10 files touched | Tasks 1–5 |
| §11 testing | Task 1 (unit) + Task 5 (browser) |
| §12 out of scope | Global Constraints |

**Placeholders:** none. Every code step contains runnable code. The one
deliberate stub is the empty `sections/clocks.js` in Task 2 Step 6, which
exists only to keep the page free of a 404 until Task 3 fills it.

**Type consistency:** `milestoneState` returns `{ms, direction, parts, progress}` and is consumed identically in Task 3 (`paint`, `paintAria`) and Task 4 (`states[i].progress`). `ClocksPage.rings` is `[{id, el, milestone, days, hours, minutes, seconds, sr, worldY}]`; Task 4 reads `.el` and indexes by ring order, which matches `readBlocks()` order and `meshes` order.

**Review Focus coverage:** (1) clock-driven correctness and advancing seconds, Task 5; (2) anniversary flip, Task 1 unit tests; (3) annual rollover + DST stepping, Task 1 unit tests; (4) no-WebGL, Task 5 `nowebgl`; (5) no-JS, Task 5 `nojs`; (6) sticky release, Task 5.

**Known limitation:** `Review Focus` item 1 (phone sleeps then wakes) is proven structurally — every frame recomputes from `Date.now()` and nothing is accumulated — but not simulated in the harness. A page-level `waitForTimeout` cannot background a tab the way a real phone does.
