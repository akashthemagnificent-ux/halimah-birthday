/* album — page-flip photo album (todo 11)
   Pages ship as markup: every slot is an illustrated PLACEHOLDER.
   A detached Image probe swaps in a real photo only after it loads,
   so a missing or wrong-named file can never surface a broken icon. */
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
    });

    bookFlip.on('changeState', (event) => {
      book.setAttribute('data-flip-state', event.data);
    });

    book.dataset.photoTotal = String(total);
    book.dataset.photoSupplied = String(supplied);
    return bookFlip;
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
        ? 'the photo slots are still empty — drop files into assets/photos/ and the pages fill themselves in.'
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
