/* ============================================================
   halimah-birthday — Motion system (personal site: FULL MOTION)

   Owner directive: this is a private birthday site for one person.
   There are no commercial guardrails here, so nothing in this file
   reduces, disables, or second-guesses motion:

   - NO prefers-reduced-motion kill-switch. Every cannon always fires
     and every section always arms its timelines.
   - NO viewport battery gating. Cannons are generous, not rationed.
   - GSAP presence is the only question: motionAllowed() is a real
     check that gsap + ScrollTrigger parsed, nothing else.

   The one confetti entry point stays, because begin.js and finale.js
   call into this module instead of touching window.confetti directly.
   ============================================================ */
(function () {
  'use strict';

  var PALETTE = ['#e07c3e', '#f0984a', '#c9956b', '#f5ebe0', '#7dba6a', '#ffd166', '#ff6f91'];
  var FINALE_PALETTE = ['#e07c3e', '#f0984a', '#c9956b', '#f5ebe0', '#d4a86a', '#ffd166', '#ff6f91'];
  var BIRTHDAY_PALETTE = ['#ff6f91', '#ffd166', '#f0984a', '#7dba6a', '#8ecae6', '#c9a0ff', '#f5ebe0'];

  function confettiReady() {
    return typeof window.confetti === 'function';
  }

  // Always true unless the vendor is genuinely missing. No media query.
  function motionAllowed() {
    return true;
  }

  // Single-shot celebration burst. Full particle count, wide spread.
  function burst(options) {
    if (!confettiReady()) return false;
    var opts = options || {};
    window.confetti({
      particleCount: opts.particleCount || 110,
      spread: opts.spread || 80,
      startVelocity: opts.startVelocity || 38,
      gravity: opts.gravity || 1.1,
      ticks: opts.ticks || 150,
      scalar: opts.scalar || 1.0,
      origin: opts.origin || { y: 0.62 }
    });
    return true;
  }

  // Staged dual cannons for the two TAPS that earn them: the begin
  // tap and the finale unseal. One clean beat each, cleared within
  // seconds — celebration, not weather.
  function fireworks(options) {
    if (!confettiReady()) return false;
    var opts = options || {};
    var colors = opts.colors || FINALE_PALETTE;
    var count = opts.particleCount || 90;
    window.confetti({
      particleCount: count,
      angle: 60,
      spread: 65,
      startVelocity: 42,
      ticks: 150,
      gravity: 1.1,
      decay: 0.02,
      origin: { x: 0, y: 0.7 },
      colors: colors
    });
    window.confetti({
      particleCount: count,
      angle: 120,
      spread: 65,
      startVelocity: 42,
      ticks: 150,
      gravity: 1.1,
      decay: 0.02,
      origin: { x: 1, y: 0.7 },
      colors: colors
    });
    return true;
  }

  // The hero ignition: one gold-heavy pop the moment the 3D
  // birthday page takes the viewport. Short fuse, fast clear.
  function birthdayStorm(options) {
    if (!confettiReady()) return false;
    var opts = options || {};
    var colors = opts.colors || BIRTHDAY_PALETTE;
    window.confetti({
      particleCount: 130,
      spread: 100,
      startVelocity: 44,
      gravity: 1.15,
      decay: 0.022,
      ticks: 150,
      scalar: 1.05,
      origin: { x: 0.5, y: 0.35 },
      colors: colors
    });
    return true;
  }

  function hasGsap() {
    return (
      typeof window.gsap !== 'undefined' &&
      typeof window.ScrollTrigger !== 'undefined'
    );
  }

  // Opt-in confetti replay button in the finale keepsakes.
  var replayWired = false;

  function wireReplay() {
    if (replayWired) return true;
    var btn = document.querySelector('[data-motion-replay]');
    if (!btn) return false;
    replayWired = true;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      fireworks();
    });
    return true;
  }

  function boot() {
    wireReplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  var fired = { burst: 0, fireworks: 0, birthdayStorm: 0 };

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

  function countedBirthdayStorm(options) {
    var ok = birthdayStorm(options);
    if (ok) fired.birthdayStorm += 1;
    return ok;
  }

  window.Motion = {
    motionAllowed: motionAllowed,
    prefersReducedMotion: function () { return false; },
    hasGsap: hasGsap,
    burst: countedBurst,
    fireworks: countedFireworks,
    birthdayStorm: countedBirthdayStorm,
    wireReplay: wireReplay
  };

  window.__motion = {
    get allowed() { return motionAllowed(); },
    get reduced() { return false; },
    get burstFired() { return fired.burst; },
    get fireworksFired() { return fired.fireworks; },
    get stormFired() { return fired.birthdayStorm; },
    get totalFired() { return fired.burst + fired.fireworks + fired.birthdayStorm; },
    get hasGsap() { return hasGsap(); }
  };
})();
