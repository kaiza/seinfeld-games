import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * Festivus Feats of Strength
 *
 * Inspired by "The Strike" (S9E10). Pin Frank Costanza to end Festivus!
 * Rapidly click (or press SPACE) to push the tug-of-war strength bar toward
 * Frank's side. Frank pushes back automatically — and gets stronger each round.
 * Win 2 out of 3 rounds to pin Frank and celebrate Festivus!
 */

// Layout constants
const BAR_CX = 400;    // center X of the struggle bar
const BAR_Y = 320;     // Y position of bar
const BAR_W = 480;     // total bar width
const BAR_H = 36;      // bar height

// Game constants
const TOTAL_ROUNDS = 3;
const WINS_NEEDED = 2;
const ROUND_TIME = 20;       // seconds per round
const FRANK_BASE_RATE = 0.18; // Frank's push per second (0-1 scale)
const FRANK_ROUND_BOOST = 0.04; // extra push per round
const PLAYER_PUSH = 0.048;   // amount bar moves per click

export class FestivusScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FestivusScene' });
  }

  init() {
    this.playerWins = 0;
    this.frankWins = 0;
    this.round = 1;
    this.isPlaying = false;
    this.roundOver = false;
    // Bar position: 0 = fully Frank's side, 1 = fully player's side; 0.5 = center
    this.barPos = 0.5;
    this.timeLeft = ROUND_TIME;
    this.mashCount = 0;
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    this.drawBackground(width, height);
    this.drawFestivusPole(width, height);
    this.createCharacters(width, height);
    this.createStruggleBar();
    this.createUI(width);

    // Start prompt
    this.startText = this.add.text(width / 2, height / 2 + 30,
      'Click or press SPACE to start!', {
        fontSize: '22px',
        fontFamily: 'Courier New',
        color: '#ffcc00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(100);

    this.startSubtext = this.add.text(width / 2, height / 2 + 65,
      'Mash to pin Frank and end Festivus!', {
        fontSize: '14px',
        fontFamily: 'Georgia, serif',
        color: '#aaaaaa',
        fontStyle: 'italic',
      }).setOrigin(0.5).setDepth(100);

    // Single click/key to start
    this.input.once('pointerdown', () => this.beginGame());
    this.input.keyboard.once('keydown-SPACE', () => this.beginGame());

    this.addBackButton();
  }

  // ==================== DRAWING ====================

  drawBackground(width, height) {
    const g = this.add.graphics();

    // Room background (warm living-room tones)
    g.fillStyle(0x3a2510, 1);
    g.fillRect(0, 0, width, height);

    // Wall
    g.fillStyle(0xc8a46a, 1);
    g.fillRect(0, 0, width, height - 200);

    // Floor
    g.fillStyle(0x4a2e10, 1);
    g.fillRect(0, height - 200, width, 200);

    // Floor planks
    g.lineStyle(1, 0x3a2510, 0.5);
    for (let x = 0; x < width; x += 60) {
      g.lineBetween(x, height - 200, x, height);
    }

    // Wainscoting
    g.fillStyle(0xd4b080, 1);
    g.fillRect(0, height - 210, width, 14);
    g.fillStyle(0xb8924a, 1);
    g.fillRect(0, height - 210, width, 4);

    // Wrestling mat / ring indicator on floor
    g.fillStyle(0x1a0a04, 0.4);
    g.fillEllipse(width / 2, height - 130, 600, 120);
    g.lineStyle(3, 0xffcc00, 0.6);
    g.strokeEllipse(width / 2, height - 130, 600, 120);

    // "FESTIVUS" banner
    g.fillStyle(0x1a1a3a, 1);
    g.fillRect(width / 2 - 180, 14, 360, 48);
    g.lineStyle(2, 0xffcc00);
    g.strokeRect(width / 2 - 180, 14, 360, 48);
  }

  drawFestivusPole(width, height) {
    const poleX = width / 2;
    const g = this.add.graphics().setDepth(2);

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(poleX, height - 195, 30, 10);

    // Pole (aluminum, unadorned)
    g.fillStyle(0xcccccc, 1);
    g.fillRect(poleX - 6, 75, 12, height - 265);
    // Shine
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(poleX - 5, 75, 3, height - 265);
    // Base
    g.fillStyle(0x888888, 1);
    g.fillRect(poleX - 18, height - 195, 36, 10);
  }

  createCharacters(width, height) {
    // Jerry (player) on left, Frank on right
    const groundY = height - 155;

    // Jerry
    this.jerryContainer = this.add.container(160, groundY).setDepth(10);
    this._buildJerry(this.jerryContainer);

    // Frank
    this.frankContainer = this.add.container(640, groundY).setDepth(10);
    this._buildFrank(this.frankContainer);

    // Name labels
    this.add.text(160, groundY + 75, 'Jerry', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#88bbff',
    }).setOrigin(0.5).setDepth(10);

    this.add.text(640, groundY + 75, 'Frank', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#ff8888',
    }).setOrigin(0.5).setDepth(10);
  }

  _buildJerry(c) {
    // Body
    c.add(this.add.rectangle(0, 20, 36, 50, 0x4488cc));
    // Head
    c.add(this.add.circle(0, -18, 20, 0xd4a574));
    // Hair (brown)
    c.add(this.add.ellipse(0, -33, 36, 16, 0x553311));
    // Eyes
    c.add(this.add.circle(-7, -20, 3, 0x222222));
    c.add(this.add.circle(7, -20, 3, 0x222222));
    // Mouth (determined)
    c.add(this.add.rectangle(0, -10, 12, 3, 0x993333));
    // Arms raised (wrestling stance) - left arm
    c.add(this.add.rectangle(-26, 2, 6, 28, 0xd4a574).setRotation(-0.4));
    // Right arm
    c.add(this.add.rectangle(26, 2, 6, 28, 0xd4a574).setRotation(0.4));
    // Legs
    c.add(this.add.rectangle(-9, 54, 14, 28, 0x336699));
    c.add(this.add.rectangle(9, 54, 14, 28, 0x336699));
  }

  _buildFrank(c) {
    // Body (larger, grey sweater)
    c.add(this.add.rectangle(0, 22, 44, 56, 0x666666));
    // Head (rounder, grumpy)
    c.add(this.add.circle(0, -16, 23, 0xc8956a));
    // Grey hair
    c.add(this.add.ellipse(0, -34, 40, 14, 0x999999));
    // Eyes (stern brow)
    c.add(this.add.circle(-8, -18, 3, 0x222222));
    c.add(this.add.circle(8, -18, 3, 0x222222));
    // Furrowed brows
    c.add(this.add.rectangle(-8, -25, 12, 3, 0x555555).setRotation(0.25));
    c.add(this.add.rectangle(8, -25, 12, 3, 0x555555).setRotation(-0.25));
    // Frown
    const frown = this.add.arc(0, -8, 7, 200, 340, false, 0x884422);
    frown.setStrokeStyle(2, 0x884422);
    c.add(frown);
    // Arms (wrestling stance) - mirrored
    c.add(this.add.rectangle(-26, 4, 7, 32, 0xc8956a).setRotation(0.4));
    c.add(this.add.rectangle(26, 4, 7, 32, 0xc8956a).setRotation(-0.4));
    // Legs
    c.add(this.add.rectangle(-10, 58, 16, 28, 0x444444));
    c.add(this.add.rectangle(10, 58, 16, 28, 0x444444));
  }

  createStruggleBar() {
    const g = this.add.graphics().setDepth(20);
    this.barGraphics = g;

    // Arrow hints below bar
    this.arrowHint = this.add.text(BAR_CX, BAR_Y + 40,
      '← FRANK        JERRY →', {
        fontSize: '11px',
        fontFamily: 'Courier New',
        color: '#888888',
      }).setOrigin(0.5).setDepth(20);

    // Mash count display
    this.mashText = this.add.text(BAR_CX, BAR_Y + 60, '', {
      fontSize: '13px', fontFamily: 'Courier New', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(20);

    this._redrawBar();
  }

  _redrawBar() {
    const g = this.barGraphics;
    g.clear();

    // Bar background (Frank's color — red)
    g.fillStyle(0x882222, 1);
    g.fillRoundedRect(BAR_CX - BAR_W / 2, BAR_Y - BAR_H / 2, BAR_W, BAR_H, 8);

    // Player fill (blue) from center proportional to barPos
    // barPos = 0.5 → half; 1.0 → full player; 0 → full Frank
    const fillW = Math.round(this.barPos * BAR_W);
    if (fillW > 0) {
      g.fillStyle(0x2266cc, 1);
      g.fillRoundedRect(BAR_CX - BAR_W / 2, BAR_Y - BAR_H / 2, fillW, BAR_H, 8);
    }

    // Center divider
    g.lineStyle(3, 0xffffff, 1);
    g.lineBetween(BAR_CX, BAR_Y - BAR_H / 2 - 4, BAR_CX, BAR_Y + BAR_H / 2 + 4);

    // Sliding marker (white rectangle at current position)
    const markerX = BAR_CX - BAR_W / 2 + fillW;
    g.fillStyle(0xffffff, 1);
    g.fillRect(markerX - 5, BAR_Y - BAR_H / 2 - 6, 10, BAR_H + 12);

    // Bar outline
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeRoundedRect(BAR_CX - BAR_W / 2, BAR_Y - BAR_H / 2, BAR_W, BAR_H, 8);

    // Win-zone indicators (subtle inner lines at 10% from each edge)
    const winZone = BAR_W * 0.08;
    g.lineStyle(2, 0xffcc00, 0.8);
    g.lineBetween(BAR_CX - BAR_W / 2 + winZone, BAR_Y - BAR_H / 2,
      BAR_CX - BAR_W / 2 + winZone, BAR_Y + BAR_H / 2);
    g.lineBetween(BAR_CX + BAR_W / 2 - winZone, BAR_Y - BAR_H / 2,
      BAR_CX + BAR_W / 2 - winZone, BAR_Y + BAR_H / 2);
  }

  createUI(width) {
    // Title
    this.add.text(width / 2, 38, 'FEATS OF STRENGTH', {
      fontSize: '26px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffcc00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);

    // Round info
    this.roundText = this.add.text(width / 2, BAR_Y - 55, `Round 1 of ${TOTAL_ROUNDS}`, {
      fontSize: '18px', fontFamily: 'Courier New', color: '#ffffff',
    }).setOrigin(0.5).setDepth(20);

    // Wins display
    this.winsText = this.add.text(width / 2, BAR_Y - 30, '', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(20);
    this._updateWinsText();

    // Timer
    this.timerText = this.add.text(width / 2, 72, `Time: ${ROUND_TIME}`, {
      fontSize: '16px', fontFamily: 'Courier New', color: '#ffffff',
    }).setOrigin(0.5).setDepth(20);

    // "MASH!" instruction
    this.mashLabel = this.add.text(width / 2, BAR_Y + 84, '', {
      fontSize: '28px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffcc00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25).setAlpha(0);

    // Round result flash text
    this.resultText = this.add.text(width / 2, 270, '', {
      fontSize: '38px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(200).setAlpha(0);
  }

  _updateWinsText() {
    const jer = '★'.repeat(this.playerWins) + '☆'.repeat(WINS_NEEDED - this.playerWins);
    const fra = '★'.repeat(this.frankWins) + '☆'.repeat(WINS_NEEDED - this.frankWins);
    this.winsText.setText(`Jerry ${jer}   ${fra} Frank`);
  }

  // ==================== GAME LOGIC ====================

  beginGame() {
    if (this.startText) { this.startText.destroy(); this.startText = null; }
    if (this.startSubtext) { this.startSubtext.destroy(); this.startSubtext = null; }
    this.startRound();
  }

  startRound() {
    this.barPos = 0.5;
    this.timeLeft = ROUND_TIME;
    this.mashCount = 0;
    this.roundOver = false;
    this.isPlaying = true;

    this.roundText.setText(`Round ${this.round} of ${TOTAL_ROUNDS}`);
    this._updateWinsText();
    this._redrawBar();
    this.mashText.setText('');

    // "FIGHT!" flash
    this.resultText.setText('FIGHT!').setColor('#ffcc00').setAlpha(1);
    this.tweens.add({
      targets: this.resultText,
      alpha: 0,
      scaleX: 1.4, scaleY: 1.4,
      duration: 600,
      ease: 'Quad.easeIn',
      onComplete: () => { this.resultText.setScale(1); },
    });

    // Pulsing MASH label
    this.mashLabel.setAlpha(1);
    this.tweens.add({
      targets: this.mashLabel,
      alpha: { from: 0.4, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 350,
    });

    // Update MASH label text with current key hint
    this.mashLabel.setText('CLICK or SPACE to mash!');

    // Countdown timer
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this._tick,
      callbackScope: this,
      loop: true,
    });

    // Player input — pointer clicks
    this.input.on('pointerdown', this._onPlayerMash, this);
    // Keyboard SPACE
    this.input.keyboard.on('keydown-SPACE', this._onPlayerMash, this);
  }

  _tick() {
    if (!this.isPlaying) return;
    this.timeLeft--;
    this.timerText.setText(`Time: ${this.timeLeft}`);

    if (this.timeLeft <= 5) {
      this.timerText.setColor('#ff4444');
    }

    if (this.timeLeft <= 0) {
      // Time up — player wins if bar is past center, otherwise Frank wins
      if (this.barPos > 0.5) {
        this._roundWon('player');
      } else {
        this._roundWon('frank');
      }
    }
  }

  _onPlayerMash() {
    if (!this.isPlaying || this.roundOver) return;
    this.mashCount++;
    this.barPos = Math.min(1, this.barPos + PLAYER_PUSH);
    this.mashText.setText(`Mashes: ${this.mashCount}`);
    this._redrawBar();

    // Animate Jerry leaning forward
    this.tweens.killTweensOf(this.jerryContainer);
    this.jerryContainer.setRotation(-0.12);
    this.tweens.add({
      targets: this.jerryContainer,
      rotation: 0,
      duration: 200,
      ease: 'Sine.easeOut',
    });

    // Check win
    if (this.barPos >= 1) {
      this._roundWon('player');
    }
  }

  update() {
    if (!this.isPlaying || this.roundOver) return;

    // Frank pushes back — rate increases each round
    const frankRate = FRANK_BASE_RATE + (this.round - 1) * FRANK_ROUND_BOOST;
    const delta = this.game.loop.delta / 1000; // seconds elapsed this frame
    this.barPos = Math.max(0, this.barPos - frankRate * delta);
    this._redrawBar();

    // Animate Frank leaning when he's winning
    if (this.barPos < 0.5) {
      this.frankContainer.setRotation(0.06);
    } else {
      this.frankContainer.setRotation(0);
    }

    // Check Frank win
    if (this.barPos <= 0) {
      this._roundWon('frank');
    }
  }

  _roundWon(winner) {
    if (this.roundOver) return;
    this.roundOver = true;
    this.isPlaying = false;

    if (this.timerEvent) { this.timerEvent.remove(); this.timerEvent = null; }
    this.input.off('pointerdown', this._onPlayerMash, this);
    this.input.keyboard.off('keydown-SPACE', this._onPlayerMash, this);
    this.tweens.killTweensOf(this.mashLabel);
    this.mashLabel.setAlpha(0);
    this.timerText.setColor('#ffffff');

    if (winner === 'player') {
      this.playerWins++;
      this.resultText.setText('YOU WIN THE ROUND!').setColor('#00ff88');
      // Tilt Frank (pinned)
      this.tweens.add({ targets: this.frankContainer, rotation: 1.4, duration: 400 });
    } else {
      this.frankWins++;
      this.resultText.setText('FRANK WINS!').setColor('#ff4444');
      // Tilt Jerry (pinned)
      this.tweens.add({ targets: this.jerryContainer, rotation: -1.4, duration: 400 });
    }

    this.resultText.setAlpha(1).setScale(1);
    this.tweens.add({
      targets: this.resultText,
      scaleX: 1.15, scaleY: 1.15,
      duration: 300,
      yoyo: true,
    });

    this._updateWinsText();

    // Check if match is over
    const matchOver = this.playerWins >= WINS_NEEDED || this.frankWins >= WINS_NEEDED
      || this.round >= TOTAL_ROUNDS;

    this.time.delayedCall(1800, () => {
      // Reset character rotations
      this.jerryContainer.setRotation(0);
      this.frankContainer.setRotation(0);
      this.resultText.setAlpha(0);

      if (matchOver) {
        this.endGame();
      } else {
        this.round++;
        this.startRound();
      }
    });
  }

  // ==================== END GAME ====================

  endGame() {
    const { width, height } = this.scale;
    const playerWon = this.playerWins > this.frankWins;

    // Dark overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78)
      .setDepth(150);

    const headline = playerWon
      ? 'FESTIVUS IS OVER!'
      : 'FRANK PINS YOU!';
    const subline = playerWon
      ? 'You have pinned Frank Costanza!'
      : 'Festivus continues... until you win!';
    const headlineColor = playerWon ? '#ffcc00' : '#ff4444';

    this.add.text(width / 2, height / 2 - 100, headline, {
      fontSize: '38px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: headlineColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 55, subline, {
      fontSize: '16px',
      fontFamily: 'Georgia, serif',
      color: '#cccccc',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 10, `Jerry ${this.playerWins}  –  ${this.frankWins} Frank`, {
      fontSize: '28px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 + 30, `Total mashes: ${this.mashCount}`, {
      fontSize: '15px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151);

    // Festivus quote
    const quote = playerWon
      ? '"Many Festivus miracles tonight!"'
      : '"You\'ll be wrestling until you pin me, Jerry!"';
    this.add.text(width / 2, height / 2 + 62, quote, {
      fontSize: '13px',
      fontFamily: 'Georgia, serif',
      color: '#888866',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(151);

    // Retry button
    const retryBtn = this.add.text(width / 2, height / 2 + 105, '[ PLAY AGAIN ]', {
      fontSize: '20px', fontFamily: 'Courier New', color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerover', () => retryBtn.setColor('#ffcc00'));
    retryBtn.on('pointerout', () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    // Menu button
    const menuBtn = this.add.text(width / 2, height / 2 + 140, '[ BACK TO MENU ]', {
      fontSize: '16px', fontFamily: 'Courier New', color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  addBackButton() {
    const btn = this.add.text(20, 575, '← Back to Menu', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#888888',
    }).setInteractive({ useHandCursor: true }).setDepth(50);

    btn.on('pointerover', () => btn.setColor('#e94560'));
    btn.on('pointerout', () => btn.setColor('#888888'));
    btn.on('pointerdown', () => {
      this.isPlaying = false;
      if (this.timerEvent) this.timerEvent.remove();
      this.input.off('pointerdown', this._onPlayerMash, this);
      this.input.keyboard.off('keydown-SPACE', this._onPlayerMash, this);
      this.scene.start('MenuScene');
    });
  }
}
