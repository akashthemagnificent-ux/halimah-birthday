/* ============================================================
   clocks — the live counters that close the site.

   Numbers are DOM text; three.js draws only the rings behind
   them. This file owns the truth:

   - Every frame recomputes from Date.now(). Nothing is
     accumulated, so a phone that slept for six hours shows the
     correct value on its first frame back.
   - The loop only runs while the section is on screen and the
     document is visible.
   - With no WebGL the numbers still tick, over the CSS ground.
   ============================================================ */
(function () {
  'use strict';

  var M = window.ClocksMath;
  if (!M) return;

  var srTickAt = 0;         /* last minute boundary written to .sr-only */
  var section = null;
  var stage = null;
  var blocks = [];
  var running = false;
  var rafId = 0;

  function readBlocks() {
    var out = [];
    var nodes = document.querySelectorAll('#clocks [data-milestone]');
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      var id = el.getAttribute('data-milestone');
      var milestone = null;
      for (var j = 0; j < window.MILESTONES.length; j += 1) {
        if (window.MILESTONES[j].id === id) { milestone = window.MILESTONES[j]; break; }
      }
      if (!milestone) continue;
      out.push({
        id: id,
        el: el,
        milestone: milestone,
        days: el.querySelector('[data-unit="days"]'),
        hours: el.querySelector('[data-unit="hours"]'),
        minutes: el.querySelector('[data-unit="minutes"]'),
        seconds: el.querySelector('[data-unit="seconds"]'),
        sr: el.querySelector('[data-clocks-sr]'),
        worldY: 0
      });
    }
    return out;
  }

  function paint(block, state) {
    var p = state.parts;
    if (block.days) block.days.textContent = String(p.days);
    if (block.hours) block.hours.textContent = M.pad2(p.hours);
    if (block.minutes) block.minutes.textContent = M.pad2(p.minutes);
    if (block.seconds) block.seconds.textContent = M.pad2(p.seconds);
  }

  function paintAria(block, state) {
    if (!block.sr) return;
    block.sr.textContent = M.formatAria(state.parts) + ' ' +
      (state.direction === 'up' ? 'and counting' : 'to go');
  }

  /* Recompute everything for `nowMs`. Exposed so the scene loop
     can drive the numbers from the same clock it animates. */
  function tickNow(nowMs) {
    var states = [];
    for (var i = 0; i < blocks.length; i += 1) {
      var state = M.milestoneState(blocks[i].milestone, nowMs, M.TZ);
      paint(blocks[i], state);
      states.push(state);
    }
    /* The screen-reader sentence changes once a minute, not once a
       second — announcing a number every tick is hostile. */
    if (nowMs - srTickAt >= 60000) {
      srTickAt = nowMs;
      for (var k = 0; k < blocks.length; k += 1) paintAria(blocks[k], states[k]);
    }
    return states;
  }

  function frame() {
    if (!running) return;
    tickNow(Date.now());
    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function canvasFallback() {
    var canvas = section.querySelector('[data-clocks-canvas]');
    if (canvas) canvas.style.display = 'none';
  }

  /* ------------------------------------------------------------
     Scene: three rings, stacked vertically.
     ------------------------------------------------------------
     Each ring turns at a rate that means something (a day, an
     hour, a minute) and carries an arc showing how far through
     that lap we are. The camera travels down the stack with
     scroll. The DOM numerals ride on top, positioned by
     projecting each ring's world position to screen space.

     Every exit path here leaves the numbers ticking: if WebGL is
     unavailable, or the context is lost, the canvas is hidden and
     the CSS ground stays. */

  var RING_Y = [2.1, 0, -2.1];
  var RING_COLOR = [0xf0984a, 0xffd166, 0xff6f91];
  var CAMERA_Z = 7.4;
  var FOV = 42;

  var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform float uProgress;',
    'uniform float uTime;',
    'uniform vec3  uColor;',
    'uniform float uOpacity;',
    'const float TAU = 6.28318530718;',
    'void main() {',
    '  vec2 p = vUv * 2.0 - 1.0;',
    '  float r = length(p);',
    '  float a = atan(p.x, p.y);',          /* 0 at top, clockwise */
    '  if (a < 0.0) a += TAU;',
    '  float ang = a / TAU;',
    /* the annulus */
    '  float band = smoothstep(0.62, 0.68, r) * (1.0 - smoothstep(0.94, 1.0, r));',
    /* the travelled arc, trailing edge softened */
    '  float travelled = step(ang, uProgress);',
    '  float arc = band * mix(0.10, 0.55, travelled);',
    /* tick marks every 1/60 of the lap */
    '  float tick = step(0.992, fract(ang * 60.0)) * band;',
    '  vec3 col = uColor * (0.55 + arc * 1.6 + tick * 1.1);',
    '  float alpha = (band * 0.20 + arc * 0.75 + tick * 0.55) * uOpacity;',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  function createScene(page) {
    var THREE = window.THREE;
    if (!THREE) return false;

    var canvas = page.section.querySelector('[data-clocks-canvas]');
    var stage = page.stage;
    if (!canvas || !stage) return false;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, RING_Y[0], CAMERA_Z);

    var ringGeo = new THREE.RingGeometry(0.62, 1.0, 128, 1);
    var meshes = [];

    for (var i = 0; i < RING_Y.length; i += 1) {
      var mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uProgress: { value: 0 },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(RING_COLOR[i]) },
          uOpacity: { value: 1 }
        }
      });
      var mesh = new THREE.Mesh(ringGeo, mat);
      mesh.position.set(0, RING_Y[i], 0);
      mesh.rotation.x = -0.34;
      scene.add(mesh);
      meshes.push(mesh);
    }

    /* Dust: bounded to the section, additive, quiet. */
    var dustCount = 420;
    var dustPos = new Float32Array(dustCount * 3);
    for (var d = 0; d < dustCount; d += 1) {
      dustPos[d * 3] = (Math.random() - 0.5) * 16;
      dustPos[d * 3 + 1] = (Math.random() - 0.5) * 14;
      dustPos[d * 3 + 2] = -6 - Math.random() * 10;
    }
    var dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    var dustMat = new THREE.PointsMaterial({
      color: 0xffd8b0, size: 0.035, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    var dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    /* ---- sizing ---- */
    function resize() {
      var w = stage.clientWidth;
      var h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    /* ---- scroll progress across the track ---- */
    var track = page.section.querySelector('[data-clocks-track]');
    var progress = 0;
    function readProgress() {
      if (!track) return;
      var rect = track.getBoundingClientRect();
      var travel = rect.height - window.innerHeight;
      if (travel <= 0) { progress = 0; return; }
      progress = Math.min(1, Math.max(0, -rect.top / travel));
    }
    readProgress();
    window.addEventListener('scroll', readProgress, { passive: true });

    /* ---- pointer parallax (additive, coarse pointers ignore it) ---- */
    var pointer = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', function (e) {
        target.x = (e.clientX / window.innerWidth - 0.5) * 2;
        target.y = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    /* ---- projected numeral anchors ---- */
    var sizes = { w: 1, h: 1 };
    var v = new THREE.Vector3();

    function placeNumerals() {
      camera.updateMatrixWorld();
      for (var i = 0; i < meshes.length; i += 1) {
        v.copy(meshes[i].position).project(camera);
        var x = (v.x * 0.5 + 0.5) * sizes.w;
        var y = (-v.y * 0.5 + 0.5) * sizes.h;
        var block = page.rings[i];
        if (!block || !block.el) continue;
        block.el.style.transform =
          'translate(-50%, -50%) translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)';
      }
    }

    /* ---- loop ---- */
    var live = false;
    var sceneRaf = 0;
    var damping = 0.055;
    var lastT = 0;

    function render(now) {
      if (!live) return;
      var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
      lastT = now;

      /* refresh-rate-correct damping */
      var k = 1 - Math.pow(1 - damping, dt * 60);
      pointer.x += (target.x - pointer.x) * k;
      pointer.y += (target.y - pointer.y) * k;

      readProgress();

      sizes.w = stage.clientWidth;
      sizes.h = stage.clientHeight;

      /* camera travels down the stack */
      var focusY = RING_Y[0] + (RING_Y[RING_Y.length - 1] - RING_Y[0]) * progress;
      var eyeY = focusY - pointer.y * 0.25;
      camera.position.x = pointer.x * 0.45;
      camera.position.y = eyeY;
      camera.lookAt(0, focusY, 0);

      var states = page.tickNow(Date.now());
      for (var i = 0; i < meshes.length; i += 1) {
        var u = meshes[i].material.uniforms;
        u.uTime.value = now / 1000;
        u.uProgress.value = states[i] ? states[i].progress : 0;
        meshes[i].rotation.z = -0.35 * progress + i * 0.18;
      }
      dust.rotation.y = now / 90000;

      placeNumerals();
      renderer.render(scene, camera);
      sceneRaf = window.requestAnimationFrame(render);
    }

    function startScene() {
      if (live) return;
      live = true;
      stage.classList.add('is-live');
      page.section.setAttribute('data-webgl', 'on');
      lastT = 0;
      sceneRaf = window.requestAnimationFrame(render);
    }

    function stopScene() {
      live = false;
      if (sceneRaf) window.cancelAnimationFrame(sceneRaf);
      sceneRaf = 0;
    }

    /* stop the scene when the section leaves the viewport */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i += 1) {
          if (entries[i].isIntersecting) startScene(); else stopScene();
        }
      }, { rootMargin: '50%' });
      io.observe(page.section);
    } else {
      startScene();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopScene(); else startScene();
    });

    /* context loss: hide the canvas, keep the numbers */
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      stopScene();
      stage.classList.remove('is-live');
      page.section.setAttribute('data-webgl', 'off');
      canvas.style.display = 'none';
    });

    window.addEventListener('pagehide', function () {
      stopScene();
      ringGeo.dispose();
      for (var i = 0; i < meshes.length; i += 1) meshes[i].material.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
    });

    startScene();
    return true;
  }

  function boot() {
    section = document.getElementById('clocks');
    if (!section || !window.MILESTONES) return;
    stage = section.querySelector('[data-clocks-stage]');
    blocks = readBlocks();
    if (!blocks.length) return;

    tickNow(Date.now());

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i += 1) {
          if (entries[i].isIntersecting) start(); else stop();
        }
      }, { rootMargin: '100%' });
      io.observe(section);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); } else { tickNow(Date.now()); start(); }
    });

    window.ClocksPage = {
      rings: blocks,
      stage: stage,
      section: section,
      tickNow: tickNow,
      start: start,
      stop: stop,
      M: M
    };

    if (!createScene(window.ClocksPage)) {
      section.setAttribute('data-webgl', 'off');
      canvasFallback();
    }

    window.dispatchEvent(new CustomEvent('clocks:ready'));
  }

  /* begin.js detaches #content-region until the begin tap, so #clocks
     does not exist yet when this file runs — wait for data-unlocked,
     the same gate js/section-music.js uses. */
  function arm() {
    if (document.documentElement.getAttribute('data-unlocked') === 'true') {
      boot();
      return;
    }
    var obs = new MutationObserver(function () {
      if (document.documentElement.getAttribute('data-unlocked') === 'true') {
        obs.disconnect();
        boot();
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-unlocked'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm);
  } else {
    arm();
  }
}());