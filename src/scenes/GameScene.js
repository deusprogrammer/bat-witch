import Phaser from 'phaser';
import Player from '../objects/Player.js';
import Enemy from '../objects/Enemy.js';
import Bullet from '../objects/Bullet.js';
import { preloadBulletTextures } from '../objects/definitions/bulletTextures.js';

const BACKGROUND_SCROLL_SPEED = 15;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });

    this.player = null;
    this.enemies = null;
    this.playArea = { width: 540, height: 720 };
  }

  preload() {
    this.load.image('background', 'assets/background.png');
    this.load.atlas('player', 'assets/player-sprite.png', 'assets/player-atlas.json');
    this.load.atlas('enemy', 'assets/enemy-sprite.png', 'assets/enemy-atlas.json');
    preloadBulletTextures(this);
  }

  create() {
    this.playArea.height = this.scale.height;
    const { width, height } = this.playArea;
    this.cameras.main.setViewport((this.scale.width - width) / 2, (this.scale.height - height) / 2, width, height)
      .setScroll(0, 0).setBackgroundColor('#0a0a1a');
    this.physics.world.setBounds(0, 0, width, height);
    this.background = this.add.image(width / 2, 0, 'background').setOrigin(0.5, 0).setDepth(-10);
    this.background.setScale(Math.max(width / this.background.width, height / this.background.height));
    this.background.y = height - this.background.displayHeight;
    this.add.rectangle(width / 2, height / 2, width - 2, height - 2)
      .setStrokeStyle(2, 0xffffff).setDepth(50);
    this.physics.resume();
    this.lives = 3;
    this.ended = false;
    this.player = new Player(this, width / 2, height - 80);

    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    const enemy = new Enemy(this, width * 0.2, 90);
    this.enemy = enemy;
    enemy.maxHealth = 10000;
    enemy.health = enemy.maxHealth;
    enemy.body.setSize(28 / enemy.scaleX, 44 / enemy.scaleY);
    enemy.body.setOffset(
      (enemy.width - enemy.body.sourceWidth) / 2,
      (enemy.height - enemy.body.sourceHeight) / 2 - 8 / enemy.scaleY
    );
    this.enemyFlashUntil = 0;
    this.nextEnemyFlash = 0;
    this.enemies.add(enemy);
    enemy.movementTween = this.tweens.add({
      targets: enemy,
      x: width * 0.8,
      duration: 6000,
      ease: 'Sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    this.lifeIcons = Array.from({ length: this.lives }, (_, i) =>
      this.add.image(20 + i * 25, height - 22, 'player', 'forward_00')
        .setScale(0.1).setDepth(30)
    );
    this.healthBar = this.add.graphics().setDepth(30);
    this.healthLabel = this.add.text(width / 2, 19, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffffff'
    }).setOrigin(0.5).setDepth(31);
    this.updateHealthBar();

    // Bullet movement writes sprite positions directly, after Arcade's normal collision pass.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.checkHits, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.checkHits, this);
    });
  }

  update(time, delta) {
    if (this.ended) return;
    this.background.y = Math.min(0, this.background.y + BACKGROUND_SCROLL_SPEED * delta / 1000);
    this.player.update(time, delta);
  }

  checkHits() {
    if (this.ended) return;
    const bullets = this.children.list.filter(child => child instanceof Bullet && child.active);
    for (const bullet of bullets) bullet.body.updateFromGameObject();
    const isPlayerBullet = bullet => this.player.bulletEmitters.some(emitter => emitter.bullets.contains(bullet));
    const friendly = bullets.filter(isPlayerBullet);
    const hostile = bullets.filter(bullet => !isPlayerBullet(bullet));
    this.enemy.body.updateFromGameObject();
    this.player.body.updateFromGameObject();
    this.player.hitboxMarker.setPosition(this.player.body.center.x, this.player.body.center.y);
    if (this.time.now >= this.enemyFlashUntil) this.enemy.clearTint();

    this.physics.overlap(this.enemy, friendly, (enemy, bullet) => {
      if (this.ended || !bullet.active) return;
      bullet.destroy();
      enemy.health = Math.max(0, enemy.health - 1);
      if (this.time.now >= this.nextEnemyFlash) {
        enemy.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        this.enemyFlashUntil = this.time.now + 60;
        this.nextEnemyFlash = this.time.now + 150;
      }
      this.updateHealthBar();
      if (enemy.health === 0) this.finishGame(true);
    });
    if (this.ended || this.player.isDying || this.time.now < this.player.invulnerableUntil) return;
    this.physics.overlap(this.player, hostile, this.onPlayerHit, null, this);
    this.physics.overlap(this.player, this.enemies, this.onPlayerHit, null, this);
  }

  updateHealthBar() {
    const width = this.playArea.width - 32;
    this.healthBar.clear().fillStyle(0x252535).fillRect(16, 8, width, 22)
      .fillStyle(0xff5577).fillRect(16, 8, width * this.enemy.health / this.enemy.maxHealth, 22);
    this.healthLabel.setText(`Enemy ${this.enemy.health} / ${this.enemy.maxHealth}`);
  }

  onPlayerHit(player, hazard) {
    if (this.ended || player.isDying || this.time.now < player.invulnerableUntil) return;
    player.isDying = true;
    player.stopShooting();
    player.setVelocity(0, 0);
    player.body.enable = false;
    player.hitboxMarker.setVisible(false);
    if (hazard instanceof Bullet) hazard.destroy();
    this.lives--;
    this.lifeIcons[this.lives].setVisible(false);
    this.tweens.add({
      targets: player,
      angle: player.angle + 720,
      duration: 600,
      onComplete: () => {
        player.setVisible(false);
        if (this.lives === 0) {
          this.finishGame(false);
        } else {
          this.time.delayedCall(500, () => this.respawnPlayer());
        }
      }
    });
  }

  respawnPlayer() {
    const player = this.player;
    player.setPosition(this.playArea.width / 2, this.playArea.height - 80).setAngle(0).setVisible(true);
    player.body.reset(player.x, player.y);
    player.body.enable = true;
    player.isDying = false;
    player.invulnerableUntil = this.time.now + 2000;
    player.hitboxMarker.setVisible(true);
    this.tweens.add({
      targets: player, alpha: 0.3, duration: 100, yoyo: true, repeat: 9,
      onComplete: () => player.setAlpha(1)
    });
  }

  finishGame(won) {
    if (this.ended) return;
    this.ended = true;
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.player.setVelocity(0, 0);
    this.player.stopShooting();
    this.player.hitboxMarker.setVisible(false);
    this.enemy.setActive(false);
    if (won) this.enemy.setVisible(false);
    for (const child of this.children.list) {
      if (child instanceof Bullet) {
        child.setActive(false);
        child.body.enable = false;
      }
    }
    this.physics.pause();
    this.scene.start(won ? 'VictoryScene' : 'GameOverScene');
  }
}
