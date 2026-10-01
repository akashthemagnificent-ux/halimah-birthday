/* ============================================================
   halimah-birthday — #birthday hero (3D + text).
   Lantern globe, pointer ember trail, the scroll bridge, and every
   text reveal. Plan: .omo/plans/birthday-landing.md

   - Classic script (no import/export); three.js r160 UMD arrives as
     window.THREE via a LAZY_SECTIONS entry.
   - One Points object per lantern layer = one draw call each.
   - Scroll is the single source of truth: ONE pinned scrubbed
     ScrollTrigger, and the camera solve is a pure function of its
     progress, so scrolling back retraces the identical path.
     ZERO scroll listeners — ScrollTrigger + IntersectionObserver.
   - Full motion everywhere (owner override m0460).
   ============================================================ */
(() => {
  'use strict';

  const SECTION_ID = 'birthday';
  const STAGE_SELECTOR = '#bday-globe';
  const TRAIL_SELECTOR = '#bday-trail';

  const SHELL_COUNT = 2600;
  const CORE_COUNT = 1300;
  const MOTE_COUNT_DESKTOP = 190;
  const MOTE_COUNT_MOBILE = 90;
  const MOBILE_BREAKPOINT = 768;
  const MAX_DPR = 1.6;
  const ACCENT_FALLBACK = '#e8a33d';
  const GLOBE_RADIUS = 1;
  const SCRUB_DISTANCE = '+=180%';

  let booted = false;
  // Deferred sibling scripts (three.min.js, gsap) may parse after this
  // file, so boot() retries while vendors are missing. Capped: a blocked
  // vendor (gsap-abort lane) must settle to a static readable hero, never
  // spin. 200 x 50ms ~= 10s of grace, then give up silently.
  let bootAttempts = 0;
  const BOOT_ATTEMPT_MAX = 200;
  const BOOT_RETRY_MS = 50;

  // GSAP discipline, mirroring sections/story.js: the kill-switch in
  // js/motion.js owns the decision, and GSAP/three arrive lazily so
  // they may be absent on the first pass.
  function hasGsap() {
    if (window.Motion && typeof window.Motion.hasGsap === 'function') {
      return window.Motion.hasGsap();
    }
    return (
      typeof window.gsap !== 'undefined' &&
      typeof window.ScrollTrigger !== 'undefined'
    );
  }

  function isUnlocked() {
    return document.documentElement.getAttribute('data-unlocked') === 'true';
  }

  /* ================================================================
     3D stage — the lantern globe + the pointer trail.
     Owns ONE rAF, gated on the section being on screen. Returns null
     when WebGL is unavailable so the caller can fall back to the
     static, fully readable section.
     ================================================================ */
  // Returns a configured renderer, or null when WebGL is unusable —
  // no context, or a driver that refuses the surface.
  function createRenderer(THREE, canvas) {
    let renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false
      });
      if (!renderer || typeof renderer.getContext !== 'function') return null;
      if (!renderer.getContext()) return null;
    } catch (err) {
      return null;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return renderer;
  }

  function createStage(section, globeCanvas, trailCanvas, accent) {
    const THREE = window.THREE;
    if (!THREE || !globeCanvas || !trailCanvas) return null;

    const renderer = createRenderer(THREE, globeCanvas);
    if (!renderer) return null;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    // A second, wider camera drives the trail canvas so the ember
    // sparks read as a flat field of motes in front of the globe
    // rather than orbiting inside it. Same scene graph, two draws.
    const trailCamera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    trailCamera.position.set(0, 0, 7);

    const lantern = new THREE.Group();
    lantern.position.set(0.9, 0.15, 0);
    scene.add(lantern);

    const shell = createPointCloud(THREE, SHELL_COUNT, GLOBE_RADIUS, 1, {
      accent,
      size: 0.028,
      opacity: 0.9
    });
    const core = createPointCloud(THREE, CORE_COUNT, GLOBE_RADIUS * 0.52, 2, {
      accent,
      size: 0.05,
      opacity: 1
    });
    if (!shell || !core) {
      disposeRenderer(renderer);
      return null;
    }
    lantern.add(shell.points, core.points);

    // The trail lives in its OWN scene (motes.scene), rendered by a
    // separate renderer. It must NOT be added to the globe scene —
    // reparenting would strip it from its own scene and the trail would
    // render empty.
    const motes = createMoteField(THREE, trailCanvas, isMobile() ? MOTE_COUNT_MOBILE : MOTE_COUNT_DESKTOP);

    let running = false;
    let rafId = 0;
    let contextLost = false;
    // The bridge's eased progress. Written only by the ScrollTrigger
    // onUpdate; read every frame by the camera solve. Because it is
    // the sole input, scrolling backwards retraces the exact path.
    let progress = 0;
    const pointer = { x: 0, y: 0, seen: false };

    function resize() {
      const rect = section.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width || window.innerWidth || 1));
      const h = Math.max(1, Math.floor(rect.height || window.innerHeight || 1));
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      trailCamera.aspect = w / h;
      trailCamera.updateProjectionMatrix();
      if (motes) {
        motes.renderer.setPixelRatio(dpr);
        motes.renderer.setSize(w, h, false);
        motes.camera.aspect = w / h;
        motes.camera.updateProjectionMatrix();
      }
    }

    // Pure function of the scroll progress: radius, height, orbit and
    // the globe's own spin. No internal state, therefore fully
    // reversible in both scroll directions.
    function applyProgress(p) {
      const e = easeInOut(p);
      const angle = e * Math.PI * 0.9;
      const radius = 5.2 - e * 1.55;
      camera.position.set(Math.sin(angle) * radius * 0.42, 0.35 - e * 0.5, Math.cos(angle) * radius);
      camera.lookAt(0, -0.1 + e * 0.1, 0);
      trailCamera.position.set(Math.sin(angle) * 0.6, 0.2 - e * 0.3, 7 - e * 0.8);
      trailCamera.lookAt(0, 0, 0);
      lantern.rotation.y = e * Math.PI * 1.15;
      lantern.rotation.x = Math.sin(e * Math.PI) * 0.16;
      core.points.scale.setScalar(1 + e * 0.12);
    }

    function frame() {
      if (!running) return;
      const t = performance.now() * 0.001;
      shell.points.rotation.y = t * 0.045;
      shell.points.rotation.x = Math.sin(t * 0.19) * 0.08;
      core.points.rotation.y = -t * 0.075;
      if (motes) motes.update(pointer, t);
      renderer.render(scene, camera);
      if (motes) motes.renderer.render(motes.scene, motes.camera);
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running || contextLost) return;
      running = true;
      resize();
      rafId = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    // ONE observer for the whole stage. Off screen means zero frames
    // for BOTH canvases. No scroll listeners anywhere. Environments
    // without IntersectionObserver (older Safari, jsdom) simply run the
    // loop instead of gating it — degraded battery behaviour, not a
    // dead section, so the reveal triggers below still arm.
    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) start();
            else stop();
          });
        },
        { threshold: 0 }
      );
      observer.observe(section);
    } else {
      start();
    }

    // A lost context cannot be recovered mid-session reliably, so we
    // fall back to the static section rather than leaving a black
    // rectangle. Section copy and CSS atmosphere stay readable.
    function onContextLost(event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      contextLost = true;
      stop();
      hideCanvases();
    }
    globeCanvas.addEventListener('webglcontextlost', onContextLost, false);

    // Resize is a layout event, not a scroll listener, so it does not
    // violate the zero-scroll-listener contract. Debounced through rAF.
    let resizeQueued = false;
    function onResize() {
      if (resizeQueued) return;
      resizeQueued = true;
      window.requestAnimationFrame(() => {
        resizeQueued = false;
        if (running) resize();
      });
    }
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    // Pointer tracking. pointermove is not a scroll listener; the motes
    // are nudged in the same rAF above, never here.
    function onPointerMove(event) {
      const rect = section.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      pointer.seen = true;
    }
    function onPointerLeave() {
      pointer.seen = false;
      pointer.x = 0;
      pointer.y = 0;
    }
    section.addEventListener('pointermove', onPointerMove, { passive: true });
    section.addEventListener('pointerleave', onPointerLeave, { passive: true });

    applyProgress(progress);

    return {
      setProgress(p) {
        progress = Math.max(0, Math.min(1, p || 0));
        applyProgress(progress);
      },
      refresh() {
        if (typeof window.ScrollTrigger.refresh === 'function') {
          window.ScrollTrigger.refresh();
        }
      }
    };
  }

  /* ================================================================
     Geometry builders.
     ================================================================ */
  function isMobile() {
    return (window.innerWidth || 0) < MOBILE_BREAKPOINT;
  }

  function easeInOut(t) {
    const x = Math.max(0, Math.min(1, t));
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }

  // Deterministic PRNG so the globe is identical on every resize and
  // re-init (no visible "shuffling" when the viewport changes).
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

  function createPointCloud(THREE, count, radius, seed, options) {
    const rand = makeRandom(seed);
    const spread = options.spread || 0.05;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Uniform on the sphere (inverse-CDF of cos theta), so the lantern
      // has no pole pinching. The jitter breaks the perfect shell edge.
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - u * u));
      const rr = radius * (1 + (rand() - 0.5) * spread);
      const i3 = i * 3;
      positions[i3] = Math.cos(theta) * r * rr;
      positions[i3 + 1] = u * rr;
      positions[i3 + 2] = Math.sin(theta) * r * rr;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: new THREE.Color(options.accent),
      size: options.size,
      sizeAttenuation: true,
      transparent: true,
      opacity: options.opacity,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending
    });

    // A single Points object = a single draw call for the whole
    // shell/core. Per-point twinkle is a cheap size modulation of the
    // material rather than a second geometry.
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return { points, geometry, material };
  }

  // The pointer trail is a separate scene drawn over the globe: motes
  // chase an eased version of the pointer. Positions live in the
  // geometry attribute (transform-free) and are written in place, so
  // there is no per-mote Object3D and no CSS transform involved.
  function createMoteField(THREE, canvas, count) {
    const renderer = createRenderer(THREE, canvas);
    if (!renderer) return null;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 7;

    const positions = new Float32Array(count * 3);
    const home = new Float32Array(count * 3);
    const drift = new Float32Array(count * 2);
    const rand = makeRandom(7);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const i2 = i * 2;
      home[i3] = (rand() * 2 - 1) * 2.2;
      home[i3 + 1] = (rand() * 2 - 1) * 1.3;
      home[i3 + 2] = (rand() * 2 - 1) * 0.6;
      positions[i3] = home[i3];
      positions[i3 + 1] = home[i3 + 1];
      positions[i3 + 2] = home[i3 + 2];
      drift[i2] = 0.4 + rand() * 1.6;
      drift[i2 + 1] = rand() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.Float32BufferAttribute(positions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', attribute);

    const material = new THREE.PointsMaterial({
      color: new THREE.Color(ACCENT_FALLBACK),
      size: 0.055,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // Eased follow: each mote lerps toward the pointer with a per-mote
    // rate, so the field trails rather than snapping. Pointer NDC is
    // mapped into this scene's frustum at z = 0.
    function update(pointer, t) {
      const array = attribute.array;
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * 7;
      const halfW = halfH * Math.max(0.4, camera.aspect);
      const tx = pointer.seen ? pointer.x * halfW : 0;
      const ty = pointer.seen ? pointer.y * halfH : 0;
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3;
        const i2 = i * 2;
        const rate = 0.02 + drift[i2] * 0.012;
        const wobble = Math.sin(t * drift[i2] + drift[i2 + 1]) * 0.045;
        array[i3] += ((pointer.seen ? tx : home[i3]) + wobble - array[i3]) * rate;
        array[i3 + 1] += ((pointer.seen ? ty : home[i3 + 1]) - wobble * 0.6 - array[i3 + 1]) * rate;
        array[i3 + 2] = home[i3 + 2] + Math.sin(t * 0.6 + drift[i2 + 1]) * 0.08;
      }
      attribute.needsUpdate = true;
    }

    return { renderer, scene, camera, points, geometry, material, update };
  }

  function disposeRenderer(renderer) {
    try {
      if (renderer && typeof renderer.dispose === 'function') renderer.dispose();
    } catch (err) {
      /* nothing left to do — we are already falling back */
    }
  }

/* ================================================================
     Text reveals. Three variants, all SplitText-free.

     Markup contract (see sections/birthday.css):
       .bday-w / .bday-wm  = the MASK      (overflow: hidden)
       .bday-wi            = the WORD      (will-change: transform)
     So the mask is the parent and `.bday-wi` is what GSAP moves. When a
     `.bday-wi` block still holds bare text (hand-written markup without
     per-word spans), splitWords() builds the mask+word pair for it; when
     markup already supplies `.bday-w` > `.bday-wi`, we animate those
     directly and leave the author's DOM untouched.
     ============================================================ */
  function armTextReveals(section) {
    const gsap = window.gsap;
    if (!gsap) return;

    // (1) Masked reveal for headline words. One trigger per MASK group,
    // not one per section: the eyebrow and the h1 sit far apart
    // vertically and must not share a start line. Words are animated,
    // never the pinned section itself.
    const masks = collectWordMasks(section);
    masks.forEach((group) => {
      const words = group.words;
      if (words.length === 0) return;
      gsap.set(words, { yPercent: 110, opacity: 1 });
      gsap.to(words, {
        yPercent: 0,
        duration: 1.15,
        ease: 'expo.out',
        stagger: 0.035,
        scrollTrigger: {
          trigger: group.trigger,
          start: 'top 82%',
          toggleActions: 'play none none reverse'
        }
      });
    });

    // (2) Scrubbed word-reveal for the wish manifesto. Opacity only:
    // scrub means the reader's own scroll pace lights the sentence.
    const manifesto = Array.from(section.querySelectorAll('.bday-mw'));
    if (manifesto.length > 0) {
      gsap.set(manifesto, { opacity: 0.14 });
      gsap.to(manifesto, {
        opacity: 1,
        ease: 'none',
        stagger: 0.12,
        scrollTrigger: {
          trigger: section.querySelector('.bday-manifesto') || section,
          start: 'top 78%',
          end: 'bottom 45%',
          scrub: 0.6,
          toggleActions: 'play none none reverse'
        }
      });
    }

    // (3) Small captions: CSS owns the per-part delay via --word-index,
    // we only hand it the index and fade the caption in. A handful of
    // captions means a handful of one-shot triggers, which stays well
    // inside the page budget.
    Array.from(section.querySelectorAll('.bday-cap')).forEach((cap) => {
      Array.from(cap.querySelectorAll('[data-bday-caption-part]')).forEach(
        (part, i) => part.style.setProperty('--word-index', String(i))
      );
      gsap.fromTo(
        cap,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: cap,
            start: 'top 88%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });
  }

  // Groups the headline words into per-mask sets so each line block
  // gets its own reveal trigger. Prefers hand-authored
  // .bday-w > .bday-wi pairs; falls back to splitting any block that is
  // still bare text. Returns [{trigger, words}].
  function collectWordMasks(section) {
    const groups = [];
    // Hand-authored structure: an outer mask (.bday-w / .bday-wm) that
    // contains one or more animated words (.bday-wi, or an inner .bday-w
    // produced by our own splitter).
    const authored = Array.from(section.querySelectorAll('.bday-w, .bday-wm'));
    authored.forEach((mask) => {
      const words = Array.from(
        mask.querySelectorAll('.bday-wi, .bday-w')
      ).filter((w) => w !== mask);
      if (words.length > 0) groups.push({ trigger: mask, words });
    });

    // Any .bday-wi block that is NOT already inside a mask and still
    // holds raw text gets split into .bday-wm > .bday-wi pairs.
    Array.from(section.querySelectorAll('.bday-wi')).forEach((block) => {
      if (block.closest('.bday-w, .bday-wm')) return; // already masked
      if (block.querySelector('.bday-w, .bday-wm')) return; // already split
      if (!hasBareText(block)) return;
      splitWords(block);
      const words = Array.from(block.querySelectorAll('.bday-wi'));
      if (words.length > 0) groups.push({ trigger: block, words });
    });

    return groups;
  }

  function hasBareText(block) {
    return (block.textContent || '').trim().length > 0;
  }

  // Minimal, layout-safe word splitter. Each word text node becomes
  // <span class="bday-wm"><span class="bday-wi">word</span></span> so the
  // inner .bday-wi (the word CSS animates) has an overflow-hidden parent
  // to slide behind.
  function splitWords(block) {
    const walk = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node = walk.nextNode();
    while (node) {
      if (node.nodeValue && node.nodeValue.trim()) textNodes.push(node);
      node = walk.nextNode();
    }
    textNodes.forEach((textNode) => {
      const frag = document.createDocumentFragment();
      textNode.nodeValue.split(/(\s+)/).forEach((token) => {
        if (!token) return;
        if (/^\s+$/.test(token)) {
          frag.appendChild(document.createTextNode(token));
          return;
        }
        const mask = document.createElement('span');
        mask.className = 'bday-wm';
        const inner = document.createElement('span');
        inner.className = 'bday-wi';
        inner.textContent = token;
        mask.appendChild(inner);
        frag.appendChild(mask);
      });
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function hideCanvases() {
    const section = document.getElementById(SECTION_ID);
    if (!section) return;
    section.querySelectorAll('canvas').forEach((canvas) => {
      canvas.style.display = 'none';
    });
    section.classList.add('is-static');
  }

  function disposeRenderer(renderer) {
    try {
      if (renderer && typeof renderer.dispose === 'function') renderer.dispose();
    } catch (err) {
      /* nothing left to do — we are already falling back */
    }
  }

  function readAccent() {
    let value = '';
    try {
      value = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-accent');
    } catch (err) {
      value = '';
    }
    return (value || '').trim() || ACCENT_FALLBACK;
  }

  function boot() {
    if (booted) return;
    const section = document.getElementById(SECTION_ID);
    if (!section) return;
    // Scripts arrive as separate deferred tags per LAZY_SECTIONS entry, so
    // three.min.js may parse after this file on first view. Defer — never
    // bail: the section is observed exactly once, so a silent return here
    // would leave the globe dead.
    // Vendors-blocked is terminal, not transient: when the central
    // kill-switch reports false (reduced-motion, or GSAP routes aborted)
    // no retry can ever succeed, so settle read-only immediately. The
    // retry below is only for the happy-path script race, where all three
    // globals exist but simply have not parsed yet.
    if (
      window.Motion &&
      typeof window.Motion.motionAllowed === 'function' &&
      !window.Motion.motionAllowed()
    ) {
      return;
    }
    if (
      typeof window.THREE === 'undefined' ||
      !hasGsap() ||
      typeof window.ScrollTrigger === 'undefined'
    ) {
      if (bootAttempts < BOOT_ATTEMPT_MAX) {
        bootAttempts += 1;
        window.setTimeout(boot, BOOT_RETRY_MS);
      }
      return;
    }

    const globeCanvas = section.querySelector(STAGE_SELECTOR);
    const trailCanvas = section.querySelector(TRAIL_SELECTOR);
    if (!globeCanvas || !trailCanvas) return; // markup not ours yet

    booted = true;
    document.documentElement.classList.add('js-birthday');
    const accent = readAccent();

    const stage = createStage(section, globeCanvas, trailCanvas, accent);
    if (!stage) {
      // WebGL unavailable: hide the canvases silently. Every word of
      // copy is already in the DOM, so the hero still reads.
      hideCanvases();
      armTextReveals(section);
      return;
    }

    armTextReveals(section);

    // THE bridge. One pinned, scrubbed ScrollTrigger owns the whole
    // hero: it pins, it defines the progress value, and progress is
    // the only input to the camera/globe solve. Scrubbed (not direct)
    // so it eases; because the solve is pure, scrolling back up
    // retraces the identical path.
    window.ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: SCRUB_DISTANCE,
      pin: true,
      pinSpacing: true,
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        stage.setProgress(self.progress);
      }
    });

    // Late-arriving fonts change the pinned block's height; re-measure
    // once they land so the pin distance matches the final layout.
    if (document.fonts && typeof document.fonts.ready === 'object') {
      document.fonts.ready
        .then(() => {
          stage.refresh();
        })
        .catch(() => {});
    }
  }

  // The gate (js/begin.js) detaches #content-region into a
  // DocumentFragment while locked, so on the locked boot path the
  // section is genuinely absent. Re-run boot when the gate restores it
  // — same discipline the lazy loader uses. This observer is also the
  // reason boot() is idempotent via the `booted` flag.
  function watchUnlock() {
    const root = document.documentElement;
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      if (!isUnlocked()) return;
      observer.disconnect();
      window.setTimeout(boot, 0);
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-unlocked']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  watchUnlock();
})();
