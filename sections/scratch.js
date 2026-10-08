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
  /* 97% unlock: the reader scratches essentially the whole foil themselves.
     The last stubborn specks (stride-4 alpha sampling keeps a few islands
     alive) dissolve with the foil on unlock, so the experience reads as a
     full 100% clear while the threshold line below still holds. */
  const CLEAR_THRESHOLD = 97; // % of cover pixels erased before unlock
  const SAMPLE_STEP = 4; // sample every Nth pixel (keeps phones smooth)
  /* personal site: full motion always */

  const SECRET_TEXT =
    'For me it is worth living cuz seeing a new day means I will be able ' +
    'to talk to you and probably call you and play with you and spend time ' +
    "with you for one more day and there's literally nothing better i " +
    'could ask for.';
  const SECRET_SOURCE = 'halimah dms-6.txt:952';

  const prefersReducedMotion = () => false; /* personal site: full motion */

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

    const state = { unlocked: false, method: null, percent: 0, mode: 'scratch', anim: 'idle' };

    function repaint() {
      paintSecret(secretCanvas);
      paintCover(coverCanvas);
    }
    repaint();

    function setPercent(p) {
      state.percent = Math.min(100, Math.round(p));
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
      coverCanvas.classList.add('is-done'); /* foil dissolves (CSS) */
      scratching = false; /* any in-flight stroke ends here: the flourish
                             takes the card, so keep screen coords stable */
      if (nodes.hint) nodes.hint.hidden = true;
      setPercent(100); /* last few % dissolve with the foil: reads 100% */
      if (nodes.revealText) nodes.revealText.textContent = SECRET_TEXT;
      if (nodes.revealSource) nodes.revealSource.textContent = SECRET_SOURCE;
      if (nodes.reveal) nodes.reveal.classList.add('is-visible');
      if (nodes.replay) nodes.replay.classList.add('is-visible');
      playUnlockFlourish();
      section.dispatchEvent(
        new CustomEvent('scratch:unlock', { bubbles: true, detail: { method } }),
      );
    }

    function checkThreshold() {
      const p = clearedPercent(coverCanvas);
      setPercent(p);
      if (p >= CLEAR_THRESHOLD) unlock('scratch');
    }
    /* getImageData over the whole cover is too heavy for every pointermove:
       coalesce checks to one per animation frame. The final stroke still
       counts because pointerup re-checks synchronously. */
    let measureQueued = false;
    function queueThresholdCheck() {
      if (measureQueued) return;
      measureQueued = true;
      requestAnimationFrame(() => {
        measureQueued = false;
        if (!state.unlocked) checkThreshold();
      });
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
      /* Lock the card flat to the camera before the first dab so screen
         coordinates map 1:1 onto canvas pixels for the whole stroke (a
         tilted card turns getBoundingClientRect into the AABB of a quad). */
      flattenCard();
      scratching = true;
      try { coverCanvas.setPointerCapture?.(e.pointerId); } catch { /* stale */ }
      eraseAt(e.clientX, e.clientY);
      queueThresholdCheck();
      e.preventDefault();
    });
    coverCanvas.addEventListener('pointermove', (e) => {
      if (!scratching || state.unlocked) return;
      /* A release that was never seen must not erase on hover: mouse and
         pen moves report buttons === 0 once the button is up. */
      if (e.pointerType !== 'touch' && e.buttons === 0) { stopScratch(e); return; }
      eraseAt(e.clientX, e.clientY);
      queueThresholdCheck();
    });
    const stopScratch = (e) => {
      if (!scratching) return;
      scratching = false;
      if (e && e.pointerId != null) {
        try { coverCanvas.releasePointerCapture?.(e.pointerId); } catch { /* gone */ }
      }
      restTilt(); /* camera eases back to neutral; next pointerdown resumes */
    };
    coverCanvas.addEventListener('pointerup', stopScratch);
    coverCanvas.addEventListener('pointercancel', stopScratch);
    coverCanvas.addEventListener('lostpointercapture', stopScratch);
    /* Safety net: if the release lands outside the canvas (or the window
       lost focus mid-stroke), these leave the panel resumable instead of
       stuck with a stale dragging flag. */
    window.addEventListener('pointerup', stopScratch);
    window.addEventListener('pointercancel', stopScratch);

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
        if (nodes.percent) nodes.percent.textContent = '';
        if (nodes.hint) nodes.hint.hidden = false;
        // Purge the revealed text too: a secret must not sit in the DOM
        // behind a hidden overlay after the panel is re-armed.
        if (nodes.revealText) nodes.revealText.textContent = '';
        if (nodes.revealSource) nodes.revealSource.textContent = '';
        repaint();
        playCardAnim(true); /* fresh card flies back in from the camera */
      });
    }

    /* ---- 3D camera card -------------------------------------------
       House style (birthday/gags/quotes): window.gsap guarded, scrolled in
       with IntersectionObserver. Three moments:
         1. pop-in   the card flies up from below, pitched back like a
                     camera crane settling onto a face-on product shot;
         2. hover    the card leans toward the pointer (rotateX/Y) with a
                     specular foil sheen that tracks the tilt;
         3. unlock   a short flourish: punch scale + rotateY sweep + sheen
                     light-sweep across the foil as it dissolves.
       state.anim ('hidden' -> 'popping' -> 'idle') is exposed on the QA
       surface so suites can wait for a stable card before measuring. */
    state.anim = 'idle';
    const hasCam = typeof window.gsap !== 'undefined' && !!card;

    function playCardAnim(isReplay) {
      if (!hasCam) return;
      state.anim = 'popping';
      window.gsap.killTweensOf(card);
      window.gsap.fromTo(
        card,
        { y: 120, rotateX: 56, rotateY: -16, rotateZ: -5, scale: 0.84, autoAlpha: 0 },
        {
          y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, autoAlpha: 1,
          duration: isReplay ? 0.9 : 1.15,
          ease: 'back.out(1.5)',
          clearProps: 'all',
          onComplete() {
            state.anim = 'idle';
            tiltX = tiltY = tTiltX = tTiltY = 0;
          },
        },
      );
      const eyebrow = q('.scratch__eyebrow');
      const headline = q('.scratch__headline');
      if (eyebrow && headline) {
        window.gsap.from([eyebrow, headline], {
          y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.09, delay: 0.25,
          ease: 'power3.out', clearProps: 'all',
        });
      }
    }

    /* pointer-follow camera tilt */
    let tiltX = 0, tiltY = 0, tTiltX = 0, tTiltY = 0, tiltRAF = 0;
    const MAX_RX = 8, MAX_RY = 11;

    function restTilt() {
      tTiltX = 0;
      tTiltY = 0;
      ensureTiltLoop();
    }

    function ensureTiltLoop() {
      if (tiltRAF) return;
      const tick = () => {
        tiltX += (tTiltX - tiltX) * 0.09;
        tiltY += (tTiltY - tiltY) * 0.09;
        if (hasCam && !scratching && state.anim === 'idle') {
          window.gsap.set(card, { rotateX: tiltX, rotateY: tiltY });
          section.style.setProperty('--tilt-gx', `${50 + tiltY * 3}%`);
          section.style.setProperty('--tilt-gy', `${45 - tiltX * 3}%`);
        }
        const settled = Math.abs(tTiltX - tiltX) < 0.02 && Math.abs(tTiltY - tiltY) < 0.02;
        if (settled && tTiltX === 0 && tTiltY === 0) {
          if (hasCam) {
            window.gsap.set(card, { rotateX: 0, rotateY: 0 });
            section.style.setProperty('--tilt-gx', '50%');
            section.style.setProperty('--tilt-gy', '45%');
          }
          tiltRAF = 0; /* neutral and settled: stop burning frames */
          return;
        }
        tiltRAF = requestAnimationFrame(tick);
      };
      tiltRAF = requestAnimationFrame(tick);
    }

    /* Grab = lock flat. Also catches the card mid-pop: the reader grabs it
       out of the air and the entrance resolves instantly at face-on. */
    function flattenCard() {
      tTiltX = 0; tTiltY = 0; tiltX = 0; tiltY = 0;
      if (!hasCam) return;
      window.gsap.killTweensOf(card);
      window.gsap.set(card, { rotateX: 0, rotateY: 0, rotateZ: 0, x: 0, y: 0, scale: 1, autoAlpha: 1 });
      if (state.anim !== 'idle') state.anim = 'idle';
      section.style.setProperty('--tilt-gx', '50%');
      section.style.setProperty('--tilt-gy', '45%');
    }

    function playUnlockFlourish() {
      if (!hasCam) return;
      state.anim = 'popping'; /* hold hover-tilt until the flourish settles */
      window.gsap.killTweensOf(card);
      const tl = window.gsap.timeline();
      tl.to(card, { scale: 1.05, rotateY: -12, duration: 0.3, ease: 'power3.out' }, 0)
        .to(card, { scale: 1, rotateY: 0, duration: 1.1, ease: 'elastic.out(1, 0.5)' }, 0.3);
      const sheen = { x: 8 };
      tl.to(sheen, {
        x: 92, duration: 0.9, ease: 'power2.inOut',
        onUpdate() { section.style.setProperty('--tilt-gx', `${sheen.x}%`); },
      }, 0.1);
      tl.eventCallback('onComplete', () => {
        state.anim = 'idle';
        tiltX = tiltY = tTiltX = tTiltY = 0;
        section.style.setProperty('--tilt-gx', '50%');
        section.style.setProperty('--tilt-gy', '45%');
      });
    }

    section.addEventListener('pointermove', (e) => {
      if (state.unlocked || scratching || state.anim !== 'idle') return;
      if (e.pointerType === 'touch' || !card) return; /* touch: no hover camera */
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / Math.max(1, r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / Math.max(1, r.height / 2);
      tTiltX = Math.max(-1, Math.min(1, -ny)) * MAX_RX;
      tTiltY = Math.max(-1, Math.min(1, nx)) * MAX_RY;
      ensureTiltLoop();
    });
    section.addEventListener('pointerleave', restTilt);

    /* Entrance: pre-hide only when both gsap and IO exist (otherwise the
       card stays plain-static and visible), then pop when scrolled in. */
    if (hasCam && 'IntersectionObserver' in window) {
      state.anim = 'hidden';
      window.gsap.set(card, { y: 120, rotateX: 56, rotateY: -16, rotateZ: -5, scale: 0.84, autoAlpha: 0 });
      const io = new IntersectionObserver((entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            io.disconnect();
            playCardAnim(false);
            break;
          }
        }
      }, { threshold: 0.3 });
      io.observe(card);
      /* Rescue only a card that is genuinely visible but never popped (odd
         IO paths, gate re-insert). A timer alone would fire while the card
         is simply still below the fold, flipping anim to 'idle' before the
         real pop and making QA measure a card that is still in flight. */
      let rescueTicks = 0;
      const rescue = window.setInterval(() => {
        if (state.anim !== 'hidden') { window.clearInterval(rescue); return; }
        const r = card.getBoundingClientRect();
        const inView = r.top < (window.innerHeight || 0) && r.bottom > 0;
        if (inView && (rescueTicks += 1) >= 2) {
          window.gsap.set(card, { clearProps: 'all' });
          state.anim = 'idle';
          window.clearInterval(rescue);
        } else if (!inView) {
          rescueTicks = 0;
        }
      }, 1000);
    }

    function applyMotionMode() {
      state.mode = 'scratch'; /* personal site: full motion */
      section.dataset.scratchMode = state.mode;
      if (card) card.hidden = state.mode === 'tap';
      if (nodes.tap) nodes.tap.hidden = state.mode !== 'tap' || state.unlocked;
      if (nodes.hint) nodes.hint.hidden = state.mode === 'tap';
    }
    applyMotionMode();

    if (nodes.tap) {
      nodes.tap.addEventListener('click', () => {
        unlock('tap');
        if (nodes.tap) nodes.tap.hidden = true;
      });
    }

    /* Viewport resizes are frequent on mobile (URL bar) and used to wipe
       the foil back to fresh, destroying progress mid-scratch. Height-only
       changes keep the same pixel size: leave the scratched pixels alone.
       On a genuine size change (orientation), re-blit the old cover scaled
       so progress survives that too. */
    const refit = () => {
      if (state.unlocked) return;
      /* offsetWidth/Height are layout px: unlike getBoundingClientRect they
         ignore the card's tilt, so a hover lean can never fake a resize. */
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(coverCanvas.offsetWidth * dpr));
      const h = Math.max(1, Math.round(coverCanvas.offsetHeight * dpr));
      if (w === coverCanvas.width && h === coverCanvas.height) return;
      const keep = document.createElement('canvas');
      keep.width = coverCanvas.width;
      keep.height = coverCanvas.height;
      keep.getContext('2d').drawImage(coverCanvas, 0, 0);
      paintSecret(secretCanvas);
      const { ctx } = fitCanvas(coverCanvas);
      ctx.drawImage(keep, 0, 0, keep.width, keep.height, 0, 0, w, h);
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
      get anim() { return panel.state.anim; },
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
