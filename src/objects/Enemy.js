import Phaser from 'phaser';
import BulletEmitter from './BulletEmitter';
import { colorShifts } from './definitions/colorShifts';

const WAVE_COOLDOWN = 2000;
const SHOT_VELOCITY = 100;
const EMITTER_CYCLE_INTERVAL = 5000;

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemy');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setScale(0.25);
        this.setCollideWorldBounds(true);

        this.createAnimations();
        this.play('enemy-forward');

        this.lastWave = null;
        this.movementTween = null;
        this.previousX = x;

        this.bulletEmitter = new BulletEmitter(scene, {
            origin: this,
            velocity: SHOT_VELOCITY,
            waveCount: 1,
            projectilesPerWave: 1,
            pattern: 'linear',
            color: colorShifts.strobe({
                base: 0xff0000,
                flash: 0xffffff,
                interval: 0.5,
                flashDuration: 0.25
            }),
            onBulletSpawn: (bullet) => {
                bullet.attachEmitter('bullet-emitter-1', new BulletEmitter(scene, {
                    followParent: false,
                    origin: bullet,
                    pattern: 'orbit_burst',
                    velocity: 100,
                    waveCount: 4,
                    waveInterval: 250,
                    projectilesPerWave: 16
                }));
            },
            onBulletAdvance: (bullet) => {
                if (bullet.state.orbitRadius >= 250) {
                    bullet.trigger('bullet-emit-1', ({emitters}) => {
                        console.log("ACTIVATE");
                        emitters['bullet-emitter-1'].activate();
                        bullet.destroy();
                    });
                }
            },
            onBulletDestroy: (bullet) => {
                // TODO play a noise or something
            }
        });
        this.bulletEmitters = [
            this.bulletEmitter,
            new BulletEmitter(scene, {
                origin: this,
                pattern: 'burst',
                velocity: SHOT_VELOCITY,
                waveCount: 4,
                waveInterval: 250,
                projectilesPerWave: 16,
                color: 0x14c8b4
            }),
            new BulletEmitter(scene, {
                origin: this,
                pattern: 'orbit_burst',
                velocity: SHOT_VELOCITY,
                angularVelocity: 0.5,
                waveCount: 4,
                waveInterval: 250,
                projectilesPerWave: 16,
                color: 0xff69b4
            }),
            new BulletEmitter(scene, {
                origin: this,
                pattern: 'linear',
                velocity: 320,
                waveCount: 50,
                waveInterval: 45,
                projectilesPerWave: 1,
                direction: ({ waveIndex }) => Math.PI / 2 + Math.sin(waveIndex * 0.25) * 0.9,
                color: 0xffcc33
            })
        ];
        this.emitterCycleStart = scene.time.now;
    }

    createAnimations() {
        for (const direction of ['forward', 'left', 'right']) {
            const key = `enemy-${direction}`;

            if (this.anims.animationManager.exists(key)) continue;

            this.anims.create({
                key,
                frames: this.anims.generateFrameNames('enemy', {
                    prefix: `${direction}_`,
                    start: 0,
                    end: 7,
                    zeroPad: 2
                }),
                frameRate: 10,
                repeat: -1
            });
        }
    }

    update(time) {
        const emitterIndex = Math.floor((time - this.emitterCycleStart) / EMITTER_CYCLE_INTERVAL)
            % this.bulletEmitters.length;
        this.bulletEmitter = this.bulletEmitters[emitterIndex];
        if (this.movementTween) {
            if (emitterIndex === 3) {
                this.movementTween.pause();
            } else {
                this.movementTween.resume();
            }
        }
        const horizontalMovement = this.x - this.previousX;
        const direction = emitterIndex === 3 || Math.abs(horizontalMovement) < 0.01
            ? 'forward'
            : horizontalMovement < 0 ? 'left' : 'right';
        this.play(`enemy-${direction}`, true);
        this.previousX = this.x;
        if (time - this.lastWave >= WAVE_COOLDOWN) {
            this.bulletEmitter.activate();
            this.lastWave = time;
        }
    }
}
