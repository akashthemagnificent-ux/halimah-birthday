/* ============================================================
   bg-orb — physics section background (React Bits "Orb" port).

   A breathing glowing ring with an orbiting light that reaches
   toward the cursor and pulses on click. Vanilla WebGL2, one
   program, fullscreen triangle. Ported from react-bits Orb.jsx
   (raw GLSL kept intact; driver unwrapped from React).

   House rules baked in: dpr cap 1.6, full motion always (no
   reduced-motion gates), rAF pauses offscreen via
   IntersectionObserver + document.hidden, no scroll listeners,
   passive pointer events. Canvas is an additive layer ABOVE the
   section's own radial gradient; fails closed (canvas hidden)
   without WebGL2.
   ============================================================ */
(() => {
  'use strict';

  const INTRO_SECONDS = 1.1;
  const FOCAL = 3.2;

  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uRotation;
uniform vec2 uReach;
uniform float uNear;
uniform float uAwake;
uniform vec3 uBackground;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uWobble;
uniform float uGlow;
uniform float uBleed;
uniform float uHighlight;
uniform float uSwirl;
uniform float uOrbit;
uniform vec2 uEcho;
uniform float uReveal;
uniform float uOpacity;
uniform float uTrail;
uniform vec2 uTilt;
out vec4 outColor;

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
}

float snoise3(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - K1);
  vec3 d3 = d0 - 0.5;
  vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 n = h * h * h * h * vec4(dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0)));
  return dot(vec4(31.316), n);
}

float light1(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * attenuation);
}

float light2(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * dist * attenuation);
}

vec4 draw(vec2 uv) {
  float rawLen = length(uv);
  vec2 dir = rawLen > 0.0001 ? uv / rawLen : vec2(1.0, 0.0);
  float reachAmount = length(uReach);
  vec2 reachDir = reachAmount > 0.00001 ? uReach / reachAmount : vec2(1.0, 0.0);
  float facing = exp((dot(dir, reachDir) - 1.0) * 3.2);
  float len = max(rawLen - reachAmount * facing * smoothstep(0.25, 0.65, rawLen), 0.0);
  uv = dir * len;
  float ang = atan(dir.y, dir.x);
  float invLen = len > 0.0 ? 1.0 / len : 0.0;
  float near = facing * uNear;
  float bgLuminance = dot(uBackground, vec3(0.299, 0.587, 0.114));

  float n0 = snoise3(vec3(uv * 0.65, uTime * 0.5)) * 0.5 + 0.5;
  float r0 = mix(0.8 - 0.04 * uWobble, 0.8 + 0.04 * uWobble, n0);
  float d0 = distance(uv, (r0 * invLen) * uv);
  float v0 = light1(1.0, 10.0 / uGlow, d0);
  v0 *= smoothstep(r0 * 1.05, r0, len);
  float reach = max(uBleed, 0.04);
  float innerFade = smoothstep(r0 * (1.0 - 0.2 * reach), r0 * (1.0 - 0.05 * reach), len);
  v0 *= mix(innerFade, 1.0, bgLuminance * 0.7 * min(uBleed, 1.0));
  float body = smoothstep(0.8 - 0.2 * reach, 0.8, len);
  float cl = cos(ang + uSwirl) * 0.5 + 0.5;

  vec2 pos = vec2(cos(uOrbit), sin(uOrbit)) * r0;
  float d = distance(uv, pos);
  vec2 head = vec2(cos(uOrbit), sin(uOrbit));
  float lag = atan(head.x * dir.y - head.y * dir.x, dot(dir, head));
  float trail = uTrail > 0.0 ? smoothstep(0.0, 0.35, lag) * exp(-max(lag, 0.0) * 2.6 / uTrail) : 0.0;
  float v1 = (light2(1.5, 5.0, d) + trail * 0.6) * uHighlight;
  v1 *= light1(1.0, 50.0, d0);
  float band = v0 * smoothstep(1.0, mix(0.6, 1.0, n0 * 0.5), len) * body;
  float heat = pow(clamp(band / 0.82, 0.0, 1.0), 3.0);
  float bloom = light2(1.0, 160.0 / uGlow, max(len - r0, 0.0)) * smoothstep(0.4, 0.0, len - r0) * step(r0, len);

  float v2 = smoothstep(1.0, mix(0.6, 1.0, n0 * 0.5), len);
  float v3 = body;

  vec3 colBase = mix(uColor1, uColor2, cl);
  float fadeAmount = mix(1.0, 0.1, bgLuminance);

  float echoD = abs(len - r0 - uEcho.x);
  float echo = light1(1.0, 60.0, echoD) * smoothstep(0.12, 0.0, echoD) * uEcho.y;

  vec3 darkCol = mix(uColor3, colBase, v0);
  darkCol = (darkCol + v1) * v2 * v3 * (1.0 + uAwake + near * 0.35) + mix(colBase, vec3(1.0), 0.25) * heat * (0.28 + near * 0.3);
  darkCol = clamp(darkCol + colBase * (bloom * 0.1 + echo), 0.0, 1.0);

  vec3 lightCol = (colBase + v1) * mix(1.0, v2 * v3, fadeAmount);
  lightCol = mix(uBackground, lightCol, clamp(v0 + echo, 0.0, 1.0));
  lightCol = mix(lightCol, colBase, clamp(v0, 0.0, 1.0) * clamp(near * 0.4 + uAwake, 0.0, 0.6));
  lightCol = clamp(mix(lightCol, vec3(1.0), clamp(v1 * 0.35, 0.0, 0.6)), 0.0, 1.0);

  vec3 finalCol = mix(darkCol, lightCol, bgLuminance);
  float alpha = max(max(finalCol.r, finalCol.g), finalCol.b);
  return vec4(finalCol / (alpha + 1e-5), alpha);
}

vec2 toPlane(vec2 p, out float hit) {
  float cx = cos(uTilt.x);
  float sx = sin(uTilt.x);
  float cy = cos(uTilt.y);
  float sy = sin(uTilt.y);
  vec3 ex = vec3(cy, 0.0, -sy);
  vec3 ey = vec3(sy * sx, cx, cy * sx);
  vec3 normal = vec3(sy * cx, -sx, cy * cx);
  vec3 origin = vec3(0.0, 0.0, 3.2);
  vec3 ray = vec3(p, -3.2);
  float denom = dot(normal, ray);
  float t = -dot(normal, origin) / (abs(denom) > 0.00001 ? denom : -0.00001);
  hit = t > 0.0 ? 1.0 : 0.0;
  vec3 q = origin + ray * t;
  return vec2(dot(q, ex), dot(q, ey));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / min(uResolution.x, uResolution.y) * 2.0;
  uv *= uScale;
  float hit = 1.0;
  if (abs(uTilt.x) + abs(uTilt.y) > 0.0001) uv = toPlane(uv, hit);

  float s = sin(uRotation);
  float c = cos(uRotation);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

  vec4 col = draw(uv);
  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  float alpha = clamp(col.a * hit * uReveal * uOpacity + dither, 0.0, 1.0);
  outColor = vec4(col.rgb * alpha * alpha, alpha);
}`;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  function linkProgram(gl) {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
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
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i += 1) {
      const info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
    return { program, uniforms };
  }

  function startOrb(canvas) {
    const container = canvas.parentElement || canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) {
      canvas.style.display = 'none';
      return;
    }

    const program = linkProgram(gl);
    if (!program) {
      canvas.style.display = 'none';
      return;
    }
    const u = program.uniforms;

    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    /* warm site palette (retinted from react-bits purple/blue) */
    const settings = {
      colors: ['#f0984a', '#ffd166', '#8a3d2e'],
      hue: 0,
      backgroundColor: '#000000',
      size: 1.1,
      glow: 1.1,
      bleed: 1,
      wobble: 1,
      highlight: 1,
      trail: 1,
      tiltX: 0,
      tiltY: 0,
      speed: 1,
      hoverIntensity: 1,
      rotateOnHover: true,
      followCursor: true,
      clickPulse: true,
      opacity: 0.9,
    };

    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const cache = new Map();
    const parse = (value) => {
      if (cache.has(value)) return cache.get(value);
      let rgb = [0, 0, 0];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = '#000000';
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const data = probe.getImageData(0, 0, 1, 1).data;
        rgb = data[3] ? [data[0] / 255, data[1] / 255, data[2] / 255] : [0, 0, 0];
      }
      cache.set(value, rgb);
      return rgb;
    };
    const shiftHue = (rgb, degrees) => {
      if (!degrees) return rgb;
      const angle = (degrees * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const r = rgb[0];
      const g = rgb[1];
      const b = rgb[2];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const i = 0.596 * r - 0.274 * g - 0.322 * b;
      const q = 0.211 * r - 0.523 * g + 0.312 * b;
      const ni = i * cos - q * sin;
      const nq = i * sin + q * cos;
      return [y + 0.956 * ni + 0.621 * nq, y - 0.272 * ni - 0.647 * nq, y - 1.106 * ni + 1.703 * nq];
    };

    const view = { width: 1, height: 1 };
    const pointer = { x: 0, y: 0, inside: false };
    const state = {
      time: 0,
      swirl: 0,
      orbit: 0,
      echo: 1,
      rotation: 0,
      hover: 0,
      near: 0,
      reachX: 0,
      reachY: 0,
      reachSpeedX: 0,
      reachSpeedY: 0,
      pulse: 0,
      pulseSpeed: 0,
      kick: 2.5, /* intro swell */
      reveal: 0,
    };
    let raf = 0;
    let last = 0;
    let visible = true;

    const toOrb = (x, y) => {
      const side = Math.min(view.width, view.height);
      const scale = 1 / (settings.size * (1 + state.pulse));
      let ux = ((x - view.width / 2) / side) * 2 * scale;
      let uy = ((view.height / 2 - y) / side) * 2 * scale;
      if (settings.tiltX || settings.tiltY) {
        const ax = (-settings.tiltX * Math.PI) / 180;
        const ay = (settings.tiltY * Math.PI) / 180;
        const cx = Math.cos(ax);
        const sx = Math.sin(ax);
        const cy = Math.cos(ay);
        const sy = Math.sin(ay);
        const normal = [sy * cx, -sx, cy * cx];
        const ray = [ux, uy, -FOCAL];
        const denom = normal[0] * ray[0] + normal[1] * ray[1] + normal[2] * ray[2];
        const t = -(normal[2] * FOCAL) / (Math.abs(denom) > 0.00001 ? denom : -0.00001);
        if (t <= 0) return [99, 99];
        const qx = ray[0] * t;
        const qy = ray[1] * t;
        const qz = FOCAL + ray[2] * t;
        ux = qx * cy - qz * sy;
        uy = qx * sy * sx + qy * cx + qz * cy * sx;
      }
      const sin = Math.sin(state.rotation);
      const cos = Math.cos(state.rotation);
      return [cos * ux - sin * uy, sin * ux + cos * uy];
    };

    const render = () => {
      const c1 = shiftHue(parse(settings.colors[0]), settings.hue);
      const c2 = shiftHue(parse(settings.colors[1]), settings.hue);
      const c3 = shiftHue(parse(settings.colors[2]), settings.hue);
      const reveal = state.reveal;
      const back = reveal - 1;
      const grow = 1 + 2.2 * back * back * back + 1.2 * back * back;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program.program);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform2f(u.uReach, state.reachX, state.reachY);
      gl.uniform1f(u.uNear, state.near);
      gl.uniform1f(u.uAwake, state.hover * settings.hoverIntensity * 0.18);
      gl.uniform1f(u.uRotation, state.rotation);
      gl.uniform3fv(u.uBackground, parse(settings.backgroundColor));
      gl.uniform3fv(u.uColor1, c1);
      gl.uniform3fv(u.uColor2, c2);
      gl.uniform3fv(u.uColor3, c3);
      gl.uniform1f(u.uScale, 1 / (settings.size * (1 + state.pulse) * (0.62 + 0.38 * grow)));
      gl.uniform1f(u.uWobble, settings.wobble);
      gl.uniform1f(u.uGlow, settings.glow);
      gl.uniform1f(u.uBleed, settings.bleed);
      gl.uniform1f(u.uHighlight, settings.highlight);
      gl.uniform2f(u.uEcho, state.echo * 0.55, state.echo < 1 ? (1 - state.echo) * (1 - state.echo) : 0);
      gl.uniform1f(u.uSwirl, state.swirl);
      gl.uniform1f(u.uOrbit, state.orbit);
      const revealSmooth = Math.min(1, reveal / 0.55);
      gl.uniform1f(u.uReveal, revealSmooth * revealSmooth * (3 - 2 * revealSmooth));
      gl.uniform1f(u.uOpacity, settings.opacity);
      gl.uniform1f(u.uTrail, settings.trail);
      gl.uniform2f(u.uTilt, (-settings.tiltX * Math.PI) / 180, (settings.tiltY * Math.PI) / 180);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;
      const pointerOrb = toOrb(pointer.x, pointer.y);
      const px = pointerOrb[0];
      const py = pointerOrb[1];
      const distance = Math.hypot(px, py);
      const region = pointer.inside ? clamp((1.45 - distance) / 0.4, 0, 1) : 0;
      const zone = region * region * (3 - 2 * region);
      const aimed = zone * clamp((distance - 0.15) / 0.45, 0, 1);
      const near = zone > 0.5;
      state.hover += (zone - state.hover) * (1 - Math.exp(-dt / 0.16));
      const reach = 0.075 * settings.hoverIntensity * aimed;
      const goalX = distance > 0.0001 ? (px / distance) * reach : 0;
      const goalY = distance > 0.0001 ? (py / distance) * reach : 0;
      state.reachSpeedX += (70 * (goalX - state.reachX) - 7 * state.reachSpeedX) * dt;
      state.reachSpeedY += (70 * (goalY - state.reachY) - 7 * state.reachSpeedY) * dt;
      state.reachX += state.reachSpeedX * dt;
      state.reachY += state.reachSpeedY * dt;
      state.near += (aimed * settings.hoverIntensity - state.near) * (1 - Math.exp(-dt / 0.12));

      const step = dt * settings.speed;
      state.time += step;
      state.swirl += step * 2 * (1 + state.kick);
      state.echo = Math.min(1, state.echo + dt / 1.2);
      if (settings.rotateOnHover) state.rotation += dt * 0.3 * state.hover;

      const aim = Math.atan2(py, px);
      if (settings.followCursor && near) {
        const delta = Math.atan2(Math.sin(aim - state.orbit), Math.cos(aim - state.orbit));
        state.orbit += delta * (1 - Math.exp(-dt * 6));
      } else {
        state.orbit -= step;
      }
      state.orbit = Math.atan2(Math.sin(state.orbit), Math.cos(state.orbit));

      state.pulseSpeed += (-170 * state.pulse - 11 * state.pulseSpeed) * dt;
      state.pulse += state.pulseSpeed * dt;
      state.kick *= Math.exp(-dt * 2.5);

      if (state.reveal < 1) state.reveal = Math.min(1, state.reveal + dt / INTRO_SECONDS);

      render();
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      view.width = width;
      view.height = height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      render();
      wake();
    };

    const locate = (event) => {
      const rect = container.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside =
        pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
    };

    const onPointerMove = (event) => {
      locate(event);
      wake();
    };

    const onPointerDown = (event) => {
      if (!settings.clickPulse) return;
      locate(event);
      if (!pointer.inside) return;
      const orb = toOrb(pointer.x, pointer.y);
      if (Math.hypot(orb[0], orb[1]) > 1) return;
      state.pulseSpeed += 0.9;
      state.kick = 2.2;
      state.echo = 0;
      wake();
    };

    const onPointerUp = (event) => {
      if (event.pointerType !== 'mouse') pointer.inside = false;
    };

    const onPointerLeave = () => {
      pointer.inside = false;
    };

    const onVisibility = () => {
      last = 0;
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        last = 0;
        wake();
      }
    });
    intersection.observe(container);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    resize();
  }

  function boot() {
    const canvas = document.getElementById('physics-bg');
    if (!canvas) return;
    try {
      startOrb(canvas);
    } catch (err) {
      canvas.style.display = 'none';
    }
  }

  /* begin-gate detaches #content-region until unlock — wait for it */
  if (document.documentElement.dataset.unlocked === 'true') {
    boot();
  } else {
    const obs = new MutationObserver(() => {
      if (document.documentElement.dataset.unlocked === 'true') {
        obs.disconnect();
        boot();
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-unlocked'] });
  }
})();
