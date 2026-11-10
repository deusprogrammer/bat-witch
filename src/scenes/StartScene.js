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

    const buttons = [
      { label: 'Start Game', action: () => this.startGame() },
      { label: 'Playground', action: () => window.location.assign('playground.html') },
      { label: 'Level Editor', action: () => window.location.assign('level-editor.html') }
    ];
    buttons.forEach(({ label, action }, index) => {
      const button = this.add.text(this.scale.width * 0.75, this.scale.height * 0.75 + index * 74,
        label, {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#23305f',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        fixedWidth: 340,
        padding: { x: 16, y: 12 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      button.on('pointerover', () => button.setBackgroundColor('#30407a'));
      button.on('pointerout', () => button.setBackgroundColor('#23305f'));
      button.on('pointerup', action);
    });

    this.input.keyboard.once('keydown-ENTER', this.startGame, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-ENTER', this.startGame, this);
    });
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
