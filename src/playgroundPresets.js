export const DEFAULT_SETTINGS = {
  pattern: 'orbit_burst',
  texture: 'bullet',
  autoFire: true,
  velocity: 100,
  outwardVelocity: undefined,
  color: undefined,
  size: 32,
  angularVelocity: 0.5,
  spinVelocity: 0,
  startAngle: 0,
  projectilesPerWave: 90,
  waveInterval: 250,
  waveCount: 20,
  fireCooldown: 5000,
  originX: 270,
  originY: 50
};

// Quick-pick expressions for the Color and Size fields. They mirror the factories in
// objects/definitions/colorShifts.js and sizeShifts.js, which are what game code should use.
export const COLOR_SHIFT_PRESETS = [
  { name: 'Rainbow cycle', expression: 'hsv(t * 0.5)' },
  { name: 'Rainbow across ring', expression: 'hsv(t * 0.3 + j / n)' },
  { name: 'Pulse pink ↔ blue', expression: 'mix(0xff66cc, 0x66ccff, 0.5 + 0.5 * Math.sin(t * 4))' },
  { name: 'Fade white → red', expression: 'mix(0xffffff, 0xff3333, t / 2)' },
  { name: 'Heat (white-hot → red)', expression: 'hsv(0.16 * (1 - clamp(t / 3)), clamp(t / 1.5), 1)' },
  { name: 'Strobe', expression: 't % 0.5 < 0.1 ? 0xffffff : 0xff5555' },
  { name: 'Alternate per wave', expression: 'i % 2 ? 0x66ccff : 0xffcc33' },
  ...[
    ['TRANS RIGHTS', 'trans'],
    ['Rainbow pride', 'rainbow'],
    ['Progress pride', 'progress'],
    ['Lesbian', 'lesbian'],
    ['Gay (MLM)', 'gay'],
    ['Bisexual', 'bisexual'],
    ['Pansexual', 'pansexual'],
    ['Polysexual', 'polysexual'],
    ['Asexual', 'asexual'],
    ['Demisexual', 'demisexual'],
    ['Aromantic', 'aromantic'],
    ['Intersex', 'intersex'],
    ['Nonbinary', 'nonbinary'],
    ['Genderfluid', 'genderfluid'],
    ['Genderqueer', 'genderqueer'],
    ['Agender', 'agender']
  ].map(([name, flag]) => ({ group: 'Pride flags', name, expression: `palette(FLAGS.${flag}, t * 2)` }))
];

export const SIZE_SHIFT_PRESETS = [
  { name: 'Pulse', expression: '32 + 8 * Math.sin(t * 6)' },
  { name: 'Grow', expression: '8 + 40 * clamp(t / 2)' },
  { name: 'Shrink', expression: '48 - 36 * clamp(t / 3)' },
  { name: 'Pop in', expression: '32 * backOut(t / 0.35)' },
  { name: 'Ripple across ring', expression: '28 + 10 * Math.sin(t * 5 + j * 0.8)' },
  { name: 'Big and small waves', expression: 'i % 2 ? 44 : 20' }
];

// Each preset is merged over DEFAULT_SETTINGS. Expressions use the same variables as the form fields.
export const BUILT_IN_PRESETS = [
  {
    name: 'Default spiral',
    settings: {}
  },
  {
    name: 'Galaxy arms',
    settings: {
      velocity: 110,
      angularVelocity: 0.35,
      startAngle: 'i * 0.25',
      color: 'hsv(i / 50 + j / 5)',
      projectilesPerWave: 5,
      waveInterval: 70,
      waveCount: 50,
      fireCooldown: 3500,
      originY: 300
    }
  },
  {
    name: 'Counter-rotating flower',
    settings: {
      velocity: 90,
      angularVelocity: 'i % 2 ? 0.7 : -0.7',
      color: 'i % 2 ? 0x66ccff : 0xff66cc',
      projectilesPerWave: 36,
      waveInterval: 220,
      waveCount: 12,
      fireCooldown: 4000,
      originY: 260
    }
  },
  {
    name: 'Five-petal rose',
    settings: {
      velocity: '110 + 45 * Math.cos(j * 10 * Math.PI / n)',
      angularVelocity: 0.4,
      projectilesPerWave: 120,
      waveInterval: 450,
      waveCount: 6,
      fireCooldown: 4500,
      originY: 260,
      texture: 'heart-bullet',
      color: '0xff6fa8'
    }
  },
  {
    name: 'Pulsing rings',
    settings: {
      pattern: 'burst',
      velocity: 80,
      outwardVelocity: 'v * (1 + 0.9 * Math.sin(t * 3))',
      startAngle: 'i * Math.PI / 48',
      projectilesPerWave: 48,
      waveInterval: 350,
      waveCount: 8,
      fireCooldown: 4000,
      originY: 200,
      texture: 'test-tube-bullet',
      spinVelocity: 'j % 2 ? 6 : -6',
      color: 'hsv(0.25 + 0.15 * Math.sin(t * 3))'
    }
  },
  {
    name: 'Boomerang',
    settings: {
      velocity: 240,
      outwardVelocity: 'v * Math.cos(t * 0.9)',
      color: 'hsv(0.55 - Math.max(0, Math.cos(t * 0.9)) * 0.55)',
      angularVelocity: 0.8,
      projectilesPerWave: 40,
      waveInterval: 300,
      waveCount: 4,
      fireCooldown: 5000,
      originY: 300
    }
  },
  {
    name: 'Breathing hearts',
    settings: {
      velocity: 70,
      angularVelocity: 'i % 2 ? 0.3 : -0.3',
      projectilesPerWave: 16,
      waveInterval: 600,
      waveCount: 6,
      fireCooldown: 4500,
      originY: 300,
      texture: 'heart-bullet',
      size: '28 + 10 * Math.sin(t * 5 + j * 0.8)',
      color: 'mix(0xff3377, 0xffb3d1, 0.5 + 0.5 * Math.sin(t * 5 + j * 0.8))'
    }
  },
  {
    name: 'Accelerating volley',
    settings: {
      pattern: 'burst',
      velocity: 160,
      startAngle: 'i * 0.12',
      projectilesPerWave: 24,
      waveInterval: 'Math.max(40, 420 - i * 30)',
      waveCount: 18,
      fireCooldown: 5000,
      originY: 120
    }
  },
  {
    name: 'Sweeping stream',
    settings: {
      pattern: 'linear',
      velocity: 320,
      startAngle: 'Math.sin(i * 0.25) * 0.9',
      waveInterval: 45,
      waveCount: 50,
      fireCooldown: 2500,
      originY: 60
    }
  }
];
