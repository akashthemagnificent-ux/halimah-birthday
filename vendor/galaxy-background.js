/* Galaxy background: ported from React Bits "Galaxy"
   (https://reactbits.dev/backgrounds/galaxy), BSD-style with attribution.
   Dependency-free WebGL2 fragment-shader starfield: twinkling stars, cursor
   repulsion, click warp, intro reveal. No textures, so it is file:// CORS-safe.
   Exposes window.GalaxyBackground(options) -> { destroy(), resize() }.
   The two GLSL strings below are copied verbatim from the original module. */
(function () {
  'use strict';

  var MAX_LAYERS = 8;
  var MAX_COLORS = 4;

  var VERT = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;
  var FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uGloss;
uniform float uDepth;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uStarGlow;
uniform float uFlareGain;
uniform float uSquash;
uniform float uSaturation;
uniform float uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationAngle;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform int uLayers;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform float uWarp;
uniform float uReveal;
uniform float uMode;
uniform vec3 uBackground;
uniform float uOpacity;
out vec4 outColor;

#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) {
  return abs(fract(x) * 2.0 - 1.0);
}

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float Star(vec2 uv, float flare, vec2 radial, float invReach) {
#ifdef WARP
  float along = dot(uv, radial);
  float d = sqrt(max(dot(uv, uv) - uSquash * along * along, 0.0));
#else
  float d = length(uv);
#endif
  float m = uStarGlow / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uFlareGain;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uFlareGain;
  m *= smoothstep(1.0, 0.2, d * invReach);
#ifdef WARP
  m *= mix(1.0, smoothstep(1.0, 0.55, length(uv) * invReach), min(uWarp * 4.0, 1.0));
#endif
  return m;
}

vec3 StarLayer(vec2 uv, vec2 radial, vec2 repelAt, float pushCells, float spread) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + offset;
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uGloss / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

#ifdef PALETTE
      float pick = Hash21(si + 7.0) * float(uColorCount);
      vec3 base = uColors[int(min(floor(pick), float(uColorCount - 1)))];
#else
      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
      float grn = min(red, blu) * seed;
      vec3 base = vec3(red, grn, blu);
      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
      hue = fract(hue + uHueShift / 360.0);
      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
      float val = max(max(base.r, base.g), base.b);
      base = hsv2rgb(vec3(hue, sat, val));
#endif

      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;
      vec2 shift = vec2(0.0);
      float invReach = 1.0;
#ifdef REPEL
      vec2 away = si + 0.5 + pad - repelAt;
      float dist = length(away);
      float q = dist * spread;
      float cells = pushCells * exp(-q * q);
      float moved = cells * inversesqrt(1.0 + cells * cells * 2.78);
      shift = away * (moved / max(dist, 0.0001));
      invReach = 1.0 / (1.0 - moved);
#endif
      float star = Star(gv - offset - pad - shift, flareSize, radial, invReach);
      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      col += star * twinkle * size * base;
    }
  }
  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution;
  vec2 uv = (gl_FragCoord.xy - focalPx) / uResolution.y;
  vec2 mouseNorm = uMouse - vec2(0.5);

  vec2 repelAt = vec2(0.0);
  float strength = 0.0;
  float push = 0.0;
  if (uAutoCenterRepulsion > 0.0) {
    strength = uAutoCenterRepulsion;
    push = strength * 0.05;
  } else if (uMouseRepulsion > 0.5) {
    repelAt = (uMouse * uResolution - focalPx) / uResolution.y;
    strength = max(uRepulsionStrength, 0.0);
    push = strength * 0.05 * uMouseActiveFactor;
  } else {
    uv += mouseNorm * 0.1 * uMouseActiveFactor;
  }
  float radius = 0.16 + 0.04 * strength;

  vec2 radial = length(uv) > 0.0001 ? normalize(uv) : vec2(1.0, 0.0);
  float angle = uRotationAngle;
  uv = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * uv;
  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;
  radial = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * radial;
  radial = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * radial;
  repelAt = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * repelAt;
  repelAt = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * repelAt;

  vec3 col = vec3(0.0);
  float layers = float(uLayers);
  for (int k = 0; k < ${MAX_LAYERS}; k++) {
    if (k >= uLayers) break;
    float i = float(k) / layers;
    float depth = fract(i + uDepth);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    vec2 offset = vec2(i * 453.32);
    col += StarLayer(uv * scale + offset, radial, repelAt * scale + offset, push * scale, 1.0 / (scale * radius)) * fade;
  }
  col *= uReveal;

  if (uMode > 1.5) {
    vec3 lit = col * smoothstep(0.0, 0.3, length(col));
    float energy = max(max(lit.r, lit.g), lit.b);
    vec3 tint = lit / max(energy, 0.0001);
    vec3 ink = tint * (0.16 / max(dot(tint, vec3(0.2126, 0.7152, 0.0722)), 0.16));
    float coverage = pow(min(energy * 1.3, 1.0), 1.3) * 0.92 * uOpacity;
    outColor = uMode > 2.5 ? vec4(ink * coverage, coverage) : vec4(mix(uBackground, ink, coverage), 1.0);
  } else if (uMode > 0.5) {
    float alpha = min(smoothstep(0.0, 0.3, length(col)), 1.0) * uOpacity;
    outColor = vec4(col * alpha, alpha);
  } else {
    outColor = vec4(mix(uBackground, col, uOpacity), 1.0);
  }
}`;

  var clamp = function (a, lo, hi) { return Math.min(hi, Math.max(lo, a)); };

  // define-bitmask: palette?4 : repel?2 : warp?1
  function variantBits(palette, repel, warp) {
    return (palette ? 4 : 0) + (repel ? 2 : 0) + (warp ? 1 : 0);
  }

  function buildDefines(palette, repel, warp) {
    return (palette ? '#define PALETTE\n' : '') +
           (repel ? '#define REPEL\n' : '') +
           (warp ? '#define WARP\n' : '');
  }

  function compileProgram(gl, palette, repel, warp) {
    var defines = buildDefines(palette, repel, warp);
    var prog = gl.createProgram();
    var vs = gl.createShader(gl.VERTEX_SHADER);
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!prog || !vs || !fs) return null;
    gl.shaderSource(vs, VERT);
    gl.shaderSource(fs, FRAG.replace('\n', '\n' + defines));
    gl.compileShader(vs);
    gl.compileShader(fs);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPosition');
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  function linkUniforms(gl, prog) {
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    var out = {};
    var n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(prog, i);
      if (info) out[info.name.replace('[0]', '')] = gl.getUniformLocation(prog, info.name);
    }
    return { program: prog, uniforms: out };
  }

  function GalaxyBackground(options) {
    var o = options || {};
    var focal = Array.isArray(o.focal) ? o.focal : [0.5, 0.5];
    var rotation = Array.isArray(o.rotation) ? o.rotation : [1, 0];
    var palette = (Array.isArray(o.starColors) ? o.starColors.filter(Boolean).slice(0, MAX_COLORS) : []);
    var cfg = {
      focal: focal,
      rotation: rotation,
      starSpeed: o.starSpeed != null ? o.starSpeed : 0.5,
      density: Math.max(0.01, o.density != null ? o.density : 1),
      hueShift: o.hueShift != null ? o.hueShift : 140,
      disableAnimation: !!o.disableAnimation,
      speed: o.speed != null ? o.speed : 1,
      mouseInteraction: o.mouseInteraction !== false,
      glowIntensity: Math.max(0, o.glowIntensity != null ? o.glowIntensity : 0.3),
      saturation: Math.max(0, o.saturation != null ? o.saturation : 0),
      mouseRepulsion: o.mouseRepulsion !== false,
      repulsionStrength: o.repulsionStrength != null ? o.repulsionStrength : 2,
      twinkleIntensity: clamp(o.twinkleIntensity != null ? o.twinkleIntensity : 0.3, 0, 1),
      rotationSpeed: o.rotationSpeed != null ? o.rotationSpeed : 0.1,
      autoCenterRepulsion: Math.max(0, o.autoCenterRepulsion != null ? o.autoCenterRepulsion : 0),
      transparent: o.transparent !== false,
      lightMode: !!o.lightMode,
      palette: palette,
      starSize: Math.max(0, o.starSize != null ? o.starSize : 1),
      flareIntensity: Math.max(0, o.flareIntensity != null ? o.flareIntensity : 1),
      layers: clamp(Math.round(o.layers != null ? o.layers : 4), 2, MAX_LAYERS),
      reverse: o.direction === 'backward',
      clickWarp: o.clickWarp !== false,
      intro: o.intro !== false,
      backgroundColor: o.backgroundColor,
      opacity: clamp(o.opacity != null ? o.opacity : 1, 0, 1),
      dpr: o.dpr
    };

    var container = o.container;
    if (!container) return { destroy: function () {}, resize: function () {} };

    var canvas = document.createElement('canvas');
    canvas.className = 'galaxy-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    var gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false
    });
    if (!gl) {
      // no WebGL2: leave canvas blank; caller fallback stays visible
      return { destroy: function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }, resize: function () {} };
    }

    var colorCache = new Map();
    var scratch2d = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    function parseColor(hex, fallback) {
      if (!hex) return fallback;
      var cached = colorCache.get(hex);
      if (cached) return cached;
      var rgb = fallback;
      if (scratch2d) {
        scratch2d.clearRect(0, 0, 1, 1);
        scratch2d.fillStyle = '#000000';
        scratch2d.fillStyle = hex;
        scratch2d.fillRect(0, 0, 1, 1);
        var d = scratch2d.getImageData(0, 0, 1, 1).data;
        rgb = [d[0] / 255, d[1] / 255, d[2] / 255];
      }
      colorCache.set(hex, rgb);
      return rgb;
    }

    // full-screen triangle
    var vao = gl.createVertexArray();
    var vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var programCache = new Map();
    function getLinked(paletteOn, repelOn, warpOn) {
      var bits = variantBits(paletteOn, repelOn, warpOn);
      var entry = programCache.get(bits);
      if (!entry) {
        var prog = compileProgram(gl, paletteOn, repelOn, warpOn);
        entry = prog ? linkUniforms(gl, prog) : null;
        programCache.set(bits, entry);
      }
      return entry;
    }

    // live animation state
    var colors = new Float32Array(MAX_COLORS * 3);
    var pointer = { x: 0.5, y: 0.5, inside: false };
    var st = { time: 0, gloss: 0, depth: 0, angle: 0, mx: 0.5, my: 0.5, active: 0, boost: 0, twinkleIntensity: cfg.twinkleIntensity, reveal: cfg.intro ? 0 : 1 };
    var raf = 0, last = 0, running = true;

    var hasPalette = cfg.palette.length > 0;

    function draw() {
      for (var i = 0; i < cfg.palette.length; i++) {
        var c = parseColor(cfg.palette[i], [1, 1, 1]);
        colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
      }
      var mode = cfg.lightMode ? (cfg.transparent ? 3 : 2) : (cfg.transparent ? 1 : 0);
      var bg = parseColor(cfg.backgroundColor, cfg.lightMode ? [1, 1, 1] : [0, 0, 0]);
      var repelActive = (cfg.autoCenterRepulsion > 0) || (cfg.mouseRepulsion && cfg.repulsionStrength > 0 && st.active > 0);
      var warpActive = st.boost > 0;
      var linked = getLinked(hasPalette, false, false);
      if (!linked) return;
      var use = (repelActive || warpActive) ? (getLinked(hasPalette, repelActive, warpActive) || linked) : linked;
      var u = use.uniforms;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(use.program);
      gl.bindVertexArray(vao);

      var q = 1 + st.boost * 5;
      gl.uniform1f(u.uTime, st.time);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform2f(u.uFocal, cfg.focal[0], cfg.focal[1]);
      gl.uniform2f(u.uRotation, cfg.rotation[0], cfg.rotation[1]);
      gl.uniform1f(u.uGloss, st.gloss);
      gl.uniform1f(u.uDepth, st.depth);
      gl.uniform1f(u.uDensity, cfg.density);
      gl.uniform1f(u.uHueShift, cfg.hueShift);
      gl.uniform1f(u.uSpeed, cfg.speed);
      gl.uniform2f(u.uMouse, st.mx, st.my);
      gl.uniform1f(u.uStarGlow, 0.05 * cfg.glowIntensity * cfg.starSize / Math.pow(q, 0.6));
      gl.uniform1f(u.uFlareGain, cfg.glowIntensity * cfg.flareIntensity);
      gl.uniform1f(u.uSquash, 1 - 1 / (q * q));
      gl.uniform1f(u.uSaturation, cfg.saturation);
      gl.uniform1f(u.uMouseRepulsion, cfg.mouseRepulsion ? 1 : 0);
      gl.uniform1f(u.uTwinkleIntensity, st.twinkleIntensity);
      gl.uniform1f(u.uRotationAngle, st.angle);
      gl.uniform1f(u.uRepulsionStrength, cfg.repulsionStrength);
      gl.uniform1f(u.uMouseActiveFactor, st.active);
      gl.uniform1f(u.uAutoCenterRepulsion, cfg.autoCenterRepulsion);
      gl.uniform1i(u.uLayers, cfg.layers);
      gl.uniform3fv(u.uColors, colors);
      gl.uniform1i(u.uColorCount, cfg.palette.length);
      gl.uniform1f(u.uWarp, st.boost);
      var rn = Math.min(1, st.reveal / 0.35);
      gl.uniform1f(u.uReveal, rn * rn * (3 - 2 * rn));
      gl.uniform1i(u.uMode, mode);
      gl.uniform3fv(u.uBackground, bg);
      gl.uniform1f(u.uOpacity, cfg.opacity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      raf = 0;
      if (!running || document.hidden) return;
      var dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;
      var anim = (cfg.disableAnimation) ? 0 : 1;
      if (cfg.intro && st.reveal < 1) {
        st.reveal = Math.min(1, st.reveal + dt / 2.2);
        st.boost = Math.max(st.boost, Math.pow(1 - st.reveal, 2) * 1.4);
      } else {
        st.reveal = 1;
      }
      var dir = cfg.reverse ? -1 : 1;
      var gs = cfg.starSpeed / 10 * dir;
      st.time += dt * anim;
      st.gloss += dt * gs * anim;
      st.depth += dt * gs * cfg.speed * anim * (1 + st.boost * 14);
      st.angle += dt * cfg.rotationSpeed * anim;
      st.boost *= Math.exp(-dt * 1.3);
      if (st.boost < 0.001) st.boost = 0;
      var ease = 1 - Math.exp(-dt / 0.325);
      var want = (cfg.mouseInteraction && pointer.inside) ? 1 : 0;
      if (want) { st.mx += (pointer.x - st.mx) * ease; st.my += (pointer.y - st.my) * ease; }
      st.active += (want - st.active) * ease;
      if (Math.abs(want - st.active) < 0.001) st.active = want;
      draw();
      if (anim > 0 || st.boost > 0 || st.active !== want || st.reveal < 1) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function kick() { if (!raf && running && !document.hidden) raf = requestAnimationFrame(frame); }

    function resize() {
      var r = container.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width));
      var hpx = Math.max(1, Math.round(r.height));
      var ratio = Math.min(cfg.dpr || window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(hpx * ratio));
      draw();
      kick();
    }

    function onMove(e) {
      var r = container.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      pointer.inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      pointer.x = x / Math.max(1, r.width);
      pointer.y = 1 - y / Math.max(1, r.height);
      kick();
    }
    function onDown(e) { onMove(e); if (pointer.inside && cfg.clickWarp) { st.boost = Math.min(1.6, st.boost + 1); kick(); } }
    function onUp(e) { if (e.pointerType !== 'mouse') pointer.inside = false; }
    function onLeave() { pointer.inside = false; }
    function onVis() { last = 0; kick(); }

    var ro = new ResizeObserver(resize);
    ro.observe(container);
    var io = new IntersectionObserver(function (entries) {
      running = entries.some(function (en) { return en.isIntersecting; });
      if (running) { last = 0; kick(); }
    });
    io.observe(container);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVis);

    // prime variant programs for the modes we will actually use
    getLinked(hasPalette, false, cfg.clickWarp);
    var repel = cfg.autoCenterRepulsion > 0 || (cfg.mouseInteraction && cfg.mouseRepulsion);
    if (repel) getLinked(hasPalette, true, false);
    if (repel && cfg.clickWarp) getLinked(hasPalette, true, true);

    resize();

    return {
      resize: resize,
      destroy: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        document.removeEventListener('visibilitychange', onVis);
        programCache.forEach(function (entry) { if (entry && entry.program) gl.deleteProgram(entry.program); });
        gl.deleteBuffer(vbo);
        gl.deleteVertexArray(vao);
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  window.GalaxyBackground = GalaxyBackground;
})();
