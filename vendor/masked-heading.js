/* Ported from reactbits MaskedHeading (JSX + CSS), verified visually.
   Original paints text with an <img>/<video> fill through an SVG glyph
   clip-path. This port keeps the glyph-clip, word/baseline measure,
   parallax+drift, and gsap rise/wipe/fade reveals, but fills the glyphs
   with a PROCEDURAL gradient-mesh canvas instead of an image, so it stays
   texture-free, CORS-free, and free of copyrighted art. Requires gsap. */
(function () {
  'use strict';
  if (window.MaskedHeading) return;

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var CSS =
    '.masked-heading{position:relative;width:100%;margin:0;padding:0;text-wrap:balance;-webkit-font-smoothing:antialiased}' +
    '.masked-heading__measure{color:transparent}' +
    '.masked-heading__word{display:inline-block;white-space:pre}' +
    '.masked-heading__word:not(:last-child)::after{content:\' \'}' +
    '.masked-heading__baseline{display:inline-block;width:0;height:0}' +
    '.masked-heading__defs{position:absolute;width:0;height:0;overflow:hidden}' +
    '.masked-heading__reveal{position:absolute;inset:0;display:block;pointer-events:none}' +
    '.masked-heading__clip{position:absolute;inset:0;display:block}' +
    '.masked-heading__media{position:absolute;inset:0;display:block;will-change:transform,filter}' +
    '.masked-heading__source{display:block;width:100%;height:100%;object-fit:cover;user-select:none;-webkit-user-drag:none}';
  var style = document.createElement('style');
  style.setAttribute('data-masked-heading', '');
  style.appendChild(document.createTextNode(CSS));
  document.head.appendChild(style);

  var DEFAULT_PALETTE = ['#2a0f33', '#7a1560', '#d4356f', '#ff9a3c', '#ffd98a'];

  // Paint a smooth radial gradient mesh into the canvas. Positions are
  // deterministic per index so the fill is stable between repaints.
  function paintMesh(canvas, w, h, palette, seed) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, w, h);
    var pts = [
      [0.18, 0.22, 0.9], [0.82, 0.18, 0.8], [0.5, 0.5, 1.05],
      [0.22, 0.82, 0.85], [0.86, 0.78, 0.75], [0.5, 0.1, 0.6]
    ];
    for (var i = 0; i < pts.length; i += 1) {
      var p = pts[i];
      var px = (p[0] + Math.sin(seed + i) * 0.04) * w;
      var py = (p[1] + Math.cos(seed + i * 1.7) * 0.04) * h;
      var r = p[2] * Math.max(w, h) * 0.7;
      var col = palette[(i + 1) % palette.length];
      var g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  window.MaskedHeading = function (mount, options) {
    var o = options || {};
    if (!window.gsap) return { el: null, destroy: function () {} };
    var gsap = window.gsap;

    var text = String(o.text || 'Designed in the details');
    var tag = o.tag || 'h2';
    var fillScale = o.fillScale != null ? o.fillScale : 1.25;
    var parallax = o.parallax != null ? o.parallax : 26;
    var drift = o.drift != null ? o.drift : 18;
    var brightness = o.brightness != null ? o.brightness : 1;
    var saturation = o.saturation != null ? o.saturation : 1;
    var grayscale = !!o.grayscale;
    var reveal = o.reveal || 'rise';
    var duration = o.duration != null ? o.duration : 1.1;
    var stagger = o.stagger != null ? o.stagger : 0.09;
    var trigger = o.trigger || 'view';
    var align = o.align || 'center';
    var weight = o.weight != null ? o.weight : 700;
    var tracking = o.tracking != null ? o.tracking : -0.03;
    var lineHeight = o.lineHeight != null ? o.lineHeight : 1.06;
    var textScale = o.textScale != null ? o.textScale : 0.115;
    var palette = (o.palette && o.palette.length ? o.palette : DEFAULT_PALETTE).slice();
    var className = o.className || '';

    var clipId = 'mh-' + Math.random().toString(36).slice(2, 9);
    var words = text.split(/\s+/).filter(Boolean);

    var root = document.createElement(tag);
    root.className = ('masked-heading' + (className ? ' ' + className : '')).trim();
    root.style.textAlign = align;
    root.style.fontWeight = String(weight);
    root.style.letterSpacing = tracking + 'em';
    root.style.lineHeight = String(lineHeight);

    var measure = document.createElement('span');
    measure.className = 'masked-heading__measure';
    var wordEls = [], baseEls = [], glyphEls = [];
    for (var i = 0; i < words.length; i += 1) {
      var we = document.createElement('span');
      we.className = 'masked-heading__word';
      we.appendChild(document.createTextNode(words[i]));
      var bi = document.createElement('i');
      bi.className = 'masked-heading__baseline';
      we.appendChild(bi);
      measure.appendChild(we);
      wordEls.push(we);
      baseEls.push(bi);
    }
    root.appendChild(measure);

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'masked-heading__defs');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var defs = document.createElementNS(svgNS, 'defs');
    var clipPath = document.createElementNS(svgNS, 'clipPath');
    clipPath.setAttribute('id', clipId);
    clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
    for (var g2 = 0; g2 < words.length; g2 += 1) {
      var tx = document.createElementNS(svgNS, 'text');
      clipPath.appendChild(tx);
      glyphEls.push(tx);
    }
    defs.appendChild(clipPath);
    svg.appendChild(defs);
    root.appendChild(svg);

    var revealLayer = document.createElement('span');
    revealLayer.className = 'masked-heading__reveal';
    var clipEl = document.createElement('span');
    clipEl.className = 'masked-heading__clip';
    clipEl.style.clipPath = 'url(#' + clipId + ')';
    var media = document.createElement('span');
    media.className = 'masked-heading__media';
    var canvas = document.createElement('canvas');
    canvas.className = 'masked-heading__source';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    media.appendChild(canvas);
    clipEl.appendChild(media);
    revealLayer.appendChild(clipEl);
    root.appendChild(revealLayer);

    mount.appendChild(root);

    var offset = { x: 0, y: 0, tx: 0, ty: 0 };
    var seed = Math.random() * 6.28;

    function paint() {
      paintMesh(canvas, Math.max(1, root.clientWidth), Math.max(1, root.clientHeight), palette, seed);
    }

    function place() {
      var W = root.clientWidth;
      var H = root.clientHeight;
      var maxX = Math.max(0, ((fillScale - 1) / 2) * W);
      var maxY = Math.max(0, ((fillScale - 1) / 2) * H);
      media.style.transform = 'translate3d(' + clamp(offset.x, -maxX, maxX).toFixed(2) + 'px,' +
        clamp(offset.y, -maxY, maxY).toFixed(2) + 'px,0) scale(' + fillScale + ')';
      media.style.filter = 'brightness(' + brightness + ') saturate(' + saturation + ')' + (grayscale ? ' grayscale(1)' : '');
    }

    function sync() {
      root.style.fontSize = clamp(root.clientWidth * textScale, 20, 200).toFixed(1) + 'px';
      var cs = window.getComputedStyle(measure);
      for (var i = 0; i < wordEls.length; i += 1) {
        var box = wordEls[i], base = baseEls[i], glyph = glyphEls[i];
        glyph.setAttribute('x', '' + box.offsetLeft);
        glyph.setAttribute('y', '' + base.offsetTop);
        glyph.style.fontFamily = cs.fontFamily;
        glyph.style.fontSize = cs.fontSize;
        glyph.style.fontWeight = cs.fontWeight;
        glyph.style.fontStyle = cs.fontStyle;
        glyph.style.letterSpacing = cs.letterSpacing;
      }
      paint();
      place();
    }

    sync();
    var ro = new ResizeObserver(function () { sync(); });
    ro.observe(root);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sync).catch(function () {});
    }

    var raf = 0, last = performance.now(), clock = 0, alive = true;
    function frame(now) {
      if (!alive) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      var dx = Math.sin(clock * 0.21) * drift;
      var dy = Math.cos(clock * 0.17) * drift * 0.6;
      var ease = 1 - Math.exp(-dt / 0.18);
      offset.x += (offset.tx + dx - offset.x) * ease;
      offset.y += (offset.ty + dy - offset.y) * ease;
      place();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function onMove(e) {
      if (parallax <= 0) return;
      var r = root.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / (r.width || 1)) * 2 - 1;
      var ny = ((e.clientY - r.top) / (r.height || 1)) * 2 - 1;
      offset.tx = clamp(nx, -1, 1) * -parallax;
      offset.ty = clamp(ny, -1, 1) * -parallax;
    }
    function onLeave() { offset.tx = 0; offset.ty = 0; }
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);

    var glyphs = glyphEls.slice();
    var tween = null;
    function riseDistance() {
      return (parseFloat(window.getComputedStyle(root).fontSize) || 48) * 1.15;
    }
    function settle() {
      gsap.set(glyphs, { y: 0 });
      gsap.set(revealLayer, { opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0%)' });
    }
    function rest() {
      if (reveal === 'rise') gsap.set(glyphs, { y: riseDistance() });
      else if (reveal === 'wipe') gsap.set(revealLayer, { clipPath: 'inset(0% 100% 0% 0%)' });
      else if (reveal === 'fade') gsap.set(revealLayer, { opacity: 0, scale: 1.08 });
    }
    function play() {
      if (tween) tween.kill();
      if (reveal === 'rise') {
        gsap.set(revealLayer, { opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0%)' });
        tween = gsap.fromTo(glyphs, { y: riseDistance() },
          { y: 0, duration: duration, stagger: stagger, ease: 'power4.out', overwrite: 'auto' });
      } else if (reveal === 'wipe') {
        gsap.set(glyphs, { y: 0 });
        var state = { p: 100 };
        tween = gsap.to(state, { p: 0, duration: duration, ease: 'power3.inOut', overwrite: 'auto',
          onUpdate: function () { revealLayer.style.clipPath = 'inset(0% ' + state.p + '% 0% 0%)'; } });
      } else {
        gsap.set(glyphs, { y: 0 });
        tween = gsap.fromTo(revealLayer, { opacity: 0, scale: 1.08 },
          { opacity: 1, scale: 1, duration: duration, ease: 'power3.out', overwrite: 'auto' });
      }
    }

    var io = null, onEnter = null;
    // Full-motion build (owner decree): the reveal always plays; the
    // IntersectionObserver only decides WHEN, never WHETHER.
    if (trigger === 'hover') {
      settle();
      onEnter = play;
      root.addEventListener('pointerenter', onEnter);
    } else if (trigger === 'view') {
      settle();
      rest();
      io = new IntersectionObserver(function (entries) {
        for (var k = 0; k < entries.length; k += 1) {
          if (entries[k].isIntersecting) { play(); io.disconnect(); break; }
        }
      }, { threshold: 0.25 });
      io.observe(root);
    } else {
      play();
    }

    return {
      el: root,
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        if (io) io.disconnect();
        if (onEnter) root.removeEventListener('pointerenter', onEnter);
        if (tween) tween.kill();
        ro.disconnect();
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerleave', onLeave);
        root.remove();
      }
    };
  };
})();
