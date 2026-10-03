/* quotes — staggered card reveal + hover pet + reading zoom (todo 8)
   Enhancement only: cards are plain readable HTML without this script.
   Motion is additive: reveal on scroll, pop on hover (CSS), a small CSS
   pet that hops onto whichever card the cursor is on, and a click zoom
   so she can read each quote big. Personal site: full motion always. */
(() => {
  'use strict';

  const SECTION_ID = 'quotes';

  function boot() {
    const section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected) {
      window.setTimeout(boot, 150);
      return;
    }
    const cards = Array.from(section.querySelectorAll('.quote-card'));
    if (cards.length === 0) return;

    document.documentElement.classList.add('js-quotes');

    /* staggered reveal */
    if (typeof window.IntersectionObserver !== 'undefined') {
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
    } else {
      cards.forEach((card) => card.classList.add('is-visible'));
    }

    /* the pet: hops onto the hovered card, hearts on click */
    let home = null;
    let hopTimer = 0;

    function park(card) {
      if (home === card) return;
      if (home) home.classList.remove('pet-here');
      home = card;
      if (!home) return;
      home.classList.add('pet-here');
      const pet = home.querySelector('.quote-pet');
      if (pet) {
        pet.classList.remove('is-hopping');
        void pet.getBoundingClientRect();
        pet.classList.add('is-hopping');
      }
    }

    cards.forEach((card) => {
      card.addEventListener('pointerenter', () => {
        window.clearTimeout(hopTimer);
        park(card);
      });
      card.addEventListener('pointerleave', () => {
        window.clearTimeout(hopTimer);
        hopTimer = window.setTimeout(() => {
          if (home) home.classList.remove('pet-here');
          home = null;
        }, 900);
      });
      card.addEventListener('click', () => {
        card.classList.remove('pet-loved');
        void card.getBoundingClientRect();
        card.classList.add('pet-loved');
        openZoom(card);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openZoom(card);
        }
      });
    });

    /* reading zoom */
    let zoom = null;
    function openZoom(card) {
      closeZoom();
      const quote = card.querySelector('.quote-card__quote p');
      const date = card.querySelector('.quote-card__date');
      const src = card.querySelector('.quote-card__source');
      zoom = document.createElement('div');
      zoom.className = 'quote-zoom';
      zoom.setAttribute('role', 'dialog');
      zoom.setAttribute('aria-modal', 'true');
      zoom.setAttribute('aria-label', card.getAttribute('aria-label') || 'Quote, enlarged');
      const inner = document.createElement('div');
      inner.className = 'quote-zoom__card';
      const big = document.createElement('p');
      big.className = 'quote-zoom__quote';
      big.textContent = quote ? quote.textContent : '';
      const meta = document.createElement('p');
      meta.className = 'quote-zoom__meta';
      meta.textContent = [date ? date.textContent : '', src ? src.textContent : '']
        .filter(Boolean).join(' · ');
      const hint = document.createElement('p');
      hint.className = 'quote-zoom__hint';
      hint.textContent = 'tap anywhere to keep wandering';
      inner.appendChild(big);
      inner.appendChild(meta);
      zoom.appendChild(inner);
      zoom.appendChild(hint);
      zoom.addEventListener('click', closeZoom);
      document.body.appendChild(zoom);
      window.requestAnimationFrame(() => zoom.classList.add('is-open'));
      if (window.gsap) {
        window.gsap.fromTo(inner,
          { scale: 0.88, y: 26, rotation: -1.5 },
          { scale: 1, y: 0, rotation: 0, duration: 0.5, ease: 'expo.out' });
      }
    }
    function closeZoom() {
      if (!zoom) return;
      zoom.classList.remove('is-open');
      const el = zoom;
      zoom = null;
      window.setTimeout(() => el.remove(), 320);
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeZoom();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
