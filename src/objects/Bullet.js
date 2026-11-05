import Phaser from 'phaser';
import { integrateOverAge, toTint } from './utils/bulletUtils';
import { bulletBehaviors } from './definitions/bulletBehaviors';

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
    /**
     * color: a tint (0xRRGGBB, '#RRGGBB' or {r, g, b}), or color(age, bullet) evaluated every frame.
     * Leave it undefined to draw the texture untinted.
     * size: display height in px (width keeps the texture's aspect ratio), or size(age, bullet)
     * evaluated every frame. The hitbox scales with it.
     * behavior.spinVelocity: rad/s the sprite rotates about its own center (any behavior type),
     * or spinVelocity(age), integrated over the bullet's life.
     */
    constructor(scene, {
        origin,
        parent,
        followParent = false,
        timeSource = scene.time,
        spawnTime = timeSource.now,
        texture = 'bullet',
        color,
        size = 32,
        behavior
    }) {
        super(scene, origin.x, origin.y, texture);

        this.parent = parent;
        this.followParent = followParent;

        this.behavior = behavior;
        this.origin = origin;
        this.timeSource = timeSource;
        this.spawnTime = spawnTime;
        this.color = color;
        this.size = size;
        this.state = {
            velocityVector: behavior.velocityVector ?? {x: 0, y: 0},
            orbitAngle: behavior.startAngle ?? 0,
            orbitRadius: behavior.startRadius ?? 0,
            radiusIntegral: {steps: 0, distance: 0},
            angleIntegral: {steps: 0, distance: 0},
            spinIntegral: {steps: 0, distance: 0}
        }

        scene.add.existing(this);
        scene.physics.add.existing(this);
        if (behavior.spinVelocity) {
            // Arcade bodies are axis-aligned and can't rotate, so spinning bullets get a
            // centered circle hitbox, which covers the same area at every angle.
            const radius = Math.min(this.width, this.height) / 2;
            this.body.setCircle(radius, this.width / 2 - radius, this.height / 2 - radius);
        }
        const age = this.getAge();
        this.applySize(age);
        this.applySpin(age);
        this.applyColor(age);
    }

    applySize(age) {
        const size = typeof this.size === 'function' ? this.size(age, this) : this.size;
        // Scale uniformly so non-square textures keep their proportions; the body scales along with it.
        this.setScale(Math.max(0, Number(size) || 0) / this.height);
    }

    getAge() {
        return (this.timeSource.now - this.spawnTime) / 1000;
    }

    applySpin(age) {
        const {spinVelocity = 0, startRotation = 0} = this.behavior;
        if (typeof spinVelocity === 'function') {
            this.rotation = startRotation + integrateOverAge((a) => Number(spinVelocity(a)) || 0, age, this.state.spinIntegral);
        } else if (spinVelocity) {
            this.rotation = startRotation + spinVelocity * age;
        }
    }

    applyColor(age) {
        const color = typeof this.color === 'function' ? this.color(age, this) : this.color;
        if (color === undefined || color === null) {
            this.clearTint();
        } else {
            this.setTint(toTint(color));
        }
    }

    /**
     * Culls the bullet once it's far out of bounds, then moves it. Returns false if destroyed.
     * Doesn't touch size, color or spin, so it's cheap enough for fast-forwarding.
     */
    advance(age = this.getAge()) {
        const bounds = this.scene.physics.world.bounds;
        const horizontalMargin = bounds.width * 2;
        const verticalMargin = bounds.height * 2;
        if (
            this.x < bounds.left - horizontalMargin ||
            this.x > bounds.right + horizontalMargin ||
            this.y < bounds.top - verticalMargin ||
            this.y > bounds.bottom + verticalMargin
        ) {
            this.destroy();
            return false;
        }

        bulletBehaviors[this.behavior.type] && bulletBehaviors[this.behavior.type](age, this);

        if (this.followParent) {
            this.x = this.parent.x;
        }
        return true;
    }

    update() {
        const age = this.getAge();
        if (!this.advance(age)) {
            return;
        }
        this.applySpin(age);

        if (typeof this.size === 'function') {
            this.applySize(age);
        }

        if (typeof this.color === 'function') {
            this.applyColor(age);
        }
    }
}