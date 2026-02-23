import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

const COMBOS = [
  { modifier: 'SHIFT', arrow: 'LEFT', label: 'Shift + ←' },
  { modifier: 'SHIFT', arrow: 'RIGHT', label: 'Shift + →' },
  { modifier: 'SHIFT', arrow: 'UP', label: 'Shift + ↑' },
  { modifier: 'SHIFT', arrow: 'DOWN', label: 'Shift + ↓' },
  { modifier: 'CTRL', arrow: 'LEFT', label: 'Ctrl + ←' },
  { modifier: 'CTRL', arrow: 'RIGHT', label: 'Ctrl + →' },
  { modifier: 'CTRL', arrow: 'UP', label: 'Ctrl + ↑' },
  { modifier: 'CTRL', arrow: 'DOWN', label: 'Ctrl + ↓' },
];

const DANCE_MOVES = [
  'kickLeft', 'kickLeft', 'kickRight', 'kickRight',
  'thumbsHike', 'thumbsHike', 'headJerk', 'headJerk',
  'doubleKick', 'fullSpin',
];
const HIT_MESSAGES = ["Nice!", "Fabulous!", "That's gold!", "Giddyup!", "Spectacular!"];
const MISS_MESSAGES = ["Yikes!", "Oh no!", "The little kicks!", "Sweet fancy Moses!"];

export class LittleKicksScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LittleKicksScene' });
  }

  init() {
    this.score = 0;
    this.combo = 0;
    this.misses = 0;
    this.maxMisses = 3;
    this.level = 1;
    this.promptIndex = 0;
    this.currentCombo = null;
    this.secondCombo = null;
    this.waitingForSecond = false;
    this.timerMax = 2500;
    this.timerRemaining = 0;
    this.isPlaying = false;
    this.gameOver = false;
    this.elainePose = 'idle';
    this.poseTimer = 0;
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    this.drawDanceFloor(width, height);
    this.drawDiscoLights(width);

    // Title
    this.add.text(width / 2, 18, 'THE LITTLE KICKS', {
      fontSize: '24px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // Score & combo (top left)
    this.scoreText = this.add.text(20, 50, 'Score: 0', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setDepth(10);

    this.comboText = this.add.text(20, 72, 'Combo: 0', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setDepth(10);

    // Lives (top right)
    this.livesText = this.add.text(width - 20, 50, '♥ ♥ ♥', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#e94560',
    }).setOrigin(1, 0).setDepth(10);

    this.levelText = this.add.text(width - 20, 72, 'Level: 1', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#aaaaaa',
    }).setOrigin(1, 0).setDepth(10);

    // Prompt area (top center)
    this.promptBg = this.add.rectangle(width / 2, 110, 300, 50, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0xe94560).setDepth(10);
    this.promptText = this.add.text(width / 2, 110, '', {
      fontSize: '28px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // Timer bar
    this.timerBarBg = this.add.rectangle(width / 2, 142, 296, 8, 0x333333).setDepth(10);
    this.timerBarFill = this.add.rectangle(width / 2 - 148, 142, 296, 6, 0xe94560)
      .setOrigin(0, 0.5).setDepth(10);

    // Draw characters
    this.elaineContainer = this.add.container(width / 2 - 40, 380);
    this.drawElaine(this.elaineContainer, 'idle');
    this.elaineContainer.setDepth(5);

    this.georgeContainer = this.add.container(width - 140, 400);
    this.drawGeorge(this.georgeContainer);
    this.georgeContainer.setDepth(5);

    // George speech bubble (hidden initially)
    this.speechBubble = this.add.container(width - 140, 300);
    this.speechBubble.setDepth(15);
    this.speechBubble.setAlpha(0);
    this.speechBubble.setScale(0);

    const bubbleG = this.add.graphics();
    bubbleG.fillStyle(0xffffff, 0.95);
    bubbleG.fillRoundedRect(-90, -30, 180, 50, 10);
    bubbleG.fillTriangle(10, 20, 20, 40, 30, 20);
    this.speechBubble.add(bubbleG);

    const speechText = this.add.text(0, -5, 'Sweet fancy\n   Moses!', {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#1a1a2e',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.speechBubble.add(speechText);

    // Flash text
    this.flashText = this.add.text(width / 2, 250, '', {
      fontSize: '32px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Instructions
    this.instructionText = this.add.text(width / 2, 200, 'Press the key combo shown above!\n3 misses and it\'s over!', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      backgroundColor: '#1a1a2ecc',
      padding: { x: 10, y: 6 },
      align: 'center',
    }).setOrigin(0.5).setDepth(10);

    // Input keys
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown', (event) => this.handleKeyInput(event));

    this.addBackButton();

    // Start game after brief delay
    this.time.delayedCall(1500, () => {
      if (this.instructionText) this.instructionText.setVisible(false);
      this.isPlaying = true;
      this.nextPrompt();
    });
  }

  update(time, delta) {
    if (!this.isPlaying || this.gameOver) return;

    // Update timer
    if (this.currentCombo) {
      this.timerRemaining -= delta;
      const pct = Math.max(0, this.timerRemaining / this.timerMax);
      this.timerBarFill.width = 296 * pct;

      // Color changes as time runs out
      if (pct > 0.5) {
        this.timerBarFill.setFillStyle(0x44cc44);
      } else if (pct > 0.25) {
        this.timerBarFill.setFillStyle(0xffcc00);
      } else {
        this.timerBarFill.setFillStyle(0xe94560);
      }

      if (this.timerRemaining <= 0) {
        this.onMiss();
      }
    }

    // Pose timer - return to idle after animation
    if (this.poseTimer > 0) {
      this.poseTimer -= delta;
      if (this.poseTimer <= 0) {
        this.redrawElaine('idle');
      }
    }
  }

  getTimeWindow() {
    // Levels 1-5: 2500ms, then decreases, minimum 800ms
    if (this.level <= 5) return 2500;
    const reduced = 2500 - (this.level - 5) * 200;
    return Math.max(800, reduced);
  }

  nextPrompt() {
    if (this.gameOver) return;

    this.level = Math.floor(this.promptIndex / 3) + 1;
    this.levelText.setText('Level: ' + this.level);
    this.timerMax = this.getTimeWindow();

    // Pick a random combo
    this.currentCombo = Phaser.Utils.Array.GetRandom(COMBOS);
    this.waitingForSecond = false;
    this.secondCombo = null;

    // Level 11+: double combos
    if (this.level >= 11) {
      this.secondCombo = Phaser.Utils.Array.GetRandom(COMBOS);
      this.promptText.setText(this.currentCombo.label + '  then  ' + this.secondCombo.label);
      this.promptText.setFontSize(20);
    } else {
      this.promptText.setText(this.currentCombo.label);
      this.promptText.setFontSize(28);
    }

    this.timerRemaining = this.timerMax;
    this.promptIndex++;

    // Pulse animation on prompt
    this.tweens.add({
      targets: this.promptBg,
      scaleX: 1.05,
      scaleY: 1.1,
      duration: 100,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  handleKeyInput(event) {
    if (!this.isPlaying || this.gameOver || !this.currentCombo) return;

    const combo = this.waitingForSecond ? this.secondCombo : this.currentCombo;
    if (!combo) return;

    // Check if an arrow key was pressed
    const arrowMap = {
      ArrowLeft: 'LEFT',
      ArrowRight: 'RIGHT',
      ArrowUp: 'UP',
      ArrowDown: 'DOWN',
    };

    const arrow = arrowMap[event.key];
    if (!arrow) return; // Not an arrow key, ignore

    // Prevent default browser behavior for arrow keys
    event.preventDefault();

    // Check modifier
    const needShift = combo.modifier === 'SHIFT';
    const needCtrl = combo.modifier === 'CTRL';

    const modMatch = (needShift && event.shiftKey) || (needCtrl && (event.ctrlKey || event.metaKey));
    const arrowMatch = arrow === combo.arrow;

    if (modMatch && arrowMatch) {
      // Correct!
      if (this.secondCombo && !this.waitingForSecond) {
        // First of double combo done, wait for second
        this.waitingForSecond = true;
        this.promptText.setText('✓  now  ' + this.secondCombo.label);
        this.promptText.setColor('#44cc44');
        this.time.delayedCall(100, () => this.promptText.setColor('#ffffff'));
        return;
      }
      this.onHit();
    } else {
      // Wrong combo
      this.onMiss();
    }
  }

  onHit() {
    this.combo++;
    const points = 100 * Math.max(1, this.combo);
    this.score += points;
    this.scoreText.setText('Score: ' + this.score);
    this.comboText.setText('Combo: ' + this.combo);

    // Dance animation
    const move = Phaser.Utils.Array.GetRandom(DANCE_MOVES);
    this.redrawElaine(move);
    this.poseTimer = 600;

    // Flash message
    const msg = Phaser.Utils.Array.GetRandom(HIT_MESSAGES);
    this.showFlash(msg, '#44cc44');

    // George's reaction at every 5 combo
    if (this.combo > 0 && this.combo % 5 === 0) {
      this.showGeorgeSpeech();
    }

    this.currentCombo = null;
    this.time.delayedCall(400, () => this.nextPrompt());
  }

  onMiss() {
    this.misses++;
    this.combo = 0;
    this.comboText.setText('Combo: 0');

    // Update lives display
    const hearts = [];
    for (let i = 0; i < this.maxMisses; i++) {
      hearts.push(i < this.maxMisses - this.misses ? '♥' : '♡');
    }
    this.livesText.setText(hearts.join(' '));

    // Stumble animation
    this.redrawElaine('stumble');
    this.poseTimer = 600;

    const msg = Phaser.Utils.Array.GetRandom(MISS_MESSAGES);
    this.showFlash(msg, '#e94560');

    this.currentCombo = null;

    if (this.misses >= this.maxMisses) {
      this.endGame();
      return;
    }

    this.time.delayedCall(600, () => this.nextPrompt());
  }

  endGame() {
    this.gameOver = true;
    this.isPlaying = false;

    const { width, height } = this.scale;

    // Darken overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setDepth(25);

    this.add.text(width / 2, height / 2 - 60, 'GAME OVER', {
      fontSize: '42px',
      fontFamily: 'Courier New',
      color: '#e94560',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);

    this.add.text(width / 2, height / 2, 'Final Score: ' + this.score, {
      fontSize: '24px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(30);

    this.add.text(width / 2, height / 2 + 30, 'Level Reached: ' + this.level, {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(30);

    const restartBtn = this.add.text(width / 2, height / 2 + 80, '[ Play Again ]', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerover', () => restartBtn.setColor('#ffffff'));
    restartBtn.on('pointerout', () => restartBtn.setColor('#ffcc00'));
    restartBtn.on('pointerdown', () => this.scene.restart());

    const menuBtn = this.add.text(width / 2, height / 2 + 115, '← Back to Menu', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#ffdd44'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#ffffff'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  showGeorgeSpeech() {
    this.tweens.killTweensOf(this.speechBubble);
    this.speechBubble.setAlpha(0).setScale(0);
    this.tweens.add({
      targets: this.speechBubble,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.speechBubble,
          alpha: 0,
          duration: 500,
          delay: 2000,
        });
      },
    });
  }

  showFlash(message, color) {
    this.flashText.setText(message);
    this.flashText.setColor(color);
    this.flashText.setVisible(true);
    this.flashText.setAlpha(1);
    this.flashText.setScale(0.5);

    this.tweens.add({
      targets: this.flashText,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.flashText,
          alpha: 0,
          duration: 800,
          delay: 400,
          onComplete: () => {
            this.flashText.setVisible(false);
          },
        });
      },
    });
  }

  // --- Drawing methods ---

  drawDanceFloor(width, height) {
    const g = this.add.graphics();

    // Dark background
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(0, 0, width, height);

    // Tiled dance floor (bottom half)
    const tileSize = 40;
    const floorY = 300;
    for (let y = floorY; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isAlt = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        g.fillStyle(isAlt ? 0x2a2a4e : 0x222244, 1);
        g.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Stage area (lighter strip)
    g.fillStyle(0x333366, 0.3);
    g.fillRect(0, 280, width, 30);
  }

  drawDiscoLights(width) {
    const colors = [0xe94560, 0x44cc44, 0x4488ff, 0xffcc00, 0xff66cc];
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 160;
      const light = this.add.graphics();
      light.fillStyle(colors[i], 0.15);
      light.fillTriangle(x, 0, x - 60, 280, x + 60, 280);
      light.setDepth(1);

      // Gentle sway
      this.tweens.add({
        targets: light,
        x: Phaser.Math.Between(-20, 20),
        duration: 2000 + i * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  redrawElaine(pose) {
    this.elaineContainer.removeAll(true);
    this.drawElaine(this.elaineContainer, pose);
  }

  drawElaine(container, pose) {
    const g = this.add.graphics();

    // Head jerk offset — Elaine's signature head snap to one side
    const headTilt = pose === 'headJerk' ? -8
      : pose === 'stumble' ? 3
      : pose === 'kickLeft' ? -3
      : pose === 'kickRight' ? 3
      : 0;

    // Body lean for kicks
    const bodyLean = pose === 'kickLeft' ? 3
      : pose === 'kickRight' ? -3
      : pose === 'doubleKick' ? -2
      : pose === 'stumble' ? 4
      : 0;

    // --- Shoes ---
    g.fillStyle(0x222222, 1);
    if (pose === 'kickLeft') {
      // Left foot way out to the side — the classic little kick
      g.fillRoundedRect(-38, 18, 14, 7, 3);
      g.fillRoundedRect(2 + bodyLean, 28, 14, 7, 3);
    } else if (pose === 'kickRight') {
      g.fillRoundedRect(-16 + bodyLean, 28, 14, 7, 3);
      g.fillRoundedRect(30, 16, 14, 7, 3);
    } else if (pose === 'doubleKick') {
      // Both feet off the ground, kicked forward
      g.fillRoundedRect(-30, 14, 14, 7, 3);
      g.fillRoundedRect(18, 14, 14, 7, 3);
    } else if (pose === 'stumble') {
      g.fillRoundedRect(-20, 32, 14, 7, 3);
      g.fillRoundedRect(8, 30, 14, 7, 3);
    } else {
      g.fillRoundedRect(-16, 28, 14, 7, 3);
      g.fillRoundedRect(4, 28, 14, 7, 3);
    }

    // --- Legs ---
    g.fillStyle(0x2a2a6e, 1);
    if (pose === 'kickLeft') {
      // Left leg shoots out sideways — exaggerated little kick
      g.beginPath();
      g.moveTo(-8 + bodyLean, 10);
      g.lineTo(-4 + bodyLean, 10);
      g.lineTo(-30, 20);
      g.lineTo(-36, 16);
      g.closePath();
      g.fillPath();
      // Right leg planted, slightly bent
      g.beginPath();
      g.moveTo(4 + bodyLean, 10);
      g.lineTo(8 + bodyLean, 10);
      g.lineTo(12 + bodyLean, 30);
      g.lineTo(4 + bodyLean, 30);
      g.closePath();
      g.fillPath();
    } else if (pose === 'kickRight') {
      // Left leg planted
      g.beginPath();
      g.moveTo(-8 + bodyLean, 10);
      g.lineTo(-4 + bodyLean, 10);
      g.lineTo(-4 + bodyLean, 30);
      g.lineTo(-12 + bodyLean, 30);
      g.closePath();
      g.fillPath();
      // Right leg shoots out sideways
      g.beginPath();
      g.moveTo(4 + bodyLean, 10);
      g.lineTo(8 + bodyLean, 10);
      g.lineTo(32, 18);
      g.lineTo(28, 24);
      g.closePath();
      g.fillPath();
    } else if (pose === 'doubleKick') {
      // Both legs kicked forward and out — the big finale kick
      g.beginPath();
      g.moveTo(-6, 10);
      g.lineTo(-2, 10);
      g.lineTo(-22, 16);
      g.lineTo(-28, 12);
      g.closePath();
      g.fillPath();
      g.beginPath();
      g.moveTo(2, 10);
      g.lineTo(6, 10);
      g.lineTo(24, 16);
      g.lineTo(20, 12);
      g.closePath();
      g.fillPath();
    } else if (pose === 'stumble') {
      g.beginPath();
      g.moveTo(-10, 10);
      g.lineTo(-6, 10);
      g.lineTo(-16, 34);
      g.lineTo(-20, 30);
      g.closePath();
      g.fillPath();
      g.beginPath();
      g.moveTo(6, 10);
      g.lineTo(10, 10);
      g.lineTo(18, 32);
      g.lineTo(12, 34);
      g.closePath();
      g.fillPath();
    } else {
      // Idle / headJerk / thumbsHike / fullSpin — normal stance
      g.beginPath();
      g.moveTo(-8, 10);
      g.lineTo(-4, 10);
      g.lineTo(-4, 30);
      g.lineTo(-12, 30);
      g.closePath();
      g.fillPath();
      g.beginPath();
      g.moveTo(4, 10);
      g.lineTo(8, 10);
      g.lineTo(12, 30);
      g.lineTo(4, 30);
      g.closePath();
      g.fillPath();
    }

    // --- Dress (red) ---
    g.fillStyle(0xe94560, 1);
    g.beginPath();
    g.moveTo(-14 + bodyLean, -18);
    g.lineTo(14 + bodyLean, -18);
    g.lineTo(16, 14);
    g.lineTo(-16, 14);
    g.closePath();
    g.fillPath();

    // Belt
    g.fillStyle(0x111111, 1);
    g.fillRect(-14, -4, 28, 3);

    // --- Arms ---
    g.fillStyle(0xf2c89d, 1);
    if (pose === 'thumbsHike') {
      // Both thumbs hiked up at hip level — Elaine's signature move
      // Left arm: elbow out, fist at hip, thumb pointing up
      g.beginPath();
      g.moveTo(-14, -14);
      g.lineTo(-18, -14);
      g.lineTo(-28, -6);
      g.lineTo(-26, -2);
      g.closePath();
      g.fillPath();
      // Left fist
      g.fillStyle(0xf2c89d, 1);
      g.fillRoundedRect(-30, -8, 8, 8, 3);
      // Left thumb pointing up
      g.fillRect(-28, -16, 3, 10);

      // Right arm: mirror
      g.beginPath();
      g.moveTo(14, -14);
      g.lineTo(18, -14);
      g.lineTo(28, -6);
      g.lineTo(26, -2);
      g.closePath();
      g.fillPath();
      // Right fist
      g.fillRoundedRect(22, -8, 8, 8, 3);
      // Right thumb pointing up
      g.fillRect(25, -16, 3, 10);
    } else if (pose === 'kickLeft' || pose === 'kickRight') {
      // Arms flail opposite to the kick — jerky and awkward
      const kickDir = pose === 'kickLeft' ? 1 : -1;
      // Arm on kick side swings up
      g.beginPath();
      g.moveTo(-14 * kickDir + bodyLean, -16);
      g.lineTo(-18 * kickDir + bodyLean, -16);
      g.lineTo(-26 * kickDir, -38);
      g.lineTo(-22 * kickDir, -40);
      g.closePath();
      g.fillPath();
      g.fillCircle(-24 * kickDir, -40, 4);
      // Other arm swings down/back
      g.beginPath();
      g.moveTo(14 * kickDir + bodyLean, -16);
      g.lineTo(18 * kickDir + bodyLean, -16);
      g.lineTo(22 * kickDir, 2);
      g.lineTo(18 * kickDir, 4);
      g.closePath();
      g.fillPath();
      g.fillCircle(20 * kickDir, 4, 4);
    } else if (pose === 'headJerk') {
      // Arms stiff at sides, elbows out — robotic jerky pose
      g.beginPath();
      g.moveTo(-14, -16);
      g.lineTo(-18, -16);
      g.lineTo(-26, -8);
      g.lineTo(-22, -6);
      g.closePath();
      g.fillPath();
      // Forearm back in
      g.beginPath();
      g.moveTo(-26, -8);
      g.lineTo(-22, -6);
      g.lineTo(-18, 4);
      g.lineTo(-22, 4);
      g.closePath();
      g.fillPath();
      g.fillCircle(-20, 6, 4);

      g.beginPath();
      g.moveTo(14, -16);
      g.lineTo(18, -16);
      g.lineTo(26, -8);
      g.lineTo(22, -6);
      g.closePath();
      g.fillPath();
      g.beginPath();
      g.moveTo(26, -8);
      g.lineTo(22, -6);
      g.lineTo(18, 4);
      g.lineTo(22, 4);
      g.closePath();
      g.fillPath();
      g.fillCircle(20, 6, 4);
    } else if (pose === 'doubleKick') {
      // Both arms thrown up in the air — wild abandon
      g.beginPath();
      g.moveTo(-14, -16);
      g.lineTo(-18, -16);
      g.lineTo(-32, -42);
      g.lineTo(-28, -44);
      g.closePath();
      g.fillPath();
      g.fillCircle(-30, -44, 4);

      g.beginPath();
      g.moveTo(14, -16);
      g.lineTo(18, -16);
      g.lineTo(32, -42);
      g.lineTo(28, -44);
      g.closePath();
      g.fillPath();
      g.fillCircle(30, -44, 4);
    } else if (pose === 'fullSpin') {
      // Arms wide out for the spin
      g.beginPath();
      g.moveTo(-14, -16);
      g.lineTo(-18, -16);
      g.lineTo(-36, -10);
      g.lineTo(-35, -6);
      g.closePath();
      g.fillPath();
      g.fillCircle(-36, -8, 4);

      g.beginPath();
      g.moveTo(14, -16);
      g.lineTo(18, -16);
      g.lineTo(36, -10);
      g.lineTo(35, -6);
      g.closePath();
      g.fillPath();
      g.fillCircle(36, -8, 4);
    } else if (pose === 'stumble') {
      // Arms flailing asymmetrically
      g.beginPath();
      g.moveTo(-14, -16);
      g.lineTo(-18, -16);
      g.lineTo(-32, -28);
      g.lineTo(-28, -30);
      g.closePath();
      g.fillPath();
      g.fillCircle(-30, -30, 4);

      g.beginPath();
      g.moveTo(14, -16);
      g.lineTo(18, -16);
      g.lineTo(26, 0);
      g.lineTo(22, 2);
      g.closePath();
      g.fillPath();
      g.fillCircle(24, 2, 4);
    } else {
      // Idle — arms at sides
      g.beginPath();
      g.moveTo(-14, -16);
      g.lineTo(-18, -16);
      g.lineTo(-20, 0);
      g.lineTo(-16, 0);
      g.closePath();
      g.fillPath();
      g.fillCircle(-18, 2, 4);

      g.beginPath();
      g.moveTo(14, -16);
      g.lineTo(18, -16);
      g.lineTo(20, 0);
      g.lineTo(16, 0);
      g.closePath();
      g.fillPath();
      g.fillCircle(18, 2, 4);
    }

    // --- Neck ---
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-3 + bodyLean, -24, 6, 7);

    // --- Head ---
    g.fillStyle(0xf2c89d, 1);
    g.fillEllipse(headTilt + bodyLean, -36, 20, 22);

    // --- Elaine's curly dark hair ---
    const hx = headTilt + bodyLean;
    g.fillStyle(0x2a1508, 1);
    g.fillEllipse(hx, -48, 24, 12);
    g.fillEllipse(hx - 10, -42, 10, 14);
    g.fillEllipse(hx + 10, -42, 10, 14);
    // Curly strands — wilder on head jerk
    const hairBounce = pose === 'headJerk' ? 4 : pose === 'doubleKick' ? 3 : 0;
    g.lineStyle(3, 0x2a1508, 1);
    g.beginPath();
    g.moveTo(hx - 10, -48);
    g.lineTo(hx - 14 - hairBounce, -55 - hairBounce);
    g.moveTo(hx - 5, -50);
    g.lineTo(hx - 8, -57 - hairBounce);
    g.moveTo(hx + 5, -50);
    g.lineTo(hx + 8, -57 - hairBounce);
    g.moveTo(hx + 10, -48);
    g.lineTo(hx + 14 + hairBounce, -55 - hairBounce);
    // Side curls — bounce outward on jerky moves
    g.moveTo(hx - 12, -40);
    g.lineTo(hx - 16 - hairBounce, -36);
    g.lineTo(hx - 14 - hairBounce, -32);
    g.moveTo(hx + 12, -40);
    g.lineTo(hx + 16 + hairBounce, -36);
    g.lineTo(hx + 14 + hairBounce, -32);
    g.strokePath();

    // --- Face ---
    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(hx - 4, -38, 6, 5);
    g.fillEllipse(hx + 4, -38, 6, 5);
    g.fillStyle(0x332211, 1);
    // Pupils look in head-jerk direction
    const pupilShift = pose === 'headJerk' ? -1 : 0;
    g.fillCircle(hx - 3 + pupilShift, -38, 2);
    g.fillCircle(hx + 5 + pupilShift, -38, 2);

    // Eyebrows
    g.lineStyle(1.5, 0x2a1508, 1);
    if (pose === 'stumble') {
      g.beginPath();
      g.moveTo(hx - 7, -43);
      g.lineTo(hx - 2, -42);
      g.moveTo(hx + 2, -42);
      g.lineTo(hx + 7, -43);
      g.strokePath();
    } else if (pose === 'headJerk' || pose === 'doubleKick') {
      // Raised excited brows
      g.beginPath();
      g.moveTo(hx - 7, -44);
      g.lineTo(hx - 2, -46);
      g.moveTo(hx + 2, -46);
      g.lineTo(hx + 7, -44);
      g.strokePath();
    } else {
      g.beginPath();
      g.moveTo(hx - 7, -42);
      g.lineTo(hx - 2, -43);
      g.moveTo(hx + 2, -43);
      g.lineTo(hx + 7, -42);
      g.strokePath();
    }

    // Nose
    g.lineStyle(1.5, 0xd4a574, 1);
    g.beginPath();
    g.moveTo(hx, -38);
    g.lineTo(hx + 1, -33);
    g.strokePath();

    // Mouth
    g.lineStyle(2, 0xcc4444, 1);
    if (pose === 'stumble') {
      g.fillStyle(0xcc4444, 1);
      g.fillEllipse(hx, -29, 6, 5);
    } else if (pose === 'idle') {
      g.beginPath();
      g.arc(hx, -30, 4, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170));
      g.strokePath();
    } else if (pose === 'headJerk') {
      // Teeth-clenched grin — the awkward Elaine face
      g.beginPath();
      g.arc(hx, -29, 6, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(180));
      g.strokePath();
      g.fillStyle(0xffffff, 1);
      g.fillRect(hx - 5, -29, 10, 3);
      // Teeth lines
      g.lineStyle(1, 0xcccccc, 0.6);
      for (let tx = hx - 3; tx <= hx + 3; tx += 3) {
        g.lineBetween(tx, -29, tx, -26);
      }
    } else if (pose === 'thumbsHike') {
      // Confident grin
      g.beginPath();
      g.arc(hx, -29, 5, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(180));
      g.strokePath();
      g.fillStyle(0xffffff, 1);
      g.fillRect(hx - 4, -29, 8, 2);
    } else {
      // Big open-mouth smile for kicking/spinning
      g.beginPath();
      g.arc(hx, -29, 6, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(180));
      g.strokePath();
      g.fillStyle(0xffffff, 1);
      g.fillRect(hx - 4, -29, 8, 2);
    }

    // Label
    const label = this.add.text(0, 42, 'ELAINE', {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#e94560',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add(g);
    container.add(label);

    // Pose-specific tweens
    if (pose === 'fullSpin') {
      this.tweens.add({
        targets: container,
        angle: 360,
        duration: 500,
        onComplete: () => { container.angle = 0; },
      });
    } else if (pose === 'headJerk') {
      // Quick snap back and forth
      this.tweens.add({
        targets: container,
        x: container.x + 6,
        duration: 80,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    } else if (pose === 'thumbsHike') {
      // Little bounce up
      this.tweens.add({
        targets: container,
        y: container.y - 8,
        duration: 150,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    } else if (pose === 'doubleKick') {
      // Jump up!
      this.tweens.add({
        targets: container,
        y: container.y - 15,
        duration: 200,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
  }

  drawGeorge(container) {
    const g = this.add.graphics();
    const scale = 0.85;

    // --- Shoes ---
    g.fillStyle(0x222222, 1);
    g.fillRoundedRect(-12 * scale, 28 * scale, 12 * scale, 6 * scale, 2);
    g.fillRoundedRect(2 * scale, 28 * scale, 12 * scale, 6 * scale, 2);

    // --- Legs ---
    g.fillStyle(0x3a3a5e, 1);
    g.beginPath();
    g.moveTo(-8 * scale, 10 * scale);
    g.lineTo(-4 * scale, 10 * scale);
    g.lineTo(-2 * scale, 30 * scale);
    g.lineTo(-12 * scale, 30 * scale);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(4 * scale, 10 * scale);
    g.lineTo(8 * scale, 10 * scale);
    g.lineTo(12 * scale, 30 * scale);
    g.lineTo(2 * scale, 30 * scale);
    g.closePath();
    g.fillPath();

    // --- Torso (polo shirt) ---
    g.fillStyle(0x4488aa, 1);
    g.beginPath();
    g.moveTo(-12 * scale, -18 * scale);
    g.lineTo(12 * scale, -18 * scale);
    g.lineTo(10 * scale, 12 * scale);
    g.lineTo(-10 * scale, 12 * scale);
    g.closePath();
    g.fillPath();

    // Arms at sides (watching pose)
    g.fillStyle(0x4488aa, 1);
    g.beginPath();
    g.moveTo(-12 * scale, -16 * scale);
    g.lineTo(-16 * scale, -16 * scale);
    g.lineTo(-18 * scale, 2 * scale);
    g.lineTo(-14 * scale, 2 * scale);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xf2c89d, 1);
    g.fillCircle(-16 * scale, 4 * scale, 3 * scale);

    g.fillStyle(0x4488aa, 1);
    g.beginPath();
    g.moveTo(12 * scale, -16 * scale);
    g.lineTo(16 * scale, -16 * scale);
    g.lineTo(18 * scale, 2 * scale);
    g.lineTo(14 * scale, 2 * scale);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xf2c89d, 1);
    g.fillCircle(16 * scale, 4 * scale, 3 * scale);

    // --- Neck ---
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-3 * scale, -24 * scale, 6 * scale, 7 * scale);

    // --- Head (rounder for George) ---
    g.fillStyle(0xf2c89d, 1);
    g.fillEllipse(0, -36 * scale, 22 * scale, 22 * scale);

    // --- Bald head with side hair ---
    g.fillStyle(0x3a3020, 1);
    // Side tufts
    g.fillEllipse(-10 * scale, -36 * scale, 6 * scale, 10 * scale);
    g.fillEllipse(10 * scale, -36 * scale, 6 * scale, 10 * scale);
    // Back hair line
    g.lineStyle(2, 0x3a3020, 1);
    g.beginPath();
    g.arc(0, -36 * scale, 10 * scale, Phaser.Math.DegToRad(140), Phaser.Math.DegToRad(220));
    g.strokePath();

    // --- Glasses ---
    g.lineStyle(1.5, 0x333333, 1);
    g.strokeCircle(-4 * scale, -36 * scale, 5 * scale);
    g.strokeCircle(5 * scale, -36 * scale, 5 * scale);
    g.lineBetween(1 * scale, -36 * scale, 0, -36 * scale);
    g.lineBetween(-9 * scale, -36 * scale, -11 * scale, -38 * scale);
    g.lineBetween(10 * scale, -36 * scale, 12 * scale, -38 * scale);

    // --- Eyes (behind glasses) ---
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-4 * scale, -36 * scale, 3.5 * scale);
    g.fillCircle(5 * scale, -36 * scale, 3.5 * scale);
    g.fillStyle(0x332211, 1);
    g.fillCircle(-3 * scale, -36 * scale, 1.5 * scale);
    g.fillCircle(6 * scale, -36 * scale, 1.5 * scale);

    // --- Nose ---
    g.lineStyle(1.5, 0xd4a574, 1);
    g.beginPath();
    g.moveTo(0, -36 * scale);
    g.lineTo(1 * scale, -31 * scale);
    g.strokePath();

    // --- Mouth (concerned watching expression) ---
    g.lineStyle(1.5, 0x994444, 1);
    g.beginPath();
    g.moveTo(-4 * scale, -28 * scale);
    g.lineTo(4 * scale, -28 * scale);
    g.strokePath();

    // Label
    const label = this.add.text(0, 38 * scale, 'GEORGE', {
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: '#4488aa',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add(g);
    container.add(label);
  }

  addBackButton() {
    const btn = this.add.text(20, 560, '← Back to Menu', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setInteractive({ useHandCursor: true }).setDepth(10);

    btn.on('pointerover', () => btn.setColor('#ffdd44'));
    btn.on('pointerout', () => btn.setColor('#ffffff'));
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
