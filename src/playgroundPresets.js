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

const DEMO_TRACK = 'assets/smooooch.mp3';

// A music-driven take on a visual preset: one long volley that runs for the whole song, with
// wave(s) (the song's loudness, 0–1) mixed into the original math.
const withMusic = (name, settings) => ({
  name: `${name} (music)`,
  settings: { audio: DEMO_TRACK, waveCount: 5000, fireCooldown: 600000, ...settings }
});

// Each preset is merged over DEFAULT_SETTINGS. Expressions use the same variables as the form fields.
// Presets with an audio track are listed under "With music" in the playground.
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
  },
  {
    // One long volley across the whole song; loud passages fire faster, denser, bigger rings.
    // Mixes the waveform (wave(s)) with plain math (alternating spin direction, steady hue drift).
    name: 'Smooooch (audio)',
    settings: {
      audio: DEMO_TRACK,
      pattern: 'orbit_burst',
      texture: 'heart-bullet',
      velocity: '40 + 260 * wave(s) ** 2',
      angularVelocity: '(i % 2 ? 1 : -1) * (0.1 + 0.8 * wave(s) ** 2)',
      startAngle: 'i * 0.37',
      projectilesPerWave: '8 + Math.round(28 * wave(s))',
      waveInterval: 'Math.max(90, 450 - 380 * wave(s))',
      waveCount: 1000,
      fireCooldown: 600000,
      originY: 300,
      size: '16 + 30 * wave(s) ** 2',
      color: 'hsv(0.85 + s * 0.03 + 0.2 * wave(s), 0.9 - 0.6 * wave(s) ** 3)'
    }
  },
  // Spiral that spins and fires faster as the song gets louder; blue when quiet, red when loud.
  withMusic('Default spiral', {
    velocity: '60 + 200 * wave(s) ** 2',
    angularVelocity: '0.2 + 0.8 * wave(s)',
    projectilesPerWave: '24 + Math.round(40 * wave(s))',
    waveInterval: 'Math.max(120, 500 - 380 * wave(s))',
    color: 'hsv(0.6 - 0.6 * wave(s))'
  }),
  // Arms brighten, swell and stream faster on loud passages.
  withMusic('Galaxy arms', {
    velocity: '80 + 160 * wave(s)',
    angularVelocity: 0.35,
    startAngle: 'i * 0.25',
    color: 'hsv(i / 50 + j / 5, 1, 0.4 + 0.6 * wave(s))',
    size: '20 + 20 * wave(s) ** 2',
    projectilesPerWave: 5,
    waveInterval: 'Math.max(50, 160 - 110 * wave(s))',
    originY: 300
  }),
  // Alternate rings counter-rotate harder with the beat.
  withMusic('Counter-rotating flower', {
    velocity: '60 + 140 * wave(s)',
    angularVelocity: '(i % 2 ? 1 : -1) * (0.3 + 0.9 * wave(s))',
    color: 'i % 2 ? 0x66ccff : 0xff66cc',
    projectilesPerWave: '16 + Math.round(24 * wave(s))',
    waveInterval: 'Math.max(150, 600 - 450 * wave(s))',
    originY: 260
  }),
  // The whole rose blooms outward together when the song swells, keeping its petal shape.
  withMusic('Five-petal rose', {
    velocity: '(110 + 45 * Math.cos(j * 10 * Math.PI / n)) * (0.4 + 1.2 * wave(s))',
    angularVelocity: 0.4,
    projectilesPerWave: 120,
    waveInterval: 'Math.max(350, 1000 - 650 * wave(s))',
    originY: 260,
    texture: 'heart-bullet',
    size: '18 + 18 * wave(s)',
    color: 'mix(0xff6fa8, 0xffffff, wave(s) ** 2)'
  }),
  // Rings surge outward on loud hits and nearly stall in quiet moments; test tubes spin with the beat.
  withMusic('Pulsing rings', {
    pattern: 'burst',
    velocity: 80,
    outwardVelocity: 'v * (0.3 + 2 * wave(s) ** 2)',
    startAngle: 'i * Math.PI / 48',
    projectilesPerWave: 48,
    waveInterval: 'Math.max(200, 700 - 500 * wave(s))',
    originY: 200,
    texture: 'test-tube-bullet',
    spinVelocity: '(j % 2 ? 1 : -1) * (2 + 10 * wave(s))',
    color: 'hsv(0.25 + 0.3 * wave(s))'
  }),
  // Boomerangs thrown harder when it's loud; a slight outward drift lets old ones leave the screen.
  withMusic('Boomerang', {
    velocity: '120 + 240 * wave(s)',
    outwardVelocity: 'v * (Math.cos(t * 0.9) + 0.3)',
    color: 'hsv(0.55 - Math.max(0, Math.cos(t * 0.9)) * 0.55, 1, 0.4 + 0.6 * wave(s))',
    angularVelocity: 0.8,
    projectilesPerWave: '24 + Math.round(24 * wave(s))',
    waveInterval: 'Math.max(250, 800 - 500 * wave(s))',
    originY: 300
  }),
  // Hearts breathe with the song: bigger and paler when loud, with a ripple across each ring.
  withMusic('Breathing hearts', {
    velocity: '50 + 120 * wave(s)',
    angularVelocity: '(i % 2 ? 1 : -1) * (0.2 + 0.5 * wave(s))',
    projectilesPerWave: 16,
    waveInterval: 'Math.max(250, 800 - 550 * wave(s))',
    originY: 300,
    texture: 'heart-bullet',
    size: '24 + 20 * wave(s) + 6 * Math.sin(t * 5 + j * 0.8)',
    color: 'mix(0xff3377, 0xffb3d1, wave(s))'
  }),
  // Volleys tighten into a barrage on loud passages and loosen when it's quiet.
  withMusic('Accelerating volley', {
    pattern: 'burst',
    velocity: '100 + 260 * wave(s) ** 2',
    startAngle: 'i * 0.12',
    projectilesPerWave: 24,
    waveInterval: 'Math.max(40, 400 - 360 * wave(s))',
    color: 'mix(0x66ccff, 0xffffff, wave(s))',
    originY: 120
  }),
  // The stream sweeps wider and faster as the song gets louder.
  withMusic('Sweeping stream', {
    pattern: 'linear',
    velocity: '200 + 300 * wave(s)',
    startAngle: 'Math.sin(s * 1.5) * (0.3 + 0.8 * wave(s))',
    waveInterval: 'Math.max(30, 140 - 110 * wave(s))',
    color: 'hsv(s * 0.1)',
    originY: 60
  })
];
