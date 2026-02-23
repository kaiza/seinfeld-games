import Phaser from 'phaser';

const GAMES = [
  { key: 'ParkingGarageScene', title: 'Parking Garage', description: 'Find your car before time runs out' },
  { key: 'LaserPointerScene', title: 'The Laser Pointer', description: 'Zap George in the movie theater!' },
  { key: 'FroggerScene', title: 'The Frogger', description: 'Push the arcade machine across the street!' },
  { key: 'HoleInOneScene', title: 'Hole in One', description: 'Hit the whale with a golf ball as Kramer' },
  { key: 'RyeMatch3Scene', title: 'Jerry vs. The Rye', description: 'Match-3 your way to placing the marble rye!' },
];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Title
    this.add.text(width / 2, 60, 'SEINFELD GAMES', {
      fontSize: '42px',
      fontFamily: 'Courier New',
      color: '#e94560',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, 110, 'A game about nothing... and everything', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Game selection buttons
    GAMES.forEach((game, index) => {
      const y = 180 + index * 72;

      const bg = this.add.rectangle(width / 2, y, 500, 62, 0x16213e)
        .setStrokeStyle(2, 0x0f3460)
        .setInteractive({ useHandCursor: true });

      const title = this.add.text(width / 2, y - 12, game.title, {
        fontSize: '22px',
        fontFamily: 'Courier New',
        color: '#e94560',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const desc = this.add.text(width / 2, y + 14, game.description, {
        fontSize: '13px',
        fontFamily: 'Courier New',
        color: '#888888',
      }).setOrigin(0.5);

      bg.on('pointerover', () => {
        bg.setFillStyle(0x0f3460);
        title.setColor('#ffffff');
      });

      bg.on('pointerout', () => {
        bg.setFillStyle(0x16213e);
        title.setColor('#e94560');
      });

      bg.on('pointerdown', () => {
        this.scene.start(game.key);
      });
    });
  }
}
