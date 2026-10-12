/* starmap — "two nights the sky was watching" (redesigned).
   Full-bleed canvas starfield (decorative) + two CSS-3D nebula plates.
   Eager boot (personal site, full motion). GSAP ScrollTrigger drives the
   reveal + a scroll-scrubbed red-to-violet hue cross-fade + plate tilt.
   Stars are procedural: no coordinates, city, or constellation data. */
(() => {
  'use strict';

  const SECTION_ID = 'starmap';
  const STAR_COUNT = 460;
  const TWINKLE_FPS_CAP = 30;

  let frameHandle = null;
  let lastFrameAt = 0;
  let skyMix = 0; /* 0 = born (red), 1 = together (violet); scroll-driven */

  function prefersReducedMotion() {
    return false; /* personal site: full motion */
  }

  function hasGsap() {
    return (typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined');
  }

  function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function buildStars(width, height, rand) {
    const stars = [];
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const depth = rand();
      stars.push({
        x: rand() * width,
        y: rand() * height * 0.96,
        radius: 0.4 + depth * 1.6,
        baseAlpha: 0.22 + rand() * 0.68,
        amplitude: 0.15 + rand() * 0.5,
        phase: rand() * Math.PI * 2,
        speed: 0.4 + rand() * 1.1,
        warmth: rand(),
        par: 0.25 + depth * 0.75, /* parallax factor */
      });
    }
    return stars;
  }

  /* born = warm rose horizon; together = cool violet. `mix` lerps between. */
  function paintAmbient(ctx, width, height, rand, mix) {
    const g = ctx.createLinearGradient(0, height * 0.5, 0, height);
    const warm = [224, 124, 62], cool = [120, 110, 210];
    const r = Math.round(warm[0] + (cool[0] - warm[0]) * mix);
    const gr = Math.round(warm[1] + (cool[1] - warm[1]) * mix);
    const b = Math.round(warm[2] + (cool[2] - warm[2]) * mix);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0.16)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(-0.5);
    const band = ctx.createLinearGradient(0, -height * 0.5, 0, height * 0.5);
    band.addColorStop(0, 'rgba(232,224,216,0)');
    band.addColorStop(0.5, `rgba(232,224,216,${0.06 + mix * 0.02})`);
    band.addColorStop(1, 'rgba(232,224,216,0)');
    ctx.fillStyle = band;
    ctx.fillRect(-width, -height, width * 2, height * 2);
    ctx.restore();

    void rand;
  }

  function paintStars(ctx, stars, width, height, t, mix) {
    const px = Math.sin(t * 0.12) * 14 * (0.4 + mix * 0.6);
    const py = Math.cos(t * 0.09) * 8;
    for (const star of stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * star.speed + star.phase);
      const alpha = star.baseAlpha * (1 - star.amplitude + star.amplitude * tw);
      const x = star.x + px * star.par;
      const y = star.y + py * star.par;
      const red = 255;
      const green = Math.round(226 + star.warmth * 24 - mix * 20);
      const blue = Math.round(196 + star.warmth * 40 + mix * 40);
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
      ctx.fill();
    }
    for (const star of stars.slice(0, 6)) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius * 3.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232, 192, 136, 0.05)`;
      ctx.fill();
    }
  }

  function renderStatic(ctx, width, height, stars) {
    ctx.clearRect(0, 0, width, height);
    paintAmbient(ctx, width, height, seededRandom(26), skyMix);
    paintStars(ctx, stars, width, height, 0, skyMix);
  }

  function renderFrame(ctx, width, height, stars, t) {
    ctx.clearRect(0, 0, width, height);
    paintAmbient(ctx, width, height, seededRandom(26), skyMix);
    paintStars(ctx, stars, width, height, t, skyMix);
  }

  function startSky(canvas, ctx, width, height, stars) {
    const startedAt = performance.now();
    lastFrameAt = 0;
    const tick = (now) => {
      if (document.hidden || (lastFrameAt && now - lastFrameAt < 1000 / TWINKLE_FPS_CAP)) {
        frameHandle = requestAnimationFrame(tick);
        return;
      }
      lastFrameAt = now;
      renderFrame(ctx, width, height, stars, (now - startedAt) / 1000);
      frameHandle = requestAnimationFrame(tick);
    };
    frameHandle = requestAnimationFrame(tick);
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

    let context = null;
    try { context = canvas.getContext('2d'); } catch (error) { context = null; }
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const stars = buildStars(width, height, seededRandom(26));

    if (prefersReducedMotion()) {
      renderStatic(context, width, height, stars);
      canvas.classList.add('is-drawn');
      if (fallback) fallback.hidden = true;
      return;
    }

    renderStatic(context, width, height, stars);
    canvas.classList.add('is-drawn');
    if (fallback) fallback.hidden = true;
    startSky(canvas, context, width, height, stars);
    if (hasGsap()) armMotion(section);
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

  window.addEventListener('pagehide', () => {
    if (frameHandle !== null) cancelAnimationFrame(frameHandle);
    frameHandle = null;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
