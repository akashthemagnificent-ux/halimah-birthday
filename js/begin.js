(function () {
  'use strict';

  var TARGET_TIME_ZONE = 'Europe/London';
  var TARGET_YEAR = 2026;
  var TARGET_MONTH = 10;
  var TARGET_DAY = 19;

  // Music slot owned by todo 6: the <audio> element already lives in index.html.
  var MUSIC_AUDIO_ID = 'bgm';
  var MUSIC_FALLBACK_SRC = 'assets/music/song.mp3';

  // Locked/begin/unlock copy lives in index.html markup, not here, so it stays
  // readable and translatable without touching this script.
  var MESSAGES = {
    playFallback: 'music needs one more tap',
    musicMissing: 'music file not added yet'
  };

  var dom = {};
  var howl = null;
  var rafId = 0;
  var unlocked = false;
  var countdownDone = false;

  function zonedParts(date, timeZone) {
    var fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    var out = {};
    fmt.formatToParts(date).forEach(function (p) {
      if (p.type !== 'literal') out[p.type] = p.value;
    });
    return {
      year: Number(out.year),
      month: Number(out.month),
      day: Number(out.day),
      hour: Number(out.hour) % 24,
      minute: Number(out.minute),
      second: Number(out.second)
    };
  }

  // Two-pass offset correction: guess the instant, read the zone's offset there,
  // correct, re-read. The second pass settles the answer across a DST transition
  // (London leaves BST for GMT on 25 Oct 2026, after our 19 Oct target, so the
  // target itself resolves to BST = UTC+1 -> 2026-10-18T23:00:00Z).
  function targetInstant(timeZone, year, month, day) {
    var midnightUtcFields = Date.UTC(year, month - 1, day, 0, 0, 0);
    var guess = midnightUtcFields;

    for (var pass = 0; pass < 2; pass++) {
      var p = zonedParts(new Date(guess), timeZone);
      var asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
      guess = midnightUtcFields - (asIfUtc - guess);
    }

    return new Date(guess);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function renderCountdown(target, now) {
    var remaining = Math.max(0, target.getTime() - now.getTime());
    var totalSeconds = Math.floor(remaining / 1000);

    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    dom.countdownValue.textContent =
      days + 'd ' + pad2(hours) + 'h ' + pad2(minutes) + 'm ' + pad2(seconds) + 's';

    // Only mirror the coarse value into an attribute; a per-frame aria-live
    // update would talk over a screen reader 60 times a second.
    if (days !== dom.lastAnnouncedDay) {
      dom.lastAnnouncedDay = days;
      dom.countdownLabel.setAttribute(
        'data-remaining-days',
        String(days)
      );
    }

    return remaining;
  }

  function lockContent() {
    dom.contentRegion.setAttribute('data-locked', 'true');
    // Detached, not just hidden: `hidden` leaves every section's text in
    // the document, so a DOM dump or view-source would still leak the story.
    while (dom.contentRegion.firstChild) {
      dom.lockedFragment.appendChild(dom.contentRegion.firstChild);
    }
  }

  function unlockContent() {
    // lockContent() drained the region into the fragment in document order, so
    // appending them straight back restores that exact order. The region holds
    // nothing else while locked, so appendChild is the right primitive here.
    while (dom.lockedFragment.firstChild) {
      dom.contentRegion.appendChild(dom.lockedFragment.firstChild);
    }
    dom.contentRegion.removeAttribute('data-locked');
  }

  function motion() {
    return window.Motion || null;
  }

  function burst() {
    var m = motion();
    if (m) { m.burst(); return; }
  }

  function cannon() {
    var m = motion();
    if (m) { m.fireworks(); return; }
  }

  function showPlayFallback(reason) {
    dom.playFallback.hidden = false;
    dom.playFallbackReason.textContent = reason;
  }

  function hidePlayFallback() {
    dom.playFallback.hidden = true;
  }

  function syncMusicControl(playing) {
    var control = dom.musicControl;
    if (!control) return;
    control.hidden = !playing;
    control.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    var pauseIcon = control.querySelector('.music-control__icon--pause');
    var playIcon = control.querySelector('.music-control__icon--play');
    if (pauseIcon) pauseIcon.style.display = playing ? '' : 'none';
    if (playIcon) playIcon.style.display = playing ? 'none' : '';
  }

  function startMusic() {
    hidePlayFallback();

    var audioEl = document.getElementById(MUSIC_AUDIO_ID);
    if (!audioEl) {
      showPlayFallback(MESSAGES.musicMissing);
      return;
    }
    var src = audioEl.getAttribute('src') || MUSIC_FALLBACK_SRC;

    if (typeof window.Howl !== 'function') {
      // Howler failed to load: fall back to the element's own play() so the
      // gesture still produces sound instead of silence.
      audioEl.setAttribute('src', src);
      playViaElement(audioEl);
      return;
    }

    // Constructed inside the click handler on purpose: the first Howl() and the
    // first play() must land in the same task as the user gesture, or the
    // browser blocks the audio context. No audio is touched outside this path.
    // Howler is given `src` (not `node`): with `node:` Howler 2.2.4 leaves
    // `_sounds` empty, so `howl.playing()` throws on a missing .length.
    howl = new window.Howl({
      src: [src],
      loop: true,
      volume: 0.6,
      // html5:true streams through a real <audio> element (better for a long
      // loop on a phone) and gives QA an inspectable element for real state.
      html5: true,
      onplay: function () {
        dom.audioState = 'playing';
        document.documentElement.setAttribute('data-audio', 'playing');
        hidePlayFallback();
        syncMusicControl(true);
      },
      onplayerror: function (id, err) {
        dom.audioState = 'error';
        document.documentElement.setAttribute('data-audio', 'error');
        showPlayFallback(MESSAGES.musicMissing);
        if (window.console && console.warn) {
          console.warn('[begin] music could not start:', err);
        }
      },
      onpause: function () {
        dom.audioState = 'paused';
        document.documentElement.setAttribute('data-audio', 'paused');
        syncMusicControl(false);
      },
      onresume: function () {
        dom.audioState = 'playing';
        document.documentElement.setAttribute('data-audio', 'playing');
        syncMusicControl(true);
      },
      onloaderror: function () {
        dom.audioState = 'error';
        document.documentElement.setAttribute('data-audio', 'error');
        showPlayFallback(MESSAGES.musicMissing);
      }
    });

    var playAttempt;
    try {
      playAttempt = howl.play();
    } catch (err) {
      dom.audioState = 'blocked';
      document.documentElement.setAttribute('data-audio', 'blocked');
      showPlayFallback(MESSAGES.playFallback);
      return;
    }

    // Howler returns a sound id synchronously, but a context blocked by the
    // autoplay policy rejects a promise instead, so guard both shapes.
    if (playAttempt && typeof playAttempt.then === 'function') {
      playAttempt.then(null, function (err) {
        dom.audioState = 'blocked';
        document.documentElement.setAttribute('data-audio', 'blocked');
        showPlayFallback(
          err && err.name === 'NotAllowedError'
            ? MESSAGES.playFallback
            : MESSAGES.musicMissing
        );
      });
    }
  }

  function playViaElement(audioEl) {
    try {
      var p = audioEl.play();
      if (p && typeof p.then === 'function') {
        p.then(function () {
          dom.audioState = 'playing';
          document.documentElement.setAttribute('data-audio', 'playing');
          syncMusicControl(true);
        }, function (err) {
          dom.audioState = 'blocked';
          document.documentElement.setAttribute('data-audio', 'blocked');
          showPlayFallback(
            err && err.name === 'NotAllowedError'
              ? MESSAGES.playFallback
              : MESSAGES.musicMissing
          );
        });
      }
    } catch (err) {
      showPlayFallback(MESSAGES.playFallback);
    }
  }

  function toggleMusic() {
    if (!howl) { startMusic(); return; }
    if (isHowlPlaying()) {
      howl.pause();
    } else {
      howl.play();
    }
  }

  function isHowlPlaying() {
    try {
      return !!(howl && typeof howl.playing === 'function' && howl.playing());
    } catch (err) {
      return false;
    }
  }

  function tick() {
    var target = dom.target;
    var now = new Date();
    // Admin preview: ?preview=1 forces the unlock path so the owner can
    // review the full site before 19 Oct. Inert on the real link (no param).
    var preview = false;
    try {
      var loc = window.location;
      preview = /(?:^|[?&])preview=1(?:&|$)/.test(loc.search || '');
      // Local opens are always the owner reviewing: double-clicking the file
      // or serving the folder locally must show the full site without a param.
      // The real hosted link (any other origin) keeps the countdown gate.
      if (!preview && (loc.protocol === 'file:' ||
          loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' ||
          loc.hostname === '[::1]')) {
        preview = true;
      }
    } catch (err) { preview = false; }
    var remaining = preview ? 0 : renderCountdown(target, now);

    if (remaining <= 0 && !countdownDone) {
      countdownDone = true;
      window.cancelAnimationFrame(rafId);
      rafId = 0;
      onCountdownComplete();
      return;
    }

    rafId = window.requestAnimationFrame(tick);
  }

  function onCountdownComplete() {
    dom.countdownPanel.hidden = true;
    dom.beginOverlay.hidden = true;
    // The countdown sky has done its job: take the whole section out of flow
    // so the first thing in view is the story, never an empty sky.
    var countdownSection = document.getElementById('countdown');
    if (countdownSection) countdownSection.hidden = true;
    if (dom.lockedFragment.hasChildNodes() || dom.contentRegion.hasChildNodes()) {
      unlockContent();
      // The story was detached while locked, so the cue inside it survived too.
      var cue = dom.contentRegion.querySelector('.arrival-cue');
      if (cue) cue.hidden = false;
    }
    unlocked = true;
    document.documentElement.setAttribute('data-unlocked', 'true');
    cannon();
  }

  function startExperience() {
    if (dom.started) return;
    dom.started = true;

    startMusic();
    burst();

    dom.beginOverlay.hidden = true;

    if (unlocked) return;

    if (countdownDone) {
      onCountdownComplete();
      return;
    }

    dom.countdownPanel.hidden = false;
    if (!rafId) rafId = window.requestAnimationFrame(tick);
  }

  function boot() {
    var beginOverlay = document.getElementById('begin-overlay');
    var beginButton = document.getElementById('begin-button');
    var countdownPanel = document.getElementById('countdown-panel');
    var countdownValue = document.getElementById('countdown-value');
    var countdownLabel = document.getElementById('countdown-label');
    var playFallback = document.getElementById('play-fallback');
    var playFallbackReason = document.getElementById('play-fallback-reason');
    var playFallbackButton = document.getElementById('play-fallback-button');
    var musicControl = document.getElementById('music-control');
    var contentRegion = document.getElementById('content-region');
    var lockedFragment = document.createDocumentFragment();

    if (!beginOverlay || !beginButton || !countdownPanel || !contentRegion) {
      if (window.console && console.warn) {
        console.warn('[begin] required nodes missing; gate not armed');
      }
      return;
    }

    dom = {
      beginOverlay: beginOverlay,
      beginButton: beginButton,
      countdownPanel: countdownPanel,
      countdownValue: countdownValue,
      countdownLabel: countdownLabel,
      playFallback: playFallback,
      playFallbackReason: playFallbackReason,
      playFallbackButton: playFallbackButton,
      musicControl: musicControl,
      contentRegion: contentRegion,
      lockedFragment: lockedFragment,
      lastAnnouncedDay: null,
      started: false,
      audioState: 'idle',
      target: targetInstant(TARGET_TIME_ZONE, TARGET_YEAR, TARGET_MONTH, TARGET_DAY)
    };

    document.documentElement.setAttribute(
      'data-countdown-target',
      dom.target.toISOString()
    );
    document.documentElement.setAttribute(
      'data-countdown-timezone',
      TARGET_TIME_ZONE
    );

    lockContent();

    var past = new Date().getTime() >= dom.target.getTime();
    if (past) {
      onCountdownComplete();
    } else {
      document.documentElement.setAttribute('data-locked', 'true');
      renderCountdown(dom.target, new Date());
    }

    beginButton.addEventListener('click', startExperience);
    if (playFallbackButton) {
      playFallbackButton.addEventListener('click', function () { startMusic(); });
    }
    if (musicControl) {
      musicControl.addEventListener('click', toggleMusic);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden || countdownDone || !dom.started) return;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(tick);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.__beginGate = {
    get target() { return dom.target ? dom.target.toISOString() : null; },
    get timeZone() { return TARGET_TIME_ZONE; },
    get audioState() { return dom.audioState || 'idle'; },
    get unlocked() { return unlocked; },
    get countdownDone() { return countdownDone; },
    get musicPlaying() {
      return isHowlPlaying();
    },
    get audioElement() {
      // The element Howler actually created, when it has one: this is the
      // real proof of playback, not a log line.
      var el = null;
      try {
        var sound = howl && howl._sounds && howl._sounds[0];
        if (sound && sound._node && typeof sound._node.getAttribute === 'function') {
          el = sound._node;
        }
      } catch (err) { el = null; }
      if (!el) el = document.getElementById(MUSIC_AUDIO_ID);
      if (!el || typeof el.getAttribute !== 'function') return null;
      return {
        tag: el.tagName,
        paused: el.paused,
        currentTime: el.currentTime,
        readyState: el.readyState,
        networkState: el.networkState,
        error: el.error ? el.error.code : null,
        src: el.currentSrc || el.getAttribute('src')
      };
    },
    get fallbackVisible() {
      return !!dom.playFallback && !dom.playFallback.hidden;
    },
    get contentChildCount() {
      return dom.contentRegion ? dom.contentRegion.childElementCount : -1;
    }
  };
})();
