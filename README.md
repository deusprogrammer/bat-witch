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
- `http://localhost:5173/level-editor.html` for the level editor (also available from the title screen)

`npm run build` writes a production build to `dist/`, and `npm run preview` serves it.

### Level Editor

The level editor displays a width-fitted background in a scrollable 540 x 941 Phaser viewport,
initially at the bottom, just like gameplay. It defaults to `assets/background.png` and
15 px/sec. Load a different image using the right-side control (replacing it clears encounters
after confirmation). Wheel-scroll over the canvas or use the position slider.
The readout shows timestamps for both viewport edges, measured upward from the image bottom.

Click the image to create a full-width, 20 px-tall encounter outline. Drag its middle to move it
vertically, or drag its top/bottom edge to resize it. The list supports labels, deletion,
selection (which reveals the rectangle), and **Edit Encounter** to open its node editor.
**Back to Level Editor** preserves edits. Changing the positive scroll rate keeps rectangles
in place and recalculates their times.

**Download Level JSON** saves `{ scrollRate, background, encounters }` in `level.json`.
`background` is a path (the default) or an uploaded filename, not embedded image data.
Each encounter contains `{ number, label, startTime, endTime, nodes }`: its bottom edge
defines `startTime`, its top defines `endTime`, in seconds at the chosen width-scaled px/sec.
The image bottom is time zero. Image files must be kept alongside the exported data separately.

### Encounter Editor

The React controls and Phaser canvas let you place nodes in the game's 540 x 941 play area.
Click empty canvas space to add a numbered, 20 px-diameter circle and an editable label
(`node1`, `node2`, etc.) in the list on the right. Coordinates use the top-left as `(0, 0)`,
regardless of the canvas's displayed size. Click a circle to highlight and reveal its list entry.
Each entry has a Delete button; surviving nodes keep their original numbers.
**Download JSON** saves `nodes.json`, an array of `{ number, label, x, y }` objects.
Level and encounter edits exist only for the current page visit; download the level to keep them.
These tools do not yet implement enemy movement or level playback/import.
Use **Return to Title Screen** from the level editor to leave.

### Main game controls and combat

Click **Start Game** on the title screen (or press Enter) to begin. Click **Playground** to
open the pattern playground; its **Return to Title Screen** button is above the preview.
Move with the arrow keys. Each Space press fires a
volley of five nine-shot cones, 10 ms apart; hold it for 200 ms to start the focused stream,
which stops on release.
The cone and focused stream use separate emitters; repeated taps fire repeated cones.
The focused stream fires every 1 ms, including between-frame shots with their original
spawn times so the beam stays dense regardless of frame rate.
The canvas uses the title image's 1672 x 941 dimensions and fits the browser without cropping.
Gameplay, collision bounds, and the HUD occupy a horizontally centered 540 x 941 viewport,
using the full canvas height with a white border.
The background starts at the bottom of the image and scrolls toward the top at 15 px/s,
then stops without looping. Starting a new fight resets it.
Movement slows from 300 to 220 px/s while
shooting. The bright cyan circle with a black outline shows the actual 5 px-radius hitbox,
offset 4 px right of the animation-frame center to better match the artwork.
Enemy contact and all hostile bullets, including bullets
from attached emitters, can hit it.

You have three lives, shown as small player icons at the bottom. A hit makes the player spin and
disappear, then respawn with two seconds of invulnerability (shown by blinking). Losing all
three lives ends the game. The enemy has a 28 x 44 px rectangular hitbox centered 8 px above
the animation-frame center and 1000 health; she briefly flashes white when hit.
each player bullet deals 1 damage and is consumed on impact. Its health bar is at the top.
Losing the last life shows the game-over image. Press Enter to return to the title screen,
then Enter again to play. The game-over image fits the canvas without cropping.
Defeating the enemy shows the victory image, fitted without cropping.
Press Enter on the victory screen to return to the title screen.

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
| `linear`      | One bullet along `direction`, straight down by default |
| `cone`        | Bullets distributed evenly across `coneAngle`, centered on `direction` |

A cone uses `projectilesPerWave` bullets across `coneAngle` (default 0.4 radians), including both
edges. Neighbor spacing is `coneAngle / (projectilesPerWave - 1)`, so increasing the count
makes the cone denser without widening it.
`direction` accepts radians or a non-zero `[x, y]` vector: 0 / `[1, 0]` points right,
`Math.PI / 2` / `[0, 1]` down, and `-Math.PI / 2` / `[0, -1]` up.
Vector magnitude does not affect speed. It may also be a function of the bullet's spawn context.
The default is right for cones/rings and down for `linear`, preserving existing linear shots.
For nine bullets centered upward across 0.4 radians:

```js
pattern: 'cone',
velocity: 1000,
projectilesPerWave: 9,
coneAngle: 0.4,
direction: [0, -1] // equivalently -Math.PI / 2
```

`coneAngle` may also be a function of `{ waveIndex, time }`, resolved once per wave.
One bullet fires along `direction`; a zero cone angle stacks all bullets along that direction.
Rings and cones share spread logic. At exactly `2 * Math.PI`, the spread divides by the bullet
count rather than count minus one, avoiding overlapping first/last bullets. A ring starts at
`direction`; a partial cone starts at `direction - coneAngle / 2`.
The emitter's `startAngle` option is replaced by `direction`; the internal Bullet behavior
still stores its resolved angle as `startAngle`. Older saved playground presets are translated
when loaded so their trajectories stay the same.

Set `followParent` on the emitter to choose how emitted bullets use its `origin`:

- `false` (default): `activate()` captures the origin's x/y once. Every wave in that volley fires
  from that same position, even if the source moves. Separate activations capture new positions.
  Calling `emitWave()` directly uses the position at that call unless an origin is supplied.
- `true`: bullets keep a live origin and move relative to it in both axes, preserving their
  outward and angular motion as the origin moves.

For an emitter attached to a bullet, use `origin: bullet`, not `origin: bullet.origin`.
The former fires from the bullet's current position; the latter refers to the bullet's own
movement center. Any object with x/y can serve as an origin.

This replaces the old x-only `followParent` override. Existing emitters using `true` (including
the player) now follow both axes without discarding horizontal motion.

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
| `direction`          | full context             | radians or non-zero `[x, y]`; cone center / ring's first bullet |
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
a value changes the bullet speeds up or turns smoothly instead of jumping. See
[How bullets move: integration](#how-bullets-move-integration) for how and why.

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

## How bullets move: integration

This section explains the math behind bullet movement: what "integrating a rate" means, why the
engine does it, and how `integrateOverAge` (in `utils/bulletUtils.js`) does it.

### The problem: speeds that change over time

A bullet's options give *rates*: `outwardVelocity` (px/s), `angularVelocity` (rad/s) and
`spinVelocity` (rad/s). What we actually need to draw the bullet is a *position*: how far out it
is, what angle it's at, and how far it has spun.

If a rate is a constant number, that's easy:

```
distance = speed × time        (100 px/s for 2 s = 200 px)
```

But a rate can be a function of `age` or of the song, so it changes while the bullet flies. Then
`speed × time` doesn't work anymore. For example, 100 px/s for 1 s and then 50 px/s for 2 s is
100 + 100 = **200 px**. Using the *current* speed for the whole life would give 50 × 3 = 150 px,
which is wrong. We need to add up how far the bullet moved during each moment, at the speed it had
in that moment.

### Slope and area

These two ideas from calculus are the whole trick:

- The **derivative** is the *slope* of a curve at a point. Velocity is the derivative of position:
  how fast the position is changing right now.
- The **integral** is the *area under* a curve. Position is the integral of velocity: the area
  under the velocity curve from spawn until now.

The units confirm it: the area of a rectangle on a speed-vs-time graph is
height × width = px/s × s = **px**.

The integral only gives the *change* since spawn, so the engine adds it to a starting value:

```
current position = start + area under the rate curve from age 0 to now
```

In `definitions/bulletBehaviors.js` that's exactly what `orbit` does:

```js
state.orbitAngle  = startAngle  + overAge(angularVelocity, state.angleIntegral);
state.orbitRadius = startRadius + overAge(outwardVelocity, state.radiusIntegral);
```

`overAge(rate)` is "the total change since spawn": pixels for `outwardVelocity` and radians for
`angularVelocity`. `Bullet.applySpin` does the same for `spinVelocity`. If the rate is a plain
number, `overAge` just returns `rate × age`, because the area under a flat line is a rectangle and
needs no slicing.

**Negative area.** When a rate goes below zero, its area counts as negative and the total
shrinks. That is how a boomerang works: `outwardVelocity` turns negative, the radius falls, and
the bullet comes back.

### Approximating the area with rectangles

A computer can't find the exact area under an arbitrary function (such as a song's loudness), so
it adds up thin rectangles instead:

- **Width:** a small slice of time, the *step*.
- **Height:** the rate during that slice.
- **Area:** height × width, which is how far the bullet moved during that slice.

Add up every rectangle from spawn to now and you have the integral. As the slices get narrower,
the sum gets closer to the exact area. In the limit where the width goes to 0, it *is* the exact
area; that limit is the definition of the integral (a "Riemann sum").

### Where in each slice to measure: the midpoint

How tall each rectangle should be depends on where in the slice you read the rate:

- **Left edge.** Use the rate at the start of the slice. This is the classic
  `position += speed * delta` you'd write in a per-frame `update`. When a bullet speeds up, every
  slice undercounts; when it slows down, every slice overcounts. The errors all lean the same way,
  so they pile up.
- **Midpoint.** Use the rate at the middle of the slice. On a rising curve the rectangle is too
  tall over half the slice and too short over the other half, so the errors mostly cancel.

The engine uses the midpoint. An example with `speed = 100 × age`, where the exact distance at
age 1 s is 50 px:

| Method       | Slice width | Result after 1 s |
|--------------|-------------|------------------|
| Left edge    | 1/60 s      | 49.17 px         |
| Left edge    | 1/30 s      | 48.33 px         |
| **Midpoint** | **1/30 s**  | **50.00 px**     |

For rates that change at a constant pace (straight lines), the midpoint rule is exact. For curvy
ones (sine waves, audio) it isn't, but halving the slice width cuts its error about 4×, against
only 2× for the left edge. At 1/30 s the error is a small fraction of a pixel.

> Note: the very first version of `Bullet` used `orbitAngle += orbitSpeed * (delta / 1000)` every
> frame. Its speeds never changed, though, so that was just "distance = speed × time" done in
> pieces, which is exact for a constant speed. Slicing only matters once rates vary over time.

### The fixed grid (a "fixed timestep")

The slices are **not** frames. They sit on a fixed grid measured from the bullet's spawn:

```
age:   0      1/30     2/30     3/30 ...
       |-------|--------|--------|
       [slice 1][slice 2][slice 3]
```

Frames arrive at uneven times (a 60 fps machine, a 30 fps machine, a hitch, or a jump when you
scrub the playground's timeline). If each frame were a slice, the slices would differ every time
and so would the answers. In the left-edge table above, 1/60 s and 1/30 s frames end up in
different places.

With a fixed grid, the engine divides time up itself instead of letting the frame timing decide.
A bullet at age 1.5 s sums exactly the same rectangles whether you watched it live, jumped straight
there, or exported a video frame by frame. The position depends **only on age**. That determinism
is what makes scrubbing and export possible, and it's why rate functions must not use
`Math.random()`.

The step is `INTEGRATION_STEP = 1/30` s. Narrower slices are more accurate but mean more function
calls, which makes seeking slower when a whole song's worth of history has to be rebuilt. Thanks to
the midpoint rule, 1/30 s is already accurate to well under a pixel. (The step was 1/240 s before
audio patterns, which can require seeking minutes into a song.)

### Caching: full slices plus one partial slice

The current age usually falls *inside* a slice, so `integrateOverAge` adds two parts:

1. **Every completed slice.** These are kept in the bullet's state as `{ steps, distance }`: how
   many slices are done and the sum of their areas. Each frame adds only the slices that finished
   since the last frame, so the work isn't repeated.
2. **One partial rectangle** from the last grid line up to the current age, also measured at its
   own midpoint. It's recomputed every frame and never saved, because it keeps growing until it
   becomes a full slice.

At age 0.11 s, for example, that's three cached slices (0 to 0.1 s) plus a thin partial one from
0.1 to 0.11 s:

```js
while ((integral.steps + 1) * step <= age) {             // add any newly completed slices
    integral.distance += midpointDistance(integral.steps * step, step);
    integral.steps++;
}
const committedAge = integral.steps * step;
return integral.distance + midpointDistance(committedAge, age - committedAge);  // + partial
```

Each integrated quantity has its own cache: `angleIntegral`, `radiusIntegral` and `spinIntegral`
in `Bullet.state`.

### Reading the song at the right moment

When a rate function is evaluated at a slice's midpoint, the context gives it the matching moment:
`age` is the midpoint and `time` is `spawn time + age`. So even when a slice's history is rebuilt
later (say, after a seek), an audio-driven rate reads the song's loudness *at that slice*, not the
loudness now. This is set up by `at(age)` in `createBulletContext`
(`utils/bulletEmitterUtils.js`).

### From polar to screen coordinates

The angle and radius are polar coordinates around the origin. `orbit` converts them to x/y with
basic trig:

```js
bullet.x = origin.x + cos(angle) × radius
bullet.y = origin.y + sin(angle) × radius
```

With `angularVelocity = 0` the angle never changes, so the bullet flies straight out. With both
rates non-zero it traces a spiral.

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
  Three preset-only examples attach emitters to bullets: **Seed fireworks** replaces a carrier
  with four rings after two seconds; **Satellite carriers** keeps small orbiting bullets centered
  on a moving carrier; **Spray carriers** fires a sweeping stream one second after spawning,
  with the emitted bullets following the moving carrier through `followParent: true`.
  Each child volley captures one position unless `followParent` is true.
  Child configuration is preserved when saving or copying a preset; there are no child-emitter
  controls yet. Selecting a regular preset removes the child effect.
- **Audio**: upload an MP3/WAV, or pick a music preset. The timeline then follows the song.
- **Timeline**: play, pause and loop. Scrubbing controls are temporarily hidden, and clicking
  the audio waveform no longer seeks. The underlying rebuild path remains for resets and export.
  Child bullets share the timeline clock, pause with playback, and are cleared on reset.
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
    Enemy.js, Player.js
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
