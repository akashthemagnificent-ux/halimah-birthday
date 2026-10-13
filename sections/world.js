/* world: her world, the archive (todo 13).
   Boots the interactive archive. Every component is an enhancement
   over the static markup already in index.html, guarded by typeof
   checks so a missing vendor never breaks the page. No reduced-motion
   gate: this personal site always runs full motion. Reveal only arms
   once the html.js-world class is set. */
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
    var headingText = fb ? (fb.textContent || '').trim() : 'know these, know her';
    if (!headingText) headingText = 'know these, know her';
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

  /* ---- Holographic centerpiece card ---- */
  function upgradeHolo(section) {
    var mount = section.querySelector('[data-world-holo]');
    if (!mount || typeof window.HoloCard !== 'function') return;
    var stat = mount.querySelector('.world__holo-static');
    var name = stat ? (stat.textContent || '').trim() : '';
    if (!name) name = text('.world__name', 'Isagi Rin', section);
    mount.innerHTML = '';
    try {
      var card = window.HoloCard(mount, {
        preset: 'rainbow',
        width: 300,
        intensity: 0.9,
        alt: name
      });
      if (card && card.root) {
        var label = document.createElement('span');
        label.className = 'world__holo-name';
        label.textContent = name;
        card.root.appendChild(label);
      } else {
        restore();
      }
    } catch (e) { restore(); }

    function restore() {
      mount.innerHTML = '<span class="world__holo-static"></span>';
      mount.firstChild.textContent = name;
    }
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

  /* ---- Glitch horror titles ---- */
  function upgradeGlitch(section) {
    if (typeof window.GlitchText !== 'function') return;
    var nodes = Array.prototype.slice.call(section.querySelectorAll('[data-glitch]'));
    nodes.forEach(function (node) {
      var t = (node.textContent || '').trim();
      if (!t) return;
      node.textContent = '';
      try { window.GlitchText(node, { text: t, speed: 0.6, hover: false }); }
      catch (e) { node.textContent = t; }
      if (!node.querySelector('.glitch')) node.textContent = t;
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
    upgradeGlitch(section);
    upgradeBento(section);
    upgradeHeart(section);
    observeReveals(section);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
