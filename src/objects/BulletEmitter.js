import Phaser from 'phaser';
import { resolveValue } from './utils/bulletEmitterUtils';
import { bulletEmitters } from './definitions/bulletEmitters';

/**
 * Emitter parameters may be a plain value or a function. Every function gets `s` last: the
 * emitter clock in seconds (timeSource.now / 1000). With a song clock as the timeSource
 * (see utils/audioWaveform.js), s is the song's elapsed playtime, so waveform(s) links any
 * parameter to the music while the others stay plain math.
 *
 * Evaluated once, when the wave or bullet spawns (s = spawn time):
 *   waveInterval(waveIndex, s)                                    ms since the previous wave (s = previous wave)
 *   projectilesPerWave(waveIndex, s)
 *   startAngle(waveIndex, bulletIndex, projectileCount, s)        radians, added to the even burst spacing
 *   texture(waveIndex, bulletIndex, projectileCount, s)           texture key
 *
 * Re-evaluated every frame while the bullet flies (s = now). Rates are integrated over the
 * bullet's life, so changes speed bullets up or turn them rather than teleporting them:
 *   velocity(waveIndex, bulletIndex, projectileCount, s)          px/s
 *   angularVelocity(waveIndex, bulletIndex, projectileCount, s)   rad/s around the origin
 *   spinVelocity(waveIndex, bulletIndex, projectileCount, s)      rad/s each bullet spins about its own center
 *   outwardVelocity(age, velocity, waveIndex, bulletIndex, s, projectileCount)   overrides velocity
 *   color(age, waveIndex, bulletIndex, projectileCount, s)        tint as 0xRRGGBB, '#RRGGBB' or {r, g, b}
 *   size(age, waveIndex, bulletIndex, projectileCount, s)         display height in px
 * `age` is the bullet's age in seconds. Since these are re-evaluated, keep them deterministic
 * (no Math.random()).
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
        startAngle = 0,
        waveCount = 1,
        waveInterval = 250,
        projectilesPerWave,
        pattern,
        followParent = false,
        texture = 'bullet',
        color,
        size = 32,
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
        this.startAngle = startAngle;
        this.waveCount = waveCount;
        this.waveInterval = waveInterval;
        this.projectilesPerWave = projectilesPerWave;
        this.followParent = followParent;
        this.texture = texture;
        this.color = color;
        this.size = size;
        // Anything with a `now` property in ms; bullets measure their age against it.
        this.timeSource = timeSource;
    }

    /** startTime: emitter clock (ms) of the volley's first wave. */
    getWaveSchedule(startTime = this.timeSource.now) {
        const schedule = [{ waveIndex: 0, delay: 0 }];

        // Each interval is the gap since the previous wave, so delays accumulate.
        let delay = 0;
        for (let i = 1; i < this.waveCount; i++) {
            delay += Math.max(0, Number(resolveValue(this.waveInterval, i, (startTime + delay) / 1000)) || 0);
            schedule.push({ waveIndex: i, delay });
        }
        return schedule;
    }

    activate() {
        for (const { waveIndex, delay } of this.getWaveSchedule()) {
            if (delay === 0) {
                this.emitWave(waveIndex);
            } else {
                this.scene.time.delayedCall(delay, () => this.emitWave(waveIndex));
            }
        }
    }

    emitWave(waveIndex = 0, spawnTime = this.timeSource.now) {
        bulletEmitters[this.pattern] && bulletEmitters[this.pattern](this, { waveIndex, spawnTime });
    }

    update(time) {

    }
}
