import * as THREE from 'three';
import { WAVES } from './waves.js';
import { oceanVertex, oceanFragment } from './oceanShader.js';

// Circular grid: dense near the centre, sparse toward the horizon (~14 km radius).
// It follows the camera; the shader samples waves in world space, so it never seams.
function createRadialGrid(rings = 300, segments = 384, a = 15, b = 0.0228) {
  const positions = [0, 0, 0];
  for (let i = 1; i <= rings; i++) {
    const r = a * (Math.exp(b * i) - 1);
    for (let j = 0; j < segments; j++) {
      const t = (j / segments) * Math.PI * 2;
      positions.push(Math.cos(t) * r, 0, Math.sin(t) * r);
    }
  }
  const index = [];
  for (let j = 0; j < segments; j++) index.push(0, 1 + ((j + 1) % segments), 1 + j);
  for (let i = 0; i < rings - 1; i++) {
    const r0 = 1 + i * segments;
    const r1 = r0 + segments;
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments;
      index.push(r0 + j, r0 + j1, r1 + j);
      index.push(r0 + j1, r1 + j1, r1 + j);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  return geo;
}

/**
 * Gerstner-wave ocean that reflects a cube map of the given Sky.
 * Call init(renderer) once (renders the sky into the cube map), then
 * update(t, camPos) every frame. `envMap` doubles as scene.environment.
 */
export function createOcean({ sky, sunDir, chop = 1, foam = 0.8, deepColor = '#0b2c3d', scatterColor = '#1f8f7f' }) {
  const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(1, 30000, rt);
  const envScene = new THREE.Scene();
  const skyCopy = new THREE.Mesh(sky.geometry, sky.material);
  skyCopy.scale.setScalar(10000);
  envScene.add(skyCopy);

  const material = new THREE.ShaderMaterial({
    vertexShader: oceanVertex,
    fragmentShader: oceanFragment,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uChop: { value: chop },
      uWaves: { value: WAVES.map((w) => new THREE.Vector4(w.dir[0], w.dir[1], w.steepness, w.wavelength)) },
      uEnv: { value: rt.texture },
      uSunDir: { value: sunDir.clone() },
      uDeep: { value: new THREE.Color(deepColor) },
      uScatter: { value: new THREE.Color(scatterColor) },
      uFoam: { value: foam },
    },
  });

  const mesh = new THREE.Mesh(createRadialGrid(), material);
  mesh.frustumCulled = false;

  let ready = false;
  return {
    mesh,
    envMap: rt.texture,
    init(renderer) {
      if (ready) return;
      cubeCam.update(renderer, envScene);
      rt.texture.needsPMREMUpdate = true;
      ready = true;
    },
    update(t, camPos) {
      material.uniforms.uTime.value = t;
      mesh.position.set(camPos.x, 0, camPos.z);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      rt.dispose();
    },
  };
}
