// Free Fly engine, copied from gyro_games/free-fly (plain three.js, no React). Types are in FlyGame.d.ts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createShip } from './ship.js';

// ---- Flight tuning ------------------------------------------------------
const CRUISE = 42; // m/s
const BOOST = 115;
const TURN = 1.05; // rad/s at full bank
const PITCH = 0.85; // rad/s at full tilt
const PITCH_MAX = 1.15;
const SKY_FLOOR = 8; // just above the cloud sea
const SKY_CEIL = 1400;

// ---- World tuning -------------------------------------------------------
// Objects live in a tile that repeats around the player, so the world never ends.
const SKY_TILE = 3200; // islands and clouds; fog hides the wrap seam (fog far < half a tile)
const ROCK_TILE = 1800; // asteroids (3D); they shrink to nothing at the tile edge
const DUST_TILE = 180;
const N_ISLANDS = 64;
const N_CLOUDS = 70;
const PUFFS = 6;
const N_ROCKS = 280;
const N_DUST = 1000;
const FOG_NEAR = 300;
const FOG_FAR = 1500;

const SCENES = ['sky', 'space'];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (v, c, s) => v - s * Math.round((v - c) / s);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

const NOISE_GLSL = /* glsl */ `
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;

const DOME_VERT = /* glsl */ `varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const OUTPUT = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Paints each triangle one colour (low-poly look). `fn(color, faceIndex, centroidY)` */
function paintFaces(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < pos.count / 3; f++) {
    const cy = (pos.getY(f * 3) + pos.getY(f * 3 + 1) + pos.getY(f * 3 + 2)) / 3;
    fn(c, f, cy);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f * 3 + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Jitter vertices by their position, so shared corners move together and the mesh stays closed. */
function jitter(geo, amount, keep = () => false) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const kx = Math.round(x * 1000), ky = Math.round(y * 1000), kz = Math.round(z * 1000);
    const s = 1 + (hash3(kx, ky, kz) - 0.5) * amount;
    if (keep(x, y, z)) pos.setXYZ(i, x * s, y, z * s);
    else pos.setXYZ(i, x * s, y + (hash3(kz, kx, ky) - 0.5) * amount * 0.5, z * s);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A floating island: jagged rock cone, grassy top, a few trees. Top surface at y = 0.16, radius ~1. */
function islandGeometry() {
  const rock = new THREE.ConeGeometry(1, 1.7, 9, 4);
  rock.rotateX(Math.PI);
  rock.translate(0, -0.85, 0);
  jitter(rock, 0.32, (x, y) => Math.abs(y) < 1e-3);
  const brownA = new THREE.Color(0x5b3d2a), brownB = new THREE.Color(0x8c6545);
  const rockP = paintFaces(rock, (c, f, cy) =>
    c.copy(brownA).lerp(brownB, hash3(f, 1, 7) * 0.7).multiplyScalar(0.75 + 0.35 * clamp(1 + cy / 1.7, 0, 1))
  );

  const grass = new THREE.CylinderGeometry(1.08, 1.02, 0.16, 9, 1);
  grass.translate(0, 0.08, 0);
  const gTop = new THREE.Color(0x67b04a), gSide = new THREE.Color(0x46803a);
  const grassP = paintFaces(grass, (c, f, cy) => (cy > 0.15 ? c.copy(gTop).offsetHSL(0, 0, (hash3(f, 3, 1) - 0.5) * 0.06) : c.copy(gSide)));

  const parts = [rockP, grassP];
  const treeA = new THREE.Color(0x2c6a33), treeB = new THREE.Color(0x3d8a3f);
  const spots = [[0.45, 0.1], [-0.3, 0.42], [-0.15, -0.5], [0.6, -0.35], [0.05, 0.62]];
  spots.forEach(([x, z], i) => {
    const h = 0.32 + (i % 3) * 0.08;
    const tree = new THREE.ConeGeometry(0.11, h, 5);
    tree.translate(x, 0.16 + h / 2, z);
    parts.push(paintFaces(tree, (c, f) => c.copy(i % 2 ? treeA : treeB).offsetHSL(0, 0, hash3(f, i, 2) * 0.05)));
  });
  for (const p of parts) p.deleteAttribute('uv');
  return mergeGeometries(parts);
}

function asteroidGeometry() {
  const g = new THREE.DodecahedronGeometry(1, 1);
  return jitter(g, 0.45);
}

export class FlyGame {
  constructor(container, { onHud } = {}) {
    this.container = container;
    this.onHud = onHud || (() => {});

    this.mode = 'menu'; // menu | playing
    this.paused = false;
    this.time = 0;
    this.sceneName = 'sky';

    this.keys = { left: 0, right: 0, up: 0, down: 0, boost: 0 };
    this.touch = { x: 0, y: 0, active: false };
    this.tilt = { enabled: false, x: 0, y: 0, neutral: null };
    this.remote = { x: 0, y: 0, boost: false, at: 0 };

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._v = new THREE.Vector3();
    this._f = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();

    this._initRenderer();
    this._initScene();
    this._bindEvents();
    this.setScene('sky');
    this.reset();

    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop);
  }

  // ---------------------------------------------------------------------
  _initRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(this.container.clientWidth, this.container.clientHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    this.container.appendChild(r.domElement);
    this.renderer = r;
  }

  _initScene() {
    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(62, this.container.clientWidth / this.container.clientHeight, 0.1, 5000);
    this.camOff = new THREE.Vector3(0, 2.8, 10.5);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    scene.add(this.hemi, this.sun);

    this.glowTex = glowTexture();
    this._initSky();
    this._initSpace();
    this._initDust();

    this.ship = createShip({ glow: 0x5ad1ff });
    scene.add(this.ship.group);
    this.pos = new THREE.Vector3();
  }

  // ---- Sky: floating islands over a sea of clouds -----------------------
  _initSky() {
    const g = new THREE.Group();
    this.skyGroup = g;
    this.scene.add(g);

    this.skyCfg = {
      zenith: new THREE.Color(0x2f6fd0),
      horizon: new THREE.Color(0xcfe2f4),
      sunCol: new THREE.Color(0xfff1d2),
      sunDir: new THREE.Vector3(0.35, 0.3, -1).normalize(),
    };
    this.skyFog = new THREE.Fog(this.skyCfg.horizon, FOG_NEAR, FOG_FAR);

    const c = this.skyCfg;
    this.skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(2400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { zenith: { value: c.zenith }, horizon: { value: c.horizon }, sunCol: { value: c.sunCol }, sunDir: { value: c.sunDir } },
        vertexShader: DOME_VERT,
        fragmentShader: /* glsl */ `uniform vec3 zenith, horizon, sunCol, sunDir; varying vec3 vDir;
          void main(){
            vec3 d = normalize(vDir);
            float h = clamp(d.y, 0.0, 1.0);
            vec3 col = mix(horizon, zenith, pow(h, 0.45));
            float s = max(dot(d, sunDir), 0.0);
            col += sunCol * (pow(s, 900.0) * 4.0 + pow(s, 14.0) * 0.35 + pow(s, 3.0) * 0.08);
            gl_FragColor = vec4(col, 1.0);
            ${OUTPUT}
          }`,
      })
    );
    this.skyDome.renderOrder = -1;
    g.add(this.skyDome);

    // Cloud sea: a big plane that follows the player, shaded with drifting noise in world space
    this.sea = new THREE.Mesh(
      new THREE.PlaneGeometry(8000, 8000),
      new THREE.ShaderMaterial({
        fog: false,
        uniforms: {
          time: { value: 0 },
          horizon: { value: c.horizon },
          shade: { value: new THREE.Color(0x8ea6c8) },
          lit: { value: new THREE.Color(0xffffff) },
          warm: { value: new THREE.Color(0xffe6c0) },
          sunDir: { value: c.sunDir },
          fogNear: { value: FOG_NEAR * 0.6 },
          fogFar: { value: FOG_FAR * 1.1 },
        },
        vertexShader: /* glsl */ `varying vec3 vW;
          void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `uniform float time, fogNear, fogFar; uniform vec3 horizon, shade, lit, warm, sunDir; varying vec3 vW;
          ${NOISE_GLSL}
          void main(){
            vec2 p = vW.xz;
            float n = fbm(vec3(p * 0.0035 + vec2(time * 0.006, 0.0), time * 0.01));
            float n2 = fbm(vec3(p * 0.014 - vec2(0.0, time * 0.02), 3.0));
            float h = n * 0.72 + n2 * 0.28;
            vec3 col = mix(shade, lit, smoothstep(0.32, 0.72, h));
            vec3 toCam = normalize(cameraPosition - vW);
            col = mix(col, warm, pow(max(dot(-toCam, sunDir), 0.0), 6.0) * 0.5);
            float f = smoothstep(fogNear, fogFar, distance(vW.xz, cameraPosition.xz));
            gl_FragColor = vec4(mix(col, horizon, f), 1.0);
            ${OUTPUT}
          }`,
      })
    );
    this.sea.rotation.x = -Math.PI / 2;
    g.add(this.sea);

    // Floating islands
    this.islands = Array.from({ length: N_ISLANDS }, () => ({
      x: rand(-SKY_TILE / 2, SKY_TILE / 2),
      y: rand(60, 520),
      z: rand(-SKY_TILE / 2, SKY_TILE / 2),
      r: rand(16, 70),
      sy: rand(0.8, 1.5),
      ry: rand(0, Math.PI * 2),
      wx: 0, wz: 0,
    }));
    this.islandMesh = new THREE.InstancedMesh(
      islandGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      N_ISLANDS
    );
    this.islandMesh.frustumCulled = false;
    g.add(this.islandMesh);

    // Puffy low-poly clouds (clusters of icospheres)
    this.clouds = Array.from({ length: N_CLOUDS }, () => {
      const size = rand(14, 42);
      return {
        x: rand(-SKY_TILE / 2, SKY_TILE / 2),
        y: rand(40, 600),
        z: rand(-SKY_TILE / 2, SKY_TILE / 2),
        puffs: Array.from({ length: PUFFS }, (_, i) => ({
          x: (i === 0 ? 0 : rand(-1.6, 1.6)) * size,
          y: rand(-0.15, 0.35) * size,
          z: rand(-0.6, 0.6) * size,
          s: (i === 0 ? 1 : rand(0.45, 0.85)) * size,
          r: rand(0, 6),
        })),
      };
    });
    this.cloudMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x9aa8bf, emissiveIntensity: 0.45 }),
      N_CLOUDS * PUFFS
    );
    this.cloudMesh.frustumCulled = false;
    g.add(this.cloudMesh);
  }

  // ---- Space: nebula, planets, asteroid field ---------------------------
  _initSpace() {
    const g = new THREE.Group();
    this.spaceGroup = g;
    this.scene.add(g);

    const sunDir = new THREE.Vector3(0.85, 0.25, -0.45).normalize();
    this.spaceCfg = { sunDir };

    // Everything in the backdrop rides along with the camera, so it stays at "infinity".
    this.backdrop = new THREE.Group();
    g.add(this.backdrop);

    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(2400, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          base: { value: new THREE.Color(0x05060f) },
          neb1: { value: new THREE.Color(0x7a3cb8) },
          neb2: { value: new THREE.Color(0x1f8fb0) },
          sunCol: { value: new THREE.Color(0xffd9a8) },
          sunDir: { value: sunDir },
        },
        vertexShader: DOME_VERT,
        fragmentShader: /* glsl */ `uniform vec3 base, neb1, neb2, sunCol, sunDir; varying vec3 vDir;
          ${NOISE_GLSL}
          void main(){
            vec3 d = normalize(vDir);
            float n = fbm(d * 2.2 + 3.0);
            float m = fbm(d * 4.0 - 7.0);
            float band = exp(-pow(d.y * 2.2 + d.x * 0.6, 2.0));
            vec3 col = base;
            col += neb1 * pow(smoothstep(0.38, 0.9, n), 2.0) * (0.35 + 0.9 * band);
            col += neb2 * pow(smoothstep(0.45, 0.95, m), 2.4) * (0.25 + 0.7 * band);
            col += sunCol * pow(max(dot(d, sunDir), 0.0), 30.0) * 0.45;
            gl_FragColor = vec4(col, 1.0);
            ${OUTPUT}
          }`,
      })
    );
    nebula.renderOrder = -2;
    this.backdrop.add(nebula);

    // Stars: two layers, small and a few bright ones
    const starLayer = (count, size, opacity) => {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const v = new THREE.Vector3();
      const tint = [new THREE.Color(0xffffff), new THREE.Color(0xbcd4ff), new THREE.Color(0xffe1b8)];
      for (let i = 0; i < count; i++) {
        v.randomDirection().multiplyScalar(2300);
        pos.set([v.x, v.y, v.z], i * 3);
        const c = tint[i % 3];
        col.set([c.r, c.g, c.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity, depthWrite: false, fog: false })
      );
      pts.renderOrder = -1;
      return pts;
    };
    this.backdrop.add(starLayer(4500, 1.6, 0.85), starLayer(350, 3, 1));

    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTex, color: 0xfff0d0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    sunSprite.position.copy(sunDir).multiplyScalar(2000);
    sunSprite.scale.setScalar(420);
    this.backdrop.add(sunSprite);

    // Planets
    const planetMat = (a, b, c, atmo, freq, seed) =>
      new THREE.ShaderMaterial({
        fog: false,
        uniforms: {
          colA: { value: new THREE.Color(a) }, colB: { value: new THREE.Color(b) }, colC: { value: new THREE.Color(c) },
          atmo: { value: new THREE.Color(atmo) }, sunDir: { value: sunDir }, freq: { value: freq }, seed: { value: seed },
        },
        vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vObj; varying vec3 vW;
          void main(){ vObj = normalize(position); vN = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `uniform vec3 colA, colB, colC, atmo, sunDir; uniform float freq, seed;
          varying vec3 vN; varying vec3 vObj; varying vec3 vW;
          ${NOISE_GLSL}
          void main(){
            vec3 n = normalize(vN);
            float w = fbm(vObj * 3.0 + seed);
            float b = sin(vObj.y * freq + w * 5.0) * 0.5 + 0.5;
            vec3 col = mix(colA, colB, b);
            col = mix(col, colC, smoothstep(0.55, 0.85, fbm(vObj * 7.0 + seed * 2.0)));
            float l = max(dot(n, sunDir), 0.0);
            float rim = pow(1.0 - max(dot(n, normalize(cameraPosition - vW)), 0.0), 3.0);
            col = col * (0.03 + l * 1.15) + atmo * rim * (0.08 + l * 0.9);
            gl_FragColor = vec4(col, 1.0);
            ${OUTPUT}
          }`,
      });

    const addPlanet = (dir, dist, radius, mat) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), mat);
      m.position.copy(dir).normalize().multiplyScalar(dist);
      this.backdrop.add(m);
      return m;
    };
    const giant = addPlanet(new THREE.Vector3(-0.62, 0.12, -0.78), 1750, 330, planetMat(0xc9935a, 0x7a4a2c, 0xf0d2a0, 0xffc890, 14, 1.3));
    giant.rotation.z = 0.35;
    addPlanet(new THREE.Vector3(0.72, 0.4, -0.58), 1550, 110, planetMat(0x6fd3d8, 0x2f7f9c, 0xf2ffff, 0x9ff0ff, 6, 4.1));
    addPlanet(new THREE.Vector3(0.15, -0.2, 0.97), 1500, 70, planetMat(0x9c4a3a, 0x5a2a22, 0xd08a60, 0xff8a60, 3, 7.7));

    // Ring around the giant
    const inner = 430, outer = 700;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 160, 1),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        uniforms: { inner: { value: inner }, outer: { value: outer }, colA: { value: new THREE.Color(0xe8cfa6) }, colB: { value: new THREE.Color(0x8a6a4a) } },
        vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `uniform float inner, outer; uniform vec3 colA, colB; varying vec2 vP;
          void main(){
            float t = (length(vP) - inner) / (outer - inner);
            float bands = 0.55 + 0.45 * sin(t * 70.0) * sin(t * 23.0 + 1.3);
            float a = bands * smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.85, t) * (t > 0.62 && t < 0.67 ? 0.15 : 1.0);
            gl_FragColor = vec4(mix(colA, colB, t) * 0.9, a * 0.75);
            ${OUTPUT}
          }`,
      })
    );
    ring.position.copy(giant.position);
    ring.rotation.set(Math.PI / 2 - 0.35, 0.2, 0);
    this.backdrop.add(ring);

    // Asteroid field
    this.rocks = Array.from({ length: N_ROCKS }, () => ({
      x: rand(-ROCK_TILE / 2, ROCK_TILE / 2),
      y: rand(-ROCK_TILE / 2, ROCK_TILE / 2),
      z: rand(-ROCK_TILE / 2, ROCK_TILE / 2),
      s: Math.random() < 0.12 ? rand(22, 48) : rand(2.5, 14),
      rx: rand(0, 6), ry: rand(0, 6),
      spin: rand(-0.5, 0.5),
      wx: 0, wy: 0, wz: 0, ws: 0,
    }));
    this.rockMesh = new THREE.InstancedMesh(
      asteroidGeometry(),
      new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0.05 }),
      N_ROCKS
    );
    this.rockMesh.frustumCulled = false;
    for (let i = 0; i < N_ROCKS; i++) {
      this.rockMesh.setColorAt(i, this._color.setHSL(rand(0.05, 0.1), rand(0.08, 0.2), rand(0.22, 0.4)));
    }
    g.add(this.rockMesh);
  }

  // Speed dust: specks around the camera that make motion readable in open air or space
  _initDust() {
    this.dustBase = new Float32Array(N_DUST * 3);
    for (let i = 0; i < N_DUST * 3; i++) this.dustBase[i] = rand(-DUST_TILE / 2, DUST_TILE / 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_DUST * 3), 3));
    this.dust = new THREE.Points(
      geo,
      // round soft specks (a square point up close looks like a grey box)
      new THREE.PointsMaterial({ size: 0.3, map: this.glowTex, color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  // ---------------------------------------------------------------------
  _bindEvents() {
    this._onResize = () => {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    const map = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      ShiftLeft: 'boost', ShiftRight: 'boost',
    };
    this._onKeyDown = (e) => {
      if (map[e.code]) { this.keys[map[e.code]] = 1; e.preventDefault(); }
      if ((e.code === 'KeyP' || e.code === 'Escape') && this.mode === 'playing') this.togglePause();
    };
    this._onKeyUp = (e) => { if (map[e.code]) this.keys[map[e.code]] = 0; };
    this._onBlur = () => { for (const k in this.keys) this.keys[k] = 0; this.touchBoost = false; };

    const el = this.renderer.domElement;
    this._onPointer = (e) => {
      if (e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'pointerleave') {
        this.touch.active = false; this.touch.x = 0; this.touch.y = 0; return;
      }
      if (e.type === 'pointerdown') this.touch.active = true;
      if (!this.touch.active) return;
      const w = el.clientWidth, h = el.clientHeight;
      this.touch.x = clamp((e.clientX - w / 2) / (w * 0.28), -1, 1);
      this.touch.y = clamp(-(e.clientY - h * 0.55) / (h * 0.3), -1, 1);
    };
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave'].forEach((t) =>
      el.addEventListener(t, this._onPointer)
    );

    this._onVisibility = () => { if (document.hidden && this.mode === 'playing' && !this.paused) this.togglePause(); };

    window.addEventListener('resize', this._onResize);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onVisibility);

    this._onOrient = (e) => {
      if (e.gamma == null || e.beta == null) return;
      const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
      let lr, fb;
      if (angle === 90) { lr = e.beta; fb = -e.gamma; }
      else if (angle === -90 || angle === 270) { lr = -e.beta; fb = e.gamma; }
      else { lr = e.gamma; fb = e.beta; }
      if (!this.tilt.neutral) this.tilt.neutral = { lr, fb };
      this.tilt.x = clamp((lr - this.tilt.neutral.lr) / 22, -1, 1);
      this.tilt.y = clamp((this.tilt.neutral.fb - fb) / 22, -1, 1);
    };
  }

  /** Must be called from a user gesture on iOS. */
  async enableTilt() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return false;
      }
    } catch {
      return false;
    }
    if (!this.tilt.enabled) window.addEventListener('deviceorientation', this._onOrient);
    this.tilt.enabled = true;
    this.tilt.neutral = null;
    return true;
  }

  /** Boost from an on-screen button (touch screens have no Shift key). */
  setBoost(on) {
    this.touchBoost = !!on;
  }

  /** Steering from the phone, each axis in -1..1, plus whether boost is held. */
  setRemoteInput(x, y, boost) {
    this.remote.x = clamp(Number(x) || 0, -1, 1);
    this.remote.y = clamp(Number(y) || 0, -1, 1);
    this.remote.boost = !!boost;
    this.remote.at = performance.now();
  }

  // ---------------------------------------------------------------------
  reset() {
    this.pos.set(0, 140, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.turn = 0;
    this.climb = 0;
    this.bank = 0;
    this.speed = CRUISE;
    this.distance = 0;
    this.boosting = false;
    this.camOff.set(0, 2.8, 10.5);
  }

  start() {
    this.tilt.neutral = null;
    this.mode = 'playing';
    this.paused = false;
    this.distance = 0;
    this._emitHud();
  }

  toMenu() {
    this.mode = 'menu';
    this.paused = false;
    this._emitHud();
  }

  togglePause() {
    if (this.mode !== 'playing') return;
    this.paused = !this.paused;
    this._emitHud();
  }

  get scenes() {
    return SCENES;
  }

  toggleScene() {
    this.setScene(this.sceneName === 'sky' ? 'space' : 'sky');
  }

  setScene(name) {
    if (!SCENES.includes(name)) return;
    this.sceneName = name;
    const sky = name === 'sky';
    this.skyGroup.visible = sky;
    this.spaceGroup.visible = !sky;
    this.scene.fog = sky ? this.skyFog : null;
    if (sky) {
      this.hemi.color.set(0xe6f2ff); this.hemi.groundColor.set(0xb8b0a6); this.hemi.intensity = 1.35; // light bounced off the cloud sea
      this.sun.color.set(0xfff0d8); this.sun.intensity = 2.1;
      this.sun.position.copy(this.skyCfg.sunDir);
      this.dust.material.color.set(0xffffff); this.dust.material.opacity = 0.35;
      // the cloud sea is below us: keep the ship above it
      if (this.pos.y < SKY_FLOOR + 20) this.pos.y = 140;
    } else {
      this.hemi.color.set(0x5566aa); this.hemi.groundColor.set(0x1a1022); this.hemi.intensity = 0.45;
      this.sun.color.set(0xffe2b8); this.sun.intensity = 2.8;
      this.sun.position.copy(this.spaceCfg.sunDir);
      this.dust.material.color.set(0xa8ccff); this.dust.material.opacity = 0.8;
    }
    this._emitHud();
  }

  // ---- Flight -----------------------------------------------------------
  _input() {
    let x = this.keys.right - this.keys.left + this.touch.x;
    let y = this.keys.up - this.keys.down + this.touch.y;
    let boost = !!this.keys.boost || !!this.touchBoost;
    if (this.tilt.enabled) { x += this.tilt.x; y += this.tilt.y; }
    if (performance.now() - this.remote.at < 500) {
      x += this.remote.x;
      y += this.remote.y;
      boost = boost || this.remote.boost;
    }
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), boost };
  }

  _forward(out) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  _updateSky(t) {
    const p = this.pos;
    const d = this._dummy;
    this.skyDome.position.copy(this.camera.position);
    this.sea.position.set(p.x, 0, p.z);
    this.sea.material.uniforms.time.value = t;

    for (let i = 0; i < N_ISLANDS; i++) {
      const s = this.islands[i];
      s.wx = wrap(s.x, p.x, SKY_TILE);
      s.wz = wrap(s.z, p.z, SKY_TILE);
      d.position.set(s.wx, s.y + Math.sin(t * 0.25 + i) * 1.5, s.wz);
      d.rotation.set(0, s.ry, 0);
      d.scale.set(s.r, s.r * s.sy, s.r);
      d.updateMatrix();
      this.islandMesh.setMatrixAt(i, d.matrix);
    }
    this.islandMesh.instanceMatrix.needsUpdate = true;

    let k = 0;
    for (let i = 0; i < N_CLOUDS; i++) {
      const c = this.clouds[i];
      const cx = wrap(c.x + t * 1.5, p.x, SKY_TILE);
      const cz = wrap(c.z, p.z, SKY_TILE);
      for (const pf of c.puffs) {
        d.position.set(cx + pf.x, c.y + pf.y, cz + pf.z);
        d.rotation.set(pf.r, pf.r * 0.7, 0);
        d.scale.set(pf.s, pf.s * 0.62, pf.s * 0.85);
        d.updateMatrix();
        this.cloudMesh.setMatrixAt(k++, d.matrix);
      }
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
  }

  _updateSpace(t) {
    const p = this.pos;
    const d = this._dummy;
    this.backdrop.position.copy(this.camera.position);
    const half = ROCK_TILE / 2;
    for (let i = 0; i < N_ROCKS; i++) {
      const r = this.rocks[i];
      r.wx = wrap(r.x, p.x, ROCK_TILE);
      r.wy = wrap(r.y, p.y, ROCK_TILE);
      r.wz = wrap(r.z, p.z, ROCK_TILE);
      // shrink to nothing near the tile edge so rocks never pop in
      const edge = Math.max(Math.abs(r.wx - p.x), Math.abs(r.wy - p.y), Math.abs(r.wz - p.z));
      r.ws = r.s * (1 - smooth(half * 0.72, half * 0.98, edge));
      d.position.set(r.wx, r.wy, r.wz);
      d.rotation.set(r.rx + t * r.spin * 0.4, r.ry + t * r.spin, 0);
      d.scale.setScalar(Math.max(r.ws, 1e-3));
      d.updateMatrix();
      this.rockMesh.setMatrixAt(i, d.matrix);
    }
    this.rockMesh.instanceMatrix.needsUpdate = true;
  }

  _updateDust() {
    const c = this.camera.position;
    const out = this.dust.geometry.attributes.position.array;
    const b = this.dustBase;
    for (let i = 0; i < N_DUST * 3; i += 3) {
      out[i] = wrap(b[i], c.x, DUST_TILE);
      out[i + 1] = wrap(b[i + 1], c.y, DUST_TILE);
      out[i + 2] = wrap(b[i + 2], c.z, DUST_TILE);
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
  }

  /** No crashing: solid things gently push the ship away instead. */
  _pushOut() {
    const p = this.pos;
    if (this.sceneName === 'sky') {
      for (let i = 0; i < N_ISLANDS; i++) {
        const s = this.islands[i];
        const h = s.r * s.sy;
        const top = s.y + 0.16 * h + 2;
        const bottom = s.y - 1.7 * h;
        if (p.y > top || p.y < bottom) continue;
        const dx = p.x - s.wx, dz = p.z - s.wz;
        const dist = Math.hypot(dx, dz);
        const rad = s.r * 1.12 * clamp((p.y - bottom) / (top - bottom), 0.15, 1) + 1.5;
        if (dist >= rad) continue;
        if (p.y > top - 4) {
          p.y = top; // skim across the grass
          if (this.pitch < 0) this.pitch *= 0.85;
        } else {
          const k = rad / Math.max(dist, 1e-3);
          p.x = s.wx + dx * k;
          p.z = s.wz + dz * k;
        }
      }
      if (p.y < SKY_FLOOR) { p.y = SKY_FLOOR; if (this.pitch < 0) this.pitch *= 0.85; }
      if (p.y > SKY_CEIL) { p.y = SKY_CEIL; if (this.pitch > 0) this.pitch *= 0.85; }
    } else {
      const v = this._v;
      for (let i = 0; i < N_ROCKS; i++) {
        const r = this.rocks[i];
        const min = r.ws * 1.05 + 1.4;
        v.set(p.x - r.wx, p.y - r.wy, p.z - r.wz);
        const dist = v.length();
        if (dist >= min) continue;
        if (dist < 1e-3) v.set(0, 1, 0); else v.multiplyScalar(1 / dist);
        p.set(r.wx + v.x * min, r.wy + v.y * min, r.wz + v.z * min);
      }
    }
  }

  _placeCamera(dt) {
    const cam = this.camera;
    const q = this._q.setFromEuler(this._e.set(this.pitch * 0.8, this.yaw, 0, 'YXZ'));
    const want = this._v.set(0, 2.8, 10.5).applyQuaternion(q);
    // smooth the offset, not the position, so the camera never falls behind at boost speed
    this.camOff.lerp(want, 1 - Math.exp(-dt * 5));
    cam.position.copy(this.pos).add(this.camOff);
    const f = this._forward(this._f);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.pos.x + f.x * 25, this.pos.y + f.y * 25 + 1, this.pos.z + f.z * 25);
    cam.rotateZ(-this.bank * 0.3);
    const fov = 62 + clamp((this.speed - CRUISE) / (BOOST - CRUISE), 0, 1) * 16;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  _emitHud() {
    const heading = Math.round((((-this.yaw * 180) / Math.PI) % 360 + 360) % 360);
    this.onHud({
      mode: this.mode,
      paused: this.paused,
      scene: this.sceneName,
      speed: Math.round(this.speed * 3.6), // km/h
      altitude: Math.round(this.pos.y),
      altNorm: this.sceneName === 'sky' ? +clamp((this.pos.y - SKY_FLOOR) / (SKY_CEIL - SKY_FLOOR), 0, 1).toFixed(3) : 0.5,
      heading,
      distance: Math.round(this.distance),
      boost: this.boosting,
    });
  }

  _update(dt) {
    this.time += dt;
    const t = this.time;

    let ix, iy, boost = false;
    if (this.mode === 'playing') {
      const inp = this._input();
      ix = inp.x; iy = inp.y; boost = inp.boost;
    } else {
      // menu: lazy autopilot, wide gentle turns
      ix = 0.22 + Math.sin(t * 0.17) * 0.3;
      iy = Math.sin(t * 0.23) * 0.25 - this.pitch * 1.2;
      if (this.sceneName === 'sky' && this.pos.y < 90) iy += 0.4;
    }

    const k = 1 - Math.exp(-dt * 3.5);
    this.turn = lerp(this.turn, ix, k);
    this.climb = lerp(this.climb, iy, k);
    this.yaw -= this.turn * TURN * dt;
    this.pitch += this.climb * PITCH * dt;
    if (Math.abs(iy) < 0.05) this.pitch *= Math.exp(-dt * 0.35); // drift back to level when hands-off
    this.pitch = clamp(this.pitch, -PITCH_MAX, PITCH_MAX);

    this.boosting = boost;
    this.speed = lerp(this.speed, boost ? BOOST : CRUISE, 1 - Math.exp(-dt * (boost ? 1.6 : 0.9)));
    const f = this._forward(this._f);
    this.pos.addScaledVector(f, this.speed * dt);
    if (this.mode === 'playing') this.distance += this.speed * dt;
    this.bank = lerp(this.bank, this.turn * 0.95, k);

    if (this.sceneName === 'sky') this._updateSky(t);
    else this._updateSpace(t);
    this._pushOut();

    const g = this.ship.group;
    g.position.copy(this.pos);
    g.rotation.set(this.pitch, this.yaw, -this.bank + Math.sin(t * 2.1) * 0.02, 'YXZ');
    this.ship.update(t, 1 + (this.speed - CRUISE) / 80);

    this._placeCamera(dt);
    if (this.sceneName === 'sky') this.skyDome.position.copy(this.camera.position);
    else this.backdrop.position.copy(this.camera.position);
    this._updateDust();

    this._hudTimer = (this._hudTimer || 0) + dt;
    if (this._hudTimer > 0.08) {
      this._hudTimer = 0;
      this._emitHud();
    }
  }

  _loop = (now) => {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    if (!this.paused) this._update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('deviceorientation', this._onOrient);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach((x) => { if (x.map) x.map.dispose(); x.dispose(); });
      }
    });
    this.glowTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
