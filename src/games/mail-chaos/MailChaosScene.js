import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * Mail Route Chaos
 *
 * Newman is on his mail route — deliver letters to mailboxes
 * before his laziness meter fills up completely. Dodge the dogs
 * and slow-moving rain. Press SPACE near a raised-flag mailbox
 * to deliver a letter (cuts the laziness bar and scores a point).
 *
 * Controls: Arrow Left / Right to walk, SPACE to deliver mail.
 */

// ---------- CONSTANTS ----------
const GROUND_Y = 440;       // y where Newman's feet sit
const PLAYER_SPEED = 160;
const DOG_SPEED = 85;
const LAZINESS_FILL_RATE = 6;    // % per second while moving
const LAZINESS_IDLE_RATE = 14;   // % per second while idle
const MAIL_BOOST = 22;           // laziness % removed per delivery
const RAIN_SPEED_MULT = 0.5;     // player speed multiplier while raining
const INVINCIBILITY_MS = 2000;

// Vertical play area boundaries (pavement strip)
const PLAY_TOP_Y    = GROUND_Y - 20;  // upper boundary for player/dog movement
const PLAY_BOTTOM_Y = 570;            // lower boundary for player/dog movement
const DOG_SPEED_Y   = 55;            // vertical dog patrol speed
const MAILBOX_REACH_Y = 150;         // how far below the mailbox row Newman can still deliver

// Positions of the 5 houses (mailbox x-centres)
const HOUSE_XS = [90, 220, 370, 520, 670];

export class MailChaosScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MailChaosScene' });
  }

  // ---------- LIFECYCLE ----------

  init() {
    this.score        = 0;
    this.lives        = 3;
    this.laziness     = 0;   // 0-100; game over at 100
    this.isPlaying    = false;
    this.isInvincible = false;
    this.isRaining    = false;
    this.mailboxes    = [];   // populated in create()
    this.dogList      = [];   // populated in create()
    this.rainLines    = [];
  }

  create() {
    ensureThemePlaying(this);

    this.drawBackground();
    this.createMailboxes();
    this.createPlayer();
    this.createDogs();
    this.createUI();
    this.setupInput();

    const { width, height } = this.scale;

    // ---------- Rain overlay ----------
    this.rainOverlay = this.add.graphics().setDepth(70).setAlpha(0);

    // ---------- Start prompt ----------
    this.startText = this.add.text(width / 2, height / 2, [
      'MAIL ROUTE CHAOS',
      '',
      '← → ↑ ↓ Move   SPACE Deliver',
      '',
      'Press any arrow key to start!',
    ], {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
      fontStyle: 'bold',
      backgroundColor: '#000000cc',
      padding: { x: 16, y: 12 },
      align: 'center',
    }).setOrigin(0.5).setDepth(110);

    // ---------- Flash text ----------
    this.flashText = this.add.text(width / 2, 200, '', {
      fontSize: '26px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(105).setVisible(false);

    this.addBackButton();
    this.scheduleRain();
    this.scheduleNewMail();
  }

  // ---------- BACKGROUND ----------

  drawBackground() {
    const { width, height } = this.scale;
    const g = this.add.graphics();

    // Sky gradient
    g.fillGradientStyle(0x87ceeb, 0x87ceeb, 0xb8d8f0, 0xb8d8f0, 1);
    g.fillRect(0, 0, width, GROUND_Y);

    // Pavement
    g.fillStyle(0x9a9a9a, 1);
    g.fillRect(0, GROUND_Y, width, height - GROUND_Y);

    // Sidewalk kerb
    g.fillStyle(0xbbbbbb, 1);
    g.fillRect(0, GROUND_Y, width, 8);

    // Pavement cracks
    g.lineStyle(1, 0x777777, 0.4);
    for (let x = 0; x < width; x += 80) {
      g.lineBetween(x, GROUND_Y, x, height);
    }
    g.lineBetween(0, GROUND_Y + 40, width, GROUND_Y + 40);

    // Houses
    HOUSE_XS.forEach((hx) => this.drawHouse(hx, GROUND_Y));
  }

  drawHouse(cx, groundY) {
    const g   = this.add.graphics().setDepth(5);
    const hw  = 90;
    const hh  = 85;
    const top = groundY - hh;
    const lx  = cx - hw / 2;

    // Body
    g.fillStyle(0xc8794a, 1);
    g.fillRect(lx, top, hw, hh);

    // Roof
    g.fillStyle(0x7a2d2d, 1);
    g.beginPath();
    g.moveTo(lx - 8, top);
    g.lineTo(cx, top - 38);
    g.lineTo(lx + hw + 8, top);
    g.closePath();
    g.fillPath();

    // Door
    g.fillStyle(0x3b1f0f, 1);
    g.fillRect(cx - 11, top + 44, 22, hh - 44);
    // Door knob
    g.fillStyle(0xddaa44, 1);
    g.fillCircle(cx + 6, top + 68, 2);

    // Windows
    g.fillStyle(0xaacce8, 0.85);
    g.fillRect(lx + 10, top + 14, 22, 18);
    g.fillRect(lx + hw - 32, top + 14, 22, 18);
    // Window frame
    g.lineStyle(1, 0x775533, 0.8);
    g.strokeRect(lx + 10, top + 14, 22, 18);
    g.strokeRect(lx + hw - 32, top + 14, 22, 18);
  }

  // ---------- MAILBOXES ----------

  createMailboxes() {
    HOUSE_XS.forEach((hx, i) => {
      const container = this.add.container(hx, GROUND_Y - 4).setDepth(15);
      const g = this.add.graphics();

      // Post
      g.fillStyle(0x555555, 1);
      g.fillRect(-2, -28, 4, 28);

      // Box body
      g.fillStyle(0x336699, 1);
      g.fillRoundedRect(-13, -48, 26, 20, 5);
      // Box lid highlight
      g.fillStyle(0x2255aa, 1);
      g.fillRect(-13, -48, 26, 4);
      // Door slot
      g.fillStyle(0x112244, 0.9);
      g.fillRect(-8, -41, 16, 3);

      // Flag (red, vertical — goes up when mail is pending)
      const flag = this.add.graphics();
      flag.fillStyle(0xdd2222, 1);
      flag.fillRect(12, -48, 4, 14);   // pole
      flag.fillRect(15, -48, 12, 10);  // pennant
      flag.setVisible(false);

      container.add([g, flag]);

      this.mailboxes.push({ x: hx, container, flag, hasmail: false });
    });

    // Seed initial mail on 2 random boxes
    this.giveRandomMail();
    this.giveRandomMail();
  }

  giveRandomMail() {
    const free = this.mailboxes.filter((m) => !m.hasmail);
    if (free.length === 0) return;
    const target = Phaser.Utils.Array.GetRandom(free);
    target.hasmail = true;
    target.flag.setVisible(true);
  }

  // ---------- PLAYER (NEWMAN) ----------

  createPlayer() {
    this.playerStartX = 40;
    this.playerStartY = GROUND_Y - 22;

    this.player = this.add.container(this.playerStartX, this.playerStartY).setDepth(50);
    const g = this.add.graphics();

    // Shoes
    g.fillStyle(0x222222, 1);
    g.fillRoundedRect(-10, 14, 9, 6, 2);
    g.fillRoundedRect(1, 14, 9, 6, 2);

    // Trousers
    g.fillStyle(0x243a6e, 1);
    g.fillRect(-8, -4, 7, 18);
    g.fillRect(1, -4, 7, 18);

    // Postal uniform jacket (USPS grey-blue)
    g.fillStyle(0x4a6a9e, 1);
    g.fillRect(-11, -22, 22, 20);
    // Jacket lapels
    g.fillStyle(0x3a5a8e, 1);
    g.fillRect(-4, -22, 4, 10);
    g.fillRect(0, -22, 4, 10);
    // Badge
    g.fillStyle(0xddaa22, 1);
    g.fillRect(-9, -17, 8, 5);

    // Mail bag (slung over right shoulder)
    g.fillStyle(0xcc8833, 1);
    g.fillRoundedRect(8, -20, 16, 20, 3);
    g.fillStyle(0xbb7722, 1);
    g.fillRect(8, -20, 16, 3);
    // Bag strap
    g.lineStyle(2, 0xaa6622, 1);
    g.lineBetween(8, -20, -2, -16);

    // Neck
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-4, -28, 8, 7);

    // Newman's chubby head
    g.fillStyle(0xf2c89d, 1);
    g.fillEllipse(0, -40, 26, 24);

    // Postal cap
    g.fillStyle(0x3a5a8e, 1);
    g.fillRect(-12, -53, 24, 9);
    g.fillRect(-14, -45, 28, 4);
    // Cap badge
    g.fillStyle(0xddaa22, 1);
    g.fillRect(-3, -52, 6, 5);

    // Eyes (beady Newman eyes)
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-5, -41, 7, 5);
    g.fillEllipse(5, -41, 7, 5);
    g.fillStyle(0x221100, 1);
    g.fillCircle(-4, -41, 2);
    g.fillCircle(6, -41, 2);

    // Nose
    g.fillStyle(0xe0a87a, 1);
    g.fillEllipse(1, -36, 7, 5);

    // Smug mouth
    g.lineStyle(2, 0xaa4444, 1);
    g.beginPath();
    g.arc(2, -31, 5, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(155));
    g.strokePath();

    this.player.add(g);

    this.physics.world.enable(this.player);
    this.player.body.setSize(22, 52);
    this.player.body.setOffset(-11, -50);
    this.player.body.setCollideWorldBounds(true);
  }

  // ---------- DOGS ----------

  createDogs() {
    [250, 530].forEach((x) => this.spawnDog(x));
  }

  spawnDog(startX) {
    const startY = Phaser.Math.Between(PLAY_TOP_Y, PLAY_BOTTOM_Y);
    const container = this.add.container(startX, startY).setDepth(40);
    const g = this.add.graphics();

    // Body
    g.fillStyle(0xbb7733, 1);
    g.fillEllipse(0, -6, 36, 20);

    // Head
    g.fillStyle(0xcc8844, 1);
    g.fillEllipse(20, -14, 18, 16);

    // Floppy ear
    g.fillStyle(0xaa6622, 1);
    g.fillEllipse(25, -8, 9, 14);

    // Snout
    g.fillStyle(0xdd9955, 1);
    g.fillEllipse(28, -14, 10, 7);
    // Nose
    g.fillStyle(0x222222, 1);
    g.fillCircle(32, -14, 2.5);

    // Eye
    g.fillStyle(0x111111, 1);
    g.fillCircle(22, -17, 2.5);

    // Snarl teeth
    g.fillStyle(0xffffff, 1);
    g.fillRect(23, -11, 8, 3);

    // Tail (curls upward)
    g.lineStyle(4, 0xbb7733, 1);
    g.beginPath();
    g.arc(-18, -14, 10, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(50));
    g.strokePath();

    // Legs
    g.fillStyle(0xbb7733, 1);
    g.fillRect(-10, 4, 6, 10);
    g.fillRect(-1, 4, 6, 10);
    g.fillRect(8, 4, 6, 10);
    g.fillRect(17, 4, 6, 10);

    container.add(g);
    this.physics.world.enable(container);
    container.body.setSize(36, 22);
    container.body.setOffset(-18, -16);
    container.body.setCollideWorldBounds(true);

    const dir = Phaser.Math.Between(0, 1) === 0 ? 1 : -1;
    const dirY = Phaser.Math.Between(0, 1) === 0 ? 1 : -1;
    container.body.setVelocityX(DOG_SPEED * dir);
    container.body.setVelocityY(DOG_SPEED_Y * dirY);
    container.chaseTimer = 0;
    container.facingRight = dir === 1;

    this.dogList.push(container);

    // Collision with player
    this.physics.add.overlap(this.player, container, this.onDogHit, null, this);
  }

  // ---------- UI ----------

  createUI() {
    const { width } = this.scale;

    // Dark bar across the top
    this.add.rectangle(width / 2, 26, width, 52, 0x000000, 0.75).setDepth(88);

    // Score
    this.scoreText = this.add.text(16, 8, 'Delivered: 0', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setDepth(90);

    // Lives
    this.livesText = this.add.text(16, 28, '❤️ ❤️ ❤️', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ff4444',
    }).setDepth(90);

    // Rain status
    this.rainText = this.add.text(width / 2, 8, '', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#aaddff',
    }).setOrigin(0.5, 0).setDepth(90);

    // Laziness label
    this.add.text(width - 16, 6, "NEWMAN'S LAZINESS", {
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(1, 0).setDepth(90);

    // Laziness bar background
    this.add.rectangle(width - 116, 30, 202, 14, 0x222222).setDepth(89);

    // Laziness bar fill (origin at left-centre so width grows rightward)
    this.lazinessBarBg = this.add.rectangle(width - 216, 30, 200, 12, 0x333333)
      .setOrigin(0, 0.5).setDepth(90);
    this.lazinessBar = this.add.rectangle(width - 216, 30, 0, 12, 0x44cc44)
      .setOrigin(0, 0.5).setDepth(91);
  }

  setupInput() {
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  // ---------- SCHEDULED EVENTS ----------

  scheduleRain() {
    const delay = Phaser.Math.Between(12000, 22000);
    this.time.delayedCall(delay, () => {
      if (this.isPlaying) this.startRain();
      this.scheduleRain();
    });
  }

  startRain() {
    if (this.isRaining) return;
    this.isRaining = true;

    // Blue tint overlay
    this.rainOverlay.clear();
    this.rainOverlay.fillStyle(0x4488bb, 0.28);
    this.rainOverlay.fillRect(0, 0, this.scale.width, this.scale.height);
    this.rainOverlay.setAlpha(1);

    this.rainText.setText('⛈️  RAIN!  Slow down!');
    this.showFlash('⛈️  IT\'S RAINING!', '#88ccff');

    // Create animated rain lines
    this.spawnRainLines();

    this.time.delayedCall(7000, () => {
      this.isRaining = false;
      this.rainOverlay.setAlpha(0);
      this.rainText.setText('');
      this.clearRainLines();
    });
  }

  spawnRainLines() {
    const { width, height } = this.scale;
    for (let i = 0; i < 60; i++) {
      const rx = Phaser.Math.Between(0, width);
      const ry = Phaser.Math.Between(-height, height);
      const line = this.add.rectangle(rx, ry, 1, 14, 0xaaddff, 0.6).setDepth(72);
      this.physics.world.enable(line);
      line.body.setVelocity(20, 320);
      this.rainLines.push(line);
    }
  }

  clearRainLines() {
    this.rainLines.forEach((l) => {
      if (l.body) this.physics.world.disable(l);
      l.destroy();
    });
    this.rainLines = [];
  }

  scheduleNewMail() {
    const delay = Phaser.Math.Between(4500, 7500);
    this.time.delayedCall(delay, () => {
      if (this.isPlaying) this.giveRandomMail();
      this.scheduleNewMail();
    });
  }

  // ---------- GAME LOOP ----------

  update(time, delta) {
    if (!this.isPlaying) {
      // Start on first key press
      if (this.cursors.left.isDown || this.cursors.right.isDown ||
          this.cursors.up.isDown || this.cursors.down.isDown) {
        this.isPlaying = true;
        if (this.startText) {
          this.startText.destroy();
          this.startText = null;
        }
      }
      return;
    }

    this.handleMovement();
    this.updateDogs();
    this.wrapRainLines();
    this.updateLaziness(delta);
    this.checkDelivery();
    this.updateUI();
  }

  handleMovement() {
    const speed = PLAYER_SPEED * (this.isRaining ? RAIN_SPEED_MULT : 1);

    if (this.cursors.left.isDown) {
      this.player.body.setVelocityX(-speed);
      this.player.scaleX = -1; // face left
    } else if (this.cursors.right.isDown) {
      this.player.body.setVelocityX(speed);
      this.player.scaleX = 1; // face right
    } else {
      this.player.body.setVelocityX(0);
    }

    if (this.cursors.up.isDown) {
      this.player.body.setVelocityY(-speed);
    } else if (this.cursors.down.isDown) {
      this.player.body.setVelocityY(speed);
    } else {
      this.player.body.setVelocityY(0);
    }

    // Clamp player within the pavement play area
    if (this.player.y < PLAY_TOP_Y) {
      this.player.y = PLAY_TOP_Y;
      this.player.body.setVelocityY(0);
    } else if (this.player.y > PLAY_BOTTOM_Y) {
      this.player.y = PLAY_BOTTOM_Y;
      this.player.body.setVelocityY(0);
    }
  }

  updateDogs() {
    const { width } = this.scale;

    this.dogList.forEach((dog) => {
      // Bounce off horizontal screen edges
      if (dog.x < 30) {
        dog.x = 30;
        dog.body.setVelocityX(Math.abs(dog.body.velocity.x));
        dog.facingRight = true;
      } else if (dog.x > width - 30) {
        dog.x = width - 30;
        dog.body.setVelocityX(-Math.abs(dog.body.velocity.x));
        dog.facingRight = false;
      }

      // Bounce off vertical play area boundaries
      if (dog.y < PLAY_TOP_Y) {
        dog.y = PLAY_TOP_Y;
        dog.body.setVelocityY(Math.abs(dog.body.velocity.y));
      } else if (dog.y > PLAY_BOTTOM_Y) {
        dog.y = PLAY_BOTTOM_Y;
        dog.body.setVelocityY(-Math.abs(dog.body.velocity.y));
      }

      // Flip sprite to match direction
      const goingRight = dog.body.velocity.x > 0;
      if (goingRight !== dog.facingRight) {
        dog.facingRight = goingRight;
        dog.scaleX = goingRight ? 1 : -1;
      }

      // Occasionally chase Newman when close (in 2D)
      dog.chaseTimer++;
      if (dog.chaseTimer >= 90) {
        dog.chaseTimer = 0;
        const dx = this.player.x - dog.x;
        const dy = this.player.y - dog.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 220 && this.isPlaying) {
          const chaseSpeed = DOG_SPEED * 1.6;
          const chaseSpeedY = DOG_SPEED_Y * 1.6;
          dog.body.setVelocityX(dx > 0 ? chaseSpeed : -chaseSpeed);
          dog.body.setVelocityY(dy > 0 ? chaseSpeedY : -chaseSpeedY);
        }
      }
    });
  }

  wrapRainLines() {
    const { width, height } = this.scale;
    this.rainLines.forEach((l) => {
      if (l.y > height + 20) l.y = -20;
      if (l.x > width + 10) l.x = -10;
    });
  }

  updateLaziness(delta) {
    const isIdle    = Math.abs(this.player.body.velocity.x) < 5 && Math.abs(this.player.body.velocity.y) < 5;
    const fillRate  = isIdle ? LAZINESS_IDLE_RATE : LAZINESS_FILL_RATE;
    this.laziness   = Math.min(100, this.laziness + (fillRate * delta) / 1000);

    if (this.laziness >= 100) {
      this.endGame('laziness');
    }
  }

  checkDelivery() {
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;

    const near = this.mailboxes.find(
      (m) => m.hasmail && Math.abs(this.player.x - m.x) < 50 && this.player.y - m.container.y < MAILBOX_REACH_Y,
    );
    if (!near) return;

    near.hasmail = false;
    near.flag.setVisible(false);

    this.score++;
    this.laziness = Math.max(0, this.laziness - MAIL_BOOST);

    this.showFlash('📬  Delivered! +1', '#66ff66');
    this.cameras.main.flash(120, 0, 200, 0);
  }

  onDogHit() {
    if (this.isInvincible || !this.isPlaying) return;

    this.isInvincible = true;
    this.lives--;
    this.updateLivesDisplay();

    this.cameras.main.shake(250, 0.018);
    this.showFlash('🐕  WOOF! You got bitten!', '#ff5555');

    if (this.lives <= 0) {
      this.time.delayedCall(600, () => this.endGame('dog'));
      return;
    }

    // Brief invincibility flash
    this.tweens.add({
      targets: this.player,
      alpha: 0.25,
      yoyo: true,
      repeat: 4,
      duration: INVINCIBILITY_MS / 10,
      onComplete: () => {
        this.player.setAlpha(1);
        this.isInvincible = false;
      },
    });
  }

  // ---------- UI UPDATES ----------

  updateLivesDisplay() {
    const hearts = Array.from({ length: 3 }, (_, i) => (i < this.lives ? '❤️' : '🖤'));
    this.livesText.setText(hearts.join(' '));
  }

  updateUI() {
    this.scoreText.setText(`Delivered: ${this.score}`);

    const w = (this.laziness / 100) * 200;
    this.lazinessBar.width = w;

    const color = this.laziness < 45
      ? 0x44cc44
      : this.laziness < 75
        ? 0xffcc00
        : 0xff4444;
    this.lazinessBar.setFillStyle(color);
  }

  // ---------- FLASH MESSAGE ----------

  showFlash(message, color) {
    this.flashText.setText(message);
    this.flashText.setColor(color);
    this.flashText.setVisible(true);
    this.flashText.setAlpha(1);
    this.flashText.setScale(0.4);

    this.tweens.add({
      targets: this.flashText,
      scale: 1,
      duration: 280,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.flashText,
          alpha: 0,
          duration: 700,
          delay: 700,
          onComplete: () => this.flashText.setVisible(false),
        });
      },
    });
  }

  // ---------- GAME OVER ----------

  endGame(reason) {
    this.isPlaying = false;
    const { width, height } = this.scale;

    // Stop dogs
    this.dogList.forEach((d) => d.body.setVelocity(0));

    // Dim overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setDepth(150);

    this.add.text(width / 2, height / 2 - 90, 'GAME OVER', {
      fontSize: '42px',
      fontFamily: 'Courier New',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    const quip = reason === 'laziness'
      ? '"Newman!!"\n(Too lazy to finish the route)'
      : '"Hello, Newman…"\n(The dogs got the better of you)';

    this.add.text(width / 2, height / 2 - 24, quip, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#cccccc',
      fontStyle: 'italic',
      align: 'center',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 + 26, `Letters Delivered: ${this.score}`, {
      fontSize: '22px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(0.5).setDepth(151);

    const retryBtn = this.add.text(width / 2, height / 2 + 76, '[ DELIVER AGAIN ]', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });
    retryBtn.on('pointerover', () => retryBtn.setColor('#00ff00'));
    retryBtn.on('pointerout',  () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    const menuBtn = this.add.text(width / 2, height / 2 + 116, '[ BACK TO MENU ]', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout',  () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  // ---------- BACK BUTTON ----------

  addBackButton() {
    const btn = this.add.text(20, 560, '← Back to Menu', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setInteractive({ useHandCursor: true }).setDepth(100);

    btn.on('pointerover', () => btn.setColor('#ffdd44'));
    btn.on('pointerout',  () => btn.setColor('#ffffff'));
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
