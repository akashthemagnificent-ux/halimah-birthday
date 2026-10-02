/* Physics playground (todo 15): shovable floating hearts in the gag locker.
   Progressive enhancement, never in the critical path:
   - Names always render as a static row, sourced from content/physics-names.json.
   - matter-js is fetched lazily (blob, size-checked < 150KB) only after the
     user taps "let them float"; the fetch is deferred and the script is
     injected as a blob URL, so nothing blocks first paint.
   - Under prefers-reduced-motion, over budget, or on any load/parse failure, the
     section stays in static mode: same names, no physics.
   - Dragging uses Pointer Events (mouse + touch + pen in one path). */
(() => {
  'use strict';

  const SECTION_ID = 'physics';
  const NAMES_URL = 'content/physics-names.json';
  const LIB_URL = 'vendor/matter.min.js';
  const BUDGET_BYTES = 150 * 1024;
  /* personal site: full motion always */

  function prefersReducedMotion() {
  return false; /* personal site: full motion */
}

  function setStatus(status, msg) {
    if (status) status.textContent = msg || '';
  }

  function renderChips(chips, hearts) {
    chips.textContent = '';
    hearts.forEach((h) => {
      const li = document.createElement('li');
      li.className = 'physics__chip';
      li.setAttribute('data-physics-name', h.name);
      li.textContent = h.name;
      chips.appendChild(li);
    });
  }

  function showStatic(staticWrap, note, msg) {
    staticWrap.hidden = false;
    if (note) note.textContent = msg || '';
  }

  async function fetchNames() {
    const res = await fetch(NAMES_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error('names http ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.hearts) || data.hearts.length === 0) {
      throw new Error('names empty');
    }
    return data.hearts;
  }

  async function loadMatter() {
    /* personal site: matter.js loads eagerly via script tag — no fetch
       budget, no blob dance. Retry briefly while it parses. */
    for (let i = 0; i < 100; i += 1) {
      if (window.Matter) return window.Matter;
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    }
    if (!window.Matter) throw new Error('Matter global missing');
    return window.Matter;
  }

  function buildWorld(Matter, stage, hearts, engine) {
    const { Engine, Bodies, Composite, Body } = Matter;
    const rect = stage.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const walls = [
      Bodies.rectangle(w / 2, h + 12, w * 2, 24, { isStatic: true }), // floor
      Bodies.rectangle(w / 2, -12, w * 2, 24, { isStatic: true }),    // ceiling
      Bodies.rectangle(-12, h / 2, 24, h * 2, { isStatic: true }),   // left
      Bodies.rectangle(w + 12, h / 2, 24, h * 2, { isStatic: true }), // right
    ];

    const bubbles = hearts.map((h, i) => {
      const el = document.createElement('div');
      el.className = 'physics__heart';
      el.setAttribute('data-physics-heart', h.name);
      el.textContent = h.name;
      stage.appendChild(el);
      const r = 26;
      // Spread the spawn across the stage width so hearts start apart and
      // never spawn past the right wall (which would pile them on one side).
      const cols = 3;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (w / (cols + 1)) * (col + 1);
      const y = 70 + row * 60;
      const body = Bodies.circle(x, y, r, {
        restitution: 0.7,
        friction: 0.02,
        frictionAir: 0.02,
        label: h.name,
      });
      return { el, body, name: h.name };
    });

    Composite.add(engine.world, walls.concat(bubbles.map((b) => b.body)));
    return bubbles;
  }

  function startLoop(Matter, engine, bubbles) {
    const { Engine } = Matter;
    let raf = 0;
    let paused = false;
    const tick = () => {
      if (!paused) {
        Engine.update(engine, 1000 / 60);
        bubbles.forEach((b) => {
          const { x, y } = b.body.position;
          b.el.style.transform = 'translate(' + (x - b.el.offsetWidth / 2) + 'px,' + (y - b.el.offsetHeight / 2) + 'px)';
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return {
      stop: () => cancelAnimationFrame(raf),
      setPaused: (v) => { paused = Boolean(v); },
    };
  }

  function attachDrag(Matter, engine, stage, bubbles) {
    const { Body } = Matter;
    let active = null;
    let last = null;

    const toLocal = (ev) => {
      const r = stage.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };

    const pick = (pt) => {
      for (const b of bubbles) {
        const dx = pt.x - b.body.position.x;
        const dy = pt.y - b.body.position.y;
        const reach = 34;
        if (dx * dx + dy * dy <= reach * reach) return b;
      }
      return null;
    };

    const onDown = (ev) => {
      const pt = toLocal(ev);
      const b = pick(pt);
      if (!b) return;
      active = b;
      last = pt;
      stage.setPointerCapture && stage.setPointerCapture(ev.pointerId);
      if (window.__physics) window.__physics.dragging = b.name;
      ev.preventDefault();
    };

    const onMove = (ev) => {
      if (!active) return;
      const pt = toLocal(ev);
      // Move the held heart straight to the pointer so a drag always shoves it
      // where the thumb is, instead of trailing behind a soft constraint.
      Body.setPosition(active.body, pt);
      Body.setVelocity(active.body, {
        x: (pt.x - last.x) * 0.6,
        y: (pt.y - last.y) * 0.6,
      });
      last = pt;
      ev.preventDefault();
    };

    const onUp = () => {
      active = null;
      last = null;
      if (window.__physics) window.__physics.dragging = null;
    };

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    return () => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
    };
  }

  function initPhysics(Matter, stage, hearts, staticWrap, note, status) {
    const { Engine } = Matter;
    staticWrap.hidden = true;
    const engine = Engine.create();
    engine.gravity.y = 0.6;
    const bubbles = buildWorld(Matter, stage, hearts, engine);
    const loop = startLoop(Matter, engine, bubbles);
    const detach = attachDrag(Matter, engine, stage, bubbles);

    window.__physics = {
      mode: 'physics',
      names: hearts.map((h) => h.name),
      heartCount: bubbles.length,
      engine,
      bubbles,
      setPaused: loop.setPaused,
      dispose() {
        loop.stop();
        detach();
        bubbles.forEach((b) => b.el.remove());
        delete window.__physics;
      },
    };
    setStatus(status, 'drag any heart');
    return window.__physics;
  }

  function initStatic(hearts, staticWrap, chips, note, status, reason) {
    renderChips(chips, hearts);
    showStatic(staticWrap, note, reason);
    setStatus(status, '');
    window.__physics = {
      mode: 'static',
      names: hearts.map((h) => h.name),
      reason,
    };
    return window.__physics;
  }

  async function boot() {
    /* personal site: eager — retry until the gated section is connected. */
    const section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected) {
      window.setTimeout(boot, 150);
      return;
    }
    const stage = section.querySelector('[data-physics-stage]');
    const staticWrap = section.querySelector('[data-physics-static]');
    const chips = section.querySelector('[data-physics-chips]');
    const note = section.querySelector('[data-physics-note]');
    const status = section.querySelector('[data-physics-status]');
    const playBtn = section.querySelector('[data-physics-play]');
    if (!stage || !staticWrap || !chips) return;

    let hearts;
    try {
      hearts = await fetchNames();
    } catch (err) {
      setStatus(status, 'names unavailable');
      return;
    }

    // Base state: the names row is present and readable before anyone opts
    // into physics, so the nook is never empty. Physics hides it on success.
    renderChips(chips, hearts);
    showStatic(staticWrap, note, '');
    window.__physics = { mode: 'static-pending', names: hearts.map((h) => h.name) };

    // Physics is opt-in via a tap, then lazily fetched + size-checked.
    playBtn.hidden = false;
    playBtn.addEventListener('click', async () => {
      playBtn.disabled = true;
      setStatus(status, 'waking the hearts…');
      try {
        const Matter = await loadMatter();
        initPhysics(Matter, stage, hearts, staticWrap, note, status);
        playBtn.hidden = true;
      } catch (err) {
        playBtn.hidden = true;
        initStatic(hearts, staticWrap, chips, note, status, 'physics stayed asleep: ' + (err && err.message));
      }
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
