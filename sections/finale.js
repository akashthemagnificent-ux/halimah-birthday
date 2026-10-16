/* finale — ember-night galaxy + masked heading + scramble lede (todo 12 rebuild).
   Progressive: the letter is plain HTML and fully readable without this
   file. This script only adds the sealed-state class, the unseal tap
   handler, and the print trigger — plus decorative upgrades that degrade
   to the readable static letter when any vendor is missing:
   GalaxyBackground ember starfield, MaskedHeading headline (procedural
   gradient fill), ScrambledText lede, envelope pointer tilt, IO reveals.
   Boot and unseal/print wiring follow the world.js conventions. */

(() => {
  'use strict';

  var SECTION_ID = 'finale';

  function fireFinaleConfetti() {
    if (window.Motion) window.Motion.fireworks();
  }

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
    if (window.Motion) window.Motion.wireReplay();

    upgradeGalaxy(section);
    upgradeHeading(section);
    upgradeScramble(section);
    upgradeTilt(section);
    observeReveals(section);

    var stage = section.querySelector('[data-finale-stage]');
    var openBtn = section.querySelector('[data-finale-open]');
    var printBtn = section.querySelector('[data-finale-print]');

    if (stage && openBtn) {
      openBtn.addEventListener('click', function () {
        stage.classList.add('is-open');
        fireFinaleConfetti();
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

    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
