/* ============================================================
   quotes — THE WALL OF ZAINAB : the orbital evidence locker

   PHASE 1 — pinned orbital hero (260vh of scroll)
     Eighty textured quote cards hang on two counter-rotating rings
     around a glowing ember seal, tilted like a galaxy disc. The rig
     turns with the cursor (fixed radius — distance never changes, so
     nothing can shrink). Scrolling collapses the orbit: the rings
     fling outward and down, the seal flares, and the DOM wall rises
     to take over. Pure function of progress, so it reverses exactly.

   PHASE 2 — the DOM wall
     Same 80 exhibits as glass cards: EVIDENCE stamp slam, gold foil
     on the 11 ultra-rares (2-column heroes), cursor tilt + glare,
     tap-to-hold lightbox, FLIP shuffle, live counter.

   Full motion always. Data-driven from content/quotes-manifest.js
   (plain script, so file:// previews need no fetch).
   ============================================================ */
(() => {
  'use strict';

  const SECTION_ID = 'quotes';
  const MANIFEST_GLOBAL = 'QUOTES_MANIFEST';
  const HERO_END = '+=260%';

  let booted = false;

  function hasVendors() {
    return (
      typeof window.THREE !== 'undefined' &&
      typeof window.gsap !== 'undefined' &&
      typeof window.ScrollTrigger !== 'undefined'
    );
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

  function readManifest() {
    const data = window[MANIFEST_GLOBAL];
    return Array.isArray(data) && data.length ? data : [];
  }

  function easeInOut(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function easeOutCubic(t) {
    t = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - t, 3);
  }

  /* ================================================================
     ORBIT STAGE — two counter-rotating rings of textured cards
     around an ember seal. One renderer, one rAF.
     ================================================================ */
  function createOrbitStage(section, canvas, items) {
    const THREE = window.THREE;
    if (!THREE || !canvas) return null;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCraveat: false,
      });
    } catch (err) {
      return null;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const rand = makeRandom(90081);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0d0a08, 0.038);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
    const camBase = { x: 0, y: 2.15, z: 8.4 };
    camera.position.set(0, 2.15, 8.4);

    // ── seal: the glowing core the quotes orbit ────────────────
    function makeGlowTexture(THREE) {
      const size = 256;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,247,232,1)');
      g.addColorStop(0.14, 'rgba(255,214,150,0.92)');
      g.addColorStop(0.34, 'rgba(240,152,74,0.44)');
      g.addColorStop(0.62, 'rgba(224,124,62,0.14)');
      g.addColorStop(1, 'rgba(224,124,62,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    const glowTex = makeGlowTexture(THREE);

    const sealGroup = new THREE.Group();
    scene.add(sealGroup);

    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95 });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 3), coreMat);
    core.material.wireframe = false;
    sealGroup.add(core);

    const shellMat = new THREE.MeshBasicMaterial({ color: 0xe07c3e, transparent: true, opacity: 0.32, wireframe: true });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 1), shellMat);
    sealGroup.add(shell);

    const haloMat = new THREE.SpriteMaterial({
      map: glowTex, color: 0xffb45e, transparent: true,
      opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(7.2, 7.2, 1);
    sealGroup.add(halo);

    const coreLight = new THREE.PointLight(0xffb45e, 26, 16, 1.7);
    sealGroup.add(coreLight);

    // ── rings of quote cards ──────────────────────────────────
    const loader = new THREE.TextureLoader();
    const cardGeo = new THREE.PlaneGeometry(1.72, 0.9);
    const edgeGeo = new THREE.PlaneGeometry(1.86, 1.04);

    const ringOuter = new THREE.Group();
    const ringInner = new THREE.Group();
    const rig = new THREE.Group();
    rig.add(ringOuter, ringInner, sealGroup);
    rig.rotation.x = -0.22;
    scene.add(rig);

    const cards = [];
    const disposables = [cardGeo, edgeGeo, coreMat, shellMat, haloMat, glowTex];

    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0xeec27f, transparent: true, opacity: 0.5,
      side: THREE.BackSide, depthWrite: false,
    });
    disposables.push(edgeMat);

    items.forEach((item, i) => {
      const isOuter = i % 2 === 0;
      const ring = isOuter ? ringOuter : ringInner;
      const ringCount = isOuter
        ? Math.ceil(items.length / 2)
        : Math.floor(items.length / 2);
      const idxInRing = isOuter ? Math.floor(i / 2) : Math.floor(i / 2);
      const angle = (idxInRing / ringCount) * Math.PI * 2 + (isOuter ? 0 : Math.PI / ringCount);
      const radius = isOuter ? 4.5 + rand() * 0.35 : 2.85 + rand() * 0.3;
      const y = isOuter ? (rand() - 0.5) * 0.5 : (rand() - 0.5) * 1.1;

      const holder = new THREE.Group();
      const face = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide,
      }));
      face.material.side = THREE.DoubleSide;
      disposables.push(face.material);

      // gold edge behind each card (reads as a lit exhibit)
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.z = -0.012;
      holder.add(edge);
      holder.add(face);

      loader.load(
        item.thumb,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          face.material.map = tex;
          face.material.needsUpdate = true;
        },
        undefined,
        () => {
          // missing thumbnail: warm gradient plate, never a hole
          const c = document.createElement('canvas');
          c.width = 64; c.height = 36;
          const cx = c.getContext('2d');
          const g = cx.createLinearGradient(0, 0, 64, 36);
          g.addColorStop(0, '#e07c3e');
          g.addColorStop(1, '#7d3b1a');
          cx.fillStyle = g;
          cx.fillRect(0, 0, 64, 36);
          const t = new THREE.CanvasTexture(c);
          t.colorSpace = THREE.SRGBColorSpace;
          disposables.push(t);
          face.material.map = t;
          face.material.needsUpdate = true;
        }
      );

      holder.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      holder.rotation.y = -angle + Math.PI / 2;
      holder.rotation.x = (rand() - 0.5) * 0.22;
      holder.rotation.z = (rand() - 0.5) * 0.12;

      ring.add(holder);
      cards.push({
        holder,
        face,
        angle,
        radius,
        yBase: y,
        // scattered collapse direction so the fling reads as an explosion
        flingX: Math.cos(angle) * (1.6 + rand() * 2.2),
        flingY: -(1.2 + rand() * 3.4),
        flingZ: Math.sin(angle) * (1.2 + rand() * 2.0) + (rand() - 0.5) * 2,
        spin: (rand() - 0.5) * 2.2,
        tiltX: (rand() - 0.5) * 0.22,
        tiltZ: (rand() - 0.5) * 0.12,
        isOuter,
        delay: rand() * 0.22,
        rare: !!item.rare,
      });
    });

    // ── embers rising through the vault ────────────────────────
    const EMBERS = 220;
    const epos = new Float32Array(EMBERS * 3);
    const eseed = [];
    for (let i = 0; i < EMBERS; i += 1) {
      epos[i * 3] = (rand() * 2 - 1) * 9;
      epos[i * 3 + 1] = -3 + rand() * 8;
      epos[i * 3 + 2] = (rand() * 2 - 1) * 5 - 1;
      eseed.push({ rise: 0.3 + rand() * 0.8, sway: 0.2 + rand() * 0.7, phase: rand() * Math.PI * 2 });
    }
    const egeo = new THREE.BufferGeometry();
    const eattr = new THREE.BufferAttribute(epos, 3);
    eattr.setUsage(THREE.DynamicDrawUsage);
    egeo.setAttribute('position', eattr);
    const emat = new THREE.PointsMaterial({
      color: 0xf0984a, size: 0.055, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const embers = new THREE.Points(egeo, emat);
    embers.frustumCulled = false;
    scene.add(embers);
    disposables.push(egeo, emat);

    // ── dust field for depth ──────────────────────────────────
    const DUST = 420;
    const dpos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i += 1) {
      dpos[i * 3] = (rand() * 2 - 1) * 16;
      dpos[i * 3 + 1] = rand() * 12 - 4;
      dpos[i * 3 + 2] = -10 - rand() * 10;
    }
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const dmat = new THREE.PointsMaterial({
      color: 0xf5ebe0, size: 0.03, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dgeo, dmat);
    dust.frustumCulled = false;
    scene.add(dust);
    disposables.push(dgeo, dmat);

    // ── state ─────────────────────────────────────────────────
    const pointer = { x: 0, y: 0, seen: false };
    const ease = { x: 0, y: 0 };
    let progress = 0;

    function resize() {
      const rect = section.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width || window.innerWidth || 1));
      const h = Math.max(1, Math.floor(rect.height || window.innerHeight || 1));
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    // Pure function of progress: 0 = full orbit, 1 = fully collapsed.
    function applyProgress(p) {
      const t = performance.now() * 0.001;
      const collapse = easeInOut(p);
      /* Hold the finished orbit for the first fifth of the pin, then blow it
         out over the remaining travel — so the collapse reads as one long
         explosion instead of an instant vanish. */
      const push = easeOutCubic(Math.max(0, Math.min(1, (collapse - 0.22) / 0.78)));

      for (let i = 0; i < cards.length; i += 1) {
        const c = cards[i];
        // each card follows its own delayed slice of the collapse
        const local = Math.max(0, Math.min(1, (push - c.delay) / (1 - c.delay)));
        const l = easeOutCubic(local);
        // the ring spins up as it throws
        const angle = c.angle + collapse * (c.isOuter ? 2.6 : -3.6);
        // travel grows with the throw but stays on screen: capped radius
        const r = c.radius + l * 2.2;
        c.holder.position.set(
          Math.cos(angle) * r + c.flingX * l * 0.55,
          c.yBase + c.flingY * l * 0.5 + (1 - l) * Math.sin(t * 0.4 + c.angle * 3) * 0.09,
          Math.sin(angle) * r + c.flingZ * l * 0.55
        );
        c.holder.rotation.y = -angle + Math.PI / 2 + l * c.spin * 1.6;
        c.holder.rotation.x = c.tiltX * (1 - l) + l * c.spin * 1.1;
        c.holder.rotation.z = c.tiltZ * (1 - l) + l * c.spin * 2.0;
        // fade late: the cards stay solid for most of the flight
        c.face.material.opacity = Math.max(0, 1 - Math.max(0, (l - 0.55) / 0.45));
        const edge = c.holder.children[0];
        if (edge && edge.material && edge.material !== edgeMat) edge.material.opacity = 1;
      }

      // seal: swells then flares out
      const flare = Math.sin(Math.min(1, collapse) * Math.PI);
      sealGroup.scale.setScalar(1 + flare * 1.5 + collapse * 0.4);
      haloMat.opacity = 0.85 + flare * 0.6;
      coreLight.intensity = 26 + flare * 90;
      core.rotation.y += 0.01;
      shell.rotation.y -= 0.014;
      shell.rotation.x += 0.006;

      // rig tips from galaxy-disc to a downward throw
      rig.rotation.x = -0.22 + collapse * 0.5;
      rig.rotation.z = collapse * 0.22;

      // camera: rises and looks down into the vault as it collapses, but
      // stays close enough that the throwing cards stay in frame
      camBase.y = 2.15 + collapse * 1.7;
      camBase.z = 8.4 + collapse * 1.6;
      camBase.x = collapse * 0.9;

      embers.material.opacity = 0.9 * (1 - collapse * 0.6);
    }

    let running = false;
    let rafId = 0;
    let lastTime = 0;

    /* Frame-rate independent damping. A fixed per-frame factor makes the
       orbit crawl on a slow machine and snap on a fast one; this converges
       in the same wall-clock time everywhere. */
    function damp(current, target, lambda, dt) {
      return current + (target - current) * (1 - Math.exp(-lambda * dt));
    }

    function frame(time) {
      if (!running) return;
      const now = (time || performance.now()) * 0.001;
      const dt = Math.min(0.1, Math.max(0.001, now - lastTime || 0.016));
      lastTime = now;
      const t = now;

      // cursor follow: decisive but eased, so the turn feels alive
      ease.x = damp(ease.x, pointer.seen ? pointer.x : 0, 6, dt);
      ease.y = damp(ease.y, pointer.seen ? pointer.y : 0, 6, dt);

      // rings turn on their own, at different rates and directions
      ringOuter.rotation.y += 0.0022;
      ringInner.rotation.y -= 0.0036;
      // rig leans with the hand (half), camera swings the other half
      rig.rotation.y = ease.x * 0.30;
      rig.rotation.z = ease.y * 0.10;

      // embers rise
      const arr = eattr.array;
      for (let i = 0; i < EMBERS; i += 1) {
        const s = eseed[i];
        arr[i * 3 + 1] += s.rise * 0.018;
        arr[i * 3] += Math.sin(t * s.sway + s.phase) * 0.005;
        if (arr[i * 3 + 1] > 6) {
          arr[i * 3 + 1] = -3;
          arr[i * 3] = (Math.random() * 2 - 1) * 9;
        }
      }
      eattr.needsUpdate = true;
      dust.rotation.y = t * 0.006;

      // 360 cursor orbit on a FIXED radius: only the angle changes, so
      // nothing can ever shrink or grow with the hand.
      const radius = Math.sqrt(camBase.x * camBase.x + camBase.z * camBase.z);
      const baseAngle = Math.atan2(camBase.x, camBase.z);
      // FULL 360: the hand's position across the section maps to the camera's
      // position on the orbit, so far left = far left, far right = far right.
      const angle = baseAngle + ease.x * 1.05;
      camera.position.set(
        Math.sin(angle) * radius,
        camBase.y + ease.y * 1.5,
        Math.cos(angle) * radius
      );
      camera.lookAt(ease.x * 0.5, -collapseLift() * 1.6 - ease.y * 0.4, 0);
      camera.rotateZ(ease.x * 0.05);

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(frame);
    }

    function collapseLift() {
      return easeInOut(progress);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      applyProgress(progress);
      lastTime = 0;
      rafId = window.requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      lastTime = 0;
    }

    section.addEventListener('pointermove', (e) => {
      const rect = section.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      pointer.seen = true;
    }, { passive: true });
    section.addEventListener('pointerleave', () => {
      pointer.seen = false;
      pointer.x = 0;
      pointer.y = 0;
    }, { passive: true });

    let started = false;
    function ensureRunning() {
      if (!started) {
        started = true;
        start();
      }
    }

    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) ensureRunning();
          else if (started) stop();
        });
      }, { threshold: 0 });
      observer.observe(section);
      // The gate restores this section after boot(), so the observer may see
      // it already on screen without firing: prime the loop on the next frames
      // either way, and pause only when it is genuinely far off screen.
      let primed = 0;
      const prime = () => {
        const rect = section.getBoundingClientRect();
        const onScreen = rect.bottom > -200 && rect.top < window.innerHeight + 200;
        if (onScreen) {
          ensureRunning();
          return;
        }
        primed += 1;
        if (primed < 60) window.requestAnimationFrame(prime);
      };
      window.requestAnimationFrame(prime);
    } else {
      start();
    }

    let resizeQueued = false;
    window.addEventListener('resize', () => {
      if (resizeQueued) return;
      resizeQueued = true;
      window.requestAnimationFrame(() => {
        resizeQueued = false;
        if (running) resize();
      });
    }, { passive: true });

    applyProgress(progress);
    // draw one frame immediately so the orbit is present before first scroll
    resize();
    renderer.render(scene, camera);

    return {
      setProgress(p) {
        progress = Math.max(0, Math.min(1, p || 0));
        applyProgress(progress);
      },
      probe() {
        const d = Math.sqrt(
          camera.position.x * camera.position.x +
          camera.position.y * camera.position.y +
          camera.position.z * camera.position.z
        );
        return {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          textures: renderer.info.memory.textures,
          geometries: renderer.info.memory.geometries,
          cards: cards.length,
          progress: progress,
          camDist: Math.round(d * 1000) / 1000,
          camAngle: Math.round(Math.atan2(camera.position.x, camera.position.z) * 1000) / 1000,
        };
      },
      dispose() {
        stop();
        disposables.forEach((d) => {
          try {
            if (d && typeof d.dispose === 'function') d.dispose();
          } catch (err) { /* already gone */ }
        });
        try { renderer.dispose(); } catch (err) { /* already gone */ }
      },
    };
  }

  /* ================================================================
     DOM WALL
     ================================================================ */
  function buildCard(item, index) {
    const fig = document.createElement('figure');
    fig.className = 'quote-exhibit' + (item.rare ? ' quote-exhibit--rare' : '');
    fig.tabIndex = 0;
    fig.setAttribute('data-quote-id', item.id);
    fig.setAttribute('aria-label', 'Quote exhibit ' + (index + 1) + (item.rare ? ', ultra rare' : ''));

    const frame = document.createElement('span');
    frame.className = 'quote-exhibit__frame';
    frame.setAttribute('aria-hidden', 'true');
    if (item.bg) {
      const bg = document.createElement('img');
      bg.className = 'quote-exhibit__bg';
      bg.alt = '';
      bg.loading = 'lazy';
      bg.decoding = 'async';
      bg.src = item.bg;
      frame.appendChild(bg);
    }
    fig.appendChild(frame);

    const img = document.createElement('img');
    img.className = 'quote-exhibit__img';
    img.alt = 'Her words, exhibit ' + (index + 1);
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => img.setAttribute('data-err', 'true'));
    img.src = item.file;
    fig.appendChild(img);

    const glare = document.createElement('span');
    glare.className = 'quote-exhibit__glare';
    glare.setAttribute('aria-hidden', 'true');
    fig.appendChild(glare);

    const stamp = document.createElement('span');
    stamp.className = 'quote-exhibit__stamp';
    stamp.textContent = 'evidence ' + String(index + 1).padStart(2, '0');
    fig.appendChild(stamp);

    return fig;
  }

  function armTilt(wall) {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return;
    let rafId = 0;
    let pending = null;
    const flush = () => {
      rafId = 0;
      const el = pending;
      pending = null;
      if (!el) return;
      el.style.setProperty('--ex-tilt-x', el.dataset.tx + 'deg');
      el.style.setProperty('--ex-tilt-y', el.dataset.ty + 'deg');
    };
    wall.addEventListener('pointermove', (e) => {
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--ex-glare-x', (px * 100).toFixed(2) + '%');
      card.style.setProperty('--ex-glare-y', (py * 100).toFixed(2) + '%');
      card.dataset.tx = ((0.5 - py) * 10).toFixed(2);
      card.dataset.ty = ((px - 0.5) * 14).toFixed(2);
      pending = card;
      if (!rafId) rafId = window.requestAnimationFrame(flush);
    }, { passive: true });
    wall.addEventListener('pointerout', (e) => {
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (!card) return;
      card.style.setProperty('--ex-tilt-x', '0deg');
      card.style.setProperty('--ex-tilt-y', '0deg');
    }, { passive: true });
  }

  function createLightbox() {
    if (document.querySelector('.quotes__lightbox')) return;
    const box = document.createElement('div');
    box.className = 'quotes__lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Quote exhibit, enlarged');
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    const cap = document.createElement('p');
    cap.className = 'quotes__lightbox-cap';
    box.appendChild(img);
    box.appendChild(cap);
    document.body.appendChild(box);

    let openCard = null;
    let suppress = false;

    function open(card) {
      if (suppress) return;
      const source = card.querySelector('.quote-exhibit__img');
      if (!source) return;
      img.src = source.currentSrc || source.src;
      img.alt = source.alt || '';
      const stamp = card.querySelector('.quote-exhibit__stamp');
      cap.textContent = (stamp ? stamp.textContent + ' — ' : '') + 'her words, kept forever';
      box.classList.add('is-open');
      document.body.classList.add('has-artifact-open');
      openCard = card;
      if (window.gsap) {
        window.gsap.fromTo(img, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'expo.out' });
      }
    }
    function close() {
      if (!openCard) return;
      suppress = true;
      window.setTimeout(() => { suppress = false; }, 60);
      box.classList.remove('is-open');
      document.body.classList.remove('has-artifact-open');
      openCard = null;
    }

    box.addEventListener('click', close);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    return { open, close };
  }

  function shuffleWall(wall) {
    const cards = Array.from(wall.children);
    if (cards.length < 2) return;
    if (!window.gsap) {
      for (let i = cards.length - 1; i > 0; i -= 1) {
        const k = Math.floor(Math.random() * (i + 1));
        wall.appendChild(cards[k]);
      }
      return;
    }
    const first = new Map();
    cards.forEach((el) => first.set(el, el.getBoundingClientRect()));
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const k = Math.floor(Math.random() * (i + 1));
      const tmp = cards[i];
      cards[i] = cards[k];
      cards[k] = tmp;
    }
    cards.forEach((el) => wall.appendChild(el));
    cards.forEach((el) => {
      const a = first.get(el);
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (dx || dy) {
        window.gsap.fromTo(el, { x: dx, y: dy, rotation: (Math.random() - 0.5) * 6 }, {
          x: 0, y: 0, rotation: 0, duration: 0.8, ease: 'expo.out',
        });
      }
    });
  }

  function boot() {
    if (booted) return;
    const section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || !hasVendors()) {
      window.setTimeout(boot, 120);
      return;
    }
    const items = readManifest();
    if (items.length === 0) {
      if (window.console && console.warn) console.warn('[quotes] manifest empty');
      return;
    }

    const wall = section.querySelector('[data-quotes-wall]');
    const hero = section.querySelector('[data-quotes-hero]');
    const canvas = section.querySelector('#quotes-orbit');
    const body = section.querySelector('[data-quotes-body]');
    if (!wall || !hero || !canvas) return;

    booted = true;
    document.documentElement.classList.add('js-quotes');
    window.gsap.registerPlugin(window.ScrollTrigger);

    /* ── DOM wall build ─────────────────────────────────────── */
    const frag = document.createDocumentFragment();
    items.forEach((item, i) => frag.appendChild(buildCard(item, i)));
    wall.appendChild(frag);

    const countEl = section.querySelector('[data-quotes-count]');
    if (countEl) countEl.textContent = String(items.length);
    const rareEl = section.querySelector('[data-quotes-rare]');
    if (rareEl) rareEl.textContent = String(items.filter((x) => x.rare).length);

    const lb = createLightbox();
    armTilt(wall);
    wall.addEventListener('click', (e) => {
      if (lb && e.target.closest && e.target.closest('.quotes__lightbox')) return;
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (card && lb) lb.open(card);
    });
    wall.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (card && lb) {
        e.preventDefault();
        lb.open(card);
      }
    });

    const btn = section.querySelector('[data-quotes-shuffle]');
    if (btn) {
      btn.addEventListener('click', () => {
        shuffleWall(wall);
        if (window.Motion && typeof window.Motion.burst === 'function') {
          window.Motion.burst({ particleCount: 70, spread: 80 });
        }
      });
    }

    /* ── orbit stage + pinned collapse ──────────────────────── */
    const stage = createOrbitStage(section, canvas, items);
    const meter = section.querySelector('[data-quotes-meter]');

    if (stage) {
      window.__quotesStage = stage;
      window.ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: HERO_END,
        pin: true,
        pinSpacing: true,
        scrub: 0.7,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          stage.setProgress(self.progress);
          if (meter) meter.style.width = (self.progress * 100).toFixed(2) + '%';
          if (body) {
            // the wall rises as the orbit collapses
            const lift = Math.max(0, Math.min(1, (self.progress - 0.62) / 0.3));
            body.style.opacity = String(lift);
            body.style.transform = 'translate3d(0,' + ((1 - lift) * 70).toFixed(1) + 'px,0)';
            body.style.pointerEvents = lift > 0.6 ? '' : 'none';
          }
        },
      });
    } else if (canvas) {
      canvas.style.display = 'none';
      if (body) body.style.opacity = '1';
    }

    /* ── threat headline slam ───────────────────────────────── */
    const words = Array.from(section.querySelectorAll('.qthreat-i'));
    if (words.length) {
      window.gsap.set(words, { yPercent: 125, rotation: 7 });
      window.gsap.to(words, {
        yPercent: 0, rotation: 0, duration: 0.95, ease: 'back.out(1.7)', stagger: 0.05,
        scrollTrigger: {
          trigger: section.querySelector('.quotes__headline'),
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      });
    }
    window.gsap.from(section.querySelectorAll('.quotes__lede, .quotes-hero__cue'), {
      autoAlpha: 0, y: 22, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.5,
    });

    /* ── wall card entrances ────────────────────────────────── */
    const cards = Array.from(wall.children);
    window.gsap.set(cards, {
      opacity: 0, y: 80, scale: 0.9,
      rotation: () => (Math.random() - 0.5) * 9,
    });
    window.ScrollTrigger.batch(cards, {
      batchMax: 6,
      start: 'top 96%',
      onEnter: (batch) => {
        window.gsap.to(batch, {
          opacity: 1, y: 0, scale: 1, rotation: 0,
          duration: 0.95, ease: 'expo.out', stagger: 0.055, overwrite: true,
        });
        batch.forEach((card) => {
          card.classList.add('is-in');
          const stamp = card.querySelector('.quote-exhibit__stamp');
          if (stamp) {
            window.gsap.fromTo(stamp, { scale: 2.4, opacity: 0, rotation: -20 }, {
              scale: 1, opacity: 1, rotation: -7, duration: 0.42, ease: 'power4.in', delay: 0.34,
            });
          }
        });
      },
      onLeaveBack: (batch) => {
        window.gsap.to(batch, { opacity: 0, y: 80, scale: 0.9, duration: 0.5, ease: 'power2.in', overwrite: true });
        batch.forEach((card) => card.classList.remove('is-in'));
      },
    });

    /* Fallback: the wall's own container is animated in opacity, so a batch
       trigger can measure against a hidden ancestor and never fire. Once the
       wall is genuinely on screen, anything still hidden is revealed. */
    window.ScrollTrigger.create({
      trigger: wall,
      start: 'top 92%',
      onEnter: () => {
        cards.forEach((card, i) => {
          if (card.classList.contains('is-in')) return;
          window.gsap.to(card, {
            opacity: 1, y: 0, scale: 1, rotation: 0,
            duration: 0.8, ease: 'expo.out', delay: Math.min(0.5, i * 0.012), overwrite: true,
          });
          card.classList.add('is-in');
          const stamp = card.querySelector('.quote-exhibit__stamp');
          if (stamp) {
            window.gsap.fromTo(stamp, { scale: 2.4, opacity: 0, rotation: -20 }, {
              scale: 1, opacity: 1, rotation: -7, duration: 0.42, ease: 'power4.in', delay: 0.3,
            });
          }
        });
      },
    });

    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(() => window.ScrollTrigger.refresh()).catch(() => {});
    }
    window.addEventListener('load', () => window.ScrollTrigger.refresh());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
