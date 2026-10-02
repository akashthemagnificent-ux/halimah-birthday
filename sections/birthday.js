/* ============================================================
   halimah-birthday — #birthday : THE 3D CELEBRATION (personal site)

   A full cinematic 3D birthday page before #story, on the project's
   own vendor stack (THREE r160 UMD + GSAP + ScrollTrigger) and its
   real content: her 3 baby photos, the ember-night palette, the
   masked-reveal headline.

   Scene graph (one renderer, one rAF):
     - ember lattice globe (shader points: dense luminous core +
       thin orbital ring, globe-particles treatment)
     - hero CAKE: 3 gold tiers + frosting + 5 lit candles (instanced
       flames with per-flame flicker) + cherry glow topper
     - 3 framed baby photos orbiting as keepsakes (CanvasTexture
       planes with gold frames + caption plates)
     - balloon fleet (12 instanced-look spheres + knot cones +
       string lines, bobbing on sine fields)
     - rising confetti sparks (instanced quads, tumbling like leaves)
     - ground glow disc + star field + candle-light point light
   DOM: distance-emitter pointer trail, GSAP intro choreography,
   masked-reveal headline, scrub-reveal manifesto, pinned scroll
   camera flight (pure function of progress — fully reversible).

   FULL MOTION always: no reduced-motion branch, native DPR, retry
   until vendors parse, boot the moment the gated content lands.
   ============================================================ */
(() => {
  'use strict';

  var SECTION_ID = 'birthday';
  var STAGE_SELECTOR = '#bday-globe';
  var TRAIL_SELECTOR = '#bday-trail';

  var PHOTOS = [
    'assets/baby/IMG_0658.webp',
    'assets/baby/IMG_0994.webp',
    'assets/baby/IMG_1077.webp'
  ];

  var EMBER = 0xe07c3e;
  var EMBER_GLOW = 0xf0984a;
  var GOLD = 0xffd166;
  var ROSE = 0xff6f91;
  var CREAM = 0xf5ebe0;
  var BALLOON_COLORS = [0xff6f91, 0xffd166, 0x7dba6a, 0x8ecae6, 0xc9a0ff, 0xf0984a];

  var booted = false;
  var bootTries = 0;

  function hasVendors() {
    return (
      typeof window.THREE !== 'undefined' &&
      typeof window.gsap !== 'undefined' &&
      typeof window.ScrollTrigger !== 'undefined'
    );
  }

  function isUnlocked() {
    return document.documentElement.getAttribute('data-unlocked') === 'true';
  }

  function clamp01(v) {
    v = Number(v) || 0;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function easeInOut(t) {
    t = clamp01(t);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function makeRandom(seed) {
    var s = seed >>> 0 || 1;
    return function next() {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  }


  /* ================================================================
     Globe shader (globe-particles treatment): dense luminous sphere
     core + thin orbital ring, circular crisp points, additive glow.
     ================================================================ */
  var GLOBE_VERT = [
    'attribute float a_size;',
    'attribute float a_layer;',
    'uniform float u_time;',
    'uniform float u_pointSize;',
    'varying float v_layer;',
    'varying float v_depth;',
    'varying float v_falloff;',
    'void main() {',
    '  vec3 pos = position;',
    '  float breathe = 1.0 + sin(u_time * 0.65 + a_layer * 4.0) * 0.012;',
    '  pos *= breathe;',
    '  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);',
    '  gl_PointSize = u_pointSize * a_size * (1.0 / max(0.18, -mvPosition.z));',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  v_layer = a_layer;',
    '  v_depth = smoothstep(-1.8, 1.8, pos.z);',
    '  v_falloff = smoothstep(2.45, 0.25, length(pos));',
    '}'
  ].join('\n');

  var GLOBE_FRAG = [
    'precision highp float;',
    'uniform vec3 u_coreColor;',
    'uniform vec3 u_accentColor;',
    'varying float v_layer;',
    'varying float v_depth;',
    'varying float v_falloff;',
    'void main() {',
    '  vec2 uv = gl_PointCoord - 0.5;',
    '  float d = length(uv);',
    '  float alpha = smoothstep(0.5, 0.0, d);',
    '  alpha *= alpha;',
    '  vec3 color = mix(u_coreColor, u_accentColor, smoothstep(0.35, 1.0, v_layer));',
    '  color += vec3(1.0) * v_depth * 0.08;',
    '  color = mix(color * 0.42, color, clamp(v_falloff + v_layer * 0.28, 0.0, 1.0));',
    '  alpha *= mix(0.52, 1.0, clamp(v_falloff + v_layer * 0.24, 0.0, 1.0));',
    '  gl_FragColor = vec4(color, alpha);',
    '}'
  ].join('\n');

  function buildGlobeGeometry(THREE, rand, sphereCount, ringCount, radius, ringRadius) {
    var total = sphereCount + ringCount;
    var positions = new Float32Array(total * 3);
    var sizes = new Float32Array(total);
    var layers = new Float32Array(total);
    var i, idx, z, theta, r, root, angle, rr;

    for (i = 0; i < sphereCount; i += 1) {
      z = rand() * 2 - 1;
      theta = rand() * Math.PI * 2;
      r = radius * (0.58 + Math.pow(rand(), 0.42) * 0.42);
      root = Math.sqrt(Math.max(0, 1 - z * z));
      idx = i * 3;
      positions[idx] = Math.cos(theta) * root * r;
      positions[idx + 1] = Math.sin(theta) * root * r;
      positions[idx + 2] = z * r;
      sizes[i] = 0.72 + rand() * 0.72;
      layers[i] = rand() * 0.28;
    }
    for (i = 0; i < ringCount; i += 1) {
      var pi = sphereCount + i;
      angle = rand() * Math.PI * 2;
      rr = ringRadius + (rand() - 0.5) * 0.12;
      idx = pi * 3;
      positions[idx] = Math.cos(angle) * rr;
      positions[idx + 1] = (rand() - 0.5) * 0.07;
      positions[idx + 2] = Math.sin(angle) * rr;
      sizes[pi] = 0.62 + rand() * 0.58;
      layers[pi] = 0.72 + rand() * 0.28;
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('a_size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('a_layer', new THREE.BufferAttribute(layers, 1));
    return geometry;
  }

  /* Soft radial glow sprite texture (shared by flames, balloon
     highlights, ground glow, trail handled separately in 2D). */
  function makeGlowTexture(THREE) {
    var size = 128;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,240,220,0.85)');
    g.addColorStop(0.55, 'rgba(255,220,170,0.28)');
    g.addColorStop(1, 'rgba(255,210,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }


  /* ================================================================
     CAKE — the hero object. Three gold tiers, frosting rims,
     5 lit candles around a cherry-glow topper, on a glow disc.
     ================================================================ */
  function buildCake(THREE, glowTex) {
    var cake = new THREE.Group();
    var disposables = [];

    function track(obj) {
      if (obj.geometry) disposables.push(obj.geometry);
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(function (m) { disposables.push(m); });
        else disposables.push(obj.material);
      }
      return obj;
    }

    var goldMat = new THREE.MeshStandardMaterial({
      color: 0xd98a3d, metalness: 0.55, roughness: 0.32,
      emissive: 0x3a1c05, emissiveIntensity: 0.35, flatShading: false
    });
    var creamMat = new THREE.MeshStandardMaterial({
      color: 0xf5ebe0, metalness: 0.05, roughness: 0.5,
      emissive: 0x40342a, emissiveIntensity: 0.18
    });
    var berryMat = new THREE.MeshStandardMaterial({
      color: 0xff6f91, metalness: 0.25, roughness: 0.25,
      emissive: 0x7d1f36, emissiveIntensity: 0.9
    });

    // stand + glow disc
    var discGeo = new THREE.CylinderGeometry(1.55, 1.7, 0.12, 48);
    var discMat = new THREE.MeshStandardMaterial({
      color: 0x2a1c10, metalness: 0.7, roughness: 0.35,
      emissive: 0xe07c3e, emissiveIntensity: 0.22
    });
    var disc = track(new THREE.Mesh(discGeo, discMat));
    disc.position.y = -1.62;
    disc.receiveShadow = true;
    cake.add(disc);

    var glowMat = new THREE.SpriteMaterial({
      map: glowTex, color: 0xe07c3e, transparent: true,
      opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var glow = new THREE.Sprite(glowMat);
    glow.scale.set(6.4, 6.4, 1);
    glow.position.y = -1.5;
    cake.add(glow);
    disposables.push(glowMat);

    // three tiers + frosting rims
    var tiers = [
      { r: 1.05, h: 0.62, y: -1.25 },
      { r: 0.78, h: 0.55, y: -0.68 },
      { r: 0.52, h: 0.48, y: -0.17 }
    ];
    tiers.forEach(function (tier, i) {
      var body = track(new THREE.Mesh(
        new THREE.CylinderGeometry(tier.r, tier.r * 1.02, tier.h, 48),
        i % 2 === 0 ? goldMat : creamMat
      ));
      body.position.y = tier.y;
      body.castShadow = true;
      body.receiveShadow = true;
      cake.add(body);

      var rim = track(new THREE.Mesh(
        new THREE.TorusGeometry(tier.r * 0.99, 0.055, 12, 48),
        creamMat
      ));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = tier.y + tier.h / 2;
      cake.add(rim);

      // frosting drips: small spheres around the rim
      for (var d = 0; d < 14; d += 1) {
        var a = (d / 14) * Math.PI * 2 + i * 0.4;
        var drip = track(new THREE.Mesh(
          new THREE.SphereGeometry(0.05 + (d % 3) * 0.012, 10, 10),
          creamMat
        ));
        drip.position.set(Math.cos(a) * tier.r * 0.99, tier.y + tier.h / 2 - 0.07, Math.sin(a) * tier.r * 0.99);
        cake.add(drip);
      }
    });

    // cherry-glow topper
    var cherry = track(new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 20), berryMat));
    cherry.position.y = 0.22;
    cake.add(cherry);
    var cherryGlowMat = new THREE.SpriteMaterial({
      map: glowTex, color: 0xff6f91, transparent: true,
      opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var cherryGlow = new THREE.Sprite(cherryGlowMat);
    cherryGlow.scale.set(0.85, 0.85, 1);
    cherryGlow.position.y = 0.22;
    cake.add(cherryGlow);
    disposables.push(cherryGlowMat);

    // 5 candles in a ring + flames
    var flames = [];
    var candleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.5, 16);
    var candleMats = [0xff6f91, 0xffd166, 0x7dba6a, 0x8ecae6, 0xc9a0ff].map(function (c) {
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.05 });
    });
    candleMats.forEach(function (m) { disposables.push(m); });
    disposables.push(candleGeo);
    var wickGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6);
    disposables.push(wickGeo);
    var wickMat = new THREE.MeshBasicMaterial({ color: 0x1a1410 });
    disposables.push(wickMat);

    for (var c = 0; c < 5; c += 1) {
      var ang = (c / 5) * Math.PI * 2 + 0.3;
      var cx = Math.cos(ang) * 0.34;
      var cz = Math.sin(ang) * 0.34;
      var candle = track(new THREE.Mesh(candleGeo, candleMats[c]));
      candle.position.set(cx, 0.32, cz);
      candle.castShadow = true;
      cake.add(candle);
      var wick = new THREE.Mesh(wickGeo, wickMat);
      wick.position.set(cx, 0.6, cz);
      cake.add(wick);

      // flame: additive sprite + hot core sprite
      var flameMat = new THREE.SpriteMaterial({
        map: glowTex, color: 0xffc46b, transparent: true,
        opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending
      });
      var flame = new THREE.Sprite(flameMat);
      flame.scale.set(0.30, 0.44, 1);
      flame.position.set(cx, 0.74, cz);
      cake.add(flame);
      disposables.push(flameMat);
      var coreMat = new THREE.SpriteMaterial({
        map: glowTex, color: 0xfff6dd, transparent: true,
        opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending
      });
      var core = new THREE.Sprite(coreMat);
      core.scale.set(0.13, 0.2, 1);
      core.position.set(cx, 0.72, cz);
      cake.add(core);
      disposables.push(coreMat);
      flames.push({ flame: flame, core: core, phase: c * 1.37 });
    }

    return { group: cake, flames: flames, cherry: cherry, cherryGlow: cherryGlow, disposables: disposables };
  }


  /* ================================================================
     KEEPSAKES — her 3 baby photos as gold-framed planes orbiting
     the cake. TextureLoader with onError fallback: a photo that
     fails to load becomes a warm gradient plate, never a hole.
     ================================================================ */
  function buildKeepsakes(THREE, textureLoader, rand) {
    var group = new THREE.Group();
    var frames = [];
    var disposables = [];

    var frameMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a45, metalness: 0.6, roughness: 0.4,
      emissive: 0x2a1a0c, emissiveIntensity: 0.25
    });
    disposables.push(frameMat);
    var plateGeo = new THREE.PlaneGeometry(0.78, 1.04);
    disposables.push(plateGeo);
    var frameGeo = new THREE.PlaneGeometry(0.9, 1.16);
    disposables.push(frameGeo);

    function fallbackTexture(i) {
      var canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 176;
      var ctx = canvas.getContext('2d');
      var g = ctx.createLinearGradient(0, 0, 0, 176);
      var hues = [['#e07c3e', '#7d3b1a'], ['#ff6f91', '#7d2340'], ['#ffd166', '#8a5f14']];
      g.addColorStop(0, hues[i % 3][0]);
      g.addColorStop(1, hues[i % 3][1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 176);
      var tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    for (var i = 0; i < PHOTOS.length; i += 1) {
      (function (index) {
        var pivot = new THREE.Group();
        var holder = new THREE.Group();

        var back = new THREE.Mesh(frameGeo, frameMat);
        holder.add(back);

        var photoMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        disposables.push(photoMat);
        var plate = new THREE.Mesh(plateGeo, photoMat);
        plate.position.z = 0.012;
        holder.add(plate);

        textureLoader.load(
          PHOTOS[index],
          function (tex) {
            tex.colorSpace = THREE.SRGBColorSpace;
            photoMat.map = tex;
            photoMat.needsUpdate = true;
          },
          undefined,
          function () {
            photoMat.map = fallbackTexture(index);
            photoMat.needsUpdate = true;
          }
        );

        var baseAngle = (index / PHOTOS.length) * Math.PI * 2 + 0.5;
        var radius = 1.6 + rand() * 0.3;
        pivot.add(holder);
        group.add(pivot);
        frames.push({
          pivot: pivot,
          holder: holder,
          baseAngle: baseAngle,
          radius: radius,
          yBase: 1.0 + (index % 2) * 0.45,
          speed: 0.07 + index * 0.012,
          bobPhase: rand() * Math.PI * 2
        });
      })(i);
    }

    return { group: group, frames: frames, disposables: disposables };
  }

  /* ================================================================
     BALLOONS — 12 glossy spheres + knots + strings, bobbing on
     layered sine fields around the celebration.
     ================================================================ */
  function buildBalloons(THREE, rand) {
    var group = new THREE.Group();
    var balloons = [];
    var disposables = [];
    var stringMat = new THREE.LineBasicMaterial({ color: 0xcbb59a, transparent: true, opacity: 0.55 });
    disposables.push(stringMat);

    for (var i = 0; i < 12; i += 1) {
      var color = BALLOON_COLORS[i % BALLOON_COLORS.length];
      var mat = new THREE.MeshStandardMaterial({
        color: color, metalness: 0.1, roughness: 0.22,
        emissive: color, emissiveIntensity: 0.14
      });
      disposables.push(mat);
      var geo = new THREE.SphereGeometry(0.30 + rand() * 0.1, 24, 24);
      geo.scale(1, 1.18, 1);
      disposables.push(geo);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;

      var knotGeo = new THREE.ConeGeometry(0.05, 0.09, 10);
      disposables.push(knotGeo);
      var knot = new THREE.Mesh(knotGeo, mat);
      knot.rotation.x = Math.PI;
      knot.position.y = -0.4;
      mesh.add(knot);

      var angle = -0.25 - rand() * 1.1;
      var radius = 4.0 + rand() * 1.4;
      var yBase = 1.4 + rand() * 2.2;

      // string: line from balloon down 1.6 units
      var strGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.44, 0),
        new THREE.Vector3(0.05, -1.1, 0.02),
        new THREE.Vector3(-0.03, -2.0, -0.02)
      ]);
      disposables.push(strGeo);
      mesh.add(new THREE.Line(strGeo, stringMat));

      mesh.position.set(Math.cos(angle) * radius, yBase, Math.sin(angle) * radius);
      group.add(mesh);
      balloons.push({
        mesh: mesh,
        angle: angle,
        radius: radius,
        yBase: yBase,
        bobSpeed: 0.5 + rand() * 0.7,
        bobAmp: 0.16 + rand() * 0.2,
        swaySpeed: 0.2 + rand() * 0.3,
        swayAmp: 0.18 + rand() * 0.22,
        spin: (rand() - 0.5) * 0.4,
        phase: rand() * Math.PI * 2
      });
    }

    return { group: group, balloons: balloons, disposables: disposables };
  }

  /* ================================================================
     CONFETTI SPARKS — instanced tumbling quads rising through the
     scene (leaf-tumble read: face, edge, face), plus a star field.
     ================================================================ */
  function buildConfettiSparks(THREE, rand, glowTex) {
    var COUNT = 170;
    var geo = new THREE.PlaneGeometry(0.07, 0.1);
    var mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    var palette = [new THREE.Color(0xff6f91), new THREE.Color(0xffd166),
      new THREE.Color(0xf0984a), new THREE.Color(0x7dba6a),
      new THREE.Color(0x8ecae6), new THREE.Color(0xc9a0ff)];
    var i;
    for (i = 0; i < COUNT; i += 1) {
      mesh.setColorAt(i, palette[i % palette.length]);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    var seeds = [];
    for (i = 0; i < COUNT; i += 1) {
      seeds.push({
        x: (rand() * 2 - 1) * 5,
        y: -3 + rand() * 7,
        z: (rand() * 2 - 1) * 3.4,
        rise: 0.24 + rand() * 0.5,
        sway: 0.2 + rand() * 0.7,
        spin: 1 + rand() * 3,
        roll: rand() * Math.PI * 2,
        phase: rand() * Math.PI * 2
      });
    }

    return { mesh: mesh, seeds: seeds, count: COUNT, disposables: [geo, mat] };
  }

  function buildStars(THREE, rand) {
    var COUNT = 420;
    var positions = new Float32Array(COUNT * 3);
    for (var i = 0; i < COUNT; i += 1) {
      positions[i * 3] = (rand() * 2 - 1) * 16;
      positions[i * 3 + 1] = rand() * 10 - 2;
      positions[i * 3 + 2] = -6 - rand() * 8;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xf5ebe0, size: 0.035, transparent: true, opacity: 0.7,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return { points: points, disposables: [geo, mat] };
  }


  /* ================================================================
     STAGE — one renderer, one rAF, layered scene + camera flight.
     The flight is a pure function of scroll progress: radius,
     height, swing, globe spin and keepsake orbit all derive from
     the same eased value, so scrolling back retraces the path.
     ================================================================ */
  function createStage(section, globeCanvas, trailCanvas) {
    var THREE = window.THREE;
    if (!THREE || !globeCanvas || !trailCanvas) return null;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: globeCanvas, alpha: true, antialias: true,
        powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false
      });
    } catch (err) {
      return null;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var rand = makeRandom(20261019);
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a1410, 0.045);

    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.6, 8.2);

    // lights: warm key + rose rim + candle flicker point + ambient
    scene.add(new THREE.AmbientLight(0xffe9d2, 0.5));
    var key = new THREE.DirectionalLight(0xffd9ae, 2.0);
    key.position.set(3.4, 4.2, 4.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xff6f91, 0.9);
    rim.position.set(-4.2, 1.4, -2.8);
    scene.add(rim);
    var candleLight = new THREE.PointLight(0xffb45e, 12, 9, 1.8);
    candleLight.position.set(2.6, 0.5, -0.5);
    scene.add(candleLight);

    var glowTex = makeGlowTexture(THREE);

    // globe lattice (left-back) + orbital ring
    var globeGeo = buildGlobeGeometry(THREE, makeRandom(7), 2400, 1100, 1.05, 1.9);
    var globeMat = new THREE.ShaderMaterial({
      vertexShader: GLOBE_VERT,
      fragmentShader: GLOBE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        u_time: { value: 0 },
        u_pointSize: { value: 260 },
        u_coreColor: { value: new THREE.Color(0xfff3e0) },
        u_accentColor: { value: new THREE.Color(EMBER) }
      }
    });
    var globe = new THREE.Points(globeGeo, globeMat);
    globe.frustumCulled = false;
    globe.position.set(-4.2, 1.1, -3.2);
    scene.add(globe);

    // cake (hero, centre)
    var cakeBuilt = buildCake(THREE, glowTex);
    var cake = cakeBuilt.group;
    cake.position.set(2.6, -0.85, -0.9);
    scene.add(cake);

    // keepsake photos orbiting the cake
    var keeps = buildKeepsakes(THREE, new THREE.TextureLoader(), rand);
    scene.add(keeps.group);

    // balloons + confetti + stars
    var balloonBuilt = buildBalloons(THREE, rand);
    scene.add(balloonBuilt.group);
    var sparks = buildConfettiSparks(THREE, rand, glowTex);
    scene.add(sparks.mesh);
    var stars = buildStars(THREE, rand);
    scene.add(stars.points);

    var dummy = new THREE.Object3D();
    var progress = 0;
    var pointer = { x: 0, y: 0, seen: false };
    var pointerEase = { x: 0, y: 0 };

    function resize() {
      var rect = section.getBoundingClientRect();
      var w = Math.max(1, Math.floor(rect.width || window.innerWidth || 1));
      var h = Math.max(1, Math.floor(rect.height || window.innerHeight || 1));
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      var px = renderer.getPixelRatio();
      globeMat.uniforms.u_pointSize.value = 260 * px;
    }

    function applyProgress(p) {
      var e = easeInOut(p);
      var angle = e * Math.PI * 0.85;
      var radius = 8.2 - e * 2.3;
      camera.position.set(
        Math.sin(angle) * radius * 0.5,
        0.6 - e * 0.9,
        Math.cos(angle) * radius
      );
      camera.lookAt(1.9, -0.3 + e * 0.5, -0.6);
      globe.rotation.y = e * Math.PI * 1.2;
      globe.rotation.x = Math.sin(e * Math.PI) * 0.14;
      cake.rotation.y = e * Math.PI * 0.7;
      cake.position.y = -0.85 + e * 0.75;
    }

    var running = false;
    var rafId = 0;

    function frame() {
      if (!running) return;
      var t = performance.now() * 0.001;

      // eased pointer parallax (camera-space drift, never snapped)
      pointerEase.x += ((pointer.seen ? pointer.x : 0) - pointerEase.x) * 0.045;
      pointerEase.y += ((pointer.seen ? pointer.y : 0) - pointerEase.y) * 0.045;

      // globe + cake life
      globeMat.uniforms.u_time.value = t;
      globe.rotation.y += 0.0009;
      cake.position.y += Math.sin(t * 0.9) * 0.0007;
      cake.rotation.y += 0.0006;
      candleLight.intensity = 12 + Math.sin(t * 11) * 1.6 + Math.sin(t * 23 + 1) * 1.1;

      // candle flames flicker (scale + shimmer, per-flame phase)
      for (var f = 0; f < cakeBuilt.flames.length; f += 1) {
        var fl = cakeBuilt.flames[f];
        var flick = 1 + Math.sin(t * 13 + fl.phase) * 0.12 + Math.sin(t * 29 + fl.phase * 2) * 0.06;
        fl.flame.scale.set(0.30 * (2 - flick) * 0.5 + 0.15 * flick, 0.44 * flick, 1);
        fl.core.scale.set(0.13 * flick, 0.2 * (2 - flick) * 0.5 + 0.1, 1);
        fl.flame.position.x += Math.sin(t * 7 + fl.phase) * 0.0006;
      }
      cakeBuilt.cherryGlow.material.opacity = 0.6 + Math.sin(t * 2.2) * 0.2;

      // keepsakes orbit the cake, always facing the camera
      for (var k = 0; k < keeps.frames.length; k += 1) {
        var fr = keeps.frames[k];
        var a = fr.baseAngle + t * fr.speed + progress * 1.4;
        fr.holder.position.set(
          3.2 + Math.cos(a) * fr.radius,
          fr.yBase + Math.sin(t * 0.8 + fr.bobPhase) * 0.12,
          Math.sin(a) * fr.radius * 0.7 - 1.1
        );
        fr.holder.rotation.y = Math.atan2(camera.position.x - fr.holder.position.x, camera.position.z - fr.holder.position.z);
        fr.holder.rotation.z = Math.sin(t * 0.6 + fr.bobPhase) * 0.05;
      }

      // balloons bob + sway + spin
      for (var b = 0; b < balloonBuilt.balloons.length; b += 1) {
        var bl = balloonBuilt.balloons[b];
        bl.mesh.position.y = bl.yBase + Math.sin(t * bl.bobSpeed + bl.phase) * bl.bobAmp + progress * 1.2;
        bl.mesh.position.x = Math.cos(bl.angle) * bl.radius + Math.sin(t * bl.swaySpeed + bl.phase) * bl.swayAmp;
        bl.mesh.rotation.y += 0.002 + bl.spin * 0.002;
        bl.mesh.rotation.z = Math.sin(t * 0.5 + bl.phase) * 0.06;
      }

      // confetti sparks rise + tumble (face/edge/face) + sway
      for (var s = 0; s < sparks.count; s += 1) {
        var sd = sparks.seeds[s];
        sd.y += sd.rise * 0.016;
        if (sd.y > 4.2) {
          sd.y = -3;
          sd.x = (Math.random() * 2 - 1) * 5;
        }
        dummy.position.set(
          sd.x + Math.sin(t * sd.sway + sd.phase) * 0.4 + pointerEase.x * 0.3,
          sd.y,
          sd.z
        );
        dummy.rotation.set(t * sd.spin + sd.phase, sd.roll + t * sd.spin * 0.7, 0);
        dummy.scale.x = Math.abs(Math.cos(t * sd.spin + sd.phase)) * 0.9 + 0.1;
        dummy.updateMatrix();
        sparks.mesh.setMatrixAt(s, dummy.matrix);
      }
      sparks.mesh.instanceMatrix.needsUpdate = true;

      // pointer parallax on the whole camera rig
      camera.position.x += pointerEase.x * 0.35;
      camera.position.y += pointerEase.y * 0.22;
      camera.lookAt(1.9, -0.3 + progress * 0.5, -0.6);

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      rafId = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    if (typeof IntersectionObserver === 'function') {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start();
          else stop();
        });
      }, { threshold: 0 });
      observer.observe(section);
    } else {
      start();
    }

    var resizeQueued = false;
    function onResize() {
      if (resizeQueued) return;
      resizeQueued = true;
      window.requestAnimationFrame(function () {
        resizeQueued = false;
        if (running) resize();
      });
    }
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    function onPointerMove(event) {
      var rect = section.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      pointer.seen = true;
    }
    function onPointerLeave() {
      pointer.seen = false;
      pointer.x = 0;
      pointer.y = 0;
    }
    section.addEventListener('pointermove', onPointerMove, { passive: true });
    section.addEventListener('pointerleave', onPointerLeave, { passive: true });

    applyProgress(progress);

    return {
      setProgress: function (p) {
        progress = clamp01(p);
        applyProgress(progress);
      },
      refresh: function () {
        if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === 'function') {
          window.ScrollTrigger.refresh();
        }
      },
      dispose: function () {
        stop();
        window.removeEventListener('resize', onResize);
        section.removeEventListener('pointermove', onPointerMove);
        section.removeEventListener('pointerleave', onPointerLeave);
      }
    };
  }


  /* ================================================================
     TRAIL — 2D canvas distance-emitter. Spacing is constant at any
     hand speed: distance accumulates and motes are spent in fixed
     steps, each laid at its own point along the path segment.
     ================================================================ */
  function createTrail(section, canvas) {
    if (!canvas || !canvas.getContext) return null;
    var ctx = canvas.getContext('2d');
    var N = 240;
    var STEP = 9;
    var motes = [];
    var i;
    for (i = 0; i < N; i += 1) {
      motes.push({ x: -100, y: -100, vx: 0, vy: 0, life: 0, size: 1, hue: 0 });
    }
    var cursor = 0;
    var acc = 0;
    var lastX = 0;
    var lastY = 0;
    var hasLast = false;
    var ex = 0;
    var ey = 0;
    var w = 0;
    var h = 0;
    var dpr = 1;
    var running = false;
    var rafId = 0;
    var rand = makeRandom(99);

    function resize() {
      var rect = section.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width || window.innerWidth || 1));
      h = Math.max(1, Math.floor(rect.height || window.innerHeight || 1));
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(x, y) {
      var slot = cursor;
      cursor = (cursor + 1) % N;
      var m = motes[slot];
      var gold = rand() < 0.45;
      m.x = x;
      m.y = y;
      m.vx = (rand() - 0.5) * 0.7;
      m.vy = -0.4 - rand() * 0.9;
      m.life = 1;
      m.size = gold ? 1.6 + rand() * 2.4 : 1 + rand() * 1.8;
      m.hue = gold ? 38 + rand() * 12 : (rand() < 0.5 ? 16 : 340);
    }

    function onMove(event) {
      var rect = canvas.getBoundingClientRect();
      var px = event.clientX - rect.left;
      var py = event.clientY - rect.top;
      if (!hasLast) {
        lastX = px;
        lastY = py;
        ex = px;
        ey = py;
        hasLast = true;
        return;
      }
      // lag the emitter behind the pointer: the slack is the drift
      ex += (px - ex) * 0.35;
      ey += (py - ey) * 0.35;
      var dx = ex - lastX;
      var dy = ey - lastY;
      var moved = Math.sqrt(dx * dx + dy * dy);
      if (moved > 0.001) {
        acc += moved;
        var guard = 0;
        while (acc >= STEP && guard < 14) {
          acc -= STEP;
          guard += 1;
          var t = Math.min(1, (guard * STEP) / moved);
          spawn(lastX + dx * t, lastY + dy * t);
        }
        if (guard >= 14) acc = 0;
        lastX = ex;
        lastY = ey;
      }
    }

    function onLeave() {
      hasLast = false;
      acc = 0;
    }

    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < N; k += 1) {
        var m = motes[k];
        if (m.life <= 0) continue;
        m.life -= 0.012;
        m.x += m.vx + Math.sin(performance.now() * 0.002 + k) * 0.25;
        m.y += m.vy;
        m.vx *= 0.985;
        m.vy *= 0.985;
        var a = Math.max(0, m.life);
        var g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 3);
        g.addColorStop(0, 'hsla(' + m.hue + ', 95%, 72%, ' + (a * 0.9).toFixed(3) + ')');
        g.addColorStop(1, 'hsla(' + m.hue + ', 95%, 60%, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      rafId = window.requestAnimationFrame(tick);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      rafId = window.requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    section.addEventListener('pointermove', onMove, { passive: true });
    section.addEventListener('pointerleave', onLeave, { passive: true });
    if (typeof IntersectionObserver === 'function') {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start();
          else stop();
        });
      }, { threshold: 0 });
      observer.observe(section);
    } else {
      start();
    }
    window.addEventListener('resize', function () { if (running) resize(); }, { passive: true });

    return { start: start, stop: stop };
  }

  /* ================================================================
     TEXT — masked-reveal headline (word masks, GSAP yPercent),
     scrub-lit manifesto, GSAP intro choreography, pinned camera
     flight, ignition storm.
     ================================================================ */
  function armTextReveals(section) {
    var gsap = window.gsap;
    if (!gsap) return;

    var masks = Array.from(section.querySelectorAll('.bday-w'));
    masks.forEach(function (mask) {
      var words = Array.from(mask.querySelectorAll('.bday-wi'));
      if (words.length === 0) return;
      gsap.set(words, { yPercent: 115 });
      gsap.to(words, {
        yPercent: 0,
        duration: 1.2,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: { trigger: mask, start: 'top 86%', toggleActions: 'play none none reverse' }
      });
    });

    gsap.from('.bday-eyebrow', {
      autoAlpha: 0, x: -26, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: section, start: 'top 80%', toggleActions: 'play none none reverse' }
    });

    gsap.from('.bday-sub', {
      autoAlpha: 0, y: 22, duration: 0.9, ease: 'power3.out', delay: 0.15,
      scrollTrigger: { trigger: section, start: 'top 76%', toggleActions: 'play none none reverse' }
    });

    gsap.from('.bday-wish', {
      autoAlpha: 0, y: 34, scale: 0.97, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: '.bday-wish', start: 'top 88%', toggleActions: 'play none none reverse' }
    });

    gsap.from('.bday-keepsake', {
      autoAlpha: 0, y: 44, rotation: 6, duration: 1, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { trigger: '.bday-keepsakes', start: 'top 90%', toggleActions: 'play none none reverse' }
    });

    gsap.from('.bday-cta', {
      autoAlpha: 0, y: 18, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: '.bday-cta', start: 'top 94%', toggleActions: 'play none none reverse' }
    });

    var manifesto = Array.from(section.querySelectorAll('.bday-mw'));
    if (manifesto.length > 0) {
      gsap.set(manifesto, { opacity: 0.14 });
      gsap.to(manifesto, {
        opacity: 1,
        ease: 'none',
        stagger: 0.1,
        scrollTrigger: {
          trigger: section.querySelector('.bday-manifesto') || section,
          start: 'top 70%',
          end: 'bottom 55%',
          scrub: 0.6,
          toggleActions: 'play none none reverse'
        }
      });
    }
  }

  function playIntro(section) {
    var gsap = window.gsap;
    if (!gsap) return;
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.bday-corner', { scale: 0, duration: 0.7 }, 0)
      .from('.bday-marker', { autoAlpha: 0, x: 18, duration: 0.7 }, 0.1)
      .from('.bday-rails span', { scaleY: 0, transformOrigin: 'top', duration: 1.1, stagger: 0.1 }, 0)
      .from('.bday-ticker', { yPercent: 100, duration: 0.9 }, 0.2);
  }

  function ignite(section) {
    var burstEl = section.querySelector('#bday-burst');
    if (burstEl) {
      burstEl.classList.remove('is-lit');
      void burstEl.offsetWidth;
      burstEl.classList.add('is-lit');
    }
    if (window.Motion && typeof window.Motion.birthdayStorm === 'function') {
      window.setTimeout(function () { window.Motion.birthdayStorm(); }, 350);
    } else if (window.Motion && typeof window.Motion.fireworks === 'function') {
      window.setTimeout(function () { window.Motion.fireworks(); }, 350);
    }
  }

  function boot() {
    if (booted) return;
    var section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected) {
      window.setTimeout(boot, 120);
      return;
    }
    if (!hasVendors()) {
      bootTries += 1;
      window.setTimeout(boot, 60);
      return;
    }

    var globeCanvas = section.querySelector(STAGE_SELECTOR);
    var trailCanvas = section.querySelector(TRAIL_SELECTOR);
    if (!globeCanvas || !trailCanvas) return;

    booted = true;
    document.documentElement.classList.add('js-birthday');

    var stage = createStage(section, globeCanvas, trailCanvas);
    if (!stage) {
      var gc = section.querySelector(STAGE_SELECTOR);
      var tc = section.querySelector(TRAIL_SELECTOR);
      if (gc) gc.style.display = 'none';
      if (tc) tc.style.display = 'none';
      armTextReveals(section);
      playIntro(section);
      return;
    }
    createTrail(section, trailCanvas);

    armTextReveals(section);
    playIntro(section);

    window.gsap.registerPlugin(window.ScrollTrigger);
    window.ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=180%',
      pin: true,
      pinSpacing: true,
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        stage.setProgress(self.progress);
      }
    });

    // ignition: when the hero first takes the viewport, light the sky
    var fired = false;
    window.ScrollTrigger.create({
      trigger: section,
      start: 'top 70%',
      end: 'bottom top',
      onEnter: function () {
        if (!fired) {
          fired = true;
          ignite(section);
        }
      }
    });

    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(function () { stage.refresh(); }).catch(function () {});
    }
    window.addEventListener('load', function () { stage.refresh(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
