/* ============================================================
   clocks-core — pure date math for the clocks page.

   No DOM, no WebGL, no globals beyond one UMD export. Kept
   separate from sections/clocks.js so the arithmetic can be
   unit-tested under Node (qa/clocks-core.test.mjs) — this is
   the part of the page that can be silently wrong for months.

   Every calendar boundary is resolved in Europe/London, using
   the same two-pass offset correction as js/begin.js:54, so
   the clocks flip at the same instant the countdown gate did.
   ============================================================ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.ClocksMath = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TZ = 'Europe/London';

  var FMT = null;
  function formatter() {
    if (!FMT) {
      FMT = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      });
    }
    return FMT;
  }

  function zonedParts(date, tz) {
    var f = (tz === TZ || !tz) ? formatter()
      : new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false
        });
    var out = {};
    var parts = f.formatToParts(date);
    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].type !== 'literal') out[parts[i].type] = parts[i].value;
    }
    return {
      year: Number(out.year),
      month: Number(out.month),
      day: Number(out.day),
      hour: Number(out.hour) % 24,
      minute: Number(out.minute),
      second: Number(out.second)
    };
  }

  /* Two-pass offset correction: guess the instant, read the zone's
     offset there, correct, re-read. The second pass settles the
     answer across a DST transition. */
  function instantFor(year, month, day, tz) {
    var midnightUtcFields = Date.UTC(year, month - 1, day, 0, 0, 0);
    var guess = midnightUtcFields;
    for (var pass = 0; pass < 2; pass += 1) {
      var p = zonedParts(new Date(guess), tz || TZ);
      var asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
      guess = midnightUtcFields - (asIfUtc - guess);
    }
    return new Date(guess);
  }

  function decompose(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60
    };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* Next occurrence of month/day strictly after `nowMs`. Recomputed
     from scratch every call, so no stored state can go stale. */
  function nextAnnual(month, day, nowMs, tz) {
    var p = zonedParts(new Date(nowMs), tz);
    var candidate = instantFor(p.year, month, day, tz);
    if (candidate.getTime() <= nowMs) {
      candidate = instantFor(p.year + 1, month, day, tz);
    }
    return candidate;
  }

  function milestoneState(milestone, nowMs, tz) {
    var zone = tz || TZ;
    var ms = 0;
    var direction = 'down';

    if (milestone.mode === 'elapsed') {
      var since = instantFor(milestone.anchor.y, milestone.anchor.m, milestone.anchor.d, zone);
      ms = Math.max(0, nowMs - since.getTime());
      direction = 'up';
    } else if (milestone.mode === 'annual') {
      var next = nextAnnual(milestone.anchor.m, milestone.anchor.d, nowMs, zone);
      ms = Math.max(0, next.getTime() - nowMs);
      direction = 'down';
    } else {
      var target = instantFor(milestone.target.y, milestone.target.m, milestone.target.d, zone);
      var delta = target.getTime() - nowMs;
      if (delta > 0) {
        ms = delta;
        direction = 'down';
      } else {
        ms = Math.abs(delta);   /* abs, not -delta: -0 is a negative zero */
        direction = 'up';
      }
    }

    return {
      ms: ms,
      direction: direction,
      parts: decompose(ms),
      progress: lapProgress(nowMs, zone, milestone.lap)
    };
  }

  /* How far through the current lap we are. Each ring turns at a
     rate that means something: a day, an hour, a minute. */
  function lapProgress(nowMs, tz, lap) {
    var p = zonedParts(new Date(nowMs), tz || TZ);
    if (lap === 'minute') return p.second / 60;
    if (lap === 'hour') return (p.minute * 60 + p.second) / 3600;
    return (p.hour * 3600 + p.minute * 60 + p.second) / 86400;
  }

  function plural(n, word) { return n === 1 ? word : word + 's'; }

  function formatAria(parts) {
    return parts.days + ' ' + plural(parts.days, 'day') + ', ' +
      parts.hours + ' ' + plural(parts.hours, 'hour') + ', ' +
      parts.minutes + ' ' + plural(parts.minutes, 'minute') + ' and ' +
      parts.seconds + ' ' + plural(parts.seconds, 'second');
  }

  return {
    TZ: TZ,
    zonedParts: zonedParts,
    instantFor: instantFor,
    decompose: decompose,
    lapProgress: lapProgress,
    milestoneState: milestoneState,
    formatAria: formatAria,
    pad2: pad2
  };
}));
