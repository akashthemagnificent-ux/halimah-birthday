/* starmap — lazy procedural night sky for 26 Aug 2026.
   Deferred + IntersectionObserver-gated; no external library.
   Stars are procedural: no coordinates, city, or constellation data. */
(() => {
  'use strict';

  const SECTION_ID = 'starmap';
  const STAR_COUNT = 420;
  const TWINKLE_FPS_CAP = 30;
  /* personal site: full motion always */

  let frameHandle = null;
  let lastFrameAt = 0;

  function prefersReducedMotion() {
  return false; /* personal site: full motion */
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
        y: rand() * height * 0.92,
        radius: 0.4 + depth * 1.5,
        baseAlpha: 0.25 + rand() * 0.65,
        amplitude: 0.15 + rand() * 0.5,
        phase: rand() * Math.PI * 2,
        speed: 0.4 + rand() * 1.1,
        warmth: rand(),
      });
    }
    return stars;
  }

  function paintHorizon(ctx, width, height, rand) {
    const gradient = ctx.createLinearGradient(0, height * 0.55, 0, height);
    gradient.addColorStop(0, 'rgba(212, 168, 106, 0)');
    gradient.addColorStop(1, 'rgba(224, 124, 62, 0.16)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.moveTo(0, height);
    let ridge = height * 0.88;
    for (let x = 0; x <= width; x += Math.max(8, width / 40)) {
      ridge += (rand() - 0.5) * height * 0.02;
      ridge = Math.min(height * 0.94, Math.max(height * 0.82, ridge));
      ctx.lineTo(x, ridge);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10, 10, 20, 0.92)';
    ctx.fill();
  }

  function paintMilkyWay(ctx, width, height, rand) {
    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(-0.5);
    const band = ctx.createLinearGradient(0, -height * 0.5, 0, height * 0.5);
    band.addColorStop(0, 'rgba(232, 224, 216, 0)');
    band.addColorStop(0.5, 'rgba(232, 224, 216, 0.07)');
    band.addColorStop(1, 'rgba(232, 224, 216, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(-width, -height, width * 2, height * 2);
    ctx.restore();

    for (let i = 0; i < 90; i += 1) {
      const x = rand() * width;
      const y = height * 0.1 + rand() * height * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 0.3 + rand() * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240, 236, 232, ${0.05 + rand() * 0.12})`;
      ctx.fill();
    }
  }

  function paintStars(ctx, stars, width, height, timeSeconds) {
    for (const star of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(timeSeconds * star.speed + star.phase);
      const alpha = star.baseAlpha * (1 - star.amplitude + star.amplitude * twinkle);
      const red = 255;
      const green = Math.round(226 + star.warmth * 24);
      const blue = Math.round(196 + star.warmth * 40);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
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
    paintMilkyWay(ctx, width, height, seededRandom(26));
    paintStars(ctx, stars, width, height, 0);
    paintHorizon(ctx, width, height, seededRandom(1));
  }

  function renderFrame(ctx, width, height, stars, rand, timeSeconds) {
    ctx.clearRect(0, 0, width, height);
    paintMilkyWay(ctx, width, height, rand);
    paintStars(ctx, stars, width, height, timeSeconds);
    paintHorizon(ctx, width, height, rand);
  }

  function startSky(canvas, ctx, width, height, stars, rand) {
    const startedAt = performance.now();
    lastFrameAt = 0;
    const tick = (now) => {
      if (document.hidden) {
        frameHandle = requestAnimationFrame(tick);
        return;
      }
      if (lastFrameAt && now - lastFrameAt < 1000 / TWINKLE_FPS_CAP) {
        frameHandle = requestAnimationFrame(tick);
        return;
      }
      lastFrameAt = now;
      renderFrame(ctx, width, height, stars, rand, (now - startedAt) / 1000);
      frameHandle = requestAnimationFrame(tick);
    };
    frameHandle = requestAnimationFrame(tick);
  }

  function mount(section) {
    const canvas = section.querySelector('[data-starmap-canvas]');
    const fallback = section.querySelector('[data-starmap-fallback]');
    if (!canvas) return;

    let context = null;
    try {
      context = canvas.getContext('2d');
    } catch (error) {
      context = null;
    }
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const stars = buildStars(width, height, seededRandom(26));
    const rand = seededRandom(26);

    if (prefersReducedMotion()) {
      renderStatic(context, width, height, stars);
      canvas.classList.add('is-drawn');
      if (fallback) fallback.hidden = true;
      return;
    }

    renderStatic(context, width, height, stars);
    canvas.classList.add('is-drawn');
    if (fallback) fallback.hidden = true;
    startSky(canvas, context, width, height, stars, rand);
  }

  var mounted = false;
  function boot() {
    /* personal site: eager. Sections behind the begin-gate are detached
       until unlock, so retry until the node is connected, then mount. */
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
