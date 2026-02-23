import Phaser from 'phaser';

const GAMES = [
  {
    key: 'NoSoupForYou',
    label: 'No Soup For You!',
    description: 'Follow the Soup Nazi\'s rules exactly or face his wrath.',
    color: 0xe74c3c,
  },
  {
    key: 'FestivusFeats',
    label: 'Feats of Strength',
    description: 'Festivus isn\'t over until you pin George!',
    color: 0x27ae60,
  },
  {
    key: 'YadaYada',
    label: 'Yada Yada Yada',
    description: 'Fill in the blanks — some parts were skipped.',
    color: 0x2980b9,
  },
];

export default class MainMenu extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenu' });
  }

  create() {
    const { width, height } = this.scale;

    // Background gradient feel via rectangles
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // Title
    this.add
      .text(width / 2, 60, 'SEINFELD GAMES', {
        fontSize: '40px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#f1c40f',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 110, 'A show about games', {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#bdc3c7',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    // Game cards
    GAMES.forEach((game, index) => {
      const cardX = width / 2;
      const cardY = 220 + index * 130;
      const cardW = 600;
      const cardH = 110;

      // Card background
      const card = this.add
        .rectangle(cardX, cardY, cardW, cardH, 0x16213e)
        .setInteractive({ useHandCursor: true });

      // Accent bar
      this.add.rectangle(cardX - cardW / 2 + 8, cardY, 10, cardH, game.color);

      // Game title
      this.add
        .text(cardX - cardW / 2 + 28, cardY - 20, game.label, {
          fontSize: '22px',
          fontFamily: 'Arial Black, sans-serif',
          color: '#ffffff',
        })
        .setOrigin(0, 0.5);

      // Game description
      this.add
        .text(cardX - cardW / 2 + 28, cardY + 18, game.description, {
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          color: '#95a5a6',
        })
        .setOrigin(0, 0.5);

      // Play button
      const btn = this.add
        .text(cardX + cardW / 2 - 20, cardY, 'PLAY ▶', {
          fontSize: '16px',
          fontFamily: 'Arial Black, sans-serif',
          color: '#f1c40f',
        })
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true });

      // Hover effects
      const highlight = () => {
        card.setFillStyle(0x0f3460);
        btn.setStyle({ color: '#ffffff' });
      };
      const unhighlight = () => {
        card.setFillStyle(0x16213e);
        btn.setStyle({ color: '#f1c40f' });
      };
      const launch = () => this.scene.start(game.key);

      card.on('pointerover', highlight);
      card.on('pointerout', unhighlight);
      card.on('pointerdown', launch);
      btn.on('pointerover', highlight);
      btn.on('pointerout', unhighlight);
      btn.on('pointerdown', launch);
    });

    // Footer
    this.add
      .text(width / 2, height - 20, 'Press a card to start playing', {
        fontSize: '13px',
        fontFamily: 'Arial, sans-serif',
        color: '#4a5568',
      })
      .setOrigin(0.5);
  }
}
