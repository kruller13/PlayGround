export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.enabled = true;
    this.era = 0;
    this.started = false;
    this.droneNodes = [];
    this.noiseBuffer = null;
    this.lastShot = 0;
    this.lastHit = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.55 : 0;
    this.master.connect(this.ctx.destination);

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(comp);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(comp);

    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(on ? 0.55 : 0, this.ctx.currentTime + 0.12);
  }

  startMusic() {
    this.init();
    if (!this.ctx || this.started) return;
    this.started = true;
    this.buildDrone();
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.musicBus.gain.exponentialRampToValueAtTime(0.25, this.ctx.currentTime + 2.5);
  }

  stopMusic() {
    if (!this.ctx) return;
    this.musicBus.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
    for (const node of this.droneNodes) {
      try { node.stop(this.ctx.currentTime + 1); } catch {}
    }
    this.droneNodes = [];
    this.started = false;
  }

  buildDrone() {
    if (!this.ctx) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 3.2;
    filter.connect(this.musicBus);

    const base = [55, 82.41, 110, 130.81];
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i < 2 ? 'sawtooth' : 'sine';
      osc.frequency.value = base[i] * (i === 3 ? 2 : 1);
      osc.detune.value = (i - 1.5) * 7;
      gain.gain.value = i < 2 ? 0.07 : 0.03;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      this.droneNodes.push(osc);
    }
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.055;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.droneNodes.push(lfo);
    this.droneFilter = filter;
  }

  setEra(era) {
    this.era = era;
    if (!this.ctx || !this.droneFilter) return;
    const cutoff = [240, 420, 900, 620, 1300, 1700][era] || 800;
    this.droneFilter.frequency.cancelScheduledValues(this.ctx.currentTime);
    this.droneFilter.frequency.linearRampToValueAtTime(cutoff, this.ctx.currentTime + 1.2);
  }

  tone({ freq = 440, end = freq, dur = 0.15, type = 'sine', vol = 0.15, delay = 0, attack = 0.005, bus = null }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.14, filterType = 'highpass', freq = 600, delay = 0, q = 1 }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shoot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastShot < 0.035) return;
    this.lastShot = now;
    const octave = [180, 240, 320, 280, 420, 520][this.era] || 240;
    this.tone({ freq: octave * 1.6, end: octave * 0.52, dur: 0.075, type: 'square', vol: 0.045 });
    this.tone({ freq: octave * 2.4, end: octave * 1.1, dur: 0.045, type: 'triangle', vol: 0.03 });
  }

  hit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHit < 0.03) return;
    this.lastHit = now;
    this.noise({ dur: 0.055, vol: 0.035, filterType: 'bandpass', freq: 2200, q: 1.8 });
  }

  kill() {
    this.noise({ dur: 0.18, vol: 0.11, filterType: 'lowpass', freq: 1300 });
    this.tone({ freq: 160 + this.era * 40, end: 70, dur: 0.22, type: 'sawtooth', vol: 0.055 });
    if (this.era >= 3) this.tone({ freq: 900 + this.era * 130, end: 1700, dur: 0.12, type: 'sine', vol: 0.028, delay: 0.02 });
  }

  hurt() {
    this.tone({ freq: 120, end: 45, dur: 0.32, type: 'sawtooth', vol: 0.17 });
    this.noise({ dur: 0.22, vol: 0.13, filterType: 'lowpass', freq: 420 });
  }

  gate() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, end: f * 1.01, dur: 0.28, type: 'triangle', vol: 0.065, delay: i * 0.055 }));
    this.tone({ freq: 160, end: 520, dur: 0.5, type: 'sine', vol: 0.05 });
  }

  evolve() {
    this.tone({ freq: 70, end: 900, dur: 1.1, type: 'sawtooth', vol: 0.12 });
    this.tone({ freq: 220, end: 1760, dur: 1.2, type: 'sine', vol: 0.08, delay: 0.08 });
    this.tone({ freq: 440, end: 3520, dur: 1.1, type: 'triangle', vol: 0.04, delay: 0.18 });
    this.noise({ dur: 1.1, vol: 0.1, filterType: 'bandpass', freq: 900, q: 0.7 });
    setTimeout(() => {
      [523, 784, 1046, 1568, 2093].forEach((f, i) => this.tone({ freq: f, end: f, dur: 0.55, type: 'sine', vol: 0.055, delay: i * 0.04 }));
    }, 500);
  }

  boss() {
    this.tone({ freq: 55, end: 38, dur: 1.8, type: 'sawtooth', vol: 0.16 });
    this.tone({ freq: 82, end: 41, dur: 1.5, type: 'square', vol: 0.06 });
    this.noise({ dur: 1.4, vol: 0.16, filterType: 'lowpass', freq: 260 });
  }

  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, end: f * 1.005, dur: 0.8, type: 'triangle', vol: 0.08, delay: i * 0.13 }));
    this.tone({ freq: 130, end: 523, dur: 1.4, type: 'sine', vol: 0.07 });
  }

  lose() {
    [392, 349, 294, 220].forEach((f, i) => this.tone({ freq: f, end: f * 0.97, dur: 0.6, type: 'sawtooth', vol: 0.06, delay: i * 0.15 }));
  }

  click() {
    this.tone({ freq: 820, end: 1180, dur: 0.045, type: 'square', vol: 0.025 });
  }

  pickup() {
    this.tone({ freq: 1100, end: 1760, dur: 0.08, type: 'sine', vol: 0.04 });
  }
}
