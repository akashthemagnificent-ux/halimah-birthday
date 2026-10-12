/* starmap — "two nights the sky was watching" (redesigned).
   Full-bleed canvas starfield (decorative) + two CSS-3D nebula plates.
   Eager boot (personal site, full motion). GSAP ScrollTrigger drives the
   reveal + a scroll-scrubbed red-to-violet hue cross-fade + plate tilt.
   Stars are procedural: no coordinates, city, or constellation data. */
(() => {
  'use strict';

  const SECTION_ID = 'starmap';

  let skyMix = 0; /* 0 = born (red), 1 = together (violet); scroll-driven */

  function prefersReducedMotion() {
    return false; /* personal site: full motion */
  }

  function hasGsap() {
    return (typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined');
  }

  /* Two-night palette: warm rose (born) drifting to cool violet (together).
     The Galaxy shader is procedural and texture-free, so it stays file://-safe. */
  function initGalaxy(container) {
    if (typeof window.GalaxyBackground !== 'function') return null;
    return window.GalaxyBackground({
      container: container,
      starColors: ['#ffd9c2', '#ffb3a0', '#c9b8ff', '#8f9bff'],
      density: 1.15,
      speed: 0.85,
      starSpeed: 0.6,
      hueShift: skyMix * 60,
      glowIntensity: 0.32,
      twinkleIntensity: 0.42,
      rotationSpeed: 0.08,
      layers: 5,
      transparent: true,
      backgroundColor: '#05050a',
      clickWarp: true,
      mouseRepulsion: true,
      repulsionStrength: 1.6,
      intro: true
    });
  }

  /* GSAP layer: reveal, scroll-scrubbed hue cross-fade, 3D plate tilt + pointer parallax. */
  function armMotion(section) {
    const g = window.gsap;
    document.documentElement.classList.add('js-starmap');
    g.registerPlugin(window.ScrollTrigger);
    g.to(section.querySelector('.starmap__intro'), { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' });
    g.to(section.querySelectorAll('.starmap__plate'), {
      opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { trigger: section.querySelector('.starmap__plates'), start: 'top 82%' },
    });
    /* hue cross-fade + gentle 3D rotateX as the section scrolls through */
    window.ScrollTrigger.create({
      trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1.1,
      onUpdate: (self) => { skyMix = self.progress; },
    });
    const plates = section.querySelectorAll('.starmap__plate');
    plates.forEach((plate) => {
      g.fromTo(plate, { rotateX: 7 }, {
        rotateX: -4, ease: 'none',
        scrollTrigger: { trigger: plate, start: 'top bottom', end: 'bottom top', scrub: 1 },
      });
    });
    /* pointer parallax on the media cards */
    const media = section.querySelectorAll('.starmap__plate-media');
    const setters = [];
    media.forEach((m) => {
      setters.push({
        rx: g.quickTo(m, 'rotationX', { duration: 0.5, ease: 'power3.out' }),
        ry: g.quickTo(m, 'rotationY', { duration: 0.5, ease: 'power3.out' }),
      });
    });
    section.addEventListener('pointermove', (e) => {
      const rect = section.getBoundingClientRect();
      const dx = (e.clientX - rect.left) / rect.width - 0.5;
      const dy = (e.clientY - rect.top) / rect.height - 0.5;
      setters.forEach((s) => { s.ry(dx * 10); s.rx(-dy * 8); });
    });
  }

  function mount(section) {
    const canvas = section.querySelector('[data-starmap-canvas]');
    const fallback = section.querySelector('[data-starmap-fallback]');
    if (!canvas) return;

    const container = section.querySelector('[data-starmap-galaxy]') || canvas.parentElement;
    const galaxy = initGalaxy(container);

    if (!galaxy) {
      /* WebGL2 / vendor unavailable: keep the fallback visible, no draw mark. */
      return;
    }

    /* The section can be gated (detached) at init, so the container measures 0x0
       and the backing store was clamped to 1x1. Re-sync once we are connected. */
    const resync = () => { if (section.isConnected) galaxy.resize(); };
    resync();

    /* Real draw path reached: mark the canvas drawn and drop the fallback. */
    canvas.classList.add('is-drawn');
    if (fallback) fallback.hidden = true;

    if (hasGsap()) armMotion(section);

    window.addEventListener('pagehide', () => galaxy.destroy(), { once: true });
  }

  var mounted = false;
  function boot() {
    var section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || mounted) {
      window.setTimeout(boot, 150);
      return;
    }
    mounted = true;
    mount(section);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
