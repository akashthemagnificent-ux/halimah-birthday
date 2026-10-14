/* world: your world, the archive (todo 13).
   Boots the interactive archive. Every component is an enhancement
   over the static markup already in index.html, guarded by typeof
   checks so a missing vendor never breaks the page. No reduced-motion
   gate: this personal site always runs full motion. Reveal only arms
   once the html.js-world class is set. Carousels start after the
   bento rebuild (MagicBento copies cell innerHTML), and the song
   player crossfades a clip per active card. */
(function () {
  'use strict';

  var SECTION_ID = 'world';
  var booted = false;

  function text(sel, fallback, scope) {
    var el = (scope || document).querySelector(sel);
    var v = el ? (el.textContent || '').trim() : '';
    return v || fallback;
  }

  /* ---- Animated silk backdrop ---- */
  function upgradeSilk(section) {
    var mount = section.querySelector('[data-world-silk]');
    if (!mount || typeof window.SilkBackground !== 'function') return;
    try {
      window.SilkBackground({
        container: mount,
        color: '#241030',
        sheenColor: '#6b2f7a',
        depth: 0.55,
        glow: 0.35,
        ripple: 0.8,
        wave: 0.9,
        noiseIntensity: 1.2,
        variation: 0.4,
        mouseInteraction: true,
        clickRipple: true,
        intro: true
      });
    } catch (e) { /* decorative only */ }
  }

  /* ---- Masked heading (needs gsap) ---- */
  function upgradeHeading(section) {
    var mount = section.querySelector('[data-world-heading]');
    if (!mount || typeof window.MaskedHeading !== 'function' || !window.gsap) return;
    var fb = mount.querySelector('.world__heading-fallback');
    var headingText = fb ? (fb.textContent || '').trim() : 'know these, know you';
    if (!headingText) headingText = 'know these, know you';
    mount.innerHTML = '';
    try {
      window.MaskedHeading(mount, {
        text: headingText,
        tag: 'h2',
        palette: ['#2a0f33', '#7a1560', '#d4356f', '#ff9a3c', '#ffd98a'],
        weight: 700,
        align: 'center',
        reveal: 'rise',
        trigger: 'view'
      });
    } catch (e) { /* fall through to restore */ }
    if (!mount.querySelector('.masked-heading')) {
      mount.innerHTML = '<h2 class="world__heading-fallback"></h2>';
      mount.firstChild.textContent = headingText;
    }
  }

  /* ---- Holo photo card: CSS holographic film + pointer tilt.
     HoloCard is WebGL; local images can never be uploaded to WebGL
     textures from file:// (SecurityError), and its image path is dead
     code (textureReady never flips). The film is pure CSS over the
     real <img>, so the Rin photo always shows from plain file://. */
  function upgradeHolo(section) {
    var frame = section.querySelector('.world__holo');
    if (!frame || frame.__tilt) return;
    frame.addEventListener('pointermove', function (e) {
      var r = frame.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      frame.style.transform =
        'perspective(900px) rotateX(' + (-y * 8).toFixed(2) + 'deg) rotateY(' + (x * 8).toFixed(2) + 'deg)';
    });
    frame.addEventListener('pointerleave', function () { frame.style.transform = ''; });
    frame.__tilt = true;
  }

  /* ---- Songs scroll-stack ---- */
  function upgradeStack(section) {
    var mount = section.querySelector('[data-world-stack]');
    if (!mount || typeof window.ScrollStack !== 'function') return;
    if (!mount.children.length) return;
    try {
      window.ScrollStack(mount, {
        useWindowScroll: true,
        smoothScroll: false,
        snap: false,
        itemDistance: 90,
        itemStackDistance: 24,
        stackPosition: '88px',
        dimAmount: 0.25
      });
    } catch (e) { /* static list stays readable */ }
  }

  /* ---- Scramble horror titles (poster names) ---- */
  function upgradeScramble(section) {
    if (typeof window.ScrambledText !== 'function') return;
    var nodes = Array.prototype.slice.call(section.querySelectorAll('[data-scramble]'));
    nodes.forEach(function (node) {
      try { window.ScrambledText(node, { radius: 120, duration: 1.1, speed: 34, scrambleChars: '.:' }); }
      catch (e) { /* plain title stays readable */ }
    });
  }

  /* ---- Magic-bento grid (built from the static cells) ---- */
  function upgradeBento(section) {
    var mount = section.querySelector('[data-world-bento]');
    if (!mount || typeof window.MagicBento !== 'function') return;
    var cells = Array.prototype.slice.call(mount.querySelectorAll('.world__cell'));
    if (!cells.length) return;
    var items = cells.map(function (cell) {
      return {
        content: cell.innerHTML,
        colSpan: parseInt(cell.getAttribute('data-col-span'), 10) || 1,
        rowSpan: parseInt(cell.getAttribute('data-row-span'), 10) || 1
      };
    });
    mount.innerHTML = '';
    try {
      window.MagicBento(mount, {
        items: items,
        columns: 4,
        rowHeight: 300,
        gap: 14,
        radius: 20,
        glowColor: 'rgb(224, 124, 62)',
        enableStars: true,
        particleCount: 22,
        enableSpotlight: true,
        spotlightRadius: 340,
        enableTilt: true,
        enableMagnetism: true,
        clickEffect: true,
        textAutoHide: false
      });
    } catch (e) {
      mount.innerHTML = cells.map(function (c) { return c.outerHTML; }).join('');
    }
  }

  /* ---- Pulse heart (mounts into the calling cell, after bento) ---- */
  function upgradeHeart(section) {
    var mount = section.querySelector('[data-world-heart]');
    if (!mount || typeof window.PulseHeart !== 'function') return;
    try {
      window.PulseHeart(mount, { showCount: false, defaultLiked: true });
    } catch (e) { /* decorative only */ }
  }

  /* ---- Liquid-glass image carousels (start after the bento rebuild) ---- */
  function upgradeFlex(section) {
    if (typeof window.FlexCarousel !== 'function') return;
    var mounts = Array.prototype.slice.call(section.querySelectorAll('[data-world-flex]'));
    mounts.forEach(function (mount) {
      var kind = mount.getAttribute('data-world-flex') || '';
      var speed = kind === 'matcha' ? 46 : kind === 'calling' ? 34 : 40;
      try { window.FlexCarousel(mount, { speed: speed }); }
      catch (e) { /* static row stays */ }
    });
  }

  /* ---- Song clips: the active card plays, crossfaded ---- */
  function initSongAudio(section) {
    var stack = section.querySelector('[data-world-stack]');
    var songs = Array.prototype.slice.call(section.querySelectorAll('.world__song[data-audio]'));
    if (!stack || !songs.length) return;
    var CROSS_MS = 440;    /* crossfade between cards */
    var END_FADE_S = 1.8;  /* little fade when a clip runs out */
    var STACK_TOP = 88;    /* mirrors ScrollStack stackPosition '88px' */
    var STACK_STEP = 24;   /* mirrors ScrollStack itemStackDistance */
    var current = -1;
    var armed = false;
    var ducked = false;
    var howlPrev = null;
    var bgmWasPlaying = false;
    var fades = [];
    var ticker = 0;
    var queued = 0;

    function rampIO(io, to, ms, pauseAtEnd, after) {
      for (var i = fades.length - 1; i >= 0; i--) {
        if (fades[i].io === io) fades.splice(i, 1);
      }
      fades.push({ io: io, from: io.read(), to: to, ms: Math.max(1, ms),
        t0: performance.now(), pause: pauseAtEnd, after: after });
      pump();
    }

    function pump() {
      if (ticker) return;
      ticker = requestAnimationFrame(function run(now) {
        ticker = 0;
        for (var i = fades.length - 1; i >= 0; i--) {
          var f = fades[i];
          var p = Math.min(1, (now - f.t0) / f.ms);
          var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          try { f.io.write(Math.max(0, Math.min(1, f.from + (f.to - f.from) * e))); }
          catch (err) { /* gone */ }
          if (p >= 1) {
            fades.splice(i, 1);
            if (f.pause && f.to === 0 && f.io.pause) { try { f.io.pause(); } catch (err2) {} }
            if (f.after) f.after();
          }
        }
        if (fades.length) ticker = requestAnimationFrame(run);
      });
    }

    function volIO(el) {
      return {
        read: function () { return el.volume; },
        write: function (v) { el.volume = v; },
        pause: function () { try { el.pause(); } catch (e) {} }
      };
    }

    function howlIO(h) {
      return {
        read: function () { return h.volume(); },
        write: function (v) { h.volume(v); },
        pause: null
      };
    }

    function audioFor(i) {
      var el = songs[i].__audio;
      if (el) return el;
      el = new Audio();
      el.preload = 'metadata';
      el.src = songs[i].getAttribute('data-audio');
      el.__ended = false;
      el.__ending = false;
      el.addEventListener('timeupdate', function () {
        if (el.__ending || el.paused || !isFinite(el.duration) || !el.duration) return;
        var rem = el.duration - el.currentTime;
        if (rem > 0 && rem <= END_FADE_S) {
          el.__ending = true;
          rampIO(volIO(el), 0, Math.max(220, rem * 1000), true, function () { el.__ended = true; });
        }
      });
      songs[i].__audio = el;
      return el;
    }

    function play(i) {
      var el = audioFor(i);
      el.__ended = false;
      el.__ending = false;
      try {
        if (!isFinite(el.duration) || el.currentTime >= el.duration - 0.05) el.currentTime = 0;
      } catch (e) {}
      var p = el.play();
      if (p && p.catch) p.catch(function () { /* next scroll retries */ });
      rampIO(volIO(el), 1, CROSS_MS, false, null);
      duckBg(true);
    }

    function stopOne(i, ms) {
      var el = songs[i] && songs[i].__audio;
      songs[i].classList.remove('is-playing');
      if (el && !el.paused) rampIO(volIO(el), 0, ms || CROSS_MS, true, null);
    }

    function duckBg(on) {
      if (on === ducked) return;
      ducked = on;
      var h = window.Howler;
      if (h && typeof h.volume === 'function') {
        if (on) {
          if (howlPrev === null) { try { howlPrev = h.volume(); } catch (e) { howlPrev = 1; } }
          rampIO(howlIO(h), 0, CROSS_MS, false, null);
        } else if (howlPrev !== null) {
          var back = howlPrev;
          howlPrev = null;
          rampIO(howlIO(h), back, CROSS_MS, false, null);
        }
      }
      var bgm = document.getElementById('bgm');
      if (bgm) {
        if (on) {
          if (!bgm.paused) { bgmWasPlaying = true; try { bgm.pause(); } catch (e2) {} }
        } else if (bgmWasPlaying) {
          bgmWasPlaying = false;
          var pr = bgm.play();
          if (pr && pr.catch) pr.catch(function () {});
        }
      }
    }

    function activeIndex() {
      var slots = stack.querySelectorAll('[data-stack-slot]');
      if (!slots.length) return 0;
      var best = 0;
      for (var i = 0; i < slots.length; i++) {
        var top = slots[i].getBoundingClientRect().top;
        if (top <= STACK_TOP + STACK_STEP * i + 6) best = i;
      }
      return Math.min(best, songs.length - 1);
    }

    function refresh() {
      if (!armed) return;
      var i = activeIndex();
      if (i !== current) {
        if (current >= 0) stopOne(current);
        current = i;
        songs[i].classList.add('is-playing');
        play(i);
        return;
      }
      var el = songs[i].__audio;
      if (el && el.paused && !el.__ending && !el.__ended) {
        songs[i].classList.add('is-playing');
        play(i);
      }
    }

    function silence() {
      for (var i = 0; i < songs.length; i++) stopOne(i, 260);
      duckBg(false);
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        armed = entries[0].isIntersecting;
        if (armed) refresh(); else silence();
      }, { rootMargin: '25% 0px 25% 0px' });
      io.observe(stack);
    } else {
      armed = true;
    }

    var scrollEvents = 0;
    var refreshes = 0;
    window.addEventListener('scroll', function () {
      scrollEvents++;
      if (queued) return;
      queued = requestAnimationFrame(function () { queued = 0; refreshes++; refresh(); });
    }, { passive: true });
    window.__songDebug = function () {
      return { armed: armed, current: current, queued: queued, scrollEvents: scrollEvents,
        refreshes: refreshes, geo: activeIndex(), fades: fades.length, ticker: ticker,
        ducked: ducked, now: Math.round(performance.now()) };
    };
  }

  /* ---- Scroll reveal (enhancement) ---- */
  function observeReveals(section) {
    var targets = Array.prototype.slice.call(
      section.querySelectorAll('.world__stage, .world__singers, .world__horror, .world__closer-block')
    );
    if (!targets.length) return;
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach(function (t) { io.observe(t); });
  }

  function boot() {
    var section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected) { window.setTimeout(boot, 150); return; }
    if (booted) return;
    booted = true;

    document.documentElement.classList.add('js-world');

    upgradeSilk(section);
    upgradeHeading(section);
    upgradeHolo(section);
    upgradeStack(section);
    upgradeScramble(section);
    upgradeBento(section);
    upgradeHeart(section);
    upgradeFlex(section);
    initSongAudio(section);
    observeReveals(section);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
