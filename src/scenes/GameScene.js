import Phaser from 'phaser';
import Player from '../objects/Player.js';
import Enemy from '../objects/Enemy.js';
import { preloadBulletTextures } from '../objects/definitions/bulletTextures.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });

    this.player = null;
    this.enemies = null;
  }

  preload() {
    this.load.atlas('player', 'assets/player-sprite.png', 'assets/player-atlas.json');
    this.load.atlas('enemy', 'assets/enemy-sprite.png', 'assets/enemy-atlas.json');
    preloadBulletTextures(this);
  }

  create() {
    this.player = new Player(this, this.scale.width / 2, this.scale.height - 80);

    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    this.enemies.add(new Enemy(this, this.scale.width / 2, 50));

    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, null, this);
  }

  update(time, delta) {
    this.player.update(time, delta);
  }

  onPlayerHit(player, hazard) {
    // TODO: handle player death / lives.
  }
}
