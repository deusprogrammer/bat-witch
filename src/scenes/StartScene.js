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

    this.controllerStatus = this.add.text(this.scale.width * 0.75, this.scale.height * 0.64, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#0a0a1a',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      fixedWidth: 540,
      padding: { x: 12, y: 8 }
    }).setOrigin(0.5);
    this.updateControllerStatus();

    const buttons = [
      { label: 'Start Game', action: () => this.startGame() },
      { label: 'Playground', action: () => window.location.assign('playground.html') },
      { label: 'Level Editor', action: () => window.location.assign('level-editor.html') }
    ];
    this.selectedMenuIndex = 0;
    this.menuButtons = buttons.map(({ label, action }, index) => {
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
      button.on('pointerover', () => {
        this.selectedMenuIndex = index;
        this.updateMenuSelection();
      });
      button.on('pointerout', () => this.updateMenuSelection());
      button.on('pointerup', action);
      return { button, action };
    });
    const connectedPad = this.input.gamepad?.getAll().find(pad => pad.connected);
    this.previousControllerInput = {
      up: connectedPad?.up ?? false,
      down: connectedPad?.down ?? false,
      confirm: connectedPad?.A ?? false
    };
    this.updateMenuSelection();

    this.input.keyboard.once('keydown-ENTER', this.startGame, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-ENTER', this.startGame, this);
    });
  }

  update() {
    this.updateControllerStatus();
    const gamepad = this.input.gamepad?.getAll().find(pad => pad.connected);
    if (!gamepad) {
      this.previousControllerInput = { up: false, down: false, confirm: false };
      return;
    }

    if (gamepad.up && !this.previousControllerInput.up) {
      this.selectedMenuIndex = (this.selectedMenuIndex - 1 + this.menuButtons.length)
        % this.menuButtons.length;
      this.updateMenuSelection();
    } else if (gamepad.down && !this.previousControllerInput.down) {
      this.selectedMenuIndex = (this.selectedMenuIndex + 1) % this.menuButtons.length;
      this.updateMenuSelection();
    }
    if (gamepad.A && !this.previousControllerInput.confirm) {
      this.menuButtons[this.selectedMenuIndex].action();
    }

    this.previousControllerInput = {
      up: gamepad.up,
      down: gamepad.down,
      confirm: gamepad.A
    };
  }

  updateMenuSelection() {
    this.menuButtons?.forEach(({ button }, index) => {
      button.setBackgroundColor(index === this.selectedMenuIndex ? '#30407a' : '#23305f');
    });
  }

  updateControllerStatus() {
    const gamepad = this.input.gamepad;
    let status;

    if (!gamepad?.enabled) {
      status = 'Controller input is unavailable in this browser';
    } else {
      const connectedPad = gamepad.getAll().find(pad => pad.connected);
      status = connectedPad
        ? `Controller: ${connectedPad.id}\nD-pad: navigate  |  A: select`
        : 'No controller detected\nConnect one and press any button';
    }

    if (this.controllerStatus.text !== status) {
      this.controllerStatus.setText(status);
    }
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
