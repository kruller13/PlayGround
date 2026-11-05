import './styles.css';
import * as THREE from 'three';
import { Game } from './game.js';
import { SoundEngine } from './audio.js';
import { ERAS, UPGRADES, STORAGE_KEY, defaultSave, upgradeCost } from './data.js';

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed, upgrades: { ...defaultSave().upgrades, ...(parsed.upgrades || {}) } };
  } catch {
    return defaultSave();
  }
}

const save = loadSave();
const saveFn = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch {}
};

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x03040a, 1);

const audio = new SoundEngine();
audio.enabled = save.audio !== false;

const game = new Game({ renderer, audio, save, saveFn });
window.__EGS = game;

/* ── Sound ── */
const soundBtn = document.getElementById('soundBtn');
function refreshSound() {
  soundBtn.classList.toggle('muted', !audio.enabled);
  soundBtn.setAttribute('aria-pressed', String(audio.enabled));
}
refreshSound();
soundBtn.addEventListener('click', e => {
  e.stopPropagation();
  audio.init();
  audio.enabled = !audio.enabled;
  audio.setEnabled(audio.enabled);
  save.audio = audio.enabled;
  saveFn();
  refreshSound();
  audio.click();
});

/* ── Start / pause / result ── */
const playBtn = document.getElementById('playBtn');
playBtn.addEventListener('click', () => {
  audio.init();
  audio.setEnabled(audio.enabled);
  audio.click();
  game.startRun();
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  audio.click();
  game.pause();
});
document.getElementById('resumeBtn').addEventListener('click', () => {
  audio.click();
  game.resume();
});
document.getElementById('quitBtn').addEventListener('click', () => {
  audio.click();
  game.quitRun();
});
document.getElementById('retryBtn').addEventListener('click', () => {
  audio.click();
  game.retry();
});
document.getElementById('homeBtn').addEventListener('click', () => {
  audio.click();
  game.home();
});

/* ── Lab ── */
const labOverlay = document.getElementById('labOverlay');
const labList = document.getElementById('labList');
const labCores = document.getElementById('labCores');

function renderLab() {
  labCores.textContent = Math.floor(save.cores);
  labList.innerHTML = '';
  UPGRADES.forEach(def => {
    const level = save.upgrades[def.id] || 0;
    const cost = upgradeCost(def, level);
    const maxed = level >= def.max;
    const row = document.createElement('div');
    row.className = 'lab-row';
    row.innerHTML = `
      <div class="lab-icon">${def.icon}</div>
      <div class="lab-info">
        <strong>${def.name}</strong>
        <span>${def.desc}</span>
        <div class="lab-level">${Array.from({ length: def.max }, (_, i) => `<i class="${i < level ? 'filled' : ''}"></i>`).join('')}</div>
      </div>
      <button class="buy-btn" ${maxed || save.cores < cost ? 'disabled' : ''} data-upgrade="${def.id}">
        ${maxed ? 'MAX' : `◈ <b>${cost}</b>`}
      </button>`;
    labList.appendChild(row);
  });
}

labList.addEventListener('click', e => {
  const btn = e.target.closest('[data-upgrade]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.upgrade;
  const def = UPGRADES.find(u => u.id === id);
  if (!def) return;
  const level = save.upgrades[id] || 0;
  const cost = upgradeCost(def, level);
  if (level >= def.max || save.cores < cost) return;
  save.cores -= cost;
  save.upgrades[id] = level + 1;
  saveFn();
  audio.click();
  renderLab();
  game.refreshMenuStats();
});
document.getElementById('labBtn').addEventListener('click', () => {
  audio.click();
  renderLab();
  labOverlay.classList.remove('hidden');
});

/* ── Codex ── */
const codexOverlay = document.getElementById('codexOverlay');
const codexList = document.getElementById('codexList');
function renderCodex() {
  codexList.innerHTML = '';
  ERAS.forEach((era, i) => {
    const seen = save.seenEras.includes(i);
    const row = document.createElement('div');
    row.className = `codex-row ${seen ? 'seen' : ''} ${i === 0 ? 'current' : ''}`;
    row.innerHTML = `
      <div class="codex-num">${era.roman}</div>
      <div class="codex-info">
        <strong>${era.name} // ${era.kicker}</strong>
        <span>${seen ? era.description : 'ARCHIVO BLOQUEADO — evoluciona para revelar.'}</span>
      </div>
      <div class="codex-state">${seen ? 'SEEN' : 'LOCKED'}</div>`;
    codexList.appendChild(row);
  });
}
document.getElementById('codexBtn').addEventListener('click', () => {
  audio.click();
  renderCodex();
  codexOverlay.classList.remove('hidden');
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    audio.click();
    const el = document.getElementById(btn.dataset.close);
    el?.classList.add('hidden');
  });
});
labOverlay.addEventListener('click', e => { if (e.target === labOverlay) labOverlay.classList.add('hidden'); });
codexOverlay.addEventListener('click', e => { if (e.target === codexOverlay) codexOverlay.classList.add('hidden'); });

/* ── Resize / visibility ── */
let resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => game.resize());
});
window.addEventListener('orientationchange', () => setTimeout(() => game.resize(), 250));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'playing') game.pause();
});

/* Prevent context menu and browser gestures inside the game. */
window.addEventListener('contextmenu', e => {
  if (e.target.closest('#app')) e.preventDefault();
});
document.addEventListener('touchmove', e => {
  if (e.target.closest('#app') && !e.target.closest('.modal')) e.preventDefault();
}, { passive: false });

document.fonts.ready.then(() => {
  game.refreshMenuStats();
});
