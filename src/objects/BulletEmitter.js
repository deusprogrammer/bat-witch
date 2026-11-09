import Phaser from 'phaser';
import { resolveValue } from './utils/bulletEmitterUtils';
import { bulletEmitters } from './definitions/bulletEmitters';

/**
 * Fires bullets in waves. A volley (activate()) is `waveCount` waves, `waveInterval` ms apart;
 * each wave fires `projectilesPerWave` bullets in the shape given by `pattern`
 * (see definitions/bulletEmitters.js: 'orbit_burst', 'burst', 'linear' or 'cone').
 * origin: object with x/y from which bullets fire.
 * followParent: false (default) captures origin's x/y once per activation for all its waves.
 *   true keeps emitted bullets moving relative to the live origin in both axes.
 *
 * Almost every option can be a plain value or a function. Functions receive one context object;
 * destructure the fields you need:
 *   velocity: ({ waveIndex, time }) => 100 + 20 * waveIndex
 *
 * Context fields:
 *   waveIndex     which wave of the volley (0, 1, 2, ...)
 *   bulletIndex   the bullet's position in its wave (0 to bulletCount - 1)
 *   bulletCount   how many bullets the wave fired. bulletIndex / bulletCount is how far around
 *                 the ring the bullet is (0 to just under 1), whatever the count.
 *   time          emitter clock in seconds (timeSource.now / 1000). With a song clock as the
 *                 timeSource (see utils/audioWaveform.js) this is the song's elapsed playtime, so
 *                 waveform(time) links any option to the music.
 *   age           seconds since the bullet spawned
 *   velocity      the resolved `velocity` option (outwardVelocity only)
 *
 * Decided once, when the wave or bullet spawns (time = spawn time, age = 0):
 *   waveInterval({ waveIndex, time })        ms since the previous wave (time = the previous wave's time)
 *   projectilesPerWave({ waveIndex, time })  bullets in the wave
 *   direction(context)                       radians or non-zero [x, y]; cone center / ring's first bullet
 *   coneAngle({ waveIndex, time })            total cone spread in radians, centered on direction
 *   texture(context)                         texture key (see definitions/bulletTextures.js)
 *
 * Re-evaluated every frame while the bullet flies (time = now). Rates are integrated over the
 * bullet's life, so changes speed bullets up or turn them rather than teleporting them:
 *   velocity(context)           px/s outward from the origin
 *   outwardVelocity(context)    px/s; optional, replaces velocity (which it can read as `velocity`)
 *   angularVelocity(context)    rad/s around the origin ('orbit_burst' only)
 *   spinVelocity(context)       rad/s each bullet spins about its own center
 *   color(context)              tint as 0xRRGGBB, '#RRGGBB' or {r, g, b}
 *   size(context)               display height in px
 *
 * Because they're re-evaluated, keep functions deterministic (no Math.random()), and don't hold
 * on to the context object: it's reused between calls.
 *
 * Ready-made color and size functions live in definitions/colorShifts.js and definitions/sizeShifts.js.
 */
export default class BulletEmitter extends Phaser.GameObjects.GameObject {
    constructor(scene, {
        origin,
        velocity,
        outwardVelocity,
        angularVelocity = 0.5,
        spinVelocity = 0,
        direction,
        coneAngle = 0.4,
        waveCount = 1,
        waveInterval = 250,
        projectilesPerWave,
        pattern,
        followParent = false,
        texture = 'bullet',
        color,
        size = 32,
        onBulletSpawn = () => {},
        onBulletAdvance = () => {},
        onBulletDestroy = () => {},
        timeSource = scene.time
    }) {
        super(scene, origin.x, origin.y);

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.bullets = scene.physics.add.group({
            runChildUpdate: true
        });
        this.origin = origin;
        this.pattern = pattern;
        this.velocity = velocity;
        this.outwardVelocity = outwardVelocity;
        this.angularVelocity = angularVelocity;
        this.spinVelocity = spinVelocity;
        this.direction = direction ?? (pattern === 'linear' ? Math.PI / 2 : 0);
        this.coneAngle = coneAngle;
        this.waveCount = waveCount;
        this.waveInterval = waveInterval;
        this.projectilesPerWave = projectilesPerWave;
        this.followParent = followParent;
        this.texture = texture;
        this.color = color;
        this.size = size;
        this.onBulletSpawn = onBulletSpawn;
        this.onBulletAdvance = onBulletAdvance;
        this.onBulletDestroy = onBulletDestroy;
        // Anything with a `now` property in ms; bullets measure their age against it.
        this.timeSource = timeSource;
    }

    /**
     * Works out when each wave of a volley fires, as ms offsets from the first wave.
     * startTime: emitter clock (ms) of the volley's first wave.
     */
    getWaveSchedule(startTime = this.timeSource.now) {
        const schedule = [{ waveIndex: 0, delay: 0 }];

        // Each interval is the gap since the previous wave, so delays accumulate.
        let delay = 0;
        for (let waveIndex = 1; waveIndex < this.waveCount; waveIndex++) {
            const interval = resolveValue(this.waveInterval, { waveIndex, time: (startTime + delay) / 1000 });
            delay += Math.max(0, Number(interval) || 0);
            schedule.push({ waveIndex, delay });
        }
        return schedule;
    }

    /** Fires one volley: the first wave now, the rest on the scene clock per getWaveSchedule(). */
    activate() {
        const origin = this.followParent ? this.origin : {x: this.origin.x, y: this.origin.y};
        for (const { waveIndex, delay } of this.getWaveSchedule()) {
            if (delay === 0) {
                this.emitWave(waveIndex, this.timeSource.now, origin);
            } else {
                this.scene.time.delayedCall(delay, () => this.emitWave(waveIndex, this.timeSource.now, origin));
            }
        }
    }

    /** Fires a single wave. spawnTime: emitter clock (ms); origin can be a volley's captured position. */
    emitWave(waveIndex = 0, spawnTime = this.timeSource.now, origin = this.origin) {
        bulletEmitters[this.pattern] && bulletEmitters[this.pattern](this, { waveIndex, spawnTime, origin });
    }

    update(time) {

    }
}
