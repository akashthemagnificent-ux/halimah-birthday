/* scratch — scratch-off secret panel (todo 10)
   ------------------------------------------------------------------
   The secret lives ONLY here, as a JS string. It is painted to a canvas
   and is never inserted into the DOM as text before the panel unlocks, so
   it is absent from the initial DOM dump and from view-source. After
   unlock, JS writes it into a node (never markup).

   OWNER SLOT — the secret (verbatim; keep as one string)
   Default: halimah dms-6.txt:952, from the plan's own cited reassurance
   pack (content/lore.md, Room 9). Chosen because it appears NOWHERE in
   the shipped HTML, so the "never in the DOM" guarantee holds even after
   the 19 Oct unlock.
   The plan's original default, dms-11.txt:2281 ("reason I wake up with a
   smile"), must NOT be swapped in without also removing story chapter 13,
   which already prints it verbatim in the DOM. */
(() => {
  'use strict';

  const SECTION_ID = 'scratch';
  const CLEAR_THRESHOLD = 55; // % of cover pixels erased before unlock
  const SAMPLE_STEP = 4; // sample every Nth pixel (keeps phones smooth)
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const SECRET_TEXT =
    'For me it is worth living cuz seeing a new day means I will be able ' +
    'to talk to you and probably call you and play with you and spend time ' +
    "with you for one more day and there's literally nothing better i " +
    'could ask for.';
  const SECRET_SOURCE = 'halimah dms-6.txt:952';

  const prefersReducedMotion = () => reduceMotionQuery.matches;

  function token(name, fallback) {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  }

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { ctx, dpr, w, h };
  }

  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function paintSecret(canvas) {
    const { ctx, dpr, w, h } = fitCanvas(canvas);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#342a1f');
    bg.addColorStop(1, '#2a2118');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const pad = 10 * dpr;
    const maxWidth = w - pad * 2;
    const maxHeight = h - pad * 2;
    const displayFont = token('--font-display', 'Georgia, serif');
    let size = 18 * dpr;
    let lines;
    for (;;) {
      ctx.font = `italic ${size}px ${displayFont}`;
      lines = wrapText(ctx, SECRET_TEXT, maxWidth);
      if (lines.length * size * 1.3 <= maxHeight || size <= 5 * dpr) break;
      size -= 0.5 * dpr;
    }
    ctx.fillStyle = token('--color-accent', '#e07c3e');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineHeight = size * 1.3;
    let y = (h - lines.length * lineHeight) / 2 + lineHeight / 2;
    for (const line of lines) {
      ctx.fillText(line, w / 2, y);
      y += lineHeight;
    }
  }

  function paintCover(canvas) {
    const { ctx, dpr, w, h } = fitCanvas(canvas);
    const foil = ctx.createLinearGradient(0, 0, w, h);
    foil.addColorStop(0, '#8a7a63');
    foil.addColorStop(0.35, '#b8a583');
    foil.addColorStop(0.5, '#7d6d55');
    foil.addColorStop(0.75, '#c0ad8b');
    foil.addColorStop(1, '#8a7a63');
    ctx.fillStyle = foil;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = dpr;
    for (let i = 0; i < 40; i += 1) {
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + (Math.random() - 0.5) * 12 * dpr);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function clearedPercent(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let cleared = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * SAMPLE_STEP) {
      total += 1;
      if (data[i] === 0) cleared += 1;
    }
    return total === 0 ? 0 : (cleared / total) * 100;
  }

  function mount(section) {
    const q = (sel) => section.querySelector(sel);
    const secretCanvas = q('[data-scratch-secret]');
    const coverCanvas = q('[data-scratch-cover]');
    const card = q('[data-scratch-card]');
    if (!secretCanvas || !coverCanvas) return null;

    const nodes = {
      percent: q('[data-scratch-percent]'),
      reveal: q('[data-scratch-reveal]'),
      revealText: q('[data-scratch-reveal-text]'),
      revealSource: q('[data-scratch-reveal-source]'),
      hint: q('[data-scratch-hint]'),
      replay: q('[data-scratch-replay]'),
      tap: q('[data-scratch-tap]'),
    };

    const state = { unlocked: false, method: null, percent: 0, mode: 'scratch' };

    function repaint() {
      paintSecret(secretCanvas);
      paintCover(coverCanvas);
    }
    repaint();

    function setPercent(p) {
      state.percent = Math.round(p);
      section.dataset.scratchPercent = String(state.percent);
      if (nodes.percent && state.percent > 0) {
        nodes.percent.textContent = `${state.percent}% cleared`;
        nodes.percent.classList.add('is-visible');
      }
    }

    // The one and only unlock path — the UI, the reduced-motion tap, and the
    // QA surface all funnel through here.
    function unlock(method) {
      if (state.unlocked) return;
      state.unlocked = true;
      state.method = method;
      section.dataset.scratchUnlocked = 'true';
      section.dataset.scratchMethod = method;
      coverCanvas.classList.add('is-done');
      if (nodes.hint) nodes.hint.hidden = true;
      if (nodes.percent) nodes.percent.classList.remove('is-visible');
      if (nodes.revealText) nodes.revealText.textContent = SECRET_TEXT;
      if (nodes.revealSource) nodes.revealSource.textContent = SECRET_SOURCE;
      if (nodes.reveal) nodes.reveal.classList.add('is-visible');
      if (nodes.replay) nodes.replay.classList.add('is-visible');
      section.dispatchEvent(
        new CustomEvent('scratch:unlock', { bubbles: true, detail: { method } }),
      );
    }

    function checkThreshold() {
      const p = clearedPercent(coverCanvas);
      setPercent(p);
      if (p >= CLEAR_THRESHOLD) unlock('scratch');
    }

    let scratching = false;
    function eraseAt(clientX, clientY) {
      const rect = coverCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const ctx = coverCanvas.getContext('2d');
      const x = (clientX - rect.left) * dpr;
      const y = (clientY - rect.top) * dpr;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 22 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    coverCanvas.addEventListener('pointerdown', (e) => {
      if (state.unlocked) return;
      scratching = true;
      coverCanvas.setPointerCapture?.(e.pointerId);
      eraseAt(e.clientX, e.clientY);
      checkThreshold();
      e.preventDefault();
    });
    coverCanvas.addEventListener('pointermove', (e) => {
      if (!scratching || state.unlocked) return;
      eraseAt(e.clientX, e.clientY);
      checkThreshold();
    });
    const stopScratch = (e) => {
      if (!scratching) return;
      scratching = false;
      coverCanvas.releasePointerCapture?.(e.pointerId);
    };
    coverCanvas.addEventListener('pointerup', stopScratch);
    coverCanvas.addEventListener('pointercancel', stopScratch);

    if (nodes.replay) {
      nodes.replay.addEventListener('click', () => {
        state.unlocked = false;
        state.method = null;
        state.percent = 0;
        section.dataset.scratchUnlocked = 'false';
        section.dataset.scratchMethod = '';
        section.dataset.scratchPercent = '0';
        coverCanvas.classList.remove('is-done');
        if (nodes.reveal) nodes.reveal.classList.remove('is-visible');
        if (nodes.replay) nodes.replay.classList.remove('is-visible');
        if (nodes.percent) nodes.percent.classList.remove('is-visible');
        if (nodes.hint) nodes.hint.hidden = false;
        // Purge the revealed text too: a secret must not sit in the DOM
        // behind a hidden overlay after the panel is re-armed.
        if (nodes.revealText) nodes.revealText.textContent = '';
        if (nodes.revealSource) nodes.revealSource.textContent = '';
        repaint();
      });
    }

    function applyMotionMode() {
      state.mode = prefersReducedMotion() ? 'tap' : 'scratch';
      section.dataset.scratchMode = state.mode;
      if (card) card.hidden = state.mode === 'tap';
      if (nodes.tap) nodes.tap.hidden = state.mode !== 'tap' || state.unlocked;
      if (nodes.hint) nodes.hint.hidden = state.mode === 'tap';
    }
    applyMotionMode();
    reduceMotionQuery.addEventListener?.('change', applyMotionMode);

    if (nodes.tap) {
      nodes.tap.addEventListener('click', () => {
        unlock('tap');
        if (nodes.tap) nodes.tap.hidden = true;
      });
    }

    const refit = () => {
      if (state.unlocked) return;
      repaint();
    };
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);

    // QA surface: observable state only. There is deliberately no method
    // that forces the unlock — the real threshold logic is the only way in.
    return { state };
  }

  let panel = null;

  // The section lives inside the countdown gate's content region, which
  // begin.js detaches into a DocumentFragment while locked. So on first load
  // (any time before 19 Oct) getElementById('scratch') is null and there is
  // nothing to mount yet. Mount only once the section is actually in the DOM,
  // and keep watching, because the live unlock re-inserts it later.
  function tryMount() {
    if (panel) return true;
    // The gate detaches the content region while locked, so #scratch is absent
    // from the document until the real unlock re-inserts it. Mount only against
    // a section that is genuinely connected AND the gate reports unlocked (or no
    // gate exists yet). Anything else would cache a detached subtree. Note the
    // gate never clears <html data-locked>, so that attribute is not a signal.
    const gate = window.__beginGate;
    if (gate && gate.unlocked !== true) return false;
    const section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected) return false;
    panel = mount(section);
    if (!panel) return false;
    document.documentElement.setAttribute('data-scratch-ready', 'true');
    window.__scratchPanel = {
      get ready() { return true; },
      get unlocked() { return panel.state.unlocked; },
      get method() { return panel.state.method; },
      get percent() { return panel.state.percent; },
      get threshold() { return CLEAR_THRESHOLD; },
      get mode() { return panel.state.mode; },
      get source() { return SECRET_SOURCE; },
    };
    return true;
  }

  function watchForSection() {
    if (panel) return;
    // begin.js (which owns the gate) is deferred and loads AFTER this file, so
    // on the first pass the gate does not exist yet and the section has not been
    // detached yet. Mounting now would cache a reference into a subtree that is
    // about to be pulled into the gate's fragment. Wait one macrotask so every
    // deferred script has run and the gate state is final, then mount.
    window.setTimeout(function attempt() {
      if (panel) return;
      if (tryMount()) return;
      if ('MutationObserver' in window) {
        const observer = new MutationObserver(() => {
          if (tryMount()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
      // Bounded poll: the gate can restore the region without a mutation we
      // can observe, but it will never take longer than a minute to unlock.
      let attempts = 0;
      const timer = window.setInterval(() => {
        if (tryMount() || attempts++ > 120) window.clearInterval(timer);
      }, 500);
    }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchForSection, { once: true });
  } else {
    watchForSection();
  }
})();
