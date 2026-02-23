import Phaser from 'phaser';

/**
 * Marble Rye - A stealth/platformer mini-game
 *
 * Help George snag the marble rye from the old lady
 * and sneak it up to the Rosses' apartment using a fishing line.
 */
export class MarbleRyeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MarbleRyeScene' });
  }

  init() {
    this.score = 0;
    this.isPlaying = false;
  }

  preload() {
    // Load game-specific assets
    // this.load.image('rye-bg', 'assets/games/marble-rye/bg.png');
  }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, 30, 'MARBLE RYE', {
      fontSize: '32px',
      fontFamily: 'Courier New',
      color: '#e94560',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.scoreText = this.add.text(width / 2, 70, 'Score: 0', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2, '[ Game implementation goes here ]', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#666666',
    }).setOrigin(0.5);

    this.addBackButton();
  }

  update(time, delta) {
    // Game loop logic
  }

  addBackButton() {
    const btn = this.add.text(20, 560, '← Back to Menu', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#e94560'));
    btn.on('pointerout', () => btn.setColor('#888888'));
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
