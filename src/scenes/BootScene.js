import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load any global assets here (fonts, spritesheets, audio)
    // this.load.image('logo', 'assets/images/logo.png');
  }

  create() {
    this.scene.start('MenuScene');
  }
}
