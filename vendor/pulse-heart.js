/* Pulse heart: vanilla port of React Bits "Pulse Heart".
   Source: https://reactbits.dev/micro/pulse-heart (JS+CSS).
   Like button that contracts to a dot, flips colour, and rolls the count.
   The hugeicons glyph is replaced by a single inline heart path.
   Exposes window.PulseHeart(mount, opts) -> { el, setLiked, destroy }. */
(function () {
  'use strict';
  var CSS = ".pulse-heart {\n  --ph-size: 40px;\n  --ph-corner: 32px;\n  --ph-pill: #232326;\n  --ph-idle: #8b8b93;\n  --ph-liked: #ff4d6d;\n  --ph-text: #f5f5f5;\n  --ph-roll: 350ms;\n  --ph-stroke: 2.5px;\n  --ph-ease-out: cubic-bezier(0.23, 1, 0.32, 1);\n\n  position: relative;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  border-radius: var(--ph-corner);\n  background: none;\n  color: var(--ph-text);\n  font-family: inherit;\n  cursor: pointer;\n  user-select: none;\n  -webkit-user-select: none;\n  -webkit-touch-callout: none;\n  -webkit-tap-highlight-color: transparent;\n  touch-action: manipulation;\n  outline: none;\n  transition: transform 160ms var(--ph-ease-out);\n}\n\n.pulse-heart[data-pressed] {\n  transform: scale(0.97);\n}\n\n.pulse-heart:focus-visible {\n  outline: 2px solid color-mix(in srgb, var(--ph-liked) 60%, transparent);\n  outline-offset: 3px;\n}\n\n.pulse-heart:disabled {\n  opacity: 0.55;\n  cursor: default;\n}\n\n.pulse-heart__pill {\n  display: inline-flex;\n  align-items: center;\n  gap: calc(var(--ph-size) * 0.25);\n  padding: calc(var(--ph-size) * 0.3);\n  padding-inline-end: calc(var(--ph-size) * 0.4);\n  border-radius: var(--ph-corner);\n  background: var(--ph-pill);\n  transform-origin: center;\n}\n\n.pulse-heart[data-no-count] .pulse-heart__pill {\n  padding-inline-end: calc(var(--ph-size) * 0.3);\n}\n\n.pulse-heart__heart {\n  display: block;\n  width: var(--ph-size);\n  height: var(--ph-size);\n  color: var(--ph-idle);\n  transform-origin: center;\n  transition: color 160ms ease;\n}\n\n.pulse-heart__heart svg {\n  display: block;\n  width: 100%;\n  height: 100%;\n  overflow: visible;\n  fill: none;\n  stroke: currentColor;\n  stroke-width: var(--ph-stroke);\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}\n\n.pulse-heart[data-solid] .pulse-heart__heart svg,\n.pulse-heart[data-liked='true'] .pulse-heart__heart svg {\n  fill: currentColor;\n}\n\n.pulse-heart[data-liked='true'] .pulse-heart__heart {\n  color: var(--ph-liked);\n}\n\n.pulse-heart[data-running] .pulse-heart__heart,\n.pulse-heart[data-instant] .pulse-heart__heart {\n  transition: none;\n}\n\n@media (hover: hover) and (pointer: fine) {\n  .pulse-heart:not([data-liked='true']):not(:disabled):hover .pulse-heart__heart {\n    color: color-mix(in srgb, var(--ph-idle) 45%, var(--ph-liked));\n  }\n}\n\n.pulse-heart__count {\n  display: inline-flex;\n  font-size: calc(var(--ph-size) * 0.5);\n  font-weight: 600;\n  line-height: 1;\n  letter-spacing: -0.1px;\n  font-variant-numeric: tabular-nums;\n  color: var(--ph-text);\n}\n\n.pulse-heart__count > span {\n  display: block;\n  height: 1em;\n}\n\n.pulse-heart__slot {\n  position: relative;\n  overflow: hidden;\n}\n\n.pulse-heart__roll {\n  display: flex;\n  flex-direction: column;\n  transition: transform var(--ph-roll) var(--ph-ease-out);\n}\n\n.pulse-heart__roll > span {\n  display: block;\n  height: 1em;\n  line-height: 1;\n}\n\n.pulse-heart__sr {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  margin: -1px;\n  padding: 0;\n  border: 0;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  white-space: nowrap;\n}\n\n@media (pointer: coarse) {\n  .pulse-heart {\n    min-width: 44px;\n    min-height: 44px;\n  }\n}\n\n@media (prefers-contrast: more) {\n  .pulse-heart__pill {\n    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ph-text) 25%, transparent);\n  }\n}\n\n";
  var HEART = "<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><g data-glyph><path d=\"M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z\" vector-effect=\"non-scaling-stroke\"/></g></svg>";
  var OUT = 0.4;
  var injected = false;
  function inject() {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    var el = document.createElement('style');
    el.setAttribute('data-pulse-heart', '');
    el.textContent = CSS;
    document.head.appendChild(el);
  }
  var back = function (k, c) { var u = k - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  var swellOf = function (t, c) { return t <= 0 ? 0 : t < OUT ? 1 - Math.pow(1 - t / OUT, 3) : 1 - back((t - OUT) / (1 - OUT), c); };
  var fmt = function (n) { return new Intl.NumberFormat().format(n); };

  window.PulseHeart = function (mount, options) {
    var o = options || {};
    inject();
    var size = o.size != null ? o.size : 40;
    var corner = o.corner != null ? o.corner : 32;
    var showCount = o.showCount !== false;
    var liked = !!o.defaultLiked;
    var total = o.count != null ? o.count : 0;
    var shownLiked = liked, shownCount = total;
    var duration = o.duration != null ? o.duration : 560;
    var dotSize = o.dotSize != null ? o.dotSize : 0.3;
    var overshoot = o.overshoot != null ? o.overshoot : 1.7;
    var beat = o.beat != null ? o.beat : 3;
    var rollDuration = o.rollDuration != null ? o.rollDuration : 350;
    var raf = 0, busy = false;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pulse-heart' + (o.className ? ' ' + o.className : '');
    btn.style.setProperty('--ph-size', size + 'px');
    btn.style.setProperty('--ph-corner', corner + 'px');
    btn.style.setProperty('--ph-pill', o.pillColor || '#232326');
    btn.style.setProperty('--ph-idle', o.idleColor || '#8b8b93');
    btn.style.setProperty('--ph-liked', o.likedColor || '#ff4d6d');
    btn.style.setProperty('--ph-text', o.textColor || '#f5f5f5');
    btn.style.setProperty('--ph-roll', rollDuration + 'ms');
    btn.style.setProperty('--ph-stroke', (1.5 * size) / 24 + 'px');
    btn.setAttribute('data-liked', String(liked));
    if (!showCount) btn.setAttribute('data-no-count', '');
    btn.innerHTML =
      '<span class="pulse-heart__pill">' +
        '<span class="pulse-heart__heart" aria-hidden="true">' + HEART + '</span>' +
        (showCount ? '<span class="pulse-heart__count" aria-hidden="true" data-count></span>' : '') +
        '<span class="pulse-heart__sr" data-sr></span>' +
      '</span>';
    mount.appendChild(btn);

    var pill = btn.querySelector('.pulse-heart__pill');
    var heart = btn.querySelector('.pulse-heart__heart');
    var glyph = btn.querySelector('[data-glyph]');
    var countEl = btn.querySelector('[data-count]');
    var srEl = btn.querySelector('[data-sr]');

    function renderCount() {
      if (countEl) countEl.textContent = fmt(shownCount);
      if (srEl) srEl.textContent = (o.label || 'Like') + ', ' + fmt(total);
    }
    function sync() {
      btn.setAttribute('data-liked', String(shownLiked));
      btn.setAttribute('aria-pressed', String(shownLiked));
    }
    sync(); renderCount();

    function run(nextLiked, nextCount) {
      busy = true;
      btn.setAttribute('data-running', '');
      var swapped = false, prev = 0, t0 = performance.now();
      function tick(now) {
        var dt = prev ? now - prev : 1000 / 60; prev = now;
        var t = Math.min(1, (now - t0) / duration);
        var s = swellOf(t, overshoot);
        var k = 1 - (1 - dotSize) * s;
        if (glyph) glyph.setAttribute('transform', 'translate(12 12) scale(' + k + ') translate(-12 -12)');
        else heart.style.transform = 'scale(' + k + ')';
        pill.style.transform = 'scale(' + (1 - (beat / 100) * s) + ')';
        if (!swapped && t + dt / 2 / duration >= OUT) {
          swapped = true;
          shownLiked = nextLiked; shownCount = nextCount;
          sync(); renderCount();
        }
        if (t < 1) { raf = requestAnimationFrame(tick); return; }
        raf = 0; busy = false;
        if (glyph) glyph.removeAttribute('transform');
        heart.style.transform = ''; pill.style.transform = '';
        btn.removeAttribute('data-running');
      }
      raf = requestAnimationFrame(tick);
    }

    btn.addEventListener('click', function () {
      if (busy) return;
      var nextLiked = !liked;
      var nextCount = total + (nextLiked ? 1 : -1);
      liked = nextLiked; total = nextCount;
      if (o.onChange) o.onChange(nextLiked, nextCount);
      run(nextLiked, nextCount);
    });

    return {
      el: btn,
      setLiked: function (v) { liked = !!v; shownLiked = liked; sync(); },
      destroy: function () { cancelAnimationFrame(raf); btn.remove(); }
    };
  };
})();
