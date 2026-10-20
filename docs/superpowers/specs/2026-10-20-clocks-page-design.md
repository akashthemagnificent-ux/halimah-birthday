# Clocks page — design spec

**Date:** 2026-10-20
**Status:** approved design, awaiting implementation plan
**Section id:** `#clocks`

## 1. Intent

Add a final page to the site: a live clock room that keeps counting after the
love letter ends. Three milestones tick in real time — time together, time
until her next birthday, time until the one-year anniversary — rendered in a
WebGL scene rather than as flat text.

The page sits **after `#finale`**, so the site ends on something still in
motion rather than on a closed letter.

Success looks like: she scrolls past the letter, lands in a dark room with three
rings turning, reads one large number per ring with smaller units beneath, and
can see the seconds moving. Nothing on the page is a number that could be wrong
because a tab slept, a timezone shifted, or a year rolled over.

## 2. Confirmed decisions

| Question | Answer |
|---|---|
| Placement | After the letter — `#clocks` directly follows `#finale` |
| 3D concept | Three orbiting rings, one per counter |
| Number layout | Hero unit large (days), sub-units (hh mm ss) small beneath |
| Scroll | One pinned screen; camera moves between rings |
| "Together since" | 26 August 2026 |
| Next birthday | 19 October 2027 |

Time zone for day boundaries: **Europe/London**, matching `js/begin.js:4`.

## 3. Sources evaluated

Two sites were suggested as component sources. Neither is used directly:

- **vgpu.sh** — WebGPU (WGSL) library with a build step and CLI. This site is
  WebGL2 via three.js r160 UMD with no bundler and no build. Adopting it means
  a second graphics pipeline and a build system, for one page. **Rejected.**
- **21st.dev** — React/Tailwind/shadcn components. The site is vanilla
  `<script>` with no React and no Tailwind. Components would need rewriting from
  scratch. **Rejected.**

What *is* used from `mengto/skills` is the discipline, not code:
`build-threejs-scroll-worlds` (one persistent world, normalized scroll state),
`build-awwwards-quality-sites` (canvas subordinate to content, static fallback,
disposal), `add-mouse-driven-orbit` (refresh-rate-correct damping), and
`ambient-section-particles` (bounded atmosphere, cheap renderer).

## 4. Data model

New file `content/milestones.js`, following the shape of
`content/quotes-manifest.js` — a plain script assigning a global.

```js
window.MILESTONES = [
  { id: 'together',    label: 'us, so far',
    anchor: { y: 2026, m: 8, d: 26 },  mode: 'elapsed' },
  { id: 'birthday',    label: 'your next birthday',
    anchor: { y: 2026, m: 10, d: 19 }, mode: 'annual' },
  { id: 'anniversary', label: 'one year of us',
    anchor: { y: 2026, m: 8, d: 26 },  mode: 'until',
    target: { y: 2027, m: 8, d: 26 } }
];
```

Three modes, one implementation each:

- **`elapsed`** — milliseconds since the anchor instant, counting up forever.
- **`annual`** — the next occurrence of `m/d` strictly after "now". Recomputed
  from the date each tick, so after 19 October passes it targets the following
  year with no stored state and no rollover bug.
- **`until`** — counts down to `target`; on reaching zero it switches to
  counting **up** from `target`. The page never displays a negative duration.

Anchors are calendar dates in Europe/London, converted to instants with the
two-pass offset resolution already proven in `js/begin.js:55` (`targetInstant`).
That function is copied into the new module — `begin.js` is not modified, since
it is on the unlock critical path.

### Duration decomposition

Same split as `renderCountdown` in `js/begin.js:70`:

```
totalSeconds = floor(ms / 1000)
days    = floor(totalSeconds / 86400)
hours   = floor((totalSeconds % 86400) / 3600)
minutes = floor((totalSeconds % 3600) / 60)
seconds = totalSeconds % 60
```

Days are unbounded (never wrapped into months/years). "364 days" reads better
than "0 years, 11 months, 30 days", and it avoids a month-length rule that
would be wrong once a year.

## 5. Structure

```
#clocks (section, inside #content-region)
├── .clocks__track            ~300dvh — provides scroll distance
│   └── .clocks__stage        position: sticky; top: 0; height: 100dvh
│       ├── canvas[data-clocks-canvas]     z0, aria-hidden
│       ├── .clocks__grain / .clocks__vignette  z1, aria-hidden
│       ├── .clocks__ring × 3 (DOM numeral blocks)  z2
│       │   ├── .clocks__hero      <span data-unit="days">
│       │   ├── .clocks__sub       hh mm ss
│       │   └── .clocks__label     "us, so far"
│       └── .clocks__sr            .sr-only sentence, updated 1×/minute
└── .clocks__marker           "still counting" (chapter-marker styling)
```

The marker uses the existing `.bday-marker` treatment (small caps label in a
corner) but carries no chapter number — the numbered markers are not used
consistently across the site, so inventing one here would imply an ordering
that does not exist.

DOM numeral blocks are **positioned by projecting a 3D anchor per ring per
frame** (`Vector3.project` → CSS transform). No `getBoundingClientRect()` inside
the loop, no per-frame layout reads.

## 6. Scene

**Renderer:** `WebGLRenderer` over the existing `vendor/three.min.js` (r160 UMD),
`antialias: true`, `alpha: true`, `setPixelRatio(min(dpr, 1.75))`,
`outputColorSpace = THREE.SRGBColorSpace`.

**Per ring:**

- `RingGeometry` annulus, `ShaderMaterial`, transparent, `depthWrite: false`.
- Uniforms: `uProgress` (0–1), `uColor`, `uTime`, `uOpacity`.
- The shader draws tick marks plus an arc from the top, so the ring is a dial:

  | Ring | Lap | Meaning |
  |---|---|---|
  | us, so far | 1 per day | fraction of the current day elapsed |
  | next birthday | 1 per hour | 60-minute dial |
  | one year of us | 1 per minute | 60-second dial, visible motion |

- Rings are static geometry; only uniforms change per frame.

**Composition:** three rings **stacked vertically** in world space
(y = +2.1, 0, −2.1), each tilted back slightly to face the camera. A vertical
stack is deliberate: the phone is the primary device, and a horizontal circle
of rings would fall outside the narrow field of view in portrait. Ring outer
radius 1.0; at camera distance 7.4 (fov 42°) the cluster spans 5.2 vertically
against 5.5 of visible height and 2.0 horizontally against 2.44 of visible
width at a 390×844 viewport — it fits on the narrow axis with margin.
One `Points` dust field behind them, `AdditiveBlending`, slowly drifting.

**Camera:** rides scroll progress `p` = 0→1 across the track, travelling down
the stack from the "us" ring to the anniversary ring, looking at a focus height
that lerps between them. Eased, not linear. Pointer parallax adds a shallow
additive offset on top (coarse pointers keep the authored pose).

**Palette:**

| Ring | Accent |
|---|---|
| us, so far | `#f0984a` |
| next birthday | `#ffd166` |
| one year of us | `#ff6f91` |

Ground `#1a1410`, matching `--color-bg` in `tokens.css`. Numerals in
`--font-mono` with `font-variant-numeric: tabular-nums` so digits do not
shift width as they change.

## 7. Ticking and lifecycle

- **Wall-clock driven.** Every frame recomputes from `Date.now()`; nothing is
  accumulated. A tab backgrounded for 40 minutes resumes with the correct
  value on the first frame back.
- **Runs only when seen.** `IntersectionObserver` (rootMargin `100%`) starts
  and stops the frame loop. `document.hidden` stops rAF too.
- **Immediate recompute** on `visibilitychange` and on `scroll` (passive).
- **Teardown** on `pagehide`: cancel rAF, disconnect observer, remove
  listeners, dispose geometries, materials, textures, renderer.
- **DPR capped at 1.75.** The dust field is bounded to the section.

## 8. Fallbacks

| Failure | Result |
|---|---|
| No WebGL / context lost | Canvas hidden via `display: none`; numerals tick over a CSS radial-gradient ground. Counters remain fully correct. |
| JS disabled | Anchor dates render as static text: "together since 26 august 2026", "next birthday 19 october", "one year of us, 26 august 2027". Never stale, never blank. |
| WebGL context loss mid-session | Listen for `webglcontextlost`; fall back to the CSS ground and stop rendering. Content untouched. |

`prefers-reduced-motion` is deliberately **not** gated, matching
`js/motion.js` (owner directive) and `sections/bg-orb.js`. Noted in the spec so
it is a decision rather than an oversight; easy to revisit.

## 9. Accessibility

- Visible ticking digits are `aria-hidden="true"`.
- One `.sr-only` sentence carries the meaning: *"55 days, 7 hours and 42
  minutes together."* Updated **once per minute**, not per second.
- No `aria-live` on the digits — announcing a number every second is hostile.
- The section has an `aria-label`; each ring is a labelled group.
- Contrast: accent numerals on `#1a1410` all exceed 4.5:1.

## 10. Files touched

| File | Change |
|---|---|
| `content/milestones.js` | new — the three milestone definitions |
| `sections/clocks.js` | new — date math, tick loop, three.js scene, DOM positioning |
| `sections/clocks.css` | new — layout, sticky stage, numerals, fallback ground |
| `index.html` | one `<section id="clocks">` after `#finale`; `<link>` + 2 `<script>` tags, all cache-busted |
| `js/section-music.js` | one line in `ROUTE` for the new page |
| `qa/task-24-clocks.mjs` | new — Playwright QA, matching `qa/task-12-finale.mjs` conventions |

Music: the page inherits the finale's track (`finale: 8`). `ROUTE` must gain the
new id or the director treats it as unknown. Decision: **`clocks: 8`**, so the
last song carries through both closing pages without restarting.

## 11. Testing

Following the existing `qa/*.mjs` harness (in-process static server, sha256
build hash logged first, real page state only, full cleanup).

Date math is the highest-risk surface, so it is tested hardest, using an
injected clock rather than waiting for real time to pass:

1. **Decomposition** — known instant → exact d/h/m/s.
2. **Annual rollover** — 20 Oct 2026 targets 2027; after 19 Oct 2027 00:00
   London it targets 2028, with no stored state.
3. **DST** — anchors resolve to the correct London instant on both sides of
   the BST/GMT switch.
4. **Anniversary flip** — before 26 Aug 2027 it counts down; after, it counts
   up; it never renders a negative duration.
5. **Leap-day safety** — no crash when 29 February falls between anchor and
   target.
6. **Seconds advance** — two samples 1.5 s apart differ.
7. **Fallback** — with WebGL forced unavailable, counters still tick.
8. **No-JS** — anchor dates present in static HTML.
9. **Clean run** — zero console errors, zero page errors, zero HTTP ≥ 400.

Static verification on this machine is limited: headless Chromium here has no
WebGL, so the 3D scene itself is verified by code review plus the fallback path,
and visually confirmed on the phone.

## 12. Explicitly out of scope

- No new dependencies, no bundler, no npm install.
- No changes to `js/begin.js`, the unlock gate, or any existing section.
- No lunisolar or cultural calendar handling — Gregorian dates only.
- No "years/months" decomposition. Days only, per §4.
- No editing of the letter or its text.
