/* ============================================================
   story — THE ARCHIVE OF US (personal site, full motion)

   Fourteen chambers on a nebula flight. Each chapter carries a real
   chat screenshot rendered as a backlit artifact that
     - tilts in 3D toward the cursor and sweeps a glare,
     - opens into a lightbox on tap ("hold it closer"),
     - reveals its title word-by-word through a mask,
     - scrubs its voiceover from dim to full as she reads, with the
       golden line catching the light.

   The 14-dot rail is a thread that fills 01 → 14 as she travels, and
   every dot she has passed stays lit. One rAF drives the ember
   canvas; the nebula plates breathe on their own CSS animation.

   Full motion always: no reduced-motion branch, no boot ceiling.
   ============================================================ */
(() => {
  'use strict';

  const SECTION_ID = 'story';
  const PRECIOUS = [4, 8, 9, 10, 11, 13, 14];

  let bootTries = 0;
  let booted = false;

  function prefersReducedMotion() {
    return false; /* personal site: full motion */
  }

  function hasGsap() {
    return (
      typeof window.gsap !== 'undefined' &&
      typeof window.ScrollTrigger !== 'undefined'
    );
  }

  /* Word splitter for the chapter titles: mask + inner word, spaces
     preserved, original sentence kept as the accessible name. */
  function splitTitle(el) {
    if (el.dataset.split === 'true') return el.querySelectorAll('.word');
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    const parts = text.split(/(\s+)/);
    el.textContent = '';
    const words = [];
    parts.forEach((part) => {
      if (!part.trim()) {
        el.appendChild(document.createTextNode(part));
        return;
      }
      const mask = document.createElement('span');
      mask.className = 'word-mask';
      mask.setAttribute('aria-hidden', 'true');
      const word = document.createElement('span');
      word.className = 'word';
      word.textContent = part;
      mask.appendChild(word);
      el.appendChild(mask);
      words.push(word);
    });
    el.dataset.split = 'true';
    return words;
  }

  /* Voiceover splitter: every word becomes its own span so scroll can
     light them one at a time. <em> golden phrases keep their markup. */
  function splitVoiceover(el) {
    if (el.dataset.split === 'true') return Array.from(el.querySelectorAll('.vw'));
    const out = [];
    const walk = (node) => {
      const children = Array.from(node.childNodes);
      children.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent;
          const frag = document.createDocumentFragment();
          text.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (!part.trim()) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            const span = document.createElement('span');
            span.className = 'vw';
            span.textContent = part;
            frag.appendChild(span);
            out.push(span);
          });
          node.replaceChild(frag, child);
          return;
        }
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'EM') {
          const em = child;
          const text = em.textContent;
          em.textContent = '';
          text.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (!part.trim()) {
              em.appendChild(document.createTextNode(part));
              return;
            }
            const span = document.createElement('span');
            span.className = 'vw vw-gold';
            span.textContent = part;
            em.appendChild(span);
            out.push(span);
          });
          return;
        }
        if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(el);
    el.dataset.split = 'true';
    return out;
  }

  /* ================================================================
     Lightbox — tap an artifact to hold it closer.
     ================================================================ */
  function createLightbox(section) {
    if (document.querySelector('.story__lightbox')) return null;
    const box = document.createElement('div');
    box.className = 'story__lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Chat screenshot, enlarged');
    box.hidden = false;

    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    const cap = document.createElement('p');
    cap.className = 'story__lightbox-cap';
    box.appendChild(img);
    box.appendChild(cap);
    document.body.appendChild(box);

    let openArt = null;
    let suppressClick = false;

    function open(artifact) {
      if (suppressClick) return;
      const source = artifact.querySelector('.story__artifact-img');
      if (!source) return;
      const chapter = artifact.closest('.story__chamber');
      const title = chapter ? chapter.querySelector('.story__title') : null;
      const date = chapter ? chapter.querySelector('.story__date') : null;
      img.src = source.currentSrc || source.src;
      img.alt = source.alt || '';
      cap.textContent = [title ? title.getAttribute('aria-label') || title.textContent : '',
        date ? date.textContent.trim() : ''].filter(Boolean).join(' — ');
      box.classList.add('is-open');
      document.body.classList.add('has-artifact-open');
      artifact.classList.add('is-held');
      openArt = artifact;
      if (window.gsap) {
        window.gsap.fromTo(img, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'expo.out' });
      }
    }

    function close() {
      if (!openArt) return;
      suppressClick = true;
      window.setTimeout(() => { suppressClick = false; }, 60);
      box.classList.remove('is-open');
      document.body.classList.remove('has-artifact-open');
      openArt.classList.remove('is-held');
      openArt = null;
      if (window.gsap) window.gsap.to(img, { opacity: 0, scale: 0.96, duration: 0.25, ease: 'power2.in' });
      else box.style.display = 'none';
    }

    box.addEventListener('click', close);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    section.addEventListener('click', (e) => {
      // the lightbox covers the page: ignore anything landing on it
      if (box.contains(e.target)) return;
      const artifact = e.target.closest ? e.target.closest('.story__artifact') : null;
      if (!artifact) return;
      if (openArt === artifact) close();
      else open(artifact);
    });

    return { open: open, close: close };
  }

  /* ================================================================
     Ambient engine — one rAF, ember field fed only by scroll depth.
     ================================================================ */
  function createAmbientEngine(section) {
    const canvas = section.querySelector('canvas.story__ambient');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (!ctx) return { start() {}, stop() {} };

    let particles = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let running = false;
    let visible = true;
    const state = { depth: 0, active: false };

    function budget() {
      const vw = window.innerWidth || 0;
      if (vw >= 900) return 96;
      if (vw >= 500) return 54;
      return 26;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = budget();
      particles = new Array(count);
      for (let i = 0; i < count; i += 1) {
        particles[i] = {
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.6 + Math.random() * 2.0,
          vy: -(0.06 + Math.random() * 0.26),
          vx: (Math.random() - 0.5) * 0.1,
          phase: Math.random() * Math.PI * 2,
          twinkle: 0.4 + Math.random() * 0.8,
          gold: Math.random() < 0.5,
        };
      }
    }

    function draw() {
      if (!running) return;
      const t = performance.now() * 0.001;
      const heat = 0.5 + state.depth * 0.9;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.y += p.vy * heat;
        p.x += p.vx + Math.sin(t * 0.4 + p.phase) * 0.16;
        p.phase += 0.012;
        if (p.y < -8) {
          p.y = height + 8;
          p.x = Math.random() * width;
        }
        if (p.x < -8) p.x = width + 8;
        if (p.x > width + 8) p.x = -8;
        const breathe = 0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase);
        const a = (0.16 + breathe * 0.34 + state.depth * 0.2).toFixed(3);
        const c = p.gold ? '238,194,127' : '224,124,62';
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, 'rgba(' + c + ',' + a + ')');
        g.addColorStop(1, 'rgba(' + c + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      rafId = window.requestAnimationFrame(draw);
    }

    function start() {
      if (running || !visible) return;
      running = true;
      resize();
      rafId = window.requestAnimationFrame(draw);
    }

    function stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
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

    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          visible = entry.isIntersecting;
          if (visible) start();
          else stop();
        });
      }, { threshold: 0 });
      observer.observe(section);
    } else {
      start();
    }

    return { start, stop, state };
  }

  /* ================================================================
     THREAD CANVAS — the constellation behind the chambers. Golden
     threads stitch every chamber to the next; each thread brightens
     as she reaches it, and the precious chambers pulse like
     heartbeats. Cursor stirs nearby threads. Fully procedural 2D.
     ================================================================ */
  function createThreadCanvas(section, chapters) {
    const canvas = section.querySelector('canvas.story__threads');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (!ctx) return { setProgress() {}, nudge() {} };

    let w = 0;
    let h = 0;
    let dpr = 1;
    let rafId = 0;
    let running = false;
    let visible = true;
    let progress = 0;
    const pointer = { x: 0.5, y: 0.3, active: false };
    const rand = (() => {
      let s = 20260826;
      return () => {
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
        return s / 4294967296;
      };
    })();

    // drifting anchor stars seeded once
    const stars = [];
    for (let i = 0; i < 90; i += 1) {
      stars.push({
        bx: rand(), by: rand(), r: 0.5 + rand() * 1.6,
        drift: 0.2 + rand() * 0.8, phase: rand() * Math.PI * 2,
        gold: rand() < 0.55,
      });
    }

    function resize() {
      const rect = section.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width || window.innerWidth || 1));
      h = Math.max(1, Math.floor(rect.height || window.innerHeight || 1));
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // chamber centres in canvas space (viewport-relative)
    function centres() {
      const top = canvas.getBoundingClientRect().top;
      return chapters.map((ch) => {
        const r = ch.getBoundingClientRect();
        return {
          x: r.left - canvas.getBoundingClientRect().left + r.width / 2,
          y: r.top - top + r.height / 2,
          w: r.width,
          precious: ch.classList.contains('is-precious'),
        };
      });
    }

    function draw(time) {
      if (!running) { rafId = 0; return; }
      const t = time * 0.001;
      ctx.clearRect(0, 0, w, h);
      const pts = centres();
      const n = pts.length;

      // anchor stars
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const x = ((s.bx + t * 0.004 * s.drift) % 1) * w;
        const y = (s.by * h + Math.sin(t * 0.3 + s.phase) * 8 + h) % h;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.phase));
        const a = (0.1 + tw * 0.3).toFixed(3);
        ctx.fillStyle = s.gold ? 'rgba(238,194,127,' + a + ')' : 'rgba(200,170,220,' + a + ')';
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // threads between consecutive chambers. A segment draws only
      // while at least one of its chambers is near the viewport —
      // otherwise a single line would span the whole journey.
      const lit = progress * (n - 1);
      const MARGIN = 500;
      for (let i = 0; i < n - 1; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        const aNear = a.y > -MARGIN && a.y < h + MARGIN;
        const bNear = b.y > -MARGIN && b.y < h + MARGIN;
        if (!aNear && !bNear) continue;
        const drawA = { x: a.x, y: Math.max(-MARGIN, Math.min(h + MARGIN, a.y)) };
        const drawB = { x: b.x, y: Math.max(-MARGIN, Math.min(h + MARGIN, b.y)) };
        const ax = drawA.x;
        const ay = drawA.y;
        const bx = drawB.x;
        const by = drawB.y;
        const seg = Math.max(0, Math.min(1, lit - i));
        const segs = 26;
        ctx.lineWidth = 1.4;
        for (let sgm = 0; sgm < segs; sgm += 1) {
          const f0 = sgm / segs;
          const f1 = (sgm + 1) / segs;
          const bright = f1 <= seg ? 1 : 0.16;
          const mx = ax + (bx - ax) * ((f0 + f1) / 2);
          const sway = Math.sin(t * 0.9 + i * 1.7 + f0 * 5) * 14 * (1 - Math.abs(f0 - 0.5) * 2);
          // cursor stir: threads lean away near the hand
          let px = 0;
          let py = 0;
          if (pointer.active) {
            const dx = (pointer.x * w - mx);
            const dy = (pointer.y * h - (ay + (by - ay) * ((f0 + f1) / 2)));
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 190 && d > 1) {
              const push = (1 - d / 190) * 26;
              px = (dx / d) * push;
              py = (dy / d) * push;
            }
          }
          const x0 = ax + (bx - ax) * f0 + sway * f0 + px * f0;
          const y0 = ay + (by - ay) * f0 + py * f0;
          const x1 = ax + (bx - ax) * f1 + sway * f1 + px * f1;
          const y1 = ay + (by - ay) * f1 + py * f1;
          const shimmer = (0.42 + 0.22 * Math.sin(t * 2 + i + f0 * 6)).toFixed(3);
          const glow = bright > 0.5
            ? 'rgba(255,227,174,' + shimmer + ')'
            : 'rgba(212,168,106,0.14)';
          ctx.strokeStyle = glow;
          ctx.shadowColor = bright > 0.5 ? 'rgba(238,194,127,0.8)' : 'transparent';
          ctx.shadowBlur = bright > 0.5 ? 8 : 0;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // node pulse on each chamber
        for (let k = 0; k < 2; k += 1) {
          const p = k === 0 ? a : b;
          const idx = k === 0 ? i : i + 1;
          if (p.y < -100 || p.y > h + 100) continue;
          const on = idx <= lit + 0.001;
          const pulse = p.precious
            ? 1 + Math.sin(t * 2.6 + idx) * 0.35
            : 1 + Math.sin(t * 1.4 + idx) * 0.12;
          const r = (on ? 5 : 3) * pulse;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
          const core = on ? '255,227,174' : '212,168,106';
          grad.addColorStop(0, 'rgba(' + core + ',' + (on ? 0.95 : 0.4) + ')');
          grad.addColorStop(1, 'rgba(' + core + ',0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafId = window.requestAnimationFrame(draw);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      if (!rafId) rafId = window.requestAnimationFrame(draw);
    }

    function stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    section.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = (e.clientX - rect.left) / rect.width;
      pointer.y = (e.clientY - rect.top) / rect.height;
      pointer.active = true;
    }, { passive: true });
    section.addEventListener('pointerleave', () => { pointer.active = false; }, { passive: true });

    let resizeQueued = false;
    window.addEventListener('resize', () => {
      if (resizeQueued) return;
      resizeQueued = true;
      window.requestAnimationFrame(() => {
        resizeQueued = false;
        if (running) resize();
      });
    }, { passive: true });

    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          visible = entry.isIntersecting;
          if (visible) start();
          else stop();
        });
      }, { threshold: 0 });
      observer.observe(section);
    } else {
      start();
    }

    return {
      setProgress(v) { progress = Math.max(0, Math.min(1, v || 0)); },
      nudge() { resize(); },
    };
  }

  function boot() {
    if (booted) return;
    const section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || !hasGsap()) {
      bootTries += 1;
      window.setTimeout(boot, 120);
      return;
    }
    const chapters = Array.from(section.querySelectorAll('[data-chapter]'));
    if (chapters.length === 0) return;

    booted = true;
    document.documentElement.classList.add('js-story');
    window.gsap.registerPlugin(window.ScrollTrigger);

    const progress = section.querySelector('[data-story-progress]');
    const list = progress ? progress.querySelector('.story__progress-list') : null;
    const dots = progress
      ? Array.from(progress.querySelectorAll('.story__progress-item'))
      : [];

    // mark the chambers the owner called precious
    PRECIOUS.forEach((n) => {
      const el = section.querySelector('[data-chapter="' + n + '"]');
      if (el) el.classList.add('is-precious');
    });

    const ambient = createAmbientEngine(section);
    const threads = createThreadCanvas(section, chapters);
    createLightbox(section);

    // ── Cursor tilt + glare on every artifact ───────────────────
    chapters.forEach((chapter) => {
      const artifact = chapter.querySelector('.story__artifact');
      if (!artifact) return;
      if (typeof window.matchMedia('(pointer: coarse)').matches) return;

      let rafId = 0;
      let tx = 0;
      let ty = 0;

      function onMove(event) {
        const rect = artifact.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        artifact.style.setProperty('--glare-x', (px * 100).toFixed(2) + '%');
        artifact.style.setProperty('--glare-y', (py * 100).toFixed(2) + '%');
        tx = (0.5 - py) * 9;
        ty = (px - 0.5) * 13;
        if (rafId) return;
        rafId = window.requestAnimationFrame(() => {
          rafId = 0;
          artifact.style.setProperty('--tilt-x', tx.toFixed(2) + 'deg');
          artifact.style.setProperty('--tilt-y', ty.toFixed(2) + 'deg');
        });
      }

      function onLeave() {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
        artifact.style.setProperty('--tilt-x', '0deg');
        artifact.style.setProperty('--tilt-y', '0deg');
      }

      artifact.addEventListener('pointermove', onMove, { passive: true });
      artifact.addEventListener('pointerleave', onLeave, { passive: true });
    });

    // ── Per-chamber choreography ────────────────────────────────
    chapters.forEach((chapter, index) => {
      const titleWords = splitTitle(chapter.querySelector('[data-chamber-title]'));
      const voiceWords = splitVoiceover(chapter.querySelector('[data-voiceover]'));
      const artifact = chapter.querySelector('.story__artifact');

      // 3D arrival: the chamber rises in from depth, once
      window.gsap.fromTo(
        chapter,
        { opacity: 0, y: 90, rotateX: 7, scale: 0.965, transformPerspective: 1400 },
        {
          opacity: 1, y: 0, rotateX: 0, scale: 1,
          duration: 1.15, ease: 'expo.out',
          scrollTrigger: { trigger: chapter, start: 'top 86%', toggleActions: 'play none none reverse' },
        }
      );

      if (titleWords.length) {
        window.gsap.set(titleWords, { yPercent: 118 });
        window.ScrollTrigger.create({
          trigger: chapter.querySelector('[data-chamber-title]'),
          start: 'top 88%',
          onEnter: () => {
            window.gsap.to(titleWords, { yPercent: 0, duration: 0.95, ease: 'expo.out', stagger: 0.045, overwrite: 'auto' });
          },
          onLeaveBack: () => {
            window.gsap.to(titleWords, { yPercent: 118, duration: 0.5, ease: 'power2.in', overwrite: 'auto' });
          },
        });
      }

      if (artifact) {
        window.gsap.set(artifact, { opacity: 0, y: 60, scale: 0.94 });
        window.ScrollTrigger.create({
          trigger: artifact,
          start: 'top 92%',
          onEnter: () => {
            window.gsap.to(artifact, { opacity: 1, y: 0, scale: 1, duration: 1.05, ease: 'expo.out', overwrite: 'auto' });
          },
          onLeaveBack: () => {
            window.gsap.to(artifact, { opacity: 0, y: 60, scale: 0.94, duration: 0.5, ease: 'power2.in', overwrite: 'auto' });
          },
        });
      }

      // voiceover lights word by word at her own scroll pace
      if (voiceWords.length) {
        window.gsap.fromTo(
          voiceWords,
          { opacity: 0.16 },
          {
            opacity: 1, ease: 'none', stagger: 0.6,
            scrollTrigger: {
              trigger: chapter,
              start: 'top 88%',
              end: 'bottom 45%',
              scrub: 0.7,
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // active dot + read trail
      window.ScrollTrigger.create({
        trigger: chapter,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
          if (!self.isActive) return;
          dots.forEach((dot, dotIndex) => {
            const active = dotIndex === index;
            dot.classList.toggle('is-active', active);
            if (dotIndex < index) dot.classList.add('is-read');
            if (active) dot.setAttribute('aria-current', 'true');
            else dot.removeAttribute('aria-current');
          });
        },
      });
    });

    // ── The thread: one rail progress across the whole journey ──
    if (list) {
      window.ScrollTrigger.create({
        trigger: section,
        start: 'top 60%',
        end: 'bottom 40%',
        onUpdate: (self) => {
          list.style.setProperty('--story-rail-progress', self.progress.toFixed(4));
          ambient.state.depth = self.progress;
          threads.setProgress(self.progress);
          section.style.setProperty('--story-glow', self.progress.toFixed(4));
        },
        onToggle: (self) => {
          ambient.state.active = self.isActive;
          progress.classList.toggle('is-visible', self.isActive);
        },
      });
    }

    // headline reveal on entry
    window.gsap.from('.story__headline', {
      autoAlpha: 0, y: 34, scale: 0.97, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: section, start: 'top 72%', toggleActions: 'play none none reverse' },
    });
    window.gsap.from('.story__lede', {
      autoAlpha: 0, y: 20, duration: 0.9, ease: 'power3.out', delay: 0.12,
      scrollTrigger: { trigger: section, start: 'top 68%', toggleActions: 'play none none reverse' },
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
