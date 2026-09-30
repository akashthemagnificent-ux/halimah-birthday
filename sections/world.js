/* world — staggered card reveal for the her-world strip (todo 13).
   Enhancement only: cards are fully visible without JS, and the reveal
   never arms under prefers-reduced-motion. Uses IntersectionObserver,
   the same lazy pattern as starmap.js. No lyrics, no artwork, no blobs. */
(() => {
  'use strict';

  const SECTION_ID = 'world';
  const STAGGER_MS = 90;
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function prefersReducedMotion() {
    return reduceMotionQuery.matches;
  }

  function reveal(card, index) {
    window.setTimeout(() => {
      card.classList.add('is-in');
    }, index * STAGGER_MS);
  }

  function observe(cards) {
    if (!('IntersectionObserver' in window)) {
      cards.forEach((card, index) => reveal(card, index));
      return;
    }
    const seen = new WeakSet();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || seen.has(entry.target)) return;
          seen.add(entry.target);
          reveal(entry.target, cards.indexOf(entry.target));
          io.unobserve(entry.target);
          if (seen.size === cards.length) io.disconnect();
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    );
    cards.forEach((card) => io.observe(card));
  }

  function boot() {
    const section = document.getElementById(SECTION_ID);
    if (!section) return;
    const cards = Array.from(section.querySelectorAll('[data-reveal]'));
    if (cards.length === 0) return;
    if (prefersReducedMotion()) return;
    document.documentElement.classList.add('js-world');
    observe(cards);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
