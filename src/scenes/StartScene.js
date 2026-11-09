import Phaser from 'phaser';

export default class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
  }

  preload() {
    this.load.image('title-screen', 'assets/title-screen.png');
  }

  create() {
    this.add.image(this.scale.width / 2, this.scale.height / 2, 'title-screen');

    this.add.text(this.scale.width * 0.75, this.scale.height * 0.75,
      'Press Enter to Play', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center'
      }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', this.startGame, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-ENTER', this.startGame, this);
    });
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
