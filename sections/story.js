(() => {
  'use strict';

  const SECTION_ID = 'story';
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function prefersReducedMotion() {
    return reduceMotionQuery.matches;
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

  function boot() {
    const section = document.getElementById(SECTION_ID);
    if (!section) return;
    const chapters = Array.from(section.querySelectorAll('[data-chapter]'));
    if (chapters.length === 0) return;
    document.documentElement.classList.add('js-story');

    const progress = section.querySelector('[data-story-progress]');
    const dots = progress
      ? Array.from(progress.querySelectorAll('.story__progress-item'))
      : [];

    if (prefersReducedMotion() || !hasGsap()) {
      if (progress) progress.hidden = true;
      return;
    }

    window.gsap.registerPlugin(window.ScrollTrigger);

    chapters.forEach((chapter, index) => {
      window.gsap.fromTo(
        chapter,
        { opacity: 0.25, y: 60 },
        {
          opacity: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: chapter,
            start: 'top 85%',
            end: 'top 35%',
            scrub: true,
          },
        }
      );

      window.ScrollTrigger.create({
        trigger: chapter,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
          if (!self.isActive) return;
          dots.forEach((dot, dotIndex) => {
            dot.classList.toggle('is-active', dotIndex === index);
          });
        },
      });
    });

    if (progress) {
      progress.classList.add('is-visible');
      window.ScrollTrigger.create({
        trigger: section,
        start: 'top 60%',
        end: 'bottom 40%',
        onToggle: (self) => {
          progress.classList.toggle('is-visible', self.isActive);
          document.body.classList.toggle('is-in-story', self.isActive);
        },
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
