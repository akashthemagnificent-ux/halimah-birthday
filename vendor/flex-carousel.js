/* world: flex-carousel (port of reactbits.dev/components/flex-carousel).
   The reactbits source is WebGL/OGL (scene pass + lens pass). Pages
   opened from file:// cannot upload local images to WebGL textures
   (texImage2D throws SecurityError for file:// images), so this port
   renders the row as real <img> cards and reproduces the "invisible
   liquid glass at its edges" with the #world-liquid-glass SVG filter
   (feImage gradient ramp + feDisplacementMap), which is verified to
   displace edge pixels while leaving the centre untouched on file://.
   Faithful to the original: uniform card height with natural widths
   (source images are non-uniform, object-fit cover crops), gap,
   rounded cards, an infinite row that flows on its own with no
   manual scrolling, paused while off screen. */
(function () {
  'use strict';

  var GAP = 12; /* must match .world__flex-track gap in world.css */

  function FlexCarousel(container, options) {
    if (!container || container.__flexCarousel) return container.__flexCarousel || null;
    var o = options || {};
    var speed = o.speed != null ? o.speed : 40; /* px per second */
    var track = container.querySelector('.world__flex-track');
    if (!track) return null;

    var base = Array.prototype.slice.call(track.children);
    if (!base.length) return null;
    var setW = 0;
    var x = 0;
    var raf = 0;
    var last = 0;
    var running = false;
    var visible = false;
    var pending = 0;

    function clearClones() {
      var kids = Array.prototype.slice.call(track.children);
      for (var i = base.length; i < kids.length; i++) track.removeChild(kids[i]);
    }

    function measure() {
      clearClones();
      setW = 0;
      for (var i = 0; i < base.length; i++) {
        setW += base[i].getBoundingClientRect().width || 0;
      }
      setW += GAP * base.length;
      if (setW < 40) { setW = 0; return; }
      if (x >= setW) x = x % setW;
      var boxW = container.clientWidth || 0;
      var need = Math.ceil((boxW + setW) / setW) + 1;
      for (var r = 1; r < need; r++) {
        for (var j = 0; j < base.length; j++) {
          track.appendChild(base[j].cloneNode(true));
        }
      }
      apply();
    }

    function apply() {
      track.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)';
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (setW > 0 && dt > 0) {
        x += speed * dt;
        while (x >= setW) x -= setW;
        apply();
      }
      tick();
    }

    function tick() {
      if (running && visible && !raf) raf = requestAnimationFrame(frame);
      if (!running || !visible) { last = 0; }
    }

    function start() { if (!running) { running = true; tick(); } }
    function stop() { running = false; }

    /* Wait for every base image to settle, then size the period. */
    function whenReady(cb) {
      var left = base.length;
      if (!left) { cb(); return; }
      base.forEach(function (img) {
        if (img.complete && img.naturalWidth) { if (--left === 0) cb(); return; }
        var done = function () {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          if (--left === 0) cb();
        };
        img.addEventListener('load', done);
        img.addEventListener('error', done);
      });
    }

    whenReady(function () {
      measure();
      if (document.createElement('canvas').getContext &&
          typeof IntersectionObserver === 'function') {
        var io = new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          tick();
        }, { rootMargin: '160px 0px' });
        io.observe(container);
      } else {
        visible = true;
      }
      if (typeof ResizeObserver === 'function') {
        var ro = new ResizeObserver(function () { pending = requestAnimationFrame(function () { pending = 0; measure(); }); });
        ro.observe(container);
      }
      document.addEventListener('visibilitychange', tick);
      start();
    });

    /* Late loads (cached but decoded later) re-measure once. */
    base.forEach(function (img) {
      if (img.complete && img.naturalWidth) return;
      img.addEventListener('load', function () { measure(); });
    });

    var api = { el: container, measure: measure, start: start, stop: stop,
      destroy: function () { stop(); clearClones(); container.__flexCarousel = null; } };
    container.__flexCarousel = api;
    return api;
  }

  window.FlexCarousel = FlexCarousel;
})();
