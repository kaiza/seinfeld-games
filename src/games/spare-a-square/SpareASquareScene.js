import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * Spare a Square Rush – Walk-around Edition
 *
 * Inspired by "The Stall" (S5E12).
 * Walk your character to the janitor's closet to pick up toilet rolls (max 5),
 * then walk to each stall's doorway to refill the paper before NPCs run out!
 *
 * Controls:
 *  - Arrow Keys or WASD to move.
 *  - Walk into the JANITOR'S CLOSET to collect rolls automatically.
 *  - Walk to a stall doorway to deliver a roll automatically.
 */

// ── Layout ────────────────────────────────────────────────────────────────────
const NUM_STALLS   = 4;
const STALL_CX     = [100, 267, 433, 600];  // stall centre x positions
const STALL_W      = 140;
const WALL_W       = 8;
const STALL_TOP    = 58;
const STALL_BOTTOM = 272;
const DOOR_TOP     = STALL_TOP + 28;        // 86
const DOOR_BOTTOM  = STALL_BOTTOM - 4;      // 268
const NPC_FACE_Y   = DOOR_TOP + 55;         // 141
const TP_BAR_Y     = STALL_BOTTOM - 24;     // 248  (inside stall, near bottom)

// Floor – where the player character walks
const FLOOR_TOP    = STALL_BOTTOM;          // 272
const FLOOR_BOTTOM = 506;
const FLOOR_LEFT   = 6;
const FLOOR_RIGHT  = 794;

// Janitor's closet (lower-right of floor area)
const CLOSET_X  = 700;
const CLOSET_Y  = 415;
const CLOSET_W  = 86;
const CLOSET_H  = 78;

// ── Player ────────────────────────────────────────────────────────────────────
const PLAYER_SPEED  = 150;
const PLAYER_RADIUS = 13;

// ── Game tuning ───────────────────────────────────────────────────────────────
const ROUND_DURATION   = 90;
const STARTING_LIVES   = 3;
const MAX_INVENTORY    = 5;
const GRACE_PERIOD     = 5000;   // ms before unhappy NPC leaves after paper runs out
const NPC_MIN_STAY     = 7000;
const NPC_MAX_STAY     = 16000;
const SPAWN_MIN        = 2500;
const SPAWN_MAX        = 5500;
const BASE_DEPLETION   = 6;      // % per second at game start
const DEPLETION_MID    = 8;
const DEPLETION_HARD   = 11;
const RAMP_MID_TIME    = 60;
const RAMP_HARD_TIME   = 30;
const COLLECT_INTERVAL = 800;    // ms to pick up one roll while standing in closet
const DELIVER_COOLDOWN = 900;    // ms between deliveries to the same stall
const DELIVERY_ZONE_H  = 50;    // px below FLOOR_TOP that counts as "at the stall door"
const REFILL_THRESHOLD = 90;    // % paper level below which proactive refill triggers

// ── Visual palettes ───────────────────────────────────────────────────────────
const SKIN_TONES  = [0xf1c27d, 0xd4a574, 0xc68642, 0x8d5524, 0xffdbac, 0xe0ac69];
const HAIR_COLORS = [0x222222, 0x443322, 0x8b6508, 0xa52a2a, 0xd4a76a, 0x333333];

// ── Stall states ──────────────────────────────────────────────────────────────
const S = { EMPTY: 'empty', OCCUPIED: 'occupied', OUT_OF_PAPER: 'out', LEAVING: 'leaving' };

export class SpareASquareScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SpareASquareScene' });
  }

  init() {
    this.score     = 0;
    this.lives     = STARTING_LIVES;
    this.timeLeft  = ROUND_DURATION;
    this.isPlaying = false;
    this.inventory = 0;
    this.stallData = [];
    this.deplRate  = BASE_DEPLETION;

    // Closet collecting state
    this.isCollecting    = false;
    this.collectStart    = 0;
    this.collectProgress = 0;

    // Player world position
    this.playerX = 380;
    this.playerY = FLOOR_TOP + Math.round((FLOOR_BOTTOM - FLOOR_TOP) / 2);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  CREATE
  // ──────────────────────────────────────────────────────────────────────────
  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    this.drawBathroom(width, height);
    this.createStalls();
    this.createCloset();
    this.createPlayer();
    this.createUI();
    this.setupInput();

    // ── Start-screen overlay ──────────────────────────────────────────────
    const ov    = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setDepth(90);
    const title = this.add.text(width / 2, height / 2 - 90, '🧻  SPARE A SQUARE RUSH  🧻', {
      fontSize: '21px', fontFamily: 'Courier New', color: '#ffcc00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(91);

    const lines = [
      "Walk to the JANITOR'S CLOSET to pick up rolls (max 5).",
      'Walk to a stall doorway to refill toilet paper.',
      'Keep all stalls stocked before NPCs run out!',
      '',
      '← → ↑ ↓  or  W A S D  to move',
    ];
    const inst = this.add.text(width / 2, height / 2 - 10, lines.join('\n'), {
      fontSize: '13px', fontFamily: 'Courier New', color: '#dddddd', align: 'center',
    }).setOrigin(0.5).setDepth(91);

    const btn = this.add.text(width / 2, height / 2 + 105, '[ PRESS ANY KEY OR CLICK TO START ]', {
      fontSize: '16px', fontFamily: 'Courier New', color: '#ffcc00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(91).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout',  () => btn.setColor('#ffcc00'));

    const startHandler = () => {
      ov.destroy(); title.destroy(); inst.destroy(); btn.destroy();
      this.input.keyboard.off('keydown', startHandler);
      this.startGame();
    };
    this.input.once('pointerdown', startHandler);
    this.input.keyboard.once('keydown', startHandler);

    this.addBackButton();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  UPDATE
  // ──────────────────────────────────────────────────────────────────────────
  update(_time, delta) {
    if (!this.isPlaying) return;
    const dt = delta / 1000;

    this.movePlayer(dt);
    this.updateStalls(dt);
    this.checkClosetInteraction(delta);
    this.checkStallDelivery();
    this.updateClosetBar();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  DRAWING – bathroom background
  // ──────────────────────────────────────────────────────────────────────────
  drawBathroom(width, height) {
    const g = this.add.graphics();

    // Upper stall area (beige wall tiles)
    g.fillStyle(0xede0cc, 1);
    g.fillRect(0, 0, width, FLOOR_TOP);
    g.lineStyle(1, 0xd4c8b4, 0.5);
    for (let x = 0; x <= width; x += 40)    g.lineBetween(x, 0, x, FLOOR_TOP);
    for (let y = 0; y <= FLOOR_TOP; y += 40) g.lineBetween(0, y, width, y);

    // Ceiling strip
    g.fillStyle(0xe0d4c0, 1);
    g.fillRect(0, 0, width, STALL_TOP);
    g.lineStyle(2, 0xc8bca8);
    g.lineBetween(0, STALL_TOP, width, STALL_TOP);

    // Fluorescent-light fixtures
    for (let lx = 100; lx < width; lx += 200) {
      g.fillStyle(0xfffff0, 0.6);
      g.fillRect(lx - 40, 8, 80, 14);
      g.lineStyle(1, 0xd8d4c0);
      g.strokeRect(lx - 40, 8, 80, 14);
    }

    // Floor (checkerboard)
    for (let ty = FLOOR_TOP; ty < height; ty += 26) {
      for (let tx = 0; tx < width; tx += 26) {
        const lit = (Math.floor(tx / 26) + Math.floor((ty - FLOOR_TOP) / 26)) % 2 === 0;
        g.fillStyle(lit ? 0xd8ccc0 : 0xbcb0a4, 1);
        g.fillRect(tx, ty, 26, 26);
      }
    }

    // Baseboard separating stall area from floor
    g.fillStyle(0x7a6050, 1);
    g.fillRect(0, FLOOR_TOP - 4, width, 4);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  STALL CONSTRUCTION
  // ──────────────────────────────────────────────────────────────────────────
  createStalls() {
    this.stallData = [];
    for (let i = 0; i < NUM_STALLS; i++) {
      this.stallData.push(this.buildStall(STALL_CX[i], i));
    }
  }

  buildStall(cx, idx) {
    const innerW   = STALL_W - WALL_W * 2;
    const barLeftX = cx - innerW / 2 + 2;
    const barFullW = innerW - 4;
    const doorMidY = (DOOR_TOP + DOOR_BOTTOM) / 2;
    const doorH    = DOOR_BOTTOM - DOOR_TOP;

    // Partition walls
    const wallG = this.add.graphics().setDepth(2);
    wallG.fillStyle(0x8a7060, 1);
    wallG.fillRect(cx - STALL_W / 2,          STALL_TOP, WALL_W, STALL_BOTTOM - STALL_TOP);
    wallG.fillRect(cx + STALL_W / 2 - WALL_W, STALL_TOP, WALL_W, STALL_BOTTOM - STALL_TOP);
    wallG.fillStyle(0x7a6050, 1);
    wallG.fillRect(cx - STALL_W / 2, STALL_TOP, STALL_W, 10);

    // Door (visual only – no pointer interaction)
    const door = this.add.rectangle(cx, doorMidY, innerW, doorH, 0xb8a488)
      .setStrokeStyle(3, 0x8a7060)
      .setDepth(3);

    // Hinge decorations
    const hingeG = this.add.graphics().setDepth(4);
    hingeG.fillStyle(0x888880, 1);
    hingeG.fillRect(cx + innerW / 2 - 8, DOOR_TOP + 20, 8, 14);
    hingeG.fillRect(cx + innerW / 2 - 8, DOOR_BOTTOM - 34, 8, 14);

    // Status text
    const statusText = this.add.text(cx, DOOR_TOP + 20, 'VACANT', {
      fontSize: '13px', fontFamily: 'Courier New', color: '#33aa33', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    // NPC face container
    const faceContainer = this.add.container(cx, NPC_FACE_Y).setDepth(6).setVisible(false);

    // Speech bubble
    const bubble = this.add.text(cx + 62, DOOR_TOP + 22, '', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#333333',
      backgroundColor: '#ffffff', padding: { x: 5, y: 4 },
      wordWrap: { width: 85 },
    }).setOrigin(0, 0.5).setDepth(10).setVisible(false);

    // Feet below door
    const feetG = this.add.graphics().setDepth(5).setVisible(false);
    feetG.fillStyle(0x665540, 1);
    feetG.fillRoundedRect(cx - 20, DOOR_BOTTOM + 4, 16, 10, 2);
    feetG.fillRoundedRect(cx + 4,  DOOR_BOTTOM + 4, 16, 10, 2);

    // TP level bar (inside stall, near bottom)
    const barBg   = this.add.rectangle(cx, TP_BAR_Y, innerW, 12, 0x444444).setDepth(3);
    const barFill = this.add.rectangle(barLeftX, TP_BAR_Y, barFullW, 8, 0x44cc44)
      .setOrigin(0, 0.5).setDepth(4);
    const tpLabel = this.add.text(cx, TP_BAR_Y + 14, '100%', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#4a3828',
    }).setOrigin(0.5).setDepth(4);

    // Warning indicator
    const warnText = this.add.text(cx, STALL_TOP - 18, '', {
      fontSize: '20px', fontFamily: 'Courier New', color: '#ff6600',
    }).setOrigin(0.5).setDepth(6).setVisible(false);

    // Delivery zone highlight at the bottom of the stall opening
    const glowRect = this.add.rectangle(cx, FLOOR_TOP + 3, innerW, 6, 0x44ff44, 0).setDepth(1);

    const stall = {
      idx, cx,
      door, statusText, faceContainer, bubble,
      feetG, barBg, barFill, tpLabel, warnText, glowRect,
      barLeftX, barFullW,
      state: S.EMPTY,
      paperLevel: 100,
      npcSkin: null, npcHair: null,
      stayTimer: null, graceTimer: null,
      lastDelivery: 0,   // timestamp for delivery cooldown
    };

    return stall;
  }

  // ── NPC face drawings ─────────────────────────────────────────────────────
  drawNPCFace(container, skin, hair) {
    container.removeAll(true);
    const g = this.add.graphics();
    g.fillStyle(skin, 1);   g.fillCircle(0, 0, 20);
    g.fillStyle(hair, 1);   g.fillEllipse(0, -17, 34, 17);
    g.fillEllipse(-15, -8, 12, 20);
    g.fillEllipse(15, -8, 12, 20);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-7, -2, 9, 7); g.fillEllipse(7, -2, 9, 7);
    g.fillStyle(0x222222, 1);
    g.fillCircle(-6, -2, 2.5); g.fillCircle(8, -2, 2.5);
    g.lineStyle(2, hair, 1);
    g.beginPath();
    g.moveTo(-10, -10); g.lineTo(-4, -12);
    g.moveTo(4, -12);   g.lineTo(10, -10);
    g.strokePath();
    g.lineStyle(2, 0x994444, 1);
    g.beginPath();
    g.arc(0, 9, 5, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170));
    g.strokePath();
    container.add(g);
  }

  drawNPCFaceDistressed(container, skin, hair) {
    container.removeAll(true);
    const g = this.add.graphics();
    g.fillStyle(skin, 1);   g.fillCircle(0, 0, 20);
    g.fillStyle(hair, 1);   g.fillEllipse(0, -17, 34, 17);
    g.fillEllipse(-15, -8, 12, 20);
    g.fillEllipse(15, -8, 12, 20);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-7, -2, 11, 10); g.fillEllipse(7, -2, 11, 10);
    g.fillStyle(0x222222, 1);
    g.fillCircle(-6, -2, 3.5); g.fillCircle(8, -2, 3.5);
    g.lineStyle(2, hair, 1);
    g.beginPath();
    g.moveTo(-10, -13); g.lineTo(-3, -10);
    g.moveTo(3, -10);   g.lineTo(10, -13);
    g.strokePath();
    g.fillStyle(0x552222, 1); g.fillEllipse(0, 10, 13, 10);
    g.fillStyle(0xffaaaa, 1); g.fillEllipse(0, 11, 8, 6);
    container.add(g);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  TP BAR UPDATE
  // ──────────────────────────────────────────────────────────────────────────
  updateTPBar(stall) {
    const pct = Math.max(0, stall.paperLevel) / 100;
    stall.barFill.setScale(Math.max(0.001, pct), 1);
    stall.tpLabel.setText(`${Math.round(stall.paperLevel)}%`);

    const color =
      pct > 0.5  ? 0x44cc44 :
      pct > 0.25 ? 0xcccc44 :
      pct > 0.10 ? 0xdd8800 : 0xcc3333;
    stall.barFill.setFillStyle(color);

    stall.warnText.setVisible(stall.paperLevel <= 28 && stall.state !== S.LEAVING).setText('⚠');
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  JANITOR'S CLOSET
  // ──────────────────────────────────────────────────────────────────────────
  createCloset() {
    const g = this.add.graphics().setDepth(8);

    // Outer frame
    g.fillStyle(0x7a6050, 1);
    g.fillRect(CLOSET_X - CLOSET_W / 2 - 4, CLOSET_Y - CLOSET_H / 2 - 4,
               CLOSET_W + 8, CLOSET_H + 8);

    // Inner room
    g.fillStyle(0x9a8070, 1);
    g.fillRect(CLOSET_X - CLOSET_W / 2, CLOSET_Y - CLOSET_H / 2, CLOSET_W, CLOSET_H);

    // Shelf rolls (decoration)
    for (let i = 0; i < 3; i++) {
      const rx = CLOSET_X - 26 + i * 26;
      g.fillStyle(0xffffff, 1); g.fillCircle(rx, CLOSET_Y - 10, 10);
      g.fillStyle(0xdddddd, 1); g.fillCircle(rx, CLOSET_Y - 10, 4);
      g.lineStyle(1, 0xaaaaaa); g.strokeCircle(rx, CLOSET_Y - 10, 10);
    }

    // Label above closet
    this.add.text(CLOSET_X, CLOSET_Y - CLOSET_H / 2 - 18, "JANITOR'S\nCLOSET", {
      fontSize: '10px', fontFamily: 'Courier New', color: '#4a3020', fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(9);

    // Progress bar (fills while player is collecting)
    this.closetBarBg   = this.add.rectangle(
      CLOSET_X, CLOSET_Y + CLOSET_H / 2 + 10, CLOSET_W, 8, 0x444444,
    ).setDepth(9);
    this.closetBarFill = this.add.rectangle(
      CLOSET_X - CLOSET_W / 2, CLOSET_Y + CLOSET_H / 2 + 10, 0, 6, 0x44cc44,
    ).setOrigin(0, 0.5).setDepth(10);
    this.closetLabel = this.add.text(CLOSET_X, CLOSET_Y + CLOSET_H / 2 + 24, '', {
      fontSize: '11px', fontFamily: 'Courier New', color: '#44cc44',
    }).setOrigin(0.5).setDepth(10);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  PLAYER CHARACTER
  // ──────────────────────────────────────────────────────────────────────────
  createPlayer() {
    this.playerGfx      = this.add.graphics().setDepth(20);
    this.playerRollText = this.add.text(0, 0, '', {
      fontSize: '14px', fontFamily: 'Courier New',
    }).setDepth(21);
    this.drawPlayer();
  }

  drawPlayer() {
    const g = this.playerGfx;
    g.clear();
    const x = this.playerX;
    const y = this.playerY;

    // Shadow
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(x + 2, y + PLAYER_RADIUS, PLAYER_RADIUS * 2.6, 8);

    // Body
    g.fillStyle(0x4488cc, 1);
    g.fillCircle(x, y, PLAYER_RADIUS);
    g.fillStyle(0x66aaee, 0.45);
    g.fillCircle(x - 4, y - 4, 6);

    // Head
    g.fillStyle(0xf1c27d, 1);
    g.fillCircle(x, y - PLAYER_RADIUS - 7, 10);

    // Eyes
    g.fillStyle(0x222222, 1);
    g.fillCircle(x - 3, y - PLAYER_RADIUS - 8, 2);
    g.fillCircle(x + 3, y - PLAYER_RADIUS - 8, 2);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  INPUT
  // ──────────────────────────────────────────────────────────────────────────
  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  MOVEMENT
  // ──────────────────────────────────────────────────────────────────────────
  movePlayer(dt) {
    const { cursors, wasd } = this;
    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown  || wasd.left.isDown)  vx = -PLAYER_SPEED;
    if (cursors.right.isDown || wasd.right.isDown) vx =  PLAYER_SPEED;
    if (cursors.up.isDown    || wasd.up.isDown)    vy = -PLAYER_SPEED;
    if (cursors.down.isDown  || wasd.down.isDown)  vy =  PLAYER_SPEED;

    // Normalise diagonal movement
    if (vx !== 0 && vy !== 0) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }

    this.playerX = Phaser.Math.Clamp(
      this.playerX + vx * dt, FLOOR_LEFT + PLAYER_RADIUS, FLOOR_RIGHT - PLAYER_RADIUS,
    );
    this.playerY = Phaser.Math.Clamp(
      this.playerY + vy * dt, FLOOR_TOP + PLAYER_RADIUS, FLOOR_BOTTOM - PLAYER_RADIUS,
    );

    this.drawPlayer();
    this.playerRollText.setPosition(this.playerX + 16, this.playerY - 24);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  CLOSET INTERACTION
  // ──────────────────────────────────────────────────────────────────────────
  isInCloset() {
    return (
      this.playerX >= CLOSET_X - CLOSET_W / 2 - PLAYER_RADIUS &&
      this.playerX <= CLOSET_X + CLOSET_W / 2 + PLAYER_RADIUS &&
      this.playerY >= CLOSET_Y - CLOSET_H / 2 - PLAYER_RADIUS &&
      this.playerY <= CLOSET_Y + CLOSET_H / 2 + PLAYER_RADIUS
    );
  }

  checkClosetInteraction(delta) {
    if (!this.isInCloset()) {
      if (this.isCollecting) {
        this.isCollecting    = false;
        this.collectProgress = 0;
      }
      this.closetBarFill.setDisplaySize(0, 6);
      if (this.inventory >= MAX_INVENTORY) {
        this.closetLabel.setText('Inventory full!').setColor('#ffcc00');
      } else {
        this.closetLabel.setText('');
      }
      return;
    }

    if (this.inventory >= MAX_INVENTORY) {
      this.isCollecting    = false;
      this.collectProgress = 0;
      this.closetBarFill.setDisplaySize(0, 6);
      this.closetLabel.setText('Inventory full!').setColor('#ffcc00');
      return;
    }

    // In closet and needs rolls – accumulate time
    if (!this.isCollecting) {
      this.isCollecting    = true;
      this.collectProgress = 0;
      this.collectStart    = this.time.now;
    }

    this.collectProgress = Math.min(1, (this.time.now - this.collectStart) / COLLECT_INTERVAL);

    if (this.collectProgress >= 1) {
      this.inventory++;
      this.updateInvDisplay();
      this.showFloatingText(CLOSET_X, CLOSET_Y - CLOSET_H / 2 - 30, '+1 Roll! 🧻', '#44cc44');
      this.collectProgress = 0;
      this.collectStart    = this.time.now;
    }
  }

  updateClosetBar() {
    if (this.isCollecting && this.inventory < MAX_INVENTORY) {
      this.closetBarFill.setDisplaySize(CLOSET_W * this.collectProgress, 6);
      this.closetLabel.setText('Collecting...').setColor('#44cc44');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  STALL DELIVERY
  // ──────────────────────────────────────────────────────────────────────────
  checkStallDelivery() {
    const now = this.time.now;
    for (const stall of this.stallData) {
      const inZone = (
        this.playerY <= FLOOR_TOP + DELIVERY_ZONE_H &&
        Math.abs(this.playerX - stall.cx) < (STALL_W / 2 - WALL_W + 10)
      );
      const needsPaper = stall.state === S.OUT_OF_PAPER ||
                         (stall.state !== S.LEAVING && stall.paperLevel < REFILL_THRESHOLD);
      const canDeliver = inZone && this.inventory > 0 && needsPaper &&
                         (now - stall.lastDelivery) > DELIVER_COOLDOWN;

      // Update delivery zone glow
      stall.glowRect.setFillStyle(0x44ff44, inZone && this.inventory > 0 && needsPaper ? 0.55 : 0);

      if (canDeliver) this.deliverRoll(stall);
    }
  }

  deliverRoll(stall) {
    this.inventory--;
    this.updateInvDisplay();
    stall.lastDelivery = this.time.now;

    if (stall.state === S.OUT_OF_PAPER) {
      if (stall.graceTimer) { stall.graceTimer.remove(); stall.graceTimer = null; }
      this.tweens.killTweensOf(stall.faceContainer);
      stall.faceContainer.setX(stall.cx);
      stall.bubble.setText('Thanks!\n(barely!)');
      this.drawNPCFace(stall.faceContainer, stall.npcSkin, stall.npcHair);
      this.time.delayedCall(700, () => this.npcLeave(stall, true, true));
    } else {
      stall.paperLevel = 100;
      this.updateTPBar(stall);
      stall.warnText.setVisible(false);
      this.showFloatingText(stall.cx, STALL_TOP - 10, 'Refilled! 🧻', '#44cc44');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  UI
  // ──────────────────────────────────────────────────────────────────────────
  createUI() {
    const { width } = this.scale;

    this.scoreText = this.add.text(16, 8, 'Score: 0', {
      fontSize: '17px', fontFamily: 'Courier New', color: '#2a2010', fontStyle: 'bold',
    }).setDepth(50);

    this.timerText = this.add.text(width / 2, 8, `Time: ${ROUND_DURATION}`, {
      fontSize: '17px', fontFamily: 'Courier New', color: '#2a2010',
    }).setOrigin(0.5, 0).setDepth(50);

    this.livesText = this.add.text(width - 16, 8, '❤️ ❤️ ❤️', {
      fontSize: '17px', fontFamily: 'Courier New',
    }).setOrigin(1, 0).setDepth(50);

    this.add.text(width / 2, 44, '🧻  SPARE A SQUARE RUSH  🧻', {
      fontSize: '15px', fontFamily: 'Courier New', color: '#5a3020', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Inventory row at the very bottom
    const invY = 534;
    this.add.text(16, invY, 'CARRYING:', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#4a3020', fontStyle: 'bold',
    }).setDepth(50);

    this.invRolls = [];
    for (let i = 0; i < MAX_INVENTORY; i++) {
      const g = this.add.graphics().setDepth(50);
      this.invRolls.push(g);
      this.drawInvRoll(g, false, 108 + i * 42, invY + 8);
    }

    this.invCountText = this.add.text(108 + MAX_INVENTORY * 42, invY, `0/${MAX_INVENTORY}`, {
      fontSize: '12px', fontFamily: 'Courier New', color: '#666666',
    }).setDepth(50);

    // Controls hint
    this.add.text(width / 2, 548, '⬆⬇⬅➡ / WASD: Move    Walk to CLOSET: collect    Walk to STALL: deliver', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#777777',
    }).setOrigin(0.5, 0).setDepth(50);
  }

  drawInvRoll(g, active, x, y) {
    g.clear();
    if (active) {
      g.fillStyle(0xffffff, 1);   g.fillCircle(x, y, 14);
      g.fillStyle(0xdddddd, 1);   g.fillCircle(x, y, 4);
      g.lineStyle(2, 0x999999);   g.strokeCircle(x, y, 14);
      g.lineStyle(1, 0xcccccc, 0.6);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        g.lineBetween(
          x + Math.cos(a) * 5, y + Math.sin(a) * 5,
          x + Math.cos(a) * 12, y + Math.sin(a) * 12,
        );
      }
    } else {
      g.lineStyle(1, 0xcccccc, 0.4); g.strokeCircle(x, y, 14);
      g.fillStyle(0xc8a064, 0.3);   g.fillCircle(x, y, 4);
    }
  }

  updateInvDisplay() {
    this.invRolls.forEach((g, i) => {
      this.drawInvRoll(g, i < this.inventory, 108 + i * 42, 542);
    });
    this.invCountText.setText(`${this.inventory}/${MAX_INVENTORY}`);
    // Show roll emoji above player head
    this.playerRollText.setText(this.inventory > 0 ? '🧻'.repeat(this.inventory) : '');
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  GAME LOGIC
  // ──────────────────────────────────────────────────────────────────────────
  startGame() {
    this.isPlaying = true;
    this.score     = 0;
    this.lives     = STARTING_LIVES;
    this.timeLeft  = ROUND_DURATION;
    this.inventory = 0;
    this.deplRate  = BASE_DEPLETION;
    this.updateInvDisplay();

    // Reset player to start position
    this.playerX = 380;
    this.playerY = FLOOR_TOP + Math.round((FLOOR_BOTTOM - FLOOR_TOP) / 2);

    this.timerEvent = this.time.addEvent({
      delay: 1000, callback: this.tick, callbackScope: this, loop: true,
    });

    this.scheduleNextNPC();
    this.spawnNPC();  // spawn first NPC immediately
  }

  tick() {
    this.timeLeft--;
    this.timerText.setText(`Time: ${this.timeLeft}`);
    if (this.timeLeft <= 10) this.timerText.setColor('#ff2222');

    if (this.timeLeft <= RAMP_MID_TIME  && this.deplRate < DEPLETION_MID)  this.deplRate = DEPLETION_MID;
    if (this.timeLeft <= RAMP_HARD_TIME && this.deplRate < DEPLETION_HARD) this.deplRate = DEPLETION_HARD;

    if (this.timeLeft <= 0) this.endGame();
  }

  updateStalls(dt) {
    this.stallData.forEach(stall => {
      if (stall.state === S.OCCUPIED) {
        stall.paperLevel = Math.max(0, stall.paperLevel - this.deplRate * dt);
        this.updateTPBar(stall);
        if (stall.paperLevel <= 0) this.stallPaperOut(stall);
      }
    });
  }

  scheduleNextNPC() {
    if (!this.isPlaying) return;
    const delay = Phaser.Math.Between(SPAWN_MIN, SPAWN_MAX);
    this.time.delayedCall(delay, () => {
      if (!this.isPlaying) return;
      this.spawnNPC();
      this.scheduleNextNPC();
    });
  }

  spawnNPC() {
    const empty = this.stallData.filter(s => s.state === S.EMPTY);
    if (empty.length === 0) return;
    this.enterStall(Phaser.Utils.Array.GetRandom(empty));
  }

  enterStall(stall) {
    stall.state      = S.OCCUPIED;
    stall.npcSkin    = Phaser.Utils.Array.GetRandom(SKIN_TONES);
    stall.npcHair    = Phaser.Utils.Array.GetRandom(HAIR_COLORS);

    this.drawNPCFace(stall.faceContainer, stall.npcSkin, stall.npcHair);
    stall.faceContainer.setVisible(true).setAlpha(1);
    stall.feetG.setVisible(true).setAlpha(1);
    stall.statusText.setText('OCCUPIED').setColor('#cc4444');
    this.refreshDoorColor(stall);
    this.updateTPBar(stall);

    // Slide-in animation
    const origY = stall.faceContainer.y;
    stall.faceContainer.setY(origY - 35);
    this.tweens.add({ targets: stall.faceContainer, y: origY, duration: 280, ease: 'Back.easeOut' });

    // Schedule natural departure
    const stay = Phaser.Math.Between(NPC_MIN_STAY, NPC_MAX_STAY);
    stall.stayTimer = this.time.delayedCall(stay, () => {
      if (stall.state === S.OCCUPIED) this.npcLeave(stall, true);
    });
  }

  stallPaperOut(stall) {
    if (stall.state !== S.OCCUPIED) return;
    stall.state      = S.OUT_OF_PAPER;
    stall.paperLevel = 0;

    if (stall.stayTimer) { stall.stayTimer.remove(); stall.stayTimer = null; }

    this.drawNPCFaceDistressed(stall.faceContainer, stall.npcSkin, stall.npcHair);

    const pleas = [
      'Can you spare\na square?!',
      'I need a\nsquare! Please!',
      'No paper!!\nHelp!',
      "I don't have\na square to spare!",
    ];
    stall.bubble.setText(Phaser.Utils.Array.GetRandom(pleas)).setVisible(true);
    stall.warnText.setText('❗').setVisible(true);
    this.refreshDoorColor(stall);

    // Shake NPC
    this.tweens.add({
      targets: stall.faceContainer,
      x: stall.cx + 6,
      duration: 70,
      yoyo: true,
      repeat: -1,
    });

    this.cameras.main.shake(100, 0.005);

    // Grace period – player must walk over before this fires
    stall.graceTimer = this.time.delayedCall(GRACE_PERIOD, () => {
      if (stall.state === S.OUT_OF_PAPER) this.npcLeave(stall, false);
    });
  }

  // happy = true → satisfied exit; barely = true → rescued at the last second
  npcLeave(stall, happy, barely = false) {
    if (stall.state === S.LEAVING) return;
    stall.state = S.LEAVING;

    if (stall.stayTimer)  { stall.stayTimer.remove();  stall.stayTimer  = null; }
    if (stall.graceTimer) { stall.graceTimer.remove(); stall.graceTimer = null; }

    this.tweens.killTweensOf(stall.faceContainer);
    stall.faceContainer.setX(stall.cx);
    stall.bubble.setVisible(false);
    stall.warnText.setVisible(false);
    stall.glowRect.setFillStyle(0x44ff44, 0);

    if (happy) {
      const pts = barely ? 5 : 15;
      this.score += pts;
      this.scoreText.setText(`Score: ${this.score}`);
      this.showEmoji(stall.cx, STALL_TOP - 8, barely ? '😅' : '😊');
      this.showFloatingText(stall.cx + 28, STALL_TOP - 8, `+${pts}`, '#00cc00');
    } else {
      this.lives--;
      this.updateLives();
      this.cameras.main.shake(260, 0.013);
      this.showEmoji(stall.cx, STALL_TOP - 8, '😡');

      const { width, height } = this.scale;
      const bigMsg = this.add.text(width / 2, height / 2 - 40, 'NOT A SQUARE TO SPARE!', {
        fontSize: '30px', fontFamily: 'Courier New', color: '#ff2222',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(200).setAlpha(0);
      this.tweens.add({
        targets: bigMsg, alpha: 1, scaleX: 1.1, scaleY: 1.1,
        duration: 280, yoyo: true, hold: 500,
        onComplete: () => bigMsg.destroy(),
      });

      if (this.lives <= 0) {
        this.time.delayedCall(600, () => this.endGame());
        return;
      }
    }

    // Slide NPC out upward
    this.tweens.add({
      targets: stall.faceContainer,
      y: stall.faceContainer.y - 55,
      alpha: 0,
      duration: 380,
      onComplete: () => {
        stall.faceContainer.setVisible(false).setAlpha(1);
        stall.faceContainer.setY(NPC_FACE_Y);
        stall.faceContainer.setX(stall.cx);
      },
    });
    this.tweens.add({
      targets: stall.feetG,
      alpha: 0,
      duration: 280,
      onComplete: () => { stall.feetG.setVisible(false).setAlpha(1); },
    });

    this.time.delayedCall(400, () => {
      stall.state      = S.EMPTY;
      stall.npcSkin    = null;
      stall.npcHair    = null;
      stall.statusText.setText('VACANT').setColor('#33aa33');
      this.updateTPBar(stall);
      this.refreshDoorColor(stall);
    });
  }

  refreshDoorColor(stall) {
    const colors = {
      [S.EMPTY]:        0xb8a488,
      [S.OCCUPIED]:     0x9a7858,
      [S.OUT_OF_PAPER]: 0xaa3030,
      [S.LEAVING]:      0xb8a488,
    };
    stall.door.setFillStyle(colors[stall.state] ?? 0xb8a488);
  }

  updateLives() {
    const h = [];
    for (let i = 0; i < STARTING_LIVES; i++) h.push(i < this.lives ? '❤️' : '🖤');
    this.livesText.setText(h.join(' '));
  }

  showFloatingText(x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontSize: '13px', fontFamily: 'Courier New', color, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: t, y: y - 32, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  showEmoji(x, y, emoji) {
    const e = this.add.text(x, y, emoji, { fontSize: '28px' }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: e, y: y - 48, alpha: 0, duration: 900, onComplete: () => e.destroy() });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  END GAME
  // ──────────────────────────────────────────────────────────────────────────
  endGame() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.timerEvent) this.timerEvent.remove();

    this.stallData.forEach(s => {
      if (s.stayTimer)  s.stayTimer.remove();
      if (s.graceTimer) s.graceTimer.remove();
    });

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.76).setDepth(150);

    const reason = this.lives <= 0
      ? 'Too many squares not spared!'
      : "Time's up! The bathroom is closed.";

    this.add.text(width / 2, height / 2 - 100, 'NOT A SQUARE TO SPARE!', {
      fontSize: '28px', fontFamily: 'Courier New', color: '#ff3333',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 58, reason, {
      fontSize: '14px', fontFamily: 'Courier New', color: '#cccccc',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 16, `Final Score: ${this.score}`, {
      fontSize: '28px', fontFamily: 'Courier New', color: '#ffcc00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    const retryBtn = this.add.text(width / 2, height / 2 + 50, '[ PLAY AGAIN ]', {
      fontSize: '20px', fontFamily: 'Courier New', color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });
    retryBtn.on('pointerover', () => retryBtn.setColor('#ff3333'));
    retryBtn.on('pointerout',  () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    const menuBtn = this.add.text(width / 2, height / 2 + 95, '[ BACK TO MENU ]', {
      fontSize: '16px', fontFamily: 'Courier New', color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout',  () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  addBackButton() {
    const btn = this.add.text(16, 576, '← Back to Menu', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#888888',
    }).setInteractive({ useHandCursor: true }).setDepth(50);
    btn.on('pointerover', () => btn.setColor('#e94560'));
    btn.on('pointerout',  () => btn.setColor('#888888'));
    btn.on('pointerdown', () => {
      this.isPlaying = false;
      if (this.timerEvent) this.timerEvent.remove();
      this.stallData.forEach(s => {
        if (s.stayTimer)  s.stayTimer.remove();
        if (s.graceTimer) s.graceTimer.remove();
      });
      this.scene.start('MenuScene');
    });
  }
}
