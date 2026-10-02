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
        window.gsap.fromTo(
          titleWords,
          { yPercent: 118 },
          {
            yPercent: 0, duration: 0.95, ease: 'expo.out', stagger: 0.045,
            scrollTrigger: { trigger: chapter.querySelector('[data-chamber-title]'), start: 'top 84%', toggleActions: 'play none none reverse' },
          }
        );
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
