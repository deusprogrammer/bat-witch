import Phaser from 'phaser';
import BulletEmitter from './BulletEmitter';

const BULLET_COOLDOWN = 250;
const BURST_VELOCITY = 100;

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(0.25);
    this.setCollideWorldBounds(true);

    this.createAnimations();
    this.play('enemy-forward');

    this.lastBullet = null;

    this.bulletEmitter = new BulletEmitter(scene, {
      origin: this,
      velocity: BURST_VELOCITY,
      projectilesPerWave: 90
    });
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
    if (time - this.lastBullet >= BULLET_COOLDOWN) {
      this.bulletEmitter.activate();
      this.lastBullet = time;
    }
  }
}
