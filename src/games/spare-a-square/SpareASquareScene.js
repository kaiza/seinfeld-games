import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * Spare a Square Rush
 *
 * Inspired by "The Stall" (S5E12). Manage toilet paper inventory
 * for four bathroom stalls. Refill stalls before NPCs run out of paper
 * or hear: "I don't have a square to spare!"
 *
 * Controls:
 *  - Click the supply cart to collect a new roll.
 *  - Click an occupied stall to deliver a roll and refill it.
 *  - If a stall runs out, click fast before the NPC gets angry!
 */

// ── Layout constants ──────────────────────────────────────────────────────────
const NUM_STALLS   = 4;
const STALL_CX     = [125, 300, 475, 650];   // horizontal centres
const STALL_W      = 140;                     // total stall width (incl. walls)
const WALL_W       = 8;
const STALL_TOP    = 80;
const STALL_BOTTOM = 360;
const DOOR_TOP     = STALL_TOP + 28;
const DOOR_BOTTOM  = STALL_BOTTOM - 4;
const NPC_FACE_Y   = DOOR_TOP + 36;          // NPC head inside stall
const TP_BAR_Y     = STALL_BOTTOM + 22;

const INV_Y        = 445;   // inventory bar centre-y
const SUPPLY_CX    = 690;   // supply cart centre-x
const SUPPLY_CY    = 510;   // supply cart centre-y

// ── Game tuning ───────────────────────────────────────────────────────────────
const ROUND_DURATION   = 90;    // seconds
const STARTING_LIVES   = 3;
const MAX_INVENTORY    = 5;
const GRACE_PERIOD     = 4000;  // ms player has to give paper once stall runs out
const NPC_MIN_STAY     = 5500;  // ms NPCs stay in stall
const NPC_MAX_STAY     = 14000;
const SPAWN_MIN        = 2000;  // ms between NPC spawns
const SPAWN_MAX        = 5000;
const SUPPLY_INTERVAL  = 5000;  // ms between new supply rolls
const BASE_DEPLETION   = 6.5;   // % per second at game start
const DEPLETION_MID    = 8.5;   // % per second after 30 s elapsed
const DEPLETION_HARD   = 11.5;  // % per second after 60 s elapsed
const RAMP_MID_TIME    = 60;    // timeLeft value that triggers mid difficulty
const RAMP_HARD_TIME   = 30;    // timeLeft value that triggers hard difficulty

// ── Visual palettes ───────────────────────────────────────────────────────────
const SKIN_TONES   = [0xf1c27d, 0xd4a574, 0xc68642, 0x8d5524, 0xffdbac, 0xe0ac69];
const HAIR_COLORS  = [0x222222, 0x443322, 0x8b6508, 0xa52a2a, 0xd4a76a, 0x333333];

// ── Stall states ──────────────────────────────────────────────────────────────
const S = { EMPTY: 'empty', OCCUPIED: 'occupied', OUT_OF_PAPER: 'out', LEAVING: 'leaving' };

export class SpareASquareScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SpareASquareScene' });
  }

  init() {
    this.score         = 0;
    this.lives         = STARTING_LIVES;
    this.timeLeft      = ROUND_DURATION;
    this.isPlaying     = false;
    this.inventory     = 2;
    this.stallData     = [];
    this.supplyAvail      = false;
    this.deplRate         = BASE_DEPLETION;
    this.supplyArriveTimer = null;
    this.supplyExpireTimer = null;
    this.supplyBarEvent    = null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  CREATE
  // ──────────────────────────────────────────────────────────────────────────
  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    this.drawBathroom(width, height);
    this.createStalls();
    this.createUI();
    this.createInventoryArea(width);
    this.createSupplyCart();

    // ── Start-screen overlay ─────────────────────────────────────────────────
    const ov = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.62).setDepth(90);
    const title = this.add.text(width / 2, height / 2 - 70, '🧻  SPARE A SQUARE RUSH  🧻', {
      fontSize: '21px', fontFamily: 'Courier New', color: '#ffcc00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(91);

    const lines = [
      'Manage the toilet paper for bathroom stalls.',
      'Click the SUPPLY CART to collect new rolls.',
      'Click an OCCUPIED stall to refill paper.',
      'If a stall runs out you have 4 seconds to help',
      "or the NPC won't spare a square for YOU!",
    ];
    const inst = this.add.text(width / 2, height / 2 + 5, lines.join('\n'), {
      fontSize: '13px', fontFamily: 'Courier New', color: '#dddddd', align: 'center',
    }).setOrigin(0.5).setDepth(91);

    const btn = this.add.text(width / 2, height / 2 + 105, '[ CLICK TO START ]', {
      fontSize: '20px', fontFamily: 'Courier New', color: '#ffcc00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(91).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout',  () => btn.setColor('#ffcc00'));

    this.input.once('pointerdown', () => {
      ov.destroy(); title.destroy(); inst.destroy(); btn.destroy();
      this.startGame();
    });

    this.addBackButton();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  UPDATE (per-frame paper depletion)
  // ──────────────────────────────────────────────────────────────────────────
  update(_time, delta) {
    if (!this.isPlaying) return;
    const dt = delta / 1000;
    this.stallData.forEach(stall => {
      if (stall.state === S.OCCUPIED) {
        stall.paperLevel = Math.max(0, stall.paperLevel - this.deplRate * dt);
        this.updateTPBar(stall);
        if (stall.paperLevel <= 0) {
          this.stallPaperOut(stall);
        }
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  DRAWING – bathroom background
  // ──────────────────────────────────────────────────────────────────────────
  drawBathroom(width, height) {
    const g = this.add.graphics();

    // Wall tiles (beige)
    g.fillStyle(0xede0cc, 1);
    g.fillRect(0, 0, width, STALL_BOTTOM + 18);
    g.lineStyle(1, 0xd4c8b4, 0.6);
    for (let x = 0; x <= width; x += 40)          g.lineBetween(x, 0, x, STALL_BOTTOM + 18);
    for (let y = 0; y <= STALL_BOTTOM + 18; y += 40) g.lineBetween(0, y, width, y);

    // Floor (checkerboard)
    const fy = STALL_BOTTOM + 18;
    for (let ty = fy; ty < height; ty += 26) {
      for (let tx = 0; tx < width; tx += 26) {
        const lit = (Math.floor(tx / 26) + Math.floor((ty - fy) / 26)) % 2 === 0;
        g.fillStyle(lit ? 0xd8ccc0 : 0xbcb0a4, 1);
        g.fillRect(tx, ty, 26, 26);
      }
    }

    // Ceiling strip
    g.fillStyle(0xe0d4c0, 1);
    g.fillRect(0, 0, width, STALL_TOP);
    g.lineStyle(2, 0xc8bca8);
    g.lineBetween(0, STALL_TOP, width, STALL_TOP);

    // Fluorescent-light fixture decoration
    for (let lx = 100; lx < width; lx += 200) {
      g.fillStyle(0xfffff0, 0.6);
      g.fillRect(lx - 40, 8, 80, 14);
      g.lineStyle(1, 0xd8d4c0);
      g.strokeRect(lx - 40, 8, 80, 14);
    }
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
    wallG.fillRect(cx - STALL_W / 2,           STALL_TOP, WALL_W, STALL_BOTTOM - STALL_TOP);
    wallG.fillRect(cx + STALL_W / 2 - WALL_W,  STALL_TOP, WALL_W, STALL_BOTTOM - STALL_TOP);
    // Top rail
    wallG.fillStyle(0x7a6050, 1);
    wallG.fillRect(cx - STALL_W / 2, STALL_TOP, STALL_W, 10);

    // Door
    const door = this.add.rectangle(cx, doorMidY, innerW, doorH, 0xb8a488)
      .setStrokeStyle(3, 0x8a7060)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);

    // Hinge decorations
    const hingeG = this.add.graphics().setDepth(4);
    hingeG.fillStyle(0x888880, 1);
    hingeG.fillRect(cx + innerW / 2 - 8, DOOR_TOP + 20, 8, 14);
    hingeG.fillRect(cx + innerW / 2 - 8, DOOR_BOTTOM - 34, 8, 14);

    // Status text on door
    const statusText = this.add.text(cx, DOOR_TOP + 20, 'VACANT', {
      fontSize: '13px', fontFamily: 'Courier New', color: '#33aa33', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    // NPC face container (inside stall)
    const faceContainer = this.add.container(cx, NPC_FACE_Y).setDepth(6).setVisible(false);

    // Speech bubble for "no paper!" plea
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

    // TP level bar
    const barBg = this.add.rectangle(cx, TP_BAR_Y, innerW, 12, 0x444444).setDepth(3);
    const barFill = this.add.rectangle(barLeftX, TP_BAR_Y, barFullW, 8, 0x44cc44)
      .setOrigin(0, 0.5).setDepth(4);
    const tpLabel = this.add.text(cx, TP_BAR_Y + 14, '100%', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#4a3828',
    }).setOrigin(0.5).setDepth(4);

    // Warning indicator (above stall)
    const warnText = this.add.text(cx, STALL_TOP - 18, '', {
      fontSize: '20px', fontFamily: 'Courier New', color: '#ff6600',
    }).setOrigin(0.5).setDepth(6).setVisible(false);

    // ── Stall data object ──────────────────────────────────────────────────
    const stall = {
      idx, cx,
      door, statusText, faceContainer, bubble,
      feetG, barBg, barFill, tpLabel, warnText,
      barLeftX, barFullW,
      state: S.EMPTY,
      paperLevel: 100,
      npcSkin: null, npcHair: null,
      stayTimer: null, graceTimer: null,
    };

    // Click to deliver paper
    door.on('pointerdown', () => {
      if (!this.isPlaying) return;
      this.handleStallClick(stall);
    });
    door.on('pointerover', () => {
      if (stall.state === S.OCCUPIED || stall.state === S.OUT_OF_PAPER) {
        door.setFillStyle(0xd4bc9c);
      }
    });
    door.on('pointerout', () => this.refreshDoorColor(stall));

    return stall;
  }

  // ── NPC face drawings ──────────────────────────────────────────────────────
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
    g.moveTo(4, -12);  g.lineTo(10, -10);
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
    // Wide shocked eyes
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-7, -2, 11, 10); g.fillEllipse(7, -2, 11, 10);
    g.fillStyle(0x222222, 1);
    g.fillCircle(-6, -2, 3.5); g.fillCircle(8, -2, 3.5);
    // Panicked eyebrows
    g.lineStyle(2, hair, 1);
    g.beginPath();
    g.moveTo(-10, -13); g.lineTo(-3, -10);
    g.moveTo(3, -10);  g.lineTo(10, -13);
    g.strokePath();
    // Open distressed mouth
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

    if (stall.state === S.OCCUPIED) {
      stall.warnText.setVisible(stall.paperLevel <= 28).setText('⚠');
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

    this.add.text(width / 2, 47, '🧻  SPARE A SQUARE RUSH  🧻', {
      fontSize: '17px', fontFamily: 'Courier New', color: '#5a3020', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  INVENTORY BAR (bottom-left)
  // ──────────────────────────────────────────────────────────────────────────
  createInventoryArea(width) {
    // Background panel
    this.add.rectangle(220, INV_Y, 430, 60, 0x8a7060, 0.25)
      .setStrokeStyle(1, 0x8a7060)
      .setDepth(15);

    this.add.text(16, INV_Y - 22, 'YOUR ROLLS:', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#4a3020', fontStyle: 'bold',
    }).setDepth(20);

    this.invCountText = this.add.text(width / 2 - 20, INV_Y - 22, `${this.inventory}/${MAX_INVENTORY}`, {
      fontSize: '12px', fontFamily: 'Courier New', color: '#666666',
    }).setOrigin(0.5, 0).setDepth(20);

    this.invRolls = [];
    for (let i = 0; i < MAX_INVENTORY; i++) {
      const rx = 30 + i * 60;
      const g  = this.add.graphics().setDepth(20);
      this.invRolls.push(g);
      this.drawInvRoll(g, i < this.inventory, rx, INV_Y);
    }
  }

  drawInvRoll(g, active, x, y) {
    g.clear();
    if (active) {
      g.fillStyle(0xffffff, 1);   g.fillCircle(x, y, 18);
      g.fillStyle(0xdddddd, 1);   g.fillCircle(x, y, 5);
      g.lineStyle(2, 0x999999);   g.strokeCircle(x, y, 18);
      // paper lines
      g.lineStyle(1, 0xcccccc, 0.6);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        g.lineBetween(x + Math.cos(a) * 6, y + Math.sin(a) * 6,
                      x + Math.cos(a) * 16, y + Math.sin(a) * 16);
      }
    } else {
      g.lineStyle(1, 0xcccccc, 0.4);
      g.strokeCircle(x, y, 18);
      g.fillStyle(0xc8a064, 0.3);
      g.fillCircle(x, y, 5);
    }
  }

  updateInvDisplay() {
    this.invRolls.forEach((g, i) => {
      this.drawInvRoll(g, i < this.inventory, 30 + i * 60, INV_Y);
    });
    this.invCountText.setText(`${this.inventory}/${MAX_INVENTORY}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  SUPPLY CART
  // ──────────────────────────────────────────────────────────────────────────
  createSupplyCart() {
    this.add.rectangle(SUPPLY_CX, SUPPLY_CY - 4, 175, 90, 0x8a7060, 0.22)
      .setStrokeStyle(1, 0x8a7060)
      .setDepth(15);

    this.add.text(SUPPLY_CX, SUPPLY_CY - 46, 'SUPPLY CART', {
      fontSize: '11px', fontFamily: 'Courier New', color: '#4a3020', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);

    this.supplyGfx = this.add.graphics().setDepth(20);
    this.drawSupplyRoll(false);

    this.supplyLabel = this.add.text(SUPPLY_CX, SUPPLY_CY + 30, 'EMPTY', {
      fontSize: '11px', fontFamily: 'Courier New', color: '#999999',
    }).setOrigin(0.5).setDepth(20);

    const hitZone = this.add.rectangle(SUPPLY_CX, SUPPLY_CY, 70, 60, 0, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(21);
    hitZone.on('pointerdown', () => {
      if (!this.isPlaying || !this.supplyAvail) return;
      this.collectRoll(hitZone);
    });
    hitZone.on('pointerover', () => {
      if (this.supplyAvail) this.supplyGfx.setScale(1.1);
    });
    hitZone.on('pointerout', () => this.supplyGfx.setScale(1));

    this.supplyTimerBar = this.add.graphics().setDepth(20);
  }

  drawSupplyRoll(available) {
    const g = this.supplyGfx;
    g.clear();
    if (available) {
      // Holder arm
      g.fillStyle(0xaaaaaa, 1); g.fillRect(SUPPLY_CX - 3, SUPPLY_CY - 30, 6, 8);
      // Roll
      g.fillStyle(0xdddddd, 0.35); g.fillCircle(SUPPLY_CX + 2, SUPPLY_CY + 2, 22);
      g.fillStyle(0xffffff, 1);   g.fillCircle(SUPPLY_CX, SUPPLY_CY, 21);
      g.fillStyle(0xdddddd, 1);   g.fillCircle(SUPPLY_CX, SUPPLY_CY, 5);
      g.lineStyle(2, 0x888888);   g.strokeCircle(SUPPLY_CX, SUPPLY_CY, 21);
      g.lineStyle(1, 0xcccccc, 0.5);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        g.lineBetween(SUPPLY_CX + Math.cos(a) * 7, SUPPLY_CY + Math.sin(a) * 7,
                      SUPPLY_CX + Math.cos(a) * 19, SUPPLY_CY + Math.sin(a) * 19);
      }
    } else {
      g.fillStyle(0xaaaaaa, 1); g.fillRect(SUPPLY_CX - 3, SUPPLY_CY - 30, 6, 8);
      g.fillStyle(0xc8a064, 0.3); g.fillCircle(SUPPLY_CX, SUPPLY_CY, 21);
      g.fillStyle(0xc8a064, 0.5); g.fillCircle(SUPPLY_CX, SUPPLY_CY, 6);
      g.lineStyle(1, 0xbbbbbb, 0.3); g.strokeCircle(SUPPLY_CX, SUPPLY_CY, 21);
    }
  }

  scheduleSupplyRoll() {
    if (!this.isPlaying) return;
    this.supplyAvail = false;
    this.drawSupplyRoll(false);
    this.supplyLabel.setText('EMPTY').setColor('#999999');
    this.supplyTimerBar.clear();

    // Countdown bar
    const barLeft = SUPPLY_CX - 60;
    const barY    = SUPPLY_CY + 42;
    const barMaxW = 120;
    this.supplyCountStart = this.time.now;

    this.supplyArriveTimer = this.time.delayedCall(SUPPLY_INTERVAL, () => {
      if (!this.isPlaying) return;
      if (this.inventory >= MAX_INVENTORY) {
        // Full inventory — skip and reschedule
        this.time.delayedCall(2000, () => this.scheduleSupplyRoll());
        return;
      }
      this.supplyAvail = true;
      this.drawSupplyRoll(true);
      this.supplyLabel.setText('CLICK!').setColor('#ff6600');
      this.supplyTimerBar.clear();

      // Pulse animation
      this.tweens.add({
        targets: this.supplyGfx,
        y: '-=8',
        duration: 230,
        yoyo: true,
        repeat: 3,
      });

      // Auto-expire after 8 seconds if not collected
      this.supplyExpireTimer = this.time.delayedCall(8000, () => {
        if (!this.supplyAvail) return;
        this.supplyAvail = false;
        this.drawSupplyRoll(false);
        this.supplyLabel.setText('MISSED').setColor('#cc4444');
        this.time.delayedCall(1200, () => this.scheduleSupplyRoll());
      });
    });

    // Draw countdown bar each frame via event
    this.supplyBarEvent = this.time.addEvent({
      delay: 50,
      callback: () => {
        if (!this.isPlaying || this.supplyAvail) { this.supplyTimerBar.clear(); return; }
        const elapsed = this.time.now - this.supplyCountStart;
        const pct     = Math.min(1, elapsed / SUPPLY_INTERVAL);
        this.supplyTimerBar.clear();
        this.supplyTimerBar.fillStyle(0x555555, 0.4);
        this.supplyTimerBar.fillRect(barLeft, barY, barMaxW, 6);
        this.supplyTimerBar.fillStyle(0xaaaaaa, 0.8);
        this.supplyTimerBar.fillRect(barLeft, barY, barMaxW * pct, 6);
      },
      loop: true,
    });
  }

  collectRoll(hitZone) {
    if (!this.supplyAvail || this.inventory >= MAX_INVENTORY) return;
    this.supplyAvail = false;
    if (this.supplyExpireTimer) this.supplyExpireTimer.remove();

    this.inventory++;
    this.updateInvDisplay();
    this.drawSupplyRoll(false);
    this.supplyLabel.setText('+1 Roll! 🧻').setColor('#44cc44');
    this.supplyGfx.setY(0);

    // Bounce feedback
    this.tweens.add({
      targets: this.supplyGfx,
      y: '-=15',
      alpha: 0,
      duration: 350,
      onComplete: () => {
        this.supplyGfx.setY(0).setAlpha(1);
        this.scheduleSupplyRoll();
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  GAME LOGIC
  // ──────────────────────────────────────────────────────────────────────────
  startGame() {
    this.isPlaying   = true;
    this.score       = 0;
    this.lives       = STARTING_LIVES;
    this.timeLeft    = ROUND_DURATION;
    this.inventory   = 2;
    this.deplRate    = BASE_DEPLETION;
    this.updateInvDisplay();

    this.timerEvent = this.time.addEvent({
      delay: 1000, callback: this.tick, callbackScope: this, loop: true,
    });

    this.scheduleSupplyRoll();
    this.scheduleNextNPC();
    this.spawnNPC();  // first NPC immediately
  }

  tick() {
    this.timeLeft--;
    this.timerText.setText(`Time: ${this.timeLeft}`);
    if (this.timeLeft <= 10) this.timerText.setColor('#ff2222');

    // Difficulty ramp
    if (this.timeLeft <= RAMP_MID_TIME  && this.deplRate < DEPLETION_MID)  this.deplRate = DEPLETION_MID;
    if (this.timeLeft <= RAMP_HARD_TIME && this.deplRate < DEPLETION_HARD) this.deplRate = DEPLETION_HARD;

    if (this.timeLeft <= 0) this.endGame();
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
    stall.paperLevel = 100;
    stall.npcSkin    = Phaser.Utils.Array.GetRandom(SKIN_TONES);
    stall.npcHair    = Phaser.Utils.Array.GetRandom(HAIR_COLORS);

    this.drawNPCFace(stall.faceContainer, stall.npcSkin, stall.npcHair);
    stall.faceContainer.setVisible(true).setAlpha(1);
    stall.feetG.setVisible(true).setAlpha(1);
    stall.statusText.setText('OCCUPIED').setColor('#cc4444');
    this.refreshDoorColor(stall);
    this.updateTPBar(stall);
    stall.warnText.setVisible(false);

    // Slide-in animation
    const origY = stall.faceContainer.y;
    stall.faceContainer.setY(origY - 35);
    this.tweens.add({ targets: stall.faceContainer, y: origY, duration: 280, ease: 'Back.easeOut' });

    // Schedule natural departure
    const stay = Phaser.Math.Between(NPC_MIN_STAY, NPC_MAX_STAY);
    stall.stayTimer = this.time.delayedCall(stay, () => {
      if (stall.state === S.OCCUPIED) this.npcFinished(stall);
    });
  }

  npcFinished(stall) {
    // If paper > 0, happy exit; if 0, it should already be OUT_OF_PAPER
    this.npcLeave(stall, true);
  }

  stallPaperOut(stall) {
    if (stall.state !== S.OCCUPIED) return;
    stall.state      = S.OUT_OF_PAPER;
    stall.paperLevel = 0;

    if (stall.stayTimer) { stall.stayTimer.remove(); stall.stayTimer = null; }

    // Update face to distressed
    this.drawNPCFaceDistressed(stall.faceContainer, stall.npcSkin, stall.npcHair);

    // Speech plea
    const pleas = [
      'Can you spare\na square?!',
      'I need a\nsquare!\nPlease!',
      'No paper!!\nHelp!',
      "I don't have\na square\nto spare!",
    ];
    stall.bubble.setText(Phaser.Utils.Array.GetRandom(pleas)).setVisible(true);
    stall.warnText.setText('❗').setVisible(true);
    this.refreshDoorColor(stall);

    // Shake the NPC
    this.tweens.add({
      targets: stall.faceContainer,
      x: stall.cx + 6,
      duration: 70,
      yoyo: true,
      repeat: -1,
    });

    this.cameras.main.shake(100, 0.005);

    // Grace period — player must click before this fires
    stall.graceTimer = this.time.delayedCall(GRACE_PERIOD, () => {
      if (stall.state === S.OUT_OF_PAPER) {
        this.npcLeave(stall, false);
      }
    });
  }

  handleStallClick(stall) {
    if (stall.state === S.OUT_OF_PAPER) {
      // Emergency: give a square
      if (this.inventory > 0) {
        this.inventory--;
        this.updateInvDisplay();
        if (stall.graceTimer) { stall.graceTimer.remove(); stall.graceTimer = null; }
        this.tweens.killTweensOf(stall.faceContainer);
        stall.faceContainer.setX(stall.cx);
        stall.bubble.setText('Thanks!\n(barely!)');
        this.drawNPCFace(stall.faceContainer, stall.npcSkin, stall.npcHair);
        this.time.delayedCall(700, () => this.npcLeave(stall, true, true));
      } else {
        this.showFloatingText(stall.cx, STALL_TOP - 10, 'No rolls left!', '#ff4444');
      }

    } else if (stall.state === S.OCCUPIED) {
      // Proactive refill
      if (this.inventory > 0) {
        this.inventory--;
        this.updateInvDisplay();
        stall.paperLevel = 100;
        this.updateTPBar(stall);
        stall.warnText.setVisible(false);
        this.showFloatingText(stall.cx, STALL_TOP - 10, 'Refilled! 🧻', '#44cc44');
      } else {
        this.showFloatingText(stall.cx, STALL_TOP - 10, 'No rolls!', '#ff4444');
      }
    }
  }

  // happy = true → NPC leaves satisfied; barely = true → only half points
  npcLeave(stall, happy, barely = false) {
    if (stall.state === S.LEAVING) return;
    stall.state = S.LEAVING;

    if (stall.stayTimer)  { stall.stayTimer.remove();  stall.stayTimer  = null; }
    if (stall.graceTimer) { stall.graceTimer.remove(); stall.graceTimer = null; }

    this.tweens.killTweensOf(stall.faceContainer);
    stall.faceContainer.setX(stall.cx);
    stall.bubble.setVisible(false);
    stall.warnText.setVisible(false);

    if (happy) {
      const pts = barely ? 5 : 15;
      this.score += pts;
      this.scoreText.setText(`Score: ${this.score}`);
      const emoji = barely ? '😅' : '😊';
      this.showEmoji(stall.cx, STALL_TOP - 8, emoji);
      this.showFloatingText(stall.cx + 28, STALL_TOP - 8, `+${pts}`, '#00cc00');
    } else {
      this.lives--;
      this.updateLives();
      this.cameras.main.shake(260, 0.013);
      this.showEmoji(stall.cx, STALL_TOP - 8, '😡');

      const { width, height } = this.scale;
      const bigMsg = this.add.text(width / 2, height / 2 - 40, "NOT A SQUARE TO SPARE!", {
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
      stall.paperLevel = 100;
      stall.npcSkin    = null;
      stall.npcHair    = null;
      stall.statusText.setText('VACANT').setColor('#33aa33');
      this.updateTPBar(stall);
      stall.warnText.setVisible(false);
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
    const e = this.add.text(x, y, emoji, { fontSize: '28px' })
      .setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: e, y: y - 48, alpha: 0, duration: 900, onComplete: () => e.destroy() });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  END GAME
  // ──────────────────────────────────────────────────────────────────────────
  endGame() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.timerEvent)       this.timerEvent.remove();
    if (this.supplyBarEvent)   this.supplyBarEvent.remove();
    if (this.supplyArriveTimer) this.supplyArriveTimer.remove();
    if (this.supplyExpireTimer) this.supplyExpireTimer.remove();

    this.stallData.forEach(s => {
      if (s.stayTimer)  s.stayTimer.remove();
      if (s.graceTimer) s.graceTimer.remove();
    });

    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.76).setDepth(150);

    const reason = this.lives <= 0
      ? "Too many squares not spared!"
      : "Time's up! The bathroom is closed.";

    this.add.text(width / 2, height / 2 - 100, "NOT A SQUARE TO SPARE!", {
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
      if (this.timerEvent)       this.timerEvent.remove();
      if (this.supplyBarEvent)   this.supplyBarEvent.remove();
      if (this.supplyArriveTimer) this.supplyArriveTimer.remove();
      if (this.supplyExpireTimer) this.supplyExpireTimer.remove();
      this.stallData.forEach(s => {
        if (s.stayTimer)  s.stayTimer.remove();
        if (s.graceTimer) s.graceTimer.remove();
      });
      this.scene.start('MenuScene');
    });
  }
}
