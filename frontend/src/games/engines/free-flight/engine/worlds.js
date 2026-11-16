import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glowTexture } from './ship.js';
import { createOcean } from './ocean/ocean.js';

// ---------- helpers ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic per-position hash, so shared seam vertices move together when jittered.
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function jitter(geo, amount, axes = [1, 1, 1]) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = (v) => Math.round(v * 1000) / 1000;
    const h1 = hash3(k(x), k(y), k(z)) - 0.5;
    const h2 = hash3(k(z), k(x), k(y)) - 0.5;
    const h3 = hash3(k(y), k(z), k(x)) - 0.5;
    p.setXYZ(i, x + h1 * amount * axes[0], y + h2 * amount * axes[1], z + h3 * amount * axes[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

function paint(src, color) {
  const geo = src.index ? src.toNonIndexed() : src; // merge needs all-or-none indexed
  if (geo !== src) src.dispose();
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  return geo;
}

// Keep objects in a box of half-size H centred on the player, wrapping around
// like a torus, so the world feels endless without generating new objects.
function wrapInto(out, base, center, H) {
  const w = (v, c) => c + ((((v - c + H) % (2 * H)) + 2 * H) % (2 * H)) - H;
  out.set(w(base.x, center.x), w(base.y, center.y), w(base.z, center.z));
  return out;
}

// =====================================================================
// SKY: sunset over an endless ocean, floating islands and drifting clouds
// =====================================================================
export function createSkyWorld() {
  const root = new THREE.Group();
  const R = rng(1337);

  const sky = new Sky();
  sky.scale.setScalar(10000);
  const su = sky.material.uniforms;
  su.turbidity.value = 4;
  su.rayleigh.value = 3;
  su.mieCoefficient.value = 0.006;
  su.mieDirectionalG.value = 0.86;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 8), THREE.MathUtils.degToRad(195));
  su.sunPosition.value.copy(sunDir);
  root.add(sky);

  root.add(new THREE.HemisphereLight(0xffe0c4, 0x34507a, 1.4));
  const sun = new THREE.DirectionalLight(0xffc896, 2.6);
  sun.position.copy(sunDir).multiplyScalar(1000);
  root.add(sun);

  const fogColor = new THREE.Color(0xe9b493);
  const FAR = 3700; // fog fully closes here, and wrapped objects beyond it are hidden
  const fog = new THREE.Fog(fogColor, 700, FAR);

  // --- ocean: Gerstner waves reflecting a cube map of this sky ---
  const ocean = createOcean({ sky, sunDir });
  root.add(ocean.mesh);

  // --- floating islands ---
  const islandMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
  const islands = [];
  const H = 4200;
  for (let i = 0; i < 70; i++) {
    const r = 40 + R() * R() * 170;
    const depth = r * (1.3 + R() * 1.1);
    const parts = [];
    const rock = new THREE.ConeGeometry(r, depth, 9, 4);
    rock.rotateX(Math.PI);
    rock.translate(0, -depth / 2, 0);
    jitter(rock, r * 0.35);
    parts.push(paint(rock, R() > 0.5 ? 0x7a5a48 : 0x6c625c));

    const top = new THREE.CylinderGeometry(r * 1.04, r * 1.0, r * 0.14, 9, 1);
    top.translate(0, r * 0.05, 0);
    jitter(top, r * 0.12, [1, 0.4, 1]);
    parts.push(paint(top, R() > 0.3 ? 0x6fae4a : 0x9cbf5a));

    const trees = Math.floor(r / 22 + R() * 4);
    for (let t = 0; t < trees; t++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * 0.75;
      const th = 10 + R() * 22;
      const x = Math.cos(a) * d, z = Math.sin(a) * d, y = r * 0.12;
      const trunk = new THREE.CylinderGeometry(0.9, 1.3, th * 0.35, 5);
      trunk.translate(x, y + th * 0.17, z);
      parts.push(paint(trunk, 0x5b3a26));
      const crown = new THREE.ConeGeometry(th * 0.32, th, 6);
      crown.translate(x, y + th * 0.3 + th * 0.5, z);
      parts.push(paint(crown, R() > 0.5 ? 0x2f6d3a : 0x3f7f35));
    }
    if (R() > 0.6) { // a boulder or two
      const b = new THREE.IcosahedronGeometry(r * 0.12 + 3, 0);
      jitter(b, r * 0.05);
      const a = R() * Math.PI * 2;
      b.translate(Math.cos(a) * r * 0.5, r * 0.15, Math.sin(a) * r * 0.5);
      parts.push(paint(b, 0x8d8580));
    }
    const mesh = new THREE.Mesh(mergeGeometries(parts), islandMat);
    mesh.rotation.y = R() * Math.PI * 2;
    mesh.userData.base = new THREE.Vector3((R() * 2 - 1) * H, 160 + R() * 900, (R() * 2 - 1) * H);
    mesh.userData.bob = R() * Math.PI * 2;
    parts.forEach((g) => g.dispose());
    islands.push(mesh);
    root.add(mesh);
  }

  // --- clouds ---
  const cloudTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const r2 = rng(7);
    for (let i = 0; i < 22; i++) {
      const x = 70 + r2() * 116, y = 80 + r2() * 96, rad = 30 + r2() * 60;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,0.55)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const cloudMats = [0xffffff, 0xffe9dc, 0xffd6c2, 0xf3d9e8].map(
    (col) => new THREE.SpriteMaterial({ map: cloudTex, color: col, transparent: true, opacity: 0.92, depthWrite: false, fog: true })
  );
  const clouds = [];
  for (let i = 0; i < 95; i++) {
    const g = new THREE.Group();
    const size = 90 + R() * 260;
    const puffs = 5 + Math.floor(R() * 6);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Sprite(cloudMats[Math.floor(R() * cloudMats.length)]);
      const sc = size * (0.6 + R() * 0.7);
      s.scale.set(sc * 1.6, sc, 1);
      s.position.set((R() - 0.5) * size * 2.2, (R() - 0.5) * size * 0.35, (R() - 0.5) * size * 1.2);
      g.add(s);
    }
    g.userData.base = new THREE.Vector3((R() * 2 - 1) * H, 260 + R() * 1300, (R() * 2 - 1) * H);
    g.userData.drift = 2 + R() * 4;
    clouds.push(g);
    root.add(g);
  }

  const tmp = new THREE.Vector3();
  return {
    id: 'sky',
    name: 'Sunset Sky',
    root,
    fog,
    background: null,
    exposure: 0.55,
    lineColor: 0xffffff,
    floor: 12, // waves reach about ±6 m
    environment: ocean.envMap,
    init(renderer) { ocean.init(renderer); },
    ceiling: 2600,
    spawn: new THREE.Vector3(0, 420, 0),
    colliders: [],
    update(dt, t, camPos, shipPos) {
      sky.position.copy(camPos);
      ocean.update(t, camPos);
      for (const m of islands) {
        wrapInto(tmp, m.userData.base, shipPos, H);
        m.position.set(tmp.x, m.userData.base.y + Math.sin(t * 0.25 + m.userData.bob) * 4, tmp.z);
        m.visible = m.position.distanceTo(camPos) < FAR;
      }
      for (const c of clouds) {
        c.userData.base.x += c.userData.drift * dt;
        wrapInto(tmp, c.userData.base, shipPos, H);
        c.position.set(tmp.x, c.userData.base.y, tmp.z);
        c.visible = c.position.distanceTo(camPos) < FAR;
      }
    },
  };
}

// =====================================================================
// SPACE: nebula, starfield, planets and an endless drifting asteroid field
// =====================================================================
function planetTexture(seed, palette, bands = true) {
  const R = rng(seed);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  if (bands) {
    let y = 0;
    while (y < 256) {
      const h = 4 + R() * 22;
      g.fillStyle = palette[Math.floor(R() * palette.length)];
      g.fillRect(0, y, 512, h + 1);
      y += h;
    }
    g.globalAlpha = 0.25;
    for (let i = 0; i < 60; i++) {
      g.fillStyle = palette[Math.floor(R() * palette.length)];
      g.fillRect(0, R() * 256, 512, 1 + R() * 3);
    }
    g.globalAlpha = 0.5;
    g.fillStyle = palette[0];
    g.beginPath(); g.ellipse(170, 160, 30, 14, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = palette[0];
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 900; i++) {
      g.globalAlpha = 0.15 + R() * 0.3;
      g.fillStyle = palette[1 + Math.floor(R() * (palette.length - 1))];
      const r = 2 + R() * R() * 28;
      g.beginPath(); g.arc(R() * 512, R() * 256, r, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSpaceWorld() {
  const root = new THREE.Group();
  const R = rng(4242);

  // --- nebula backdrop ---
  const nebula = new THREE.Mesh(
    new THREE.SphereGeometry(9500, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float n(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
        void main() {
          vec3 d = normalize(vDir);
          float band = exp(-pow(dot(d, normalize(vec3(0.3, 1.0, 0.2))) * 2.6, 2.0));
          float f = fbm(d * 3.0 + 1.7);
          float g = fbm(d * 5.5 - 3.1);
          vec3 col = vec3(0.004, 0.006, 0.02);
          col += vec3(0.32, 0.08, 0.45) * pow(f, 2.6) * (0.35 + band * 1.6);
          col += vec3(0.02, 0.28, 0.42) * pow(g, 3.2) * (0.25 + band * 1.4);
          col += vec3(0.6, 0.25, 0.3) * pow(max(f * g * 1.9 - 0.5, 0.0), 2.0) * band;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  );
  root.add(nebula);

  // --- stars ---
  const starCount = 7000;
  const sp = new Float32Array(starCount * 3);
  const sc = new Float32Array(starCount * 3);
  const tint = [new THREE.Color(0xffffff), new THREE.Color(0xbfd6ff), new THREE.Color(0xffe2b8), new THREE.Color(0xffc4c4)];
  const v = new THREE.Vector3();
  for (let i = 0; i < starCount; i++) {
    v.randomDirection().multiplyScalar(8800);
    sp.set([v.x, v.y, v.z], i * 3);
    const c = tint[Math.floor(R() * tint.length)].clone().multiplyScalar(0.4 + R() * R() * 1.6);
    sc.set([c.r, c.g, c.b], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 3, sizeAttenuation: false, vertexColors: true, map: glowTexture(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  }));
  root.add(stars);

  // --- star (sun) ---
  const sunDir = new THREE.Vector3(0.6, 0.25, -0.75).normalize();
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,200,1)', 'rgba(255,140,60,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sunGlow.scale.setScalar(2600);
  root.add(sunGlow);
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sunCore.scale.setScalar(700);
  root.add(sunCore);
  const light = new THREE.DirectionalLight(0xfff0dd, 3.2);
  light.position.copy(sunDir).multiplyScalar(1000);
  root.add(light);
  root.add(new THREE.AmbientLight(0x404a78, 0.55));

  // --- planets (fixed in space) ---
  const colliders = [];
  const addPlanet = (pos, r, tex, opts = {}) => {
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, fog: false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), mat);
    m.position.copy(pos);
    m.rotation.z = opts.tilt || 0;
    root.add(m);
    // thin atmosphere rim
    if (opts.atmo) {
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.06, 48, 32),
        new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, fog: false,
          uniforms: { uColor: { value: new THREE.Color(opts.atmo) } },
          vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
          fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float i = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uColor * i * 1.4, i); }`,
        })
      );
      atmo.position.copy(pos);
      root.add(atmo);
    }
    if (opts.ring) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 8;
      const g = c.getContext('2d');
      const r2 = rng(99);
      for (let x = 0; x < 512; x++) {
        const a = (0.15 + r2() * 0.55) * (x < 40 ? x / 40 : 1) * (x > 470 ? (512 - x) / 42 : 1);
        g.fillStyle = `rgba(${210 + r2() * 40},${180 + r2() * 40},${150 + r2() * 30},${a})`;
        g.fillRect(x, 0, 1, 8);
      }
      const rt = new THREE.CanvasTexture(c);
      rt.colorSpace = THREE.SRGBColorSpace;
      const ringGeo = new THREE.RingGeometry(r * 1.35, r * 2.3, 128, 1);
      // map u along the radius
      const pos2 = ringGeo.attributes.position, uv = ringGeo.attributes.uv;
      for (let i = 0; i < pos2.count; i++) {
        const d = Math.hypot(pos2.getX(i), pos2.getY(i));
        uv.setXY(i, (d - r * 1.35) / (r * 0.95), 0.5);
      }
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, roughness: 1 }));
      ring.position.copy(pos);
      ring.rotation.x = -Math.PI / 2 + 0.35;
      ring.rotation.y = 0.2;
      root.add(ring);
    }
    colliders.push({ center: pos.clone(), r: r * 1.03 });
    return m;
  };
  const giant = addPlanet(new THREE.Vector3(-2600, -700, -6200), 1700,
    planetTexture(1, ['#d9a066', '#b97a4a', '#e8c79a', '#9c5f3a', '#f1dcb8']), { ring: true, tilt: 0.3, atmo: 0xffc58a });
  const ice = addPlanet(new THREE.Vector3(3800, 1100, -2400), 520,
    planetTexture(2, ['#6fb7e8', '#a9dcf7', '#3d7fb8', '#e6f6ff']), { atmo: 0x7fd0ff, tilt: -0.2 });
  const rock = addPlanet(new THREE.Vector3(1400, -2200, 3600), 380,
    planetTexture(3, ['#8a4b3a', '#5b2e25', '#b06a4e', '#3e1f1a'], false), {});

  // --- asteroid field (instanced, wraps around the player) ---
  const AH = 1600;
  const count = 520;
  const aGeo = jitter(new THREE.IcosahedronGeometry(1, 1), 0.45);
  const aMat = new THREE.MeshStandardMaterial({ color: 0x8d7f74, roughness: 0.95, metalness: 0.05, flatShading: true });
  const asteroids = new THREE.InstancedMesh(aGeo, aMat, count);
  asteroids.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const aData = [];
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const s = 2 + R() * R() * R() * 60;
    aData.push({
      base: new THREE.Vector3((R() * 2 - 1) * AH, (R() * 2 - 1) * AH, (R() * 2 - 1) * AH),
      axis: new THREE.Vector3().randomDirection(),
      spin: (R() - 0.5) * 0.8,
      phase: R() * 6,
      scale: new THREE.Vector3(s * (0.7 + R() * 0.6), s * (0.6 + R() * 0.5), s * (0.7 + R() * 0.6)),
      drift: new THREE.Vector3((R() - 0.5) * 3, (R() - 0.5) * 3, (R() - 0.5) * 3),
    });
    col.setHSL(0.06 + R() * 0.05, 0.15 + R() * 0.2, 0.35 + R() * 0.3);
    asteroids.setColorAt(i, col);
  }
  root.add(asteroids);

  const fog = new THREE.Fog(0x05060f, 900, AH * 0.97);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3();

  return {
    id: 'space',
    name: 'Deep Space',
    root,
    fog,
    background: new THREE.Color(0x05060f),
    exposure: 1.0,
    lineColor: 0xa9c8ff,
    floor: null,
    ceiling: null,
    spawn: new THREE.Vector3(0, 0, 400),
    colliders,
    update(dt, t, camPos, shipPos) {
      nebula.position.copy(camPos);
      stars.position.copy(camPos);
      sunGlow.position.copy(camPos).addScaledVector(sunDir, 8000);
      sunCore.position.copy(sunGlow.position);
      giant.rotation.y += dt * 0.01;
      ice.rotation.y += dt * 0.02;
      rock.rotation.y += dt * 0.015;
      for (let i = 0; i < count; i++) {
        const a = aData[i];
        a.base.addScaledVector(a.drift, dt);
        wrapInto(p, a.base, shipPos, AH);
        q.setFromAxisAngle(a.axis, a.phase + t * a.spin);
        m4.compose(p, q, a.scale);
        asteroids.setMatrixAt(i, m4);
      }
      asteroids.instanceMatrix.needsUpdate = true;
    },
  };
}

export const WORLDS = [
  { id: 'sky', name: 'Sunset Sky', create: createSkyWorld },
  { id: 'space', name: 'Deep Space', create: createSpaceWorld },
];
