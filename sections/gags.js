/* ============================================================
   gags — gag locker room (todo 9) — rebuilt
   Four exhibits, each ending in an affection closer (IS-5).
   - Locker void: warm dust motes in depth (WebGL), scroll scrub,
     cursor parallax, pause off-screen.
   - Exhibits: cursor tilt + glare, tap-to-zoom screenshot lightbox
     (suspend/resume hooks — story lightbox lesson baked in).
   - Spider mascot: swings between cards on a silk thread (shared
     flyer, per-card hidden until landing), says a line per exhibit,
     click = heart pop. Boop button keeps its wiggle.
   - Full motion always. One renderer, one rAF, pause off-screen.
   ============================================================ */
(() => {
  'use strict';

  const SECTION_ID = 'gags';
  const CANVAS_SELECTOR = '#gags-locker';

  let booted = false;

  function hasVendors() {
    return (
      typeof window.THREE !== 'undefined' &&
      typeof window.gsap !== 'undefined'
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

  /* ================================================================
     Locker void — dust motes suspended in the dark, slow drift,
     cursor parallax. Quieter than the quote orbit: this section
     carries four big screenshots, the void must stay behind them.
     ================================================================ */
  function createLockerVoid(section, canvas) {
    const THREE = window.THREE;
    if (!THREE || !canvas) return null;

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
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const rand = makeRandom(4210);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 14;

    /* dust: two depth layers, warm gray-white, faint amber few */
    const COUNT = 340;
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const warmC = new THREE.Color(0xe07c3e);
    const dustC = new THREE.Color(0xd8cfc2);
    for (let i = 0; i < COUNT; i += 1) {
      pos[i * 3] = (rand() - 0.5) * 34;
      pos[i * 3 + 1] = (rand() - 0.5) * 22;
      pos[i * 3 + 2] = (rand() - 0.5) * 18;
      const c = rand() < 0.18 ? warmC : dustC;
      const dim = 0.35 + rand() * 0.5;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
      size[i] = 0.05 + rand() * 0.14;
      phase[i] = rand() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uTime: { value: 0 } },
      vertexShader: [
        'attribute float aSize;',
        'attribute float aPhase;',
        'uniform float uTime;',
        'varying vec3 vColor;',
        'void main() {',
        '  vColor = color;',
        '  vec3 p = position;',
        '  p.y += sin(uTime * 0.35 + aPhase) * 0.55;',
        '  p.x += cos(uTime * 0.22 + aPhase * 1.7) * 0.4;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_PointSize = aSize * (320.0 / -mv.z);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor;',
        'void main() {',
        '  float d = distance(gl_PointCoord, vec2(0.5));',
        '  float a = smoothstep(0.5, 0.08, d);',
        '  gl_FragColor = vec4(vColor, a * 0.85);',
        '}',
      ].join('\n'),
    });
    const dust = new THREE.Points(geo, mat);
    scene.add(dust);

    /* a few long silk strands hanging in depth */
    const strandMat = new THREE.LineBasicMaterial({
      color: 0xf5ebe0, transparent: true, opacity: 0.1,
    });
    const strands = [];
    for (let s = 0; s < 7; s += 1) {
      const x = (rand() - 0.5) * 30;
      const z = (rand() - 0.5) * 12;
      const len = 8 + rand() * 10;
      const sg = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 11, z),
        new THREE.Vector3(x + (rand() - 0.5) * 2, 11 - len, z),
      ]);
      const line = new THREE.Line(sg, strandMat);
      scene.add(line);
      strands.push(line);
    }

    let raf = 0;
    let running = false;
    let progress = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const clock = new THREE.Clock();

    function resize() {
      const w = section.clientWidth || 1;
      const h = section.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function frame() {
      if (!running) return;
      const t = clock.getElapsedTime();
      mat.uniforms.uTime.value = t;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      camera.position.x = pointer.x * 1.6;
      camera.position.y = pointer.y * 1.0 - progress * 2.5;
      camera.lookAt(0, -progress * 2.5, 0);
      dust.rotation.z = progress * 0.12;
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      clock.start();
      frame();
    }
    function stop() {
      running = false;
      window.cancelAnimationFrame(raf);
    }

    resize();
    window.addEventListener('resize', resize);

    section.addEventListener('pointermove', (e) => {
      const r = section.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.ty = -((e.clientY - r.top) / r.height - 0.5) * 2;
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => (en.isIntersecting ? start() : stop()));
      }, { rootMargin: '20% 0px' }).observe(section);
    } else {
      start();
    }

    return {
      setProgress(p) { progress = p; },
      destroy() { stop(); window.removeEventListener('resize', resize); },
    };
  }

  /* ================================================================
     Tilt + glare (quotes pattern, own custom property namespace)
     ================================================================ */
  function armTilt(grid) {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return;
    grid.addEventListener('pointermove', (e) => {
      const card = e.target.closest ? e.target.closest('.gags__card') : null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--ga-glare-x', (px * 100).toFixed(2) + '%');
      card.style.setProperty('--ga-glare-y', (py * 100).toFixed(2) + '%');
      card.style.setProperty('--ga-tilt-x', ((0.5 - py) * 6).toFixed(2) + 'deg');
      card.style.setProperty('--ga-tilt-y', ((px - 0.5) * 8).toFixed(2) + 'deg');
    }, { passive: true });
    grid.addEventListener('pointerout', (e) => {
      const card = e.target.closest ? e.target.closest('.gags__card') : null;
      if (!card) return;
      card.style.setProperty('--ga-tilt-x', '0deg');
      card.style.setProperty('--ga-tilt-y', '0deg');
    }, { passive: true });
  }

  /* ================================================================
     Spider phrases — one cute line set per exhibit (data-gi)
     ================================================================ */
  const PHRASES = [
    ['not. buddy. energy.', 'she types "buddy" just to watch you seethe', 'the war rages on 💔'],
    ['one (1) goodboy, market rate', 'chatgpt had to step in', 'she holds the monopoly'],
    ['named after a potato. iconic.', 'it just came to her mind. no notes', 'hashbrown forever 🥹'],
    ['she sends, you scream, love wins', 'would you love me… as a spider?', 'eight legs, zero chill'],
  ];

  /* ================================================================
     armSpider — proven armPet architecture + silk thread flight.
     Returns { suspend, resume } for lightbox hooks.
     ================================================================ */
  function armSpider(grid) {
    if (!grid) return null;
    let home = null;
    let leaveTimer = 0;
    let sayTimer = 0;
    let flight = null;
    let flyer = null;
    let suspended = false;
    const visits = [0, 0, 0, 0];

    const SPIDER_SVG =
      '<svg viewBox="0 0 96 96" aria-hidden="true">' +
      '<g stroke="#c9956b" stroke-width="4" stroke-linecap="round" fill="none">' +
      '<path d="M28 52 L12 44 M28 60 L12 60 M28 68 L14 78 M68 52 L84 44 M68 60 L84 60 M68 68 L82 78" />' +
      '<path d="M34 40 L26 26 M62 40 L70 26" /></g>' +
      '<circle cx="26" cy="24" r="4" fill="#c9956b" /><circle cx="70" cy="24" r="4" fill="#c9956b" />' +
      '<ellipse cx="48" cy="58" rx="22" ry="24" fill="#2a2118" stroke="#e07c3e" stroke-width="3" />' +
      '<circle cx="40" cy="52" r="7" fill="#f5ebe0" /><circle cx="56" cy="52" r="7" fill="#f5ebe0" />' +
      '<circle cx="41" cy="53" r="3" fill="#1a1410" /><circle cx="55" cy="53" r="3" fill="#1a1410" />' +
      '<circle cx="42" cy="52" r="1" fill="#f5ebe0" /><circle cx="56" cy="52" r="1" fill="#f5ebe0" />' +
      '<path d="M40 66 Q48 72 56 66" stroke="#f0984a" stroke-width="3" stroke-linecap="round" fill="none" />' +
      '<circle cx="33" cy="61" r="3" fill="#e07c3e" opacity="0.6" />' +
      '<circle cx="63" cy="61" r="3" fill="#e07c3e" opacity="0.6" /></svg>';

    const SPIDER_HTML =
      '<span class="gag-spider__thread" aria-hidden="true"></span>' +
      SPIDER_SVG +
      '<span class="gag-spider__bubble"></span>';

    /* inject one hidden mascot per card */
    const cards = Array.from(grid.querySelectorAll('[data-gags-card]'));
    cards.forEach((card) => {
      const wrap = document.createElement('div');
      wrap.className = 'gag-spider';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = SPIDER_HTML;
      card.appendChild(wrap);
    });

    function ensureFlyer() {
      if (flyer) return flyer;
      const tpl = grid.querySelector('.gag-spider');
      if (!tpl) return null;
      flyer = tpl.cloneNode(true);
      flyer.className = 'gag-spider gag-spider--flyer';
      flyer.removeAttribute('style');
      const bub = flyer.querySelector('.gag-spider__bubble');
      if (bub) bub.textContent = '';
      grid.appendChild(flyer);
      return flyer;
    }

    /* wall-relative anchor at FINAL size (transition frozen) */
    function visualAnchor(card) {
      const sp = card.querySelector('.gag-spider');
      if (!sp) return null;
      const gr = grid.getBoundingClientRect();
      const keep = sp.style.transition;
      sp.style.transition = 'none';
      const r = sp.getBoundingClientRect();
      sp.style.transition = keep;
      return { x: r.left - gr.left, y: r.top - gr.top };
    }

    /* silk thread length = distance from grid top down to the spider */
    function setThread(el, y) {
      if (!el) return;
      el.style.setProperty('--thread-len', Math.max(0, y + 8) + 'px');
    }

    function sayPhrase(card, sp) {
      const bubble = sp.querySelector('.gag-spider__bubble');
      if (!bubble) return;
      const gi = Number(card.dataset.gi);
      const lines = PHRASES[Number.isInteger(gi) ? gi : 0] || PHRASES[0];
      const n = visits[Number.isInteger(gi) ? gi : 0] || 0;
      bubble.textContent = lines[n % lines.length];
      visits[Number.isInteger(gi) ? gi : 0] = n + 1;
      window.clearTimeout(sayTimer);
      card.classList.remove('pet-says');
      void bubble.getBoundingClientRect();
      card.classList.add('pet-says');
      sayTimer = window.setTimeout(() => card.classList.remove('pet-says'), 2600);
    }

    function land(card) {
      const sp = card.querySelector('.gag-spider');
      if (!sp) return;
      card.classList.add('pet-here');
      sp.style.opacity = '';
      sp.style.visibility = '';
      sp.classList.remove('is-hopping');
      void sp.getBoundingClientRect();
      sp.classList.add('is-hopping');
      const anchor = visualAnchor(card);
      setThread(sp.querySelector('.gag-spider__thread'), anchor ? anchor.y : 0);
      sayPhrase(card, sp);
    }

    /* glide on the thread: x eases across, y dips like a pendulum
       (a swing, not the quote pet's hop) + squash on the dip */
    function flightTo(from, to, card) {
      const g = window.gsap;
      const fl = ensureFlyer();
      if (!fl || !g) { land(card); return; }
      if (flight) { flight.kill(); flight = null; }

      const dx = to.x - from.x;
      const dist = Math.sqrt(dx * dx + (to.y - from.y) * (to.y - from.y));
      const swing = Math.min(120, Math.max(48, dist * 0.3));
      const lowY = Math.max(from.y, to.y) + swing;
      const dir = dx >= 0 ? 1 : -1;
      const D = 0.62;
      const thread = fl.querySelector('.gag-spider__thread');

      g.set(fl, { x: from.x, y: from.y, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 });
      fl.classList.add('is-flying');
      setThread(thread, from.y);

      const tl = g.timeline({
        onComplete() {
          fl.classList.remove('is-flying');
          g.set(fl, { opacity: 0 });
          flight = null;
          if (home === card) {
            land(card);
          } else {
            card.classList.remove('pet-here');
            const p = card.querySelector('.gag-spider');
            if (p) { p.style.opacity = ''; p.style.visibility = ''; }
          }
        },
      });

      tl.to(fl, { x: to.x, duration: D, ease: 'power1.inOut' }, 0);
      tl.to(fl, { y: lowY, duration: D * 0.5, ease: 'power2.in' }, 0);
      tl.to(fl, { y: to.y, duration: D * 0.5, ease: 'power2.out' }, D * 0.5);
      /* thread tracks the flyer's ACTUAL y every frame so the silk
         line stays attached through the pendulum dip */
      tl.eventCallback('onUpdate', () => {
        setThread(thread, g.getProperty(fl, 'y'));
      });
      tl.to(fl, { scaleX: 1.22, scaleY: 0.82, duration: 0.14, ease: 'power2.in' }, D * 0.36);
      tl.to(fl, { scaleX: 1, scaleY: 1, duration: 0.2, ease: 'back.out(2.4)' }, D * 0.68);
      tl.to(fl, { rotation: dir * 10, duration: 0.18, ease: 'power1.out' }, 0.06);
      tl.to(fl, { rotation: 0, duration: 0.24, ease: 'power1.inOut' }, D - 0.24);
      flight = tl;
    }

    function park(card) {
      if (suspended) return;
      if (home === card) return;
      const prev = home;

      let from = null;
      if (flight && flyer) {
        const g = window.gsap;
        from = { x: g.getProperty(flyer, 'x'), y: g.getProperty(flyer, 'y') };
        flight.kill();
        flight = null;
      } else if (prev) {
        from = visualAnchor(prev);
      }

      if (prev) {
        const pp = prev.querySelector('.gag-spider');
        if (pp) { pp.style.visibility = 'hidden'; pp.style.opacity = '0'; }
        prev.classList.remove('pet-here');
      }

      home = card;
      if (!home) return;

      home.classList.add('pet-here');
      const tp = home.querySelector('.gag-spider');
      if (tp) {
        tp.style.transition = '';
        tp.style.opacity = '0';
        tp.style.visibility = '';
        tp.classList.remove('is-hopping');
      }

      if (!from) { land(home); return; }
      flightTo(from, visualAnchor(home), home);
    }

    grid.addEventListener('pointerover', (e) => {
      const card = e.target.closest ? e.target.closest('.gags__card') : null;
      if (!card) return;
      window.clearTimeout(leaveTimer);
      park(card);
    });
    grid.addEventListener('pointerout', (e) => {
      const card = e.target.closest ? e.target.closest('.gags__card') : null;
      if (!card) return;
      if (card.contains(e.relatedTarget)) return;
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        if (home) {
          home.classList.remove('pet-here');
          const p = home.querySelector('.gag-spider');
          if (p) { p.style.opacity = ''; p.style.visibility = ''; }
        }
        home = null;
      }, 900);
    });
    grid.addEventListener('click', (e) => {
      const card = e.target.closest ? e.target.closest('.gags__card') : null;
      if (!card) return;
      if (e.target.closest && e.target.closest('.gags__shot')) return;
      park(card);
      card.classList.remove('pet-loved');
      void card.getBoundingClientRect();
      card.classList.add('pet-loved');
    });

    /* lightbox open: finish mid-air swing (never strand the target),
       hide flyer, swallow every bubble until close */
    function suspend() {
      suspended = true;
      window.clearTimeout(leaveTimer);
      window.clearTimeout(sayTimer);
      if (flight) {
        if (window.gsap) flight.progress(1); else flight = null;
      }
      if (flyer) {
        flyer.classList.remove('is-flying');
        if (window.gsap) window.gsap.set(flyer, { opacity: 0 });
      }
      const saying = grid.querySelectorAll('.gags__card.pet-says');
      for (let i = 0; i < saying.length; i += 1) saying[i].classList.remove('pet-says');
    }

    function resume() {
      suspended = false;
      window.clearTimeout(leaveTimer);
    }

    return { suspend, resume };
  }

  /* ================================================================
     Lightbox — quotes pattern (visibility/pointer-events gated)
     ================================================================ */
  function createLightbox(hooks) {
    if (document.querySelector('.gags__lightbox')) return null;
    const box = document.createElement('div');
    box.className = 'gags__lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Chat screenshot, enlarged');
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    const cap = document.createElement('p');
    cap.className = 'gags__lightbox-cap';
    box.appendChild(img);
    box.appendChild(cap);
    document.body.appendChild(box);

    let openCard = null;
    let suppress = false;

    function open(card) {
      if (suppress) return;
      const source = card.querySelector('.gags__shot-img');
      if (!source) return;
      img.src = source.currentSrc || source.src;
      img.alt = source.alt || '';
      const title = card.querySelector('.gags__card-title');
      cap.textContent = (title ? title.textContent + ' — ' : '') + 'straight from our chats';
      box.classList.add('is-open');
      document.body.classList.add('has-artifact-open');
      openCard = card;
      if (hooks && hooks.onOpen) hooks.onOpen(card);
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
      if (hooks && hooks.onClose) hooks.onClose();
    }

    box.addEventListener('click', close);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    return { open, close };
  }

  function boot() {
    if (booted) return;
    const section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || !hasVendors()) {
      window.setTimeout(boot, 150);
      return;
    }
    const grid = section.querySelector('[data-gags-grid]');
    const canvas = section.querySelector(CANVAS_SELECTOR);
    if (!grid) return;

    booted = true;
    document.documentElement.classList.add('js-gags');

    /* boop: wiggle the big spider (existing behavior kept) */
    const boop = section.querySelector('[data-gags-boop]');
    if (boop) {
      boop.addEventListener('click', () => {
        const svg = section.querySelector('[data-testid="gag-spider-svg"]');
        if (!svg) return;
        svg.classList.remove('is-wiggling');
        void svg.getBoundingClientRect();
        svg.classList.add('is-wiggling');
      });
    }

    armTilt(grid);
    const sp = armSpider(grid);
    const lb = createLightbox({
      onOpen: () => { if (sp) sp.suspend(); },
      onClose: () => { if (sp) sp.resume(); },
    });

    grid.addEventListener('click', (e) => {
      if (lb && e.target.closest && e.target.closest('.gags__lightbox')) return;
      const shot = e.target.closest ? e.target.closest('.gags__shot') : null;
      if (!shot || !lb) return;
      const card = shot.closest('.gags__card');
      if (card) lb.open(card);
    });
    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest ? e.target.closest('.gags__card') : null;
      if (!card || !lb) return;
      if (e.target.closest('.gags__spider-btn')) return;
      e.preventDefault();
      lb.open(card);
    });

    /* reveal: low threshold + rootMargin so tall cards always fire
       (story-section lesson: thresholds that never trip = invisible
       content) */
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });
      const revealCards = Array.from(grid.querySelectorAll('[data-gags-card]'));
      revealCards.forEach((c) => observer.observe(c));
    } else {
      grid.querySelectorAll('[data-gags-card]').forEach((c) => c.classList.add('is-visible'));
    }

    /* locker void */
    const void_ = createLockerVoid(section, canvas);
    if (void_ && window.gsap && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.8,
        onUpdate: (self) => void_.setProgress(self.progress),
      });
    } else if (canvas) {
      canvas.style.display = 'none';
    }

    /* headline + lede entrance */
    if (window.gsap && window.ScrollTrigger) {
      const head = section.querySelector('.gags__headline');
      const lede = section.querySelector('.gags__lede');
      if (head) {
        window.gsap.from(head, {
          y: 40, opacity: 0, rotation: -3, duration: 0.8, ease: 'back.out(1.5)',
          scrollTrigger: { trigger: head, start: 'top 88%', toggleActions: 'play none none reverse' },
        });
      }
      if (lede) {
        window.gsap.from(lede, {
          y: 24, opacity: 0, duration: 0.7, delay: 0.12, ease: 'power2.out',
          scrollTrigger: { trigger: lede, start: 'top 90%', toggleActions: 'play none none reverse' },
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
