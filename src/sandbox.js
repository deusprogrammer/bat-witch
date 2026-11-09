import Phaser from 'phaser';
import SandboxScene from './scenes/SandboxScene.js';

export default new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: '100%',
  height: '100%',
  scale: { mode: Phaser.Scale.RESIZE },
  backgroundColor: '#0a0a1a',
  scene: [SandboxScene],
});
