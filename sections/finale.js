/* finale — ember-night galaxy + masked heading + scramble lede.
   Progressive: the letter is plain HTML and fully readable without this
   file. This script only adds the sealed-state class, the unseal tap
   handler (rising heart/star sparkles), and the keepsake downloads
   (letter rendered to a PNG via canvas, the five reel gifts as
   original mp4s) — plus decorative upgrades that degrade
   to the readable static letter when any vendor is missing:
   GalaxyBackground ember starfield, MaskedHeading headline (procedural
   gradient fill), ScrambledText lede, envelope pointer tilt, IO reveals.
   Boot and unseal wiring follow the world.js conventions. */

(() => {
  'use strict';

  var SECTION_ID = 'finale';

  /* ---- Ember-night galaxy backdrop (starmap-proven vendor, new palette) ---- */
  function upgradeGalaxy(section) {
    var mount = section.querySelector('[data-finale-galaxy]');
    if (!mount || typeof window.GalaxyBackground !== 'function') return;
    try {
      window.GalaxyBackground({
        container: mount,
        starColors: ['#ffd9a8', '#f0984a', '#e07c3e', '#ff6f91'],
        density: 1.1,
        speed: 0.7,
        starSpeed: 0.5,
        hueShift: 18,
        glowIntensity: 0.3,
        twinkleIntensity: 0.4,
        rotationSpeed: 0.07,
        layers: 5,
        transparent: true,
        backgroundColor: '#1a1410',
        clickWarp: true,
        mouseRepulsion: true,
        repulsionStrength: 1.5,
        intro: true
      });
    } catch (e) { /* gradient fallback stays */ }
    window.addEventListener('pagehide', function () {
      try { if (mount.__galaxy) mount.__galaxy.destroy(); } catch (e) {}
    });
  }

  /* ---- Masked heading (needs gsap; falls back to the static h2) ---- */
  function upgradeHeading(section) {
    var mount = section.querySelector('[data-finale-heading]');
    if (!mount || typeof window.MaskedHeading !== 'function' || !window.gsap) return;
    var fb = mount.querySelector('.finale__headline');
    var headingText = fb ? (fb.textContent || '').trim() : 'one last thing, zai';
    if (!headingText) headingText = 'one last thing, zai';
    try {
      window.MaskedHeading(mount, {
        text: headingText,
        tag: 'h2',
        palette: ['#1a1410', '#e07c3e', '#f0984a', '#ffd166', '#f5ebe0'],
        weight: 500,
        align: 'center',
        reveal: 'rise',
        trigger: 'view'
      });
    } catch (e) { /* static h2 stays readable */ }
    if (!mount.querySelector('.masked-heading')) {
      mount.innerHTML = '<h2 class="finale__headline"></h2>';
      mount.firstChild.textContent = headingText;
    }
  }

  /* ---- Scramble lede (vanilla vendor, same opts as the world posters) ---- */
  function upgradeScramble(section) {
    if (typeof window.ScrambledText !== 'function') return;
    var nodes = Array.prototype.slice.call(section.querySelectorAll('[data-scramble]'));
    nodes.forEach(function (node) {
      try { window.ScrambledText(node, { radius: 120, duration: 1.1, speed: 34, scrambleChars: '.:' }); }
      catch (e) { /* plain lede stays readable */ }
    });
  }

  /* ---- Envelope pointer tilt (world holo-card pattern, gentler range) ---- */
  function upgradeTilt(section) {
    var frame = section.querySelector('.finale__envelope');
    if (!frame || frame.__tilt) return;
    frame.addEventListener('pointermove', function (e) {
      var r = frame.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      frame.style.transform =
        'perspective(900px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' + (x * 6).toFixed(2) + 'deg)';
    });
    frame.addEventListener('pointerleave', function () { frame.style.transform = ''; });
    frame.__tilt = true;
  }

  /* ---- Scroll reveals (world observeReveals pattern) ---- */
  function observeReveals(section) {
    var targets = Array.prototype.slice.call(
      section.querySelectorAll('.finale__eyebrow, .finale__heading, .finale__lede, .finale__keepsakes')
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
    /* Swiftshader can starve IO callbacks and single-shot timers alike, so
       a repeating sweep: arms is-in for anything actually on screen, and
       forces the end state on armed targets whose transition never ticks. */
    var sweeps = 0;
    var sweep = window.setInterval(function () {
      sweeps++;
      var pending = false;
      targets.forEach(function (el) {
        if (!el.classList.contains('is-in')) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight * 0.92 && r.bottom > 0) {
            el.classList.add('is-in');
            io.unobserve(el);
          } else {
            pending = true;
          }
        } else if (parseFloat(window.getComputedStyle(el).opacity) < 0.95) {
          el.style.transition = 'none';
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
      });
      if (!pending || sweeps > 40) window.clearInterval(sweep);
    }, 500);
  }

  /* ---- Unseal sparkles: hearts + stars rise off the opened letter ---- */
  var SPARKLE_PALETTE = ['#e07c3e', '#f0984a', '#f5ebe0', '#ffd166', '#ff6f91'];
  var SPARKLE_GLYPHS = ['\u2665', '\u2726', '\u2661', '\u2727'];

  function floatKeepsakeSparkles(stage) {
    if (!stage) return;
    for (var i = 0; i < 20; i += 1) {
      var s = document.createElement('span');
      s.className = 'finale__sparkle';
      s.textContent = SPARKLE_GLYPHS[i % SPARKLE_GLYPHS.length];
      s.style.left = (4 + Math.random() * 92) + '%';
      s.style.color = SPARKLE_PALETTE[i % SPARKLE_PALETTE.length];
      s.style.fontSize = (13 + Math.random() * 14) + 'px';
      s.style.animationDelay = (Math.random() * 0.55) + 's';
      s.addEventListener('animationend', function () { this.remove(); });
      stage.appendChild(s);
    }
  }

  /* ---- Keepsake downloads ---- */
  var reelEl = document.getElementById('reel');
  var ASSET_BASE = (reelEl && reelEl.getAttribute('data-reel-assets')) || 'assets/reel/';
  var GIFT_SRCS = [
    ASSET_BASE + 'gift-1.mp4',
    ASSET_BASE + 'gift-2.mp4',
    ASSET_BASE + 'gift-3.mp4',
    ASSET_BASE + 'gift-4.mp4',
    ASSET_BASE + 'gift-5.mp4'
  ];

  function downloadGifts() {
    GIFT_SRCS.forEach(function (src, i) {
      window.setTimeout(function () {
        var a = document.createElement('a');
        a.href = src;
        a.download = 'halimah-gift-' + (i + 1) + '.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 650);
    });
  }

  function buildLetterPng(letter, done) {
    var W = 900;
    var MARGIN = 64;
    var rootStyle = window.getComputedStyle(document.documentElement);
    var display = (rootStyle.getPropertyValue('--font-display') || '').trim() || 'Georgia, serif';
    var mono = (rootStyle.getPropertyValue('--font-mono') || '').trim() || 'ui-monospace, monospace';
    var paraEl = letter.querySelector('.finale__para');
    var paraPx = parseFloat(paraEl ? window.getComputedStyle(paraEl).fontSize : '') || 17;
    var rectW = letter.getBoundingClientRect().width || 608;
    var r = Math.max(1.2, Math.min(2.4, (W - 2 * MARGIN) / Math.max(1, rectW)));
    function scale(px) { return Math.round(px * r); }
    var lineH = Math.round(scale(paraPx) * 1.78);
    var maxW = W - 2 * MARGIN;

    function textOf(node) {
      var out = '';
      var kids = node.childNodes;
      for (var i = 0; i < kids.length; i += 1) {
        var k = kids[i];
        if (k.nodeType === 1 && k.tagName === 'Q') out += '\u201C' + (k.textContent || '') + '\u201D';
        else out += k.textContent || '';
      }
      return out.replace(/\s+/g, ' ').trim();
    }

    var blocks = [];
    var dateline = letter.querySelector('.finale__dateline');
    var salutation = letter.querySelector('.finale__salutation');
    var paras = letter.querySelectorAll('.finale__para');
    var signoff = letter.querySelector('.finale__signoff');
    var sources = letter.querySelector('.finale__sources');
    if (dateline) blocks.push({ t: textOf(dateline), f: '500 ' + scale(12) + 'px ' + mono, c: '#8c7660', x: 'center', sp: 32, ls: true });
    if (salutation) blocks.push({ t: textOf(salutation), f: 'italic 300 ' + scale(22) + 'px ' + display, c: '#4a3424', x: 'left', sp: scale(30) });
    for (var p = 0; p < paras.length; p += 1) {
      var vow = paras[p].classList.contains('finale__vow');
      blocks.push({
        t: textOf(paras[p]),
        f: (vow ? 'italic 400 ' : '300 ') + scale(vow ? 19 : 17) + 'px ' + display,
        c: vow ? '#7a3a20' : '#3a2c20',
        x: vow ? 'center' : 'left',
        sp: lineH,
        rule: vow
      });
    }
    if (signoff) blocks.push({ t: textOf(signoff), f: '300 ' + scale(18) + 'px ' + display, c: '#34261c', x: 'left', sp: lineH + scale(16) });
    if (sources) {
      var srcP = sources.querySelector('p') || sources;
      blocks.push({ t: textOf(srcP), f: scale(13) + 'px ' + display, c: '#8c7660', x: 'center', sp: scale(18) });
    }

    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    var lines = blocks.map(function (b) {
      ctx.font = b.f;
      var words = b.t.split(' ');
      var rows = [];
      var row = '';
      for (var i = 0; i < words.length; i += 1) {
        var test = row ? row + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxW && row) { rows.push(row); row = words[i]; }
        else row = test;
      }
      if (row) rows.push(row);
      return rows;
    });
    var total = MARGIN + 28;
    for (var bi = 0; bi < blocks.length; bi += 1) {
      total += lines[bi].length * blocks[bi].sp + (blocks[bi].rule ? scale(40) : 0) + scale(12);
    }
    total += MARGIN + 24;
    cv.width = W;
    cv.height = Math.min(Math.ceil(total), 3200);

    var bg = ctx.createLinearGradient(0, 0, 0, cv.height);
    bg.addColorStop(0, '#f8f1e2');
    bg.addColorStop(0.55, '#f4ecd9');
    bg.addColorStop(1, '#eee4cf');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#c4ab8a';
    ctx.lineWidth = 3;
    ctx.strokeRect(34, 34, cv.width - 68, cv.height - 68);
    ctx.lineWidth = 1;
    ctx.strokeRect(48, 48, cv.width - 96, cv.height - 96);
    ctx.fillStyle = '#be7846';
    ctx.font = '24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u2726', 82, 92);
    ctx.fillText('\u2726', cv.width - 82, 92);
    ctx.fillText('\u2726', 82, cv.height - 64);
    ctx.fillText('\u2726', cv.width - 82, cv.height - 64);
    ctx.textAlign = 'left';

    var y = MARGIN + 24;
    for (var j = 0; j < blocks.length; j += 1) {
      var b2 = blocks[j];
      ctx.font = b2.f;
      ctx.fillStyle = b2.c;
      for (var li = 0; li < lines[j].length; li += 1) {
        if (b2.x === 'center' || b2.ls) {
          ctx.textAlign = 'center';
          ctx.fillText(lines[j][li], cv.width / 2, y);
          ctx.textAlign = 'left';
        } else {
          ctx.fillText(lines[j][li], MARGIN, y);
        }
        y += b2.sp;
      }
      if (b2.rule) {
        y += scale(8);
        ctx.strokeStyle = '#c8aa82';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cv.width * 0.22, y);
        ctx.lineTo(cv.width * 0.78, y);
        ctx.stroke();
        y += scale(14);
      }
      y += scale(12);
      if (j === 0) {
        ctx.strokeStyle = '#d2c0a2';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cv.width / 2 - scale(60), y - scale(6));
        ctx.lineTo(cv.width / 2 + scale(60), y - scale(6));
        ctx.stroke();
      }
      if (y > cv.height - MARGIN / 2) break;
    }
    try {
      cv.toBlob(function (blob) { done(blob || null); }, 'image/png');
    } catch (e) {
      try { done(cv.toDataURL('image/png') || null); }
      catch (e2) { done(null); }
    }
  }

  function wireKeepsakes(section) {
    var pngBtn = section.querySelector('[data-finale-letter-png]');
    var giftsBtn = section.querySelector('[data-finale-gifts]');
    var letter = section.querySelector('[data-finale-letter]');
    if (pngBtn && letter) {
      pngBtn.addEventListener('click', function () {
        if (pngBtn.disabled) return;
        pngBtn.disabled = true;
        var label = pngBtn.textContent;
        pngBtn.textContent = 'painting it\u2026';
        var safety = window.setTimeout(function () {
          pngBtn.disabled = false;
          pngBtn.textContent = label;
        }, 15000);
        var finish = function (blobOrUrl) {
          window.clearTimeout(safety);
          pngBtn.disabled = false;
          pngBtn.textContent = label;
          if (!blobOrUrl) return;
          var isUrl = typeof blobOrUrl === 'string';
          var url = isUrl ? blobOrUrl : URL.createObjectURL(blobOrUrl);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'halimah-birthday-letter.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (!isUrl) window.setTimeout(function () { URL.revokeObjectURL(url); }, 6000);
        };
        window.setTimeout(function () {
          try {
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(function () {
                try { buildLetterPng(letter, finish); }
                catch (e) { finish(null); }
              });
            } else {
              buildLetterPng(letter, finish);
            }
          } catch (e) { finish(null); }
        }, 0);
      });
    }
    if (giftsBtn) {
      giftsBtn.addEventListener('click', function () {
        if (giftsBtn.disabled) return;
        giftsBtn.disabled = true;
        var label = giftsBtn.textContent;
        giftsBtn.textContent = 'sending them over\u2026';
        downloadGifts();
        window.setTimeout(function () {
          giftsBtn.disabled = false;
          giftsBtn.textContent = label;
        }, GIFT_SRCS.length * 650 + 400);
      });
    }
  }

  var wired = false;
  function init() {
    /* personal site: eager — retry until the gated section is connected. */
    var section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || wired) {
      if (!wired) window.setTimeout(init, 150);
      return;
    }
    wired = true;

    document.documentElement.classList.add('js-finale');

    upgradeGalaxy(section);
    upgradeHeading(section);
    upgradeScramble(section);
    upgradeTilt(section);
    observeReveals(section);
    wireKeepsakes(section);

    var stage = section.querySelector('[data-finale-stage]');
    var openBtn = section.querySelector('[data-finale-open]');

    if (stage && openBtn) {
      openBtn.addEventListener('click', function () {
        stage.classList.add('is-open');
        floatKeepsakeSparkles(stage);
        var letter = section.querySelector('[data-finale-letter]');
        if (letter) {
          letter.setAttribute('tabindex', '-1');
          letter.focus({ preventScroll: true });
        }
        /* Failsafe: if the compositor stalls CSS transitions (software
           GL, old devices), force the letter content visible anyway.
           Repeating ticks survive timer starvation: once resolved the
           interval clears itself; transition is killed before the force
           so a live transition cannot pin computed style at its start. */
        var ticks = 0;
        var guard = window.setInterval(function () {
          ticks++;
          if (!stage.classList.contains('is-open') || !letter) {
            if (ticks > 40) window.clearInterval(guard);
            return;
          }
          var nodes = letter.querySelectorAll('.finale__dateline, .finale__salutation, .finale__para, .finale__signoff, .finale__sources, .finale__sign-names');
          var allGood = true;
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.classList.contains('finale__sign-names')) {
              if (window.getComputedStyle(n).clipPath.indexOf('100%') !== -1) {
                n.style.transition = 'none';
                n.style.clipPath = 'inset(0)';
              } else continue;
              allGood = false;
              continue;
            }
            if (parseFloat(window.getComputedStyle(n).opacity) < 0.95) {
              n.style.transition = 'none';
              n.style.opacity = '1';
              n.style.transform = 'none';
              allGood = false;
            }
          }
          if (allGood || ticks > 40) window.clearInterval(guard);
        }, 400);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
