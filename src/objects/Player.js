import Phaser from 'phaser';
import BulletEmitter from './BulletEmitter';

const BULLET_COOLDOWN = 1;
const BULLET_VELOCITY = 1500;
const FOCUS_HOLD_DELAY = 200;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(0.25);
    this.setCollideWorldBounds(true);

    this.speed = 300;
    this.shootingSpeed = 220;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.spacebar = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.createAnimations();
    this.lastBullet = null;
    this.shotPressedAt = null;
    this.coneEmitter = new BulletEmitter(scene, {
      origin: this,
      velocity: BULLET_VELOCITY,
      pattern: 'cone',
      projectilesPerWave: 9,
      waveCount: 5,
      waveInterval: 10,
      coneAngle: 0.4,
      direction: [0, -1],
      followParent: false
    });
    this.focusedEmitter = new BulletEmitter(scene, {
      origin: this,
      velocity: -BULLET_VELOCITY,
      pattern: 'linear',
      followParent: true
    });
    this.bulletEmitters = [this.coneEmitter, this.focusedEmitter];
    this.spacebar.on('down', this.beginShooting, this);
    this.spacebar.on('up', this.stopShooting, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.spacebar.off('down', this.beginShooting, this);
      this.spacebar.off('up', this.stopShooting, this);
    });
    this.play('player-forward');
    this.hitboxRadius = 5;
    const radius = this.hitboxRadius / this.scaleX;
    this.body.setCircle(radius, this.width / 2 - radius + 4 / this.scaleX, this.height / 2 - radius);
    this.body.updateFromGameObject();
    this.hitboxMarker = scene.add.circle(this.body.center.x, this.body.center.y, this.hitboxRadius, 0x00ffff, 0.9)
      .setStrokeStyle(2, 0x000000, 1).setDepth(20);
    this.isDying = false;
    this.invulnerableUntil = 0;
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
    if (this.isDying || !this.active) return;
    const { left, right, up, down } = this.cursors;

    const move = new Phaser.Math.Vector2(
      right.isDown - left.isDown,
      down.isDown - up.isDown
    ).normalize().scale(this.spacebar.isDown ? this.shootingSpeed : this.speed);

    this.setVelocity(move.x, move.y);

    if (move.x < 0) {
      this.bankLeft();
    } else if (move.x > 0) {
      this.bankRight();
    } else {
      this.flyStraight();
    }

    if (this.spacebar.isDown && this.shotPressedAt !== null
      && time - this.shotPressedAt >= FOCUS_HOLD_DELAY) {
      if (this.lastBullet === null) {
        this.lastBullet = this.shotPressedAt + FOCUS_HOLD_DELAY - BULLET_COOLDOWN;
      }
      while (time - this.lastBullet >= BULLET_COOLDOWN) {
        this.lastBullet += BULLET_COOLDOWN;
        this.fireMainWeapon(this.lastBullet);
      }
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

  fireMainWeapon(spawnTime = this.scene.time.now) {
    // Backdate between-frame shots so they spread along the beam instead of stacking.
    this.focusedEmitter.emitWave(0, spawnTime);
  }

  beginShooting() {
    if (this.isDying || !this.active || this.scene.ended || this.shotPressedAt !== null) return;
    this.shotPressedAt = this.scene.time.now;
    this.lastBullet = null;
    this.coneEmitter.activate();
  }

  stopShooting() {
    this.shotPressedAt = null;
    this.lastBullet = null;
  }
}
