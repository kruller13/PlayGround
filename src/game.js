import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ERAS, GATE_DEFS } from './data.js';
import { Arena } from './world.js';
import { Particles, Shockwaves } from './fx.js';
import {
  buildPlayer, buildEnemy, buildBoss, buildGate, buildCorePickup,
  basic, glow, addMesh, glowSprite, disposeObject
} from './art.js';

const PI = Math.PI;
const PLAYER_Z = 6.5;
const LANE_LIMIT = 4.0;

const ENEMY_TYPES = {
  grunt: { hp: 26, score: 100, radius: .56, speed: 1, fire: 0, label: 'DRONE' },
  runner: { hp: 17, score: 140, radius: .45, speed: 1.38, fire: 0, label: 'DART' },
  gunner: { hp: 42, score: 190, radius: .6, speed: .92, fire: 2.5, label: 'GUNNER' },
  tank: { hp: 105, score: 330, radius: .92, speed: .68, fire: 2.9, label: 'BRUTE' }
};

const CAMERA_CONFIG = [
  { pos: [0, 6.05, 18.6], look: [0, 1.0, -6.2], fov: 47, exposure: 1.12 },
  { pos: [0, 6.2, 18.0], look: [0, 1.15, -7], fov: 49, exposure: 1.06 },
  { pos: [0, 6.7, 17.4], look: [0, 1.3, -8], fov: 52, exposure: 1.0 },
  { pos: [0, 6.35, 17.0], look: [0, 1.4, -8.6], fov: 53, exposure: .97 },
  { pos: [0, 6.55, 17.2], look: [0, 1.35, -8], fov: 50, exposure: .88 },
  { pos: [0, 6.85, 17.5], look: [0, 1.55, -8.8], fov: 51, exposure: .96 }
];

const BLOOM = [0, .12, .62, .58, .1, .22];

function damp(a, b, lambda, dt) {
  return THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
}

function makeShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,.55)');
  g.addColorStop(.6, 'rgba(0,0,0,.24)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRadialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, inner);
  g.addColorStop(.45, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Game {
  constructor({ renderer, audio, save, saveFn }) {
    this.renderer = renderer;
    this.audio = audio;
    this.save = save;
    this.saveFn = saveFn;
    this.phase = 'boot';
    this.paused = false;
    this.timeScale = 1;
    this.elapsed = 0;
    this.menuTime = 0;
    this.clock = new THREE.Clock();
    this.shake = 0;
    this.flash = 0;
    this.hitStop = 0;
    this.evoToken = 0;
    this.evolving = false;
    this.debugSpeed = 1;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, .1, 360);
    this.camera.position.set(0, 6.05, 18.6);
    this.camera.lookAt(0, 1.0, -6.2);

    this.scene.add(new THREE.AmbientLight(0xffffff, .18));

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .8, .6, .62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.particles = new Particles(this.scene);
    this.shockwaves = new Shockwaves(this.scene);

    this.player = { x: 0, targetX: 0, group: null, rig: null, invuln: 0, fireTimer: 0, recoil: 0, runPhase: 0 };
    this.stats = {};
    this.run = {};
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.pickups = [];
    this.gates = [];
    this.rows = [];
    this.drones = [];
    this.boss = null;
    this.arena = null;
    this.showcase = null;
    this.showcaseRig = null;
    this.floaters = [];
    this.bulletPool = [];
    this.enemyBulletPool = [];
    this.bulletAssets = null;
    this.enemyBulletAssets = null;
    this.shadowGeo = new THREE.PlaneGeometry(2, 2);
    this.shadowTex = makeShadowTexture();
    this.shadow = new THREE.Mesh(this.shadowGeo, new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, opacity: .65, depthWrite: false }));
    this.shadow.rotation.x = -PI / 2;
    this.shadow.position.set(0, .018, PLAYER_Z);
    this.scene.add(this.shadow);
    this.shadow.visible = false;

    this.muzzleFlash = glowSprite(0xffd07a, .52, 0);
    this.muzzleFlash.visible = false;
    this.scene.add(this.muzzleFlash);
    this.muzzleLight = new THREE.PointLight(0xffa94d, 0, 14, 2);
    this.scene.add(this.muzzleLight);
    this.playerFill = new THREE.PointLight(0xbfe9ff, 0, 15, 2);
    this.scene.add(this.playerFill);
    this.playerFill2 = new THREE.PointLight(0xffe0a8, 0, 12, 2);
    this.scene.add(this.playerFill2);

    this.input = { left: false, right: false, pointer: false, lastX: 0, startX: 0, startY: 0, moved: 0 };
    this.keys = new Set();
    this.bindInput();
    this.cacheUi();
    this.buildEvoTrack();
    this.buildEraStrip();
    this.resize();
    this.showMenu();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  cacheUi() {
    this.ui = {
      app: document.getElementById('app'),
      menu: document.getElementById('menu'),
      hud: document.getElementById('hud'),
      hpText: document.getElementById('hpText'),
      hpFill: document.getElementById('hpFill'),
      shieldFill: document.getElementById('shieldFill'),
      shieldPipFill: document.getElementById('shieldPipFill'),
      scoreText: document.getElementById('scoreText'),
      multiplier: document.getElementById('multiplier'),
      eraLabel: document.getElementById('eraLabel'),
      evoPct: document.getElementById('evoPct'),
      evoTrack: document.getElementById('evoTrack'),
      sectorLabel: document.getElementById('sectorLabel'),
      killText: document.getElementById('killText'),
      bossHud: document.getElementById('bossHud'),
      bossName: document.getElementById('bossName'),
      bossFill: document.getElementById('bossFill'),
      hint: document.getElementById('hint'),
      floaters: document.getElementById('floaters'),
      powerRail: document.getElementById('powerRail'),
      pauseOverlay: document.getElementById('pauseOverlay'),
      resultOverlay: document.getElementById('resultOverlay'),
      resultKicker: document.getElementById('resultKicker'),
      resultTitle: document.getElementById('resultTitle'),
      resultSub: document.getElementById('resultSub'),
      resultScore: document.getElementById('resultScore'),
      resultKills: document.getElementById('resultKills'),
      resultEra: document.getElementById('resultEra'),
      resultCores: document.getElementById('resultCores'),
      resultBest: document.getElementById('resultBest'),
      evolveOverlay: document.getElementById('evolveOverlay'),
      evoKicker: document.getElementById('evoKicker'),
      evoTitle: document.getElementById('evoTitle'),
      evoSub: document.getElementById('evoSub'),
      bestScore: document.getElementById('bestScore'),
      coresStat: document.getElementById('coresStat'),
      runsStat: document.getElementById('runsStat'),
      soundBtn: document.getElementById('soundBtn'),
      flash: document.getElementById('flash')
    };
  }

  bindInput() {
    const stage = this.renderer.domElement;
    window.addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        this.keys.add(e.code);
        e.preventDefault();
      }
      if (e.code === 'Escape' && this.phase === 'playing') this.pause();
      else if (e.code === 'Escape' && this.paused) this.resume();
    }, { passive: false });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.input.left = this.input.right = false; });

    stage.addEventListener('pointerdown', e => {
      if (this.phase !== 'playing' || this.paused) return;
      this.input.pointer = true;
      this.input.lastX = e.clientX;
      this.input.startX = e.clientX;
      this.input.startY = e.clientY;
      this.input.moved = 0;
      try { stage.setPointerCapture?.(e.pointerId); } catch {}
      e.preventDefault();
    }, { passive: false });
    stage.addEventListener('pointermove', e => {
      if (!this.input.pointer || this.phase !== 'playing' || this.paused) return;
      const dx = e.clientX - this.input.lastX;
      this.input.lastX = e.clientX;
      this.input.moved += Math.abs(dx);
      this.player.targetX += dx * .026;
      this.clampTarget();
      e.preventDefault();
    }, { passive: false });
    const release = e => {
      if (!this.input.pointer) return;
      if (this.input.moved < 14 && this.phase === 'playing' && !this.paused) {
        const left = (e.clientX ?? this.input.startX) < window.innerWidth / 2;
        this.player.targetX += left ? -1.6 : 1.6;
        this.clampTarget();
      }
      this.input.pointer = false;
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', () => { this.input.pointer = false; });

    const bindSteer = (id, dir) => {
      const btn = document.getElementById(id);
      const on = e => { e.preventDefault(); e.stopPropagation(); if (dir < 0) this.input.left = true; else this.input.right = true; btn.classList.add('held'); };
      const off = e => { if (e) e.preventDefault(); if (dir < 0) this.input.left = false; else this.input.right = false; btn.classList.remove('held'); };
      btn.addEventListener('pointerdown', on, { passive: false });
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
    };
    bindSteer('leftBtn', -1);
    bindSteer('rightBtn', 1);
  }

  buildEvoTrack() {
    this.ui.evoTrack.innerHTML = '';
    this.evoSegments = [];
    for (let i = 0; i < 6; i++) {
      const seg = document.createElement('i');
      this.ui.evoTrack.appendChild(seg);
      this.evoSegments.push(seg);
    }
  }

  buildEraStrip() {
    const strip = document.getElementById('eraStrip');
    strip.innerHTML = '';
    this.eraChips = [];
    const symbols = ['╱', '△', '◈', '▣', '✧', '⬡'];
    ERAS.forEach((era, i) => {
      const el = document.createElement('div');
      el.className = 'era-chip';
      el.dataset.symbol = symbols[i];
      el.textContent = era.roman;
      if (this.save.seenEras.includes(i)) el.classList.add('seen');
      strip.appendChild(el);
      this.eraChips.push(el);
    });
  }

  showMenu() {
    this.phase = 'menu';
    this.paused = false;
    this.clearRunObjects();
    this.teardownShowcase();
    this.ui.menu.classList.remove('hidden');
    this.ui.hud.classList.add('hidden');
    this.ui.pauseOverlay.classList.add('hidden');
    this.ui.resultOverlay.classList.add('hidden');
    this.ui.evolveOverlay.classList.add('hidden');
    this.ui.merge = null;
    this.ui.bossHud.classList.add('hidden');
    this.ui.app.dataset.era = '5';
    this.ui.eraLabel.textContent = 'ERA VI · ASCENDED';

    this.arena = new Arena(this.scene, 5, { menu: true });
    this.renderer.shadowMap.enabled = true;
    this.particles.setEra(5);
    this.particles.reset();
    this.shockwaves.clear();
    this.shadow.visible = false;
    this.bulletAssets = null;
    this.enemyBulletAssets = null;
    this.createShowcase();
    this.menuTime = 0;
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(3.7, 2.75, 8.4);
    this.camera.lookAt(.5, 1.55, 0);
    this.bloom.strength = .28;
    this.renderer.toneMappingExposure = .9;
    this.renderer.shadowMap.enabled = true;
    this.refreshMenuStats();
  }

  refreshMenuStats() {
    this.ui.bestScore.textContent = String(Math.max(0, Math.floor(this.save.bestScore))).padStart(6, '0');
    this.ui.coresStat.textContent = Math.floor(this.save.cores);
    this.ui.runsStat.textContent = this.save.runs;
    this.eraChips.forEach((el, i) => {
      el.classList.toggle('seen', this.save.seenEras.includes(i));
    });
  }

  createShowcase() {
    const built = buildPlayer(5);
    this.showcase = built.group;
    this.showcaseRig = built.rig;
    this.showcase.scale.setScalar(1.22);
    this.showcase.position.set(1.15, 0, 0.2);
    this.showcase.rotation.y = 3.55;
    this.scene.add(this.showcase);
    // ground rune
    this.showcaseRune = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.68, 64, 1, 0, PI * 1.72),
      new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.showcaseRune.rotation.x = -PI / 2;
    this.showcaseRune.rotation.z = .4;
    this.showcaseRune.position.set(1.15, .045, .2);
    this.scene.add(this.showcaseRune);
    this.showcaseAura = glowSprite(0xffcc66, 3.4, .12);
    this.showcaseAura.position.set(1.15, 1.8, -.6);
    this.showcaseAura.scale.set(2.2, 2.2, 1);
    this.scene.add(this.showcaseAura);
    this.showcaseFill = new THREE.PointLight(0xffe4b0, 34, 15, 2);
    this.showcaseFill.position.set(2.6, 3.7, 4.2);
    this.scene.add(this.showcaseFill);
    this.showcaseFill2 = new THREE.PointLight(0x67f7ff, 24, 14, 2);
    this.showcaseFill2.position.set(-2.9, 2.2, 3.4);
    this.scene.add(this.showcaseFill2);
    this.showcaseMotes = this.createMenuMotes();
    this.scene.add(this.showcaseMotes);
  }

  createMenuMotes() {
    const count = 90;
    const pos = new Float32Array(count * 3);
    this.menuMoteData = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * PI * 2;
      const r = 1.2 + Math.random() * 3.8;
      pos[i * 3] = Math.cos(a) * r + .35;
      pos[i * 3 + 1] = .3 + Math.random() * 4.8;
      pos[i * 3 + 2] = Math.sin(a) * r * .55 + .2;
      this.menuMoteData.push({ a, r, y: pos[i * 3 + 1], speed: .1 + Math.random() * .3 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffe3a2, size: .045, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending });
    return new THREE.Points(geo, mat);
  }

  teardownShowcase() {
    if (this.showcase) { disposeObject(this.showcase); this.scene.remove(this.showcase); this.showcase = null; this.showcaseRig = null; }
    if (this.showcaseRune) { this.showcaseRune.geometry.dispose(); this.showcaseRune.material.dispose(); this.scene.remove(this.showcaseRune); this.showcaseRune = null; }
    if (this.showcaseAura) { this.showcaseAura.material.dispose(); this.scene.remove(this.showcaseAura); this.showcaseAura = null; }
    if (this.showcaseFill) { this.scene.remove(this.showcaseFill); this.showcaseFill = null; }
    if (this.showcaseFill2) { this.scene.remove(this.showcaseFill2); this.showcaseFill2 = null; }
    if (this.showcaseMotes) { this.showcaseMotes.geometry.dispose(); this.showcaseMotes.material.dispose(); this.scene.remove(this.showcaseMotes); this.showcaseMotes = null; }
  }

  startRun() {
    this.evoToken++;
    this.clearRunObjects();
    this.teardownShowcase();
    this.phase = 'playing';
    this.paused = false;
    this.evolving = false;
    this.timeScale = 1;
    this.elapsed = 0;
    this.shake = 0;
    this.flash = 0;
    this.run = {
      era: 0,
      score: 0,
      kills: 0,
      combo: 0,
      comboTimer: 0,
      multiplier: 1,
      time: 0,
      gateCount: 0,
      spawnTimer: 0,
      gateTimer: 7,
      bossSpawned: false,
      bossDefeated: false,
      won: false,
      cores: 0,
      nextType: 0,
      totalDistance: 0,
      buffs: {}
    };
    const u = this.save.upgrades || {};
    this.stats = {
      damage: 14 * (1 + (u.damage || 0) * .07),
      fireRate: 4.4 * (1 + (u.rate || 0) * .04),
      multishot: 1,
      crit: .05,
      shieldMax: 58 + (u.shield || 0) * 12,
      shield: 58 + (u.shield || 0) * 12,
      hpMax: 100,
      hp: 100,
      magnet: 2.4 * (1 + (u.magnet || 0) * .15),
      evoBoost: 1,
      drones: 0,
      moveSpeed: 14.5
    };
    this.player.x = 0;
    this.player.targetX = 0;
    this.player.invuln = 1.4;
    this.player.fireTimer = .2;
    this.player.recoil = 0;
    this.player.runPhase = 0;
    this.player.group = null;
    this.player.rig = null;
    this.enemyBullets.length = 0;
    this.gates.length = 0;
    this.rows.length = 0;
    this.pickups.length = 0;
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.clearDrones();
    this.boss = null;
    this.ui.bossHud.classList.add('hidden');
    this.ui.powerRail.innerHTML = '';
    this.ui.resultOverlay.classList.add('hidden');
    this.ui.pauseOverlay.classList.add('hidden');
    this.ui.evolveOverlay.classList.add('hidden');
    this.ui.menu.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.app.dataset.era = '0';
    this.audio.init();
    this.audio.startMusic();
    this.audio.setEra(0);
    this.buildEra(0);
    this.buildPlayer(0);
    this.particles.reset();
    this.shockwaves.clear();
    this.spawnInitial();
    this.updateHud(true);
    this.showEraHint(0);
  }

  buildEra(era) {
    if (this.arena) { this.arena.dispose(); this.arena = null; }
    this.renderer.shadowMap.enabled = era >= 1;
    this.arena = new Arena(this.scene, era, { menu: false });
    this.renderer.toneMappingExposure = CAMERA_CONFIG[era].exposure;
    this.bloom.strength = BLOOM[era];
    this.particles.setEra(era);
    this.ui.app.dataset.era = String(era);
    this.bulletAssets = null;
    this.enemyBulletAssets = null;
    this.clearPool(this.bulletPool);
    this.clearPool(this.enemyBulletPool);
    this.bulletPool = [];
    this.enemyBulletPool = [];
  }

  buildPlayer(era) {
    const x = this.player.x;
    if (this.player.group) {
      disposeObject(this.player.group);
      this.scene.remove(this.player.group);
    }
    const built = buildPlayer(era);
    this.player.group = built.group;
    this.player.rig = built.rig;
    this.player.group.position.set(x, 0, PLAYER_Z);
    this.player.group.scale.setScalar(built.rig.scale || 1);
    this.scene.add(this.player.group);
    this.shadow.visible = true;
    this.shadow.material.opacity = era >= 2 ? .7 : .48;
    this.shadow.scale.setScalar(era >= 4 ? 1.2 : 1);
    this.player.group.traverse(o => { if (o.isMesh) o.castShadow = era >= 1; });
  }

  clearPool(pool) {
    for (const mesh of pool) this.scene.remove(mesh);
  }

  spawnInitial() {
    const positions = [-2.4, 1.1, 3.0];
    positions.forEach((x, i) => this.spawnEnemy(x, -27 - i * 8, i === 2 ? 'runner' : 'grunt'));
    this.spawnEnemy(-3.4, -45, 'grunt');
  }

  spawnEnemy(x, z, type) {
    if (this.enemies.length > 34) return;
    const def = ENEMY_TYPES[type] || ENEMY_TYPES.grunt;
    const built = buildEnemy(this.run.era, type);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = 0;
    this.scene.add(built.group);
    const enemy = {
      group: built.group,
      rig: built.rig,
      type,
      x, z,
      baseX: x,
      hp: def.hp * (1 + this.run.era * .27 + this.run.time * .0025),
      maxHp: 0,
      radius: def.radius,
      score: def.score,
      speed: def.speed,
      fireTimer: 1 + Math.random() * 2,
      fireEvery: def.fire,
      phase: Math.random() * PI * 2,
      wobble: type === 'runner' ? .5 + Math.random() * .4 : Math.random() * .2,
      hitPulse: 0
    };
    enemy.maxHp = enemy.hp;
    this.enemies.push(enemy);
    return enemy;
  }

  spawnWave() {
    const era = this.run.era;
    const time = this.run.time;
    const pool = ['grunt', 'grunt', 'runner'];
    if (time > 10 || era >= 1) pool.push('gunner');
    if (era >= 2) pool.push('runner', 'gunner');
    if (era >= 3) pool.push('tank');
    if (era >= 4) pool.push('tank', 'gunner');
    const count = Math.min(4, 1 + Math.floor(this.run.time / 22) + (era >= 3 ? 1 : 0));
    const lanes = [-3.4, -1.8, 0, 1.8, 3.4].sort(() => Math.random() - .5);
    for (let i = 0; i < count; i++) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      const x = lanes[i % lanes.length] + (Math.random() - .5) * .45;
      this.spawnEnemy(THREE.MathUtils.clamp(x, -3.8, 3.8), -56 - Math.random() * 16 - i * 3, type);
    }
  }

  spawnGateRow() {
    if (this.rows.length) return;
    const valid = GATE_DEFS.filter(def => {
      if (def.id === 'drone' && this.stats.drones >= 3) return false;
      if (def.id === 'multi' && this.stats.multishot >= 5) return false;
      return true;
    });
    const picked = [];
    while (picked.length < 2 && valid.length) {
      const i = Math.floor(Math.random() * valid.length);
      const def = valid.splice(i, 1)[0];
      if (picked.some(p => p.id === def.id)) continue;
      picked.push(def);
    }
    const row = { z: -55, gates: [], used: false, pulse: 0 };
    const xs = [-2.32, 2.32];
    picked.forEach((def, i) => {
      const g = buildGate(def);
      g.position.set(xs[i], 0, -55);
      this.scene.add(g);
      const gate = { group: g, def, x: xs[i], z: -55, row };
      row.gates.push(gate);
      this.gates.push(gate);
    });
    this.rows.push(row);
    this.showHint('ELIGE UN GATE // MUÉVETE HACIA UNA PUERTA', 2200);
  }

  updateGates(dt, speed) {
    this.rows = this.rows.filter(row => !row.used);
    for (const row of this.rows) {
      row.z += speed * dt;
      for (const gate of row.gates) {
        gate.z = row.z;
        gate.group.position.z = row.z;
        gate.group.userData.gate.planeMat.uniforms.uTime.value += dt;
        gate.group.userData.gate.gem.rotation.y += dt * 1.2;
        gate.group.userData.gate.gem.position.y = 2.2 + Math.sin(this.elapsed * 2 + gate.x) * .08;
        gate.group.userData.gate.groundRing.rotation.z += dt * .3;
      }
      if (row.z >= PLAYER_Z - .3) {
        row.used = true;
        let chosen = row.gates[0];
        for (const gate of row.gates) if (Math.abs(gate.x - this.player.x) < Math.abs(chosen.x - this.player.x)) chosen = gate;
        this.applyGate(chosen);
      }
    }
    this.gates = this.gates.filter(g => {
      if (g.row.used) {
        disposeObject(g.group);
        this.scene.remove(g.group);
        return false;
      }
      return true;
    });
  }

  applyGate(gate) {
    const def = gate.def;
    let value = '';
    switch (def.id) {
      case 'damage': this.stats.damage *= 1.28; value = '+28% DAÑO'; break;
      case 'rate': this.stats.fireRate = Math.min(13, this.stats.fireRate * 1.22); value = '+22% CADENCIA'; break;
      case 'multi': this.stats.multishot = Math.min(5, this.stats.multishot + 1); value = `MULTI ×${this.stats.multishot}`; break;
      case 'shield': this.stats.shieldMax += 30; this.stats.shield = Math.min(this.stats.shieldMax, this.stats.shield + 32); this.stats.hp = Math.min(this.stats.hpMax, this.stats.hp + 20); value = '+30 ESCUDO'; break;
      case 'heal': this.stats.hp = Math.min(this.stats.hpMax, this.stats.hp + 40); value = '+40 INTEGRIDAD'; break;
      case 'crit': this.stats.crit = Math.min(.75, this.stats.crit + .12); value = '+12% CRÍTICO'; break;
      case 'drone': this.stats.drones = Math.min(3, this.stats.drones + 1); this.rebuildDrones(); value = '+1 DRON'; break;
      case 'magnet': this.stats.magnet *= 1.6; value = '+60% IMÁN'; break;
      case 'power': this.stats.evoBoost *= 1.14; value = '+14% EVO'; break;
    }
    this.run.gateCount++;
    this.run.buffs[def.id] = (this.run.buffs[def.id] || 0) + 1;
    this.addScore(300, new THREE.Vector3(gate.x, 2, PLAYER_Z - 1), false, def.color);
    this.audio.gate();
    this.shockwaves.spawn(new THREE.Vector3(gate.x, .15, PLAYER_Z), def.color, { end: 6, life: .6 });
    this.particles.spawn(new THREE.Vector3(gate.x, 1.4, PLAYER_Z), def.color, 34, 7, { life: .9 });
    this.shake = Math.max(this.shake, .18);
    this.flash = Math.max(this.flash, .18);
    this.spawnFloater(new THREE.Vector3(gate.x, 2.7, PLAYER_Z), value, 'gate');
    this.updatePowerRail();
    this.updateHud(true);
  }

  addScore(amount, position, crit = false, color = null) {
    this.run.score += amount;
    if (position) this.spawnFloater(position.clone().add(new THREE.Vector3(0, .8, 0)), `+${Math.round(amount)}`, crit ? 'crit' : 'gate');
    if (color) this.particles.spawn(position || new THREE.Vector3(), color, 8, 3, { life: .4 });
  }

  updatePowerRail() {
    const labels = {
      damage: ['✦', 'DMG'], rate: ['≫', 'RATE'], multi: ['⋔', 'MULTI'], shield: ['◈', 'AEGIS'],
      heal: ['✚', 'VITAL'], crit: ['◎', 'CRIT'], drone: ['◉', 'DRONE'], magnet: ['⌁', 'MAG'], power: ['△', 'EVO']
    };
    this.ui.powerRail.innerHTML = '';
    for (const [id, count] of Object.entries(this.run.buffs)) {
      const [icon, short] = labels[id] || ['•', id.toUpperCase()];
      const el = document.createElement('div');
      el.className = 'power-pip';
      el.innerHTML = `<b>${icon}</b> ${short}${count > 1 ? ` ×${count}` : ''}`;
      this.ui.powerRail.appendChild(el);
    }
  }

  rebuildDrones() {
    this.clearDrones();
    for (let i = 0; i < this.stats.drones; i++) {
      const group = new THREE.Group();
      const color = [0xa78bff, 0x67f7ff, 0xffcc66][i];
      addMesh(group, new THREE.OctahedronGeometry(.12, 0), glow(color, 3));
      addMesh(group, new THREE.TorusGeometry(.22, .008, 4, 20), basic(color, { transparent: true, opacity: .55 }), [0, 0, 0], [PI / 2, 0, 0]);
      const aura = glowSprite(color, .85, .42);
      group.add(aura);
      this.scene.add(group);
      this.drones.push({ group, angle: i * PI * 2 / Math.max(1, this.stats.drones), timer: .3 });
    }
  }

  clearDrones() {
    for (const d of this.drones) { disposeObject(d.group); this.scene.remove(d.group); }
    this.drones.length = 0;
  }

  removeEnemy(enemy, silent = false) {
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
    if (!silent) disposeObject(enemy.group);
    this.scene.remove(enemy.group);
  }

  damageEnemy(enemy, damage, crit = false, color = null) {
    enemy.hp -= damage;
    enemy.hitPulse = .12;
    this.audio.hit();
    const pos = new THREE.Vector3(enemy.x, 1.2, enemy.z);
    this.particles.spawn(pos, color || (crit ? '#ffe071' : this.eraAccent(2)), crit ? 7 : 3, crit ? 5 : 3, { life: .25, gravity: 2 });
    this.spawnFloater(pos.clone().add(new THREE.Vector3(0, .75, 0)), `${Math.round(damage)}${crit ? '!' : ''}`, crit ? 'crit' : '');
    if (enemy.hp <= 0) this.killEnemy(enemy, crit);
  }

  killEnemy(enemy, crit = false) {
    const idx = this.enemies.indexOf(enemy);
    if (idx < 0) return;
    this.enemies.splice(idx, 1);
    this.particles.spawn(new THREE.Vector3(enemy.x, 1.1, enemy.z), this.eraAccent(1), enemy.type === 'tank' ? 32 : 18, enemy.type === 'tank' ? 7 : 5, { life: .75, gravity: 4 });
    this.particles.spawn(new THREE.Vector3(enemy.x, 1.1, enemy.z), '#ffffff', 6, 3, { life: .35, gravity: 0 });
    this.shockwaves.spawn(new THREE.Vector3(enemy.x, .04, enemy.z), this.eraAccent(0), { end: 2.4, life: .4, opacity: .5 });
    this.audio.kill();
    this.scene.remove(enemy.group);
    disposeObject(enemy.group);
    this.run.kills++;
    this.run.combo++;
    this.run.comboTimer = 2.4;
    this.run.multiplier = Math.min(4, 1 + this.run.combo * .06);
    const points = Math.round(enemy.score * this.run.multiplier);
    this.run.score += points;
    this.spawnFloater(new THREE.Vector3(enemy.x, 1.7, enemy.z), `+${points}`, crit ? 'crit' : '');
    if (Math.random() < .14 || enemy.type === 'tank') {
      const p = buildCorePickup('#67f7ff');
      p.position.set(enemy.x, .55, enemy.z);
      this.scene.add(p);
      this.pickups.push({ group: p, x: enemy.x, z: enemy.z, phase: Math.random() * 3, type: 'shield' });
    }
    this.checkEvolution();
  }

  checkEvolution() {
    if (this.evolving || this.run.era >= 5) return;
    const next = ERAS[this.run.era + 1];
    if (this.run.kills >= next.threshold) this.evolve();
  }

  evolve() {
    if (this.evolving || this.run.era >= 5) return;
    const nextEra = this.run.era + 1;
    const next = ERAS[nextEra];
    this.evolving = true;
    this.timeScale = .22;
    this.player.invuln = 4.5;
    this.evoToken++;
    const token = this.evoToken;
    this.clearEnemyBullets();
    this.audio.evolve();
    this.ui.evoKicker.textContent = `EVOLUTION 0${nextEra + 1} // ${next.kicker}`;
    this.ui.evoTitle.textContent = next.name;
    this.ui.evoSub.textContent = next.description;
    this.ui.evolveOverlay.classList.remove('hidden');
    this.flash = 1;
    this.shake = .5;
    setTimeout(() => {
      if (token !== this.evoToken || this.phase !== 'playing') return;
      this.run.era = nextEra;
      this.buildEra(nextEra);
      this.buildPlayer(nextEra);
      this.audio.setEra(nextEra);
      this.updateEraUi();
      const pos = new THREE.Vector3(this.player.x, 1, PLAYER_Z);
      this.particles.spawn(pos, next.accent, 65, 11, { life: 1.2, gravity: 1.8 });
      this.shockwaves.spawn(new THREE.Vector3(this.player.x, .05, PLAYER_Z), next.accent, { end: 10, life: .8, opacity: .9 });
      this.camera.fov = CAMERA_CONFIG[nextEra].fov;
      this.camera.updateProjectionMatrix();
    }, 640);
    setTimeout(() => {
      if (token !== this.evoToken || this.phase !== 'playing') return;
      this.ui.evolveOverlay.classList.add('hidden');
      this.evolving = false;
      this.timeScale = 1;
      this.player.invuln = 2.2;
      this.showEraHint(nextEra);
      this.save.seenEras = Array.from(new Set([...(this.save.seenEras || []), nextEra]));
      this.saveFn();
      this.refreshMenuStats();
    }, 1980);
  }

  updateEraUi() {
    const era = ERAS[this.run.era];
    this.ui.eraLabel.textContent = `ERA ${era.roman} · ${era.name}`;
    this.ui.sectorLabel.textContent = `SECTOR 0${this.run.era + 1} / 06`;
    this.ui.app.dataset.era = String(this.run.era);
  }

  clearEnemyBullets() {
    for (const b of this.enemyBullets) {
      this.scene.remove(b.mesh);
      this.enemyBulletPool.push(b.mesh);
    }
    this.enemyBullets.length = 0;
  }

  spawnFloater(worldPos, text, kind = '') {
    const v = worldPos.clone().project(this.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = `float-text ${kind}`;
    el.textContent = text;
    el.style.left = `${(v.x * .5 + .5) * window.innerWidth}px`;
    el.style.top = `${(-v.y * .5 + .5) * window.innerHeight}px`;
    this.ui.floaters.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  showHint(text, duration = 2000) {
    const el = this.ui.hint;
    el.textContent = text;
    el.classList.remove('hidden');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  showEraHint(eraIndex) {
    const era = ERAS[eraIndex];
    this.showHint(`ERA ${era.roman} // ${era.name}`, 2300);
  }

  update(dt) {
    this.run.time += dt;
    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.run.comboTimer -= dt;
    if (this.run.comboTimer <= 0) {
      this.run.combo = 0;
      this.run.multiplier = 1;
    }
    const speed = this.boss ? 3.4 : (9.5 + this.run.era * 1.15 + Math.min(4.5, this.run.time * .018));
    this.run.totalDistance += speed * dt;
    this.run.score += dt * (1.4 + this.run.era * .55);
    if (this.arena) this.arena.update(dt, speed);

    this.updatePlayer(dt, speed);
    this.updateSpawner(dt);
    this.updateGates(dt, speed);
    this.updateEnemies(dt, speed);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    this.updatePickups(dt, speed);
    this.updateDrones(dt);
    this.updateBoss(dt);
    this.particles.update(dt);
    this.shockwaves.update(dt);

    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    if (this.ui.flash) this.ui.flash.style.opacity = String(this.flash * .42);
    this.updateCamera(dt);
    this.updateHud(false);
  }

  updatePlayer(dt, speed) {
    let dir = 0;
    if (this.input.left || this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir -= 1;
    if (this.input.right || this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir += 1;
    if (dir) {
      this.player.targetX += dir * dt * this.stats.moveSpeed;
    }
    this.clampTarget();
    this.player.x = damp(this.player.x, this.player.targetX, 13, dt);
    const rig = this.player.rig;
    if (!rig) return;
    const g = this.player.group;
    g.position.x = this.player.x;
    this.player.runPhase += dt * (8.5 + this.run.era * .55);
    const bob = Math.sin(this.player.runPhase * 2) * .035;
    const hover = this.run.era >= 2 ? .1 + Math.sin(this.elapsed * 2) * .035 : 0;
    rig.body.position.y = bob + hover;
    const legAmp = this.run.era === 0 ? .72 : .58;
    if (rig.legL) {
      rig.legL.rotation.x = Math.sin(this.player.runPhase) * legAmp;
      rig.legR.rotation.x = -Math.sin(this.player.runPhase) * legAmp;
    }
    if (rig.armL) {
      rig.armL.rotation.x = -Math.sin(this.player.runPhase) * .45;
      rig.armR.rotation.x = Math.sin(this.player.runPhase) * .16;
    }
    if (rig.weapon) {
      rig.weapon.rotation.x = -this.player.recoil;
      this.player.recoil = damp(this.player.recoil, 0, 20, dt);
    }
    if (rig.cape) {
      rig.cape.rotation.x = .1 + Math.sin(this.elapsed * 2.1) * .035;
      rig.cape.rotation.z = Math.sin(this.elapsed * 1.4) * .025;
    }
    if (rig.halo1) rig.halo1.rotation.z += dt * .55;
    if (rig.halo2) rig.halo2.rotation.z -= dt * .4;
    if (rig.halo) rig.halo.rotation.z += dt * .5;
    if (rig.aura) rig.aura.rotation.z += dt * .35;
    if (rig.trailL) rig.trailL.rotation.z = Math.sin(this.elapsed * 3) * .15;
    if (rig.trailR) rig.trailR.rotation.z = -Math.sin(this.elapsed * 3) * .15;
    if (rig.wingL) { rig.wingL.rotation.z = -.18 + Math.sin(this.elapsed * 1.7) * .08; rig.wingL.scale.y = 1 + Math.sin(this.elapsed * 1.7) * .06; }
    if (rig.wingR) { rig.wingR.rotation.z = .18 - Math.sin(this.elapsed * 1.7) * .08; rig.wingR.scale.y = 1 + Math.sin(this.elapsed * 1.7) * .06; }
    this.shadow.position.x = this.player.x;
    this.shadow.material.opacity = this.player.rig ? (this.run.era >= 2 ? .7 : .48) * (1 - (rig.body.position.y || 0)) : 0;
    const fill = this.run.era === 0 ? 0 : this.run.era === 1 ? 12 : this.run.era === 2 ? 90 : this.run.era === 3 ? 64 : 72;
    this.playerFill.intensity = damp(this.playerFill.intensity, fill, 3, dt);
    this.playerFill2.intensity = damp(this.playerFill2.intensity, fill * .55, 3, dt);
    this.playerFill.position.set(this.player.x + 2.2, 4.2, PLAYER_Z + 3.2);
    this.playerFill2.position.set(this.player.x - 2.2, 2.2, PLAYER_Z + 2.4);
    this.playerFill.color.set(this.run.era === 2 ? 0x9ffbff : this.run.era === 4 ? 0xffe2a8 : 0xd8e9ff);
    this.playerFill2.color.set(this.run.era === 3 ? 0xffb066 : 0x9fe7ff);
    this.player.fireTimer -= dt;
    if (this.player.fireTimer <= 0 && !this.evolving) this.fireVolley();
    if (this.muzzleFlash.visible) {
      this.muzzleFlash.material.opacity = Math.max(0, this.muzzleFlash.material.opacity - dt * 9);
      if (this.muzzleFlash.material.opacity <= 0) this.muzzleFlash.visible = false;
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 100);
    }
  }

  clampTarget() {
    this.player.targetX = THREE.MathUtils.clamp(this.player.targetX, -LANE_LIMIT, LANE_LIMIT);
  }

  getTarget() {
    if (this.boss && !this.boss.dead) return { x: this.boss.x, y: 3.1, z: this.boss.z, boss: true };
    let best = null;
    for (const e of this.enemies) {
      if (e.z > PLAYER_Z - 1 || e.z < -62) continue;
      if (!best || e.z > best.z) best = e;
    }
    if (!best) return null;
    return { x: best.x, y: 1.2, z: best.z, enemy: best };
  }

  fireVolley() {
    const target = this.getTarget();
    const rig = this.player.rig;
    if (!rig) return;
    const muzzle = new THREE.Vector3();
    rig.muzzle.getWorldPosition(muzzle);
    const targetPos = target ? new THREE.Vector3(target.x, target.y, target.z) : new THREE.Vector3(this.player.x, 1.2, -30);
    let baseAngle = 0;
    if (target) {
      baseAngle = Math.atan2(target.x - muzzle.x, -(target.z - muzzle.z));
      rig.weapon.rotation.y = damp(rig.weapon.rotation.y, -baseAngle * .18, 8, .016);
    }
    const count = this.stats.multishot;
    const spread = .065;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread;
      const angle = baseAngle + offset + (Math.random() - .5) * .015;
      const dir = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle)).normalize();
      const crit = Math.random() < this.stats.crit;
      this.createBullet(muzzle, dir, this.stats.damage * (crit ? 1.9 : 1), crit);
    }
    this.player.fireTimer = 1 / this.stats.fireRate;
    this.player.recoil = .1;
    this.audio.shoot();
    this.muzzleFlash.position.copy(muzzle).add(new THREE.Vector3(0, 0, .1));
    this.muzzleFlash.material.opacity = .72;
    this.muzzleFlash.material.color.set(this.run.era >= 2 ? 0x9ffbff : 0xffd07a);
    this.muzzleFlash.scale.setScalar(.42 + Math.random() * .22);
    this.muzzleFlash.visible = true;
    this.muzzleLight.position.copy(muzzle);
    this.muzzleLight.color.set(this.run.era >= 2 ? 0x67f7ff : 0xffa94d);
    this.muzzleLight.intensity = this.run.era >= 3 ? 15 : 8;
  }

  createBullet(origin, dir, damage, crit = false) {
    const assets = this.getBulletAssets();
    let mesh = this.bulletPool.pop();
    if (!mesh) mesh = new THREE.Mesh(assets.geo, assets.mat);
    mesh.material = assets.mat;
    mesh.scale.copy(assets.scale);
    mesh.position.copy(origin);
    mesh.visible = true;
    this.scene.add(mesh);
    const speed = 62;
    this.bullets.push({
      mesh,
      x: origin.x, y: origin.y, z: origin.z,
      vx: dir.x * speed,
      vz: dir.z * speed,
      damage,
      crit,
      life: 2.2
    });
  }

  getBulletAssets() {
    if (this.bulletAssets) return this.bulletAssets;
    const era = this.run.era;
    const color = new THREE.Color(ERAS[era].accent);
    let mat;
    if (era === 0) mat = basic(0x17120d);
    else if (era === 1) mat = basic(0xff4b28);
    else mat = glow(color.getHex(), 4.2);
    const geo = new THREE.SphereGeometry(era === 0 ? .055 : era === 1 ? .085 : .075, 6, 5);
    this.bulletAssets = { geo, mat, scale: new THREE.Vector3(1, 1, era === 0 ? 2.8 : 4.1) };
    return this.bulletAssets;
  }

  getEnemyBulletAssets() {
    if (this.enemyBulletAssets) return this.enemyBulletAssets;
    const era = this.run.era;
    const color = [0xc23d2a, 0xff6a3d, 0xff2d95, 0xffb34d, 0xffe1a0, 0xffcc66][era];
    const mat = era <= 1 ? basic(color, { transparent: true, opacity: .9 }) : glow(color, 4);
    const geo = new THREE.SphereGeometry(era <= 1 ? .08 : .11, 6, 5);
    this.enemyBulletAssets = { geo, mat, scale: new THREE.Vector3(1, 1, era <= 1 ? 1 : 2.1) };
    return this.enemyBulletAssets;
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);
      let hit = false;
      if (this.boss && !this.boss.dead) {
        if (Math.abs(b.x - this.boss.x) < 2.35 && Math.abs(b.z - this.boss.z) < 2.0) {
          this.damageBoss(b.damage, b.crit, b.x, b.z);
          hit = true;
        }
      }
      if (!hit) {
        for (const enemy of this.enemies) {
          if (Math.abs(b.z - enemy.z) < .75 && Math.abs(b.x - enemy.x) < enemy.radius + .13) {
            this.damageEnemy(enemy, b.damage, b.crit);
            hit = true;
            break;
          }
        }
      }
      if (hit || b.life <= 0 || b.z < -75 || Math.abs(b.x) > 20) {
        this.scene.remove(b.mesh);
        this.bulletPool.push(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
  }

  shootEnemyBullet(enemy, opts = {}) {
    const assets = this.getEnemyBulletAssets();
    let mesh = this.enemyBulletPool.pop();
    if (!mesh) mesh = new THREE.Mesh(assets.geo, assets.mat);
    mesh.material = assets.mat;
    mesh.scale.copy(assets.scale);
    const spread = opts.spread ?? 0;
    const dx = this.player.x - enemy.x;
    const dz = PLAYER_Z - enemy.z;
    const angle = Math.atan2(dx, dz) + (Math.random() - .5) * spread;
    const speed = opts.speed || (9 + this.run.era * .8);
    mesh.position.set(enemy.x, opts.y || 1.25, enemy.z + .3);
    this.scene.add(mesh);
    this.enemyBullets.push({
      mesh,
      x: enemy.x, y: opts.y || 1.25, z: enemy.z + .3,
      vx: Math.sin(angle) * speed,
      vz: Math.cos(angle) * speed,
      damage: opts.damage || (8 + this.run.era),
      radius: opts.radius || .2,
      life: 5
    });
  }

  updateEnemyBullets(dt) {
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.z += dt * 4;
      const d = Math.hypot(b.x - this.player.x, b.z - PLAYER_Z);
      if (d < .46 + b.radius && this.player.invuln <= 0) {
        this.hurtPlayer(b.damage);
        this.removeEnemyBullet(i);
        continue;
      }
      if (b.life <= 0 || b.z > 16 || b.z < -70 || Math.abs(b.x) > 18) this.removeEnemyBullet(i);
    }
  }

  removeEnemyBullet(i) {
    const b = this.enemyBullets[i];
    this.scene.remove(b.mesh);
    this.enemyBulletPool.push(b.mesh);
    this.enemyBullets.splice(i, 1);
  }

  hurtPlayer(damage) {
    if (this.player.invuln > 0 || this.phase !== 'playing') return;
    let dmg = damage;
    if (this.stats.shield > 0) {
      const absorbed = Math.min(this.stats.shield, dmg);
      this.stats.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) this.stats.hp -= dmg;
    this.player.invuln = .9;
    this.shake = Math.max(this.shake, .55);
    this.flash = Math.max(this.flash, .28);
    this.audio.hurt();
    this.particles.spawn(new THREE.Vector3(this.player.x, 1.2, PLAYER_Z), '#ff5b3d', 20, 6, { life: .6 });
    this.spawnFloater(new THREE.Vector3(this.player.x, 2.5, PLAYER_Z), `-${Math.round(damage)}`, 'crit');
    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
      this.endRun(false);
    }
    this.updateHud(true);
  }

  updateEnemies(dt, speed) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.phase += dt * (e.type === 'runner' ? 5 : 2.2);
      e.z += speed * e.speed * dt;
      e.x = e.baseX + Math.sin(e.phase) * e.wobble;
      e.x = THREE.MathUtils.clamp(e.x, -4.25, 4.25);
      e.group.position.set(e.x, 0, e.z);
      e.group.rotation.z = Math.sin(e.phase * .8) * .06;
      e.group.rotation.y = Math.sin(e.phase * .6) * .1;
      const rig = e.rig;
      if (rig.body) rig.body.position.y = Math.sin(e.phase * 2) * .05;
      if (rig.legL) {
        rig.legL.rotation.x = Math.sin(e.phase * 2) * .5;
        rig.legR.rotation.x = -Math.sin(e.phase * 2) * .5;
      }
      if (rig.ring1) rig.ring1.rotation.z += dt * (e.type === 'tank' ? .3 : .55);
      if (rig.ring2) rig.ring2.rotation.x += dt * .4;
      if (rig.wingL) rig.wingL.rotation.z = -.12 + Math.sin(e.phase) * .09;
      if (rig.wingR) rig.wingR.rotation.z = .12 - Math.sin(e.phase) * .09;
      if (e.hitPulse > 0) { e.hitPulse -= dt; e.group.scale.setScalar(1 + e.hitPulse * .5); }
      else e.group.scale.setScalar(1);

      if (e.fireEvery > 0) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.z > -42 && e.z < 2) {
          this.shootEnemyBullet(e, { spread: .16, damage: 9 + this.run.era * 1.5 });
          e.fireTimer = e.fireEvery * (1 + Math.random() * .35);
        }
      }
      const closeZ = Math.abs(e.z - PLAYER_Z) < .88;
      const closeX = Math.abs(e.x - this.player.x) < .68 + e.radius * .35;
      if (closeZ && closeX) {
        if (this.player.invuln <= 0) this.hurtPlayer(15 + this.run.era * 2.5 + (e.type === 'tank' ? 10 : 0));
        this.particles.spawn(new THREE.Vector3(e.x, 1, e.z), this.eraAccent(0), 20, 5, { life: .5 });
        this.removeEnemy(e);
        continue;
      }
      if (e.z > 14) this.removeEnemy(e);
    }
  }

  updateSpawner(dt) {
    if (this.boss || this.bossSpawnedRecently) return;
    if (!this.run.bossSpawned) {
      const bossReady = (this.run.era >= 5 && (this.run.time > 84 || this.run.kills >= 95));
      if (bossReady) {
        this.spawnBoss();
        return;
      }
    }
    this.run.spawnTimer -= dt;
    if (this.run.spawnTimer <= 0) {
      this.spawnWave();
      this.run.spawnTimer = Math.max(.62, 1.7 - this.run.era * .1 - this.run.time * .006);
    }
    this.run.gateTimer -= dt;
    if (this.run.gateTimer <= 0 && !this.rows.length) {
      this.spawnGateRow();
      this.run.gateTimer = Math.max(10.5, 16 - this.run.era * .6);
    }
  }

  updatePickups(dt, speed) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.phase += dt * 4;
      p.group.position.y = .55 + Math.sin(p.phase) * .12;
      p.group.rotation.y += dt * 2.6;
      const dx = this.player.x - p.x;
      const dz = PLAYER_Z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < this.stats.magnet + 1.4) {
        p.x += dx * dt * 9;
        p.z += dz * dt * 9;
      } else {
        p.z += speed * dt * .8;
      }
      p.group.position.x = p.x;
      p.group.position.z = p.z;
      if (dist < .8) {
        this.stats.shield = Math.min(this.stats.shieldMax, this.stats.shield + 14);
        this.audio.pickup();
        this.particles.spawn(new THREE.Vector3(p.x, 1, p.z), '#67f7ff', 12, 4, { life: .4 });
        this.spawnFloater(new THREE.Vector3(p.x, 2, p.z), '+14 SHIELD', 'gate');
        this.scene.remove(p.group);
        disposeObject(p.group);
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.z > 15) { this.scene.remove(p.group); disposeObject(p.group); this.pickups.splice(i, 1); }
    }
  }

  updateDrones(dt) {
    this.drones.forEach((drone, i) => {
      drone.angle += dt * 1.4;
      const x = this.player.x + Math.cos(drone.angle + i * 2) * 1.25;
      const z = PLAYER_Z - 1.2 + Math.sin(drone.angle + i * 2) * .55;
      drone.group.position.set(x, 1.9 + Math.sin(this.elapsed * 3 + i) * .12, z);
      drone.group.rotation.y += dt * 2;
      drone.timer -= dt;
      if (drone.timer <= 0) {
        drone.timer = .48;
        let target = null;
        for (const e of this.enemies) if (!target || e.z > target.z) target = e;
        if (target) {
          const origin = new THREE.Vector3(x, 1.9, z);
          const dir = new THREE.Vector3(target.x - x, 0, target.z - z).normalize();
          const angle = Math.atan2(dir.x, -dir.z);
          const crit = Math.random() < this.stats.crit;
          this.createBullet(origin, new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle)), this.stats.damage * .42, crit);
        }
      }
    });
  }

  spawnBoss() {
    this.run.bossSpawned = true;
    this.bossSpawnedRecently = true;
    this.audio.boss();
    this.clearEnemyBullets();
    for (const e of [...this.enemies]) this.removeEnemy(e);
    this.rows.forEach(row => {
      for (const g of row.gates) { disposeObject(g.group); this.scene.remove(g.group); }
      row.used = true;
    });
    this.rows = [];
    this.gates = [];
    const group = buildBoss(this.run.era);
    group.position.set(0, 0, -34);
    group.scale.setScalar(1.12);
    group.rotation.y = 0;
    const bossAura = glowSprite(0xffcc66, 7.2, .13);
    bossAura.position.set(0, 3.4, -1.6);
    group.add(bossAura);
    const bossAura2 = glowSprite(0x67f7ff, 3.6, .12);
    bossAura2.position.set(0, 3.4, -1.2);
    group.add(bossAura2);
    this.scene.add(group);
    const era = ERAS[this.run.era];
    this.boss = {
      group,
      x: 0,
      z: -34,
      hp: 1250 + this.run.era * 170,
      maxHp: 1250 + this.run.era * 170,
      phase: 0,
      attackTimer: 2,
      ringTimer: 5,
      summonTimer: 8,
      dead: false,
      deathTimer: 0
    };
    this.ui.bossName.textContent = `${era.boss} // ${era.name}`;
    this.ui.bossHud.classList.remove('hidden');
    this.ui.bossFill.style.transform = 'scaleX(1)';
    this.showHint('⚠ GATEKEEPER DETECTED // PREPARE', 3000);
    this.shake = .8;
    this.flash = .35;
    setTimeout(() => { this.bossSpawnedRecently = false; }, 1600);
  }

  updateBoss(dt) {
    if (!this.boss) return;
    const b = this.boss;
    b.phase += dt;
    if (b.dead) {
      b.deathTimer += dt;
      b.group.rotation.y += dt * .7;
      b.group.scale.multiplyScalar(1 - dt * .35);
      if (b.deathTimer > 1.2 && !this.run.bossDefeated) {
        this.run.bossDefeated = true;
        this.particles.spawn(new THREE.Vector3(b.x, 2.5, b.z), '#ffe3a3', 90, 14, { life: 1.6, gravity: 2 });
        this.shockwaves.spawn(new THREE.Vector3(b.x, .1, b.z), '#ffcc66', { end: 18, life: 1.2, opacity: 1 });
        this.audio.win();
        setTimeout(() => this.endRun(true), 1100);
      }
      return;
    }
    b.z = damp(b.z, -20, .34, dt);
    b.x = Math.sin(b.phase * .6) * 2.9;
    b.group.position.set(b.x, Math.sin(b.phase * 1.4) * .12, b.z);
    b.group.rotation.y = -b.x * .07;
    const rings = b.group.userData.bossRings || [];
    rings.forEach((r, i) => {
      r.rotation.z += dt * (.15 + i * .08);
      r.rotation.x = PI / 2.3 + Math.sin(b.phase * .5 + i) * .2;
    });
    if (b.group.userData.rings) {
      b.group.userData.rings.forEach((r, i) => r.rotation.z += dt * (.2 + i * .1));
    }
    b.attackTimer -= dt;
    if (b.attackTimer <= 0) {
      b.attackTimer = Math.max(1.1, 2.6 - this.run.era * .16);
      const patterns = this.run.era >= 4 ? 3 : 2;
      const pattern = Math.floor(Math.random() * patterns);
      if (pattern === 0) {
        for (let i = -2; i <= 2; i++) this.bossAimed(i * .12, 13 + this.run.era);
      } else if (pattern === 1) {
        for (let i = 0; i < 9; i++) {
          const angle = -PI * .42 + (i / 8) * PI * .84;
          this.spawnBossBullet(angle, 9 + this.run.era, 1.6);
        }
      } else {
        for (let i = -3; i <= 3; i++) this.bossAimed(i * .2, 11 + this.run.era);
      }
      this.audio.tone({ freq: 90, end: 55, dur: .5, type: 'sawtooth', vol: .07 });
    }
    b.ringTimer -= dt;
    if (b.ringTimer <= 0) {
      b.ringTimer = 3.7;
      this.shockwaves.spawn(new THREE.Vector3(b.x, .05, b.z), '#ff8a1f', { end: 8, life: .7, opacity: .65 });
    }
    b.summonTimer -= dt;
    if (b.summonTimer <= 0 && this.enemies.length < 5) {
      b.summonTimer = 9;
      this.spawnEnemy(b.x - 4, b.z - 4, 'runner');
      this.spawnEnemy(b.x + 4, b.z - 5, 'gunner');
    }
    if (!this.run.bossDefeated) this.ui.bossFill.style.transform = `scaleX(${Math.max(0, b.hp / b.maxHp)})`;
  }

  bossAimed(offset, speed) {
    if (!this.boss) return;
    const angle = Math.atan2(this.player.x - this.boss.x, PLAYER_Z - this.boss.z) + offset * .22;
    this.spawnBossBullet(angle, speed, 2.2);
  }

  spawnBossBullet(angle, speed, radius) {
    const assets = this.getEnemyBulletAssets();
    let mesh = this.enemyBulletPool.pop();
    if (!mesh) mesh = new THREE.Mesh(assets.geo, assets.mat);
    mesh.material = assets.mat;
    mesh.scale.set(1.8, 1.8, 2.8);
    const x = this.boss.x;
    const z = this.boss.z + .5;
    mesh.position.set(x, 2.4, z);
    this.scene.add(mesh);
    this.enemyBullets.push({
      mesh, x, y: 2.4, z,
      vx: Math.sin(angle) * speed,
      vz: Math.cos(angle) * speed,
      damage: 14 + this.run.era * 1.6,
      radius: radius,
      life: 6
    });
  }

  damageBoss(damage, crit, x, z) {
    if (!this.boss || this.boss.dead) return;
    this.boss.hp -= damage;
    this.audio.hit();
    this.particles.spawn(new THREE.Vector3(x, 2.4, z), crit ? '#ffe071' : this.eraAccent(1), crit ? 12 : 5, 6, { life: .5 });
    this.spawnFloater(new THREE.Vector3(x, 3, z), `${Math.round(damage)}${crit ? '!' : ''}`, crit ? 'crit' : '');
    if (this.boss.hp <= 0) {
      this.boss.hp = 0;
      this.boss.dead = true;
      this.audio.win();
      this.shake = 1;
      this.flash = .8;
      this.ui.bossHud.classList.add('hidden');
    }
  }

  eraAccent(kind = 0) {
    const era = ERAS[this.run.era];
    return kind === 0 ? era.accent : kind === 1 ? era.accent2 : era.accent;
  }

  updateCamera(dt) {
    const cfg = CAMERA_CONFIG[this.run.era] || CAMERA_CONFIG[0];
    const shakeX = (Math.random() - .5) * this.shake * .35;
    const shakeY = (Math.random() - .5) * this.shake * .22;
    const follow = this.player.x * .2;
    const k = 1 - Math.exp(-5.5 * dt);
    this.camera.position.x += ((cfg.pos[0] + follow) - this.camera.position.x) * k + shakeX * .03;
    this.camera.position.y += ((cfg.pos[1] + Math.sin(this.elapsed * 1.1) * .07) - this.camera.position.y) * k + shakeY * .03;
    this.camera.position.z += (cfg.pos[2] - this.camera.position.z) * k;
    const lookX = this.player.x * .07;
    const lookZ = cfg.look[2] - (this.boss ? 2.5 : 0);
    this.camera.lookAt(lookX + shakeX, cfg.look[1] + shakeY * .3, lookZ);
    if (Math.abs(this.camera.fov - cfg.fov) > .01) {
      this.camera.fov = damp(this.camera.fov, cfg.fov, 3, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  updateMenu(dt) {
    this.menuTime += dt;
    this.audio.setEra(5);
    if (this.arena) this.arena.update(dt, 1.2);
    const t = this.menuTime;
    this.camera.position.x = 3.7 + Math.sin(t * .12) * .2;
    this.camera.position.y = 2.75 + Math.sin(t * .23) * .08;
    this.camera.position.z = 8.4;
    this.camera.lookAt(.55 + Math.sin(t * .15) * .05, 1.55, 0);
    if (this.showcase) {
      this.showcase.position.y = Math.sin(t * 1.1) * .018;
      this.showcase.rotation.y = 3.55 + Math.sin(t * .17) * .08;
      const rig = this.showcaseRig;
      if (rig) {
        rig.body.position.y = Math.sin(t * 1.4) * .018;
        if (rig.halo1) rig.halo1.rotation.z += dt * .35;
        if (rig.halo2) rig.halo2.rotation.z -= dt * .23;
        if (rig.aura) rig.aura.rotation.z += dt * .25;
        if (rig.cape) rig.cape.rotation.z = Math.sin(t * .9) * .022;
        if (rig.wingL) { rig.wingL.rotation.z = -.18 + Math.sin(t * 1.2) * .06; rig.wingL.scale.y = 1 + Math.sin(t * 1.2) * .05; }
        if (rig.wingR) { rig.wingR.rotation.z = .18 - Math.sin(t * 1.2) * .06; rig.wingR.scale.y = 1 + Math.sin(t * 1.2) * .05; }
      }
    }
    if (this.showcaseRune) this.showcaseRune.rotation.z += dt * .15;
    if (this.showcaseAura) this.showcaseAura.material.opacity = .17 + Math.sin(t * 1.7) * .06;
    if (this.showcaseMotes && this.menuMoteData) {
      const attr = this.showcaseMotes.geometry.attributes.position;
      for (let i = 0; i < this.menuMoteData.length; i++) {
        const d = this.menuMoteData[i];
        d.a += dt * d.speed * .1;
        attr.array[i * 3] = Math.cos(d.a) * d.r + .35;
        attr.array[i * 3 + 1] = d.y + Math.sin(t * .6 + i) * .18;
        attr.array[i * 3 + 2] = Math.sin(d.a) * d.r * .55 + .2;
      }
      attr.needsUpdate = true;
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2);
  }

  updateHud(force = false) {
    if (!force && this.elapsed - (this.lastHudUpdate || 0) < .08) return;
    this.lastHudUpdate = this.elapsed;
    if (!this.run || !this.stats) return;
    const hp = Math.max(0, this.stats.hp) / this.stats.hpMax;
    this.ui.hpFill.style.transform = `scaleX(${hp})`;
    this.ui.hpText.textContent = Math.ceil(this.stats.hp);
    const sh = Math.max(0, this.stats.shield) / Math.max(1, this.stats.shieldMax);
    this.ui.shieldFill.style.transform = `scaleX(${sh})`;
    this.ui.shieldPipFill.style.transform = `scaleX(${sh})`;
    this.ui.scoreText.textContent = String(Math.floor(this.run.score)).padStart(6, '0');
    this.ui.multiplier.textContent = `×${this.run.multiplier.toFixed(1)}`;
    this.ui.killText.textContent = `${this.run.kills} KILLS`;
    const era = this.run.era;
    const currentThreshold = ERAS[era].threshold;
    const nextThreshold = era < 5 ? ERAS[era + 1].threshold : currentThreshold + 1;
    const pct = era >= 5 ? 1 : Math.min(1, (this.run.kills - currentThreshold) / (nextThreshold - currentThreshold));
    this.ui.evoPct.textContent = `${Math.round(pct * 100)}%`;
    for (let i = 0; i < 6; i++) {
      const seg = this.evoSegments[i];
      seg.classList.toggle('done', i < era);
      seg.classList.toggle('current', i === era);
      seg.style.setProperty('--fill', i < era ? 1 : i === era ? pct : 0);
    }
    this.ui.eraLabel.textContent = `ERA ${ERAS[era].roman} · ${ERAS[era].name}`;
    this.ui.sectorLabel.textContent = `SECTOR 0${era + 1} / 06`;
    if (this.boss) this.ui.bossFill.style.transform = `scaleX(${Math.max(0, this.boss.hp / this.boss.maxHp)})`;
  }

  pause() {
    if (this.phase !== 'playing') return;
    this.paused = true;
    this.phase = 'paused';
    this.ui.pauseOverlay.classList.remove('hidden');
    this.audio.master && this.audio.master.gain.linearRampToValueAtTime(.22, this.audio.ctx.currentTime + .2);
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.paused = false;
    this.phase = 'playing';
    this.ui.pauseOverlay.classList.add('hidden');
    this.clock.getDelta();
    this.audio.master && this.audio.master.gain.linearRampToValueAtTime(this.audio.enabled ? .55 : 0, this.audio.ctx.currentTime + .2);
  }

  quitRun() {
    this.audio.stopMusic();
    this.showMenu();
  }

  endRun(won) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.paused = false;
    this.run.won = won;
    this.audio.stopMusic();
    if (!won) {
      this.audio.lose();
      this.particles.spawn(new THREE.Vector3(this.player.x, 1.2, PLAYER_Z), '#ff5b3d', 45, 9, { life: 1.2 });
      this.shake = .9;
    }
    const score = Math.floor(this.run.score);
    const earned = Math.max(4, Math.floor(score / 520) + this.run.era * 4 + (won ? 55 : 0));
    const newBest = score > this.save.bestScore;
    this.save.bestScore = Math.max(this.save.bestScore, score);
    this.save.cores += earned;
    this.save.runs += 1;
    this.save.kills = (this.save.kills || 0) + this.run.kills;
    if (won) this.save.wins = (this.save.wins || 0) + 1;
    this.save.seenEras = Array.from(new Set([...(this.save.seenEras || []), this.run.era]));
    this.saveFn();
    this.ui.hud.classList.add('hidden');
    this.ui.bossHud.classList.add('hidden');
    this.ui.resultOverlay.classList.remove('hidden');
    this.ui.resultKicker.textContent = won ? 'GATE CONQUERED // SIGNAL ASCENDED' : 'SIGNAL LOST // RUN TERMINATED';
    this.ui.resultTitle.textContent = won ? 'ASCENSION COMPLETE' : 'YOU FELL';
    this.ui.resultSub.textContent = won
      ? 'El Gatekeeper ha caído. Una nueva frecuencia queda grabada en tu genoma.'
      : 'El gate consumió tu señal. La evolución recuerda cada intento.';
    this.ui.resultScore.textContent = String(score);
    this.ui.resultKills.textContent = this.run.kills;
    this.ui.resultEra.textContent = ERAS[this.run.era].roman;
    this.ui.resultCores.textContent = `+${earned}`;
    this.ui.resultBest.textContent = newBest ? 'NEW BEST' : `BEST ${String(this.save.bestScore).padStart(6, '0')}`;
    this.ui.resultBest.style.display = '';
    this.evolving = false;
    this.evoToken++;
    this.ui.evolveOverlay.classList.add('hidden');
    this.ui.pauseOverlay.classList.add('hidden');
    this.refreshMenuStats();
  }

  retry() {
    this.startRun();
  }

  home() {
    this.audio.stopMusic();
    this.showMenu();
  }

  clearRunObjects() {
    this.evoToken++;
    if (this.player.group) { disposeObject(this.player.group); this.scene.remove(this.player.group); this.player.group = null; this.player.rig = null; }
    for (const e of this.enemies) { disposeObject(e.group); this.scene.remove(e.group); }
    this.enemies.length = 0;
    for (const b of this.bullets) this.scene.remove(b.mesh);
    this.bullets.length = 0;
    for (const b of this.enemyBullets) this.scene.remove(b.mesh);
    this.enemyBullets.length = 0;
    for (const p of this.pickups) { disposeObject(p.group); this.scene.remove(p.group); }
    this.pickups.length = 0;
    for (const g of this.gates) { disposeObject(g.group); this.scene.remove(g.group); }
    this.gates.length = 0;
    this.rows.length = 0;
    if (this.boss) { disposeObject(this.boss.group); this.scene.remove(this.boss.group); this.boss = null; }
    this.clearDrones();
    this.clearPool(this.bulletPool);
    this.clearPool(this.enemyBulletPool);
    this.bulletPool.length = 0;
    this.enemyBulletPool.length = 0;
    if (this.arena) { this.arena.dispose(); this.arena = null; }
    this.particles.reset();
    this.shockwaves.clear();
    this.shadow.visible = false;
    this.shake = 0;
    this.flash = 0;
    this.timeScale = 1;
    this.evolving = false;
    this.bossSpawnedRecently = false;
    this.ui.floaters.innerHTML = '';
    if (this.ui.flash) this.ui.flash.style.opacity = '0';
    this.ui.hint.classList.add('hidden');
    this.ui.powerRail.innerHTML = '';
    this.ui.bossHud.classList.add('hidden');
    this.bulletAssets = null;
    this.enemyBulletAssets = null;
  }

  tick() {
    const raw = Math.min(.05, this.clock.getDelta());
    if (this.phase === 'menu') {
      this.updateMenu(raw);
      this.render();
    } else if (this.phase === 'playing') {
      if (!this.paused) {
        this.elapsed += raw;
        this.update(raw * this.timeScale);
      }
      this.render();
    } else if (this.phase === 'paused' || this.phase === 'ended') {
      if (this.arena) this.arena.update(raw, 1.4);
      this.particles.update(raw);
      this.shockwaves.update(raw);
      if (this.phase === 'ended' && this.player.group) {
        this.player.group.rotation.y += raw * .18;
      }
      this.render();
    }
  }

  render() {
    if (!this.arena) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.run && this.run.era >= 2 && this.phase !== 'menu') {
      this.composer.render();
    } else if (this.phase === 'menu') {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.55);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.clearRunObjects();
    this.teardownShowcase();
    this.particles.dispose();
    this.shockwaves.dispose();
    this.composer.dispose?.();
  }
}
