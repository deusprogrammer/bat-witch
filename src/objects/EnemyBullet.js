import Phaser from 'phaser';

export default class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemyBullet');
  }

  /**
   * Fires this bullet from (x, y) at the given angle (radians) and speed.
   * Designed to be used from a pooled physics group:
   *   const bullet = this.enemyBullets.get(x, y);
   *   if (bullet) bullet.fire(x, y, angle, speed);
   */
  fire(x, y, angle, speed) {
    this.enableBody(true, x, y, true, true);
    this.scene.physics.velocityFromRotation(angle, speed, this.body.velocity);
  }

  update(time, delta) {
    // Recycle bullets that leave the screen.
    const { width, height } = this.scene.scale;
    if (this.x < -32 || this.x > width + 32 || this.y < -32 || this.y > height + 32) {
      this.disableBody(true, true);
    }
  }
}
