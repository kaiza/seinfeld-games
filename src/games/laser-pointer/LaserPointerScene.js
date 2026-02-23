import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * The Laser Pointer - A whack-a-mole mini-game
 *
 * Inspired by "The Puerto Rican Day" — Kramer's laser pointer in the theater.
 * George pops up from theater seats and you blast him with a laser pointer.
 * Hit George for points, but don't hit innocent moviegoers or you lose a life!
 */

// Theater seat grid layout (5 columns x 3 rows of seats)
const COLS = 5;
const ROWS = 3;
const SEAT_WIDTH = 120;
const SEAT_HEIGHT = 100;
const GRID_OFFSET_X = 100;
const GRID_OFFSET_Y = 160;

const GEORGE_COLOR = 0xd4a574;
const GEORGE_GLASSES = 0x333333;
const INNOCENT_COLOR = 0xc9a89a;
const SEAT_COLOR = 0x8b0000;
const SEAT_BACK_COLOR = 0x6b0000;

const ROUND_DURATION = 60; // seconds
const GEORGE_BASE_SHOW_TIME = 1500; // ms — gets shorter as score rises
const SPAWN_BASE_INTERVAL = 1200; // ms — gets shorter as score rises

export class LaserPointerScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LaserPointerScene' });
  }

  init() {
    this.score = 0;
    this.lives = 3;
    this.timeLeft = ROUND_DURATION;
    this.isPlaying = false;
    this.popups = []; // active popup targets
    this.seatOccupied = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    // Use custom cursor (crosshair) for laser pointer feel
    this.input.setDefaultCursor('crosshair');

    this.drawTheater();
    this.createUI();
    this.createLaserDot();

    // Show start prompt
    this.startText = this.add.text(width / 2, height / 2 - 20, 'Click anywhere to start!', {
      fontSize: '24px',
      fontFamily: 'Courier New',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    this.input.once('pointerdown', () => {
      this.startText.destroy();
      this.startGame();
    });

    this.addBackButton();
  }

  // ---------- DRAWING ----------

  drawTheater() {
    const { width, height } = this.scale;

    // Dark theater background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a0f);

    // Movie screen glow at the top
    this.add.rectangle(width / 2, 50, 600, 60, 0x1a1a2e)
      .setStrokeStyle(1, 0x333355);
    this.add.text(width / 2, 50, '🎬  NOW PLAYING  🎬', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#444466',
    }).setOrigin(0.5);

    // Draw seat rows (back to front for depth)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const { x, y } = this.getSeatPosition(row, col);

        // Seat back
        this.add.rectangle(x, y - 20, SEAT_WIDTH - 10, 30, SEAT_BACK_COLOR)
          .setStrokeStyle(1, 0x440000);

        // Seat bottom
        this.add.rectangle(x, y + 5, SEAT_WIDTH - 10, 20, SEAT_COLOR)
          .setStrokeStyle(1, 0x550000);
      }
    }
  }

  getSeatPosition(row, col) {
    // Rows further back are higher and slightly narrower (perspective)
    const perspectiveScale = 1 - row * 0.05;
    const rowSpacing = SEAT_HEIGHT - row * 5;
    return {
      x: GRID_OFFSET_X + col * (SEAT_WIDTH * perspectiveScale) + (row * 12),
      y: GRID_OFFSET_Y + row * rowSpacing,
    };
  }

  createUI() {
    const { width } = this.scale;

    // Title
    this.add.text(width / 2, 105, 'THE LASER POINTER', {
      fontSize: '28px',
      fontFamily: 'Courier New',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Score
    this.scoreText = this.add.text(20, 10, 'Score: 0', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#ff6666',
    }).setDepth(50);

    // Lives
    this.livesText = this.add.text(20, 35, '❤️ ❤️ ❤️', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#ff0000',
    }).setDepth(50);

    // Timer
    this.timerText = this.add.text(width - 20, 10, `Time: ${ROUND_DURATION}`, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(1, 0).setDepth(50);

    // Combo text (hidden by default)
    this.comboText = this.add.text(width / 2, 130, '', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#00ff00',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50).setAlpha(0);
  }

  createLaserDot() {
    // Red laser dot that follows the mouse
    this.laserDot = this.add.circle(0, 0, 4, 0xff0000).setDepth(200).setAlpha(0.9);
    this.laserGlow = this.add.circle(0, 0, 8, 0xff0000, 0.3).setDepth(199);

    this.input.on('pointermove', (pointer) => {
      this.laserDot.setPosition(pointer.x, pointer.y);
      this.laserGlow.setPosition(pointer.x, pointer.y);
    });
  }

  // ---------- GAME LOGIC ----------

  startGame() {
    this.isPlaying = true;
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.timeLeft = ROUND_DURATION;

    // Timer countdown
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.tick,
      callbackScope: this,
      loop: true,
    });

    // Start spawning
    this.scheduleNextSpawn();
  }

  tick() {
    this.timeLeft--;
    this.timerText.setText(`Time: ${this.timeLeft}`);

    if (this.timeLeft <= 10) {
      this.timerText.setColor('#ff0000');
    }

    if (this.timeLeft <= 0) {
      this.endGame();
    }
  }

  scheduleNextSpawn() {
    if (!this.isPlaying) return;

    // Speed up as score increases
    const speedFactor = Math.max(0.4, 1 - this.score * 0.015);
    const delay = SPAWN_BASE_INTERVAL * speedFactor + Phaser.Math.Between(-200, 200);

    this.time.delayedCall(Math.max(400, delay), () => {
      if (!this.isPlaying) return;
      this.spawnPopup();
      this.scheduleNextSpawn();
    });
  }

  spawnPopup() {
    // Pick a random unoccupied seat
    const freeSeat = this.findFreeSeat();
    if (!freeSeat) return;

    const { row, col } = freeSeat;
    this.seatOccupied[row][col] = true;

    const { x, y } = this.getSeatPosition(row, col);

    // 75% chance George, 25% chance innocent moviegoer
    const isGeorge = Phaser.Math.Between(1, 100) <= 75;

    const popup = this.createCharacter(x, y - 30, isGeorge);
    popup.isGeorge = isGeorge;
    popup.seatRow = row;
    popup.seatCol = col;

    // Pop-up animation
    popup.setScale(0);
    this.tweens.add({
      targets: popup,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });

    // Make clickable
    popup.hitZone = this.add.rectangle(x, y - 35, 50, 50, 0x000000, 0)
      .setInteractive({ useHandCursor: false })
      .setDepth(90);

    popup.hitZone.on('pointerdown', () => {
      this.onHit(popup);
    });

    // Auto-hide after a duration (faster as score grows)
    const showTime = Math.max(600, GEORGE_BASE_SHOW_TIME - this.score * 30);
    popup.hideTimer = this.time.delayedCall(showTime, () => {
      this.removePopup(popup, false);
    });

    this.popups.push(popup);
  }

  createCharacter(x, y, isGeorge) {
    const container = this.add.container(x, y).setDepth(80);

    if (isGeorge) {
      // George's head (round, bald)
      const head = this.add.circle(0, 0, 18, GEORGE_COLOR);
      // Bald shine
      const shine = this.add.circle(-4, -10, 5, 0xe8c89a, 0.5);
      // Glasses
      const glassL = this.add.circle(-8, -2, 7, GEORGE_GLASSES, 0).setStrokeStyle(2, GEORGE_GLASSES);
      const glassR = this.add.circle(8, -2, 7, GEORGE_GLASSES, 0).setStrokeStyle(2, GEORGE_GLASSES);
      const bridge = this.add.rectangle(0, -2, 6, 2, GEORGE_GLASSES);
      // Frown
      const mouth = this.add.arc(0, 8, 6, 200, 340, false, 0x8b4513).setStrokeStyle(2, 0x8b4513);
      // Body (shirt)
      const body = this.add.rectangle(0, 28, 30, 20, 0x2266aa);

      container.add([body, head, shine, glassL, glassR, bridge, mouth]);
    } else {
      // Innocent moviegoer
      const head = this.add.circle(0, 0, 16, INNOCENT_COLOR);
      // Hair
      const hair = this.add.ellipse(0, -12, 28, 14, 0x443322);
      // Eyes
      const eyeL = this.add.circle(-5, -2, 2, 0x222222);
      const eyeR = this.add.circle(5, -2, 2, 0x222222);
      // Body
      const body = this.add.rectangle(0, 26, 28, 18, 0x556677);

      container.add([body, hair, head, eyeL, eyeR]);
    }

    return container;
  }

  findFreeSeat() {
    const freeSeats = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!this.seatOccupied[row][col]) {
          freeSeats.push({ row, col });
        }
      }
    }
    if (freeSeats.length === 0) return null;
    return Phaser.Utils.Array.GetRandom(freeSeats);
  }

  onHit(popup) {
    if (!this.isPlaying) return;

    // Cancel auto-hide
    if (popup.hideTimer) popup.hideTimer.remove();

    const { x, y } = this.getSeatPosition(popup.seatRow, popup.seatCol);

    if (popup.isGeorge) {
      // HIT GEORGE!
      this.combo++;
      const points = 10 * this.combo;
      this.score += points;
      this.scoreText.setText(`Score: ${this.score}`);

      // Laser flash effect
      this.cameras.main.flash(80, 255, 0, 0, false);

      // Points popup
      const ptText = this.add.text(x, y - 60, `+${points}`, {
        fontSize: '20px',
        fontFamily: 'Courier New',
        color: '#00ff00',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(100);

      this.tweens.add({
        targets: ptText,
        y: y - 100,
        alpha: 0,
        duration: 700,
        onComplete: () => ptText.destroy(),
      });

      // Combo feedback
      if (this.combo >= 3) {
        this.comboText.setText(`🔥 ${this.combo}x COMBO!`).setAlpha(1);
        this.time.delayedCall(800, () => this.comboText.setAlpha(0));
      }

      // George "ow!" reaction
      const ow = this.add.text(x + 20, y - 40, 'OW!', {
        fontSize: '14px',
        fontFamily: 'Courier New',
        color: '#ffff00',
        fontStyle: 'bold',
      }).setDepth(100);
      this.time.delayedCall(400, () => ow.destroy());

    } else {
      // HIT AN INNOCENT — lose a life
      this.combo = 0;
      this.lives--;
      this.updateLives();

      // Screen shake
      this.cameras.main.shake(200, 0.01);

      const sorry = this.add.text(x, y - 60, 'Wrong person!', {
        fontSize: '16px',
        fontFamily: 'Courier New',
        color: '#ff4444',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(100);

      this.tweens.add({
        targets: sorry,
        y: y - 100,
        alpha: 0,
        duration: 800,
        onComplete: () => sorry.destroy(),
      });

      if (this.lives <= 0) {
        this.endGame();
        return;
      }
    }

    this.removePopup(popup, true);
  }

  removePopup(popup, wasHit) {
    // Free the seat
    this.seatOccupied[popup.seatRow][popup.seatCol] = false;

    // Remove hit zone
    if (popup.hitZone) popup.hitZone.destroy();

    // Shrink & remove
    this.tweens.add({
      targets: popup,
      scaleX: 0,
      scaleY: 0,
      duration: wasHit ? 100 : 200,
      onComplete: () => {
        popup.destroy();
      },
    });

    // Remove from active popups
    const idx = this.popups.indexOf(popup);
    if (idx !== -1) this.popups.splice(idx, 1);
  }

  updateLives() {
    const hearts = [];
    for (let i = 0; i < 3; i++) {
      hearts.push(i < this.lives ? '❤️' : '🖤');
    }
    this.livesText.setText(hearts.join(' '));
  }

  endGame() {
    this.isPlaying = false;
    if (this.timerEvent) this.timerEvent.remove();

    // Clear remaining popups
    this.popups.forEach((p) => {
      if (p.hitZone) p.hitZone.destroy();
      if (p.hideTimer) p.hideTimer.remove();
      p.destroy();
    });
    this.popups = [];

    const { width, height } = this.scale;

    // Dim overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setDepth(150);

    // Game over text
    const reason = this.lives <= 0 ? 'You blinded too many innocents!' : 'Time\'s up!';

    this.add.text(width / 2, height / 2 - 60, 'GAME OVER', {
      fontSize: '40px',
      fontFamily: 'Courier New',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 15, reason, {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#cccccc',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 + 20, `Final Score: ${this.score}`, {
      fontSize: '24px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(0.5).setDepth(151);

    // Retry button
    const retryBtn = this.add.text(width / 2, height / 2 + 70, '[ PLAY AGAIN ]', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerover', () => retryBtn.setColor('#ff3333'));
    retryBtn.on('pointerout', () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    // Menu button
    const menuBtn = this.add.text(width / 2, height / 2 + 110, '[ BACK TO MENU ]', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  addBackButton() {
    const btn = this.add.text(20, 560, '← Back to Menu', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setInteractive({ useHandCursor: true }).setDepth(50);

    btn.on('pointerover', () => btn.setColor('#e94560'));
    btn.on('pointerout', () => btn.setColor('#888888'));
    btn.on('pointerdown', () => {
      this.isPlaying = false;
      if (this.timerEvent) this.timerEvent.remove();
      this.scene.start('MenuScene');
    });
  }
}
