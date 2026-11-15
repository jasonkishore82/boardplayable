import * as THREE from 'three';
import { buildShip } from './ship.js';
import { WORLDS } from './worlds.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const FWD = new THREE.Vector3(0, 0, -1);

const SPEED = { cruise: 70, boost: 190, brake: 22 };
const CAMERAS = ['chase', 'far', 'cockpit'];

/**
 * Free-flight sandbox. No score, no crashing: just fly.
 * Input: keyboard, pointer drag, and a phone controller (setRemoteInput / setRemoteButton).
 */
export class Game {
  constructor(mount, { onHud } = {}) {
    this.mount = mount;
    this.onHud = onHud || (() => {});

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, mount.clientWidth / mount.clientHeight, 0.5, 22000);

    this.ship = buildShip();
    this.scene.add(this.ship.group);

    // flight state
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.camQuat = new THREE.Quaternion();
    this.speed = SPEED.cruise;
    this.sm = { x: 0, y: 0, roll: 0 };
    this.mode = 'menu'; // menu | flying
    this.paused = false;
    this.camIndex = 0;
    this.time = 0;

    // input
    this.keys = { left: 0, right: 0, up: 0, down: 0, rollL: 0, rollR: 0, boost: false, brake: false };
    this.touch = { x: 0, y: 0, active: false };
    this.remote = { x: 0, y: 0, t: 0, boost: false, brake: false };
    this.invertKeys = false;

    this._buildSpeedLines();
    this._bindInput();

    this._tmp = { v: new THREE.Vector3(), v2: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };

    this.worlds = {};
    this.worldIndex = 0;
    this.setWorld(0);
    this._hudAt = 0;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop);

    this._onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this._onResize);
  }

  // ---------------- worlds ----------------
  setWorld(index) {
    this.worldIndex = ((index % WORLDS.length) + WORLDS.length) % WORLDS.length;
    const def = WORLDS[this.worldIndex];
    if (this.world) this.scene.remove(this.world.root);
    if (!this.worlds[def.id]) this.worlds[def.id] = def.create();
    const w = this.worlds[def.id];
    this.world = w;
    this.scene.add(w.root);
    this.scene.fog = w.fog;
    this.scene.background = w.background;
    w.init?.(this.renderer);
    this.scene.environment = w.environment || null;
    this.renderer.toneMappingExposure = w.exposure;
    this.lines.material.color.set(w.lineColor);
    this.respawn();
    this._emitHud(true);
  }

  nextWorld() { this.setWorld(this.worldIndex + 1); }

  respawn() {
    this.pos.copy(this.world.spawn);
    this.quat.identity();
    this.camQuat.identity();
    this.speed = SPEED.cruise;
    this.sm.x = this.sm.y = this.sm.roll = 0;
    this._placeCamera(1, true);
  }

  // ---------------- public controls ----------------
  start() {
    this.mode = 'flying';
    this.paused = false;
    this.respawn();
    this._emitHud(true);
  }

  toMenu() {
    this.mode = 'menu';
    this.paused = false;
    this._emitHud(true);
  }

  togglePause() {
    if (this.mode !== 'flying') return;
    this.paused = !this.paused;
    this._emitHud(true);
  }

  cycleCamera() {
    this.camIndex = (this.camIndex + 1) % CAMERAS.length;
    this._emitHud(true);
  }

  setRemoteInput(x, y) {
    this.remote.x = clamp(+x || 0, -1, 1);
    this.remote.y = clamp(+y || 0, -1, 1);
    this.remote.t = performance.now();
  }

  setRemoteButton(name, on) {
    if (name === 'boost') this.remote.boost = !!on;
    if (name === 'brake') this.remote.brake = !!on;
  }

  // ---------------- input ----------------
  _bindInput() {
    const map = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      KeyQ: 'rollL', KeyE: 'rollR',
    };
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      const k = map[e.code];
      if (k) { this.keys[k] = 1; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.boost = true;
      if (e.code === 'Space' && this.mode === 'flying') { this.keys.brake = true; e.preventDefault(); }
      if (e.code === 'KeyC') this.cycleCamera();
      if (e.code === 'KeyN') this.nextWorld();
      if (e.code === 'KeyR' && this.mode === 'flying') this.respawn();
      if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
    };
    this._onKeyUp = (e) => {
      const k = map[e.code];
      if (k) this.keys[k] = 0;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.boost = false;
      if (e.code === 'Space') this.keys.brake = false;
    };
    this._onBlur = () => {
      for (const k of Object.keys(this.keys)) this.keys[k] = typeof this.keys[k] === 'boolean' ? false : 0;
      this.touch.active = false; this.touch.x = this.touch.y = 0;
    };
    // Pointer: press and drag anywhere on the canvas like a joystick from screen centre.
    const el = this.renderer.domElement;
    this._onPointer = (e) => {
      if (e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'pointerleave') {
        this.touch.active = false; this.touch.x = 0; this.touch.y = 0; return;
      }
      if (e.type === 'pointerdown') this.touch.active = true;
      if (!this.touch.active) return;
      const w = el.clientWidth, h = el.clientHeight;
      this.touch.x = clamp((e.clientX - w / 2) / (w * 0.3), -1, 1);
      this.touch.y = clamp(-(e.clientY - h / 2) / (h * 0.3), -1, 1);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, this._onPointer);
    el.style.touchAction = 'none';
  }

  // ---------------- speed streaks ----------------
  _buildSpeedLines() {
    const N = 650;
    this.lineN = N;
    this.lineHalf = 170;
    this.lineBase = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) this.lineBase[i] = (Math.random() * 2 - 1) * this.lineHalf;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, fog: true });
    this.lines = new THREE.LineSegments(geo, mat);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  _updateSpeedLines(fwd) {
    const H = this.lineHalf, P = this.pos, b = this.lineBase;
    const arr = this.lines.geometry.attributes.position.array;
    const len = 1 + this.speed * 0.055;
    const w = (v, c) => c + ((((v - c + H) % (2 * H)) + 2 * H) % (2 * H)) - H;
    for (let i = 0; i < this.lineN; i++) {
      const x = w(b[i * 3], P.x), y = w(b[i * 3 + 1], P.y), z = w(b[i * 3 + 2], P.z);
      const o = i * 6;
      arr[o] = x; arr[o + 1] = y; arr[o + 2] = z;
      arr[o + 3] = x - fwd.x * len; arr[o + 4] = y - fwd.y * len; arr[o + 5] = z - fwd.z * len;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.material.opacity = 0.06 + clamp((this.speed - 30) / 160, 0, 1) * 0.5;
  }

  // ---------------- simulation ----------------
  _loop = () => {
    this._raf = requestAnimationFrame(this._loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (!this.paused) {
      this.time += dt;
      this._step(dt, now);
    }
    this.renderer.render(this.scene, this.camera);
  };

  _step(dt, now) {
    const { v, q } = this._tmp;
    const flying = this.mode === 'flying';
    const fwd = v.copy(FWD).applyQuaternion(this.quat);

    // ---- gather input ----
    let ix, iy, iroll = 0, boost = false, brake = false;
    if (flying) {
      ix = this.keys.right - this.keys.left + this.touch.x;
      iy = this.keys.up - this.keys.down + this.touch.y;
      iroll = this.keys.rollR - this.keys.rollL;
      if (now - this.remote.t < 500) { ix += this.remote.x; iy += this.remote.y; }
      else { this.remote.boost = this.remote.brake = false; }
      boost = this.keys.boost || this.remote.boost;
      brake = this.keys.brake || this.remote.brake;
    } else {
      // menu autopilot: lazy circle, hold altitude
      ix = 0.28;
      const holdY = this.world.spawn.y;
      iy = clamp(-fwd.y * 4 + (holdY - this.pos.y) * 0.01, -0.5, 0.5);
    }
    ix = clamp(ix, -1, 1);
    iy = clamp(iy, -1, 1);
    this.sm.x = damp(this.sm.x, ix, 6, dt);
    this.sm.y = damp(this.sm.y, iy, 6, dt);
    this.sm.roll = damp(this.sm.roll, iroll, 8, dt);

    // ---- speed ----
    const target = brake ? SPEED.brake : boost ? SPEED.boost : SPEED.cruise;
    this.speed = damp(this.speed, target, boost ? 1.4 : 2.2, dt);
    this.boosting = boost;

    // ---- attitude ----
    // turn: around world up (arcade, keeps the horizon readable)
    q.setFromAxisAngle(Y, -this.sm.x * 1.15 * dt);
    this.quat.premultiply(q);
    // climb/dive: around the ship's own wing axis, so loops are possible
    q.setFromAxisAngle(X, this.sm.y * 1.25 * dt);
    this.quat.multiply(q);
    // manual roll
    if (Math.abs(this.sm.roll) > 0.01) {
      q.setFromAxisAngle(Z, -this.sm.roll * 2.8 * dt);
      this.quat.multiply(q);
    }
    // auto bank into turns / level out, unless the pilot is rolling by hand
    if (Math.abs(iroll) < 0.01) {
      const right = this._tmp.v2.copy(X).applyQuaternion(this.quat);
      const cur = Math.asin(clamp(right.y, -1, 1));
      const want = -this.sm.x * 0.8;
      q.setFromAxisAngle(Z, (want - cur) * (1 - Math.exp(-3 * dt)));
      this.quat.multiply(q);
    }
    this.quat.normalize();
    fwd.copy(FWD).applyQuaternion(this.quat);

    // ---- move ----
    this.pos.addScaledVector(fwd, this.speed * dt);

    // soft floor / ceiling: pull the nose back instead of crashing
    const w = this.world;
    if (w.floor != null && this.pos.y < w.floor + 40 && fwd.y < 0) {
      const k = clamp((w.floor + 40 - this.pos.y) / 40, 0, 1);
      q.setFromAxisAngle(X, -fwd.y * k * 4 * dt);
      this.quat.multiply(q);
    }
    if (w.floor != null && this.pos.y < w.floor) this.pos.y = w.floor;
    if (w.ceiling != null && this.pos.y > w.ceiling && fwd.y > 0) {
      q.setFromAxisAngle(X, -fwd.y * 2.5 * dt);
      this.quat.multiply(q);
    }
    for (const c of w.colliders) {
      const d = this.pos.distanceTo(c.center);
      const min = c.r + 25;
      if (d < min) this.pos.sub(c.center).setLength(min).add(c.center);
    }

    // ---- ship visuals ----
    const sg = this.ship.group;
    sg.position.copy(this.pos);
    sg.quaternion.copy(this.quat);
    this.ship.body.rotation.z = -this.sm.x * 0.12 + Math.sin(this.time * 1.3) * 0.015;
    this.ship.body.rotation.x = this.sm.y * 0.08 + Math.sin(this.time * 0.9) * 0.01;
    this.ship.setThrust(boost ? 1 : brake ? 0.08 : 0.45);
    this.ship.update(this.time);

    this._placeCamera(dt, false);
    this.world.update(dt, this.time, this.camera.position, this.pos);
    this._updateSpeedLines(fwd);

    if (now - this._hudAt > 100) { this._hudAt = now; this._emitHud(); }
  }

  _placeCamera(dt, snap) {
    const cam = this.camera;
    const { m } = this._tmp;
    const eye = new THREE.Vector3();
    const look = new THREE.Vector3();
    const up = new THREE.Vector3();
    const boostK = clamp((this.speed - SPEED.cruise) / (SPEED.boost - SPEED.cruise), 0, 1);

    if (snap) this.camQuat.copy(this.quat);
    else this.camQuat.slerp(this.quat, 1 - Math.exp(-4.5 * dt));

    const view = this.mode === 'menu' ? 'orbit' : CAMERAS[this.camIndex];
    this.ship.group.visible = view !== 'cockpit';

    if (view === 'orbit') {
      const a = this.time * 0.18;
      eye.set(Math.sin(a) * 20, 5 + Math.sin(this.time * 0.3) * 2, Math.cos(a) * 20).add(this.pos);
      look.copy(this.pos);
      up.copy(Y);
    } else if (view === 'cockpit') {
      eye.set(0, 0.9, -1.6).applyQuaternion(this.quat).add(this.pos);
      look.copy(FWD).applyQuaternion(this.quat).multiplyScalar(50).add(eye);
      up.copy(Y).applyQuaternion(this.quat);
    } else {
      const dist = view === 'far' ? 30 : 13;
      const h = view === 'far' ? 8 : 3.4;
      eye.set(0, h, dist + boostK * 4).applyQuaternion(this.camQuat).add(this.pos);
      look.copy(FWD).applyQuaternion(this.quat).multiplyScalar(24).add(this.pos);
      up.copy(Y).applyQuaternion(this.camQuat);
    }

    // keep the camera out of the ocean / planets
    const w = this.world;
    if (w.floor != null) eye.y = Math.max(eye.y, w.floor * 0.5);
    for (const c of w.colliders) {
      if (eye.distanceTo(c.center) < c.r + 3) eye.sub(c.center).setLength(c.r + 3).add(c.center);
    }

    cam.position.copy(eye);
    m.lookAt(eye, look, up);
    cam.quaternion.setFromRotationMatrix(m);

    const fov = 66 + boostK * 16 - (this.speed < SPEED.cruise ? (SPEED.cruise - this.speed) * 0.1 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = snap ? fov : damp(cam.fov, fov, 4, dt);
      cam.updateProjectionMatrix();
    }
  }

  _emitHud() {
    const fwd = this._tmp ? this._tmp.v2.copy(FWD).applyQuaternion(this.quat) : FWD;
    const heading = ((Math.atan2(fwd.x, -fwd.z) * 180) / Math.PI + 360) % 360;
    const w = this.world;
    const alt = w.floor != null ? this.pos.y : null;
    this.onHud({
      mode: this.mode,
      paused: this.paused,
      speed: Math.round(this.speed * 3.6),
      altitude: alt == null ? null : Math.round(alt),
      altNorm: w.ceiling ? clamp(this.pos.y / w.ceiling, 0, 1) : 0.5,
      heading: Math.round(heading),
      boosting: !!this.boosting,
      world: w.name,
      worldId: w.id,
      camera: CAMERAS[this.camIndex],
    });
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    const el = this.renderer.domElement;
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave']) el.removeEventListener(t, this._onPointer);
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const mt of mats) { mt.map?.dispose?.(); mt.dispose?.(); }
    });
    for (const w of Object.values(this.worlds)) {
      if (w !== this.world) w.root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    }
    this.renderer.dispose();
    el.remove();
  }
}
