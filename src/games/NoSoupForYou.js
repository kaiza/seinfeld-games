/**
 * No Soup For You! — Mini Game
 *
 * The Soup Nazi has a strict ordering process. Players must click the correct
 * steps IN ORDER: (1) Choose soup, (2) Move to the left, (3) Hand over exact
 * change. One wrong move and it's "No Soup For You!"
 *
 * Each developer can extend this scene independently.
 */
import Phaser from 'phaser';

const STEPS = [
  { label: 'Pick a Soup', hint: 'Step up and choose your soup.' },
  { label: 'Move to the Left', hint: 'Shhh — move quietly to the left.' },
  { label: 'Exact Change Only', hint: 'Hand over the exact amount.' },
  { label: 'Take Your Soup', hint: 'Grab it and go. No eye contact!' },
];

export default class NoSoupForYou extends Phaser.Scene {
  constructor() {
    super({ key: 'NoSoupForYou' });
  }

  init() {
    this.currentStep = 0;
    this.failed = false;
    this.won = false;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x2c1810);

    // Title bar
    this.add.rectangle(width / 2, 40, width, 80, 0x8b0000);
    this.add
      .text(width / 2, 40, 'NO SOUP FOR YOU!', {
        fontSize: '28px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#ffffff',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Hint text
    this.hintText = this.add
      .text(width / 2, 100, STEPS[0].hint, {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#f5deb3',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    // Step progress dots
    this.dots = STEPS.map((_, i) => {
      return this.add
        .circle(width / 2 - (STEPS.length - 1) * 25 + i * 50, 145, 10, 0x555555)
        .setInteractive(false);
    });
    this.updateDots();

    // Buttons for the correct step order — displayed in shuffled positions each round
    this.buttons = this.createButtons(width, height);

    // Status message
    this.statusText = this.add
      .text(width / 2, 520, '', {
        fontSize: '22px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#f1c40f',
        stroke: '#000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5);

    // Back button
    this.createBackButton();
  }

  createButtons(width, height) {
    const positions = this.shuffledPositions(width, height);
    return STEPS.map((step, i) => {
      const pos = positions[i];
      const bg = this.add
        .rectangle(pos.x, pos.y, 260, 70, 0xc0392b)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(pos.x, pos.y, step.label, {
          fontSize: '17px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 240 },
        })
        .setOrigin(0.5);

      bg.on('pointerover', () => bg.setFillStyle(0xe74c3c));
      bg.on('pointerout', () => !bg.getData('done') && bg.setFillStyle(0xc0392b));
      bg.on('pointerdown', () => this.handleChoice(i, bg, label));

      return { bg, label };
    });
  }

  shuffledPositions(width, height) {
    const cols = 2;
    const rows = 2;
    const startX = width / 2 - 145;
    const startY = 210;
    const spacingX = 290;
    const spacingY = 130;
    const positions = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        positions.push({ x: startX + c * spacingX, y: startY + r * spacingY });
      }
    }
    // Shuffle using Fisher-Yates
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    return positions;
  }

  handleChoice(index, bg, label) {
    if (this.failed || this.won) return;

    if (index === this.currentStep) {
      // Correct step
      bg.setFillStyle(0x27ae60);
      bg.setData('done', true);
      bg.disableInteractive();
      this.currentStep++;
      this.updateDots();

      if (this.currentStep >= STEPS.length) {
        this.won = true;
        this.hintText.setText('');
        this.statusText.setText('🍲 Soup acquired!\nYou followed the rules perfectly.');
        this.statusText.setStyle({ color: '#2ecc71' });
        this.time.delayedCall(2500, () => this.showRestart());
      } else {
        this.hintText.setText(STEPS[this.currentStep].hint);
      }
    } else {
      // Wrong step — Soup Nazi strikes!
      this.failed = true;
      bg.setFillStyle(0x7f8c8d);
      label.setStyle({ color: '#555' });
      this.hintText.setText('');
      this.statusText.setText('🚫 NO SOUP FOR YOU!\nCome back… one year!');
      this.statusText.setStyle({ color: '#e74c3c' });

      // Grey out remaining buttons
      this.buttons.forEach(({ bg: b, label: l }) => {
        if (!b.getData('done')) {
          b.setFillStyle(0x555555);
          b.disableInteractive();
        }
      });

      this.time.delayedCall(2500, () => this.showRestart());
    }
  }

  updateDots() {
    this.dots.forEach((dot, i) => {
      if (i < this.currentStep) {
        dot.setFillStyle(0x2ecc71);
      } else if (i === this.currentStep) {
        dot.setFillStyle(0xf1c40f);
      } else {
        dot.setFillStyle(0x555555);
      }
    });
  }

  showRestart() {
    const { width, height } = this.scale;
    const restartBg = this.add
      .rectangle(width / 2, height / 2, 300, 60, 0xf1c40f)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, height / 2, 'Play Again', {
        fontSize: '22px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#000',
      })
      .setOrigin(0.5);
    restartBg.on('pointerdown', () => this.scene.restart());

    const menuBg = this.add
      .rectangle(width / 2, height / 2 + 75, 300, 60, 0x2c3e50)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, height / 2 + 75, '← Main Menu', {
        fontSize: '20px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    menuBg.on('pointerdown', () => this.scene.start('MainMenu'));
  }

  createBackButton() {
    const btn = this.add
      .text(20, 580, '← Menu', {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#95a5a6',
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#95a5a6' }));
    btn.on('pointerdown', () => this.scene.start('MainMenu'));
  }
}
