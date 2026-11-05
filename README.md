# Untitled Bullet Hell Game

A bullet-hell shooter built with [Phaser 4](https://phaser.io/) and [Vite](https://vite.dev/), plus a
**pattern playground** for designing bullet patterns live, including patterns driven by a song's waveform.

The engine underneath is small: an emitter fires waves of bullets, and each bullet moves in polar
coordinates around its origin. Almost every parameter can be a plain number or a function, and the
patterns come from the math in those functions.

## Getting started

```powershell
npm install
npm run dev        # on Windows PowerShell you may need npm.cmd
```

Then open:

- `http://localhost:5173/` for the game
- `http://localhost:5173/playground.html` for the pattern playground

`npm run build` writes a production build to `dist/`, and `npm run preview` serves it.

## The bullet engine

### BulletEmitter

```js
import BulletEmitter from './objects/BulletEmitter';

const emitter = new BulletEmitter(scene, {
  origin: enemy,                 // anything with x/y; bullets move relative to it
  pattern: 'orbit_burst',        // 'orbit_burst' | 'burst' | 'linear'
  velocity: 120,                 // px/s outward
  angularVelocity: 0.5,          // rad/s around the origin (orbit_burst only)
  projectilesPerWave: 36,
  waveCount: 20,                 // waves per volley
  waveInterval: ({ waveIndex }) => 200 + Math.sin(waveIndex * 0.8) * 150
});

emitter.activate();              // fire one volley
```

A **volley** (`activate()`) is `waveCount` waves, fired `waveInterval` ms apart. Each **wave** fires
`projectilesPerWave` bullets in the shape given by `pattern`:

| Pattern       | Shape                                                             |
|---------------|-------------------------------------------------------------------|
| `orbit_burst` | A ring of bullets that also circles the origin (`angularVelocity`) |
| `burst`       | A ring of bullets flying straight out                             |
| `linear`      | One bullet, straight down by default (steer it with `startAngle`)  |

### Parameters: values or functions

Most options take either a value or a function. A function receives one **context object**;
destructure the fields you need:

```js
velocity: ({ waveIndex, bulletIndex, bulletCount }) => 110 + 45 * Math.cos(bulletIndex * 10 * Math.PI / bulletCount)
```

| Field         | Meaning |
|---------------|---------|
| `waveIndex`   | Which wave of the volley fired the bullet (0, 1, 2, …) |
| `bulletIndex` | The bullet's position in its wave (0 to `bulletCount - 1`) |
| `bulletCount` | How many bullets the wave fired. `bulletIndex / bulletCount` is how far around the ring the bullet is (0 to just under 1), whatever the count, so shapes stay the same when the count changes |
| `time`        | Emitter clock in seconds. With a song as the clock, this is the song position |
| `age`         | Seconds since the bullet spawned |
| `velocity`    | The resolved `velocity` (only inside `outwardVelocity`) |

**Decided once**, when the wave or bullet spawns (`age` is 0):

| Option               | Gets                     | Result |
|----------------------|--------------------------|--------|
| `waveInterval`       | `{ waveIndex, time }`    | ms since the previous wave (`time` = the previous wave's time) |
| `projectilesPerWave` | `{ waveIndex, time }`    | bullets in the wave |
| `startAngle`         | full context             | radians added to the even spacing around the ring |
| `texture`            | full context             | texture key (see `definitions/bulletTextures.js`) |

**Re-evaluated every frame** while the bullet flies (`time` and `age` keep moving):

| Option            | Result |
|-------------------|--------|
| `velocity`        | px/s outward from the origin |
| `outwardVelocity` | optional; replaces `velocity` and can read it, e.g. `({ velocity, age }) => velocity * Math.cos(age)` |
| `angularVelocity` | rad/s around the origin (`orbit_burst` only) |
| `spinVelocity`    | rad/s each bullet spins about its own center (the hitbox becomes a circle) |
| `color`           | tint as `0xRRGGBB`, `'#RRGGBB'` or `{ r, g, b }` |
| `size`            | display height in px (the hitbox scales with it) |

Rates (velocities) are **integrated** over the bullet's life rather than applied instantly, so when
a value changes the bullet speeds up or turns smoothly instead of jumping.

Two rules for functions:

1. **Keep them deterministic.** No `Math.random()`. A bullet's position depends only on its age,
   which is what lets the playground scrub the timeline backwards and forwards.
2. **Don't keep the context object.** It's reused between calls (allocating one per call would be
   too slow with thousands of bullets), so read from it and let it go.

### Ready-made color and size functions

```js
import { colorShifts } from './objects/definitions/colorShifts';
import { sizeShifts } from './objects/definitions/sizeShifts';

color: colorShifts.rainbow({ speed: 0.3, spread: 1 }),
color: colorShifts.flag({ flag: 'trans' }),        // pride flag palettes, see flagPalettes.js
size: sizeShifts.popIn({ size: 32 }),
```

Colors: `rainbow`, `pulse`, `fade`, `heat`, `strobe`, `palette`, `flag`.
Sizes: `pulse`, `grow`, `popIn`, `ripple`.
Helpers in `utils/bulletUtils.js`: `hsv`, `rgb`, `mix`, `palette`, `clamp`, `backOut`.

## Driving patterns from audio

`utils/audioWaveform.js` turns an audio file into a single reusable function:

```js
import { loadWaveform, soundClock } from './objects/utils/audioWaveform';

const { waveform } = await loadWaveform('assets/song.mp3');
waveform(time);   // loudness at `time` seconds into the track: 0 (silent) to 1 (loudest)
```

It's the track's smoothed loudness envelope (fast attack, slower release, normalized so the
loudest moments reach 1), not the raw signal, so it reads cleanly at 60 fps.

To link bullets to the music, give the emitter the song as its clock. `time` then *is* the song
position, and any option can mix the waveform with ordinary math:

```js
new BulletEmitter(scene, {
  origin: boss,
  pattern: 'orbit_burst',
  timeSource: soundClock(music),                                   // music = scene.sound.add('song')
  velocity: ({ time }) => 60 + 200 * waveform(time) ** 2,         // faster on loud passages
  angularVelocity: ({ waveIndex }) => waveIndex % 2 ? 0.7 : -0.7, // plain math
  projectilesPerWave: ({ time }) => 16 + Math.round(24 * waveform(time))
});
```

In game code you can also build the waveform from Phaser's cache:
`createWaveform(scene.cache.audio.get('song'))` (WebAudio mode).

## The pattern playground

`playground.html` puts every emitter option on screen, with live preview.

- **Fields** take a number or a JavaScript expression. Expressions can use the context field names
  above or their short aliases:

  | Alias | Field         |
  |-------|---------------|
  | `i`   | `waveIndex`   |
  | `j`   | `bulletIndex` |
  | `n`   | `bulletCount` |
  | `s`   | `time`        |
  | `t`   | `age`         |
  | `v`   | `velocity`    |

  They can also use `Math`, `hsv`, `rgb`, `mix`, `palette`, `FLAGS`, `clamp`, `backOut`, and
  `wave(time)` (the loaded track's loudness). The color and size fields have snippet menus.
- **Presets**: built-in visual presets, music versions of them, and showcase presets ("Smooooch",
  "HOLY SHIT"). Your own presets save to `localStorage`; **Copy JSON** exports the settings.
- **Audio**: upload an MP3/WAV, or pick a music preset. The timeline then follows the song.
- **Timeline**: play, pause, loop and scrub. Scrubbing rebuilds the scene by fast-forwarding,
  which is why the functions have to be deterministic.
- **Export**: render a timeline range to **MP4** (with the music track if one is loaded) or **GIF**.
  Audio export needs a browser with WebCodecs AAC or Opus *encoding and decoding* (Chrome and Edge
  work). Where that isn't available, for example VS Code's built-in browser, the video exports
  silently with a warning.

## Project layout

```
index.html, playground.html     entry pages
assets/                         sprites, atlases and the demo track
src/
  main.js                       game bootstrap
  scenes/
    GameScene.js                the game
    PlaygroundScene.js          the playground's preview scene (timeline, scrubbing)
  objects/
    Bullet.js                   one projectile: movement, spin, size, color
    BulletEmitter.js            fires waves of bullets; documents every option
    Enemy.js, Player.js, EnemyBullet.js
    definitions/
      bulletEmitters.js         patterns: orbit_burst, burst, linear
      bulletBehaviors.js        movement: orbit (polar motion around the origin)
      bulletTextures.js         bullet textures (bullet, heart, test tube, …)
      colorShifts.js            ready-made color functions
      sizeShifts.js             ready-made size functions
      flagPalettes.js           pride flag colors
    utils/
      bulletEmitterUtils.js     spawning: builds each bullet's context and behavior
      bulletUtils.js            integration and color/easing helpers
      audioWaveform.js          decode audio, waveform(time), soundClock
  playground.js                 playground UI and expression compiler
  playgroundPresets.js          built-in presets and snippets
  playgroundAudio.js            playground music player
  playgroundExport.js           MP4/GIF export
```
