import Phaser from 'phaser';
import Bullet from './Bullet';

const PROJECTILES_PER_WAVE = 90;

const velocityToVector = (angle, velocity) => {
    let y = Math.sin(angle) * velocity;
    let x = Math.cos(angle) * velocity;
    return { x, y };
}

const calculateBurstSpacing = (projectilesPerWave) => {
    return (2 * Math.PI) / projectilesPerWave;
}

export default class BulletEmitter extends Phaser.GameObjects.GameObject {
    constructor(scene, { origin, velocity, projectilesPerWave, pattern = 'burst' }) {
        super(scene, origin.x, origin.y);

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.bullets = scene.physics.add.group({
            runChildUpdate: true
        });
        this.origin = origin;
        this.pattern = pattern;
        this.velocity = velocity;
        this.projectilesPerWave = projectilesPerWave;
    }

    activate() {
        if (this.pattern === 'burst') {
            this.burst();
        }
    }

    burst() {
        for (let i = 0; i < this.projectilesPerWave; i++) {
            const bullet = new Bullet(this.scene, {
                origin: this.origin,
                parent: this,
                followParent: false
            });
            this.bullets.add(bullet);
            const vector = velocityToVector(i * calculateBurstSpacing(this.projectilesPerWave), this.velocity);
            bullet.setVelocity(vector.x, vector.y);
        }
    }

    update(time) {

    }
}
