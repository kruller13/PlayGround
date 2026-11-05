import * as THREE from 'three';

const MAX = 720;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.gravity = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.base = new Float32Array(MAX * 3);
    this.cursor = 0;
    for (let i = 0; i < MAX; i++) this.positions[i * 3 + 1] = -999;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.mat = new THREE.PointsMaterial({
      size: .14,
      vertexColors: true,
      transparent: true,
      opacity: .95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setEra(era) {
    this.era = era;
    this.mat.blending = era >= 2 ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.mat.size = [.075, .1, .13, .14, .15, .16][era];
    this.mat.opacity = era >= 2 ? .95 : .8;
    this.mat.needsUpdate = true;
  }

  spawn(position, color, count = 10, speed = 5, opts = {}) {
    const c = new THREE.Color(color);
    const life = opts.life ?? .6;
    const spread = opts.spread ?? .35;
    const upward = opts.upward ?? .3;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      const i3 = i * 3;
      this.positions[i3] = position.x + (Math.random() - .5) * spread;
      this.positions[i3 + 1] = position.y + (Math.random() - .5) * spread + (opts.yOffset || 0);
      this.positions[i3 + 2] = position.z + (Math.random() - .5) * spread;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const v = speed * (.35 + Math.random() * .9);
      this.vel[i3] = Math.sin(phi) * Math.cos(theta) * v;
      this.vel[i3 + 1] = Math.abs(Math.cos(phi)) * v * .7 + upward * speed;
      this.vel[i3 + 2] = Math.sin(phi) * Math.sin(theta) * v;
      this.life[i] = this.maxLife[i] = life * (.55 + Math.random() * .8);
      this.gravity[i] = opts.gravity ?? 5;
      this.drag[i] = opts.drag ?? 1.8;
      const tint = c.clone().offsetHSL((Math.random() - .5) * .06, 0, (Math.random() - .3) * .2);
      this.base[i3] = tint.r;
      this.base[i3 + 1] = tint.g;
      this.base[i3 + 2] = tint.b;
      this.colors[i3] = tint.r;
      this.colors[i3 + 1] = tint.g;
      this.colors[i3 + 2] = tint.b;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      dirty = true;
      const i3 = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i3 + 1] = -999;
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.gravity[i] * dt;
      this.vel[i3 + 2] *= d;
      this.positions[i3] += this.vel[i3] * dt;
      this.positions[i3 + 1] += this.vel[i3 + 1] * dt;
      this.positions[i3 + 2] += this.vel[i3 + 2] * dt;
      const k = Math.min(1, this.life[i] / this.maxLife[i]);
      this.colors[i3] = this.base[i3] * k;
      this.colors[i3 + 1] = this.base[i3 + 1] * k;
      this.colors[i3 + 2] = this.base[i3 + 2] * k;
    }
    if (dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }

  reset() {
    for (let i = 0; i < MAX; i++) {
      this.life[i] = 0;
      this.positions[i * 3 + 1] = -999;
    }
    this.geo.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}

export class Shockwaves {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pool = [];
  }

  spawn(position, color, opts = {}) {
    let mesh = this.pool.pop();
    if (!mesh) {
      const geo = new THREE.RingGeometry(.8, 1, 64);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      mesh = new THREE.Mesh(geo, mat);
    }
    mesh.material.color.set(color);
    mesh.material.opacity = opts.opacity ?? .8;
    mesh.position.copy(position);
    mesh.rotation.set(-Math.PI / 2, 0, opts.rotation ?? 0);
    mesh.scale.setScalar(opts.scale ?? .4);
    this.scene.add(mesh);
    this.items.push({ mesh, life: opts.life ?? .5, maxLife: opts.life ?? .5, start: opts.scale ?? .4, end: opts.end ?? 4, vertical: opts.vertical ?? false });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const t = 1 - Math.max(0, it.life) / it.maxLife;
      const s = it.start + (it.end - it.start) * (1 - Math.pow(1 - t, 2));
      it.mesh.scale.setScalar(s);
      it.mesh.material.opacity = (1 - t) * .8;
      if (it.life <= 0) {
        this.scene.remove(it.mesh);
        this.pool.push(it.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.mesh);
      this.pool.push(it.mesh);
    }
    this.items.length = 0;
  }

  dispose() {
    this.clear();
    for (const m of this.pool) { m.geometry.dispose(); m.material.dispose(); }
    this.pool.length = 0;
  }
}
