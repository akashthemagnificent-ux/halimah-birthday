/* quotes — staggered card reveal (todo 8)
   Enhancement only: cards are plain readable HTML without this script.
   The script adds html.js-quotes (which arms the hidden state in CSS)
   solely when the visitor allows motion and the browser offers
   IntersectionObserver. Otherwise it returns and the wall stays plain. */
(() => {
  'use strict';

  const SECTION_ID = 'quotes';

  function motionAllowed() {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function boot() {
    const section = document.getElementById(SECTION_ID);
    if (!section) return;
    const cards = Array.from(section.querySelectorAll('.quote-card'));
    if (cards.length === 0) return;
    if (!motionAllowed()) return;
    if (typeof window.IntersectionObserver === 'undefined') return;

    document.documentElement.classList.add('js-quotes');

    const seen = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          seen.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.15 }
    );

    cards.forEach((card) => seen.observe(card));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
