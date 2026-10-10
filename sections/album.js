/* album — her childhood page-flip book (todo 11)
   Pages ship as markup: placeholder cover + 42 baby photo slots +
   placeholder last page. A detached Image probe swaps in the real
   photo only after it loads, so a missing or wrong-named file can
   never surface a broken icon. Every flip also drives the section
   background palette, the counter, the page dots, and the keyboard. */
(() => {
  'use strict';

  const SECTION_ID = 'album';
  const SWIPE_DISTANCE = 28;
  /* personal site: full motion always */

  function prefersReducedMotion() {
  return false; /* personal site: full motion */
}

  function probePhoto(path) {
    return new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = path;
    });
  }

  async function hydrateSlots(book) {
    const slots = Array.from(book.querySelectorAll('[data-photo]'));
    const results = await Promise.all(
      slots.map((slot) => probePhoto(slot.getAttribute('data-photo'))),
    );
    let supplied = 0;
    slots.forEach((slot, index) => {
      if (!results[index]) return;
      const img = document.createElement('img');
      img.className = 'album__page-img';
      img.alt = slot.getAttribute('data-alt') || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = slot.getAttribute('data-photo');
      slot.textContent = '';
      slot.classList.remove('album__placeholder');
      slot.classList.add('album__photo');
      slot.appendChild(img);
      supplied += 1;
    });
    return { total: slots.length, supplied };
  }

  function resolvePageFlip() {
    if (typeof window.PageFlip === 'function') return window.PageFlip;
    if (window.St && typeof window.St.PageFlip === 'function') return window.St.PageFlip;
    return null;
  }

  function buildPages(book, total, supplied) {
    const PageFlip = resolvePageFlip();
    if (!PageFlip) return null;
    const pages = Array.from(book.querySelectorAll('[data-density]'));
    if (pages.length === 0) return null;
    const bookFlip = new PageFlip(book, {
      width: 330,
      height: 420,
      size: 'stretch',
      minWidth: 240,
      maxWidth: 520,
      maxHeight: 520,
      minHeight: 300,
      drawShadow: true,
      flippingTime: 800,
      usePortrait: true,
      startZIndex: 0,
      autoSize: true,
      maxShadowOpacity: 0.5,
      showCover: true,
      mobileScrollSupport: true,
      swipeDistance: SWIPE_DISTANCE,
      clickEventForward: true,
      useMouseEvents: true,
      showPageCorners: true,
      disableFlipByClick: false,
    });
    bookFlip.loadFromHTML(pages);

    bookFlip.on('flip', (event) => {
      const totalPages = bookFlip.getPageCount();
      book.dispatchEvent(
        new CustomEvent('album:flip', {
          bubbles: true,
          detail: { page: event.data, index: event.data, total: totalPages },
        }),
      );
      syncButtons(event.data, totalPages);
      applySpread(book, event.data, totalPages);
    });

    bookFlip.on('changeState', (event) => {
      book.setAttribute('data-flip-state', event.data);
    });

    book.dataset.photoTotal = String(total);
    book.dataset.photoSupplied = String(supplied);
    return bookFlip;
  }

  /* Every flip redraws the section: background hue morph, counter tick,
     active dot. Hue grows monotonically so the @property interpolation
     always sweeps the same direction (hsl wraps past 360 on its own). */
  /* Closed-book states sit in half the container (engine geometry: cover
     on the right, last page on the left). Slide the inner frame so the
     closed book reads centered; cleared in portrait where pages fill it. */
  function centerState(book, page, total) {
    book.dataset.albumPage = String(page);
    const first = book.querySelector('.album__page--cover');
    if (!first) {
      book.dataset.albumState = '';
      return;
    }
    const bookW = book.getBoundingClientRect().width;
    const spreadMode = first.getBoundingClientRect().width < bookW * 0.75;
    book.dataset.albumState = !spreadMode
      ? ''
      : page <= 0
        ? 'start'
        : page >= total - 1
          ? 'end'
          : '';
  }

  function applySpread(book, page, total) {
    const section = document.getElementById(SECTION_ID);
    if (!section) return;
    centerState(book, page, total);
    const hue = 18 + page * 27;
    section.style.setProperty('--album-hue', String(hue));
    section.style.setProperty('--album-glow-hue', String(hue + 18));
    section.dataset.albumBg = String(page);
    const counter = section.querySelector('[data-album-counter]');
    if (counter) {
      counter.textContent = `${page + 1} / ${total}`;
      counter.classList.remove('is-tick');
      void counter.offsetWidth; /* restart the tick animation */
      counter.classList.add('is-tick');
    }
    section.querySelectorAll('[data-album-dots] .album__dot').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === page);
      dot.setAttribute('aria-current', i === page ? 'true' : 'false');
    });
  }

  function buildDots(section, bookFlip) {
    const wrap = section.querySelector('[data-album-dots]');
    if (!wrap) return;
    wrap.textContent = '';
    const total = bookFlip.getPageCount();
    for (let i = 0; i < total; i += 1) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'album__dot';
      dot.setAttribute('aria-label', `go to page ${i + 1}`);
      dot.addEventListener('click', () => bookFlip.flip(i));
      wrap.appendChild(dot);
    }
  }

  /* Arrow keys flip while the album is on screen (IO-gated so the book
     never steals keys from other sections). */
  function bindKeyboard(section, bookFlip) {
    document.addEventListener('keydown', (ev) => {
      if (section.dataset.inView !== '1') return;
      if (ev.key === 'ArrowRight') {
        bookFlip.flipNext();
        ev.preventDefault();
      } else if (ev.key === 'ArrowLeft') {
        bookFlip.flipPrev();
        ev.preventDefault();
      }
    });
  }

  /* Entrance reveal: pre-hide only when IO exists, rescue timer guarantees
     the book shows even if the observer never fires. */
  function bindReveal(section, book) {
    if (typeof IntersectionObserver !== 'function') return;
    book.classList.add('is-pre');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            book.classList.add('is-in');
            io.disconnect();
          }
        });
      },
      { threshold: 0.25 },
    );
    io.observe(book);
    window.setTimeout(() => book.classList.add('is-in'), 2600);
    const viewIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          section.dataset.inView = entry.isIntersecting ? '1' : '0';
        });
      },
      { threshold: 0.4 },
    );
    viewIO.observe(section);
  }

  function syncButtons(index, total) {
    const prev = document.querySelector('[data-album-prev]');
    const next = document.querySelector('[data-album-next]');
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= total - 1;
  }

  function showEmptyNotice(notice, count, total) {
    if (!notice) return;
    if (count <= 0) {
      notice.hidden = true;
      return;
    }
    notice.textContent =
      count === total
        ? 'the photo slots are still empty — drop files into assets/baby/ and the pages fill themselves in.'
        : `${count} slot${count > 1 ? 's are' : ' is'} still waiting on a real photo — the sketch is standing in until then.`;
    notice.hidden = false;
  }

  function bindControls(bookFlip) {
    const prev = document.querySelector('[data-album-prev]');
    const next = document.querySelector('[data-album-next]');
    if (prev) {
      prev.addEventListener('click', () => {
        if (bookFlip) bookFlip.flipPrev();
      });
    }
    if (next) {
      next.addEventListener('click', () => {
        if (bookFlip) bookFlip.flipNext();
      });
    }
  }

  function wrapSheets(book) {
    for (const page of book.querySelectorAll('[data-density]')) {
      if (page.querySelector(':scope > .album__sheet')) continue;
      const sheet = document.createElement('div');
      sheet.className = 'album__sheet';
      while (page.firstChild) sheet.appendChild(page.firstChild);
      page.appendChild(sheet);
    }
  }

  async function mount(section) {
    const book = section.querySelector('[data-album-book]');
    if (!book) return;
    const notice = section.querySelector('[data-album-notice]');

    wrapSheets(book);
    const { total, supplied } = await hydrateSlots(book);
    section.dataset.albumTotal = String(total);
    section.dataset.albumSupplied = String(supplied);

    showEmptyNotice(notice, total - supplied, total);
    if (!resolvePageFlip()) {
      book.dataset.albumMode = 'stacked';
      return;
    }

    let bookFlip = null;
    try {
      bookFlip = buildPages(book, total, supplied);
    } catch (err) {
      if (window.console && console.warn) console.warn('[album] flip failed, stacked:', err);
      bookFlip = null;
    }
    book.dataset.albumMode = bookFlip ? 'flip' : 'stacked';
    bindControls(bookFlip);
    bindReveal(section, book);
    if (bookFlip) {
      buildDots(section, bookFlip);
      bindKeyboard(section, bookFlip);
      applySpread(book, 0, bookFlip.getPageCount()); /* starts at the cover */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        book.dataset.albumReady = '1'; /* arm glide transitions post-layout */
      }));
      window.addEventListener('resize', () => {
        centerState(book, Number(book.dataset.albumPage || 0), bookFlip.getPageCount());
      });
    }
  }

  var mounted = false;
  function boot() {
    /* personal site: eager. Sections behind the begin-gate are detached
       until unlock, so retry until the node is connected, then mount. */
    var section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || mounted) {
      window.setTimeout(boot, 150);
      return;
    }
    mounted = true;
    mount(section);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
