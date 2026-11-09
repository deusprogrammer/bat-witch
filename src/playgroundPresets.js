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
  direction: 0,
  coneAngle: 0.4,
  projectilesPerWave: 90,
  waveInterval: 250,
  waveCount: 20,
  fireCooldown: 5000,
  originX: 270,
  originY: 50,
  childEmitter: undefined
};

// Quick-pick expressions for the Color and Size fields. They mirror the factories in
// objects/definitions/colorShifts.js and sizeShifts.js, which are what game code should use.
export const COLOR_SHIFT_PRESETS = [
  { name: 'Rainbow cycle', expression: 'hsv(age * 0.5)' },
  { name: 'Rainbow across ring', expression: 'hsv(age * 0.3 + bulletIndex / bulletCount)' },
  { name: 'Pulse pink ↔ blue', expression: 'mix(0xff66cc, 0x66ccff, 0.5 + 0.5 * Math.sin(age * 4))' },
  { name: 'Fade white → red', expression: 'mix(0xffffff, 0xff3333, age / 2)' },
  { name: 'Heat (white-hot → red)', expression: 'hsv(0.16 * (1 - clamp(age / 3)), clamp(age / 1.5), 1)' },
  { name: 'Strobe', expression: 'age % 0.5 < 0.1 ? 0xffffff : 0xff5555' },
  { name: 'Alternate per wave', expression: 'waveIndex % 2 ? 0x66ccff : 0xffcc33' },
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
  ].map(([name, flag]) => ({ group: 'Pride flags', name, expression: `palette(FLAGS.${flag}, age * 2)` }))
];

export const SIZE_SHIFT_PRESETS = [
  { name: 'Pulse', expression: '32 + 8 * Math.sin(age * 6)' },
  { name: 'Grow', expression: '8 + 40 * clamp(age / 2)' },
  { name: 'Shrink', expression: '48 - 36 * clamp(age / 3)' },
  { name: 'Pop in', expression: '32 * backOut(age / 0.35)' },
  { name: 'Ripple across ring', expression: '28 + 10 * Math.sin(age * 5 + bulletIndex * 0.8)' },
  { name: 'Big and small waves', expression: 'waveIndex % 2 ? 44 : 20' }
];

const DEMO_TRACK = 'assets/smooooch.mp3';

// A music-driven take on a visual preset: one long volley that runs for the whole song, with
// wave(time) (the song's loudness, 0–1) mixed into the original math.
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
      direction: 'waveIndex * 0.25',
      color: 'hsv(waveIndex / 50 + bulletIndex / 5)',
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
      angularVelocity: 'waveIndex % 2 ? 0.7 : -0.7',
      color: 'waveIndex % 2 ? 0x66ccff : 0xff66cc',
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
      velocity: '110 + 45 * Math.cos(bulletIndex * 10 * Math.PI / bulletCount)',
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
      outwardVelocity: 'velocity * (1 + 0.9 * Math.sin(age * 3))',
      direction: 'waveIndex * Math.PI / 48',
      projectilesPerWave: 48,
      waveInterval: 350,
      waveCount: 8,
      fireCooldown: 4000,
      originY: 200,
      texture: 'test-tube-bullet',
      spinVelocity: 'bulletIndex % 2 ? 6 : -6',
      color: 'hsv(0.25 + 0.15 * Math.sin(age * 3))'
    }
  },
  {
    name: 'Boomerang',
    settings: {
      velocity: 240,
      outwardVelocity: 'velocity * Math.cos(age * 0.9)',
      color: 'hsv(0.55 - Math.max(0, Math.cos(age * 0.9)) * 0.55)',
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
      angularVelocity: 'waveIndex % 2 ? 0.3 : -0.3',
      projectilesPerWave: 16,
      waveInterval: 600,
      waveCount: 6,
      fireCooldown: 4500,
      originY: 300,
      texture: 'heart-bullet',
      size: '28 + 10 * Math.sin(age * 5 + bulletIndex * 0.8)',
      color: 'mix(0xff3377, 0xffb3d1, 0.5 + 0.5 * Math.sin(age * 5 + bulletIndex * 0.8))'
    }
  },
  {
    name: 'Accelerating volley',
    settings: {
      pattern: 'burst',
      velocity: 160,
      direction: 'waveIndex * 0.12',
      projectilesPerWave: 24,
      waveInterval: 'Math.max(40, 420 - waveIndex * 30)',
      waveCount: 18,
      fireCooldown: 5000,
      originY: 120
    }
  },
  {
    name: 'Seed fireworks',
    settings: {
      pattern: 'linear',
      velocity: 100,
      waveCount: 1,
      fireCooldown: 3000,
      color: 'age % 0.5 < 0.25 ? 0xffffff : 0xff0000',
      childEmitter: {
        triggerAge: 2,
        destroyParent: true,
        pattern: 'burst',
        velocity: 100,
        waveCount: 4,
        waveInterval: 250,
        projectilesPerWave: 16,
        color: 0xffcc33,
        size: 20,
        followParent: false
      }
    }
  },
  {
    name: 'Satellite carriers',
    settings: {
      pattern: 'linear',
      velocity: 70,
      waveCount: 1,
      fireCooldown: 4500,
      color: '0xff69b4',
      size: 40,
      childEmitter: {
        triggerAge: 0,
        pattern: 'orbit_burst',
        velocity: 20,
        angularVelocity: 1.5,
        waveCount: 1,
        projectilesPerWave: 8,
        color: 0x14c8b4,
        size: 16,
        followParent: true
      }
    }
  },
  {
    name: 'Spray carriers',
    settings: {
      pattern: 'linear',
      velocity: 65,
      waveCount: 1,
      fireCooldown: 4500,
      color: '0xffffff',
      childEmitter: {
        triggerAge: 1,
        pattern: 'linear',
        velocity: 180,
        waveCount: 50,
        waveInterval: 45,
        projectilesPerWave: 1,
        color: 0x66ccff,
        size: 16,
        followParent: true,
        sweep: true
      }
    }
  },
  {
    name: 'Sweeping stream',
    settings: {
      pattern: 'linear',
      velocity: 320,
      direction: 'Math.PI / 2 + Math.sin(waveIndex * 0.25) * 0.9',
      waveInterval: 45,
      waveCount: 50,
      fireCooldown: 2500,
      originY: 60
    }
  },
  {
    // One long volley across the whole song; loud passages fire faster, denser, bigger rings.
    // Mixes the waveform (wave(time)) with plain math (alternating spin direction, steady hue drift).
    name: 'Smooooch (audio)',
    settings: {
      audio: DEMO_TRACK,
      pattern: 'orbit_burst',
      texture: 'heart-bullet',
      velocity: '40 + 260 * wave(time) ** 2',
      angularVelocity: '(waveIndex % 2 ? 1 : -1) * (0.1 + 0.8 * wave(time) ** 2)',
      direction: 'waveIndex * 0.37',
      projectilesPerWave: '8 + Math.round(28 * wave(time))',
      waveInterval: 'Math.max(90, 450 - 380 * wave(time))',
      waveCount: 1000,
      fireCooldown: 600000,
      originY: 300,
      size: '16 + 30 * wave(time) ** 2',
      color: 'hsv(0.85 + time * 0.03 + 0.2 * wave(time), 0.9 - 0.6 * wave(time) ** 3)'
    }
  },
  {
    // Showcase: nearly every field reacts to the song. Quiet = sparse, slow, dim six-petal
    // flowers; loud = dense counter-rotating rings that surge outward, bloom, swell, spin and
    // flash white. Coloring by waveIndex turns the stream of rings into rainbow spiral arms.
    name: 'HOLY SHIT',
    settings: {
      audio: DEMO_TRACK,
      pattern: 'orbit_burst',
      texture: 'heart-bullet',
      velocity: '50 + 300 * wave(time) ** 2',
      outwardVelocity: 'velocity * (1 + (0.15 + 0.45 * wave(time)) * Math.cos(bulletIndex * 12.566 * 3 / bulletCount))',
      angularVelocity: '(waveIndex % 2 ? 1 : -1) * (0.15 + 1.1 * wave(time) ** 2)',
      direction: 'waveIndex * 0.09',
      projectilesPerWave: '6 * (3 + Math.round(5 * wave(time) ** 1.5))',
      waveInterval: 'Math.max(80, 520 - 440 * wave(time))',
      spinVelocity: '(bulletIndex % 2 ? 1 : -1) * 9 * wave(time)',
      size: '14 + 30 * wave(time) ** 2 + 4 * Math.sin(age * 8 + bulletIndex)',
      color: 'hsv(waveIndex * 0.035 + 0.25 * wave(time), 1 - 0.8 * wave(time) ** 4, 0.55 + 0.45 * wave(time))',
      waveCount: 5000,
      fireCooldown: 600000,
      originY: 330
    }
  },
  // Spiral that spins and fires faster as the song gets louder; blue when quiet, red when loud.
  withMusic('Default spiral', {
    velocity: '60 + 200 * wave(time) ** 2',
    angularVelocity: '0.2 + 0.8 * wave(time)',
    projectilesPerWave: '24 + Math.round(40 * wave(time))',
    waveInterval: 'Math.max(120, 500 - 380 * wave(time))',
    color: 'hsv(0.6 - 0.6 * wave(time))'
  }),
  // Arms brighten, swell and stream faster on loud passages.
  withMusic('Galaxy arms', {
    velocity: '80 + 160 * wave(time)',
    angularVelocity: 0.35,
    direction: 'waveIndex * 0.25',
    color: 'hsv(waveIndex / 50 + bulletIndex / 5, 1, 0.4 + 0.6 * wave(time))',
    size: '20 + 20 * wave(time) ** 2',
    projectilesPerWave: 5,
    waveInterval: 'Math.max(50, 160 - 110 * wave(time))',
    originY: 300
  }),
  // Alternate rings counter-rotate harder with the beat.
  withMusic('Counter-rotating flower', {
    velocity: '60 + 140 * wave(time)',
    angularVelocity: '(waveIndex % 2 ? 1 : -1) * (0.3 + 0.9 * wave(time))',
    color: 'waveIndex % 2 ? 0x66ccff : 0xff66cc',
    projectilesPerWave: '16 + Math.round(24 * wave(time))',
    waveInterval: 'Math.max(150, 600 - 450 * wave(time))',
    originY: 260
  }),
  // The whole rose blooms outward together when the song swells, keeping its petal shape.
  withMusic('Five-petal rose', {
    velocity: '(110 + 45 * Math.cos(bulletIndex * 10 * Math.PI / bulletCount)) * (0.4 + 1.2 * wave(time))',
    angularVelocity: 0.4,
    projectilesPerWave: 120,
    waveInterval: 'Math.max(350, 1000 - 650 * wave(time))',
    originY: 260,
    texture: 'heart-bullet',
    size: '18 + 18 * wave(time)',
    color: 'mix(0xff6fa8, 0xffffff, wave(time) ** 2)'
  }),
  // Rings surge outward on loud hits and nearly stall in quiet moments; test tubes spin with the beat.
  withMusic('Pulsing rings', {
    pattern: 'burst',
    velocity: 80,
    outwardVelocity: 'velocity * (0.3 + 2 * wave(time) ** 2)',
    direction: 'waveIndex * Math.PI / 48',
    projectilesPerWave: 48,
    waveInterval: 'Math.max(200, 700 - 500 * wave(time))',
    originY: 200,
    texture: 'test-tube-bullet',
    spinVelocity: '(bulletIndex % 2 ? 1 : -1) * (2 + 10 * wave(time))',
    color: 'hsv(0.25 + 0.3 * wave(time))'
  }),
  // Boomerangs thrown harder when it's loud; a slight outward drift lets old ones leave the screen.
  withMusic('Boomerang', {
    velocity: '120 + 240 * wave(time)',
    outwardVelocity: 'velocity * (Math.cos(age * 0.9) + 0.3)',
    color: 'hsv(0.55 - Math.max(0, Math.cos(age * 0.9)) * 0.55, 1, 0.4 + 0.6 * wave(time))',
    angularVelocity: 0.8,
    projectilesPerWave: '24 + Math.round(24 * wave(time))',
    waveInterval: 'Math.max(250, 800 - 500 * wave(time))',
    originY: 300
  }),
  // Hearts breathe with the song: bigger and paler when loud, with a ripple across each ring.
  withMusic('Breathing hearts', {
    velocity: '50 + 120 * wave(time)',
    angularVelocity: '(waveIndex % 2 ? 1 : -1) * (0.2 + 0.5 * wave(time))',
    projectilesPerWave: 16,
    waveInterval: 'Math.max(250, 800 - 550 * wave(time))',
    originY: 300,
    texture: 'heart-bullet',
    size: '24 + 20 * wave(time) + 6 * Math.sin(age * 5 + bulletIndex * 0.8)',
    color: 'mix(0xff3377, 0xffb3d1, wave(time))'
  }),
  // Volleys tighten into a barrage on loud passages and loosen when it's quiet.
  withMusic('Accelerating volley', {
    pattern: 'burst',
    velocity: '100 + 260 * wave(time) ** 2',
    direction: 'waveIndex * 0.12',
    projectilesPerWave: 24,
    waveInterval: 'Math.max(40, 400 - 360 * wave(time))',
    color: 'mix(0x66ccff, 0xffffff, wave(time))',
    originY: 120
  }),
  // The stream sweeps wider and faster as the song gets louder.
  withMusic('Sweeping stream', {
    pattern: 'linear',
    velocity: '200 + 300 * wave(time)',
    direction: 'Math.PI / 2 + Math.sin(time * 1.5) * (0.3 + 0.8 * wave(time))',
    waveInterval: 'Math.max(30, 140 - 110 * wave(time))',
    color: 'hsv(time * 0.1)',
    originY: 60
  })
];
