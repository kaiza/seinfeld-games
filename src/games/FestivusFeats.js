/**
 * Festivus Feats of Strength — Mini Game
 *
 * Festivus isn't over until you pin the head of the household (George)!
 * Rapidly click the button to fill your Strength Meter before the timer runs out.
 * If you fill it to 100% — you win. If time expires — George pins you.
 *
 * Each developer can extend this scene independently.
 */
import Phaser from 'phaser';

const TIME_LIMIT = 8000; // ms
const STRENGTH_PER_CLICK = 4; // %
const DRAIN_RATE = 2; // % per second — strength slowly drains

export default class FestivusFeats extends Phaser.Scene {
  constructor() {
    super({ key: 'FestivusFeats' });
  }

  init() {
    this.strength = 0;
    this.timeLeft = TIME_LIMIT;
    this.gameOver = false;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1b2a);

    // Title bar
    this.add.rectangle(width / 2, 40, width, 80, 0x1a5276);
    this.add
      .text(width / 2, 40, 'FEATS OF STRENGTH', {
        fontSize: '28px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#f1c40f',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 105, 'Festivus isn\'t over until you pin George!', {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#aed6f1',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    // Strength bar background
    const barX = width / 2;
    const barY = 200;
    const barW = 500;
    const barH = 40;
    this.add.rectangle(barX, barY, barW, barH, 0x1c2833).setStrokeStyle(3, 0x5d6d7e);
    this.strengthFill = this.add.rectangle(barX - barW / 2, barY, 0, barH, 0xe74c3c).setOrigin(0, 0.5);
    this.add
      .text(barX, barY, 'STRENGTH', {
        fontSize: '14px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.strengthLabel = this.add
      .text(barX + barW / 2 + 12, barY, '0%', {
        fontSize: '18px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#e74c3c',
      })
      .setOrigin(0, 0.5);

    // Timer bar background
    const tBarY = 260;
    this.add.rectangle(barX, tBarY, barW, 20, 0x1c2833).setStrokeStyle(2, 0x5d6d7e);
    this.timerFill = this.add
      .rectangle(barX - barW / 2, tBarY, barW, 20, 0x27ae60)
      .setOrigin(0, 0.5);
    this.timerLabel = this.add
      .text(barX + barW / 2 + 12, tBarY, `${(TIME_LIMIT / 1000).toFixed(1)}s`, {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#27ae60',
      })
      .setOrigin(0, 0.5);

    // Aluminium pole (Festivus decoration)
    this.add.rectangle(width / 2, 370, 18, 160, 0x808080).setStrokeStyle(2, 0xaaaaaa);
    this.add.rectangle(width / 2, 455, 60, 10, 0x666666);
    this.add
      .text(width / 2, 310, '🎄', { fontSize: '14px' })
      .setOrigin(0.5)
      .setAlpha(0)
      .setName('pole_label');

    // Big click button
    const btnY = 480;
    this.clickBtn = this.add
      .rectangle(width / 2, btnY, 260, 80, 0xc0392b)
      .setInteractive({ useHandCursor: true });
    this.clickLabel = this.add
      .text(width / 2, btnY, '💪 PUSH!', {
        fontSize: '26px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.clickBtn.on('pointerover', () => this.clickBtn.setFillStyle(0xe74c3c));
    this.clickBtn.on('pointerout', () => this.clickBtn.setFillStyle(0xc0392b));
    this.clickBtn.on('pointerdown', () => this.onPush());

    // Status message
    this.statusText = this.add
      .text(width / 2, 560, 'Click as fast as you can!', {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#aed6f1',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    // Game timer
    this.gameTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: this.tick,
      callbackScope: this,
    });

    this.createBackButton();
  }

  tick() {
    if (this.gameOver) return;

    this.timeLeft -= 16;

    // Slowly drain strength to keep pressure up
    this.strength = Math.max(0, this.strength - (DRAIN_RATE * 16) / 1000);
    this.updateBars();

    if (this.timeLeft <= 0) {
      this.endGame(false);
    }
  }

  onPush() {
    if (this.gameOver) return;
    this.strength = Math.min(100, this.strength + STRENGTH_PER_CLICK);
    this.updateBars();

    if (this.strength >= 100) {
      this.endGame(true);
    }
  }

  updateBars() {
    const { width } = this.scale;
    const barW = 500;
    const barX = width / 2;
    const strengthPct = this.strength / 100;
    const timePct = Math.max(0, this.timeLeft / TIME_LIMIT);

    this.strengthFill.setSize(barW * strengthPct, 40);

    // Color shifts from green to yellow to red as strength grows
    const color =
      this.strength < 40 ? 0xe74c3c : this.strength < 75 ? 0xf39c12 : 0x2ecc71;
    this.strengthFill.setFillStyle(color);
    this.strengthLabel.setText(`${Math.floor(this.strength)}%`);
    this.strengthLabel.setStyle({ color: Phaser.Display.Color.IntegerToColor(color).rgba });

    this.timerFill.setSize(barW * timePct, 20);
    const tColor = timePct > 0.5 ? 0x27ae60 : timePct > 0.25 ? 0xf39c12 : 0xe74c3c;
    this.timerFill.setFillStyle(tColor);
    this.timerLabel.setText(`${(this.timeLeft / 1000).toFixed(1)}s`);
  }

  endGame(won) {
    this.gameOver = true;
    this.gameTimer.remove();

    this.clickBtn.disableInteractive();
    this.clickBtn.setFillStyle(0x555555);

    if (won) {
      this.statusText.setText('🏆 You pinned George! Happy Festivus!');
      this.statusText.setStyle({ color: '#2ecc71', fontSize: '18px' });
    } else {
      this.statusText.setText('😔 George pinned you. Festivus continues...');
      this.statusText.setStyle({ color: '#e74c3c', fontSize: '18px' });
    }

    this.time.delayedCall(2000, () => this.showRestart());
  }

  showRestart() {
    const { width, height } = this.scale;
    const restartBg = this.add
      .rectangle(width / 2, height / 2 - 20, 300, 60, 0xf1c40f)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, height / 2 - 20, 'Play Again', {
        fontSize: '22px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#000',
      })
      .setOrigin(0.5);
    restartBg.on('pointerdown', () => this.scene.restart());

    const menuBg = this.add
      .rectangle(width / 2, height / 2 + 55, 300, 60, 0x2c3e50)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, height / 2 + 55, '← Main Menu', {
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
