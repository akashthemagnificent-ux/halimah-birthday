(function () {
  'use strict';

  var TARGET_TIME_ZONE = 'Europe/London';
  var TARGET_YEAR = 2026;
  var TARGET_MONTH = 10;
  var TARGET_DAY = 19;

  // Music is owned by js/section-music.js: one song per page, crossfaded.
  // begin.js only arms and toggles it — the tap below is the sole gesture
  // that can unlock audio, so the director's first fade-in hangs off it.
  var MUSIC_AUDIO_ID = 'bgm';

  // Locked/begin/unlock copy lives in index.html markup, not here, so it stays
  // readable and translatable without touching this script.
  var MESSAGES = {
    playFallback: 'music needs one more tap',
    musicMissing: 'music file not added yet'
  };

  var dom = {};
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

  function setAudioState(state) {
    dom.audioState = state;
    document.documentElement.setAttribute('data-audio', state);
  }

  function music() {
    return (window.SectionMusic && typeof window.SectionMusic.start === 'function')
      ? window.SectionMusic
      : null;
  }

  function startMusic() {
    hidePlayFallback();

    var m = music();
    if (!m) {
      // Director failed to load: nothing can produce sound, so say so rather
      // than leaving a silent tap with no explanation.
      setAudioState('error');
      showPlayFallback(MESSAGES.musicMissing);
      return;
    }

    // Called inside the click handler on purpose: the first play() must land
    // in the same task as the user gesture or the browser blocks it.
    try {
      m.start();
    } catch (err) {
      setAudioState('blocked');
      showPlayFallback(MESSAGES.playFallback);
      return;
    }

    setAudioState('playing');
    hidePlayFallback();
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

    // Countdown retired with the 19 Oct wait: the tap that starts the
    // music also unlocks the site — no waiting room in between.
    countdownDone = true;
    onCountdownComplete();
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

    // The 19 Oct wait is retired (she gets it on the day itself): never
    // auto-complete on load — the begin tap below is the only gate left.
    document.documentElement.setAttribute('data-locked', 'true');

    beginButton.addEventListener('click', startExperience);
    if (playFallbackButton) {
      playFallbackButton.addEventListener('click', function () { startMusic(); });
    }
    // #music-control is wired by js/section-music.js (it owns the director).

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
      var m = music();
      return !!(m && m.isPlaying());
    },
    get audioElement() {
      // The element the director is actually playing: this is the real
      // proof of playback, not a log line.
      var live = window.__sectionMusic && window.__sectionMusic.element;
      if (live) return live;
      var el = document.getElementById(MUSIC_AUDIO_ID);
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
