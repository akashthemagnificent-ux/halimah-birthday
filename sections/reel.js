/* reel - scroll-pinned birthday video gifts.
   One active decoder: a single <video> swaps src at the veil peak;
   the echo layer is the active poster (static, blurred). Native
   scroll drives a per-chapter 0..1 progress via rAF. Minimal stage:
   no captions, rails or toggles; sound on by default; bottom
   letterbox bar + loading spinner. Reduced motion drops the flash
   and scale choreography for a plain crossfade. */

(() => {
  'use strict';

  var SECTION_ID = 'reel';

  var reelEl = document.getElementById(SECTION_ID);
  var ASSET_BASE = (reelEl && reelEl.getAttribute('data-reel-assets')) || 'assets/reel/';

  var GIFTS = [
    { src: ASSET_BASE + 'gift-1.mp4', poster: 'assets/reel/gift-1-poster.jpg',
      title: 'for the first smile', accent: '239 106 64', pos: '50% 50%', aspect: 'square' },
    { src: ASSET_BASE + 'gift-2.mp4', poster: 'assets/reel/gift-2-poster.jpg',
      title: 'a late-night one', accent: '224 92 54', pos: '50% 50%', aspect: 'wide' },
    { src: ASSET_BASE + 'gift-3.mp4', poster: 'assets/reel/gift-3-poster.jpg',
      title: 'the long one, every take', accent: '198 74 48', pos: '50% 50%', aspect: 'wide' },
    { src: ASSET_BASE + 'gift-4.mp4', poster: 'assets/reel/gift-4-poster.jpg',
      title: 'a version of you to keep', accent: '236 130 72', pos: '50% 50%', aspect: 'square' },
    { src: ASSET_BASE + 'gift-5.mp4', poster: 'assets/reel/gift-5-poster.jpg',
      title: 'the one i saved for last', accent: '255 156 88', pos: '50% 50%', aspect: 'square' }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* map p in [x0,x1] to 0..1 */
  function seg(p, x0, x1) { return clamp((p - x0) / (x1 - x0), 0, 1); }

  var wired = false;
  function init() {
    var section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || wired) {
      if (!wired) window.setTimeout(init, 150);
      return;
    }
    wired = true;

    document.documentElement.classList.add('js-reel');

    var track = section.querySelector('[data-reel-track]');
    var stage = section.querySelector('[data-reel-stage]');
    var fg = section.querySelector('[data-reel-fg]');
    var echo = section.querySelector('[data-reel-echo]');
    var indexEl = section.querySelector('[data-reel-index]');
    var flash = section.querySelector('[data-reel-flash]');
    var veil = section.querySelector('[data-reel-veil]');
    if (!track || !stage || !fg || !echo || !veil) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var N = GIFTS.length;
    var active = -1;
    var raf = 0;
    var dirty = true;
    var near = false;
    var probe = null; /* metadata preload for the next gift */
    var unlockArmed = false; /* one gesture-retry latch for audio autoplay */
    var fgStalled = false; /* true only between waiting/stalled and the next frame */

    track.style.setProperty('--reel-count', String(N));

    function setActive(i) {
      if (i === active) return;
      var prev = active;
      active = i;
      var g = GIFTS[i];
      if (prev !== -1) {
        /* swap the single decoder while the veil hides the cut */
        try { fg.pause(); } catch (e) {}
        fg.poster = g.poster;
        fg.src = g.src;
        fg.style.objectPosition = g.pos;
        fg.autoplay = true; /* playsinline: browser replays after load */
        fg.load();
        /* only swap loads bump preload; the first gift stays preload=none
           until the hold zone plays it (never yank 25MB past other sections) */
        try { fg.preload = 'auto'; } catch (e) {}
      }
      fg.muted = false; /* edits carry audio: sound on by default */
      fg.setAttribute('data-aspect', g.aspect);
      echo.src = g.poster;
      stage.style.setProperty('--reel-accent', g.accent);
      if (indexEl) indexEl.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
      /* metadata-preload only the next gift */
      var nxt = GIFTS[i + 1];
      if (nxt) {
        if (!probe) { probe = document.createElement('video'); probe.preload = 'metadata'; probe.muted = true; }
        probe.src = nxt.src;
        try { probe.load(); } catch (e) {}
      }
    }

    function playActive() {
      /* entering the hold zone commits to loading: bump preload so the
         starved-loader watchdog may recover a fetch that never starts */
      if (fg.preload !== 'auto') { try { fg.preload = 'auto'; } catch (e) {} }
      fg.muted = false;
      if (!fg.paused) return;
      var pr = fg.play();
      if (pr && pr.catch) pr.catch(function () {
         /* policy blocked audio autoplay: retry once on the first real
            gesture (she will have tapped begin, but Safari may still
            demand an in-page gesture for sound) */
        if (unlockArmed) return;
        unlockArmed = true;
        var unlock = function () {
          unlockArmed = false;
          fg.muted = false;
          playActive();
        };
        document.addEventListener('pointerdown', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
      });
    }

    /* first play can lose a race with load(); retry on canplay + slow tick */
    /* spinner shows only while data is genuinely absent: readyState<2 or a
       waiting/stalled gap; any frame arrival (readyState>=2, playing) hides it */
    var stallOn = function () { fgStalled = true; onScroll(); };
    var stallOff = function () { fgStalled = false; onScroll(); };
    fg.addEventListener('canplay', stallOff);
    fg.addEventListener('loadstart', stallOn);
    fg.addEventListener('waiting', stallOn);
    fg.addEventListener('stalled', stallOn);
    fg.addEventListener('loadeddata', stallOff);
    fg.addEventListener('playing', stallOff);
    /* aspect: self-heal from the real dims once metadata lands */
    fg.addEventListener('loadedmetadata', function () {
      if (fg.videoWidth > 0 && fg.videoHeight > 0) {
        fg.setAttribute('data-aspect', fg.videoWidth / fg.videoHeight >= 1.3 ? 'wide' : 'square');
      }
      onScroll();
    });
    /* decode/network failure: keep the poster attribute visible (CSS
       already paints the poster under a transparent video); retry once */
    var errRetried = 0;
    fg.addEventListener('error', function () {
      if (!fg.getAttribute('src')) return;
      if (errRetried < 2) {
        errRetried++;
        try { fg.load(); } catch (e) {}
      }
      dirty = true;
      render();
    });
    /* echo img: if its poster 404s, fall back to gift 1 */
    if (echo && !echo.complete) {
      echo.addEventListener('error', function () {
        if (echo.src.indexOf('gift-1-poster') === -1) {
          echo.src = 'assets/reel/gift-1-poster.jpg';
        }
      });
    }
    /* Safety tick: render directly (not via rAF) so playback and the
       choreography keep running even when the compositor starves rAF
       under software GL. Also re-plays a gift that dropped paused. */
    var starved = 0;
    window.setInterval(function () {
      if (!near || document.hidden) return;
      var r = track.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      dirty = true;
      render();
      /* recover a fetch that was intentionally started (preload bumped in
         a swap or hold-zone play) and never produced data; never reload
         while a request is already in flight (that aborts and restarts it) */
      if (fg.readyState === 0 && fg.src && fg.preload === 'auto' && fg.networkState !== 2 /* LOADING */) {
        starved++;
        if (starved >= 4) { starved = 0; try { fg.load(); } catch (e) {} }
      } else {
        starved = 0;
      }
    }, 600);

    function render() {
      raf = 0;
      if (!near) return; /* keep dirty for the moment the section arrives */
      dirty = false;

      var rect = track.getBoundingClientRect();
      var chapterH = track.offsetHeight / N;
      var scrolled = -rect.top;
      var raw = clamp(scrolled / chapterH, 0, N - 0.0001);
      var ci = Math.floor(raw);
      var p = clamp(raw - ci, 0, 1);

      /* boundary hysteresis: flip only past 0.96 / below 0.04 */
      var effIndex = ci;
      if (p > 0.96 && ci < N - 1) effIndex = ci + 1;
      if (p < 0.04 && ci > 0) effIndex = ci - 1;
      setActive(effIndex);

      /* phases */
      var reveal = seg(p, 0.10, 0.26);
      var prep = seg(p, 0.64, 0.80);
      var flashT = seg(p, 0.80, 0.93);
      var veilUp = seg(p, 0.88, 0.96);
      /* veil carried across EVERY boundary including first entry (the
         "the night" → edit handoff): opaque at p=0, down by p=0.10 */
      var veilCarry = 1 - seg(p, 0.0, 0.10);
      var entryT = ci === 0 ? 1 - veilCarry : 0;

      var isReduced = reduced.matches;
      var veilK = Math.max(veilUp, veilCarry);

      /* foreground transform/opacity (transform-only) */
      var scale, opacity;
      if (isReduced) {
        scale = 1;
        opacity = (ci === 0 && veilK < 0.05) ? 1 : Math.max(reveal, veilCarry);
      } else {
        scale = lerp(0.96, 1, reveal);
        if (prep > 0) scale = lerp(1, 1.12, prep);
        opacity = (ci === 0 && veilK < 0.05) ? 1 : Math.max(reveal, veilCarry);
        /* veil covers the swap; the emerging image stays opaque */
        if (veilK > 0.55) opacity = 1;
      }

      var fullScale = 1;
      if (veilK > 0.92 && !isReduced) {
        /* scale-to-cover from the base CSS box (transform must not
           depend on a rect that the current transform already skews).
           Boxes mirror reel.css: wide = 100vw x 56.25vw; square =
           min(76dvh, 92vw) on both sides. */
        var wide = fg.getAttribute('data-aspect') === 'wide';
        var baseW = wide ? window.innerWidth
          : Math.min(window.innerHeight * 0.76, window.innerWidth * 0.92);
        var baseH = wide ? window.innerWidth * 0.5625 : baseW;
        fullScale = Math.max(window.innerWidth / baseW, window.innerHeight / baseH) * 1.04;
        fg.classList.add('is-full');
      } else {
        fg.classList.remove('is-full');
      }

      fg.style.opacity = String(opacity);
      fg.style.transform = 'translate(-50%, -50%) scale(' + (scale * fullScale).toFixed(4) + ')';

      /* stage flags: visible + spinner-while-loading */
      stage.classList.toggle('is-playing', opacity > 0.5);
      stage.classList.toggle('is-buffering', !!fg.src && !fg.error && (fg.readyState < 2 || fgStalled));

      /* flash beam */
      if (flash) {
        if (isReduced) {
          flash.style.opacity = '0';
        } else {
          var beamT = Math.max(flashT, entryT);
          var fk = Math.sin(beamT * Math.PI); /* in and out inside the segment */
          flash.style.opacity = String(fk * 0.95);
          flash.style.transform = 'scaleX(' + lerp(0.05, 2.6, beamT).toFixed(3) + ')';
        }
      }

      /* white veil */
      veil.style.opacity = String(veilK);

      /* echo: slight darken during prep */
      if (echo) {
        var bright = lerp(0.48, 0.34, prep);
        echo.style.filter = 'blur(34px) saturate(1.2) brightness(' + bright.toFixed(3) + ')';
      }

      /* playback policy: one decoder, only while the gift is watchable
         AND the track actually intersects the viewport (never while the
         previous section is still the one in view) */
      var inView = rect.top < window.innerHeight && rect.bottom > 0;
      var watchable = veilK < 0.65 && p < 0.86 && inView;
      if (watchable && !document.hidden) playActive();
      else if (!fg.paused) { try { fg.pause(); } catch (e) {} }
    }

    function onScroll() { dirty = true; if (!raf) raf = window.requestAnimationFrame(render); }
    function onResize() { onScroll(); }

    /* lazy: only track scroll while the reel is near the viewport */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        near = entries.some(function (en) { return en.isIntersecting; });
        if (near) {
          /* first approach: activate gift 1 now (same flow as later swaps) */
          if (active === -1) setActive(0);
          onScroll();
        } else if (!fg.paused) { try { fg.pause(); } catch (e) {} }
      }, { rootMargin: '200% 0px' });
      io.observe(track);
    } else {
      near = true;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { try { fg.pause(); } catch (e) {} }
      else onScroll();
    });
    reduced.addEventListener ? reduced.addEventListener('change', onScroll) : null;
    window.addEventListener('pagehide', function () { try { fg.pause(); } catch (e) {} });

    /* first gift activates on approach (IO above); kick scroll state */
    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
