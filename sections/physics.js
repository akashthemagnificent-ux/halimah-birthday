/* ============================================================
   physics — bonus corner: a tiny orbit of us (todo 15).

   Two engines, one moment:
   - matter-js SIMULATES: five heart bodies with zero gravity, a
     radial spring pulling each toward the ring, a constant tangential
     drive, and soft mutual repulsion. Flicks and drags are real
     impulses on real bodies.
   - three.js RENDERS: extruded 3D hearts with names painted on
     canvas sprites, comet trails, a glowing medallion core, slow
     camera drift + pointer parallax.

   Progressive enhancement: names always render first as a static
   row from content/physics-names.js (plain global, file:// safe).
   The orbit only replaces it after the user taps "wake the orbit"
   AND both vendor globals exist AND a WebGL context survives.
   On any failure the static row stays: same names, no motion.
   Personal site: full motion always, matter loads eager via tag.
   ============================================================ */
(() => {
  'use strict';

  const SECTION_ID = 'physics';
  const NAMES_URL = 'content/physics-names.json';
  const TAU = Math.PI * 2;

  /* her hearts rose, his hearts amber — from the names manifest owner */
  const TONE = { her: 0xe2605e, you: 0xf0984a };
  const TONE_CSS = { her: '#e2605e', you: '#f0984a' };

  function prefersReducedMotion() {
    return false; /* personal site: full motion */
  }

  function makeRandom(seed) {
    let s = seed >>> 0 || 1;
    return function next() {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  }

  function setStatus(status, msg) {
    if (status) status.textContent = msg || '';
  }

  /* ---------------- static fallback (always works) ---------------- */

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
    /* content/physics-names.js ships a plain global so this works on file:// */
    const pre = window.PHYSICS_NAMES;
    if (pre && Array.isArray(pre.hearts) && pre.hearts.length) return pre.hearts;
    const res = await fetch(NAMES_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error('names http ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.hearts) || data.hearts.length === 0) {
      throw new Error('names empty');
    }
    return data.hearts;
  }

  function loadMatter() {
    /* matter.js loads eagerly via script tag — retry briefly while it parses. */
    return (async () => {
      for (let i = 0; i < 100; i += 1) {
        if (window.Matter) return window.Matter;
        await new Promise((resolve) => window.setTimeout(resolve, 60));
      }
      if (!window.Matter) throw new Error('Matter global missing');
      return window.Matter;
    })();
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

  /* ---------------- 3D label sprites ---------------- */

  function paintLabel(canvas, name, toneCss) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const r = H / 2 - 4;
    const x0 = 4;
    const x1 = W - 4;
    ctx.beginPath();
    ctx.moveTo(x0 + r, 4);
    ctx.lineTo(x1 - r, 4);
    ctx.arc(x1 - r, H / 2, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x0 + r, H - 4);
    ctx.arc(x0 + r, H / 2, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(26, 20, 16, 0.78)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(224, 124, 62, 0.85)';
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = toneCss;
    ctx.font = '600 54px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText('\u2665', 34, H / 2 + 3);
    ctx.fillStyle = '#f5ebe0';
    ctx.font = '600 46px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(name, 104, H / 2 + 2);
  }

  function makeLabel(THREE, name, toneCss) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    paintLabel(canvas, name, toneCss);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.8, 0.45, 1);
    sprite.renderOrder = 10;
    return { sprite, repaint: () => { paintLabel(canvas, name, toneCss); tex.needsUpdate = true; } };
  }

  /* ---------------- extruded heart geometry ---------------- */

  function makeHeartGeometry(THREE) {
    const s = new THREE.Shape();
    s.moveTo(0.5, 0.5);
    s.bezierCurveTo(0.5, 0.5, 0.4, 0, 0, 0);
    s.bezierCurveTo(-0.6, 0, -0.6, 0.7, -0.6, 0.7);
    s.bezierCurveTo(-0.6, 1.1, -0.3, 1.54, 0.5, 1.9);
    s.bezierCurveTo(1.3, 1.54, 1.6, 1.1, 1.6, 0.7);
    s.bezierCurveTo(1.6, 0.7, 1.6, 0, 1.0, 0);
    s.bezierCurveTo(0.7, 0, 0.5, 0.5, 0.5, 0.5);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.34, bevelEnabled: true,
      bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, steps: 1,
    });
    geo.translate(-0.5, -0.95, -0.17);
    geo.scale(0.62, 0.62, 0.62);
    geo.computeVertexNormals();
    return geo;
  }

  function makeGlowTexture(THREE, inner, outer) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ---------------- the orbit ---------------- */

  function initOrbit(Matter, THREE, section, stage, canvas, hearts, staticWrap, note, status) {
    const rand = makeRandom(90210);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas, alpha: true, antialias: true,
        powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false,
      });
    } catch (err) {
      return null;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.8, 11.4);
    camera.lookAt(0, 0.1, 0);

    scene.add(new THREE.AmbientLight(0xffe9d0, 0.55));
    const dir = new THREE.DirectionalLight(0xfff4e4, 0.85);
    dir.position.set(4, 6, 6);
    scene.add(dir);
    const core = new THREE.PointLight(0xf0984a, 9, 24, 1.6);
    core.position.set(0, 0.6, 0.6);
    scene.add(core);

    /* medallion: the glow everything circles */
    const world = new THREE.Group();
    scene.add(world);
    const medal = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
    );
    world.add(medal);
    const glowTex = makeGlowTexture(THREE, 'rgba(255, 217, 160, 1)', 'rgba(240, 152, 74, 0.35)');
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(4.4, 4.4, 1);
    world.add(glow);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.02, 12, 96),
      new THREE.MeshStandardMaterial({
        color: 0xe07c3e, emissive: 0xe07c3e, emissiveIntensity: 0.55,
        metalness: 0.6, roughness: 0.35,
      })
    );
    ring.rotation.x = -0.08;
    world.add(ring);

    /* soft starfield behind the orbit */
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i += 1) {
      starPos[i * 3] = (rand() - 0.5) * 30;
      starPos[i * 3 + 1] = (rand() - 0.5) * 18;
      starPos[i * 3 + 2] = -6 - rand() * 10;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xf5ebe0, size: 0.07, transparent: true, opacity: 0.65,
      depthWrite: false,
    }));
    scene.add(stars);

    /* ---- matter world: real bodies in view-sized units ---- */
    const engine = Matter.Engine.create();
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    const half = { x: 4, y: 3 };
    let ringR = 3.1;
    const wallOpts = { isStatic: true, friction: 0, restitution: 0.5 };
    const walls = {
      top: Matter.Bodies.rectangle(0, 0, 10, 1, wallOpts),
      bottom: Matter.Bodies.rectangle(0, 0, 10, 1, wallOpts),
      left: Matter.Bodies.rectangle(0, 0, 1, 10, wallOpts),
      right: Matter.Bodies.rectangle(0, 0, 1, 10, wallOpts),
    };
    Matter.Composite.add(engine.world, [walls.top, walls.bottom, walls.left, walls.right]);

    function layoutSim() {
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const vHalfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      const vHalfW = vHalfH * (w / h);
      half.x = vHalfW;
      half.y = vHalfH;
      ringR = Math.max(1.6, Math.min(3.1, vHalfW - 1.3, vHalfH - 0.9));
      const t = 4; /* thick: no tunneling at capped fling speeds */
      Matter.Body.setPosition(walls.top, { x: 0, y: half.y + t / 2 });
      Matter.Body.setPosition(walls.bottom, { x: 0, y: -half.y - t / 2 });
      Matter.Body.setPosition(walls.left, { x: -half.x - t / 2, y: 0 });
      Matter.Body.setPosition(walls.right, { x: half.x + t / 2, y: 0 });
      const topVerts = [
        { x: -half.x - t, y: half.y }, { x: half.x + t, y: half.y },
        { x: half.x + t, y: half.y + t }, { x: -half.x - t, y: half.y + t },
      ];
      Matter.Body.setVertices(walls.top, topVerts);
      Matter.Body.setVertices(walls.bottom, topVerts.map((v) => ({ x: v.x, y: -v.y })));
      const sideVerts = [
        { x: half.x, y: -half.y - t }, { x: half.x + t, y: -half.y - t },
        { x: half.x + t, y: half.y + t }, { x: half.x, y: half.y + t },
      ];
      Matter.Body.setVertices(walls.left, sideVerts.map((v) => ({ x: -v.x, y: v.y })));
      Matter.Body.setVertices(walls.right, sideVerts);
      ring.scale.setScalar(ringR);
    }
    layoutSim();

    /* ---- hearts: one body + one mesh + label + trail each ---- */
    const heartGeo = makeHeartGeometry(THREE);
    const items = hearts.map((h, i) => {
      const tone = TONE[h.owner] || TONE.you;
      const toneCss = TONE_CSS[h.owner] || TONE_CSS.you;
      const a = (i / hearts.length) * TAU + rand() * 0.5;
      const x = Math.cos(a) * ringR;
      const y = Math.sin(a) * ringR * 0.72;
      const body = Matter.Bodies.circle(x, y, 0.5, {
        frictionAir: 0.035, friction: 0.02, restitution: 0.5, label: h.name,
      });
      Matter.Body.setVelocity(body, {
        x: -Math.sin(a) * 1.2, y: Math.cos(a) * 1.2,
      });
      const mesh = new THREE.Mesh(heartGeo, new THREE.MeshStandardMaterial({
        color: tone, emissive: tone, emissiveIntensity: 0.28,
        metalness: 0.25, roughness: 0.4,
      }));
      const s0 = 0.72 + rand() * 0.18;
      mesh.scale.setScalar(s0);
      world.add(mesh);
      const label = makeLabel(THREE, h.name, toneCss);
      world.add(label.sprite);
      const trailLen = 20;
      const trailGeo = new THREE.BufferGeometry();
      const trailArr = new Float32Array(trailLen * 3);
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailArr, 3));
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
        color: tone, transparent: true, opacity: 0.42,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      trail.frustumCulled = false;
      world.add(trail);
      return {
        name: h.name, tone, body, mesh, label, trail, trailArr,
        baseScale: s0, phase: rand() * TAU, pop: 0, hist: [],
      };
    });
    Matter.Composite.add(engine.world, items.map((it) => it.body));

    /* entrance: hearts drop in just under the top edge, staggered, then
       the ring catches them — always spawned INSIDE the walls */
    items.forEach((it, i) => {
      Matter.Body.setPosition(it.body, {
        x: -half.x * 0.7 + (i / Math.max(1, items.length - 1)) * half.x * 1.4,
        y: half.y - 0.9 - (i % 2) * 0.8,
      });
      Matter.Body.setVelocity(it.body, { x: 0, y: 0 });
    });

    /* ---- pointer: flick a heart, or grab and fling it ---- */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hitP = new THREE.Vector3();
    let dragIndex = -1;
    let dragTarget = null;
    let downAt = 0;
    let downXY = null;
    let lastPT = null;
    let flingV = null;

    /* Fat-finger pick: nearest heart within PICK_R of the pointer ray.
       Exact triangle raycast is too brittle — on slow devices (and under
       headless swiftshader) the heart drifts between aim and click, so a
       1.5-unit halo (~65 screen px on the stage) is what feels good. */
    const PICK_R = 1.5;
    const pickTmp = new THREE.Vector3();
    function pickIndex(cx, cy) {
      const r = canvas.getBoundingClientRect();
      ndc.x = ((cx - r.left) / r.width) * 2 - 1;
      ndc.y = -((cy - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      let best = -1;
      let bestD = PICK_R;
      for (let i = 0; i < items.length; i += 1) {
        items[i].mesh.getWorldPosition(pickTmp);
        const d = ray.ray.distanceToPoint(pickTmp);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }
    function castHearts(ev) {
      return pickIndex(ev.clientX, ev.clientY);
    }

    function planePoint(ev) {
      const r = canvas.getBoundingClientRect();
      ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(dragPlane, hitP)) return null;
      return { x: hitP.x, y: hitP.y };
    }

    canvas.addEventListener('pointerdown', (ev) => {
      const idx = castHearts(ev);
      downAt = performance.now();
      downXY = { x: ev.clientX, y: ev.clientY };
      lastPT = { x: ev.clientX, y: ev.clientY };
      flingV = null;
      if (window.__physics) window.__physics.lastPick = idx;
      if (idx < 0) return;
      dragIndex = idx;
      dragTarget = planePoint(ev);
      canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    canvas.addEventListener('pointermove', (ev) => {
      pointer.tx = ((ev.clientX / window.innerWidth) - 0.5) * 2;
      pointer.ty = ((ev.clientY / window.innerHeight) - 0.5) * 2;
      if (dragIndex < 0) return;
      const pt = planePoint(ev);
      if (pt) {
        const dt = 1 / 60;
        if (lastPT) {
          flingV = {
            x: ((pt.x - dragTarget.x) / dt) * 0.12,
            y: ((pt.y - dragTarget.y) / dt) * 0.12,
          };
        }
        dragTarget = pt;
      }
      lastPT = { x: ev.clientX, y: ev.clientY };
      ev.preventDefault();
    });
    function endDrag(ev) {
      if (dragIndex >= 0) {
        const it = items[dragIndex];
        const quick = performance.now() - downAt < 260;
        const still = downXY && Math.hypot(ev.clientX - downXY.x, ev.clientY - downXY.y) < 10;
        if (quick && still) {
          /* flick: a real impulse, radial-out + a spin of speed */
          const p = it.body.position;
          const d = Math.hypot(p.x, p.y) || 1;
          const nx = p.x / d;
          const ny = p.y / d;
          Matter.Body.setVelocity(it.body, {
            x: it.body.velocity.x + nx * 2.6 - ny * 1.6,
            y: it.body.velocity.y + ny * 2.6 + nx * 1.6,
          });
          it.pop = 1;
        } else if (flingV) {
          const vx = Math.max(-9, Math.min(9, flingV.x));
          const vy = Math.max(-9, Math.min(9, flingV.y));
          Matter.Body.setVelocity(it.body, {
            x: it.body.velocity.x * 0.3 + vx,
            y: it.body.velocity.y * 0.3 + vy,
          });
          it.pop = 0.7;
        }
        if (window.__physics) window.__physics.dragging = null;
      }
      dragIndex = -1;
      dragTarget = null;
      flingV = null;
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    /* ---- sim step: radial spring + tangential drive + soft repulsion ---- */
    function stepSim() {
      const bs = items.map((it) => it.body);
      for (let i = 0; i < items.length; i += 1) {
        const b = bs[i];
        if (i === dragIndex && dragTarget) {
          const k = 0.4;
          const nx = b.position.x + (dragTarget.x - b.position.x) * k;
          const ny = b.position.y + (dragTarget.y - b.position.y) * k;
          const cx = Math.max(-half.x + 0.6, Math.min(half.x - 0.6, nx));
          const cy = Math.max(-half.y + 0.6, Math.min(half.y - 0.6, ny));
          Matter.Body.setPosition(b, { x: cx, y: cy });
          Matter.Body.setVelocity(b, { x: 0, y: 0 });
          continue;
        }
        const p = b.position;
        const d = Math.hypot(p.x, p.y) || 0.001;
        const nx = p.x / d;
        const ny = p.y / d;
        /* spring toward the ring — stiff enough to beat the swirl */
        const radial = (d - ringR) * 0.014 * b.mass;
        /* constant swirl, same direction for all */
        const swirl = 0.00028 * b.mass;
        let fx = -nx * radial + -ny * swirl;
        let fy = -ny * radial + nx * swirl;
        /* gentle mutual repulsion */
        for (let j = 0; j < items.length; j += 1) {
          if (j === i) continue;
          const q = bs[j].position;
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dd = Math.hypot(dx, dy);
          if (dd > 0.001 && dd < 2.2) {
            const push = ((2.2 - dd) / 2.2) * 0.008 * b.mass;
            fx += (dx / dd) * push;
            fy += (dy / dd) * push;
          }
        }
        Matter.Body.applyForce(b, b.position, { x: fx, y: fy });
        /* speed cap so a big flick never escapes the frame */
        const sp = Math.hypot(b.velocity.x, b.velocity.y);
        if (sp > 2.4) {
          Matter.Body.setVelocity(b, {
            x: (b.velocity.x / sp) * 2.4, y: (b.velocity.y / sp) * 2.4,
          });
        }
      }
      /* two substeps: halves per-step travel so fast hearts meet walls */
      Matter.Engine.update(engine, 1000 / 120);
      Matter.Engine.update(engine, 1000 / 120);
    }

    /* ---- frame ---- */
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;
    let inView = true;
    let paused = false;

    function resize() {
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      layoutSim();
    }
    window.addEventListener('resize', resize);
    resize();

    function frame() {
      raf = requestAnimationFrame(frame);
      const suspended = paused || !inView || !running ||
        document.body.classList.contains('has-artifact-open');
      if (suspended) {
        clock.getElapsedTime();
        return;
      }
      const t = clock.getElapsedTime();
      stepSim();

      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      const az = pointer.x * 0.35;
      const el = 1.8 - pointer.y * 0.5;
      camera.position.set(Math.sin(az) * 11.4, el, Math.cos(az) * 11.4);
      camera.lookAt(0, 0.1, 0);

      /* medallion breathes */
      const pulse = 1 + Math.sin(t * 2.1) * 0.06;
      medal.scale.setScalar(pulse);
      glow.scale.set(4.4 * pulse, 4.4 * pulse, 1);
      ring.rotation.z = t * 0.25;
      core.intensity = 9 + Math.sin(t * 2.1) * 1.5;

      items.forEach((it, i) => {
        const p = it.body.position;
        const bob = Math.sin(t * 1.4 + it.phase) * 0.28;
        it.pop = Math.max(0, it.pop - 0.03);
        const s = it.baseScale * (1 + it.pop * 0.35);
        it.mesh.position.set(p.x, p.y, 0.15 + bob);
        it.mesh.scale.setScalar(s);
        it.mesh.rotation.y = Math.sin(t * 0.7 + it.phase) * 0.35;
        it.mesh.rotation.z = Math.sin(t * 0.9 + it.phase * 1.7) * 0.1;
        it.label.sprite.position.set(p.x, p.y + 1.15 + bob * 0.3, 0.35);
        /* comet trail: remember where this heart has been; collapse to a
           dot while the entrance rain is still falling (no long streaks) */
        if (t < 1.5) it.hist.length = 0;
        it.hist.unshift({ x: p.x, y: p.y, z: 0.15 + bob, t });
        while (it.hist.length > 2 && t - it.hist[it.hist.length - 1].t > 0.45) it.hist.pop();
        if (it.hist.length > 20) it.hist.pop();
        for (let k = 0; k < 20; k += 1) {
          const hp = it.hist[Math.min(k, it.hist.length - 1)] || { x: p.x, y: p.y, z: 0.15 };
          it.trailArr[k * 3] = hp.x;
          it.trailArr[k * 3 + 1] = hp.y;
          it.trailArr[k * 3 + 2] = hp.z;
        }
        it.trail.geometry.attributes.position.needsUpdate = true;
        it.trail.material.opacity = 0.28 + it.pop * 0.4;
      });

      renderer.render(scene, camera);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((e) => { inView = e.isIntersecting; });
      }, { threshold: 0.02 }).observe(section);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        items.forEach((it) => it.label.repaint());
      });
    }

    staticWrap.hidden = true;
    stage.classList.add('is-awake');
    setStatus(status, 'five hearts awake \u2014 flick one');
    window.__physics = {
      mode: 'orbit',
      names: hearts.map((h) => h.name),
      heartCount: items.length,
      dragging: null,
      setPaused: (v) => { paused = Boolean(v); },
      snapshot: () => items.map((it) => ({
        n: it.name,
        x: +it.body.position.x.toFixed(2),
        y: +it.body.position.y.toFixed(2),
        v: +Math.hypot(it.body.velocity.x, it.body.velocity.y).toFixed(2),
      })),
      lastPick: -1,
      pickAt: (cx, cy) => pickIndex(cx, cy),
      heartScreen: (i) => {
        const it = items[i];
        if (!it) return null;
        const v = new THREE.Vector3();
        it.mesh.getWorldPosition(v);
        v.project(camera);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width,
          y: r.top + ((1 - v.y) / 2) * r.height };
      },
    };
    frame();
    return window.__physics;
  }

  /* ---------------- boot ---------------- */

  async function boot() {
    const section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected) {
      window.setTimeout(boot, 150);
      return;
    }
    if (!window.THREE || !window.gsap) {
      window.setTimeout(boot, 150);
      return;
    }
    const stage = section.querySelector('[data-physics-stage]');
    const canvas = section.querySelector('[data-physics-orbit]');
    const staticWrap = section.querySelector('[data-physics-static]');
    const chips = section.querySelector('[data-physics-chips]');
    const note = section.querySelector('[data-physics-note]');
    const status = section.querySelector('[data-physics-status]');
    const playBtn = section.querySelector('[data-physics-play]');
    if (!stage || !staticWrap || !chips || !canvas) return;

    let hearts;
    try {
      hearts = await fetchNames();
    } catch (err) {
      setStatus(status, 'names unavailable');
      return;
    }

    /* base state first: the names row is readable before anyone opts in */
    renderChips(chips, hearts);
    showStatic(staticWrap, note, '');
    window.__physics = { mode: 'static-pending', names: hearts.map((h) => h.name) };

    canvas.hidden = true;
    playBtn.hidden = false;
    playBtn.addEventListener('click', async () => {
      playBtn.disabled = true;
      setStatus(status, 'waking the orbit\u2026');
      try {
        const Matter = await loadMatter();
        canvas.hidden = false;
        const api = initOrbit(Matter, window.THREE, section, stage, canvas,
          hearts, staticWrap, note, status);
        if (!api) throw new Error('WebGL unavailable');
        playBtn.hidden = true;
      } catch (err) {
        canvas.hidden = true;
        playBtn.hidden = true;
        initStatic(hearts, staticWrap, chips, note, status,
          'the orbit stayed asleep \u2014 the names still float here');
      }
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
