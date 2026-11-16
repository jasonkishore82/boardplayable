import * as THREE from 'three';

// Soft round glow texture used for engine flames and wingtip lights.
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.6)'));
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A small swept-wing glider built from primitives. Nose points down -Z.
 * Returns { group, body, setThrust(0..1), update(t) }.
 */
export function buildShip() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // gets visual bank/wobble on top of the flight attitude
  group.add(body);

  const hull = new THREE.MeshStandardMaterial({ color: 0xeef2f6, metalness: 0.35, roughness: 0.35 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xff6a3d, metalness: 0.2, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2633, metalness: 0.6, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x5fd4ff, metalness: 0.1, roughness: 0.05, emissive: 0x0a3550, emissiveIntensity: 0.6 });

  // Fuselage: a stretched capsule
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 4.2, 6, 16), hull);
  fus.rotation.x = Math.PI / 2;
  fus.scale.set(1, 1, 0.8);
  body.add(fus);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 16), trim);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  nose.scale.set(1, 0.8, 1);
  body.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(0.85, 0.75, 2.1);
  canopy.position.set(0, 0.3, -1.1);
  body.add(canopy);

  // Swept wings from an extruded outline (one shape, mirrored)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.6);
  wingShape.lineTo(4.6, 1.5);
  wingShape.lineTo(4.9, 2.1);
  wingShape.lineTo(4.4, 2.2);
  wingShape.lineTo(0, 1.9);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 1 });
  wingGeo.rotateX(Math.PI / 2);
  wingGeo.translate(0, 0.06, 0);
  for (const side of [1, -1]) {
    const w = new THREE.Mesh(wingGeo, hull);
    w.scale.x = side;
    w.position.set(0.3 * side, -0.15, 0);
    w.rotation.z = side * 0.06; // slight dihedral
    body.add(w);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.35), trim);
    stripe.position.set(4.3 * side, -0.05 + 4.3 * 0.06, 1.95);
    body.add(stripe);
  }

  // Tail fins
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(1.5, 0);
  finShape.lineTo(1.7, 1.4);
  finShape.lineTo(1.2, 1.45);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false });
  finGeo.rotateY(-Math.PI / 2);
  for (const side of [1, -1]) {
    const f = new THREE.Mesh(finGeo, trim);
    f.position.set(0.35 * side, 0.2, 1.3);
    f.rotation.z = -side * 0.35;
    body.add(f);
  }

  // Engine nacelle + glow
  const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.8, 16, 1, true), dark);
  nacelle.rotation.x = Math.PI / 2;
  nacelle.position.z = 2.9;
  body.add(nacelle);

  const flameMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(120,220,255,1)', 'rgba(40,90,255,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const flame = new THREE.Sprite(flameMat);
  flame.position.z = 3.5;
  body.add(flame);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  core.position.z = 3.35;
  body.add(core);

  // Wingtip nav lights (red left, green right)
  const tips = [];
  for (const [side, col] of [[-1, 'rgba(255,60,60,1)'], [1, 'rgba(60,255,120,1)']]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(col), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.position.set(4.75 * side, 0.2, 2.1);
    s.scale.setScalar(0.9);
    body.add(s);
    tips.push(s);
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  let thrust = 0.4;
  return {
    group,
    body,
    setThrust(v) { thrust = v; },
    update(t) {
      const flicker = 0.92 + Math.sin(t * 47) * 0.05 + Math.sin(t * 31) * 0.03;
      flame.scale.set(1.4 + thrust * 1.6, 1.4 + thrust * 1.6, 1).multiplyScalar(flicker);
      flame.position.z = 3.5 + thrust * 0.9;
      core.scale.setScalar((0.8 + thrust * 0.6) * flicker);
      const blink = (Math.sin(t * 6) > 0.6) ? 1.3 : 0.7;
      for (const s of tips) s.scale.setScalar(blink);
    },
  };
}
