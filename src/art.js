import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI;

export const standard = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.52,
  metalness: 0.18,
  ...opts
});

export const flat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.9,
  metalness: 0,
  flatShading: true,
  ...opts
});

export const basic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });

export const glow = (color, intensity = 2.2, opts = {}) => new THREE.MeshStandardMaterial({
  color,
  emissive: color,
  emissiveIntensity: intensity,
  roughness: 0.32,
  metalness: 0.2,
  ...opts
});

export const additive = (color, opacity = 0.7) => new THREE.MeshBasicMaterial({
  color,
  transparent: true,
  opacity,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide
});

export function addMesh(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  parent.add(mesh);
  return mesh;
}

export function rounded(w, h, d, radius = 0.05) {
  return new RoundedBoxGeometry(w, h, d, 2, radius);
}

export function makeLimb(parent, x, y, z, length, radius, material, footMat = null) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  const geo = new THREE.CylinderGeometry(radius, radius * 0.86, length, 6);
  geo.translate(0, -length / 2, 0);
  addMesh(pivot, geo, material);
  if (footMat) addMesh(pivot, new THREE.BoxGeometry(radius * 3.1, radius * 1.7, length * 0.34), footMat, [0, -length, -length * 0.09]);
  return pivot;
}

export function makeArm(parent, x, y, z, length, radius, material, handMat = null) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  const geo = new THREE.CapsuleGeometry(radius, length, 3, 6);
  geo.translate(0, -length / 2 - radius, 0);
  addMesh(pivot, geo, material);
  if (handMat) addMesh(pivot, new THREE.SphereGeometry(radius * 1.5, 7, 5), handMat, [0, -length - radius * 1.7, 0]);
  return pivot;
}

export function disposeObject(root) {
  root.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of list) {
        if (m.map) m.map.dispose();
        if (m.alphaMap) m.alphaMap.dispose();
        m.dispose();
      }
    }
  });
}

/* ─────────────────────────── SHARED TEXTURES ─────────────────────────── */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,.75)');
  g.addColorStop(0.45, 'rgba(255,255,255,.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glowSprite(color, scale = 1.5, opacity = 0.8) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

/* ─────────────────────────── PLAYER ─────────────────────────── */
function makeStickPlayer() {
  const group = new THREE.Group();
  const ink = basic(0x171410);
  const accent = basic(0xcf432d);
  const body = new THREE.Group();
  group.add(body);

  const legL = makeLimb(body, -0.11, 0.88, 0, 0.78, 0.026, ink);
  const legR = makeLimb(body, 0.11, 0.88, 0, 0.78, 0.026, ink);
  addMesh(legL, new THREE.BoxGeometry(0.13, 0.04, 0.2), ink, [0, -0.8, -0.055]);
  addMesh(legR, new THREE.BoxGeometry(0.13, 0.04, 0.2), ink, [0, -0.8, -0.055]);

  addMesh(body, new THREE.CylinderGeometry(0.026, 0.034, 0.67, 5), ink, [0, 1.2, 0]);
  addMesh(body, new THREE.TorusGeometry(0.16, 0.022, 5, 18), ink, [0, 1.71, 0]);
  addMesh(body, new THREE.CircleGeometry(0.13, 16), basic(0xf6efe3), [0, 1.71, 0.005]);
  addMesh(body, new THREE.SphereGeometry(0.018, 4, 3), accent, [-0.045, 1.73, -0.02]);
  addMesh(body, new THREE.SphereGeometry(0.018, 4, 3), accent, [0.045, 1.73, -0.02]);

  const armL = makeLimb(body, -0.22, 1.48, 0, 0.55, 0.021, ink);
  const armR = makeLimb(body, 0.22, 1.48, 0, 0.55, 0.021, ink);
  armL.rotation.z = 0.14;
  armR.rotation.z = -0.2;

  const weapon = new THREE.Group();
  weapon.position.set(0.24, 1.06, -0.14);
  body.add(weapon);
  addMesh(weapon, new THREE.BoxGeometry(0.05, 0.05, 0.56), ink, [0, 0, -0.21]);
  addMesh(weapon, new THREE.BoxGeometry(0.08, 0.11, 0.13), ink, [0, -0.04, -0.03]);
  addMesh(weapon, new THREE.BoxGeometry(0.02, 0.03, 0.08), accent, [0, 0.045, -0.4]);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -0.53);
  weapon.add(muzzle);

  // A few deliberately imperfect sketch strokes.
  const sketchMat = new THREE.LineBasicMaterial({ color: 0x2b2620, transparent: true, opacity: 0.36 });
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.16 + Math.random() * 0.32, 0.9 + i * 0.18, 0.05),
      new THREE.Vector3(-0.12 + Math.random() * 0.24, 0.93 + i * 0.18, 0.06)
    ]);
    body.add(new THREE.Line(g, sketchMat));
  }

  return {
    group,
    rig: { body, legL, legR, armL, armR, weapon, muzzle, scale: 1, type: 'stick' }
  };
}

function makeGeoPlayer() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const dark = flat(0x111522);
  const cream = flat(0xf9f2df);
  const orange = flat(0xff4b28);
  const blue = flat(0x0b69ff);

  const legL = makeLimb(body, -0.13, 0.85, 0, 0.7, 0.105, dark, orange);
  const legR = makeLimb(body, 0.13, 0.85, 0, 0.7, 0.105, dark, orange);
  const torso = addMesh(body, new THREE.ConeGeometry(0.36, 0.76, 4), cream, [0, 1.16, 0], [0, PI / 4, 0]);
  addMesh(body, new THREE.ConeGeometry(0.31, 0.22, 4), orange, [0, 1.49, 0.02], [0, PI / 4, 0], [1, 1, 0.65]);
  const head = addMesh(body, new THREE.IcosahedronGeometry(0.225, 0), cream, [0, 1.72, 0]);
  addMesh(head, new THREE.BoxGeometry(0.26, 0.055, 0.04), dark, [0, 0.02, -0.19]);
  addMesh(head, new THREE.BoxGeometry(0.055, 0.05, 0.03), blue, [0.045, 0.02, -0.215]);
  addMesh(head, new THREE.BoxGeometry(0.055, 0.05, 0.03), orange, [-0.045, 0.02, -0.215]);
  body.add(torso);

  const armL = makeArm(body, -0.42, 1.44, 0, 0.5, 0.09, dark, cream);
  const armR = makeArm(body, 0.42, 1.44, 0, 0.5, 0.09, dark, cream);
  armL.rotation.z = -0.08;
  armR.rotation.z = 0.08;

  const weapon = new THREE.Group();
  weapon.position.set(0.34, 1.16, -0.34);
  body.add(weapon);
  addMesh(weapon, new THREE.BoxGeometry(0.13, 0.13, 0.7), dark, [0, 0, -0.24]);
  addMesh(weapon, new THREE.BoxGeometry(0.09, 0.09, 0.5), orange, [0, 0, -0.6]);
  addMesh(weapon, new THREE.BoxGeometry(0.22, 0.04, 0.3), blue, [0, 0.1, -0.3]);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -0.88);
  weapon.add(muzzle);

  body.add(addMesh(new THREE.Group(), new THREE.TorusGeometry(0.34, 0.012, 4, 30), basic(0xff4b28, { transparent: true, opacity: 0.4 }), [0, 1.24, 0.18], [PI / 2, 0, 0]));

  return {
    group,
    rig: { body, legL, legR, armL, armR, weapon, muzzle, head, scale: 1, type: 'geo', bodyMat: cream }
  };
}

function makeNeonPlayer() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const dark = standard(0x24365e, { metalness: 0.62, roughness: 0.27, emissive: 0x061227, emissiveIntensity: 0.5 });
  const cyan = glow(0x00f0ff, 3.2);
  const pink = glow(0xff2d95, 3.4);
  const silver = standard(0xc9d7ee, { metalness: 0.8, roughness: 0.22 });

  const legL = makeLimb(body, -0.14, 0.9, 0, 0.72, 0.095, dark, cyan);
  const legR = makeLimb(body, 0.14, 0.9, 0, 0.72, 0.095, dark, cyan);
  addMesh(body, new THREE.CylinderGeometry(0.11, 0.15, 0.2, 6), cyan, [-0.14, 0.02, -0.03]);
  addMesh(body, new THREE.CylinderGeometry(0.11, 0.15, 0.2, 6), cyan, [0.14, 0.02, -0.03]);

  const torso = addMesh(body, new THREE.CapsuleGeometry(0.28, 0.45, 4, 8), dark, [0, 1.18, 0]);
  addMesh(torso, new THREE.BoxGeometry(0.35, 0.08, 0.02), cyan, [0, 0.13, -0.26]);
  addMesh(torso, new THREE.BoxGeometry(0.22, 0.035, 0.02), pink, [0, 0.01, -0.28]);
  addMesh(body, new THREE.OctahedronGeometry(0.1, 0), cyan, [0, 1.18, -0.31], [0, 0, PI / 4]);
  addMesh(body, new THREE.ConeGeometry(0.2, 0.28, 6), dark, [0, 1.57, 0], [0, 0, 0]);

  const head = addMesh(body, new THREE.SphereGeometry(0.2, 10, 8), standard(0x2b3c64, { metalness: 0.75, roughness: 0.16, emissive: 0x081b33, emissiveIntensity: 0.55 }), [0, 1.78, 0]);
  addMesh(head, new THREE.BoxGeometry(0.28, 0.055, 0.04), cyan, [0, 0.025, -0.18]);
  addMesh(head, new THREE.TorusGeometry(0.24, 0.012, 4, 28), pink, [0, -0.03, 0.01], [PI / 2, 0, 0]);

  const armL = makeArm(body, -0.38, 1.42, 0, 0.48, 0.085, dark, cyan);
  const armR = makeArm(body, 0.38, 1.42, 0, 0.48, 0.085, dark, cyan);
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.12;

  const weapon = new THREE.Group();
  weapon.position.set(0.32, 1.14, -0.36);
  body.add(weapon);
  addMesh(weapon, rounded(0.14, 0.15, 0.82, 0.03), silver, [0, 0, -0.28]);
  addMesh(weapon, new THREE.BoxGeometry(0.06, 0.06, 0.62), cyan, [0, 0.02, -0.64]);
  addMesh(weapon, new THREE.BoxGeometry(0.24, 0.05, 0.3), dark, [0, 0.11, -0.24]);
  addMesh(weapon, new THREE.BoxGeometry(0.03, 0.13, 0.18), pink, [0.08, -0.02, -0.44]);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.99);
  weapon.add(muzzle);

  const trailL = addMesh(body, new THREE.PlaneGeometry(0.13, 1.04), additive(0x00f0ff, 0.32), [-0.24, 1.0, 0.18], [0.14, 0.2, -0.16]);
  const trailR = addMesh(body, new THREE.PlaneGeometry(0.13, 1.04), additive(0xff2d95, 0.24), [0.24, 1.0, 0.18], [0.14, -0.2, 0.16]);
  const halo = addMesh(body, new THREE.TorusGeometry(0.42, 0.008, 4, 48), basic(0x00f0ff, { transparent: true, opacity: 0.4 }), [0, 1.3, 0.16], [0, 0, 0]);

  return {
    group,
    rig: { body, legL, legR, armL, armR, weapon, muzzle, head, trailL, trailR, halo, scale: 1.02, type: 'neon' }
  };
}

function makeCyberPlayer() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const steel = standard(0x465563, { metalness: 0.72, roughness: 0.34, emissive: 0x0a1117, emissiveIntensity: 0.35 });
  const dark = standard(0x1c2731, { metalness: 0.5, roughness: 0.5, emissive: 0x060c12, emissiveIntensity: 0.4 });
  const cloth = standard(0x1d2b2c, { roughness: 0.94, metalness: 0.02 });
  const orange = glow(0xff8a1f, 2.8);
  const cyan = glow(0x3ed7ff, 2.4);

  const legL = makeLimb(body, -0.16, 0.98, 0, 0.8, 0.11, dark, steel);
  const legR = makeLimb(body, 0.16, 0.98, 0, 0.8, 0.11, dark, steel);
  addMesh(legL, rounded(0.24, 0.18, 0.38, 0.04), steel, [0, -0.38, -0.06]);
  addMesh(legR, rounded(0.24, 0.18, 0.38, 0.04), steel, [0, -0.38, -0.06]);
  addMesh(body, rounded(0.43, 0.26, 0.32, 0.06), steel, [0, 0.91, 0]);
  addMesh(body, new THREE.CylinderGeometry(0.12, 0.15, 0.12, 7), orange, [0, 0.82, -0.15]);

  const torso = addMesh(body, rounded(0.66, 0.68, 0.4, 0.08), dark, [0, 1.28, 0]);
  addMesh(torso, rounded(0.5, 0.36, 0.09, 0.035), steel, [0, 0.1, -0.23]);
  addMesh(torso, new THREE.BoxGeometry(0.05, 0.3, 0.02), orange, [0, 0.06, -0.285]);
  addMesh(torso, new THREE.BoxGeometry(0.22, 0.035, 0.02), cyan, [0, -0.11, -0.29]);
  addMesh(body, rounded(0.5, 0.22, 0.34, 0.05), cloth, [0, 0.89, 0.02]);

  // shoulder pauldrons
  const padL = addMesh(body, rounded(0.26, 0.22, 0.38, 0.06), steel, [-0.4, 1.52, 0], [0, 0, -0.14]);
  const padR = addMesh(body, rounded(0.26, 0.22, 0.38, 0.06), steel, [0.4, 1.52, 0], [0, 0, 0.14]);
  addMesh(padL, new THREE.BoxGeometry(0.12, 0.025, 0.04), orange, [-0.04, 0.09, -0.18]);
  addMesh(padR, new THREE.BoxGeometry(0.12, 0.025, 0.04), orange, [0.04, 0.09, -0.18]);

  const helmet = addMesh(body, new THREE.SphereGeometry(0.225, 12, 9), dark, [0, 1.79, 0]);
  addMesh(helmet, new THREE.BoxGeometry(0.31, 0.075, 0.12), steel, [0, 0.005, -0.16]);
  addMesh(helmet, new THREE.BoxGeometry(0.26, 0.035, 0.02), orange, [0, 0.008, -0.226]);
  addMesh(helmet, new THREE.BoxGeometry(0.06, 0.12, 0.24), dark, [0, 0.2, 0.01]);
  addMesh(helmet, new THREE.BoxGeometry(0.02, 0.13, 0.02), cyan, [0.15, 0.1, -0.15]);

  // backpack
  addMesh(body, rounded(0.38, 0.45, 0.22, 0.05), steel, [0, 1.3, 0.28]);
  addMesh(body, new THREE.CylinderGeometry(0.04, 0.04, 0.38, 6), orange, [-0.13, 1.34, 0.39], [0.25, 0, 0]);
  addMesh(body, new THREE.CylinderGeometry(0.04, 0.04, 0.38, 6), orange, [0.13, 1.34, 0.39], [0.25, 0, 0]);

  const armL = makeArm(body, -0.44, 1.45, 0, 0.55, 0.105, dark, steel);
  const armR = makeArm(body, 0.44, 1.45, 0, 0.55, 0.105, dark, steel);
  armL.rotation.z = -0.05;
  armR.rotation.z = 0.17;
  addMesh(armL, new THREE.BoxGeometry(0.16, 0.24, 0.18), steel, [0, -0.38, 0]);
  addMesh(armR, new THREE.BoxGeometry(0.16, 0.24, 0.18), steel, [0, -0.38, 0]);
  addMesh(armR, new THREE.BoxGeometry(0.04, 0.04, 0.08), orange, [0.09, -0.42, -0.1]);

  const weapon = new THREE.Group();
  weapon.position.set(0.36, 1.12, -0.4);
  body.add(weapon);
  addMesh(weapon, rounded(0.16, 0.16, 0.95, 0.03), steel, [0, 0, -0.34]);
  addMesh(weapon, new THREE.BoxGeometry(0.06, 0.06, 0.72), dark, [0, 0.04, -0.73]);
  addMesh(weapon, new THREE.BoxGeometry(0.22, 0.22, 0.32), dark, [0, 0.02, -0.12]);
  addMesh(weapon, new THREE.BoxGeometry(0.2, 0.04, 0.22), orange, [0, 0.11, -0.2]);
  addMesh(weapon, new THREE.BoxGeometry(0.05, 0.15, 0.2), steel, [0, -0.13, -0.42]);
  addMesh(weapon, new THREE.CylinderGeometry(0.035, 0.035, 0.24, 6), cyan, [0.09, 0.03, -0.82], [PI / 2, 0, 0]);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.04, -1.12);
  weapon.add(muzzle);

  return {
    group,
    rig: { body, legL, legR, armL, armR, weapon, muzzle, head: helmet, scale: 1.03, type: 'cyber' }
  };
}

function makeCelestialPlayer() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const ivory = standard(0xeee5cd, { metalness: 0.45, roughness: 0.32 });
  const gold = standard(0xd4a94f, { metalness: 0.92, roughness: 0.2 });
  const goldGlow = glow(0xffd77a, 1.8);
  const teal = glow(0x6af4e3, 2.8);
  const dark = standard(0x2b3430, { metalness: 0.45, roughness: 0.5 });

  const legL = makeLimb(body, -0.16, 1.0, 0, 0.82, 0.105, ivory, gold);
  const legR = makeLimb(body, 0.16, 1.0, 0, 0.82, 0.105, ivory, gold);
  addMesh(legL, rounded(0.23, 0.2, 0.4, 0.05), gold, [0, -0.41, -0.06]);
  addMesh(legR, rounded(0.23, 0.2, 0.4, 0.05), gold, [0, -0.41, -0.06]);
  addMesh(body, rounded(0.45, 0.22, 0.34, 0.06), gold, [0, 0.93, 0]);

  const torso = addMesh(body, rounded(0.62, 0.68, 0.38, 0.09), ivory, [0, 1.3, 0]);
  addMesh(torso, rounded(0.34, 0.37, 0.05, 0.02), gold, [0, 0.04, -0.22]);
  addMesh(torso, new THREE.OctahedronGeometry(0.1, 0), teal, [0, 0.03, -0.27]);
  addMesh(torso, new THREE.BoxGeometry(0.03, 0.49, 0.03), goldGlow, [0, 0.04, -0.3]);
  addMesh(body, rounded(0.5, 0.18, 0.3, 0.04), gold, [0, 0.9, 0.01]);

  const padL = addMesh(body, new THREE.ConeGeometry(0.25, 0.42, 5), ivory, [-0.44, 1.56, 0], [0, 0, 0.55]);
  const padR = addMesh(body, new THREE.ConeGeometry(0.25, 0.42, 5), ivory, [0.44, 1.56, 0], [0, 0, -0.55]);
  addMesh(padL, new THREE.TorusGeometry(0.16, 0.018, 4, 16), goldGlow, [0, -0.06, 0], [PI / 2, 0, 0]);
  addMesh(padR, new THREE.TorusGeometry(0.16, 0.018, 4, 16), goldGlow, [0, -0.06, 0], [PI / 2, 0, 0]);

  const helmet = addMesh(body, new THREE.SphereGeometry(0.23, 12, 9), ivory, [0, 1.82, 0]);
  addMesh(helmet, new THREE.BoxGeometry(0.32, 0.08, 0.12), gold, [0, 0.005, -0.17]);
  addMesh(helmet, new THREE.BoxGeometry(0.27, 0.035, 0.02), teal, [0, 0.01, -0.235]);
  addMesh(helmet, new THREE.ConeGeometry(0.055, 0.34, 4), gold, [0, 0.28, 0.03]);
  addMesh(helmet, new THREE.ConeGeometry(0.035, 0.2, 4), gold, [-0.18, 0.16, 0.03], [0, 0, 0.55]);
  addMesh(helmet, new THREE.ConeGeometry(0.035, 0.2, 4), gold, [0.18, 0.16, 0.03], [0, 0, -0.55]);

  const halo = addMesh(body, new THREE.TorusGeometry(0.44, 0.014, 5, 48), goldGlow, [0, 1.9, 0.18], [0.2, 0, 0]);
  const armL = makeArm(body, -0.43, 1.46, 0.01, 0.55, 0.1, ivory, gold);
  const armR = makeArm(body, 0.43, 1.46, 0.01, 0.55, 0.1, ivory, gold);
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.15;

  // cape
  const capeMat = new THREE.MeshStandardMaterial({ color: 0x1c5b56, roughness: 0.72, metalness: 0.08, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const capeGeo = new THREE.PlaneGeometry(1.0, 1.05, 5, 8);
  const pos = capeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setZ(i, Math.sin((y + 0.5) * 4) * 0.045 + (0.5 - y) * 0.1);
    pos.setX(i, pos.getX(i) * (0.58 + (0.525 - y) * 0.42));
  }
  capeGeo.computeVertexNormals();
  const cape = addMesh(body, capeGeo, capeMat, [0, 1.08, 0.3], [0.1, 0, 0]);
  addMesh(cape, new THREE.BoxGeometry(0.98, 0.045, 0.04), gold, [0, -0.49, 0.01]);

  const weapon = new THREE.Group();
  weapon.position.set(0.38, 1.14, -0.42);
  body.add(weapon);
  addMesh(weapon, new THREE.CylinderGeometry(0.055, 0.07, 1.35, 6), gold, [0, 0, -0.55], [PI / 2, 0, 0]);
  addMesh(weapon, new THREE.ConeGeometry(0.09, 0.3, 6), ivory, [0, 0, -1.27], [-PI / 2, 0, 0]);
  addMesh(weapon, new THREE.BoxGeometry(0.16, 0.18, 0.34), ivory, [0, 0, -0.2]);
  addMesh(weapon, new THREE.BoxGeometry(0.2, 0.05, 0.18), teal, [0, 0.1, -0.3]);
  addMesh(weapon, new THREE.TorusGeometry(0.12, 0.018, 4, 20), goldGlow, [0, 0, -0.8], [PI / 2, 0, 0]);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -1.46);
  weapon.add(muzzle);

  return {
    group,
    rig: { body, legL, legR, armL, armR, weapon, muzzle, head: helmet, halo, cape, scale: 1.05, type: 'celestial' }
  };
}

function makeAscendedPlayer() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const dark = standard(0x1c2638, { metalness: 0.82, roughness: 0.22, emissive: 0x030a14, emissiveIntensity: 0.5 });
  const black = standard(0x0b111c, { metalness: 0.92, roughness: 0.14, emissive: 0x02060c, emissiveIntensity: 0.35 });
  const gold = standard(0xd8aa53, { metalness: 0.98, roughness: 0.16 });
  const goldGlow = glow(0xffcf72, 2.2);
  const cyan = glow(0x67f7ff, 3.4);
  const magenta = glow(0xff6bb5, 2.2);

  const legL = makeLimb(body, -0.17, 1.02, 0, 0.85, 0.11, dark, gold);
  const legR = makeLimb(body, 0.17, 1.02, 0, 0.85, 0.11, dark, gold);
  addMesh(legL, rounded(0.24, 0.21, 0.44, 0.05), black, [0, -0.43, -0.08]);
  addMesh(legR, rounded(0.24, 0.21, 0.44, 0.05), black, [0, -0.43, -0.08]);
  addMesh(legL, new THREE.BoxGeometry(0.28, 0.025, 0.2), goldGlow, [0, -0.43, -0.19]);
  addMesh(legR, new THREE.BoxGeometry(0.28, 0.025, 0.2), goldGlow, [0, -0.43, -0.19]);
  addMesh(body, rounded(0.49, 0.24, 0.37, 0.06), gold, [0, 0.95, 0]);

  const torso = addMesh(body, rounded(0.69, 0.7, 0.42, 0.09), dark, [0, 1.33, 0]);
  addMesh(torso, rounded(0.42, 0.39, 0.05, 0.02), black, [0, 0.04, -0.24]);
  addMesh(torso, new THREE.OctahedronGeometry(0.12, 0), cyan, [0, 0.03, -0.3]);
  addMesh(torso, new THREE.TorusGeometry(0.17, 0.012, 4, 24), goldGlow, [0, 0.03, -0.3], [0, 0, 0]);
  addMesh(torso, new THREE.BoxGeometry(0.035, 0.49, 0.035), gold, [-0.25, 0.05, -0.27]);
  addMesh(torso, new THREE.BoxGeometry(0.035, 0.49, 0.035), gold, [0.25, 0.05, -0.27]);
  addMesh(body, rounded(0.53, 0.2, 0.32, 0.05), gold, [0, 0.92, 0.01]);

  const padL = addMesh(body, rounded(0.3, 0.24, 0.44, 0.08), black, [-0.45, 1.61, 0], [0, 0, -0.16]);
  const padR = addMesh(body, rounded(0.3, 0.24, 0.44, 0.08), black, [0.45, 1.61, 0], [0, 0, 0.16]);
  addMesh(padL, new THREE.BoxGeometry(0.24, 0.025, 0.26), goldGlow, [0, 0.1, -0.11]);
  addMesh(padR, new THREE.BoxGeometry(0.24, 0.025, 0.26), goldGlow, [0, 0.1, -0.11]);

  const helmet = addMesh(body, new THREE.SphereGeometry(0.24, 14, 10), black, [0, 1.86, 0]);
  addMesh(helmet, new THREE.BoxGeometry(0.34, 0.09, 0.13), gold, [0, 0.01, -0.17]);
  addMesh(helmet, new THREE.BoxGeometry(0.28, 0.04, 0.03), cyan, [0, 0.012, -0.243]);
  addMesh(helmet, new THREE.ConeGeometry(0.06, 0.38, 4), gold, [0, 0.32, 0.02]);
  addMesh(helmet, new THREE.ConeGeometry(0.035, 0.24, 4), gold, [-0.19, 0.18, 0.02], [0, 0, 0.58]);
  addMesh(helmet, new THREE.ConeGeometry(0.035, 0.24, 4), gold, [0.19, 0.18, 0.02], [0, 0, -0.58]);
  addMesh(helmet, new THREE.OctahedronGeometry(0.04, 0), cyan, [0, 0.12, -0.21]);

  const halo1 = addMesh(body, new THREE.TorusGeometry(0.48, 0.012, 5, 56), goldGlow, [0, 1.95, 0.19], [0.24, 0, 0]);
  const halo2 = addMesh(body, new THREE.TorusGeometry(0.62, 0.006, 4, 56), cyan, [0, 1.62, 0.23], [0.1, 0, 0.3]);

  const armL = makeArm(body, -0.46, 1.49, 0.01, 0.58, 0.11, dark, black);
  const armR = makeArm(body, 0.46, 1.49, 0.01, 0.58, 0.11, dark, black);
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.14;
  addMesh(armL, new THREE.BoxGeometry(0.2, 0.24, 0.2), gold, [0, -0.39, 0]);
  addMesh(armR, new THREE.BoxGeometry(0.2, 0.24, 0.2), gold, [0, -0.39, 0]);
  addMesh(armR, new THREE.BoxGeometry(0.04, 0.05, 0.1), cyan, [0.11, -0.42, -0.1]);

  // energy wings
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -0.95, 0.2, 0.1, -0.5, -0.8, 0.15,
    0, 0, 0, -0.65, 0.35, 0.1, -0.22, -0.4, 0.2
  ], 3));
  wingGeo.setIndex([0, 1, 2, 3, 4, 5]);
  wingGeo.computeVertexNormals();
  const wingL = addMesh(body, wingGeo, additive(0xffcc66, 0.34), [-0.18, 1.48, 0.2], [0, 0, 0]);
  const wingGeo2 = wingGeo.clone();
  wingGeo2.scale(1, 1, 1);
  const wingR = addMesh(body, wingGeo2, additive(0x67f7ff, 0.26), [0.18, 1.48, 0.2], [0, PI, 0]);

  const capeMat = new THREE.MeshStandardMaterial({ color: 0x081a22, roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide, transparent: true, opacity: 0.95, emissive: 0x0c4c5a, emissiveIntensity: 0.25 });
  const capeGeo = new THREE.PlaneGeometry(1.2, 1.55, 7, 10);
  const pos = capeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((y + 0.8) * 4.5) * 0.06 + (0.8 - y) * 0.14);
    pos.setX(i, x * (1 - (y + 0.8) * 0.16));
  }
  capeGeo.computeVertexNormals();
  const cape = addMesh(body, capeGeo, capeMat, [0, 1.47, 0.33], [0.1, 0, 0]);
  addMesh(cape, new THREE.BoxGeometry(1.02, 0.045, 0.04), gold, [0, 0.76, 0.01]);

  const weapon = new THREE.Group();
  weapon.position.set(0.4, 1.15, -0.43);
  body.add(weapon);
  addMesh(weapon, rounded(0.18, 0.19, 1.18, 0.035), black, [0, 0, -0.44]);
  addMesh(weapon, new THREE.BoxGeometry(0.23, 0.28, 0.34), gold, [0, 0, -0.13]);
  addMesh(weapon, new THREE.BoxGeometry(0.06, 0.07, 0.92), cyan, [0, 0.065, -0.65]);
  addMesh(weapon, new THREE.BoxGeometry(0.04, 0.18, 0.34), gold, [0, -0.12, -0.55]);
  addMesh(weapon, new THREE.TorusGeometry(0.14, 0.018, 4, 24), goldGlow, [0, 0, -0.93], [PI / 2, 0, 0]);
  addMesh(weapon, new THREE.ConeGeometry(0.08, 0.28, 6), gold, [0, 0, -1.16], [-PI / 2, 0, 0]);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -1.32);
  weapon.add(muzzle);

  const aura = addMesh(body, new THREE.TorusGeometry(0.73, 0.006, 4, 72), basic(0x67f7ff, { transparent: true, opacity: 0.24 }), [0, 0.45, 0.1], [PI / 2, 0, 0]);

  return {
    group,
    rig: { body, legL, legR, armL, armR, weapon, muzzle, head: helmet, halo1, halo2, wingL, wingR, cape, aura, scale: 1.08, type: 'ascended' }
  };
}

export function buildPlayer(era) {
  const built = [
    makeStickPlayer,
    makeGeoPlayer,
    makeNeonPlayer,
    makeCyberPlayer,
    makeCelestialPlayer,
    makeAscendedPlayer
  ][Math.min(5, Math.max(0, era))]();
  built.group.traverse(obj => {
    if (obj.isMesh) { obj.castShadow = era >= 2; obj.receiveShadow = false; }
  });
  return built;
}

/* ─────────────────────────── ENEMIES ─────────────────────────── */
function stickEnemy(type) {
  const group = new THREE.Group();
  const ink = basic(0x211b16);
  const red = basic(0xc23d2a);
  const body = new THREE.Group();
  group.add(body);
  const big = type === 'tank';
  const s = big ? 1.45 : type === 'runner' ? 0.82 : 1;
  body.scale.setScalar(s);
  const legL = makeLimb(body, -0.12, 0.87, 0, 0.74, 0.024, ink);
  const legR = makeLimb(body, 0.12, 0.87, 0, 0.74, 0.024, ink);
  addMesh(body, new THREE.CylinderGeometry(0.026, 0.04, big ? 0.75 : 0.66, 5), ink, [0, 1.2, 0]);
  addMesh(body, new THREE.TorusGeometry(big ? 0.2 : 0.155, 0.025, 5, 18), ink, [0, 1.71, 0]);
  addMesh(body, new THREE.CircleGeometry(big ? 0.16 : 0.125, 14), basic(0xf1e8da), [0, 1.71, 0.004]);
  const eyeY = type === 'runner' ? 1.69 : 1.72;
  addMesh(body, new THREE.SphereGeometry(0.026, 5, 4), red, [-0.05, eyeY, -0.015]);
  addMesh(body, new THREE.SphereGeometry(0.026, 5, 4), red, [0.05, eyeY, -0.015]);
  if (type === 'tank') {
    addMesh(body, new THREE.CylinderGeometry(0.045, 0.045, 0.38, 5), ink, [0, 1.15, 0.03], [0, 0, 0.9]);
    addMesh(body, new THREE.TorusGeometry(0.28, 0.018, 4, 20), red, [0, 1.25, 0.02]);
  }
  if (type === 'gunner' || type === 'tank') {
    addMesh(body, new THREE.BoxGeometry(0.07, 0.07, 0.48), ink, [0.15, 1.24, -0.25]);
    addMesh(body, new THREE.SphereGeometry(0.04, 5, 4), red, [0.15, 1.24, -0.5]);
  }
  if (type === 'runner') {
    addMesh(body, new THREE.TorusGeometry(0.24, 0.008, 4, 20), red, [0, 1.2, 0.04], [0, 0, 0]);
  }
  const armL = makeLimb(body, -0.23, 1.45, 0, 0.5, 0.018, ink);
  const armR = makeLimb(body, 0.23, 1.45, 0, 0.5, 0.018, ink);
  armL.rotation.z = 0.18;
  armR.rotation.z = -0.18;
  return { group, rig: { body, legL, legR, armL, armR, type: 'stick' } };
}

function geoEnemy(type) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const big = type === 'tank';
  const s = big ? 1.38 : type === 'runner' ? 0.84 : 1;
  body.scale.setScalar(s);
  const main = flat(type === 'gunner' ? 0x3b64d8 : type === 'runner' ? 0xff4b28 : 0x1b2238);
  const cut = flat(type === 'glass' ? 0x55e7ff : 0xf7d65a);
  addMesh(body, new THREE.OctahedronGeometry(big ? 0.6 : 0.44, 0), main, [0, 1.15, 0], [0.2, 0.3, 0]);
  const head = addMesh(body, new THREE.TetrahedronGeometry(big ? 0.35 : 0.26, 0), cut, [0, 1.72, -0.02], [0.4, 0, 0.2]);
  addMesh(head, new THREE.BoxGeometry(0.18, 0.035, 0.03), basic(0x10131e), [0, -0.01, -0.2]);
  addMesh(body, new THREE.ConeGeometry(0.26, 0.32, 3), main, [-0.5, 1.32, 0], [0, 0, 0.7]);
  addMesh(body, new THREE.ConeGeometry(0.26, 0.32, 3), main, [0.5, 1.32, 0], [0, 0, -0.7]);
  addMesh(body, new THREE.BoxGeometry(0.13, 0.62, 0.2), main, [-0.2, 0.55, 0], [0, 0, 0.08]);
  addMesh(body, new THREE.BoxGeometry(0.13, 0.62, 0.2), main, [0.2, 0.55, 0], [0, 0, -0.08]);
  if (type === 'gunner' || type === 'tank') {
    addMesh(body, new THREE.BoxGeometry(0.18, 0.18, 0.65), flat(0x111522), [0, 1.18, -0.5]);
    addMesh(body, new THREE.BoxGeometry(0.13, 0.13, 0.16), glow(0xff4b28, 2), [0, 1.18, -0.92]);
  }
  if (type === 'runner') addMesh(body, new THREE.TorusGeometry(0.5, 0.015, 4, 24), flat(0x0b69ff), [0, 1.2, 0], [PI / 2, 0, 0]);
  return { group, rig: { body, head, type: 'geo' } };
}

function neonEnemy(type) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const big = type === 'tank';
  const s = big ? 1.4 : type === 'runner' ? 0.82 : 1;
  body.scale.setScalar(s);
  const dark = standard(0x070a1e, { metalness: 0.7, roughness: 0.24 });
  const main = glow(type === 'gunner' ? 0x00f0ff : type === 'runner' ? 0xff2d95 : 0xff416f, 3);
  const alt = glow(0xffffff, 2);
  const core = addMesh(body, new THREE.IcosahedronGeometry(big ? 0.55 : 0.4, 1), dark, [0, 1.15, 0]);
  addMesh(core, new THREE.IcosahedronGeometry(big ? 0.43 : 0.3, 0), main, [0, 0, 0], [0, 0, 0], [1, 1, 0.8]);
  addMesh(body, new THREE.OctahedronGeometry(0.1, 0), alt, [0, 1.15, -0.4]);
  const ring1 = addMesh(body, new THREE.TorusGeometry(big ? 0.74 : 0.55, 0.018, 4, 42), main, [0, 1.15, 0], [PI / 2.8, 0, 0]);
  const ring2 = addMesh(body, new THREE.TorusGeometry(big ? 0.66 : 0.48, 0.012, 4, 42), main, [0, 1.15, 0], [PI / 2, 0, 0.5]);
  addMesh(body, new THREE.ConeGeometry(0.16, 0.52, 5), dark, [-0.56, 1.05, 0], [0, 0, 0.7]);
  addMesh(body, new THREE.ConeGeometry(0.16, 0.52, 5), dark, [0.56, 1.05, 0], [0, 0, -0.7]);
  if (type === 'gunner' || type === 'tank') {
    addMesh(body, new THREE.CylinderGeometry(0.1, 0.13, 0.62, 7), dark, [0, 1.15, -0.48], [PI / 2, 0, 0]);
    addMesh(body, new THREE.CylinderGeometry(0.06, 0.04, 0.28, 6), main, [0, 1.15, -0.88], [PI / 2, 0, 0]);
  }
  if (type === 'runner') {
    addMesh(body, new THREE.ConeGeometry(0.22, 0.75, 3), main, [0, 1.15, 0.32], [PI / 2, 0, 0]);
  }
  return { group, rig: { body, ring1, ring2, type: 'neon' } };
}

function cyberEnemy(type) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const big = type === 'tank';
  const s = big ? 1.45 : type === 'runner' ? 0.82 : 1;
  body.scale.setScalar(s);
  const steel = standard(0x263038, { metalness: 0.8, roughness: 0.38 });
  const black = standard(0x0d1318, { metalness: 0.65, roughness: 0.42 });
  const orange = glow(0xff8a1f, 3);
  addMesh(body, rounded(0.75, 0.72, 0.48, 0.08), black, [0, 1.14, 0]);
  addMesh(body, rounded(0.56, 0.36, 0.1, 0.04), steel, [0, 1.22, -0.27]);
  addMesh(body, new THREE.BoxGeometry(0.36, 0.05, 0.02), orange, [0, 1.18, -0.33]);
  addMesh(body, rounded(0.38, 0.26, 0.26, 0.06), steel, [0, 0.71, 0]);
  addMesh(body, rounded(0.26, 0.24, 0.28, 0.06), black, [-0.2, 1.54, 0]);
  addMesh(body, rounded(0.26, 0.24, 0.28, 0.06), black, [0.2, 1.54, 0]);
  addMesh(body, new THREE.SphereGeometry(0.22, 10, 8), steel, [0, 1.68, 0]);
  addMesh(body, new THREE.BoxGeometry(0.28, 0.065, 0.12), black, [0, 1.68, -0.15]);
  addMesh(body, new THREE.BoxGeometry(0.23, 0.03, 0.02), orange, [0, 1.68, -0.22]);
  addMesh(body, new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6), orange, [0, 1.84, 0.02]);
  addMesh(body, rounded(0.18, 0.6, 0.24, 0.04), steel, [-0.26, 0.42, 0]);
  addMesh(body, rounded(0.18, 0.6, 0.24, 0.04), steel, [0.26, 0.42, 0]);
  addMesh(body, rounded(0.2, 0.18, 0.34, 0.04), black, [-0.26, 0.1, -0.05]);
  addMesh(body, rounded(0.2, 0.18, 0.34, 0.04), black, [0.26, 0.1, -0.05]);
  if (type === 'gunner' || type === 'tank') {
    addMesh(body, rounded(0.18, 0.18, 0.68, 0.035), steel, [0, 1.15, -0.53]);
    addMesh(body, new THREE.CylinderGeometry(0.055, 0.055, 0.44, 6), black, [0, 1.15, -0.94], [PI / 2, 0, 0]);
    addMesh(body, new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), orange, [0, 1.15, -1.18], [PI / 2, 0, 0]);
  }
  if (type === 'runner') {
    addMesh(body, new THREE.BoxGeometry(0.05, 0.65, 0.28), orange, [0, 1.72, 0.15], [0.5, 0, 0]);
  }
  return { group, rig: { body, type: 'cyber' } };
}

function celestialEnemy(type) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const big = type === 'tank';
  const s = big ? 1.4 : type === 'runner' ? 0.84 : 1;
  body.scale.setScalar(s);
  const ivory = standard(0xe8ddc0, { metalness: 0.4, roughness: 0.34 });
  const gold = standard(0xe0b95f, { metalness: 0.9, roughness: 0.2 });
  const teal = glow(0x6af4e3, 2.8);
  const core = addMesh(body, new THREE.IcosahedronGeometry(big ? 0.56 : 0.4, 0), standard(0x334e50, { metalness: 0.6, roughness: 0.3 }), [0, 1.18, 0]);
  addMesh(core, new THREE.OctahedronGeometry(big ? 0.33 : 0.24, 0), teal, [0, 0, -0.24], [0, 0, 0]);
  const ring1 = addMesh(body, new THREE.TorusGeometry(big ? 0.78 : 0.56, 0.02, 5, 42), gold, [0, 1.18, 0], [PI / 2.2, 0, 0]);
  addMesh(body, new THREE.TorusGeometry(big ? 0.66 : 0.46, 0.012, 4, 42), gold, [0, 1.18, 0], [PI / 2, 0, 0.8]);
  addMesh(body, new THREE.ConeGeometry(0.2, 0.72, 4), ivory, [-0.58, 1.16, 0.05], [0, 0, 0.8]);
  addMesh(body, new THREE.ConeGeometry(0.2, 0.72, 4), ivory, [0.58, 1.16, 0.05], [0, 0, -0.8]);
  addMesh(body, new THREE.ConeGeometry(0.11, 0.48, 5), gold, [0, 1.74, 0.02]);
  if (type === 'gunner' || type === 'tank') {
    addMesh(body, new THREE.CylinderGeometry(0.12, 0.08, 0.66, 6), gold, [0, 1.18, -0.5], [PI / 2, 0, 0]);
    addMesh(body, new THREE.TorusGeometry(0.18, 0.015, 4, 20), teal, [0, 1.18, -0.84], [PI / 2, 0, 0]);
  }
  if (type === 'runner') addMesh(body, new THREE.ConeGeometry(0.25, 0.9, 3), teal, [0, 1.18, 0.35], [PI / 2, 0, 0]);
  return { group, rig: { body, ring1, core, type: 'celestial' } };
}

function ascendedEnemy(type) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const big = type === 'tank';
  const s = big ? 1.42 : type === 'runner' ? 0.82 : 1;
  body.scale.setScalar(s);
  const black = standard(0x05070e, { metalness: 0.85, roughness: 0.2 });
  const gold = standard(0xcaa155, { metalness: 0.96, roughness: 0.17 });
  const goldGlow = glow(0xffcc66, 2.6);
  const cyan = glow(0x67f7ff, 3.4);
  const core = addMesh(body, new THREE.IcosahedronGeometry(big ? 0.6 : 0.44, 1), black, [0, 1.2, 0]);
  addMesh(body, new THREE.OctahedronGeometry(big ? 0.42 : 0.3, 0), black, [0, 1.2, 0]);
  addMesh(core, new THREE.OctahedronGeometry(big ? 0.15 : 0.115, 0), cyan, [0, 0, -0.43]);
  const ring1 = addMesh(body, new THREE.TorusGeometry(big ? 0.85 : 0.62, 0.02, 4, 48), gold, [0, 1.2, 0], [PI / 2.6, 0, 0.2]);
  const ring2 = addMesh(body, new THREE.TorusGeometry(big ? 0.72 : 0.51, 0.011, 4, 48), goldGlow, [0, 1.2, 0], [PI / 2, 0, -0.6]);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -0.92, 0.22, 0.1, -0.52, -0.7, 0.1,
    0, 0, 0, -0.68, 0.28, 0.1, -0.18, -0.38, 0.15
  ], 3));
  wingGeo.setIndex([0, 1, 2, 3, 4, 5]);
  wingGeo.computeVertexNormals();
  const wingL = addMesh(body, wingGeo, additive(0xffcc66, 0.26), [-0.18, 1.38, 0.18]);
  const wingR = addMesh(body, wingGeo.clone(), additive(0x67f7ff, 0.22), [0.18, 1.38, 0.18], [0, PI, 0]);
  addMesh(body, new THREE.ConeGeometry(0.08, 0.48, 4), gold, [0, 1.82, 0.05]);
  addMesh(body, new THREE.ConeGeometry(0.045, 0.35, 4), gold, [-0.2, 1.7, 0.05], [0, 0, 0.6]);
  addMesh(body, new THREE.ConeGeometry(0.045, 0.35, 4), gold, [0.2, 1.7, 0.05], [0, 0, -0.6]);
  if (type === 'gunner' || type === 'tank') {
    addMesh(body, new THREE.CylinderGeometry(0.11, 0.08, 0.7, 6), gold, [0, 1.2, -0.54], [PI / 2, 0, 0]);
    addMesh(body, new THREE.TorusGeometry(0.16, 0.015, 4, 20), cyan, [0, 1.2, -0.9], [PI / 2, 0, 0]);
  }
  if (type === 'runner') addMesh(body, new THREE.ConeGeometry(0.28, 1.0, 3), goldGlow, [0, 1.2, 0.4], [PI / 2, 0, 0]);
  return { group, rig: { body, ring1, ring2, wingL, wingR, core, type: 'ascended' } };
}

export function buildEnemy(era, type = 'grunt') {
  const built = [stickEnemy, geoEnemy, neonEnemy, cyberEnemy, celestialEnemy, ascendedEnemy][Math.min(5, Math.max(0, era))](type);
  built.group.traverse(obj => { if (obj.isMesh) { obj.castShadow = era >= 2; obj.receiveShadow = false; } });
  built.group.userData.enemyRig = built.rig;
  return built;
}

/* ─────────────────────────── BOSS ─────────────────────────── */
export function buildBoss(era) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const accent = ['#cf432d', '#ff4b28', '#ff2d95', '#ff8a1f', '#e3bc6a', '#ffcc66'][era];
  const accent2 = ['#171512', '#0b69ff', '#00f0ff', '#3ed7ff', '#6af4e3', '#67f7ff'][era];

  if (era === 0) {
    const ink = basic(0x18130f);
    const red = basic(0xb53625);
    body.scale.setScalar(2.2);
    makeLimb(body, -0.22, 0.9, 0, 0.9, 0.055, ink);
    makeLimb(body, 0.22, 0.9, 0, 0.9, 0.055, ink);
    addMesh(body, new THREE.CylinderGeometry(0.08, 0.11, 1.1, 6), ink, [0, 1.4, 0]);
    addMesh(body, new THREE.TorusGeometry(0.33, 0.05, 6, 22), ink, [0, 2.1, 0]);
    addMesh(body, new THREE.CircleGeometry(0.27, 20), basic(0xf6edde), [0, 2.1, 0.01]);
    addMesh(body, new THREE.SphereGeometry(0.07, 6, 4), red, [-0.1, 2.12, -0.03]);
    addMesh(body, new THREE.SphereGeometry(0.07, 6, 4), red, [0.1, 2.12, -0.03]);
    addMesh(body, new THREE.TorusGeometry(0.7, 0.035, 4, 20), red, [0, 1.7, 0], [PI / 2, 0, 0]);
    const armL = makeLimb(body, -0.5, 1.82, 0, 0.85, 0.045, ink);
    const armR = makeLimb(body, 0.5, 1.82, 0, 0.85, 0.045, ink);
    armL.rotation.z = -0.5; armR.rotation.z = 0.5;
    addMesh(body, new THREE.BoxGeometry(0.12, 0.12, 1.0), ink, [0.4, 1.7, -0.55]);
    addMesh(body, new THREE.TorusGeometry(0.15, 0.03, 4, 16), red, [0.4, 1.7, -1.05]);
    addMesh(body, new THREE.ConeGeometry(0.18, 0.55, 3), red, [0, 2.55, 0]);
    group.userData.rings = [];
  } else if (era === 1) {
    const dark = flat(0x171a2b);
    const warm = flat(0xff4b28);
    const blue = flat(0x0b69ff);
    body.scale.setScalar(1.6);
    addMesh(body, new THREE.DodecahedronGeometry(1.1, 0), dark, [0, 1.55, 0], [0.2, 0.3, 0]);
    addMesh(body, new THREE.OctahedronGeometry(0.52, 0), warm, [0, 1.55, -0.7], [0, 0, PI / 4]);
    addMesh(body, new THREE.TetrahedronGeometry(0.42, 0), blue, [-0.9, 1.9, 0.1], [0.4, 0, 0.2]);
    addMesh(body, new THREE.TetrahedronGeometry(0.36, 0), warm, [0.95, 1.3, 0.1], [0, 0.4, 0.2]);
    const ring1 = addMesh(body, new THREE.TorusGeometry(1.5, 0.045, 4, 40), warm, [0, 1.6, 0], [PI / 2.4, 0, 0]);
    const ring2 = addMesh(body, new THREE.TorusGeometry(1.3, 0.03, 4, 40), blue, [0, 1.6, 0], [PI / 2, 0, 0.6]);
    group.userData.rings = [ring1, ring2];
    addMesh(body, new THREE.ConeGeometry(0.17, 0.8, 4), dark, [-1.25, 1.6, 0], [0, 0, 0.9]);
    addMesh(body, new THREE.ConeGeometry(0.17, 0.8, 4), dark, [1.25, 1.6, 0], [0, 0, -0.9]);
  } else if (era === 2) {
    const dark = standard(0x070a1e, { metalness: 0.8, roughness: 0.25 });
    const pink = glow(0xff2d95, 3.5);
    const cyan = glow(0x00f0ff, 3.5);
    body.scale.setScalar(1.65);
    addMesh(body, new THREE.OctahedronGeometry(1.2, 0), dark, [0, 1.6, 0]);
    addMesh(body, new THREE.OctahedronGeometry(0.78, 1), pink, [0, 1.6, 0], [0, 0, 0], [0.8, 0.8, 0.8]);
    addMesh(body, new THREE.IcosahedronGeometry(0.25, 0), cyan, [0, 1.6, -0.92]);
    const ring1 = addMesh(body, new THREE.TorusGeometry(1.55, 0.04, 4, 56), pink, [0, 1.6, 0], [PI / 2.4, 0, 0]);
    const ring2 = addMesh(body, new THREE.TorusGeometry(1.32, 0.025, 4, 56), cyan, [0, 1.6, 0], [PI / 2, 0, 0.6]);
    const ring3 = addMesh(body, new THREE.TorusGeometry(1.8, 0.015, 4, 56), pink, [0, 1.6, 0], [0.4, 0, 1.1]);
    group.userData.rings = [ring1, ring2, ring3];
    addMesh(body, new THREE.ConeGeometry(0.2, 1.4, 3), dark, [-1.35, 1.6, 0], [0, 0, 0.8]);
    addMesh(body, new THREE.ConeGeometry(0.2, 1.4, 3), dark, [1.35, 1.6, 0], [0, 0, -0.8]);
    addMesh(body, new THREE.ConeGeometry(0.34, 1.2, 4), cyan, [0, 2.8, 0]);
  } else if (era === 3) {
    const steel = standard(0x26313a, { metalness: 0.85, roughness: 0.32 });
    const black = standard(0x0c1218, { metalness: 0.7, roughness: 0.4 });
    const orange = glow(0xff8a1f, 3.4);
    body.scale.setScalar(1.55);
    addMesh(body, rounded(1.8, 1.65, 0.9, 0.13), black, [0, 1.7, 0]);
    addMesh(body, rounded(1.25, 0.7, 0.24, 0.08), steel, [0, 1.95, -0.55]);
    addMesh(body, new THREE.BoxGeometry(0.7, 0.08, 0.03), orange, [0, 1.95, -0.69]);
    addMesh(body, new THREE.SphereGeometry(0.36, 10, 8), steel, [0, 2.7, 0]);
    addMesh(body, new THREE.BoxGeometry(0.44, 0.09, 0.18), black, [0, 2.7, -0.28]);
    addMesh(body, new THREE.BoxGeometry(0.36, 0.035, 0.03), orange, [0, 2.7, -0.38]);
    addMesh(body, new THREE.CylinderGeometry(0.14, 0.2, 0.8, 6), orange, [0, 3.12, 0.03]);
    addMesh(body, rounded(0.75, 0.62, 0.8, 0.1), steel, [-1.05, 2.2, 0], [0, 0, -0.2]);
    addMesh(body, rounded(0.75, 0.62, 0.8, 0.1), steel, [1.05, 2.2, 0], [0, 0, 0.2]);
    addMesh(body, new THREE.CylinderGeometry(0.18, 0.18, 1.8, 7), steel, [-1.45, 1.65, -0.35], [PI / 2, 0, 0], [1, 1, 1]);
    addMesh(body, new THREE.CylinderGeometry(0.22, 0.22, 1.4, 7), black, [1.45, 1.65, -0.25], [PI / 2, 0, 0]);
    addMesh(body, new THREE.CylinderGeometry(0.28, 0.28, 0.16, 8), orange, [1.45, 1.65, -0.98], [PI / 2, 0, 0]);
    const ring1 = addMesh(body, new THREE.TorusGeometry(1.7, 0.03, 4, 48), orange, [0, 1.6, 0], [PI / 2.3, 0, 0.3]);
    group.userData.rings = [ring1];
    addMesh(body, rounded(0.9, 1.1, 0.9, 0.12), black, [0, 0.58, 0]);
    addMesh(body, rounded(0.5, 0.8, 0.7, 0.08), steel, [-0.72, 0.5, 0]);
    addMesh(body, rounded(0.5, 0.8, 0.7, 0.08), steel, [0.72, 0.5, 0]);
  } else if (era === 4) {
    const ivory = standard(0xece2c8, { metalness: 0.45, roughness: 0.32 });
    const gold = standard(0xdfb65f, { metalness: 0.94, roughness: 0.18 });
    const teal = glow(0x6af4e3, 3.2);
    body.scale.setScalar(1.6);
    addMesh(body, new THREE.IcosahedronGeometry(1.0, 0), standard(0x2d4849, { metalness: 0.6, roughness: 0.3 }), [0, 1.8, 0]);
    addMesh(body, new THREE.OctahedronGeometry(0.48, 0), teal, [0, 1.8, -0.8]);
    addMesh(body, new THREE.ConeGeometry(0.28, 1.6, 4), gold, [0, 3.15, 0]);
    addMesh(body, new THREE.TorusGeometry(1.75, 0.035, 4, 56), gold, [0, 1.8, 0], [PI / 2.3, 0, 0]);
    addMesh(body, new THREE.TorusGeometry(1.45, 0.018, 4, 56), teal, [0, 1.8, 0], [PI / 2, 0, 0.65]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      addMesh(body, new THREE.ConeGeometry(0.25, 1.4, 4), ivory, [Math.cos(a) * 1.55, 1.8 + Math.sin(a) * 0.35, 0], [0, 0, -a + PI / 2]);
    }
    const ring1 = addMesh(body, new THREE.TorusGeometry(2.0, 0.02, 4, 60), gold, [0, 1.8, 0], [0.4, 0, 0.4]);
    group.userData.rings = [ring1];
    addMesh(body, new THREE.CylinderGeometry(0.14, 0.1, 1.9, 6), gold, [1.35, 1.5, -0.55], [PI / 2, 0, 0.2]);
    addMesh(body, new THREE.TorusGeometry(0.25, 0.03, 4, 24), teal, [1.35, 1.5, -1.45], [PI / 2, 0, 0]);
  } else {
    const black = standard(0x04060b, { metalness: 0.92, roughness: 0.15 });
    const dark = standard(0x0c1420, { metalness: 0.75, roughness: 0.25 });
    const gold = standard(0xd9ad55, { metalness: 0.98, roughness: 0.14 });
    const goldGlow = glow(0xffcc66, 2.8);
    const cyan = glow(0x67f7ff, 3.5);
    body.scale.setScalar(1.7);
    addMesh(body, new THREE.DodecahedronGeometry(1.15, 0), dark, [0, 1.9, 0], [0.15, 0.2, 0]);
    addMesh(body, new THREE.IcosahedronGeometry(0.58, 0), black, [0, 1.9, -0.4]);
    addMesh(body, new THREE.OctahedronGeometry(0.3, 0), cyan, [0, 1.9, -0.94]);
    addMesh(body, new THREE.TorusGeometry(0.42, 0.022, 4, 32), goldGlow, [0, 1.9, -0.94], [0, 0, 0]);
    const ring1 = addMesh(body, new THREE.TorusGeometry(1.7, 0.035, 4, 64), gold, [0, 1.9, 0], [PI / 2.3, 0, 0.2]);
    const ring2 = addMesh(body, new THREE.TorusGeometry(1.45, 0.022, 4, 64), cyan, [0, 1.9, 0], [PI / 2, 0, 0.7]);
    const ring3 = addMesh(body, new THREE.TorusGeometry(2.05, 0.013, 4, 64), goldGlow, [0, 1.9, 0], [0.5, 0, 1.1]);
    group.userData.rings = [ring1, ring2, ring3];
    addMesh(body, new THREE.ConeGeometry(0.4, 1.5, 4), black, [0, 3.15, 0]);
    for (let i = 0; i < 3; i++) {
      addMesh(body, new THREE.ConeGeometry(0.14, 0.8 + i * 0.2, 4), gold, [(i - 1) * 0.42, 2.95, 0.04], [0, 0, (i - 1) * 0.3]);
    }
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, -1.55, 0.4, 0.1, -0.8, -1.3, 0.15,
      0, 0, 0, -1.0, 0.6, 0.1, -0.3, -0.7, 0.18
    ], 3));
    wingGeo.setIndex([0, 1, 2, 3, 4, 5]);
    wingGeo.computeVertexNormals();
    addMesh(body, wingGeo, additive(0xffcc66, 0.3), [-0.4, 2.2, 0.25]);
    addMesh(body, wingGeo.clone(), additive(0x67f7ff, 0.24), [0.4, 2.2, 0.25], [0, PI, 0]);
    addMesh(body, new THREE.CylinderGeometry(0.18, 0.12, 2.4, 6), gold, [1.25, 1.7, -0.65], [PI / 2, 0, 0.15]);
    addMesh(body, new THREE.CylinderGeometry(0.28, 0.2, 0.35, 8), black, [1.25, 1.7, -0.4], [PI / 2, 0, 0.15]);
    addMesh(body, new THREE.CylinderGeometry(0.24, 0.16, 1.8, 6), gold, [-1.25, 1.7, -0.55], [PI / 2, 0, -0.15]);
    addMesh(body, new THREE.TorusGeometry(0.26, 0.032, 4, 28), cyan, [1.25, 1.7, -1.86], [PI / 2, 0, 0]);
  }

  group.userData.bossRings = group.userData.rings || [];
  group.traverse(obj => { if (obj.isMesh) { obj.castShadow = era >= 2; } });
  return group;
}

/* ─────────────────────────── GATES ─────────────────────────── */
function gateLabel(def) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 280;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 640, 280);
  ctx.fillStyle = 'rgba(5,8,14,.92)';
  ctx.fillRect(16, 22, 608, 236);
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 22, 608, 236);
  ctx.fillStyle = def.color;
  ctx.fillRect(16, 22, 11, 236);
  ctx.font = '600 74px Orbitron, Arial';
  ctx.fillStyle = def.color;
  ctx.textAlign = 'left';
  ctx.fillText(def.icon, 52, 122);
  ctx.font = '700 50px Rajdhani, Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(def.title, 148, 106);
  ctx.font = '600 27px Rajdhani, Arial';
  ctx.fillStyle = 'rgba(255,255,255,.62)';
  ctx.fillText(def.desc.toUpperCase(), 150, 150);
  ctx.fillStyle = def.color;
  ctx.fillRect(150, 180, 410, 2);
  ctx.font = '600 24px Orbitron, Arial';
  ctx.fillStyle = def.color;
  ctx.fillText('SELECT GATE', 150, 220);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildGate(def) {
  const group = new THREE.Group();
  const color = new THREE.Color(def.color);
  const frame = standard(color.getHex(), { metalness: 0.65, roughness: 0.28, emissive: color.getHex(), emissiveIntensity: 1.9 });
  const dark = standard(0x090d16, { metalness: 0.75, roughness: 0.35 });
  const w = 2.42;
  const h = 2.1;
  addMesh(group, rounded(0.1, h, 0.16, 0.02), frame, [-w / 2, h / 2, 0]);
  addMesh(group, rounded(0.1, h, 0.16, 0.02), frame, [w / 2, h / 2, 0]);
  addMesh(group, rounded(w + 0.1, 0.11, 0.16, 0.02), frame, [0, h, 0]);
  addMesh(group, rounded(w - 0.08, 0.055, 0.09, 0.01), frame, [0, 0.06, 0]);
  addMesh(group, new THREE.BoxGeometry(w - 0.14, h - 0.12, 0.02), new THREE.MeshBasicMaterial({ color: color.getHex(), transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide }), [0, h / 2, 0]);
  const planeMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
      void main(){ float scan=sin(vUv.y*42.0-uTime*3.2)*.5+.5; float edge=smoothstep(.0,.12,vUv.x)*smoothstep(1.0,.88,vUv.x);
      float b=pow(1.0-abs(vUv.y-.5)*2.0,3.0); gl_FragColor=vec4(uColor, (.045+scan*.04+b*.06)*edge); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  addMesh(group, new THREE.PlaneGeometry(w - 0.17, h - 0.14), planeMat, [0, h / 2, 0]);
  const spriteMat = new THREE.SpriteMaterial({ map: gateLabel(def), transparent: true, depthTest: true, depthWrite: false });
  const label = new THREE.Sprite(spriteMat);
  label.position.set(0, h + 0.8, 0);
  label.scale.set(2.02, .885, 1);
  group.add(label);
  const gem = addMesh(group, new THREE.OctahedronGeometry(0.18, 0), glow(color.getHex(), 3.2), [0, h + 0.1, 0], [0, 0, 0]);
  const glow1 = glowSprite(def.color, 2.9, 0.35);
  glow1.position.set(0, h * 0.55, 0.12);
  group.add(glow1);
  const groundRing = addMesh(group, new THREE.TorusGeometry(w * 0.44, 0.025, 4, 40), basic(color.getHex(), { transparent: true, opacity: 0.65 }), [0, 0.03, 0], [PI / 2, 0, 0]);
  group.userData.gate = { planeMat, gem, label, color, groundRing, def, glow1 };
  return group;
}

/* ─────────────────────────── PICKUPS / FX ─────────────────────────── */
export function buildCorePickup(color = '#67f7ff') {
  const group = new THREE.Group();
  const mat = glow(new THREE.Color(color).getHex(), 3.2);
  addMesh(group, new THREE.OctahedronGeometry(0.14, 0), mat, [0, 0, 0]);
  addMesh(group, new THREE.TorusGeometry(0.23, 0.008, 4, 24), basic(new THREE.Color(color).getHex(), { transparent: true, opacity: 0.5 }), [0, 0, 0], [PI / 2, 0, 0]);
  const g = glowSprite(color, 0.8, 0.45);
  group.add(g);
  return group;
}

export function buildShieldPickup(color = '#68a7ff') {
  return buildCorePickup(color);
}
