import Phaser from 'phaser';
import Bullet from './Bullet';

const BULLET_COOLDOWN = 1;
const BULLET_VELOCITY = 1500;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(0.25);
    this.setCollideWorldBounds(true);

    this.speed = 300;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.spacebar = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.createAnimations();
    this.lastBullet = null;
    this.bullets = scene.physics.add.group({
        runChildUpdate: true
    });
    this.play('player-forward');
  }

  createAnimations() {
    for (const direction of ['forward', 'left', 'right']) {
      const key = `player-${direction}`;

      if (this.anims.animationManager.exists(key)) continue;

      this.anims.create({
        key,
        frames: this.anims.generateFrameNames('player', {
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
    const { left, right, up, down } = this.cursors;

    const move = new Phaser.Math.Vector2(
      right.isDown - left.isDown,
      down.isDown - up.isDown
    ).normalize().scale(this.speed);

    this.setVelocity(move.x, move.y);

    if (move.x < 0) {
      this.bankLeft();
    } else if (move.x > 0) {
      this.bankRight();
    } else {
      this.flyStraight();
    }

    if (this.spacebar.isDown && time - this.lastBullet >= BULLET_COOLDOWN) {
      this.fireMainWeapon();
      this.lastBullet = time;
    }
  }

  bankLeft() {
    this.play('player-left', true);
  }

  bankRight() {
    this.play('player-right', true);
  }

  flyStraight() {
    this.play('player-forward', true);
  }

  fireMainWeapon() {
    const bullet1 = new Bullet(this.scene, {
      origin: { x: this.x, y: this.y - 32 },
      parent: this,
      followParent: true
    });
    this.bullets.add(bullet1);
    bullet1.setVelocity(0, -BULLET_VELOCITY);
  }
}
