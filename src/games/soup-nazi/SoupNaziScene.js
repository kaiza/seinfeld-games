import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * The Soup Nazi — A dispatching mini-game
 *
 * Inspired by "The Soup Nazi" (S7E6). Customers line up at the counter
 * and bark their soup orders. You must ladle the correct soup from the
 * station and serve it before time runs out. Serve the wrong soup or
 * take too long and the Soup Nazi bellows "NO SOUP FOR YOU!"
 *
 * Controls: Click a soup pot to pick it up, then click a waiting
 * customer to serve them.
 */

// ---------- SOUP DEFINITIONS ----------
const SOUPS = [
  { name: 'Mulligatawny', color: 0xc8a22c, label: 'MUL' },
  { name: 'Jambalaya', color: 0xcc3333, label: 'JAM' },
  { name: 'Crab Bisque', color: 0xe8804a, label: 'CRB' },
  { name: 'Turkey Chili', color: 0x8b4513, label: 'CHL' },
  { name: 'Mushroom Barley', color: 0x7a6640, label: 'MSH' },
  { name: 'Black Bean', color: 0x222222, label: 'BLK' },
];

// Game config
const MAX_QUEUE = 5;
const ROUND_DURATION = 90; // seconds
const CUSTOMER_BASE_PATIENCE = 8000; // ms — decreases over time
const SPAWN_BASE_INTERVAL = 3000; // ms — decreases over time
const STARTING_LIVES = 3;

// Layout
const COUNTER_Y = 340;
const QUEUE_START_X = 100;
const QUEUE_SPACING = 130;
const POT_Y = 510;
const POT_START_X = 90;
const POT_SPACING = 110;

// Colors
const BG_WALL = 0xf5e6c8;
const BG_COUNTER = 0x5c3a1e;
const COUNTER_TOP = 0x8b6914;

// Customer appearance options
const SKIN_TONES = [0xf1c27d, 0xd4a574, 0xc68642, 0x8d5524, 0xe0ac69, 0xffdbac];
const SHIRT_COLORS = [0x2266aa, 0xcc4444, 0x44aa44, 0x9944aa, 0xddaa22, 0x44aaaa, 0x666666, 0xaa6622];
const HAIR_COLORS = [0x222222, 0x443322, 0x8b6508, 0xa52a2a, 0xd4a76a, 0x333333];

export class SoupNaziScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SoupNaziScene' });
  }

  init() {
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.timeLeft = ROUND_DURATION;
    this.isPlaying = false;
    this.customers = []; // active customer queue
    this.selectedSoup = null; // currently held soup index
    this.servedCount = 0;
    this.combo = 0;
    this.activeSoups = 4; // start with 4 soups, unlock more later
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    this.drawKitchen();
    this.createSoupPots();
    this.createUI();
    this.createSoupNazi();

    // Start prompt
    this.startText = this.add
      .text(width / 2, height / 2 - 40, 'Click anywhere to start!', {
        fontSize: '24px',
        fontFamily: 'Courier New',
        color: '#cc3333',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.startSubtext = this.add
      .text(width / 2, height / 2, 'Serve the right soup before customers lose patience!', {
        fontSize: '13px',
        fontFamily: 'Georgia, serif',
        color: '#888888',
        fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.input.once('pointerdown', () => {
      this.startText.destroy();
      this.startSubtext.destroy();
      this.startGame();
    });

    this.addBackButton();
  }

  // ===================== DRAWING =====================

  drawKitchen() {
    const { width, height } = this.scale;
    const g = this.add.graphics();

    // Wall background — warm deli colors
    g.fillStyle(BG_WALL, 1);
    g.fillRect(0, 0, width, COUNTER_Y);

    // Floor
    g.fillStyle(0x3e2a14, 1);
    g.fillRect(0, COUNTER_Y, width, height - COUNTER_Y);

    // Checkered floor tiles
    const tileSize = 40;
    for (let ty = COUNTER_Y; ty < height; ty += tileSize) {
      for (let tx = 0; tx < width; tx += tileSize) {
        const isLight = ((tx / tileSize) + (ty / tileSize)) % 2 === 0;
        g.fillStyle(isLight ? 0x4a3520 : 0x3a2515, 1);
        g.fillRect(tx, ty, tileSize, tileSize);
      }
    }

    // Counter
    g.fillStyle(BG_COUNTER, 1);
    g.fillRect(0, COUNTER_Y - 20, width, 40);
    g.fillStyle(COUNTER_TOP, 1);
    g.fillRect(0, COUNTER_Y - 22, width, 8);

    // Decorative menu board on wall
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(width / 2 - 150, 30, 300, 120);
    g.lineStyle(3, 0x8b6914);
    g.strokeRect(width / 2 - 150, 30, 300, 120);

    // Menu board text
    this.add
      .text(width / 2, 50, "TODAY'S SOUPS", {
        fontSize: '16px',
        fontFamily: 'Courier New',
        color: '#ffcc00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(5);

    // List soups on the board
    const menuSoups = SOUPS.slice(0, 6);
    const col1 = menuSoups.slice(0, 3);
    const col2 = menuSoups.slice(3, 6);

    col1.forEach((s, i) => {
      this.add
        .text(width / 2 - 120, 72 + i * 22, s.name, {
          fontSize: '12px',
          fontFamily: 'Courier New',
          color: '#ffffff',
        })
        .setDepth(5);
    });

    col2.forEach((s, i) => {
      this.add
        .text(width / 2 + 20, 72 + i * 22, s.name, {
          fontSize: '12px',
          fontFamily: 'Courier New',
          color: '#ffffff',
        })
        .setDepth(5);
    });

    // Steam pipes on wall (decoration)
    g.lineStyle(3, 0xcccccc, 0.3);
    g.lineBetween(30, 40, 30, COUNTER_Y - 30);
    g.lineBetween(width - 30, 40, width - 30, COUNTER_Y - 30);

    // "ORDER HERE →" sign
    this.add
      .text(60, COUNTER_Y - 55, '→ ORDER HERE', {
        fontSize: '11px',
        fontFamily: 'Courier New',
        color: '#cc3333',
        fontStyle: 'bold',
      })
      .setDepth(5);

    // Queue position markers
    for (let i = 0; i < MAX_QUEUE; i++) {
      const x = QUEUE_START_X + i * QUEUE_SPACING;
      g.lineStyle(1, 0xccaa66, 0.3);
      g.strokeRect(x - 30, 180, 60, 2);
    }
  }

  createSoupPots() {
    this.potContainers = [];
    const g = this.add.graphics().setDepth(10);

    // "SOUP STATION" label
    this.add
      .text(400, POT_Y - 55, '🍲  SOUP STATION', {
        fontSize: '14px',
        fontFamily: 'Courier New',
        color: '#ffcc00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Shelf behind pots
    g.fillStyle(0x5c3a1e, 1);
    g.fillRect(POT_START_X - 40, POT_Y - 30, SOUPS.length * POT_SPACING + 30, 80);
    g.fillStyle(0x8b6914, 1);
    g.fillRect(POT_START_X - 40, POT_Y - 32, SOUPS.length * POT_SPACING + 30, 6);

    SOUPS.forEach((soup, i) => {
      const x = POT_START_X + i * POT_SPACING;

      // Pot body
      const pot = this.add.container(x, POT_Y).setDepth(20);

      const potBody = this.add.graphics();
      // Pot exterior
      potBody.fillStyle(0x888888, 1);
      potBody.fillRoundedRect(-25, -15, 50, 35, 4);
      // Pot rim
      potBody.fillStyle(0xaaaaaa, 1);
      potBody.fillRect(-28, -18, 56, 8);
      // Soup inside
      potBody.fillStyle(soup.color, 1);
      potBody.fillRect(-22, -12, 44, 10);
      // Handles
      potBody.fillStyle(0x666666, 1);
      potBody.fillRect(-32, -8, 8, 6);
      potBody.fillRect(24, -8, 8, 6);

      pot.add(potBody);

      // Label
      const label = this.add
        .text(0, 28, soup.label, {
          fontSize: '11px',
          fontFamily: 'Courier New',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      pot.add(label);

      // Full name below
      const fullName = this.add
        .text(0, 42, soup.name, {
          fontSize: '9px',
          fontFamily: 'Courier New',
          color: '#aaaaaa',
        })
        .setOrigin(0.5);
      pot.add(fullName);

      // Hit zone for clicking
      const hitZone = this.add
        .rectangle(0, 0, 60, 50, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      pot.add(hitZone);

      // Steam particles (idle animation)
      this.addSteam(pot, x);

      hitZone.on('pointerdown', () => {
        if (!this.isPlaying) return;
        this.selectSoup(i);
      });

      hitZone.on('pointerover', () => {
        if (!this.isPlaying) return;
        pot.setScale(1.08);
      });

      hitZone.on('pointerout', () => {
        pot.setScale(1.0);
      });

      // Selection highlight ring (hidden initially)
      const highlight = this.add.graphics();
      highlight.lineStyle(3, 0xffcc00);
      highlight.strokeRoundedRect(-30, -22, 60, 55, 6);
      highlight.setVisible(false);
      pot.add(highlight);

      this.potContainers.push({ container: pot, highlight, soup, index: i });
    });
  }

  addSteam(container, worldX) {
    // Simple tween-based steam wisps
    for (let s = 0; s < 2; s++) {
      const steam = this.add
        .text(Phaser.Math.Between(-8, 8), -22, '~', {
          fontSize: '14px',
          color: '#ffffff',
        })
        .setAlpha(0)
        .setDepth(25);
      container.add(steam);

      this.tweens.add({
        targets: steam,
        y: -45,
        alpha: { from: 0.4, to: 0 },
        duration: 1500 + s * 500,
        repeat: -1,
        delay: s * 700,
      });
    }
  }

  createUI() {
    const { width } = this.scale;

    // Score
    this.scoreText = this.add
      .text(20, 5, 'Score: 0', {
        fontSize: '18px',
        fontFamily: 'Courier New',
        color: '#ffcc00',
        fontStyle: 'bold',
      })
      .setDepth(50);

    // Lives
    this.livesText = this.add
      .text(width - 20, 5, '❤️ ❤️ ❤️', {
        fontSize: '18px',
        fontFamily: 'Courier New',
      })
      .setOrigin(1, 0)
      .setDepth(50);

    // Timer
    this.timerText = this.add
      .text(width / 2, 5, `Time: ${ROUND_DURATION}`, {
        fontSize: '18px',
        fontFamily: 'Courier New',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)
      .setDepth(50);

    // Currently held soup indicator
    this.heldText = this.add
      .text(width / 2, COUNTER_Y + 10, '', {
        fontSize: '14px',
        fontFamily: 'Courier New',
        color: '#ffcc00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);

    // Combo text
    this.comboText = this.add
      .text(width / 2, 160, '', {
        fontSize: '16px',
        fontFamily: 'Courier New',
        color: '#00ff00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);

    // Served counter
    this.servedText = this.add
      .text(170, 5, 'Served: 0', {
        fontSize: '14px',
        fontFamily: 'Courier New',
        color: '#aaaaaa',
      })
      .setDepth(50);
  }

  createSoupNazi() {
    // The Soup Nazi stands behind the counter on the right side
    const x = 720;
    const y = COUNTER_Y - 80;

    this.naziContainer = this.add.container(x, y).setDepth(30);

    // Body (white chef coat)
    const body = this.add.rectangle(0, 30, 40, 45, 0xffffff);
    const bodyStroke = this.add.rectangle(0, 30, 40, 45).setStrokeStyle(1, 0xcccccc).setFillStyle(0, 0);

    // Head
    const head = this.add.circle(0, 0, 18, 0xd4a574);
    // Mustache
    const mustache = this.add.rectangle(0, 8, 20, 5, 0x222222).setRotation(0);
    // Eyes
    const eyeL = this.add.circle(-6, -3, 3, 0x222222);
    const eyeR = this.add.circle(6, -3, 3, 0x222222);
    // Eyebrows (stern)
    const browL = this.add.rectangle(-6, -9, 10, 2, 0x222222).setRotation(-0.2);
    const browR = this.add.rectangle(6, -9, 10, 2, 0x222222).setRotation(0.2);
    // Chef hat
    const hatBase = this.add.rectangle(0, -20, 30, 8, 0xffffff);
    const hatTop = this.add.rectangle(0, -34, 24, 22, 0xffffff);
    const hatStroke = this.add.rectangle(0, -34, 24, 22).setStrokeStyle(1, 0xcccccc).setFillStyle(0, 0);
    // Ladle in hand
    const ladleHandle = this.add.rectangle(25, 20, 4, 30, 0x8b6914).setRotation(0.3);
    const ladleBowl = this.add.circle(32, 36, 8, 0x888888);

    this.naziContainer.add([
      body, bodyStroke, ladleHandle, ladleBowl,
      head, mustache, eyeL, eyeR, browL, browR,
      hatBase, hatTop, hatStroke,
    ]);

    // "Soup Nazi" label
    this.add
      .text(x, y + 65, 'The Soup Nazi', {
        fontSize: '10px',
        fontFamily: 'Courier New',
        color: '#666666',
        fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setDepth(30);

    // Speech bubble (reused for yells)
    this.naziBubble = this.add
      .text(x - 70, y - 55, '', {
        fontSize: '12px',
        fontFamily: 'Courier New',
        color: '#ff0000',
        fontStyle: 'bold',
        backgroundColor: '#ffffff',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(35)
      .setAlpha(0);
  }

  naziYell(text, color = '#ff0000') {
    this.naziBubble.setText(text).setColor(color).setAlpha(1);

    // Animate the Soup Nazi shaking
    this.tweens.add({
      targets: this.naziContainer,
      x: this.naziContainer.x + 3,
      duration: 50,
      yoyo: true,
      repeat: 5,
    });

    this.time.delayedCall(1400, () => {
      this.naziBubble.setAlpha(0);
    });
  }

  // ===================== GAME LOGIC =====================

  startGame() {
    this.isPlaying = true;
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.combo = 0;
    this.servedCount = 0;
    this.timeLeft = ROUND_DURATION;
    this.activeSoups = 4;

    // Timer countdown
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.tick,
      callbackScope: this,
      loop: true,
    });

    // Start spawning customers
    this.scheduleNextCustomer();

    // Spawn the first customer immediately
    this.spawnCustomer();

    this.naziYell('NEXT!', '#cc3333');
  }

  tick() {
    this.timeLeft--;
    this.timerText.setText(`Time: ${this.timeLeft}`);

    if (this.timeLeft <= 10) {
      this.timerText.setColor('#ff0000');
    }

    // Unlock more soups as the game progresses
    if (this.timeLeft <= 60 && this.activeSoups < 5) {
      this.activeSoups = 5;
      this.naziYell('NEW SOUP!', '#ffcc00');
    }
    if (this.timeLeft <= 35 && this.activeSoups < 6) {
      this.activeSoups = 6;
      this.naziYell('NEW SOUP!', '#ffcc00');
    }

    if (this.timeLeft <= 0) {
      this.endGame();
    }
  }

  scheduleNextCustomer() {
    if (!this.isPlaying) return;

    // Spawn faster as time progresses
    const elapsed = ROUND_DURATION - this.timeLeft;
    const speedFactor = Math.max(0.35, 1 - elapsed * 0.008);
    const delay = SPAWN_BASE_INTERVAL * speedFactor + Phaser.Math.Between(-400, 400);

    this.time.delayedCall(Math.max(800, delay), () => {
      if (!this.isPlaying) return;
      this.spawnCustomer();
      this.scheduleNextCustomer();
    });
  }

  spawnCustomer() {
    if (this.customers.length >= MAX_QUEUE) return;

    const slot = this.customers.length;
    const x = QUEUE_START_X + slot * QUEUE_SPACING;
    const y = 240;

    // Pick a random soup from the currently active selection
    const soupIndex = Phaser.Math.Between(0, this.activeSoups - 1);
    const soup = SOUPS[soupIndex];

    // Patience decreases over time
    const elapsed = ROUND_DURATION - this.timeLeft;
    const patience = Math.max(3500, CUSTOMER_BASE_PATIENCE - elapsed * 50);

    // Create customer visual
    const container = this.add.container(x - 80, y).setDepth(15);
    this.drawCustomer(container, soup);

    // Patience bar background
    const barBg = this.add.rectangle(0, -60, 60, 8, 0x333333);
    container.add(barBg);

    // Patience bar fill
    const barFill = this.add.rectangle(-29, -60, 58, 6, 0x44cc44).setOrigin(0, 0.5);
    container.add(barFill);

    // Order bubble
    const bubble = this.add.graphics();
    bubble.fillStyle(0xffffff, 0.95);
    bubble.fillRoundedRect(-45, -105, 90, 35, 8);
    // Bubble tail
    bubble.fillStyle(0xffffff, 0.95);
    bubble.fillTriangle(-5, -70, 5, -70, 0, -60);
    bubble.lineStyle(1, 0x999999);
    bubble.strokeRoundedRect(-45, -105, 90, 35, 8);
    container.add(bubble);

    // Soup name in bubble
    const orderText = this.add
      .text(0, -88, soup.name, {
        fontSize: '10px',
        fontFamily: 'Courier New',
        color: '#333333',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    container.add(orderText);

    // Colored dot to help match soup visually
    const soupDot = this.add.circle(38, -88, 5, soup.color);
    container.add(soupDot);

    // Slide in animation
    this.tweens.add({
      targets: container,
      x: x,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Hit zone for serving
    const hitZone = this.add
      .rectangle(0, 0, 70, 90, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(16);
    container.add(hitZone);

    const customer = {
      container,
      hitZone,
      barFill,
      soup,
      soupIndex,
      slot,
      patience,
      timeAlive: 0,
      served: false,
    };

    hitZone.on('pointerdown', () => {
      if (!this.isPlaying) return;
      this.tryServeCustomer(customer);
    });

    // Patience timer
    customer.patienceTimer = this.time.addEvent({
      delay: 50,
      callback: () => this.updatePatience(customer),
      callbackScope: this,
      loop: true,
    });

    // Expire timer
    customer.expireTimer = this.time.delayedCall(patience, () => {
      if (!customer.served) {
        this.customerExpired(customer);
      }
    });

    this.customers.push(customer);
  }

  drawCustomer(container, soup) {
    const skinTone = Phaser.Utils.Array.GetRandom(SKIN_TONES);
    const shirtColor = Phaser.Utils.Array.GetRandom(SHIRT_COLORS);
    const hairColor = Phaser.Utils.Array.GetRandom(HAIR_COLORS);

    // Body
    const body = this.add.rectangle(0, 25, 30, 35, shirtColor);
    // Head
    const head = this.add.circle(0, -2, 16, skinTone);
    // Hair
    const hair = this.add.ellipse(0, -14, 28, 14, hairColor);
    // Eyes
    const eyeL = this.add.circle(-5, -4, 2, 0x222222);
    const eyeR = this.add.circle(5, -4, 2, 0x222222);
    // Mouth
    const mouth = this.add.rectangle(0, 6, 8, 2, 0x993333);

    container.add([body, hair, head, eyeL, eyeR, mouth]);
  }

  updatePatience(customer) {
    if (customer.served) return;
    customer.timeAlive += 50;

    const ratio = 1 - customer.timeAlive / customer.patience;
    const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);

    // Update bar width
    customer.barFill.setScale(clampedRatio, 1);

    // Color: green → yellow → red
    let color;
    if (clampedRatio > 0.5) {
      color = 0x44cc44;
    } else if (clampedRatio > 0.25) {
      color = 0xcccc44;
    } else {
      color = 0xcc4444;
    }
    customer.barFill.setFillStyle(color);

    // Shake when almost expired
    if (clampedRatio < 0.15 && clampedRatio > 0) {
      customer.container.x += Phaser.Math.Between(-1, 1);
    }
  }

  selectSoup(index) {
    // Deselect previous
    this.potContainers.forEach((pc) => pc.highlight.setVisible(false));

    if (this.selectedSoup === index) {
      // Toggle off
      this.selectedSoup = null;
      this.heldText.setAlpha(0);
      return;
    }

    this.selectedSoup = index;
    this.potContainers[index].highlight.setVisible(true);

    // Show held indicator
    this.heldText.setText(`Holding: ${SOUPS[index].name}`).setAlpha(1);
  }

  tryServeCustomer(customer) {
    if (customer.served) return;

    if (this.selectedSoup === null) {
      // No soup selected — nudge player
      this.naziYell('Pick a soup first!', '#ffcc00');
      return;
    }

    customer.served = true;

    // Stop patience tracking
    if (customer.patienceTimer) customer.patienceTimer.remove();
    if (customer.expireTimer) customer.expireTimer.remove();

    if (this.selectedSoup === customer.soupIndex) {
      // CORRECT soup!
      this.correctServe(customer);
    } else {
      // WRONG soup!
      this.wrongServe(customer);
    }

    // Deselect after serving
    this.selectedSoup = null;
    this.potContainers.forEach((pc) => pc.highlight.setVisible(false));
    this.heldText.setAlpha(0);
  }

  correctServe(customer) {
    this.combo++;
    const timeBonus = Math.floor(
      (1 - customer.timeAlive / customer.patience) * 20
    );
    const comboBonus = (this.combo - 1) * 5;
    const points = 25 + timeBonus + comboBonus;
    this.score += points;
    this.servedCount++;

    this.scoreText.setText(`Score: ${this.score}`);
    this.servedText.setText(`Served: ${this.servedCount}`);

    // Points popup
    const worldX = customer.container.x;
    const worldY = customer.container.y;

    const ptText = this.add
      .text(worldX, worldY - 70, `+${points}`, {
        fontSize: '20px',
        fontFamily: 'Courier New',
        color: '#00ff00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.tweens.add({
      targets: ptText,
      y: worldY - 120,
      alpha: 0,
      duration: 700,
      onComplete: () => ptText.destroy(),
    });

    // Combo feedback
    if (this.combo >= 3) {
      this.comboText.setText(`🔥 ${this.combo}x COMBO!`).setAlpha(1);
      this.time.delayedCall(800, () => this.comboText.setAlpha(0));
    }

    // Happy sound from Nazi
    const phrases = ['NEXT!', 'You are worthy.', 'Good order.', 'Come back, ONE YEAR!'];
    this.naziYell(Phaser.Utils.Array.GetRandom(phrases), '#33aa33');

    // Customer leaves happy
    this.customerLeave(customer, true);
  }

  wrongServe(customer) {
    this.combo = 0;
    this.lives--;
    this.updateLives();

    // Camera shake
    this.cameras.main.shake(200, 0.01);

    // NO SOUP FOR YOU!
    this.naziYell('NO SOUP FOR YOU!', '#ff0000');

    // Big floating text
    const { width, height } = this.scale;
    const bigText = this.add
      .text(width / 2, height / 2 - 30, 'NO SOUP FOR YOU!', {
        fontSize: '32px',
        fontFamily: 'Courier New',
        color: '#ff0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setAlpha(0);

    this.tweens.add({
      targets: bigText,
      alpha: 1,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 300,
      yoyo: true,
      hold: 600,
      onComplete: () => bigText.destroy(),
    });

    // Customer leaves sad
    this.customerLeave(customer, false);

    if (this.lives <= 0) {
      this.time.delayedCall(500, () => this.endGame());
    }
  }

  customerExpired(customer) {
    if (customer.served) return;
    customer.served = true;

    if (customer.patienceTimer) customer.patienceTimer.remove();

    this.combo = 0;
    this.lives--;
    this.updateLives();

    this.naziYell('TOO SLOW! NEXT!', '#ff6600');

    this.cameras.main.shake(150, 0.008);

    this.customerLeave(customer, false);

    if (this.lives <= 0) {
      this.time.delayedCall(500, () => this.endGame());
    }
  }

  customerLeave(customer, happy) {
    // Slide out with emotion
    const emoji = happy ? '😊' : '😡';
    const emote = this.add
      .text(customer.container.x, customer.container.y - 40, emoji, {
        fontSize: '24px',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.tweens.add({
      targets: emote,
      y: customer.container.y - 80,
      alpha: 0,
      duration: 600,
      onComplete: () => emote.destroy(),
    });

    // Slide customer off screen
    this.tweens.add({
      targets: customer.container,
      x: happy ? 900 : -100,
      alpha: 0,
      duration: 400,
      onComplete: () => {
        customer.container.destroy();
        // Remove from array
        const idx = this.customers.indexOf(customer);
        if (idx !== -1) this.customers.splice(idx, 1);
        // Reposition remaining customers
        this.repositionQueue();
      },
    });
  }

  repositionQueue() {
    this.customers.forEach((c, i) => {
      c.slot = i;
      const targetX = QUEUE_START_X + i * QUEUE_SPACING;
      this.tweens.add({
        targets: c.container,
        x: targetX,
        duration: 200,
        ease: 'Sine.easeInOut',
      });
    });
  }

  updateLives() {
    const hearts = [];
    for (let i = 0; i < STARTING_LIVES; i++) {
      hearts.push(i < this.lives ? '❤️' : '🖤');
    }
    this.livesText.setText(hearts.join(' '));
  }

  // ===================== END GAME =====================

  endGame() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.timerEvent) this.timerEvent.remove();

    // Stop all customer timers
    this.customers.forEach((c) => {
      if (c.patienceTimer) c.patienceTimer.remove();
      if (c.expireTimer) c.expireTimer.remove();
    });

    // Deselect
    this.selectedSoup = null;
    this.potContainers.forEach((pc) => pc.highlight.setVisible(false));
    this.heldText.setAlpha(0);

    const { width, height } = this.scale;

    // Dim overlay
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setDepth(150);

    const reason =
      this.lives <= 0
        ? "You've been banned from the soup stand!"
        : "Time's up! The soup stand is closed!";

    this.add
      .text(width / 2, height / 2 - 80, 'NO MORE SOUP!', {
        fontSize: '36px',
        fontFamily: 'Courier New',
        color: '#ff3333',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(151);

    this.add
      .text(width / 2, height / 2 - 35, reason, {
        fontSize: '14px',
        fontFamily: 'Courier New',
        color: '#cccccc',
      })
      .setOrigin(0.5)
      .setDepth(151);

    this.add
      .text(width / 2, height / 2 + 5, `Final Score: ${this.score}`, {
        fontSize: '26px',
        fontFamily: 'Courier New',
        color: '#ffcc00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(151);

    this.add
      .text(width / 2, height / 2 + 40, `Soups Served: ${this.servedCount}`, {
        fontSize: '16px',
        fontFamily: 'Courier New',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)
      .setDepth(151);

    // Retry button
    const retryBtn = this.add
      .text(width / 2, height / 2 + 85, '[ PLAY AGAIN ]', {
        fontSize: '20px',
        fontFamily: 'Courier New',
        color: '#888888',
      })
      .setOrigin(0.5)
      .setDepth(151)
      .setInteractive({ useHandCursor: true });

    retryBtn.on('pointerover', () => retryBtn.setColor('#ff3333'));
    retryBtn.on('pointerout', () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    // Menu button
    const menuBtn = this.add
      .text(width / 2, height / 2 + 120, '[ BACK TO MENU ]', {
        fontSize: '16px',
        fontFamily: 'Courier New',
        color: '#888888',
      })
      .setOrigin(0.5)
      .setDepth(151)
      .setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  addBackButton() {
    const btn = this.add
      .text(20, 575, '← Back to Menu', {
        fontSize: '14px',
        fontFamily: 'Courier New',
        color: '#888888',
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(50);

    btn.on('pointerover', () => btn.setColor('#e94560'));
    btn.on('pointerout', () => btn.setColor('#888888'));
    btn.on('pointerdown', () => {
      this.isPlaying = false;
      if (this.timerEvent) this.timerEvent.remove();
      this.customers.forEach((c) => {
        if (c.patienceTimer) c.patienceTimer.remove();
        if (c.expireTimer) c.expireTimer.remove();
      });
      this.scene.start('MenuScene');
    });
  }
}
