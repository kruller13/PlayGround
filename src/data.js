export const ERAS = [
  {
    id: 0,
    roman: 'I',
    name: 'STICKMAN',
    kicker: 'PRIMITIVE SIGNAL',
    description: 'Líneas sobre papel. Un disparo. Un instinto.',
    detail: 'El mundo aún no aprendió a tener volumen. Tú tampoco. Avanza, dispara y rompe el primer sello.',
    accent: '#cf432d',
    accent2: '#171512',
    threshold: 0,
    boss: 'EL TRAZADOR',
    sky: { top: '#e8ddc7', bottom: '#fffaed', horizon: '#e8c8a2', fog: '#f5edde', density: 0.009, sun: '#e9b96e' },
    space: false
  },
  {
    id: 1,
    roman: 'II',
    name: 'GEOMETRIC WORLD',
    kicker: 'FORM IGNITION',
    description: 'La línea se convierte en forma. El color despierta.',
    detail: 'Polígonos, planos y sombras duras. La realidad aprende a construirse con piezas simples.',
    accent: '#ff4b28',
    accent2: '#0b69ff',
    threshold: 8,
    boss: 'EL POLIEDRO',
    sky: { top: '#bcdde5', bottom: '#f8e6c9', horizon: '#f2b183', fog: '#e9eadc', density: 0.007, sun: '#ff6b3d' },
    space: false
  },
  {
    id: 2,
    roman: 'III',
    name: 'NEON ARCADE',
    kicker: 'SIGNAL BLOOM',
    description: 'La luz se vuelve materia. La materia se vuelve velocidad.',
    detail: 'Rejillas infinitas, energía magenta y proyectiles que dibujan el aire. Bienvenido a la frecuencia.',
    accent: '#ff2d95',
    accent2: '#00f0ff',
    threshold: 20,
    boss: 'EL CIRCUITO',
    sky: { top: '#05021a', bottom: '#2c0b48', horizon: '#ff2a87', fog: '#0d0626', density: 0.014, sun: '#ff3c8e' },
    space: true
  },
  {
    id: 3,
    roman: 'IV',
    name: 'CYBER FRONT',
    kicker: 'IRON AWAKENING',
    description: 'La guerra aprende arquitectura. La noche se llena de acero.',
    detail: 'Una metrópolis hostil, lluvia de neón y blindaje táctico. La evolución ya tiene dientes.',
    accent: '#ff8a1f',
    accent2: '#3ed7ff',
    threshold: 36,
    boss: 'EL COLOSO',
    sky: { top: '#020a13', bottom: '#143341', horizon: '#ff7a1f', fog: '#06131d', density: 0.018, sun: '#ff9a43' },
    space: true
  },
  {
    id: 4,
    roman: 'V',
    name: 'CELESTIAL ARMOR',
    kicker: 'GOLDEN ASCENT',
    description: 'El acero se vuelve reliquia. La guerra se vuelve ceremonia.',
    detail: 'Armadura sagrada, polvo de oro y ruinas suspendidas. El universo empieza a mirarte.',
    accent: '#e3bc6a',
    accent2: '#6af4e3',
    threshold: 55,
    boss: 'EL SERAFÍN',
    sky: { top: '#315f68', bottom: '#e3c692', horizon: '#ffcf86', fog: '#a3b1a4', density: 0.014, sun: '#ffe1a0' },
    space: false
  },
  {
    id: 5,
    roman: 'VI',
    name: 'ASCENDED',
    kicker: 'FINAL FORM',
    description: 'Ya no eres un soldado. Eres el horizonte.',
    detail: 'La forma definitiva. Materia oscura, oro vivo y un arma que contiene una galaxia.',
    accent: '#ffcc66',
    accent2: '#67f7ff',
    threshold: 78,
    boss: 'EL GATEKEEPER',
    sky: { top: '#02030b', bottom: '#100723', horizon: '#ffcc66', fog: '#040611', density: 0.012, sun: '#ffd98a' },
    space: true
  }
];

export const GATE_DEFS = [
  { id: 'damage', title: 'OVERCHARGE', short: 'DAÑO', desc: '+28% daño de arma', icon: '✦', color: '#ff5a3d' },
  { id: 'rate', title: 'RAPID CORE', short: 'CADENCIA', desc: '+22% cadencia de disparo', icon: '≫', color: '#ffd75e' },
  { id: 'multi', title: 'TRIAD', short: 'MULTI', desc: '+1 proyectil por ráfaga', icon: '⋔', color: '#55e7ff' },
  { id: 'shield', title: 'AEGIS', short: 'ESCUDO', desc: '+30 escudo y repara 20', icon: '◈', color: '#68a7ff' },
  { id: 'heal', title: 'VITAL CORE', short: 'VIDA', desc: 'Repara 40 de integridad', icon: '✚', color: '#79ffa8' },
  { id: 'crit', title: 'PRECISION', short: 'CRÍTICO', desc: '+12% probabilidad crítica', icon: '◎', color: '#ff8de1' },
  { id: 'drone', title: 'ECHO DRONE', short: 'DRON', desc: 'Un dron aliado te escolta', icon: '◉', color: '#a78bff' },
  { id: 'magnet', title: 'HARVEST', short: 'IMÁN', desc: '+60% radio de recogida', icon: '⌁', color: '#73ffcf' },
  { id: 'power', title: 'EVO SPIKE', short: 'EVO', desc: '+14% energía de evolución', icon: '△', color: '#ff73c7' }
];

export const UPGRADES = [
  { id: 'damage', icon: '✦', name: 'SECUENCIA LETAL', desc: '+7% daño permanente', baseCost: 70, max: 8 },
  { id: 'rate', icon: '≫', name: 'SOBRECARGA', desc: '+4% cadencia permanente', baseCost: 90, max: 8 },
  { id: 'shield', icon: '◈', name: 'PIEL DE DATOS', desc: '+12 escudo inicial', baseCost: 80, max: 8 },
  { id: 'magnet', icon: '⌁', name: 'GRAVEDAD', desc: '+15% recogida de núcleos', baseCost: 55, max: 6 }
];

export const STORAGE_KEY = 'evo-gate-shooter-v1';

export function defaultSave() {
  return {
    bestScore: 0,
    cores: 0,
    runs: 0,
    kills: 0,
    wins: 0,
    seenEras: [0],
    upgrades: { damage: 0, rate: 0, shield: 0, magnet: 0 },
    audio: true,
    version: 1
  };
}

export function upgradeCost(def, level) {
  return Math.round(def.baseCost * (1 + level * 0.78));
}
