import * as THREE from 'three';

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.15, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.3)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Low-poly fighter built from primitives. Nose points toward -Z. */
export function createShip({ glow = 0xff3030 } = {}) {
  const group = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(0.8);
  group.add(model);

  const hull = new THREE.MeshStandardMaterial({ color: 0x5a7c84, metalness: 0.4, roughness: 0.5, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b262b, metalness: 0.6, roughness: 0.35, flatShading: true });
  const accent = new THREE.MeshStandardMaterial({ color: 0x3c5258, metalness: 0.3, roughness: 0.6, flatShading: true });

  // Fuselage
  const fus = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.8, 5), hull);
  fus.rotation.x = -Math.PI / 2;
  fus.scale.set(1, 1, 0.5);
  fus.position.z = -0.1;
  model.add(fus);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.8), accent);
  rear.position.set(0, 0, 1.45);
  model.add(rear);

  const cockpit = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), dark);
  cockpit.scale.set(0.7, 0.45, 1.5);
  cockpit.position.set(0, 0.22, 0.1);
  model.add(cockpit);

  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: glow,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const glows = [];

  for (const side of [-1, 1]) {
    // Wing, angled down toward the tips
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.09, 1.1), hull);
    wing.position.set(side * 1.2, -0.15, 0.6);
    wing.rotation.z = side * -0.38;
    wing.rotation.y = side * 0.18;
    model.add(wing);

    // Wing-tip pod
    const pod = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.9, 4), accent);
    pod.rotation.x = -Math.PI / 2;
    pod.position.set(side * 2.2, -0.55, 0.2);
    model.add(pod);

    // Blade fin
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.7), dark);
    fin.position.set(side * 2.2, -0.1, 0.55);
    fin.rotation.z = side * -0.25;
    fin.rotation.x = 0.35;
    model.add(fin);

    const g = new THREE.Sprite(glowMat);
    g.position.set(side * 2.2, -0.55, 1.2);
    g.scale.setScalar(1.3);
    model.add(g);
    glows.push(g);
  }

  const core = new THREE.Sprite(glowMat);
  core.position.set(0, 0, 1.95);
  core.scale.setScalar(1.6);
  model.add(core);
  glows.push(core);

  const light = new THREE.PointLight(glow, 18, 14, 2);
  light.position.set(0, -0.6, 2);
  group.add(light);

  function update(t, boost = 1) {
    for (let i = 0; i < glows.length; i++) {
      const f = 1 + Math.sin(t * 47 + i * 2.1) * 0.08 + Math.sin(t * 23 + i) * 0.05;
      glows[i].scale.setScalar((i === glows.length - 1 ? 1.6 : 1.3) * f * boost);
    }
    light.intensity = 16 + Math.sin(t * 31) * 3;
  }

  return { group, update };
}
