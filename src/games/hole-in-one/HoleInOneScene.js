import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * Hole in One - A golf/whale targeting mini-game
 *
 * Inspired by the episode where Kramer hits a golf ball into the ocean
 * and it lands in a whale's blowhole. Shoot golf balls at a moving whale!
 */
export class HoleInOneScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HoleInOneScene' });
  }

  init() {
    this.score = 0;
    this.isPlaying = true;
    this.whaleSpeed = 120;
    this.whaleDirection = 1;
    this.ballInFlight = false;
    this.missMessages = [
      'Oops! Try again!',
      'Not even close!',
      'The sea was angry that day, my friends!',
      'Swing and a miss!',
      'That ball is gone forever!',
    ];
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    // --- Sky gradient (background) ---
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x87ceeb, 0x87ceeb, 0x4a90d9, 0x4a90d9, 1);
    sky.fillRect(0, 0, width, 320);

    // Sun
    this.add.circle(680, 60, 35, 0xffdd44);
    this.add.circle(680, 60, 30, 0xffee88);

    // Clouds
    this.drawCloud(150, 50);
    this.drawCloud(450, 80);
    this.drawCloud(620, 30);

    // --- Ocean ---
    const ocean = this.add.graphics();
    ocean.fillStyle(0x1a6eb5, 1);
    ocean.fillRect(0, 320, width, 180);

    // Wave lines
    const waves = this.add.graphics();
    waves.lineStyle(2, 0x2488d4, 0.5);
    for (let row = 0; row < 4; row++) {
      const wy = 340 + row * 40;
      waves.beginPath();
      for (let x = 0; x <= width; x += 5) {
        const y = wy + Math.sin((x + row * 50) * 0.03) * 8;
        if (x === 0) waves.moveTo(x, y);
        else waves.lineTo(x, y);
      }
      waves.strokePath();
    }

    // --- Beach / Sand ---
    const beach = this.add.graphics();
    beach.fillStyle(0xf4d58d, 1);
    beach.fillRect(0, 500, width, 100);
    // Sand texture dots
    beach.fillStyle(0xe8c86a, 1);
    for (let i = 0; i < 40; i++) {
      beach.fillCircle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(505, 595),
        Phaser.Math.Between(1, 3)
      );
    }

    // --- Title & Score ---
    this.add.text(width / 2, 15, 'HOLE IN ONE', {
      fontSize: '28px',
      fontFamily: 'Courier New',
      color: '#1a1a2e',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.scoreText = this.add.text(width / 2, 45, 'Score: 0', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#1a1a2e',
    }).setOrigin(0.5).setDepth(10);

    // --- Whale (drawn with graphics, added to physics) ---
    this.whaleContainer = this.add.container(400, 380);
    this.drawWhale(this.whaleContainer);
    this.physics.world.enable(this.whaleContainer);
    this.whaleContainer.body.setSize(90, 40);
    this.whaleContainer.body.setOffset(-45, -20);
    this.whaleContainer.setDepth(5);

    // Start whale moving
    this.whaleContainer.body.setVelocityX(this.whaleSpeed * this.whaleDirection);

    // Whale bob animation
    this.tweens.add({
      targets: this.whaleContainer,
      y: 385,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // --- Kramer (cartoonish character on the beach) ---
    this.kramerContainer = this.add.container(width / 2, 520);
    this.drawKramer(this.kramerContainer);
    this.kramerContainer.setDepth(6);

    // --- Golf ball (physics object) ---
    this.ball = this.add.circle(0, 0, 5, 0xffffff);
    this.ball.setStrokeStyle(1, 0xcccccc);
    this.physics.world.enable(this.ball);
    this.ball.body.setCircle(5);
    this.ball.setVisible(false);
    this.ball.setDepth(7);

    // --- Bullseye cursor ---
    this.bullseye = this.add.graphics();
    this.bullseye.setDepth(15);
    this.drawBullseye(this.bullseye);
    this.bullseye.setPosition(width / 2, 380);

    // --- Aim line (from Kramer to bullseye) ---
    this.aimLine = this.add.graphics();
    this.aimLine.setDepth(6);

    // Track mouse position
    this.input.on('pointermove', (pointer) => {
      this.bullseye.setPosition(pointer.x, pointer.y);
    });

    // --- Power bar (centered under Kramer) ---
    this.powerBarBg = this.add.rectangle(width / 2, 590, 80, 10, 0x333333).setDepth(10);
    this.powerBarFill = this.add.rectangle(width / 2 - 39, 590, 0, 8, 0xe94560).setOrigin(0, 0.5).setDepth(10);
    this.powerCharging = false;
    this.powerLevel = 0;
    this.powerDirection = 1;

    this.add.text(width / 2, 575, 'POWER', {
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: '#1a1a2e',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // --- Instructions ---
    this.instructionText = this.add.text(width / 2, 295, 'Aim with mouse. Click & hold to charge, release to shoot!', {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      backgroundColor: '#1a1a2eaa',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(10);

    // --- Flash message text ---
    this.flashText = this.add.text(width / 2, 250, '', {
      fontSize: '32px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // --- Input handling ---
    this.input.on('pointerdown', () => {
      if (!this.isPlaying || this.ballInFlight) return;
      this.powerCharging = true;
      this.powerLevel = 0;
    });

    this.input.on('pointerup', () => {
      if (!this.isPlaying || !this.powerCharging) return;
      this.powerCharging = false;
      this.shootBall();
    });

    // --- Overlap detection ---
    this.physics.add.overlap(this.ball, this.whaleContainer, this.onHitWhale, null, this);

    this.addBackButton();
  }

  update(time, delta) {
    if (!this.isPlaying) return;

    const { width } = this.scale;

    // --- Whale movement: bounce off edges ---
    const whale = this.whaleContainer;
    if (whale.x < 80) {
      whale.x = 80;
      this.whaleDirection = 1;
      whale.body.setVelocityX(this.whaleSpeed);
    } else if (whale.x > width - 80) {
      whale.x = width - 80;
      this.whaleDirection = -1;
      whale.body.setVelocityX(-this.whaleSpeed);
    }

    // --- Power bar charging ---
    if (this.powerCharging) {
      this.powerLevel += this.powerDirection * delta * 0.15;
      if (this.powerLevel >= 100) {
        this.powerLevel = 100;
        this.powerDirection = -1;
      } else if (this.powerLevel <= 0) {
        this.powerLevel = 0;
        this.powerDirection = 1;
      }
      this.powerBarFill.width = (this.powerLevel / 100) * 78;
    }

    // --- Update aim line (dashed line from Kramer to bullseye) ---
    this.aimLine.clear();
    this.bullseye.setVisible(!this.ballInFlight);
    if (!this.ballInFlight) {
      const startX = width / 2;
      const startY = 490;
      const targetX = this.bullseye.x;
      const targetY = this.bullseye.y;
      const dx = targetX - startX;
      const dy = targetY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dashLen = 8;
      const gapLen = 6;
      const nx = dx / dist;
      const ny = dy / dist;

      this.aimLine.lineStyle(2, 0xffffff, 0.5);
      let d = 0;
      while (d < dist) {
        const segEnd = Math.min(d + dashLen, dist);
        this.aimLine.lineBetween(
          startX + nx * d, startY + ny * d,
          startX + nx * segEnd, startY + ny * segEnd
        );
        d = segEnd + gapLen;
      }
    }

    // --- Ball out of bounds ---
    if (this.ballInFlight) {
      if (this.ball.y < -20 || this.ball.x > width + 20 || this.ball.x < -20 || this.ball.y > 600) {
        this.onMiss();
      }
    }
  }

  shootBall() {
    const { width } = this.scale;
    const power = Math.max(this.powerLevel, 15);
    const speed = 300 + power * 5;

    const startX = width / 2;
    const startY = 490;
    const dx = this.bullseye.x - startX;
    const dy = this.bullseye.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    this.ball.setPosition(startX, startY);
    this.ball.setVisible(true);
    this.ball.body.enable = true;
    this.ball.body.setVelocity(
      (dx / dist) * speed,
      (dy / dist) * speed
    );
    this.ball.body.setGravityY(200);

    this.ballInFlight = true;
    this.powerLevel = 0;
    this.powerDirection = 1;
    this.powerBarFill.width = 0;

    // Hide instructions after first shot
    if (this.instructionText.visible) {
      this.instructionText.setVisible(false);
    }
  }

  onHitWhale() {
    if (!this.ballInFlight) return;

    this.ballInFlight = false;
    this.ball.setVisible(false);
    this.ball.body.enable = false;
    this.ball.body.setVelocity(0, 0);

    this.score += 1;
    this.scoreText.setText('Score: ' + this.score);

    // Speed up the whale
    this.whaleSpeed += 30;
    this.whaleContainer.body.setVelocityX(this.whaleSpeed * this.whaleDirection);

    this.showFlash('A hole in one!', '#ffdd44');
  }

  onMiss() {
    this.ballInFlight = false;
    this.ball.setVisible(false);
    this.ball.body.enable = false;
    this.ball.body.setVelocity(0, 0);

    const msg = Phaser.Utils.Array.GetRandom(this.missMessages);
    this.showFlash(msg, '#e94560');
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
          delay: 600,
          onComplete: () => {
            this.flashText.setVisible(false);
          },
        });
      },
    });
  }

  drawWhale(container) {
    const g = this.add.graphics();

    // Body
    g.fillStyle(0x4a6fa5, 1);
    g.fillEllipse(0, 0, 90, 35);

    // Belly (lighter)
    g.fillStyle(0x7ba3cc, 1);
    g.fillEllipse(0, 6, 70, 15);

    // Tail
    g.fillStyle(0x4a6fa5, 1);
    g.fillTriangle(-45, -5, -60, -20, -55, 10);
    g.fillTriangle(-45, -5, -70, -15, -60, -20);

    // Blowhole spout
    g.lineStyle(2, 0x87ceeb, 0.8);
    g.beginPath();
    g.moveTo(10, -18);
    g.lineTo(5, -30);
    g.moveTo(10, -18);
    g.lineTo(15, -30);
    g.moveTo(10, -18);
    g.lineTo(10, -32);
    g.strokePath();

    // Eye
    g.fillStyle(0xffffff, 1);
    g.fillCircle(25, -4, 6);
    g.fillStyle(0x111111, 1);
    g.fillCircle(27, -4, 3);

    // Mouth (smile)
    g.lineStyle(2, 0x2a4a7a, 1);
    g.beginPath();
    g.arc(30, 4, 10, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(60));
    g.strokePath();

    container.add(g);
  }

  drawKramer(container) {
    const g = this.add.graphics();

    // --- Shoes ---
    g.fillStyle(0x222222, 1);
    g.fillRoundedRect(-16, 28, 14, 7, 3);
    g.fillRoundedRect(4, 28, 14, 7, 3);

    // --- Legs (blue jeans) ---
    g.fillStyle(0x2a3a6e, 1);
    // Left leg
    g.beginPath();
    g.moveTo(-12, 10);
    g.lineTo(-8, 10);
    g.lineTo(-4, 30);
    g.lineTo(-16, 30);
    g.closePath();
    g.fillPath();
    // Right leg
    g.beginPath();
    g.moveTo(8, 10);
    g.lineTo(12, 10);
    g.lineTo(16, 30);
    g.lineTo(4, 30);
    g.closePath();
    g.fillPath();

    // --- Torso (vintage bowling shirt - cream with red piping) ---
    g.fillStyle(0xf5e6c8, 1);
    g.beginPath();
    g.moveTo(-14, -22);
    g.lineTo(14, -22);
    g.lineTo(12, 12);
    g.lineTo(-12, 12);
    g.closePath();
    g.fillPath();
    // Shirt collar / V-neck
    g.lineStyle(2, 0xcc3333, 1);
    g.lineBetween(0, -22, -5, -14);
    g.lineBetween(0, -22, 5, -14);
    // Shirt side stripes
    g.lineStyle(1.5, 0xcc3333, 0.6);
    g.lineBetween(-13, -20, -11, 10);
    g.lineBetween(13, -20, 11, 10);
    // Belt
    g.fillStyle(0x3a2518, 1);
    g.fillRect(-12, 8, 24, 4);
    g.fillStyle(0xccaa44, 1);
    g.fillRect(-2, 8, 4, 4);

    // --- Left arm (relaxed at side) ---
    g.fillStyle(0xf5e6c8, 1);
    g.beginPath();
    g.moveTo(-14, -20);
    g.lineTo(-18, -20);
    g.lineTo(-22, 0);
    g.lineTo(-18, 0);
    g.closePath();
    g.fillPath();
    // Left hand
    g.fillStyle(0xf2c89d, 1);
    g.fillCircle(-20, 2, 4);

    // --- Right arm (raised, holding golf club) ---
    g.fillStyle(0xf5e6c8, 1);
    g.beginPath();
    g.moveTo(14, -20);
    g.lineTo(18, -20);
    g.lineTo(24, -35);
    g.lineTo(20, -36);
    g.closePath();
    g.fillPath();
    // Right hand gripping club
    g.fillStyle(0xf2c89d, 1);
    g.fillCircle(22, -36, 4);

    // --- Golf club (held in right hand, angled up-right) ---
    g.lineStyle(3, 0x777777, 1);
    g.lineBetween(22, -36, 32, -58);
    // Club head
    g.fillStyle(0x999999, 1);
    g.beginPath();
    g.moveTo(32, -58);
    g.lineTo(38, -56);
    g.lineTo(36, -52);
    g.lineTo(30, -54);
    g.closePath();
    g.fillPath();

    // --- Neck ---
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-4, -28, 8, 7);

    // --- Head ---
    g.fillStyle(0xf2c89d, 1);
    g.fillEllipse(0, -40, 22, 26);

    // --- Kramer's iconic wild hair ---
    g.fillStyle(0x3a2010, 1);
    // Main hair mass on top
    g.fillEllipse(0, -54, 26, 12);
    // Left side poof
    g.fillEllipse(-13, -46, 10, 14);
    // Right side poof
    g.fillEllipse(13, -46, 10, 14);
    // Extra wild strands
    g.lineStyle(3, 0x3a2010, 1);
    g.beginPath();
    g.moveTo(-8, -56);
    g.lineTo(-14, -66);
    g.moveTo(-3, -58);
    g.lineTo(-6, -68);
    g.moveTo(3, -58);
    g.lineTo(2, -69);
    g.moveTo(8, -56);
    g.lineTo(12, -66);
    g.moveTo(12, -53);
    g.lineTo(18, -60);
    g.moveTo(-12, -53);
    g.lineTo(-19, -60);
    g.strokePath();

    // --- Face ---
    // Eyebrows (expressive, raised)
    g.lineStyle(2, 0x3a2010, 1);
    g.beginPath();
    g.moveTo(-7, -46);
    g.lineTo(-3, -48);
    g.moveTo(3, -48);
    g.lineTo(7, -46);
    g.strokePath();

    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-5, -43, 7, 6);
    g.fillEllipse(5, -43, 7, 6);
    g.fillStyle(0x332211, 1);
    g.fillCircle(-4, -43, 2);
    g.fillCircle(6, -43, 2);

    // Nose (Kramer's prominent nose)
    g.lineStyle(2, 0xd4a574, 1);
    g.beginPath();
    g.moveTo(0, -43);
    g.lineTo(2, -36);
    g.lineTo(-1, -35);
    g.strokePath();

    // Mouth (goofy grin)
    g.lineStyle(2, 0x994444, 1);
    g.beginPath();
    g.arc(0, -33, 6, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170));
    g.strokePath();

    // --- Label ---
    const label = this.add.text(0, 42, 'KRAMER', {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#1a1a2e',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add(g);
    container.add(label);
  }

  drawBullseye(g) {
    // Outer ring
    g.lineStyle(2, 0xe94560, 0.9);
    g.strokeCircle(0, 0, 14);
    // Middle ring
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeCircle(0, 0, 9);
    // Inner ring
    g.lineStyle(2, 0xe94560, 0.9);
    g.strokeCircle(0, 0, 4);
    // Crosshair lines
    g.lineStyle(1, 0xffffff, 0.6);
    g.lineBetween(-18, 0, -15, 0);
    g.lineBetween(15, 0, 18, 0);
    g.lineBetween(0, -18, 0, -15);
    g.lineBetween(0, 15, 0, 18);
  }

  drawCloud(x, y) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(x, y, 20);
    g.fillCircle(x + 20, y - 5, 15);
    g.fillCircle(x + 15, y + 8, 12);
    g.fillCircle(x - 15, y + 5, 14);
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
