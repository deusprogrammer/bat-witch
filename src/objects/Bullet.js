import Phaser from 'phaser';

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, {
        origin,
        parent,
        followParent = false,
        orbitSpeed = 0,
        orbitRadius = 0,
        orbitAngle = 0
    }) {
        super(scene, origin.x, origin.y, 'bullet');

        this.parent = parent;
        this.followParent = followParent;

        this.orbitSpeed = orbitSpeed;
        this.orbitRadius = orbitRadius;
        this.orbitAngle = orbitAngle;

        // Capture the original orbit center
        this.orbitOrigin = {
            x: origin.x,
            y: origin.y
        };

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDisplaySize(32, 32);

        if (this.orbitSpeed !== 0) {
            // Position immediately at the requested orbit angle
            this.setPosition(
                this.orbitOrigin.x + Math.cos(this.orbitAngle) * this.orbitRadius,
                this.orbitOrigin.y + Math.sin(this.orbitAngle) * this.orbitRadius
            );
        }
    }

    update(time, delta) {
        const bounds = this.scene.physics.world.bounds;

        if (
            this.x < bounds.left - 16 ||
            this.x > bounds.right + 16 ||
            this.y < bounds.top - 16 ||
            this.y > bounds.bottom + 16
        ) {
            this.destroy();
            return;
        }

        if (this.orbitSpeed !== 0) {
            this.orbitAngle += this.orbitSpeed * (delta / 1000);
            this.orbitRadius += this.radialSpeed * (delta / 1000);

            this.setPosition(
                this.orbitOrigin.x + Math.cos(this.orbitAngle) * this.orbitRadius,
                this.orbitOrigin.y + Math.sin(this.orbitAngle) * this.orbitRadius
            );
        } else if (this.followParent) {
            this.x = this.parent.x;
        }
    }
}