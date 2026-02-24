import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * Oil Bladder — Kramer's rooftop targeting game
 *
 * Inspired by Kramer's oil bladder system. He's on the roof testing it
 * by trying to drop the bladder onto the girlfriend walking below.
 * Click (or press SPACE) to release the bladder and try to hit her!
 */
export class OilBladderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'OilBladderScene' });
  }

  init() {
    this.score = 0;
    this.isPlaying = true;
    this.bladderInFlight = false;
    this.girlfriendSpeed = 100;
    this.girlfriendDirection = 1;
    this.kramerSpeed = 80;
    this.missMessages = [
      'Oil everywhere but on her!',
      'The bladder system needs work!',
      "She's too fast for you!",
      'Not even close, Cosmo!',
    ];
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    // --- Sky background ---
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x87ceeb, 0x87ceeb, 0xc9e8f5, 0xc9e8f5, 1);
    sky.fillRect(0, 0, width, height - 110);

    // Sun
    this.add.circle(680, 55, 32, 0xffdd44);
    this.add.circle(680, 55, 27, 0xffee88);

    // Clouds
    this.drawCloud(120, 60);
    this.drawCloud(380, 40);

    // --- Background buildings (skyline) ---
    this.drawBackgroundBuildings(width, height);

    // --- Main building (the one Kramer is on) ---
    const buildingX = width / 2 - 70;
    const buildingW = 140;
    const buildingTop = 100;
    const buildingBottom = height - 110;
    this.buildingTop = buildingTop;
    this.buildingBottom = buildingBottom;
    this.kramerLeft = buildingX + 15;
    this.kramerRight = buildingX + buildingW - 15;

    const building = this.add.graphics();
    // Building body
    building.fillStyle(0x8a8a96, 1);
    building.fillRect(buildingX, buildingTop, buildingW, buildingBottom - buildingTop);
    // Roof ledge
    building.fillStyle(0x555560, 1);
    building.fillRect(buildingX - 10, buildingTop - 12, buildingW + 20, 14);
    // Window columns
    building.fillStyle(0xb8d4e8, 0.7);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 3; col++) {
        building.fillRect(
          buildingX + 12 + col * 40,
          buildingTop + 20 + row * 48,
          26,
          22
        );
      }
    }
    // Building edge highlights
    building.fillStyle(0xaaaaaa, 0.3);
    building.fillRect(buildingX, buildingTop, 6, buildingBottom - buildingTop);

    // Drop zone indicator (dashed line from roof to street)
    this.dropLine = this.add.graphics();
    this.dropLine.lineStyle(2, 0xffcc00, 0.35);
    this.dropLine.lineBetween(width / 2, buildingTop, width / 2, buildingBottom);

    // --- Street ---
    const street = this.add.graphics();
    street.fillStyle(0x333340, 1);
    street.fillRect(0, height - 110, width, 110);
    // Sidewalk edge
    street.fillStyle(0xaaaaaa, 1);
    street.fillRect(0, height - 112, width, 8);
    // Lane markings
    street.lineStyle(3, 0xffffff, 0.4);
    street.lineBetween(0, height - 65, width, height - 65);
    street.lineStyle(2, 0xffffff, 0.2);
    for (let x = 20; x < width; x += 50) {
      street.lineBetween(x, height - 85, x + 25, height - 85);
    }

    // --- Title & Score ---
    this.add.text(width / 2, 14, "KRAMER'S OIL BLADDER TEST", {
      fontSize: '22px',
      fontFamily: 'Courier New',
      color: '#1a1a2e',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.scoreText = this.add.text(width / 2, 42, 'Score: 0', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#1a1a2e',
    }).setOrigin(0.5).setDepth(10);

    // --- Kramer (on the roof) ---
    this.kramerContainer = this.add.container(width / 2, buildingTop - 4);
    this.drawKramer(this.kramerContainer);
    this.kramerContainer.setDepth(8);
    this.physics.world.enable(this.kramerContainer);
    this.kramerContainer.body.setSize(30, 70);
    this.kramerContainer.body.setOffset(-15, -70);
    this.kramerContainer.body.setVelocityX(this.kramerSpeed);

    // --- Oil bladder (physics object — starts hidden) ---
    this.bladderGfx = this.add.graphics();
    this.drawBladder(this.bladderGfx);
    this.bladderGfx.x = width / 2;
    this.bladderGfx.y = buildingTop + 4;
    this.physics.world.enable(this.bladderGfx);
    this.bladderGfx.body.setSize(22, 20);
    this.bladderGfx.body.setOffset(-11, -10);
    this.bladderGfx.setVisible(false);
    this.bladderGfx.setDepth(9);

    // Store drop X for later use
    this.dropX = width / 2;
    this.dropStartY = buildingTop + 4;

    // --- Girlfriend (moving target at street level) ---
    const gfY = height - 125;
    this.girlfriendContainer = this.add.container(width / 4, gfY);
    this.drawGirlfriend(this.girlfriendContainer);
    this.physics.world.enable(this.girlfriendContainer);
    this.girlfriendContainer.body.setSize(28, 52);
    this.girlfriendContainer.body.setOffset(-14, -52);
    this.girlfriendContainer.setDepth(8);
    this.girlfriendContainer.body.setVelocityX(this.girlfriendSpeed);

    // --- Instructions ---
    this.instructionText = this.add.text(width / 2, 68, 'Click or press SPACE to drop the bladder!', {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      backgroundColor: '#1a1a2eaa',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(10);

    // --- Flash message text ---
    this.flashText = this.add.text(width / 2, height / 2 - 30, '', {
      fontSize: '28px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // --- Input: mouse click or spacebar ---
    this.input.on('pointerdown', () => {
      if (!this.isPlaying || this.bladderInFlight) return;
      this.dropBladder();
    });

    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // --- Overlap: bladder hits girlfriend ---
    this.physics.add.overlap(
      this.bladderGfx,
      this.girlfriendContainer,
      this.onHitGirlfriend,
      null,
      this
    );

    this.addBackButton();
  }

  update() {
    if (!this.isPlaying) return;

    const { width, height } = this.scale;

    // Spacebar drop
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      if (!this.bladderInFlight) this.dropBladder();
    }

    // Kramer bounces on the rooftop
    const kr = this.kramerContainer;
    if (kr.x < this.kramerLeft) {
      kr.x = this.kramerLeft;
      kr.body.setVelocityX(this.kramerSpeed);
    } else if (kr.x > this.kramerRight) {
      kr.x = this.kramerRight;
      kr.body.setVelocityX(-this.kramerSpeed);
    }

    // Girlfriend bounces off screen edges
    const gf = this.girlfriendContainer;
    if (gf.x < 50) {
      gf.x = 50;
      this.girlfriendDirection = 1;
      gf.body.setVelocityX(this.girlfriendSpeed);
    } else if (gf.x > width - 50) {
      gf.x = width - 50;
      this.girlfriendDirection = -1;
      gf.body.setVelocityX(-this.girlfriendSpeed);
    }

    // Update drop-line to follow Kramer
    this.dropLine.clear();
    this.dropLine.lineStyle(2, 0xffcc00, 0.35);
    this.dropLine.lineBetween(kr.x, this.buildingTop, kr.x, this.buildingBottom);

    // Bladder hits the ground or exits frame
    if (this.bladderInFlight && this.bladderGfx.y > height) {
      this.onMiss();
    }
  }

  dropBladder() {
    this.bladderGfx.setPosition(this.kramerContainer.x, this.dropStartY);
    this.bladderGfx.setVisible(true);
    this.bladderGfx.body.enable = true;
    this.bladderGfx.body.setVelocity(this.kramerContainer.body.velocity.x, 0);
    this.bladderGfx.body.setGravityY(400);
    this.bladderInFlight = true;

    if (this.instructionText.visible) {
      this.instructionText.setVisible(false);
    }
  }

  onHitGirlfriend() {
    if (!this.bladderInFlight) return;

    this.bladderInFlight = false;
    this.bladderGfx.setVisible(false);
    this.bladderGfx.body.enable = false;
    this.bladderGfx.body.setVelocity(0, 0);

    this.score += 1;
    this.scoreText.setText('Score: ' + this.score);

    // Speed up girlfriend each hit
    this.girlfriendSpeed = Math.min(this.girlfriendSpeed + 25, 400);
    this.girlfriendContainer.body.setVelocityX(
      this.girlfriendSpeed * this.girlfriendDirection
    );

    this.showFlash('The bladder works! Direct hit!', '#ffdd44');
  }

  onMiss() {
    this.bladderInFlight = false;
    this.bladderGfx.setVisible(false);
    this.bladderGfx.body.enable = false;
    this.bladderGfx.body.setVelocity(0, 0);

    this.showFlash(Phaser.Utils.Array.GetRandom(this.missMessages), '#e94560');
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

  drawBladder(g) {
    // Orange/amber oil bladder — rubbery balloon shape
    g.fillStyle(0xcc6600, 1);
    g.fillEllipse(0, 0, 26, 22);
    // Sheen highlight
    g.fillStyle(0xff9933, 0.55);
    g.fillEllipse(-5, -5, 11, 8);
    // Nozzle
    g.fillStyle(0x777777, 1);
    g.fillRect(-2, 9, 5, 7);
    g.fillRect(-4, 13, 9, 3);
  }

  drawKramer(container) {
    const g = this.add.graphics();

    // Shoes
    g.fillStyle(0x222222, 1);
    g.fillRoundedRect(-15, 26, 13, 6, 2);
    g.fillRoundedRect(2, 26, 13, 6, 2);

    // Legs (jeans)
    g.fillStyle(0x2a3a6e, 1);
    g.fillRect(-12, 8, 10, 20);
    g.fillRect(2, 8, 10, 20);

    // Torso (cream bowling shirt)
    g.fillStyle(0xf5e6c8, 1);
    g.fillRect(-13, -20, 26, 30);
    // Shirt collar
    g.lineStyle(2, 0xcc3333, 1);
    g.lineBetween(0, -20, -4, -12);
    g.lineBetween(0, -20, 4, -12);
    // Shirt side stripes
    g.lineStyle(1.5, 0xcc3333, 0.6);
    g.lineBetween(-12, -18, -10, 8);
    g.lineBetween(12, -18, 10, 8);
    // Belt
    g.fillStyle(0x3a2518, 1);
    g.fillRect(-12, 7, 24, 3);
    g.fillStyle(0xccaa44, 1);
    g.fillRect(-2, 7, 4, 3);

    // Left arm — raised overhead holding the bladder
    g.fillStyle(0xf5e6c8, 1);
    g.beginPath();
    g.moveTo(-13, -18);
    g.lineTo(-19, -18);
    g.lineTo(-26, -38);
    g.lineTo(-20, -40);
    g.closePath();
    g.fillPath();
    // Left hand
    g.fillStyle(0xf2c89d, 1);
    g.fillCircle(-23, -41, 4);

    // Right arm — relaxed at side
    g.fillStyle(0xf5e6c8, 1);
    g.beginPath();
    g.moveTo(13, -18);
    g.lineTo(19, -18);
    g.lineTo(19, 2);
    g.lineTo(13, 2);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xf2c89d, 1);
    g.fillCircle(17, 4, 4);

    // Neck
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-4, -26, 8, 7);

    // Head
    g.fillStyle(0xf2c89d, 1);
    g.fillEllipse(0, -38, 22, 25);

    // Iconic wild hair
    g.fillStyle(0x3a2010, 1);
    g.fillEllipse(0, -52, 26, 12);
    g.fillEllipse(-12, -45, 10, 14);
    g.fillEllipse(12, -45, 10, 14);
    g.lineStyle(3, 0x3a2010, 1);
    g.beginPath();
    g.moveTo(-8, -54);
    g.lineTo(-14, -64);
    g.moveTo(-2, -56);
    g.lineTo(-5, -66);
    g.moveTo(3, -56);
    g.lineTo(3, -67);
    g.moveTo(9, -54);
    g.lineTo(13, -64);
    g.moveTo(13, -51);
    g.lineTo(18, -59);
    g.strokePath();

    // Eyebrows
    g.lineStyle(2, 0x3a2010, 1);
    g.beginPath();
    g.moveTo(-7, -44);
    g.lineTo(-3, -46);
    g.moveTo(3, -46);
    g.lineTo(7, -44);
    g.strokePath();

    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-5, -41, 7, 6);
    g.fillEllipse(5, -41, 7, 6);
    g.fillStyle(0x332211, 1);
    g.fillCircle(-4, -41, 2);
    g.fillCircle(6, -41, 2);

    // Nose
    g.lineStyle(2, 0xd4a574, 1);
    g.beginPath();
    g.moveTo(0, -41);
    g.lineTo(2, -35);
    g.lineTo(-1, -34);
    g.strokePath();

    // Mouth (goofy grin)
    g.lineStyle(2, 0x994444, 1);
    g.beginPath();
    g.arc(0, -31, 6, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170));
    g.strokePath();

    // Oil bladder held overhead in left hand
    g.fillStyle(0xcc6600, 1);
    g.fillEllipse(-23, -55, 22, 18);
    g.fillStyle(0xff9933, 0.55);
    g.fillEllipse(-27, -59, 9, 6);
    g.fillStyle(0x777777, 1);
    g.fillRect(-25, -44, 4, 5);

    const label = this.add.text(0, 40, 'KRAMER', {
      fontSize: '9px',
      fontFamily: 'Courier New',
      color: '#1a1a2e',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add(g);
    container.add(label);
  }

  drawGirlfriend(container) {
    const g = this.add.graphics();

    // Shoes
    g.fillStyle(0x882222, 1);
    g.fillRoundedRect(-11, -3, 10, 5, 2);
    g.fillRoundedRect(1, -3, 10, 5, 2);

    // Legs
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-8, -25, 6, 23);
    g.fillRect(2, -25, 6, 23);

    // Skirt
    g.fillStyle(0xe06a3a, 1);
    g.beginPath();
    g.moveTo(-14, -26);
    g.lineTo(14, -26);
    g.lineTo(18, -44);
    g.lineTo(-18, -44);
    g.closePath();
    g.fillPath();

    // Torso / blouse
    g.fillStyle(0xcc3355, 1);
    g.fillRect(-11, -54, 22, 12);

    // Arms
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-15, -54, 5, 18);
    g.fillRect(10, -54, 5, 18);

    // Neck
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-3, -62, 6, 9);

    // Head
    g.fillStyle(0xf2c89d, 1);
    g.fillEllipse(0, -72, 18, 20);

    // Hair
    g.fillStyle(0x8b4513, 1);
    g.fillEllipse(0, -83, 22, 13);
    g.fillEllipse(-10, -77, 9, 15);
    g.fillEllipse(10, -77, 9, 15);

    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-4, -74, 5, 4);
    g.fillEllipse(4, -74, 5, 4);
    g.fillStyle(0x333322, 1);
    g.fillCircle(-3, -74, 1.5);
    g.fillCircle(5, -74, 1.5);

    // Mouth (smile)
    g.lineStyle(1.5, 0xcc4444, 1);
    g.beginPath();
    g.arc(0, -69, 4, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170));
    g.strokePath();

    const label = this.add.text(0, 8, 'GIRLFRIEND', {
      fontSize: '8px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add(g);
    container.add(label);
  }

  drawCloud(x, y) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(x, y, 20);
    g.fillCircle(x + 22, y - 5, 15);
    g.fillCircle(x + 16, y + 9, 12);
    g.fillCircle(x - 16, y + 6, 14);
  }

  drawBackgroundBuildings(width, height) {
    const g = this.add.graphics();
    const bgs = [
      { x: 10, w: 70, h: 200 },
      { x: 90, w: 55, h: 160 },
      { x: 600, w: 80, h: 210 },
      { x: 695, w: 90, h: 170 },
    ];
    bgs.forEach((b) => {
      g.fillStyle(0x999999, 0.45);
      g.fillRect(b.x, height - 110 - b.h, b.w, b.h);
      // Simple windows
      g.fillStyle(0xb8d4e8, 0.3);
      for (let row = 0; row < Math.floor(b.h / 30); row++) {
        for (let col = 0; col < Math.floor(b.w / 25); col++) {
          g.fillRect(b.x + 6 + col * 22, height - 110 - b.h + 10 + row * 28, 12, 10);
        }
      }
    });
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
