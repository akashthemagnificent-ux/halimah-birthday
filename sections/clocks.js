/* ============================================================
   clocks — the live counters that close the site.

   Numbers are DOM text; three.js (added in the next task) draws
   only the rings behind them. This file owns the truth:

   - Every frame recomputes from Date.now(). Nothing is
     accumulated, so a phone that slept for six hours shows the
     correct value on its first frame back.
   - The loop only runs while the section is on screen and the
     document is visible.
   - With no WebGL the numbers still tick, over the CSS ground.
   ============================================================ */
(function () {
  'use strict';

  var M = window.ClocksMath;
  if (!M) return;

  var srTickAt = 0;         /* last minute boundary written to .sr-only */
  var section = null;
  var stage = null;
  var blocks = [];
  var running = false;
  var rafId = 0;

  function readBlocks() {
    var out = [];
    var nodes = document.querySelectorAll('#clocks [data-milestone]');
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      var id = el.getAttribute('data-milestone');
      var milestone = null;
      for (var j = 0; j < window.MILESTONES.length; j += 1) {
        if (window.MILESTONES[j].id === id) { milestone = window.MILESTONES[j]; break; }
      }
      if (!milestone) continue;
      out.push({
        id: id,
        el: el,
        milestone: milestone,
        days: el.querySelector('[data-unit="days"]'),
        hours: el.querySelector('[data-unit="hours"]'),
        minutes: el.querySelector('[data-unit="minutes"]'),
        seconds: el.querySelector('[data-unit="seconds"]'),
        sr: el.querySelector('[data-clocks-sr]'),
        worldY: 0
      });
    }
    return out;
  }

  function paint(block, state) {
    var p = state.parts;
    if (block.days) block.days.textContent = String(p.days);
    if (block.hours) block.hours.textContent = M.pad2(p.hours);
    if (block.minutes) block.minutes.textContent = M.pad2(p.minutes);
    if (block.seconds) block.seconds.textContent = M.pad2(p.seconds);
  }

  function paintAria(block, state) {
    if (!block.sr) return;
    block.sr.textContent = M.formatAria(state.parts) + ' ' +
      (state.direction === 'up' ? 'and counting' : 'to go');
  }

  /* Recompute everything for `nowMs`. Exposed so the scene loop
     can drive the numbers from the same clock it animates. */
  function tickNow(nowMs) {
    var states = [];
    for (var i = 0; i < blocks.length; i += 1) {
      var state = M.milestoneState(blocks[i].milestone, nowMs, M.TZ);
      paint(blocks[i], state);
      states.push(state);
    }
    /* The screen-reader sentence changes once a minute, not once a
       second — announcing a number every tick is hostile. */
    if (nowMs - srTickAt >= 60000) {
      srTickAt = nowMs;
      for (var k = 0; k < blocks.length; k += 1) paintAria(blocks[k], states[k]);
    }
    return states;
  }

  function frame() {
    if (!running) return;
    tickNow(Date.now());
    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function boot() {
    section = document.getElementById('clocks');
    if (!section || !window.MILESTONES) return;
    stage = section.querySelector('[data-clocks-stage]');
    blocks = readBlocks();
    if (!blocks.length) return;

    tickNow(Date.now());

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i += 1) {
          if (entries[i].isIntersecting) start(); else stop();
        }
      }, { rootMargin: '100%' });
      io.observe(section);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); } else { tickNow(Date.now()); start(); }
    });

    window.ClocksPage = {
      rings: blocks,
      stage: stage,
      section: section,
      tickNow: tickNow,
      start: start,
      stop: stop,
      M: M
    };

    window.dispatchEvent(new CustomEvent('clocks:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
