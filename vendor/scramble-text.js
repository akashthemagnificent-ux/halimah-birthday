/* world: scramble-text (port of reactbits TextAnimations/ScrambledText).
   Pointer distance drives a per-character scramble that resolves back
   when the cursor leaves, same feel as the reactbits component. The
   original relies on GSAP SplitText + ScrambleTextPlugin; this vanilla
   port splits the characters itself and tweens them with one rAF loop,
   so it works from file:// with no extra plugins. Props follow the
   original: radius, duration, speed, scrambleChars. */
(function () {
  'use strict';

  var GLYPHS = '.:';

  function ScrambledText(el, options) {
    if (!el || el.__scramble) return;
    var o = options || {};
    var radius = o.radius != null ? o.radius : 110;
    var duration = o.duration != null ? o.duration : 1.1;
    var speed = o.speed != null ? o.speed : 34; /* glyph changes per second */
    var glyphs = o.scrambleChars || GLYPHS;
    var text = el.textContent || '';
    if (!text) return;

    el.textContent = '';
    var chars = [];
    var count = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === ' ') {
        el.appendChild(document.createTextNode(' '));
        continue;
      }
      var span = document.createElement('span');
      span.className = 'world__char';
      span.textContent = ch;
      el.appendChild(span);
      chars.push({ el: span, fin: ch, idx: count, until: 0, glyphAt: 0 });
      count++;
    }
    if (!chars.length) return;

    var raf = 0;
    var last = 0;

    function frame(now) {
      raf = 0;
      var still = false;
      var iv = 1000 / speed;
      for (var k = 0; k < chars.length; k++) {
        var c = chars[k];
        if (c.until <= now) {
          if (c.el.textContent !== c.fin) c.el.textContent = c.fin;
          continue;
        }
        still = true;
        if (now >= c.glyphAt) {
          c.glyphAt = now + iv;
          c.el.textContent = glyphs.charAt((Math.random() * glyphs.length) | 0);
        }
      }
      last = now;
      if (still) raf = requestAnimationFrame(frame);
    }

    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    var zone = el.closest ? (el.closest('.world__ticket') || el) : el;

    function onMove(e) {
      var now = performance.now();
      for (var k = 0; k < chars.length; k++) {
        var c = chars[k];
        var r = c.el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius) {
          var d = duration * Math.max(0.12, 1 - dist / radius);
          c.until = now + d * 1000;
          c.glyphAt = 0;
        }
      }
      kick();
    }

    function onLeave() {
      var now = performance.now();
      for (var k = 0; k < chars.length; k++) {
        var c = chars[k];
        if (c.until > now) c.until = now + 180;
      }
      kick();
    }

    zone.addEventListener('pointermove', onMove);
    zone.addEventListener('pointerleave', onLeave);

    el.__scramble = {
      destroy: function () {
        zone.removeEventListener('pointermove', onMove);
        zone.removeEventListener('pointerleave', onLeave);
        if (raf) cancelAnimationFrame(raf);
        el.textContent = text;
        el.__scramble = null;
      }
    };
    return el.__scramble;
  }

  window.ScrambledText = ScrambledText;
})();
