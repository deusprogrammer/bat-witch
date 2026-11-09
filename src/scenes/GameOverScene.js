import Phaser from 'phaser';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  preload() {
    this.load.image('game-over', 'assets/game-over.png');
  }

  create() {
    const { width, height } = this.scale;
    const background = this.add.image(width / 2, height / 2, 'game-over');
    background.setScale(Math.min(width / background.width, height / background.height));

    this.add.text(width / 2, height - 24, 'Press Enter to Continue', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5, 1);

    this.input.keyboard.once('keydown-ENTER', this.returnToTitle, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-ENTER', this.returnToTitle, this);
    });
  }

  returnToTitle() {
    this.scene.start('StartScene');
  }
}
