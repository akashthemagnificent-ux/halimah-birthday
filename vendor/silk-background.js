
/* Silk background: vanilla JS + WebGL2 port of React Bits "Silk".
   Source: https://reactbits.dev/backgrounds/silk (JS+CSS variant).
   Two-pass satin-folds shader with cursor drag, click ripples, bloom,
   and an intro unfold. Texture-free, so it stays file://-safe.
   Exposes window.SilkBackground(options) -> { destroy(), resize(), update(patch) }. */
(function () {
  'use strict';

  var VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  var SILK = `

uniform vec2 uView;
uniform float uScale;
uniform float uRotation;
uniform float uTime;
uniform float uWave;
uniform float uRipple;
uniform float uFold;
uniform vec2 uShift;
uniform vec4 uPointer;
uniform vec2 uDrag;
uniform vec4 uWaves[4];

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2 r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2 rot = mat2(c, -s, s, c);
  return rot * uv;
}

vec2 bend(vec2 uv) {
  vec2 aspect = vec2(uView.x / uView.y, 1.0);
  vec2 offset = (uv - uPointer.xy) * aspect;
  float touch = uPointer.z * exp(-dot(offset, offset) / (uPointer.w * uPointer.w));
  uv -= uDrag * touch;
  for (int i = 0; i < 4; i++) {
    vec4 wave = uWaves[i];
    if (wave.w <= 0.0) continue;
    vec2 q = (uv - wave.xy) * aspect;
    float dist = length(q);
    float front = dist - wave.z;
    float ring = exp(-front * front * 60.0) * wave.w;
    uv += q / max(dist, 0.0001) / aspect * ring * 0.034 * sin(front * 34.0);
  }
  return uv;
}

float silk(vec2 vUv) {
  vec2 uv = rotateUvs(vUv * uScale, uRotation);
  vec2 tex = uv * uScale + uShift;
  float tOffset = uTime;
  tex.y += 0.03 * uWave * sin(8.0 * tex.x - tOffset);
  return 0.6 + 0.4 * uFold * sin(5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset) + uRipple * sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));
}
`;

  var FIELD = `
#version 300 es
precision highp float;
${SILK}
out vec4 outColor;

void main() {
  vec2 vUv = gl_FragCoord.xy / uView;
  float pattern = silk(bend(vUv));
  float n = clamp((pattern - 0.2) / 0.8, 0.0, 1.0);
  outColor = vec4(pow(n, 6.0), 0.0, 0.0, 1.0);
}`;

  var COMPOSITE = `
#version 300 es
precision highp float;
${SILK}
uniform sampler2D uBloom;
uniform vec3 uColor;
uniform vec3 uSheenColor;
uniform float uNoiseIntensity;
uniform float uDepth;
uniform float uSheen;
uniform float uGlow;
uniform float uLightMode;
uniform vec3 uLight;
uniform vec2 uStep;
uniform float uPresence;
uniform float uFade;
out vec4 outColor;

float smootherstep01(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec3 softClip(vec3 c) {
  vec3 over = max(c - 0.75, 0.0);
  return min(c, 0.75) + 0.25 * (1.0 - exp(-over * 4.0));
}

void main() {
  vec2 vUv = gl_FragCoord.xy / uView;
  vec2 coord = bend(vUv);
  float pattern = silk(coord);
  float rnd = noise(gl_FragCoord.xy);
  float n = clamp((pattern - 0.2) / 0.8, 0.0, 1.0);

  float gx = silk(coord + vec2(uStep.x, 0.0)) - pattern;
  float gy = silk(coord + vec2(0.0, uStep.y)) - pattern;
  vec3 normal = normalize(vec3(-gx * 26.0, -gy * 26.0, 1.0));
  vec3 toLight = normalize(vec3(uLight.xy, 0.85));
  float relief = 1.0 + (dot(normal, toLight) - toLight.z) * 1.8 * uDepth;
  vec3 halfway = normalize(toLight + vec3(0.0, 0.0, 1.0));
  float gloss = pow(max(dot(normal, halfway), 0.0), 48.0) * smoothstep(0.25, 0.85, n);
  float crest = pow(n, 5.0);
  float shine = (gloss * 0.85 + crest * 0.4) * uSheen * (1.0 + uLight.z * 0.6);

  float bloom = 0.0;
  if (uGlow > 0.0) {
    bloom += textureLod(uBloom, vUv, 1.0).r * 0.35;
    bloom += textureLod(uBloom, vUv, 2.0).r * 0.3;
    bloom += textureLod(uBloom, vUv, 3.0).r * 0.2;
    bloom += textureLod(uBloom, vUv, 4.0).r * 0.15;
  }

  vec3 result;
  if (uLightMode > 0.5) {
    float fold = smoothstep(0.28, 0.9, pattern);
    float specular = smoothstep(0.72, 0.98, pattern);
    vec3 shadowColor = uColor * (0.72 - 0.12 * uDepth);
    vec3 bodyColor = min(uColor * 1.18, vec3(1.0));
    vec3 lightBase = mix(shadowColor, bodyColor, fold) * mix(1.0, relief, 0.6);
    lightBase = mix(lightBase, vec3(1.0), clamp(specular * 0.92 + shine * 0.22 + bloom * uGlow * 0.2, 0.0, 1.0));
    float fineNoise = noise(gl_FragCoord.xy * 0.63 + vec2(17.0, 41.0));
    float grainSignal = (rnd + fineNoise - 1.0);
    float grainStrength = clamp(uNoiseIntensity * 0.038, 0.0, 0.16);
    result = clamp(lightBase + grainSignal * grainStrength, 0.0, 1.0);
  } else {
    float grain = rnd / 15.0 * uNoiseIntensity;
    float floorValue = mix(0.2, 0.03, uDepth);
    float curve = uDepth > 0.0 ? pow(n, 1.0 + 1.4 * uDepth) : n;
    float shade = uDepth > 0.0 ? floorValue + (1.0 - floorValue) * curve : pattern;
    vec3 tone = mix(uColor, pow(uColor, vec3(1.45)), (1.0 - n) * uDepth);
    vec3 lit = tone * shade * relief - vec3(grain);
    vec3 tint = mix(uColor, uSheenColor, 0.8);
    vec3 extra = tint * (shine + bloom * uGlow * 0.55);
    float blend = clamp((uSheen + uGlow) * 4.0, 0.0, 1.0);
    result = mix(clamp(lit, 0.0, 1.0), clamp(softClip(lit + extra), 0.0, 1.0), blend);
  }

  float edge = uFade * 0.5;
  float mask = 1.0;
  if (edge > 0.0) {
    mask = smootherstep01(vUv.x / edge) * smootherstep01((1.0 - vUv.x) / edge);
    mask *= smootherstep01(vUv.y / edge) * smootherstep01((1.0 - vUv.y) / edge);
  }
  float alpha = uPresence * mask;
  outColor = vec4(result * alpha, alpha);
}`;

  var INTRO_SECONDS = 2.2;
  var INTRO_RUSH = 1.6;
  var WAVE_LIFE = 1.6;
  var DEFAULT_LIGHT = [-0.55, 0.7];
  var LIGHT_TILT = Math.hypot(DEFAULT_LIGHT[0], DEFAULT_LIGHT[1]);

  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };
  var ease = function (t) { return t * t * t * (t * (t * 6 - 15) + 10); };

  var variationShift = function (variation) {
    var n = Number(variation) || 0;
    if (!n) return [0, 0];
    var wave = function (k) {
      var v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453;
      return v - Math.floor(v) - 0.5;
    };
    return [wave(1) * 6, wave(2) * 6];
  };

  var compile = function (gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    // #version must be the very first line: the FIELD/COMPOSITE templates
    // open with a newline, which drops the shader to GLSL ES 1.00 (out/
    // textureLod fail) and kills the link. Trim before compiling.
    gl.shaderSource(shader, source.trim());
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };

  var link = function (gl, fragmentSource) {
    var vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    var program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(program, info.name);
    }
    return { program: program, uniforms: uniforms };
  };

  var probe2d = null;
  var colorCache = new Map();
  var toRgb = function (value) {
    if (colorCache.has(value)) return colorCache.get(value);
    var rgb = [1, 1, 1];
    if (!probe2d) {
      try { probe2d = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); } catch (e) { probe2d = null; }
    }
    if (probe2d) {
      probe2d.clearRect(0, 0, 1, 1);
      probe2d.fillStyle = '#ffffff';
      probe2d.fillStyle = value;
      probe2d.fillRect(0, 0, 1, 1);
      var d = probe2d.getImageData(0, 0, 1, 1).data;
      rgb = [d[0] / 255, d[1] / 255, d[2] / 255];
    }
    colorCache.set(value, rgb);
    return rgb;
  };

  window.SilkBackground = function (options) {
    var o = options || {};
    var container = o.container;
    if (!container) return { destroy: function () {}, resize: function () {}, update: function () {} };

    var canvas = document.createElement('canvas');
    canvas.className = 'silk-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    var s = {
      speed: o.speed != null ? o.speed : 5,
      scale: o.scale != null ? o.scale : 1,
      color: String(o.color != null ? o.color : '#7B7481'),
      sheenColor: String(o.sheenColor != null ? o.sheenColor : '#ffffff'),
      noiseIntensity: Math.max(0, o.noiseIntensity != null ? o.noiseIntensity : 1.5),
      rotation: o.rotation != null ? o.rotation : 0,
      sheen: Math.max(0, o.sheen != null ? o.sheen : 0.5),
      depth: clamp(o.depth != null ? o.depth : 0.5, 0, 1),
      glow: Math.max(0, o.glow != null ? o.glow : 0.3),
      ripple: Math.max(0, o.ripple != null ? o.ripple : 1),
      wave: Math.max(0, o.wave != null ? o.wave : 1),
      variation: o.variation || 0,
      mouseInteraction: o.mouseInteraction !== false,
      interactionStrength: Math.max(0, o.interactionStrength != null ? o.interactionStrength : 1),
      clickRipple: o.clickRipple !== false,
      intro: o.intro !== false,
      fade: clamp(o.fade != null ? o.fade : 0, 0, 1),
      lightMode: !!o.lightMode,
      paused: false,
      dpr: o.dpr
    };

    var gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: 'high-performance'
    });
    if (!gl) { canvas.remove(); return { destroy: function () {}, resize: function () {}, update: function () {} }; }

    var fieldProgram = link(gl, FIELD);
    var compositeProgram = link(gl, COMPOSITE);
    if (!fieldProgram || !compositeProgram) { canvas.remove(); return { destroy: function () {}, resize: function () {}, update: function () {} }; }

    var buffer = gl.createBuffer();
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var texture = gl.createTexture();
    var framebuffer = gl.createFramebuffer();
    var target = { width: 0, height: 0 };
    var sizeTarget = function (width, height) {
      if (target.width === width && target.height === height) return;
      target.width = width;
      target.height = height;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    };

    var view = { width: 1, height: 1, ratio: 1 };
    var pointer = { x: 0, y: 0, inside: false };
    var waves = [];
    var waveData = new Float32Array(16);
    var state = {
      flow: 0,
      intro: s.intro ? 0 : 1,
      touch: 0, x: 0, y: 0, dragX: 0, dragY: 0,
      lightX: DEFAULT_LIGHT[0], lightY: DEFAULT_LIGHT[1]
    };
    var raf = 0;
    var last = 0;
    var visible = true;

    var setShared = function (uniforms, width, height, unfold) {
      var shift = variationShift(s.variation);
      gl.uniform2f(uniforms.uView, width, height);
      gl.uniform1f(uniforms.uScale, s.scale);
      gl.uniform1f(uniforms.uRotation, s.rotation);
      gl.uniform1f(uniforms.uTime, state.flow - INTRO_RUSH * (1 - unfold));
      gl.uniform1f(uniforms.uWave, s.wave);
      gl.uniform1f(uniforms.uRipple, s.ripple);
      gl.uniform1f(uniforms.uFold, 0.25 + 0.75 * unfold);
      gl.uniform2f(uniforms.uShift, shift[0], shift[1]);
      gl.uniform4f(uniforms.uPointer,
        state.x / view.width,
        1 - state.y / view.height,
        state.touch * s.interactionStrength,
        0.32);
      gl.uniform2f(uniforms.uDrag, state.dragX, state.dragY);
      gl.uniform4fv(uniforms.uWaves, waveData);
    };

    var render = function () {
      var unfold = ease(state.intro);
      var presence = 1 - Math.pow(1 - state.intro, 3);
      gl.bindVertexArray(vao);

      waveData.fill(0);
      waves.slice(-4).forEach(function (item, index) {
        waveData.set([item.x, item.y, item.age * 0.6, Math.exp(-item.age / (WAVE_LIFE * 0.45))], index * 4);
      });

      if (s.glow > 0) {
        sizeTarget(Math.max(1, Math.round(canvas.width / 4)), Math.max(1, Math.round(canvas.height / 4)));
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, target.width, target.height);
        gl.useProgram(fieldProgram.program);
        setShared(fieldProgram.uniforms, target.width, target.height, unfold);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.generateMipmap(gl.TEXTURE_2D);
      }

      var c = compositeProgram.uniforms;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(compositeProgram.program);
      setShared(c, canvas.width, canvas.height, unfold);
      gl.uniform3fv(c.uColor, toRgb(s.color));
      gl.uniform3fv(c.uSheenColor, toRgb(s.sheenColor));
      gl.uniform1f(c.uNoiseIntensity, s.noiseIntensity);
      gl.uniform1f(c.uDepth, s.depth);
      gl.uniform1f(c.uSheen, s.sheen);
      gl.uniform1f(c.uGlow, s.glow);
      gl.uniform1f(c.uLightMode, s.lightMode ? 1 : 0);
      gl.uniform3f(c.uLight, state.lightX, state.lightY, state.touch * s.interactionStrength);
      gl.uniform2f(c.uStep, view.ratio / canvas.width, view.ratio / canvas.height);
      gl.uniform1f(c.uPresence, presence);
      gl.uniform1f(c.uFade, s.fade);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(c.uBloom, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    var frame = function (now) {
      raf = 0;
      if (!visible || document.hidden) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      var flowing = !s.paused && s.speed !== 0;
      if (flowing) state.flow += dt * 0.1 * s.speed;
      if (!s.intro) state.intro = 1;
      else if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);

      var engaged = s.mouseInteraction && pointer.inside;
      if (engaged && state.touch < 0.01) {
        state.x = pointer.x;
        state.y = pointer.y;
      }
      var follow = 1 - Math.exp(-dt * 10);
      var prevX = state.x;
      var prevY = state.y;
      state.x += (pointer.x - state.x) * follow;
      state.y += (pointer.y - state.y) * follow;
      var velX = (state.x - prevX) / Math.max(dt, 0.001) / view.height;
      var velY = (state.y - prevY) / Math.max(dt, 0.001) / view.height;
      var dragBlend = 1 - Math.exp(-dt * 4);
      state.dragX += (clamp(velX * 0.03, -0.06, 0.06) - state.dragX) * dragBlend;
      state.dragY += (clamp(-velY * 0.03, -0.06, 0.06) - state.dragY) * dragBlend;
      state.touch += ((engaged ? 1 : 0) - state.touch) * (1 - Math.exp(-dt * (engaged ? 3.5 : 1.4)));

      var lightGoalX = DEFAULT_LIGHT[0];
      var lightGoalY = DEFAULT_LIGHT[1];
      if (engaged) {
        var aimX = (pointer.x / view.width - 0.5) * (view.width / view.height);
        var aimY = 0.5 - pointer.y / view.height;
        var reach = Math.hypot(aimX, aimY);
        if (reach > 0.04) {
          lightGoalX = (aimX / reach) * LIGHT_TILT;
          lightGoalY = (aimY / reach) * LIGHT_TILT;
        } else {
          lightGoalX = state.lightX;
          lightGoalY = state.lightY;
        }
      }
      var lightFollow = 1 - Math.exp(-dt * 3);
      state.lightX += (lightGoalX - state.lightX) * lightFollow;
      state.lightY += (lightGoalY - state.lightY) * lightFollow;

      for (var i = waves.length - 1; i >= 0; i--) {
        waves[i].age += dt;
        if (waves[i].age > WAVE_LIFE * 2.5) waves.splice(i, 1);
      }

      render();

      var settling =
        state.intro < 1 ||
        waves.length > 0 ||
        Math.abs((engaged ? 1 : 0) - state.touch) > 0.002 ||
        Math.abs(state.dragX) + Math.abs(state.dragY) > 0.0002 ||
        Math.abs(pointer.x - state.x) + Math.abs(pointer.y - state.y) > 0.3 ||
        Math.abs(lightGoalX - state.lightX) + Math.abs(lightGoalY - state.lightY) > 0.001;
      if (flowing || settling) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    var wake = function () {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    var resize = function () {
      var width = Math.max(1, container.clientWidth);
      var height = Math.max(1, container.clientHeight);
      var ratio = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
      view.width = width;
      view.height = height;
      view.ratio = ratio;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      if (!raf) render();
      wake();
    };

    var locate = function (event) {
      var rect = container.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      return { x: x, y: y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
    };

    var onPointerMove = function (event) {
      var point = locate(event);
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.inside = point.inside;
      wake();
    };

    var onPointerDown = function (event) {
      if (!s.clickRipple) return;
      var point = locate(event);
      if (!point.inside) return;
      waves.push({ x: point.x / view.width, y: 1 - point.y / view.height, age: 0 });
      if (waves.length > 4) waves.shift();
      wake();
    };

    var onPointerLeave = function () { pointer.inside = false; wake(); };
    var onVisibility = function () { last = 0; wake(); };

    var resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    var intersection = new IntersectionObserver(function (entries) {
      visible = entries.some(function (entry) { return entry.isIntersecting; });
      if (visible) { last = 0; wake(); }
    });
    intersection.observe(container);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    resize();

    var lastDpr = s.dpr;
    wake();

    return {
      resize: resize,
      update: function (patch) {
        var p = patch || {};
        for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k)) s[k] = p[k]; }
        if (p.dpr !== lastDpr) { lastDpr = p.dpr; resize(); return; }
        if (!raf) render();
        wake();
      },
      destroy: function () {
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        intersection.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', onPointerDown);
        document.documentElement.removeEventListener('pointerleave', onPointerLeave);
        document.removeEventListener('visibilitychange', onVisibility);
        gl.deleteTexture(texture);
        gl.deleteFramebuffer(framebuffer);
        gl.deleteProgram(fieldProgram.program);
        gl.deleteProgram(compositeProgram.program);
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        canvas.remove();
      }
    };
  };
})();
