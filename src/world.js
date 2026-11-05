import * as THREE from 'three';
import { ERAS } from './data.js';
import { addMesh, rounded, standard, flat, basic, glow, additive, glowSprite, disposeObject } from './art.js';

const PI = Math.PI;

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function noise(ctx, w, h, color, count, alpha, rand, size = 2) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.fillRect(rand() * w, rand() * h, size * rand(), size * rand());
  }
  ctx.globalAlpha = 1;
}

function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function roadTexture(era) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const ctx = c.getContext('2d');
  const rand = mulberry(40 + era);
  const styles = [
    { base: '#f2e8d4', edge: '#1f1b15', lane: '#726554', accent: '#cf432d', fleck: '#8c7b63' },
    { base: '#e9dfc9', edge: '#1a1d28', lane: '#545d72', accent: '#ff4b28', fleck: '#a9a28e' },
    { base: '#0a0620', edge: '#00f0ff', lane: '#5c2479', accent: '#ff2d95', fleck: '#3a1258' },
    { base: '#0c161c', edge: '#3ed7ff', lane: '#5e4a38', accent: '#ff8a1f', fleck: '#14252c' },
    { base: '#d8c49d', edge: '#a97f36', lane: '#a99774', accent: '#218f86', fleck: '#b9a47c' },
    { base: '#07070f', edge: '#67f7ff', lane: '#3d3157', accent: '#ffcc66', fleck: '#101326' }
  ];
  const s = styles[era];
  ctx.fillStyle = s.base;
  ctx.fillRect(0, 0, 512, 1024);
  noise(ctx, 512, 1024, s.fleck, era === 0 ? 350 : 1600, era === 0 ? 0.1 : 0.18, rand, era === 0 ? 3 : 2);

  if (era === 0) {
    // sketch-paper grain and wobbly lane edges
    ctx.strokeStyle = s.edge;
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 30; i++) {
      const y = rand() * 1024;
      ctx.beginPath();
      ctx.moveTo(20 + rand() * 80, y);
      ctx.lineTo(430 + rand() * 60, y + rand() * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = s.edge;
    ctx.lineWidth = 3;
    ctx.setLineDash([34, 22]);
    for (const x of [32, 480]) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 2, 1024); ctx.stroke();
    }
    ctx.setLineDash([18, 34]);
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(256, 1024); ctx.stroke();
    ctx.setLineDash([]);
  } else if (era === 1) {
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    for (let i = 0; i < 9; i++) ctx.fillRect(0, i * 120, 512, 4);
    ctx.fillStyle = s.accent;
    for (let i = 0; i < 8; i++) ctx.fillRect(40, i * 140 + 36, 34, 58);
    ctx.fillStyle = '#0b69ff';
    for (let i = 0; i < 8; i++) ctx.fillRect(438, i * 140 + 96, 34, 58);
    ctx.strokeStyle = s.edge;
    ctx.lineWidth = 3;
    ctx.setLineDash([42, 28]);
    for (const x of [38, 474]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    ctx.setLineDash([]);
  } else if (era === 2) {
    ctx.strokeStyle = '#00f0ff';
    ctx.globalAlpha = 0.27;
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 1024); ctx.stroke(); }
    for (let i = 0; i < 17; i++) { ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(512, i * 64); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 5;
    for (const x of [18, 494]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([58, 52]);
    for (const x of [86, 426]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    ctx.setLineDash([]);
  } else if (era === 3) {
    // wet asphalt and lane marks
    const grd = ctx.createLinearGradient(0, 0, 512, 0);
    grd.addColorStop(0, 'rgba(62,215,255,.02)');
    grd.addColorStop(.5, 'rgba(0,0,0,.14)');
    grd.addColorStop(1, 'rgba(62,215,255,.02)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(94,160,170,${0.025 + rand() * 0.05})`;
      ctx.fillRect(rand() * 512, rand() * 1024, 40 + rand() * 110, 2 + rand() * 8);
    }
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 4;
    ctx.setLineDash([56, 56]);
    for (const x of [90, 422]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    ctx.strokeStyle = s.edge;
    ctx.lineWidth = 3;
    for (const x of [15, 497]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    ctx.setLineDash([]);
  } else if (era === 4) {
    // marble veins and gold ceremony marks
    ctx.strokeStyle = 'rgba(117,100,67,.26)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      let x = rand() * 512, y = rand() * 1024;
      ctx.moveTo(x, y);
      for (let j = 0; j < 3; j++) { x += (rand() - .5) * 100; y += 40 + rand() * 70; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = s.edge;
    ctx.lineWidth = 4;
    for (const x of [22, 490]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    ctx.setLineDash([16, 20]);
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 2;
    for (const x of [130, 382]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    ctx.setLineDash([]);
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = 'rgba(197,155,70,.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(256, i * 210 + 90, 55, 0, PI * 2); ctx.stroke();
    }
  } else {
    // cosmic obsidian with constellation seams
    for (let i = 0; i < 26; i++) {
      const x = rand() * 512, y = rand() * 1024;
      ctx.fillStyle = rand() > .5 ? 'rgba(103,247,255,.5)' : 'rgba(255,204,102,.4)';
      ctx.fillRect(x, y, 1.6, 1.6);
      if (i % 3 === 0) {
        ctx.strokeStyle = 'rgba(103,247,255,.14)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - .5) * 90, y + 20 + rand() * 60); ctx.stroke();
      }
    }
    ctx.strokeStyle = s.edge;
    ctx.globalAlpha = .6;
    ctx.lineWidth = 2;
    for (const x of [16, 496]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 46]);
    for (const x of [92, 420]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,204,102,.3)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.arc(256, i * 132 + 60, 44, 0, PI * 2); ctx.stroke();
    }
  }
  return canvasTexture(c);
}

function gridTexture(era) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const rand = mulberry(99 + era);
  const configs = [
    ['#efe7d8', '#cabca4', 0.38],
    ['#e8dfcb', '#a7a18e', 0.35],
    ['#080419', '#00f0ff', 0.4],
    ['#06101a', '#1d4650', 0.32],
    ['#d6d0bf', '#b2a17c', 0.35],
    ['#05050d', '#2a2550', 0.42]
  ];
  const [base, line, alpha] = configs[era];
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(256, i * 32); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  noise(ctx, 256, 256, line, 300, .08, rand, 2);
  return canvasTexture(c);
}

function sunTexture(era) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const col = ['#e8b971', '#ff6b3d', '#ff3c8e', '#ff9a43', '#fff0ba', '#ffd98a'][era];
  ctx.clearRect(0, 0, 256, 256);
  const g = ctx.createRadialGradient(128, 128, 5, 128, 128, 112);
  g.addColorStop(0, col);
  g.addColorStop(.65, col);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(128, 128, 112, 0, PI * 2); ctx.fill();
  if (era === 2) {
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, 150 + i * 18, 256, 4 + i * 1.5);
    ctx.globalCompositeOperation = 'source-over';
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeCloud(color, opacity = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  for (let i = 0; i < 5; i++) {
    const m = addMesh(g, new THREE.SphereGeometry(1, 10, 6), mat, [(i - 2) * .85, Math.sin(i * 1.7) * .25, 0]);
    m.scale.set(1.3, .55, .45);
  }
  return g;
}

function makeDoodleTree(ink, accent) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(.09, .14, 2.5, 5), basic(ink), [0, 1.25, 0]);
  for (let i = 0; i < 4; i++) {
    const y = 1.2 + i * .42;
    const r = 1.0 - i * .16;
    addMesh(g, new THREE.TorusGeometry(r, .025, 4, 13, PI * 1.4), basic(ink, { transparent: true, opacity: .8 }), [0, y + .3, 0], [0, 0, .7 + i * .25]);
  }
  addMesh(g, new THREE.BoxGeometry(.24, .07, .07), basic(accent), [.3, 1.4, 0], [0, 0, -.4]);
  return g;
}

export class Arena {
  constructor(scene, era, { menu = false } = {}) {
    this.scene = scene;
    this.era = era;
    this.menu = menu;
    this.palette = ERAS[era];
    this.group = new THREE.Group();
    this.group.name = `arena-era-${era}`;
    scene.add(this.group);
    this.props = [];
    this.edgeLights = [];
    this.menuRings = [];
    this.time = 0;
    this.random = mulberry(7 + era);
    this.roadMat = null;
    this.gridMat = null;
    this.rain = null;

    this.setSceneMood();
    this.setupSky();
    this.setupLights();
    if (menu) this.setupMenuPlatform();
    else this.setupGround();
    this.setupScenery();
    this.setupAtmosphere();
  }

  setSceneMood() {
    const p = this.palette.sky;
    this.scene.background = new THREE.Color(p.bottom);
    this.scene.fog = new THREE.FogExp2(p.fog, p.density);
  }

  setupSky() {
    const p = this.palette.sky;
    const uniforms = {
      topColor: { value: new THREE.Color(p.top) },
      bottomColor: { value: new THREE.Color(p.bottom) },
      horizonColor: { value: new THREE.Color(p.horizon) },
      sunColor: { value: new THREE.Color(p.sun) },
      time: { value: 0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 horizonColor; uniform vec3 sunColor; uniform float time; varying vec3 vWorld;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        void main(){
          vec3 d=normalize(vWorld);
          float h=clamp(d.y*.5+.5,0.0,1.0);
          vec3 col=mix(bottomColor, topColor, smoothstep(.15,1.0,h));
          float hz=exp(-pow((d.y-.02)*9.0,2.0));
          col=mix(col,horizonColor,hz*.5);
          vec3 sunDir=normalize(vec3(-.15,.16,-.98));
          float sd=max(dot(d,sunDir),0.0);
          col+=sunColor*pow(sd,220.0)*1.6;
          col+=sunColor*pow(sd,18.0)*.13;
          float band=exp(-pow((d.y-.03)*26.0,2.0));
          col+=horizonColor*band*.09;
          gl_FragColor=vec4(col,1.0);
        }`
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(260, 36, 20), mat);
    this.sky.frustumCulled = false;
    this.group.add(this.sky);
    this.skyUniforms = uniforms;

    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTexture(this.era),
      color: 0xffffff,
      transparent: true,
      opacity: this.era === 0 ? .75 : this.era === 4 ? .5 : this.era === 5 ? .58 : .95,
      blending: this.era <= 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    }));
    const sunScale = [36, 46, 55, 36, 38, 32][this.era];
    sun.scale.set(sunScale, sunScale, 1);
    sun.position.set(-28, 38, -220);
    this.group.add(sun);
    this.sunSprite = sun;

    if (this.era === 0) {
      // hand-drawn orbital ring around the paper sun
      const ring = addMesh(this.group, new THREE.TorusGeometry(17, .14, 4, 64), basic(0x2a231b, { transparent: true, opacity: .4 }), [-28, 38, -218]);
      ring.scale.set(1, 1, .4);
      this.sunRing = ring;
    }

    if (this.era >= 2) {
      const rand = mulberry(12 + this.era);
      const count = this.era === 4 ? 700 : 520;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = rand() * PI * 2;
        const r = 60 + rand() * 180;
        const y = 10 + rand() * 130;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = Math.sin(a) * r - 50;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const stars = new THREE.Points(geo, new THREE.PointsMaterial({
        color: this.era === 4 ? 0xffedbe : 0xc8eaff,
        size: this.era === 2 ? 1.2 : .75,
        transparent: true,
        opacity: .75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        sizeAttenuation: true
      }));
      this.group.add(stars);
      this.stars = stars;
    }

    if (this.era === 5) {
      // distant ringed planet
      const planet = addMesh(this.group, new THREE.SphereGeometry(22, 32, 20), new THREE.MeshBasicMaterial({ color: 0x29305a, fog: false }), [66, 84, -205]);
      addMesh(planet, new THREE.SphereGeometry(22.1, 32, 20), new THREE.MeshBasicMaterial({ color: 0x6f567d, transparent: true, opacity: .22, wireframe: true, fog: false }));
      const ring = addMesh(this.group, new THREE.TorusGeometry(34, 1.3, 5, 80), new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: .34, fog: false }), [66, 84, -205], [1.25, .2, .5]);
      ring.scale.set(1, 1.25, 1);
      const glowS = glowSprite(0xffcc66, 65, .13); glowS.position.set(66, 84, -210); this.group.add(glowS);
    }
  }

  setupLights() {
    this.scene.add(this.group);
    const configs = [
      { hemiSky: 0xfff8ea, hemiGround: 0xb5a58b, hemi: 2.4, dir: 0xfff6e2, dirInt: 1.8, pos: [-8, 18, 10], shadows: false },
      { hemiSky: 0xd9f4f5, hemiGround: 0xd8b58d, hemi: 1.9, dir: 0xffd9b2, dirInt: 3.1, pos: [-10, 18, 8], shadows: true },
      { hemiSky: 0x7a4eff, hemiGround: 0x0a0820, hemi: 1.0, dir: 0xff4fd1, dirInt: 2.7, pos: [-9, 16, 10], shadows: true },
      { hemiSky: 0x4f9bb8, hemiGround: 0x050b10, hemi: .75, dir: 0xffb36b, dirInt: 2.9, pos: [-7, 15, 8], shadows: true },
      { hemiSky: 0xffe2b2, hemiGround: 0x45473e, hemi: 1.1, dir: 0xffdc9e, dirInt: 2.0, pos: [-9, 20, 9], shadows: true },
      { hemiSky: 0x6a4fff, hemiGround: 0x03040b, hemi: .8, dir: 0xffcf7a, dirInt: 3.5, pos: [-8, 17, 9], shadows: true }
    ][this.era];
    this.hemi = new THREE.HemisphereLight(configs.hemiSky, configs.hemiGround, configs.hemi);
    this.group.add(this.hemi);

    this.dirLight = new THREE.DirectionalLight(configs.dir, configs.dirInt);
    this.dirLight.position.set(...configs.pos);
    this.dirLight.target.position.set(0, 0, -16);
    this.group.add(this.dirLight);
    this.group.add(this.dirLight.target);
    if (configs.shadows) {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.set(1024, 1024);
      this.dirLight.shadow.camera.left = -16;
      this.dirLight.shadow.camera.right = 16;
      this.dirLight.shadow.camera.top = 20;
      this.dirLight.shadow.camera.bottom = -14;
      this.dirLight.shadow.camera.near = 1;
      this.dirLight.shadow.camera.far = 60;
      this.dirLight.shadow.bias = -0.0006;
    }

    const accentCol = new THREE.Color(this.palette.accent).getHex();
    const accent2 = new THREE.Color(this.palette.accent2).getHex();
    this.rimL = new THREE.PointLight(accentCol, this.era >= 2 ? 30 : 4, 28, 2);
    this.rimL.position.set(-7, 4, -16);
    this.group.add(this.rimL);
    this.rimR = new THREE.PointLight(accent2, this.era >= 2 ? 24 : 2, 30, 2);
    this.rimR.position.set(7, 3.5, -30);
    this.group.add(this.rimR);

    if (this.era >= 3) {
      this.backLight = new THREE.PointLight(accentCol, 55, 60, 2);
      this.backLight.position.set(0, 7, -55);
      this.group.add(this.backLight);
    }
  }

  setupGround() {
    // Side terrain
    const p = this.palette.sky;
    const sideColor = new THREE.Color(p.fog).multiplyScalar(this.era <= 1 ? 1 : .55);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: sideColor,
      roughness: 1,
      metalness: 0,
      map: (this.era === 2 || this.era === 5 || this.era === 3) ? gridTexture(this.era) : null
    });
    if (terrainMat.map) {
      terrainMat.map.repeat.set(32, 32);
      this.gridMat = terrainMat.map;
    }
    const terrain = addMesh(this.group, new THREE.PlaneGeometry(240, 240), terrainMat, [0, -.08, -76], [-PI / 2, 0, 0]);
    terrain.receiveShadow = true;

    const trackTex = roadTexture(this.era);
    trackTex.repeat.set(1, 7);
    this.roadMat = new THREE.MeshStandardMaterial({
      map: trackTex,
      roughness: this.era === 3 ? .28 : this.era === 2 ? .6 : .9,
      metalness: this.era === 3 ? .48 : this.era === 2 ? .3 : .04,
      color: 0xffffff
    });
    this.roadTexture = trackTex;
    const road = addMesh(this.group, new THREE.PlaneGeometry(10.2, 155), this.roadMat, [0, .004, -57], [-PI / 2, 0, 0]);
    road.receiveShadow = true;

    // side rails / neon edges
    const accent = new THREE.Color(this.palette.accent).getHex();
    const edgeMat = this.era <= 1
      ? basic(0x1a1713)
      : glow(accent, this.era >= 2 ? 2.8 : .4);
    addMesh(this.group, new THREE.BoxGeometry(.13, .17, 155), edgeMat, [-5.16, .08, -57]);
    addMesh(this.group, new THREE.BoxGeometry(.13, .17, 155), edgeMat, [5.16, .08, -57]);
    if (this.era >= 2) {
      const accent2 = new THREE.Color(this.palette.accent2).getHex();
      addMesh(this.group, new THREE.BoxGeometry(.035, .025, 155), glow(accent2, 2.8), [-5.1, .18, -57]);
      addMesh(this.group, new THREE.BoxGeometry(.035, .025, 155), glow(accent2, 2.8), [5.1, .18, -57]);
    }

    // animated edge dashes
    const dashMat = this.era <= 1 ? basic(0x2b251e) : glow(accent, 2);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 16; i++) {
        const dash = addMesh(this.group, new THREE.BoxGeometry(.18, .035, .72), dashMat, [side * 4.68, .22, 22 - i * 10]);
        dash.userData.edge = true;
        this.edgeLights.push(dash);
      }
    }

    if (this.era >= 2 && this.era !== 4) {
      // horizontal light bars on the side ground
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 6; i++) {
          const bar = addMesh(this.group, new THREE.BoxGeometry(12, .045, .05), glow(new THREE.Color(this.palette.accent2).getHex(), 1.2), [side * 12, .01, 10 - i * 26], [0, this.random() * .3, 0]);
          bar.material.transparent = true;
          bar.material.opacity = .35;
        }
      }
    }
  }

  setupMenuPlatform() {
    const group = new THREE.Group();
    this.group.add(group);
    const black = standard(0x06080d, { metalness: .85, roughness: .22 });
    const gold = standard(0xd8aa53, { metalness: .95, roughness: .18 });
    const cyan = glow(0x67f7ff, 3.4);
    addMesh(group, new THREE.CylinderGeometry(4.4, 4.8, .38, 8), black, [0, -.22, 0]);
    addMesh(group, new THREE.CylinderGeometry(4.48, 4.48, .06, 8), gold, [0, -.02, 0]);
    addMesh(group, new THREE.TorusGeometry(4.5, .028, 4, 8), cyan, [0, .01, 0], [PI / 2, 0, 0]);
    addMesh(group, new THREE.TorusGeometry(3.7, .012, 4, 64), gold, [0, .035, 0], [PI / 2, 0, 0]);
    addMesh(group, new THREE.TorusGeometry(3.95, .006, 4, 64), cyan, [0, .04, 0], [PI / 2, 0, 0]);

    // portal behind the hero
    const portal = new THREE.Group();
    portal.position.set(0, 4.3, -5.5);
    addMesh(portal, new THREE.TorusGeometry(3.6, .09, 8, 96), gold, [0, 0, 0]);
    addMesh(portal, new THREE.TorusGeometry(3.28, .03, 4, 96), cyan, [0, 0, .04]);
    addMesh(portal, new THREE.TorusGeometry(4.0, .018, 4, 96), glow(0xffcc66, 2.2), [0, 0, 0], [0, 0, 0]);
    const discMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGold: { value: new THREE.Color(0xffcc66) }, uCyan: { value: new THREE.Color(0x67f7ff) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uGold; uniform vec3 uCyan; varying vec2 vUv;
        void main(){ vec2 p=vUv-.5; float r=length(p)*2.0; float a=atan(p.y,p.x);
        float swirl=sin(a*7.0+r*18.0-uTime*1.4)*.5+.5;
        vec3 col=mix(vec3(.005,.008,.02),uCyan*.18,swirl*.7);
        col+=uGold*pow(1.0-r,3.0)*.5;
        float alpha=smoothstep(1.0,.82,r)*.9;
        gl_FragColor=vec4(col,alpha); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    addMesh(portal, new THREE.CircleGeometry(3.22, 64), discMat, [0, 0, -.06]);
    const glowS = glowSprite(0xffcc66, 6.4, .13); glowS.position.set(0, 0, -.2); portal.add(glowS);
    group.add(portal);
    this.portal = portal;
    this.portalMat = discMat;

    // floating exterior shards
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2;
      const r = 5.9 + this.random() * 2.2;
      const shard = addMesh(group, new THREE.OctahedronGeometry(.12 + this.random() * .22, 0), i % 3 === 0 ? gold : black, [Math.cos(a) * r, .4 + this.random() * 4.6, Math.sin(a) * r * .55 - 1]);
      shard.userData.spin = .2 + this.random() * .4;
      shard.userData.baseY = shard.position.y;
      this.menuRings.push(shard);
    }
  }

  setupScenery() {
    if (this.menu) return;
    const era = this.era;
    const accent = new THREE.Color(this.palette.accent).getHex();
    const accent2 = new THREE.Color(this.palette.accent2).getHex();
    const ink = 0x211c16;

    const addProp = (obj, x, z, opts = {}) => {
      obj.position.x = x;
      obj.position.z = z;
      obj.position.y = opts.y || 0;
      this.group.add(obj);
      this.props.push({ obj, baseY: obj.position.y, spin: opts.spin || 0, float: opts.float || 0, phase: this.random() * PI * 2, wrap: opts.wrap !== false });
      return obj;
    };

    if (era === 0) {
      for (let i = 0; i < 11; i++) {
        const z = 18 - i * 13;
        addProp(makeDoodleTree(ink, accent), -7.2 - this.random() * 3.4, z, { spin: .06 });
        addProp(makeDoodleTree(ink, accent), 7.2 + this.random() * 3.4, z - 6, { spin: -.06 });
      }
      for (let i = 0; i < 6; i++) {
        const cloud = makeCloud(0xfffbf1, .85);
        cloud.scale.setScalar(1.1 + this.random() * 1.6);
        addProp(cloud, (this.random() - .5) * 24, -70 - i * 17, { y: 11 + this.random() * 8, wrap: false, float: .3, spin: .02 });
      }
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Group();
        addMesh(m, new THREE.ConeGeometry(5 + this.random() * 4, 7 + this.random() * 5, 4), basic(0xe3dac7), [0, 3, 0]);
        const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.ConeGeometry(5, 7, 4)), new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: .18 }));
        outline.position.y = 3;
        m.add(outline);
        addProp(m, (i % 2 ? 1 : -1) * (16 + this.random() * 7), -82 - i * 7, { wrap: false });
      }
      // oversized ink ring floating on the left
      const ring = new THREE.Group();
      addMesh(ring, new THREE.TorusGeometry(3.0, .035, 4, 32), basic(0x2a231b, { transparent: true, opacity: .3 }), [0, 0, 0]);
      addMesh(ring, new THREE.TorusGeometry(2.1, .025, 4, 28), basic(0xcf432d, { transparent: true, opacity: .4 }), [0, 0, 0], [0, 0, .7]);
      addProp(ring, -10, -18, { y: 5.4, float: .45, spin: .25, wrap: false });
    } else if (era === 1) {
      const colors = [0xff4b28, 0x0b69ff, 0xf6c944, 0x1b2238, 0xffffff];
      for (let i = 0; i < 10; i++) {
        const z = 18 - i * 14;
        const side = i % 2 ? 1 : -1;
        const g = new THREE.Group();
        const c = colors[i % colors.length];
        if (i % 3 === 0) {
          addMesh(g, new THREE.BoxGeometry(1.7, 3.2 + this.random() * 2, 1.7), flat(c), [0, 1.8, 0], [0, this.random() * .5, 0]);
          addMesh(g, new THREE.ConeGeometry(1.1, 1.7, 3), flat(colors[(i + 2) % colors.length]), [0, 4, 0], [0, .4, 0]);
        } else if (i % 3 === 1) {
          addMesh(g, new THREE.CylinderGeometry(.6, 1.2, 4.6, 3), flat(c), [0, 2.3, 0]);
          addMesh(g, new THREE.OctahedronGeometry(.9, 0), flat(colors[(i + 1) % colors.length]), [0, 5.1, 0]);
        } else {
          addMesh(g, new THREE.TorusGeometry(1.7, .3, 4, 4), flat(c), [0, 2.4, 0], [0, 0, PI / 4]);
        }
        addProp(g, side * (7.5 + this.random() * 2.5), z, { spin: (this.random() - .5) * .06 });
      }
      for (let i = 0; i < 7; i++) {
        const cube = addMesh(new THREE.Group(), new THREE.BoxGeometry(1.3, 1.3, 1.3), flat(colors[i % colors.length]), [0, 0, 0]);
        addProp(cube.parent, (this.random() > .5 ? 1 : -1) * (11 + this.random() * 9), -25 - i * 14, { y: 4 + this.random() * 6, spin: .4, float: .45, wrap: false });
      }
      // giant red ring in the distance
      const ring = addMesh(this.group, new THREE.TorusGeometry(12, .35, 6, 36), flat(0xff4b28), [0, 14, -115]);
      ring.rotation.x = .1;
      this.props.push({ obj: ring, baseY: 14, spin: .02, float: 0, phase: 0, wrap: false });
    } else if (era === 2) {
      for (let i = 0; i < 9; i++) {
        const z = 15 - i * 16;
        const side = i % 2 ? 1 : -1;
        const g = new THREE.Group();
        const h = 4 + this.random() * 8;
        addMesh(g, new THREE.BoxGeometry(1.3, h, 1.3), standard(0x09061c, { metalness: .65, roughness: .3 }), [0, h / 2, 0]);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.32, h, 1.32)), new THREE.LineBasicMaterial({ color: i % 2 ? accent2 : accent, transparent: true, opacity: .9 }));
        edges.position.y = h / 2;
        g.add(edges);
        for (let j = 0; j < 4; j++) {
          addMesh(g, new THREE.BoxGeometry(1.0, .035, .02), glow(i % 2 ? accent2 : accent, 2.4), [0, .8 + j * (h / 5), -.67]);
        }
        addProp(g, side * (7 + this.random() * 4), z, { spin: .025 });
      }
      for (let i = 0; i < 5; i++) {
        const arch = new THREE.Group();
        addMesh(arch, new THREE.TorusGeometry(6.3, .07, 4, 48, PI), glow(accent, 2.7), [0, 0, 0]);
        addMesh(arch, new THREE.TorusGeometry(6.0, .025, 4, 48, PI), glow(accent2, 2.9), [0, 0, 0]);
        addProp(arch, 0, -12 - i * 24, { y: .8, wrap: false, spin: 0 });
      }
      for (let i = 0; i < 14; i++) {
        const ring = addMesh(new THREE.Group(), new THREE.TorusGeometry(.8 + this.random(), .012, 4, 40), basic(i % 2 ? accent : accent2, { transparent: true, opacity: .28 }), [0, 0, 0], [this.random(), 0, this.random()]);
        addProp(ring.parent, (this.random() > .5 ? 1 : -1) * (8 + this.random() * 13), -22 - this.random() * 80, { y: 2 + this.random() * 12, spin: .2, float: .3, wrap: false });
      }
    } else if (era === 3) {
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1;
        const z = 18 - i * 10;
        const h = 5 + this.random() * 15;
        const g = new THREE.Group();
        const body = addMesh(g, new THREE.BoxGeometry(2.2 + this.random() * 2, h, 2.2), standard(0x0a141b, { metalness: .7, roughness: .38 }), [0, h / 2, 0]);
        const winMat = glow(this.random() > .45 ? accent : accent2, 1.9);
        for (let j = 0; j < Math.floor(h / 1.2); j++) {
          for (let k = 0; k < 3; k++) {
            if (this.random() > .55) addMesh(g, new THREE.BoxGeometry(.13, .2, .02), winMat, [-.7 + k * .6, .5 + j * 1.1, 1.12]);
          }
        }
        addMesh(g, new THREE.BoxGeometry(2.3, .06, .07), glow(accent2, 2.8), [0, h, 1.1]);
        addProp(g, side * (9 + this.random() * 7), z, { spin: .015 });
      }
      // distant megastructure
      const mega = new THREE.Group();
      addMesh(mega, new THREE.BoxGeometry(11, 40, 4), standard(0x091219, { metalness: .6, roughness: .5 }), [0, 20, 0]);
      for (let i = 0; i < 12; i++) addMesh(mega, new THREE.BoxGeometry(.16, .35, .04), glow(i % 2 ? accent : accent2, 2.4), [-4 + (i % 6) * 1.6, 8 + Math.floor(i / 6) * 19, 2.02]);
      addProp(mega, -20, -90, { wrap: false });
      for (let i = 0; i < 4; i++) {
        const beam = addMesh(this.group, new THREE.BoxGeometry(.05, 15, .05), basic(accent2, { transparent: true, opacity: .16 }), [(this.random() > .5 ? 1 : -1) * (12 + this.random() * 7), 7.5, -20 - i * 24]);
        this.props.push({ obj: beam, baseY: 7.5, spin: 0, float: 0, phase: 0, wrap: false });
      }
    } else if (era === 4) {
      const gold = 0xd8b460;
      const ivory = 0xece1c6;
      const teal = 0x6af4e3;
      for (let i = 0; i < 9; i++) {
        const side = i % 2 ? 1 : -1;
        const z = 18 - i * 15;
        const g = new THREE.Group();
        const h = 5 + this.random() * 3;
        addMesh(g, new THREE.CylinderGeometry(.38, .55, h, 10), standard(ivory, { metalness: .25, roughness: .5 }), [0, h / 2, 0]);
        addMesh(g, new THREE.CylinderGeometry(1.0, .55, .45, 10), standard(gold, { metalness: .9, roughness: .22 }), [0, h, 0]);
        addMesh(g, new THREE.CylinderGeometry(.55, 1.0, .42, 10), standard(gold, { metalness: .9, roughness: .22 }), [0, 0, 0]);
        addMesh(g, new THREE.TorusGeometry(.72, .035, 4, 24), glow(teal, 1.6), [0, h + .45, 0], [PI / 2, 0, 0]);
        addProp(g, side * (7.5 + this.random() * 3.5), z, { spin: .02 });
      }
      for (let i = 0; i < 6; i++) {
        const island = new THREE.Group();
        addMesh(island, new THREE.CylinderGeometry(1.4 + this.random(), 1.0, .5, 6), standard(ivory, { metalness: .2, roughness: .6 }), [0, 0, 0]);
        addMesh(island, new THREE.CylinderGeometry(1.45 + this.random(), 1.45, .08, 6), standard(gold, { metalness: .9, roughness: .2 }), [0, .26, 0]);
        addMesh(island, new THREE.ConeGeometry(.8, 2.2, 5), standard(0x8b8e7c, { roughness: .9 }), [0, -1.3, 0], [PI, 0, 0]);
        addProp(island, (this.random() > .5 ? 1 : -1) * (10 + this.random() * 12), -10 - i * 20, { y: 3 + this.random() * 6, spin: .08, float: .4, wrap: false });
      }
      for (let i = 0; i < 4; i++) {
        const arch = new THREE.Group();
        addMesh(arch, new THREE.TorusGeometry(7.2, .18, 6, 48, PI), standard(gold, { metalness: .88, roughness: .2 }), [0, 0, 0]);
        addMesh(arch, new THREE.TorusGeometry(6.85, .06, 4, 48, PI), glow(teal, 2.6), [0, 0, 0]);
        addProp(arch, 0, -18 - i * 27, { y: .2, wrap: false });
      }
    } else {
      const gold = 0xd8ad55;
      const cyan = 0x67f7ff;
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1;
        const z = 16 - i * 14;
        const g = new THREE.Group();
        const h = 4 + this.random() * 10;
        addMesh(g, new THREE.ConeGeometry(.75, h, 4), standard(0x070812, { metalness: .85, roughness: .22 }), [0, h / 2, 0], [0, this.random(), 0]);
        addMesh(g, new THREE.ConeGeometry(.78, h * .55, 4), glow(cyan, .55), [0, h * .3, 0], [0, this.random(), 0]);
        addMesh(g, new THREE.TorusGeometry(1.2 + this.random(), .02, 4, 32), glow(i % 3 ? gold : cyan, 2), [0, h * .45, 0], [PI / 2.4, 0, 0]);
        addProp(g, side * (8 + this.random() * 5), z, { spin: .03 });
      }
      for (let i = 0; i < 5; i++) {
        const arch = new THREE.Group();
        addMesh(arch, new THREE.TorusGeometry(7.5, .1, 6, 64, PI), standard(gold, { metalness: .96, roughness: .16 }), [0, 0, 0]);
        addMesh(arch, new THREE.TorusGeometry(7.2, .035, 4, 64, PI), glow(cyan, 2.5), [0, 0, 0]);
        for (let j = 0; j < 5; j++) {
          const a = j / 5 * PI;
          addMesh(arch, new THREE.OctahedronGeometry(.12, 0), glow(gold, 2.4), [Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0]);
        }
        addProp(arch, 0, -15 - i * 26, { y: .3, wrap: false });
      }
      for (let i = 0; i < 16; i++) {
        const shard = addMesh(new THREE.Group(), new THREE.OctahedronGeometry(.2 + this.random() * .6, 0), standard(i % 3 ? 0x090b18 : gold, { metalness: .8, roughness: .2 }), [0, 0, 0]);
        addProp(shard.parent, (this.random() > .5 ? 1 : -1) * (9 + this.random() * 15), -20 - this.random() * 90, { y: 2 + this.random() * 14, spin: .2, float: .25, wrap: false });
      }
    }
  }

  setupAtmosphere() {
    if (this.menu) {
      const menuMotes = this.createMotes(130, 0x9fefff, 16, 8);
      menuMotes.position.z = -3;
      this.group.add(menuMotes);
      this.motes = menuMotes;
      return;
    }
    if (this.era === 3) {
      const count = 500;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (this.random() - .5) * 34;
        pos[i * 3 + 1] = this.random() * 19;
        pos[i * 3 + 2] = -50 + this.random() * 65;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0x8ce2ff, size: .055, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      this.group.add(this.rain);
      this.rainPositions = pos;
    }
    if (this.era >= 2) {
      const motes = this.createMotes(this.era === 4 ? 120 : 80, this.era === 4 ? 0xffd98a : this.palette.accent2, 10, 4.5);
      this.group.add(motes);
      this.motes = motes;
    }
  }

  createMotes(count, color, yRange, xRange) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (this.random() - .5) * xRange * 2;
      pos[i * 3 + 1] = .3 + this.random() * yRange;
      pos[i * 3 + 2] = -45 + this.random() * 65;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size: .09, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    points.userData.positions = pos;
    points.userData.seed = this.random() * 10;
    return points;
  }

  update(dt, speed) {
    this.time += dt;
    const scroll = speed * dt;
    if (!this.menu) {
      if (this.roadTexture) this.roadTexture.offset.y -= scroll * .009;
      if (this.gridMat) this.gridMat.offset.y -= scroll * .012;
      for (const item of this.props) {
        if (item.wrap) {
          item.obj.position.z += scroll;
          if (item.obj.position.z > 28) item.obj.position.z -= 150;
        }
        item.obj.position.y = item.baseY + Math.sin(this.time * 1.4 + item.phase) * item.float;
        if (item.spin) item.obj.rotation.y += item.spin * dt;
      }
      for (const dash of this.edgeLights) {
        dash.position.z += scroll;
        if (dash.position.z > 26) dash.position.z -= 80;
      }
      if (this.rain) {
        const arr = this.rainPositions;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] -= dt * 18;
          arr[i + 2] += scroll * .4;
          if (arr[i + 1] < 0) { arr[i + 1] = 19; arr[i + 2] = -50 + this.random() * 60; }
          if (arr[i + 2] > 18) arr[i + 2] -= 65;
        }
        this.rain.geometry.attributes.position.needsUpdate = true;
      }
      if (this.motes) {
        const arr = this.motes.userData.positions;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] += Math.sin(this.time + i) * dt * .08;
          arr[i + 2] += scroll * .24;
          if (arr[i + 2] > 18) arr[i + 2] -= 65;
        }
        this.motes.geometry.attributes.position.needsUpdate = true;
      }
      if (this.sunRing) this.sunRing.rotation.z += dt * .04;
      if (this.stars) this.stars.rotation.y += dt * .002;
    } else {
      if (this.portal) {
        this.portalMat.uniforms.uTime.value = this.time;
        this.portal.rotation.z += dt * .03;
      }
      for (const shard of this.menuRings) {
        shard.position.y = shard.userData.baseY + Math.sin(this.time * .7 + shard.position.x) * .22;
        shard.rotation.y += shard.userData.spin * dt;
        shard.rotation.x += shard.userData.spin * dt * .45;
      }
      if (this.motes) {
        const arr = this.motes.userData.positions;
        for (let i = 0; i < arr.length; i += 3) arr[i + 1] += Math.sin(this.time * .7 + i) * dt * .15;
        this.motes.geometry.attributes.position.needsUpdate = true;
      }
    }
    this.skyUniforms.time.value = this.time;
    // gentle light motion
    this.rimL.intensity = this.era >= 2 ? (24 + Math.sin(this.time * 1.7) * 7) : this.rimL.intensity;
    this.rimR.intensity = this.era >= 2 ? (19 + Math.cos(this.time * 1.3) * 6) : this.rimR.intensity;
  }

  dispose() {
    disposeObject(this.group);
    this.scene.remove(this.group);
    if (this.scene.fog) this.scene.fog = null;
  }
}
