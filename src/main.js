import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import StartScene from './scenes/StartScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import VictoryScene from './scenes/VictoryScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1672,
  height: 941,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#0a0a1a',
  input: {
    gamepad: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [StartScene, GameScene, GameOverScene, VictoryScene],
};

export default new Phaser.Game(config);
