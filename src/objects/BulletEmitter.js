import Phaser from 'phaser';
import { resolveValue } from './utils/bulletEmitterUtils';
import { bulletEmitters } from './definitions/bulletEmitters';

/**
 * Emitter parameters may be a plain value or a function:
 *   waveInterval(waveIndex)                                   ms since the previous wave
 *   projectilesPerWave(waveIndex)
 *   velocity(waveIndex, bulletIndex, projectileCount)
 *   startAngle(waveIndex, bulletIndex, projectileCount)       radians, added to the even burst spacing
 *   angularVelocity(waveIndex, bulletIndex, projectileCount)
 *   spinVelocity(waveIndex, bulletIndex, projectileCount)     rad/s each bullet spins about its own center
 *   outwardVelocity(age, velocity, waveIndex, bulletIndex)    evaluated continuously; overrides velocity
 *   texture(waveIndex, bulletIndex, projectileCount)          texture key
 *   color(age, waveIndex, bulletIndex, projectileCount)       evaluated continuously; tint as 0xRRGGBB, '#RRGGBB' or {r, g, b}
 *   size(age, waveIndex, bulletIndex, projectileCount)        evaluated continuously; display height in px
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

    getWaveSchedule() {
        const schedule = [{ waveIndex: 0, delay: 0 }];

        // Each interval is the gap since the previous wave, so delays accumulate.
        let delay = 0;
        for (let i = 1; i < this.waveCount; i++) {
            delay += Math.max(0, Number(resolveValue(this.waveInterval, i)) || 0);
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
