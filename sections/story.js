(() => {
  'use strict';

  const SECTION_ID = 'story';
  // Sibling-vendor race guard (mirrors sections/birthday.js): the birthday
  // bundle shares these lazy script tags, so story.js may execute before
  // gsap/ScrollTrigger parse. Retry briefly; a vendors-blocked lane
  // (kill-switch false) settles read-only immediately, never spins.
  let bootAttempts = 0;
  const BOOT_ATTEMPT_MAX = 200;
  const BOOT_RETRY_MS = 50;
  /* personal site: full motion always. */
  function prefersReducedMotion() {
    return false;
  }

  function hasGsap() {
    // GSAP discipline: the single kill-switch in js/motion.js owns this
    // decision. When it reports false (reduced-motion, or GSAP not yet
    // lazy-loaded) the chapters stay a plain readable stack.
    if (window.Motion && typeof window.Motion.hasGsap === 'function') {
      return window.Motion.hasGsap();
    }
    return (
      typeof window.gsap !== 'undefined' &&
      typeof window.ScrollTrigger !== 'undefined'
    );
  }

  // Motion progress is owned by the existing ScrollTriggers and handed to
  // the ambient engine through this single shared state object. No new
  // progress readers and no scroll listeners are introduced: every value
  // below is written from an onUpdate/onToggle callback that already
  // exists on the three (and only three) construction call sites.
  function createMotionState(chapterCount) {
    return {
      unlocked: false,
      sectionProgress: 0,
      sectionActive: false,
      chapterProgress: new Array(chapterCount).fill(0),
      // 0..1 reading of where the visitor is in the archive, derived
      // from the section scrub; the ambient engine turns this into
      // particle warmth and atmosphere drift.
      depth: 0
    };
  }

  /* ================================================================
     Ambient background engine — ONE rAF, owned entirely by this file.
     It draws the ember particle field into canvas.story__ambient and
     nudges the .story__atmosphere plate's progress signal. It is fed
     ONLY by motionState (written by the existing trigger callbacks),
     starts only after the begin-gate unlock signal, and pauses via a
     single IntersectionObserver on #story so nothing burns cycles when
     the archive is off-screen.
     ================================================================ */
  function createAmbientEngine(section, motionState) {
    const canvas = section.querySelector('canvas.story__ambient');
    const atmosphere = section.querySelector('.story__atmosphere');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (!ctx) return { start() {}, stop() {} };

    let particles = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let running = false;
    let visible = true;
    let unlocked = false;

    // Exact particle budget by viewport class. Fewer on small screens
    // so the archive stays smooth on a phone.
    function particleBudget() {
      const vw = window.innerWidth || 0;
      if (vw >= 900) return 90;
      if (vw >= 500) return 50;
      return 24;
    }

    function emberPalette() {
      return [
        'rgba(232, 192, 136, ', // gold glow
        'rgba(224, 124, 62, ', // ember
        'rgba(124, 88, 190, ' // violet dusk
      ];
    }

    function resize() {
      // The buffer tracks the window, not the (far taller) section: the
      // field is drawn in viewport space and scrolls with the page.
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = particleBudget();
      const palette = emberPalette();
      particles = new Array(count);
      for (let i = 0; i < count; i += 1) {
        particles[i] = {
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.6 + Math.random() * 1.8,
          vy: -(0.06 + Math.random() * 0.22),
          vx: (Math.random() - 0.5) * 0.08,
          phase: Math.random() * Math.PI * 2,
          twinkle: 0.4 + Math.random() * 0.6,
          color: palette[i % palette.length]
        };
      }
    }

    function draw() {
      if (!running) return;
      // Heat rises as the visitor moves deeper into the archive.
      const heat = 0.5 + motionState.sectionProgress * 0.5;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.y += p.vy * heat;
        p.x += p.vx;
        p.phase += 0.015;
        if (p.y < -6) {
          p.y = height + 6;
          p.x = Math.random() * width;
        }
        if (p.x < -6) p.x = width + 6;
        if (p.x > width + 6) p.x = -6;
        const alpha =
          p.twinkle *
          (0.12 + 0.5 * (0.5 + 0.5 * Math.sin(p.phase))) *
          (0.55 + 0.45 * heat);
        ctx.beginPath();
        ctx.fillStyle = p.color + Math.max(0, Math.min(1, alpha)).toFixed(3) + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Atmosphere drift: a progress-fed signal the plate can breathe
      // from. The plate also runs its own slow CSS breath; this only
      // carries how deep into the archive the field has travelled.
      if (atmosphere) {
        atmosphere.style.setProperty(
          '--story-atm-progress',
          motionState.sectionProgress.toFixed(4)
        );
        atmosphere.style.setProperty(
          '--story-atm-depth',
          motionState.depth.toFixed(4)
        );
      }
      rafId = window.requestAnimationFrame(draw);
    }

    function start() {
      if (running) return;
      if (!visible) return;
      if (!unlocked && !isUnlocked()) return;
      running = true;
      resize();
      rafId = window.requestAnimationFrame(draw);
    }

    function stop() {
      if (!running) return;
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function isUnlocked() {
      return (
        document.documentElement.getAttribute('data-unlocked') === 'true'
      );
    }

    // Window resize is a layout event, not a scroll listener, so it does
    // not violate the zero-scroll-listener contract.
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

    // The ONE visibility observer owned by this file. Threshold 0: when
    // #story leaves the viewport the loop is cancelled outright; when it
    // returns we resume, but only if the gate is still unlocked.
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visible = entry.isIntersecting;
          if (!visible) {
            unlocked = isUnlocked();
            stop();
          } else {
            start();
          }
        });
      },
      { threshold: 0 }
    );
    visibilityObserver.observe(section);

    // Boot gate: the loop must not exist before the visitor arrived.
    function bootAmbient() {
      unlocked = isUnlocked();
      if (!unlocked) {
        // begin.js flips data-unlocked asynchronously; the loader's
        // re-init pattern re-runs this on the next macrotask, so a
        // still-locked boot simply waits for the observer's first
        // intersect to retry.
        return;
      }
      start();
    }
    bootAmbient();

    return { start, stop, bootAmbient };
  }

  // Idempotence: the QA harness (and any loader re-init) may execute
  // this file twice. Without this guard every ScrollTrigger would be
  // built twice. Mirrors the `booted` flag in sections/birthday.js.
  let booted = false;

  function boot() {
    if (booted) return;
    /* personal site: eager — the begin-gate detaches #story until unlock. */
    const section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      window.setTimeout(boot, 150);
      return;
    }
    const chapters = Array.from(section.querySelectorAll('[data-chapter]'));
    if (chapters.length === 0) return;
    document.documentElement.classList.add('js-story');

    const progress = section.querySelector('[data-story-progress]');
    const dots = progress
      ? Array.from(progress.querySelectorAll('.story__progress-item'))
      : [];

    /* personal site: full motion always. Retry forever until vendors parse. */
    if (!hasGsap()) {
      bootAttempts += 1;
      window.setTimeout(boot, BOOT_RETRY_MS);
      return;
    }

    booted = true;
    window.gsap.registerPlugin(window.ScrollTrigger);

    const motionState = createMotionState(chapters.length);

    chapters.forEach((chapter, index) => {
      // Richer choreography WITHIN the single existing scrub call
      // site: a timeline that (a) scrubs the chapter card in and (b)
      // staggers each .story__msg bubble / .story__letter card behind
      // it, so the thread lands one message at a time. Still exactly
      // one ScrollTrigger per chapter.
      const msgs = chapter.querySelectorAll('.story__msg, .story__letter');

      const tl = window.gsap.timeline({
        scrollTrigger: {
          trigger: chapter,
          start: 'top 85%',
          end: 'top 35%',
          scrub: true,
          onUpdate: (self) => {
            motionState.chapterProgress[index] = self.progress;
          }
        }
      });

      tl.fromTo(
        chapter,
        { opacity: 0.25, y: 60 },
        { opacity: 1, y: 0, ease: 'none', duration: 1 }
      );

      if (msgs.length > 0) {
        tl.fromTo(
          msgs,
          { opacity: 0.4, y: 26 },
          {
            opacity: 1,
            y: 0,
            ease: 'none',
            duration: 1,
            stagger: 0.28
          },
          0
        );
      }

      window.ScrollTrigger.create({
        trigger: chapter,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
          if (!self.isActive) return;
          dots.forEach((dot, dotIndex) => {
            const active = dotIndex === index;
            dot.classList.toggle('is-active', active);
            // aria-current only exists on the motion path; under
            // reduced-motion we returned early and never set it, so
            // every link stays a plain anchor.
            if (active) {
              dot.setAttribute('aria-current', 'true');
            } else {
              dot.removeAttribute('aria-current');
            }
          });
          motionState.depth = index / Math.max(1, chapters.length - 1);
        }
      });
    });

    if (progress) {
      progress.classList.add('is-visible');
      window.ScrollTrigger.create({
        trigger: section,
        start: 'top 60%',
        end: 'bottom 40%',
        onUpdate: (self) => {
          motionState.sectionProgress = self.progress;
          // Progress-rail fill: the rail's own scale grows with how far
          // through the archive the visitor is, without any new
          // trigger — this is the same section trigger's onUpdate.
          progress.style.setProperty(
            '--story-rail-progress',
            self.progress.toFixed(4)
          );
        },
        onToggle: (self) => {
          motionState.sectionActive = self.isActive;
          progress.classList.toggle('is-visible', self.isActive);
          document.body.classList.toggle('is-in-story', self.isActive);
        }
      });
    }

    // Ambient engine owns ONE rAF, gated on the begin-gate unlock
    // signal and on #story visibility, fed only by motionState.
    createAmbientEngine(section, motionState);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
