/* ============================================================
   section-music — one song per page, crossfaded.

   Nine pages, eight songs. Each page owns a track; the physics
   page continues the gag-locker track (no restart). The reel
   (edits) and world (favourite songs) pages carry their own
   audio, so the director goes silent AND hides its player on
   them — nothing overlays a cinematic full-screen page.

   - One HTMLAudioElement per track, built lazily. Only the active
     track (and its neighbour) is prepared; the rest stay untracked
     until their page is reached.
   - Crossfade on page change (~900ms). The ramp runs on a 50ms
     timer, never requestAnimationFrame: rAF starves in background
     tabs and under a busy compositor, which would leave a track
     audible long after it should have gone silent.
   - Loop seam: at the tail the track fades to zero, restarts, and
     fades back in, so a repeat never clicks. The finale is the one
     exception — the last song of the night is allowed to end,
     fading to silence, and only replays if she scrolls back.
   - The first page fades in on the begin tap: that click is the
     only user gesture available to unlock audio.
   ============================================================ */
(function () {
  'use strict';

  var BASE_VOLUME = 0.55;
  var CROSS_MS = 900;
  var LOOP_FADE_S = 1.6;
  var TICK_MS = 50;
  var OPEN_MS = 5200;      /* how long the pill stays expanded after a change */
  var LAST_PAGE = 8;

  var TRACKS = [
    { page: 1, title: 'We Fell in Love in October' },
    { page: 2, title: 'Something About You' },
    { page: 3, title: "Isn't It Midnight (2017 Remastered)" },
    { page: 4, title: 'tek it x tek it' },
    { page: 5, title: '21' },
    { page: 6, title: 'Last Leaves of Autumn' },
    { page: 7, title: '[I Just] Died in Your Arms' },
    { page: 8, title: 'When Did You Realise' }
  ];

  /* section id -> page number, or 'silent' for the pages that bring
     their own audio. physics rides the gag locker's track. */
  var ROUTE = {
    birthday: 1,
    story: 2,
    quotes: 3,
    gags: 4,
    physics: 4,
    scratch: 5,
    album: 6,
    starmap: 7,
    reel: 'silent',
    world: 'silent',
    finale: 8
  };

  var elements = {};       /* page -> HTMLAudioElement */
  var endedFinal = {};     /* page -> the track played out on its own */
  var fades = [];
  var ticker = 0;
  var ratios = {};

  var activeSectionId = null;
  var sounding = null;     /* page currently audible, or null */
  var enabled = false;     /* armed by the begin tap */
  var userPaused = false;
  var displayedTitle = null;

  var playerEl = null;
  var btnEl = null;
  var titleEl = null;
  var openTimer = 0;

  function srcFor(page) {
    return 'assets/music/pages/page-' + page + '.mp3';
  }

  function titleFor(page) {
    var track = TRACKS[page - 1];
    return track ? track.title : '';
  }

  /* ---- Volume ramps ---- */

  function pump() {
    if (ticker) return;
    ticker = setInterval(function () {
      var now = performance.now();
      for (var i = fades.length - 1; i >= 0; i--) {
        var f = fades[i];
        var p = Math.min(1, (now - f.t0) / f.ms);
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        var v = f.from + (f.to - f.from) * e;
        try { f.el.volume = Math.max(0, Math.min(1, v)); } catch (err) { /* gone */ }
        if (p >= 1) {
          fades.splice(i, 1);
          if (f.pause && f.to === 0) { try { f.el.pause(); } catch (err2) {} }
          if (f.after) f.after();
        }
      }
      if (!fades.length) { clearInterval(ticker); ticker = 0; }
    }, TICK_MS);
  }

  function ramp(el, to, ms, pauseAtEnd, after) {
    for (var i = fades.length - 1; i >= 0; i--) {
      if (fades[i].el === el) fades.splice(i, 1);
    }
    fades.push({
      el: el,
      from: el.volume,
      to: to,
      ms: Math.max(1, ms),
      t0: performance.now(),
      pause: pauseAtEnd,
      after: after
    });
    pump();
  }

  /* ---- Track elements ---- */

  function ensureElement(page) {
    if (elements[page]) return elements[page];
    var el = new Audio();
    el.preload = 'metadata';
    el.src = srcFor(page);
    el.loop = false;       /* the loop seam is handled by hand, with a fade */
    el.volume = 0;
    el.__page = page;
    el.__seam = false;
    el.addEventListener('timeupdate', function () { onTimeUpdate(el); });
    el.addEventListener('ended', function () { onEnded(el); });
    elements[page] = el;
    return el;
  }

  function startTrack(el) {
    endedFinal[el.__page] = false;
    var end = isFinite(el.duration) && el.duration ? el.duration : Infinity;
    if (el.ended || (isFinite(end) && el.currentTime >= end - 0.15)) {
      try { el.currentTime = 0; } catch (e) { /* not seekable yet */ }
    }
    var p = el.play();
    if (p && p.catch) p.catch(function () { /* gesture / decode; next change retries */ });
    ramp(el, BASE_VOLUME, CROSS_MS, false, null);
  }

  function onTimeUpdate(el) {
    if (el.__seam || el.paused) return;
    if (el.__page !== sounding) return;
    if (!isFinite(el.duration) || !el.duration) return;
    var rem = el.duration - el.currentTime;
    if (rem > 0 && rem <= LOOP_FADE_S) {
      el.__seam = true;
      /* fade to zero but let the element reach its own end, so the
         restart is driven by 'ended' rather than a timer guess */
      ramp(el, 0, Math.max(160, rem * 1000), false, null);
    }
  }

  function onEnded(el) {
    el.__seam = false;
    var page = el.__page;
    if (page !== sounding || !enabled || userPaused) {
      try { el.volume = 0; } catch (e) { /* gone */ }
      return;
    }
    if (page === LAST_PAGE) {
      /* the last song of the night is allowed to end, in silence */
      endedFinal[page] = true;
      return;
    }
    try { el.currentTime = 0; } catch (e) { /* ignore */ }
    var p = el.play();
    if (p && p.catch) p.catch(function () {});
    ramp(el, BASE_VOLUME, LOOP_FADE_S * 1000, false, null);
  }

  /* ---- The player pill ---- */

  function openBriefly() {
    if (!playerEl) return;
    playerEl.classList.add('is-open');
    if (openTimer) clearTimeout(openTimer);
    openTimer = setTimeout(function () {
      openTimer = 0;
      if (playerEl) playerEl.classList.remove('is-open');
    }, OPEN_MS);
  }

  function setTitle(text) {
    if (displayedTitle === text) return;
    displayedTitle = text;
    if (titleEl) titleEl.textContent = text;
    openBriefly();
  }

  /* Shown only where this director actually owns the sound: hidden
     over the reel edits and the world song clips. */
  function playerShouldShow() {
    if (!enabled) return false;
    var key = ROUTE[activeSectionId];
    return typeof key === 'number';
  }

  function updatePlayer() {
    if (!playerEl) return;
    var show = playerShouldShow();
    playerEl.hidden = !show;
    if (!show) {
      playerEl.classList.remove('is-open');
      if (openTimer) { clearTimeout(openTimer); openTimer = 0; }
      return;
    }
    var key = ROUTE[activeSectionId];
    setTitle(titleFor(key));
    playerEl.classList.toggle('is-paused', userPaused);
    if (btnEl) {
      btnEl.setAttribute('aria-label', userPaused ? 'Resume music' : 'Pause music');
      var pauseIcon = btnEl.querySelector('.music-player__icon--pause');
      var playIcon = btnEl.querySelector('.music-player__icon--play');
      if (pauseIcon) pauseIcon.style.display = userPaused ? 'none' : '';
      if (playIcon) playIcon.style.display = userPaused ? '' : 'none';
    }
  }

  /* ---- Reconciliation ---- */

  function desiredPage() {
    if (!enabled || userPaused) return null;
    var key = ROUTE[activeSectionId];
    return typeof key === 'number' ? key : null;
  }

  function reconcile() {
    var want = desiredPage();

    if (want === sounding) {
      if (want !== null && !endedFinal[want]) {
        var same = elements[want];
        if (same && same.paused && !same.__seam) startTrack(same);
      }
      updatePlayer();
      return;
    }

    var prev = sounding;
    sounding = want;

    if (prev !== null && elements[prev]) {
      ramp(elements[prev], 0, CROSS_MS, true, null);
    }
    if (want !== null) {
      var el = ensureElement(want);
      el.preload = 'auto';
      if (want + 1 <= LAST_PAGE) ensureElement(want + 1); /* warm the next page */
      startTrack(el);
    }
    updatePlayer();
  }

  function start() {
    if (enabled) { if (userPaused) toggle(); return; }
    enabled = true;
    userPaused = false;
    reconcile();
  }

  function toggle() {
    if (!enabled) { start(); return; }
    userPaused = !userPaused;
    reconcile();
  }

  /* ---- Which page is on screen ---- */

  var io = null;

  function pickActive() {
    var best = null;
    var bestDist = Infinity;
    var vh = window.innerHeight || 1;
    Object.keys(ratios).forEach(function (id) {
      if (!ratios[id] || !(id in ROUTE)) return;
      var el = document.getElementById(id);
      if (!el) return;
      var rect = el.getBoundingClientRect();
      var dist = Math.abs(rect.top + rect.height / 2 - vh / 2);
      if (dist < bestDist) { bestDist = dist; best = id; }
    });
    if (best && best !== activeSectionId) {
      activeSectionId = best;
      reconcile();
    }
  }

  function onIntersect(entries) {
    entries.forEach(function (entry) {
      ratios[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
    });
    pickActive();
  }

  /* begin.js detaches #content-region until unlock, so the pages do
     not exist yet when this file runs — wait for data-unlocked. */
  function arm() {
    io = new IntersectionObserver(onIntersect, {
      threshold: [0, 0.2, 0.4, 0.6, 0.8, 1]
    });
    Object.keys(ROUTE).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
    pickActive();
    updatePlayer();
  }

  function wirePlayer() {
    playerEl = document.getElementById('music-player');
    btnEl = document.getElementById('music-control');
    titleEl = document.getElementById('music-title');
    if (btnEl) btnEl.addEventListener('click', toggle);
    if (playerEl) {
      var orb = playerEl.querySelector('.music-player__orb');
      if (orb) orb.addEventListener('click', toggle);
    }
  }

  function boot() {
    wirePlayer();
    if (document.documentElement.getAttribute('data-unlocked') === 'true') {
      arm();
      return;
    }
    var obs = new MutationObserver(function () {
      if (document.documentElement.getAttribute('data-unlocked') === 'true') {
        obs.disconnect();
        arm();
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-unlocked'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.SectionMusic = {
    start: start,
    toggle: toggle,
    pause: function () { if (enabled && !userPaused) toggle(); },
    isPlaying: function () { return enabled && !userPaused && sounding !== null; },
    tracks: TRACKS.map(function (t) { return { page: t.page, title: t.title, src: srcFor(t.page) }; })
  };

  window.__sectionMusic = {
    get enabled() { return enabled; },
    get paused() { return userPaused; },
    get section() { return activeSectionId; },
    get page() { return sounding; },
    get title() { return displayedTitle; },
    get playerVisible() { return !!playerEl && !playerEl.hidden; },
    get playerOpen() { return !!playerEl && playerEl.classList.contains('is-open'); },
    get element() {
      var el = sounding !== null ? elements[sounding] : null;
      if (!el) return null;
      return {
        tag: el.tagName,
        paused: el.paused,
        currentTime: el.currentTime,
        volume: el.volume,
        readyState: el.readyState,
        networkState: el.networkState,
        error: el.error ? el.error.code : null,
        src: el.currentSrc || el.getAttribute('src')
      };
    },
    get state() {
      var out = {};
      Object.keys(elements).forEach(function (page) {
        var el = elements[page];
        out[page] = { paused: el.paused, volume: Number(el.volume.toFixed(3)), t: Number(el.currentTime.toFixed(2)) };
      });
      return out;
    }
  };
})();
