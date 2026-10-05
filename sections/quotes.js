/* ============================================================
   quotes — THE WALL OF ZAINAB (personal site, full motion)

   Orbital evidence locker for 80 quote-bot cards (11 ultra rare).
   Data-driven: cards render from content/quotes-manifest.json, so new
   quotes merge in with zero markup edits. Layers:

   - Three.js orbit void: numbered evidence tags drifting in depth +
     rising ember sparks, cursor orbit (camBase pattern: distance fixed,
     angle follows the hand — nothing can shrink).
   - Threat headline: kinetic word slam-in on entry.
   - Wall: batch-cascade entrance, EVIDENCE stamp on every card, gold
     foil on rares, cursor tilt + glare, tap-to-hold lightbox,
     "shake the wall" FLIP shuffle, live counter.
   - Full motion always. One renderer, one rAF, pause off-screen.
   ============================================================ */
(() => {
  'use strict';

  const SECTION_ID = 'quotes';
  const CANVAS_SELECTOR = '#quotes-orbit';
  const MANIFEST_URL = 'content/quotes-manifest.json';

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

  /* ================================================================
     Orbit void — evidence tags + embers in depth, cursor orbit.
     ================================================================ */
  function createOrbitVoid(section, canvas, count) {
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

    const rand = makeRandom(6660);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const camBase = { x: 0, y: 0, z: 9 };
    camera.position.set(0, 0, 9);

    // evidence tags: small glowing numbered chips as sprites
    const tagCount = Math.min(count, 40);
    const tagGroup = new THREE.Group();
    scene.add(tagGroup);
    const tags = [];
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 128;
    tagCanvas.height = 64;

    function tagTexture(label, rare) {
      const ctx = tagCanvas.getContext('2d');
      ctx.clearRect(0, 0, 128, 64);
      ctx.fillStyle = rare ? 'rgba(60,38,8,0.92)' : 'rgba(20,14,10,0.92)';
      ctx.strokeStyle = rare ? '#ffe3ae' : '#c9956b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(4, 8, 120, 48, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rare ? '#ffe3ae' : '#f5ebe0';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 64, 34);
      const tex = new THREE.CanvasTexture(tagCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    for (let i = 0; i < tagCount; i += 1) {
      const rare = i % 7 === 0;
      const tex = tagTexture(rare ? '★' + String(i + 1).padStart(2, '0') : String(i + 1).padStart(2, '0'), rare);
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        opacity: rare ? 0.95 : 0.7,
      });
      const sp = new THREE.Sprite(mat);
      const s = rare ? 1.15 : 0.7 + rand() * 0.5;
      sp.scale.set(s * 1.6, s * 0.8, 1);
      const ang = rand() * Math.PI * 2;
      const rad = 2.6 + rand() * 3.4;
      sp.position.set(Math.cos(ang) * rad, (rand() * 2 - 1) * 3.4, -1 - rand() * 4);
      sp.userData = {
        ang, rad, yBase: sp.position.y,
        speed: 0.05 + rand() * 0.1,
        bobAmp: 0.15 + rand() * 0.25,
        phase: rand() * Math.PI * 2,
      };
      tagGroup.add(sp);
      tags.push(sp);
    }

    // rising embers
    const emberCount = 130;
    const epos = new Float32Array(emberCount * 3);
    const eseed = [];
    for (let i = 0; i < emberCount; i += 1) {
      epos[i * 3] = (rand() * 2 - 1) * 7;
      epos[i * 3 + 1] = -4 + rand() * 9;
      epos[i * 3 + 2] = -2 - rand() * 4;
      eseed.push({ rise: 0.3 + rand() * 0.6, sway: 0.3 + rand() * 0.8, phase: rand() * Math.PI * 2 });
    }
    const egeo = new THREE.BufferGeometry();
    egeo.setAttribute('position', new THREE.BufferAttribute(epos, 3));
    const emat = new THREE.PointsMaterial({
      color: 0xe8a33d, size: 0.05, transparent: true, opacity: 0.8,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const embers = new THREE.Points(egeo, emat);
    embers.frustumCulled = false;
    scene.add(embers);

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

    let running = false;
    let rafId = 0;

    function frame() {
      if (!running) return;
      const t = performance.now() * 0.001;
      ease.x += ((pointer.seen ? pointer.x : 0) - ease.x) * 0.14;
      ease.y += ((pointer.seen ? pointer.y : 0) - ease.y) * 0.14;

      for (let i = 0; i < tags.length; i += 1) {
        const sp = tags[i];
        const u = sp.userData;
        const a = u.ang + t * u.speed + progress * 1.2;
        sp.position.x = Math.cos(a) * u.rad;
        sp.position.z = -2.4 + Math.sin(a * 0.7) * 1.4;
        sp.position.y = u.yBase + Math.sin(t * 0.7 + u.phase) * u.bobAmp;
      }

      const arr = egeo.attributes.position.array;
      for (let i = 0; i < emberCount; i += 1) {
        const s = eseed[i];
        arr[i * 3 + 1] += s.rise * 0.016;
        arr[i * 3] += Math.sin(t * s.sway + s.phase) * 0.004;
        if (arr[i * 3 + 1] > 5) {
          arr[i * 3 + 1] = -4.5;
          arr[i * 3] = (Math.random() * 2 - 1) * 7;
        }
      }
      egeo.attributes.position.needsUpdate = true;

      // cursor orbit: fixed distance, angle follows the hand
      const orbitR = Math.sqrt(camBase.x * camBase.x + camBase.z * camBase.z);
      const baseAngle = Math.atan2(camBase.x, camBase.z);
      const newAngle = baseAngle + ease.x * 0.8;
      camera.position.set(
        Math.sin(newAngle) * orbitR,
        camBase.y + ease.y * 0.8,
        Math.cos(newAngle) * orbitR
      );
      camera.lookAt(-ease.x * 1.0, -ease.y * 0.5, -2);
      camera.rotateZ(ease.x * 0.05);

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
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

    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) start();
          else stop();
        });
      }, { threshold: 0 });
      observer.observe(section);
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

    return {
      setProgress(p) { progress = Math.max(0, Math.min(1, p || 0)); },
    };
  }

  /* ================================================================
     Wall — data-driven cards, stamp, tilt, lightbox, shuffle.
     ================================================================ */
  async function loadManifest() {
    /* content/quotes-manifest.js ships the data as a plain global so the
       page works from file:// previews where fetch() is blocked */
    const pre = window.QUOTES_MANIFEST;
    if (Array.isArray(pre) && pre.length) return pre;
    const res = await fetch(MANIFEST_URL, { cache: 'force-cache' });
    if (!res.ok) throw new Error('quotes manifest ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('quotes empty');
    return data;
  }

  function buildCard(item, index) {
    const fig = document.createElement('figure');
    fig.className = 'quote-exhibit' + (item.rare ? ' quote-exhibit--rare' : '');
    fig.tabIndex = 0;
    fig.setAttribute('data-quote-id', item.id);
    fig.setAttribute('data-qi', String(index));
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

    fig.insertAdjacentHTML('beforeend',
      '<div class="quote-pet" aria-hidden="true">' +
      '<span class="quote-pet__shadow"></span>' +
      '<span class="quote-pet__body">' +
      '<span class="quote-pet__ear quote-pet__ear--l"></span>' +
      '<span class="quote-pet__ear quote-pet__ear--r"></span>' +
      '<span class="quote-pet__face">' +
      '<span class="quote-pet__eye quote-pet__eye--l"></span>' +
      '<span class="quote-pet__eye quote-pet__eye--r"></span>' +
      '<span class="quote-pet__blush quote-pet__blush--l"></span>' +
      '<span class="quote-pet__blush quote-pet__blush--r"></span>' +
      '<span class="quote-pet__mouth"></span>' +
      '</span>' +
      '<span class="quote-pet__feet"><span></span><span></span></span>' +
      '</span>' +
      '<span class="quote-pet__bubble"></span>' +
'<span class="quote-pet__hearts"><i>\u2665</i><i>\u2665</i><i>\u2665</i></span>' +
      '</div>');

    return fig;
  }

  function armTilt(wall) {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return;
    wall.addEventListener('pointermove', (e) => {
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--ex-glare-x', (px * 100).toFixed(2) + '%');
      card.style.setProperty('--ex-glare-y', (py * 100).toFixed(2) + '%');
      card.style.setProperty('--ex-tilt-x', ((0.5 - py) * 10).toFixed(2) + 'deg');
      card.style.setProperty('--ex-tilt-y', ((px - 0.5) * 14).toFixed(2) + 'deg');
    }, { passive: true });
    wall.addEventListener('pointerout', (e) => {
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (!card) return;
      card.style.setProperty('--ex-tilt-x', '0deg');
      card.style.setProperty('--ex-tilt-y', '0deg');
    }, { passive: true });
  }

  /* The pet: parks on the hovered exhibit, hops on arrival, pops
     hearts when its card is clicked, wanders off after hover ends. */
  /* 80 unique pet phrases, index-aligned with content/quotes-manifest.json.
     The pet is its own little character: cute, playful, sweet. */
  const PHRASES = [
    "hihi! read this one!!",
    "boop! this quote's a good one",
    "yesss this!! this this this",
    "hehe, classic right??",
    "omgosh this one!!",
    "stop, this one still makes me smile",
    "a certified banger, trust me",
    "you'll like this one, i promise",
    "ehehe, so true bestie",
    "this one's warm and fuzzy, look!",
    "one of my faves, not gonna lie",
    "aww, this one!!",
    "read it read it read it!!",
    "heehee, this one's silly",
    "this quote gives hugs, okay?",
    "i giggled way too hard at this",
    "honestly? icon behavior",
    "this one's a little hug on paper",
    "you can't tell me this isn't cute",
    "heehee, quotes am i right",
    "soft hours only for this one",
    "this one smells like sunshine",
    "brace yourself, it's a sweet one",
    "okay but look at this one!!",
    "this quote and i are best friends",
    "a lil bit feral, a lil bit sweet",
    "this one's got main character energy",
    "eeek, this one!!",
    "everything about this is yes",
    "this is the vibe, the whole vibe",
    "cozy detected, proceed gently",
    "i knitted this quote with love",
    "this one's stitched with glitter",
    "heehee, trust, just read it",
    "this quote gives good dreams",
    "soft hours, please enjoy",
    "a tiny firework of a quote!!",
    "this one's my emotional support text",
    "glowy, glowy little quote",
    "you gotta smile at this one, rules",
    "this one's wrapped in a blanket",
    "sweet like late-night snacks",
    "pat pat, this quote pats back",
    "heehee, this one's a cheeky lil thing",
    "warning: cuteness ahead",
    "this quote knows a secret about you",
    "warm socks energy, this one",
    "giggles included at no extra cost",
    "this one's my happy place",
    "soft and a little bit silly",
    "floaty! this quote makes me floaty",
    "butterflies, but like, the nice kind",
    "this one's a pocketful of confetti",
    "squee! okay okay look!!",
    "i saved this one for a nice moment",
    "this quote tastes like candy",
    "happy little accident of a quote!!",
    "this one's basically a warm hug",
    "twinkle twinkle, little quote",
    "heehee, this one winks at you",
    "comfy vibes only on this card",
    "this quote is a tiny adventure",
    "marshmallow soft, this one",
    "wiggly with excitement, look!!",
    "this one's my cozy corner",
    "sugar rush but make it a quote",
    "glitter in text form, yesss",
    "this quote and i are giggling",
    "home is where this quote is",
    "ohh you found a shiny one!!",
    "pssst.. this one's a keeper",
    "ooh la la, ultra rare!!",
    "you have good eyes, huhu",
    "special delivery, just for you",
    "this one made my heart do a flip",
    "treasure detected!! *sparkle*",
    "shh.. not everyone gets to see this",
    "you really went digging, i love it",
    "gold star for finding me!!",
    "hehe this one's my little secret",
  ];

  function armPet(wall) {
    if (!wall) return null;
    let home = null;
    let leaveTimer = 0;
    let sayTimer = 0;
    let flight = null;
    let flyer = null;
    let suspended = false;

    /* one shared pet that physically jumps between cards; per-card pets
       stay hidden until the flyer lands on them */
    function ensureFlyer() {
      if (flyer) return flyer;
      const tpl = wall.querySelector('.quote-pet');
      if (!tpl) return null;
      flyer = tpl.cloneNode(true);
      flyer.className = 'quote-pet quote-pet--flyer';
      flyer.removeAttribute('style');
      const bub = flyer.querySelector('.quote-pet__bubble');
      if (bub) bub.textContent = '';
      wall.appendChild(flyer);
      return flyer;
    }

    /* wall-relative anchor of a card's pet at its FINAL size: the
       transition is frozen for the measurement so we read the end state,
       including any hover transform on the card itself */
    function visualAnchor(card) {
      const pet = card.querySelector('.quote-pet');
      if (!pet) return null;
      const wr = wall.getBoundingClientRect();
      const keep = pet.style.transition;
      pet.style.transition = 'none';
      const r = pet.getBoundingClientRect();
      pet.style.transition = keep;
      return { x: r.left - wr.left, y: r.top - wr.top };
    }

    /* the pet says its line for this exhibit, then the bubble fades */
    function sayPhrase(card, pet) {
      const bubble = pet.querySelector('.quote-pet__bubble');
      if (!bubble) return;
      const qi = Number(card.dataset.qi);
      bubble.textContent = PHRASES[Number.isInteger(qi) ? qi : 0] || PHRASES[0];
      window.clearTimeout(sayTimer);
      card.classList.remove('pet-says');
      void bubble.getBoundingClientRect();
      card.classList.add('pet-says');
      sayTimer = window.setTimeout(() => card.classList.remove('pet-says'), 2600);
    }

    /* reveal the per-card pet with hop + phrase */
    function land(card) {
      const pet = card.querySelector('.quote-pet');
      if (!pet) return;
      card.classList.add('pet-here');
      pet.style.opacity = '';
      pet.style.visibility = '';
      pet.classList.remove('is-hopping');
      void pet.getBoundingClientRect();
      pet.classList.add('is-hopping');
      sayPhrase(card, pet);
    }

    /* squash-stretch arc from -> to; on complete the per-card pet takes over */
    function flightTo(from, to, card) {
      const g = window.gsap;
      const fl = ensureFlyer();
      if (!fl || !g) { land(card); return; }
      if (flight) { flight.kill(); flight = null; }

      const dx = to.x - from.x;
      const dist = Math.sqrt(dx * dx + (to.y - from.y) * (to.y - from.y));
      const arc = Math.min(180, Math.max(70, dist * 0.42));
      const peak = Math.min(from.y, to.y) - arc;
      const dir = dx >= 0 ? 1 : -1;
      const D = 0.52;

      g.set(fl, { x: from.x, y: from.y, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 });
      fl.classList.add('is-flying');

      const tl = g.timeline({
        onComplete() {
          fl.classList.remove('is-flying');
          g.set(fl, { opacity: 0 });
          flight = null;
          if (home === card) {
            land(card);
          } else {
            /* cursor moved on or left: never strand a hidden pet */
            card.classList.remove('pet-here');
            const p = card.querySelector('.quote-pet');
            if (p) { p.style.opacity = ''; p.style.visibility = ''; }
          }
        },
      });

      tl.to(fl, { x: to.x, duration: D, ease: 'power1.inOut' }, 0);
      tl.to(fl, { y: peak, duration: D * 0.5, ease: 'power2.out' }, 0);
      tl.to(fl, { y: to.y, duration: D * 0.5, ease: 'power2.in' }, D * 0.5);
      tl.to(fl, { scaleX: 1.3, scaleY: 0.72, duration: 0.07, ease: 'power2.out' }, 0);
      tl.to(fl, { scaleX: 0.9, scaleY: 1.2, duration: 0.16, ease: 'power1.inOut' }, 0.07);
      tl.to(fl, { scaleX: 1.25, scaleY: 0.78, duration: 0.08, ease: 'power2.in' }, D);
      tl.to(fl, { scaleX: 1, scaleY: 1, duration: 0.18, ease: 'back.out(3)' }, D + 0.08);
      tl.to(fl, { rotation: dir * 8, duration: 0.16, ease: 'power1.out' }, 0.05);
      tl.to(fl, { rotation: 0, duration: 0.2, ease: 'power1.inOut' }, D - 0.22);
      flight = tl;
    }

    function park(card) {
      if (suspended) return;
      if (home === card) return;
      const prev = home;

      /* launch point: mid-air flyer position when interrupting a jump,
         else where the previous pet visibly sits right now */
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
        const pp = prev.querySelector('.quote-pet');
        if (pp) { pp.style.visibility = 'hidden'; pp.style.opacity = '0'; }
        prev.classList.remove('pet-here');
      }

      home = card;
      if (!home) return;

      /* target pet: full size but invisible until the flyer lands on it */
      home.classList.add('pet-here');
      const tp = home.querySelector('.quote-pet');
      if (tp) {
        tp.style.transition = '';
        tp.style.opacity = '0';
        tp.style.visibility = '';
        tp.classList.remove('is-hopping');
      }

      if (!from) { land(home); return; }
      flightTo(from, visualAnchor(home), home);
    }

    wall.addEventListener('pointerover', (e) => {
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (!card) return;
      window.clearTimeout(leaveTimer);
      park(card);
    });
    wall.addEventListener('pointerout', (e) => {
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (!card) return;
      if (card.contains(e.relatedTarget)) return;
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        if (home) {
          home.classList.remove('pet-here');
          const p = home.querySelector('.quote-pet');
          if (p) { p.style.opacity = ''; p.style.visibility = ''; }
        }
        home = null;
      }, 900);
    });
    wall.addEventListener('click', (e) => {
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (!card) return;
      park(card);
      card.classList.remove('pet-loved');
      void card.getBoundingClientRect();
      card.classList.add('pet-loved');
    }, true);

    /* lightbox is open: finish any mid-air jump (never strand the target
       pet), hide the flyer, and swallow every bubble until it closes */
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
      const saying = wall.querySelectorAll('.quote-exhibit.pet-says');
      for (let i = 0; i < saying.length; i += 1) saying[i].classList.remove('pet-says');
    }

    function resume() {
      suspended = false;
      window.clearTimeout(leaveTimer);
    }

    return { suspend, resume };
  }

  function createLightbox(hooks) {
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

  function shuffleWall(wall) {
    const cards = Array.from(wall.children);
    if (cards.length < 2 || !window.gsap) {
      // no-gsap fallback: plain DOM shuffle
      for (let i = cards.length - 1; i > 0; i -= 1) {
        const k = Math.floor(Math.random() * (i + 1));
        wall.appendChild(cards[k]);
      }
      return;
    }
    // FLIP: record, reorder, invert, play
    const first = new Map();
    cards.forEach((el) => { first.set(el, el.getBoundingClientRect()); });
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

  async function boot() {
    if (booted) return;
    const section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || !hasVendors()) {
      window.setTimeout(boot, 120);
      return;
    }
    const wall = section.querySelector('[data-quotes-wall]');
    const canvas = section.querySelector(CANVAS_SELECTOR);
    if (!wall || !canvas) return;

    let items;
    try {
      items = await loadManifest();
    } catch (err) {
      if (window.console && console.warn) console.warn('[quotes] manifest failed:', err);
      return;
    }

    booted = true;
    document.documentElement.classList.add('js-quotes');

    // render all cards
    const frag = document.createDocumentFragment();
    items.forEach((item, i) => frag.appendChild(buildCard(item, i)));
    wall.appendChild(frag);

    const count = section.querySelector('[data-quotes-count]');
    if (count) count.textContent = String(items.length);
    const rare = section.querySelector('[data-quotes-rare]');
    if (rare) rare.textContent = String(items.filter((x) => x.rare).length);

    armTilt(wall);
    const pet = armPet(wall);
    const lb = createLightbox({
      onOpen: () => { if (pet) pet.suspend(); },
      onClose: () => { if (pet) pet.resume(); },
    });

    wall.addEventListener('click', (e) => {
      if (lb && e.target.closest && e.target.closest('.quotes__lightbox')) return;
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (!card || !lb) return;
      lb.open(card);
    });
    wall.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest ? e.target.closest('.quote-exhibit') : null;
      if (!card || !lb) return;
      e.preventDefault();
      lb.open(card);
    });

    const btn = section.querySelector('[data-quotes-shuffle]');
    if (btn) {
      btn.addEventListener('click', () => {
        shuffleWall(wall);
        if (window.Motion && typeof window.Motion.burst === 'function') {
          window.Motion.burst({ particleCount: 60, spread: 70 });
        }
      });
    }

    // 3D void behind the wall
    const orbit = createOrbitVoid(section, canvas, items.length);
    if (orbit && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.8,
        onUpdate: (self) => orbit.setProgress(self.progress),
      });
    } else if (canvas) {
      canvas.style.display = 'none';
    }

    // threat slam-in
    const words = Array.from(section.querySelectorAll('.qthreat-i'));
    if (words.length && window.gsap) {
      window.gsap.set(words, { yPercent: 120, rotation: 6 });
      window.gsap.to(words, {
        yPercent: 0, rotation: 0, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.045,
        scrollTrigger: { trigger: section.querySelector('.quotes__headline'), start: 'top 85%', toggleActions: 'play none none reverse' },
      });
    }

    // batch cascade entrance + stamp snap
    const cards = Array.from(wall.children);
    if (window.gsap && window.ScrollTrigger && cards.length) {
      window.gsap.set(cards, { opacity: 0, y: 70, scale: 0.92, rotation: () => (Math.random() - 0.5) * 8 });
      window.ScrollTrigger.batch(cards, {
        start: 'top 92%',
        onEnter: (batch) => {
          window.gsap.to(batch, {
            opacity: 1, y: 0, scale: 1, rotation: 0,
            duration: 0.9, ease: 'expo.out', stagger: 0.06, overwrite: true,
          });
          batch.forEach((card) => {
            card.classList.add('is-in');
            const stamp = card.querySelector('.quote-exhibit__stamp');
            if (stamp) {
              window.gsap.fromTo(stamp, { scale: 2.2, opacity: 0, rotation: -18 }, {
                scale: 1, opacity: 1, rotation: -7, duration: 0.4, ease: 'power4.in', delay: 0.35,
              });
            }
          });
        },
        onLeaveBack: (batch) => {
          window.gsap.to(batch, { opacity: 0, y: 70, scale: 0.92, duration: 0.5, ease: 'power2.in', overwrite: true });
          batch.forEach((card) => card.classList.remove('is-in'));
        },
      });
    } else {
      cards.forEach((card) => card.classList.add('is-in'));
    }

    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(() => window.ScrollTrigger && window.ScrollTrigger.refresh()).catch(() => {});
    }
    window.addEventListener('load', () => window.ScrollTrigger && window.ScrollTrigger.refresh());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
