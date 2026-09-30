/* ============================================================
   halimah-birthday — Motion system (todo 14)
   The ONE confetti entry point + the global motion kill-switch.

   Rules this file enforces:
   - No motion before the first user gesture. Every cannon here
     fires only from a tap handler (begin tap, countdown unlock
     which itself follows the begin tap, finale unseal tap, or the
     opt-in replay button). Nothing runs on load, on DOMContentLoaded,
     or on a timer.
   - prefers-reduced-motion is a kill-switch: when set, every cannon
     is a no-op (zero confetti calls) and hasGsap() reports false so
     section scripts stay in their static layouts.
   - Exactly one fireworks entry: staged dual cannons with token
     colors (autumn-warm from tokens.css). begin.js and finale.js
     call into this module; they never touch window.confetti directly.
   - No infinite loops: cannons are a bounded volley (3 volleys max),
     then stop. Looping CSS keyframes live in section stylesheets and
     are all killed under prefers-reduced-motion there.

   Progressive enhancement: if canvas-confetti fails to load,
   fire() resolves false and the caller carries on silently.
   ============================================================ */
(function () {
  'use strict';

  var PALETTE = ['#e07c3e', '#f0984a', '#c9956b', '#f5ebe0', '#7dba6a'];
  var FINALE_PALETTE = ['#e07c3e', '#f0984a', '#c9956b', '#f5ebe0', '#d4a86a'];

  var reduceMotionQuery = null;
  try {
    reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  } catch (err) {
    reduceMotionQuery = null;
  }

  function prefersReducedMotion() {
    try {
      if (reduceMotionQuery) return reduceMotionQuery.matches;
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (err) {
      return false;
    }
  }

  // Global kill-switch. False when reduced-motion is set: section scripts
  // check this before arming ANY animation (GSAP timelines, tweens,
  // canvas loops, staggered reveals).
  function motionAllowed() {
    return !prefersReducedMotion();
  }

  function confettiReady() {
    return typeof window.confetti === 'function';
  }

  // Single-shot particle burst (begin tap). Bounded: one call, then done.
  function burst(options) {
    if (!motionAllowed() || !confettiReady()) return false;
    var opts = options || {};
    window.confetti({
      particleCount: opts.particleCount || 90,
      spread: opts.spread || 78,
      origin: opts.origin || { y: 0.7 },
      colors: PALETTE
    });
    return true;
  }

  // Staged dual cannons (countdown unlock, finale unseal, replay).
  // Bounded: 3 volleys (t=0, 350ms, 700ms), then silence. No loop.
  function fireworks(options) {
    if (!motionAllowed() || !confettiReady()) return false;
    var opts = options || {};
    var colors = opts.colors || FINALE_PALETTE;
    var count = opts.particleCount || 70;
    var shoot = function () {
      window.confetti({
        particleCount: count,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.7 },
        colors: colors
      });
      window.confetti({
        particleCount: count,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.7 },
        colors: colors
      });
    };
    shoot();
    window.setTimeout(shoot, 350);
    window.setTimeout(shoot, 700);
    return true;
  }

  // GSAP discipline: sections may only build timelines when the visitor
  // allows motion AND arrived via gesture AND GSAP actually loaded.
  // GSAP is lazy-loaded (see the LAZY_SECTIONS loader in index.html),
  // so hasGsap() is false until the section's IntersectionObserver entry
  // fires — never on first paint.
  function hasGsap() {
    if (!motionAllowed()) return false;
    return (
      typeof window.gsap !== 'undefined' &&
      typeof window.ScrollTrigger !== 'undefined'
    );
  }

  // Opt-in confetti replay button. The button lives in the finale
  // keepsakes list (data-motion-replay); hidden entirely when motion is
  // disallowed so reduced-motion visitors never see a dead control.
  // Wires exactly once; safe to call before the finale section exists
  // (the countdown gate detaches it until unlock) — callers re-call
  // after unlock.
  var replayWired = false;

  function wireReplay() {
    if (replayWired) return true;
    var btn = document.querySelector('[data-motion-replay]');
    if (!btn) return false;
    replayWired = true;
    if (!motionAllowed()) {
      btn.hidden = true;
      return true;
    }
    btn.hidden = false;
    btn.addEventListener('click', function () {
      fireworks();
    });
    return true;
  }

  function boot() {
    wireReplay();
    if (reduceMotionQuery && typeof reduceMotionQuery.addEventListener === 'function') {
      reduceMotionQuery.addEventListener('change', function () {
        var btn = document.querySelector('[data-motion-replay]');
        if (btn && !motionAllowed()) btn.hidden = true;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // The single motion surface. Sections call Motion.fireworks() /
  // Motion.burst() / Motion.motionAllowed() / Motion.hasGsap() and
  // never touch window.confetti or window.gsap directly. QA counts
  // calls through window.__motion (adversarial: real render + call counts).
  var fired = { burst: 0, fireworks: 0 };

  function countedBurst(options) {
    var ok = burst(options);
    if (ok) fired.burst += 1;
    return ok;
  }

  function countedFireworks(options) {
    var ok = fireworks(options);
    if (ok) fired.fireworks += 1;
    return ok;
  }

  window.Motion = {
    motionAllowed: motionAllowed,
    prefersReducedMotion: prefersReducedMotion,
    hasGsap: hasGsap,
    burst: countedBurst,
    fireworks: countedFireworks,
    wireReplay: wireReplay
  };

  window.__motion = {
    get allowed() { return motionAllowed(); },
    get reduced() { return prefersReducedMotion(); },
    get burstFired() { return fired.burst; },
    get fireworksFired() { return fired.fireworks; },
    get totalFired() { return fired.burst + fired.fireworks; },
    get hasGsap() { return hasGsap(); }
  };
})();
