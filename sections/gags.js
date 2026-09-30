/* Gag locker room (todo 9): scroll reveal + spider boop.
   Enhancement only: cards are plain readable HTML with JS blocked,
   and prefers-reduced-motion means no reveal animation, no wiggle. */
(() => {
  'use strict';

  const SECTION_ID = 'gags';
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function prefersReducedMotion() {
    return reduceMotionQuery.matches;
  }

  function boot() {
    const section = document.getElementById(SECTION_ID);
    if (!section) return;
    const cards = Array.from(section.querySelectorAll('[data-gags-card]'));
    if (cards.length === 0) return;

    const boop = section.querySelector('[data-gags-boop]');
    if (boop) {
      boop.addEventListener('click', () => {
        if (prefersReducedMotion()) return;
        const svg = section.querySelector('[data-testid="gag-spider-svg"]');
        if (!svg) return;
        svg.classList.remove('is-wiggling');
        // Force reflow so a repeat tap replays the wiggle.
        void svg.getBoundingClientRect();
        svg.classList.add('is-wiggling');
      });
    }

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('js-gags');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2 }
    );

    cards.forEach((card) => observer.observe(card));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
