import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * Fire Escape Scramble
 *
 * A birthday party fire breaks out! George must reach the exit on the
 * left while the fire wall advances from the right. Kids and party guests
 * fill the room. Run through them (auto-shove) to score selfishness points.
 *
 * Controls: Arrow keys to move. Touching a person shoves them for +1 selfish point.
 * Reach the exit before the fire catches you!
 */

// ----- CONSTANTS -----
const ROOM_TOP     = 80;   // y-top of playable room (below HUD)
const ROOM_BOTTOM  = 540;  // y-bottom of playable room
const ROOM_LEFT    = 60;   // x-left boundary (exit is here)
const ROOM_RIGHT   = 790;  // x-right boundary

const GEORGE_SPEED       = 185;   // px / sec
const KID_COUNT          = 9;
const SHOVE_COOLDOWN_MS  = 900;   // ms before the same kid can be shoved again
const SHOVE_IMPULSE      = 280;   // px/sec knockback on shoved kid

const FIRE_START_X       = 850;   // fire starts off-screen right
const FIRE_SPEED_INITIAL = 48;    // px / sec at game start
const FIRE_SPEED_MAX     = 210;   // px / sec ceiling
const FIRE_ACCEL         = 9;     // px / sec² — fire accelerates over time

// Spawn positions for kids (spread around the party room)
const KID_SPAWN_POSITIONS = [
  { x: 200, y: 160 }, { x: 310, y: 340 }, { x: 420, y: 190 },
  { x: 500, y: 410 }, { x: 370, y: 290 }, { x: 460, y: 330 },
  { x: 590, y: 200 }, { x: 260, y: 450 }, { x: 550, y: 360 },
];

// Party hat / shirt colour palette for kids
const KID_COLOURS = [
  0xff5555, 0x55aaff, 0x55ee55, 0xffaa44,
  0xff55ff, 0x44ffff, 0xffff44, 0xff8844, 0xaa55ff,
];

export class FireEscapeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FireEscapeScene' });
  }

  // ----- LIFECYCLE -----

  init() {
    this.score        = 0;
    this.isPlaying    = false;
    this.gameOver     = false;
    this.fireX        = FIRE_START_X;
    this.fireSpeed    = FIRE_SPEED_INITIAL;
    this.kids         = [];
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    this.drawBackground(width, height);
    this.createExit();
    this.createGeorge(width, height);
    this.createKids();
    this.createFireGraphics();
    this.createUI(width);
    this.setupInput();

    // ---------- Start prompt ----------
    this.startText = this.add.text(width / 2, height / 2, [
      '🔥  FIRE ESCAPE SCRAMBLE  🔥',
      '',
      'Arrow keys  —  move George',
      'Bump into people to SHOVE them (+1 selfish point)',
      'Reach the EXIT before the fire gets you!',
      '',
      'Press any arrow key to start!',
    ], {
      fontSize: '15px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
      fontStyle: 'bold',
      backgroundColor: '#000000cc',
      padding: { x: 22, y: 14 },
      align: 'center',
    }).setOrigin(0.5).setDepth(200);

    // ---------- Flash message text ----------
    this.flashText = this.add.text(width / 2, 220, '', {
      fontSize: '26px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(110).setVisible(false);

    this.addBackButton();
  }

  // ----- BACKGROUND -----

  drawBackground(width, height) {
    const g = this.add.graphics();

    // Wooden floor
    g.fillStyle(0x8b5e3c, 1);
    g.fillRect(0, ROOM_TOP, width, ROOM_BOTTOM - ROOM_TOP);

    // Floor planks
    g.lineStyle(1, 0x6b4423, 0.5);
    for (let x = 0; x < width; x += 55) {
      g.lineBetween(x, ROOM_TOP, x, ROOM_BOTTOM);
    }
    for (let y = ROOM_TOP; y < ROOM_BOTTOM; y += 18) {
      g.lineBetween(0, y, width, y);
    }

    // Party wall (top strip)
    g.fillStyle(0xfce4bc, 1);
    g.fillRect(0, 0, width, ROOM_TOP);

    // Wall-floor trim
    g.fillStyle(0xd4a462, 1);
    g.fillRect(0, ROOM_TOP, width, 6);

    // Below room (skirting)
    g.fillStyle(0x3a2010, 1);
    g.fillRect(0, ROOM_BOTTOM, width, height - ROOM_BOTTOM);

    // Red carpet down the centre of the room
    g.fillStyle(0x991111, 0.55);
    g.fillRoundedRect(80, ROOM_TOP + 18, width - 160, ROOM_BOTTOM - ROOM_TOP - 36, 8);

    // Birthday banner along the wall
    g.fillStyle(0xe94560, 1);
    g.fillRect(180, 10, 440, 30);
    g.fillStyle(0xffcc00, 1);
    g.fillRect(182, 12, 436, 26);

    // Balloons (decorative, in top-wall area)
    this.drawBalloons(g, width);

    // Birthday table with cake (lower-centre of the room)
    this.drawTable(g, width / 2, ROOM_BOTTOM - 100);
  }

  drawBalloons(g, width) {
    const specs = [
      { x: 130, y: 55, col: 0xff4444 },
      { x: 165, y: 45, col: 0x4444ff },
      { x: 640, y: 50, col: 0x44cc44 },
      { x: 675, y: 42, col: 0xffcc00 },
      { x: 710, y: 55, col: 0xff44ff },
    ];
    specs.forEach(({ x, y, col }) => {
      g.fillStyle(col, 1);
      g.fillEllipse(x, y, 28, 36);
      // Knot
      g.fillStyle(0xaaaaaa, 1);
      g.fillCircle(x, y + 18, 3);
      // String
      g.lineStyle(1, 0xbbbbbb, 0.8);
      g.lineBetween(x, y + 21, x + 6, y + 45);
    });
  }

  drawTable(g, cx, y) {
    // Table top
    g.fillStyle(0x8b6914, 1);
    g.fillRect(cx - 75, y - 14, 150, 28);
    // Legs
    g.fillStyle(0x6b4f14, 1);
    g.fillRect(cx - 65, y + 14, 14, 22);
    g.fillRect(cx + 51, y + 14, 14, 22);

    // Cake body
    g.fillStyle(0xfff5e6, 1);
    g.fillRect(cx - 22, y - 48, 44, 34);
    // Frosting
    g.fillStyle(0xff88bb, 1);
    g.fillRect(cx - 22, y - 52, 44, 10);

    // Candles
    for (let i = -14; i <= 14; i += 10) {
      g.fillStyle(0xffeeaa, 1);
      g.fillRect(cx + i - 2, y - 66, 4, 16);
      // Flame
      g.fillStyle(0xff6600, 0.9);
      g.fillTriangle(cx + i - 4, y - 66, cx + i + 4, y - 66, cx + i, y - 78);
      g.fillStyle(0xffff00, 0.7);
      g.fillTriangle(cx + i - 2, y - 68, cx + i + 2, y - 68, cx + i, y - 76);
    }
  }

  // ----- EXIT -----

  createExit() {
    const g = this.add.graphics().setDepth(5);
    const ex = 6;
    const ey = ROOM_TOP + 70;

    // Door frame
    g.fillStyle(0x005500, 1);
    g.fillRect(ex, ey, 52, 110);

    // Door interior
    g.fillStyle(0x007700, 1);
    g.fillRect(ex + 2, ey + 2, 48, 106);

    // Knob
    g.fillStyle(0xddaa22, 1);
    g.fillCircle(ex + 44, ey + 60, 5);

    // EXIT sign panel
    g.fillStyle(0x006600, 1);
    g.fillRect(ex, ey - 26, 52, 24);

    this.add.text(32, ey - 14, 'EXIT', {
      fontSize: '11px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#00ff44',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);
  }

  // ----- GEORGE -----

  createGeorge(width) {
    const startX = width - 90;
    const startY = (ROOM_TOP + ROOM_BOTTOM) / 2;

    this.george = this.add.container(startX, startY).setDepth(50);
    const g = this.add.graphics();

    // Shoes
    g.fillStyle(0x222222, 1);
    g.fillRoundedRect(-10, 22, 9, 7, 2);
    g.fillRoundedRect(2,  22, 9, 7, 2);

    // Trousers (khaki)
    g.fillStyle(0xc8a84a, 1);
    g.fillRect(-8,  2, 7, 22);
    g.fillRect(1,   2, 7, 22);

    // Party shirt (blue stripes)
    g.fillStyle(0x4a90d9, 1);
    g.fillRect(-11, -22, 22, 26);
    g.fillStyle(0x3370b9, 1);
    for (let sx = -9; sx <= 7; sx += 8) {
      g.fillRect(sx, -22, 4, 26);
    }

    // Neck
    g.fillStyle(0xd4a574, 1);
    g.fillRect(-4, -28, 8, 8);

    // Bald head
    g.fillStyle(0xd4a574, 1);
    g.fillEllipse(0, -42, 28, 26);

    // Thin side hair
    g.fillStyle(0x331100, 1);
    g.fillEllipse(-11, -53, 13, 9);
    g.fillEllipse( 11, -53, 13, 9);

    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-6, -44, 7, 5);
    g.fillEllipse( 6, -44, 7, 5);
    g.fillStyle(0x221100, 1);
    g.fillCircle(-5, -44, 2);
    g.fillCircle( 7, -44, 2);

    // Panicked open mouth
    g.fillStyle(0xaa2222, 1);
    g.fillEllipse(0, -35, 10, 8);
    g.fillStyle(0xffffff, 1);
    g.fillRect(-3, -37, 6, 3);

    this.george.add(g);
    this.physics.world.enable(this.george);
    this.george.body.setSize(22, 60);
    this.george.body.setOffset(-11, -56);
    this.george.body.setCollideWorldBounds(true);
  }

  // ----- KIDS -----

  createKids() {
    KID_SPAWN_POSITIONS.forEach((pos, i) => this.spawnKid(pos.x, pos.y, i));
  }

  spawnKid(x, y, index) {
    const shirtCol = KID_COLOURS[index % KID_COLOURS.length];
    const container = this.add.container(x, y).setDepth(40);
    const g = this.add.graphics();

    // Shoes
    g.fillStyle(0x333333, 1);
    g.fillRoundedRect(-7, 16, 6, 5, 1);
    g.fillRoundedRect(1,  16, 6, 5, 1);

    // Legs (jeans)
    g.fillStyle(0x4477bb, 1);
    g.fillRect(-6, 5, 5, 13);
    g.fillRect(1,  5, 5, 13);

    // Shirt
    g.fillStyle(shirtCol, 1);
    g.fillRect(-8, -14, 16, 21);

    // Head
    g.fillStyle(0xd4a574, 1);
    g.fillEllipse(0, -24, 20, 20);

    // Hair
    g.fillStyle(0x331100, 1);
    g.fillEllipse(0, -33, 18, 11);

    // Eyes
    g.fillStyle(0x111111, 1);
    g.fillCircle(-5, -26, 2);
    g.fillCircle( 5, -26, 2);

    // Party hat
    g.fillStyle(0xffcc00, 1);
    g.fillTriangle(-8, -33, 8, -33, 0, -54);
    g.fillStyle(0xff4444, 1);
    g.fillCircle(0, -54, 3);

    container.add(g);
    this.physics.world.enable(container);
    container.body.setSize(18, 44);
    container.body.setOffset(-9, -42);
    container.body.setCollideWorldBounds(true);

    // Random wandering velocity
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const spd = Phaser.Math.Between(25, 65);
    container.body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);

    container.shoveCooldown = 0;  // timestamp after which kid can be shoved again
    container.moveTimer     = 0;
    this.kids.push(container);

    // Overlap: auto-shove when George touches this kid
    this.physics.add.overlap(this.george, container, () => {
      this.tryShove(container);
    }, null, this);
  }

  tryShove(kid) {
    if (!this.isPlaying || this.gameOver) return;
    const now = this.time.now;
    if (now < kid.shoveCooldown) return;

    kid.shoveCooldown = now + SHOVE_COOLDOWN_MS;
    this.score++;
    this.updateScoreText();

    // Knock kid away from George
    const dx = kid.x - this.george.x;
    const dy = kid.y - this.george.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    kid.body.setVelocity((dx / len) * SHOVE_IMPULSE, (dy / len) * SHOVE_IMPULSE);

    // Brief tumble tween
    this.tweens.killTweensOf(kid);
    this.tweens.add({
      targets: kid,
      rotation: dx > 0 ? 0.9 : -0.9,
      duration: 180,
      yoyo: true,
      onComplete: () => kid.setRotation(0),
    });

    this.showFlash('SHOVED! +1 😈', '#ffcc00');
    this.cameras.main.flash(70, 255, 160, 0, false);
  }

  // ----- FIRE -----

  createFireGraphics() {
    this.fireGfx = this.add.graphics().setDepth(65);
  }

  drawFire() {
    const g = this.fireGfx;
    g.clear();

    const fx = this.fireX;
    const h  = this.scale.height;

    // Smoke haze / glow ahead of fire
    g.fillStyle(0xff2200, 0.10);
    g.fillRect(fx - 55, ROOM_TOP, 55, ROOM_BOTTOM - ROOM_TOP);

    // Gradient fire bands (left-edge = hottest, right = darker)
    const bands = [
      { off: 0,  col: 0xff0000, a: 0.95 },
      { off: 18, col: 0xff4400, a: 0.85 },
      { off: 30, col: 0xff6600, a: 0.78 },
      { off: 40, col: 0xff8800, a: 0.65 },
      { off: 50, col: 0xffaa00, a: 0.55 },
    ];
    bands.forEach(({ off, col, a }) => {
      g.fillStyle(col, a);
      // Fill from fire-front rightward to screen edge
      g.fillRect(fx + off, ROOM_TOP, this.scale.width - fx - off + 10, ROOM_BOTTOM - ROOM_TOP);
    });

    // Flame tips — jagged triangles along the leading edge
    const tipCount = 14;
    const roomH = ROOM_BOTTOM - ROOM_TOP;
    const tipH = roomH / tipCount;
    for (let i = 0; i < tipCount; i++) {
      const ty   = ROOM_TOP + i * tipH;
      const wobble = Math.sin(this.time.now * 0.007 + i * 1.1) * 12;
      g.fillStyle(0xffdd00, 0.9);
      g.fillTriangle(
        fx + wobble,      ty,
        fx + wobble,      ty + tipH,
        fx - 22 + wobble, ty + tipH / 2,
      );
      g.fillStyle(0xff6600, 0.7);
      g.fillTriangle(
        fx + wobble + 6,   ty + tipH * 0.15,
        fx + wobble + 6,   ty + tipH * 0.85,
        fx - 12 + wobble,  ty + tipH / 2,
      );
    }
  }

  // ----- UI -----

  createUI(width) {
    // HUD bar
    this.add.rectangle(width / 2, 26, width, 52, 0x000000, 0.75).setDepth(90);

    this.scoreText = this.add.text(16, 8, 'Selfishness: 0', {
      fontSize: '15px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setDepth(100);

    this.statusText = this.add.text(width / 2, 8, '🔥  FIRE APPROACHING!', {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#ff6600',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(100);

    this.add.text(width - 14, 8, 'Reach the EXIT →←', {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#aaaaaa',
    }).setOrigin(1, 0).setDepth(100);
  }

  updateScoreText() {
    this.scoreText.setText(`Selfishness: ${this.score}`);
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // ----- GAME LOOP -----

  update(time, delta) {
    if (!this.isPlaying) {
      const c = this.cursors;
      if (c.left.isDown || c.right.isDown || c.up.isDown || c.down.isDown) {
        this.isPlaying = true;
        if (this.startText) { this.startText.destroy(); this.startText = null; }
      }
      return;
    }

    if (this.gameOver) return;

    this.handleMovement();
    this.advanceFire(delta);
    this.updateKidAI();
    this.drawFire();
    this.checkExit();
    this.checkFireCatch();
  }

  handleMovement() {
    const s = GEORGE_SPEED;
    const c = this.cursors;

    this.george.body.setVelocityX(
      c.left.isDown  ? -s :
      c.right.isDown ?  s : 0,
    );
    this.george.body.setVelocityY(
      c.up.isDown   ? -s :
      c.down.isDown ?  s : 0,
    );

    // Flip sprite to face direction
    if (c.left.isDown)  this.george.scaleX = -1;
    if (c.right.isDown) this.george.scaleX =  1;

    // Clamp to room height
    this.george.y = Phaser.Math.Clamp(this.george.y, ROOM_TOP + 22, ROOM_BOTTOM - 22);
  }

  advanceFire(delta) {
    const dt = delta / 1000;
    this.fireSpeed = Math.min(this.fireSpeed + FIRE_ACCEL * dt, FIRE_SPEED_MAX);
    this.fireX -= this.fireSpeed * dt;

    // Update HUD warning colour based on proximity
    const dist = this.george.x - this.fireX;
    if (dist < 100) {
      this.statusText.setColor('#ff0000').setText('🔥  FIRE RIGHT BEHIND YOU!');
    } else if (dist < 200) {
      this.statusText.setColor('#ff4400').setText('🔥  FIRE IS CLOSE!');
    } else {
      this.statusText.setColor('#ff6600').setText('🔥  FIRE APPROACHING!');
    }
  }

  updateKidAI() {
    this.kids.forEach((kid) => {
      // Bounce off room walls
      if (kid.x < ROOM_LEFT + 10) {
        kid.x = ROOM_LEFT + 10;
        kid.body.setVelocityX(Math.abs(kid.body.velocity.x));
      } else if (kid.x > ROOM_RIGHT - 10) {
        kid.x = ROOM_RIGHT - 10;
        kid.body.setVelocityX(-Math.abs(kid.body.velocity.x));
      }
      if (kid.y < ROOM_TOP + 20) {
        kid.y = ROOM_TOP + 20;
        kid.body.setVelocityY(Math.abs(kid.body.velocity.y));
      } else if (kid.y > ROOM_BOTTOM - 20) {
        kid.y = ROOM_BOTTOM - 20;
        kid.body.setVelocityY(-Math.abs(kid.body.velocity.y));
      }

      // Periodically change wander direction
      kid.moveTimer++;
      const isCooldownOver = this.time.now >= kid.shoveCooldown;
      if (kid.moveTimer > 110 && isCooldownOver) {
        kid.moveTimer = 0;
        const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const spd = Phaser.Math.Between(25, 65);
        kid.body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
      }

      // Kids panic-flee away from fire when it's close
      if (kid.x > this.fireX - 120) {
        kid.body.setVelocityX(-Math.abs(kid.body.velocity.x) - 50);
      }
    });
  }

  checkExit() {
    if (this.george.x < ROOM_LEFT + 10) {
      this.gameOver = true;
      this.showWin();
    }
  }

  checkFireCatch() {
    if (this.george.x > this.fireX + 5) {
      this.gameOver = true;
      this.showGameOver();
    }
  }

  // ----- FLASH MESSAGE -----

  showFlash(msg, color) {
    this.flashText.setText(msg).setColor(color).setVisible(true).setAlpha(1).setScale(0.4);
    this.tweens.add({
      targets: this.flashText,
      scale: 1,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.flashText,
          alpha: 0,
          duration: 650,
          delay: 500,
          onComplete: () => this.flashText.setVisible(false),
        });
      },
    });
  }

  // ----- WIN -----

  showWin() {
    const { width, height } = this.scale;
    this.kids.forEach((k) => { if (k.body) k.body.setVelocity(0); });
    if (this.george.body) this.george.body.setVelocity(0);

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setDepth(150);

    this.add.text(width / 2, height / 2 - 108, '🚪  YOU ESCAPED!  🚪', {
      fontSize: '36px',
      fontFamily: 'Courier New',
      color: '#00ff66',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 62, '"George is getting out of here!"', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      color: '#cccccc',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 18, `Selfishness Score: ${this.score}`, {
      fontSize: '26px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    const rank =
      this.score >= 7 ? '"You magnificent selfish genius!"' :
      this.score >= 4 ? '"Classic George — every man for himself!"' :
                        '"Could\'ve shoved more people, George."';
    this.add.text(width / 2, height / 2 + 24, rank, {
      fontSize: '13px',
      fontFamily: 'Georgia, serif',
      color: '#888888',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(151);

    const retryBtn = this.add.text(width / 2, height / 2 + 82, '[ ESCAPE AGAIN ]', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });
    retryBtn.on('pointerover', () => retryBtn.setColor('#00ff00'));
    retryBtn.on('pointerout',  () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    const menuBtn = this.add.text(width / 2, height / 2 + 120, '[ BACK TO MENU ]', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout',  () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  // ----- GAME OVER -----

  showGameOver() {
    const { width, height } = this.scale;
    this.kids.forEach((k) => { if (k.body) k.body.setVelocity(0); });

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setDepth(150);

    this.add.text(width / 2, height / 2 - 108, '🔥  SCORCHED!  🔥', {
      fontSize: '38px',
      fontFamily: 'Courier New',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 62,
      '"The fire was faster than George.\nNot that there\'s anything wrong with that."', {
        fontSize: '13px',
        fontFamily: 'Georgia, serif',
        color: '#cccccc',
        fontStyle: 'italic',
        align: 'center',
      }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 6, `Selfishness Score: ${this.score}`, {
      fontSize: '26px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    const retryBtn = this.add.text(width / 2, height / 2 + 58, '[ TRY AGAIN ]', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });
    retryBtn.on('pointerover', () => retryBtn.setColor('#00ff00'));
    retryBtn.on('pointerout',  () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    const menuBtn = this.add.text(width / 2, height / 2 + 96, '[ BACK TO MENU ]', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout',  () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  // ----- BACK BUTTON -----

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
