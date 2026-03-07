import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * The Place To Be!
 *
 * Choose Kramer or Frank (no pants!), pick your weapon, then take turns
 * sinking balls against a simulated opponent who uses the opposite weapon.
 * Estelle crashes the party every few minutes.
 */

const STATE = {
  CHAR_SELECT: 'charSelect',
  WEAPON_SELECT: 'weaponSelect',
  PLAYING: 'playing',
};

// Aim wobble: oscillation speed (rad/s) and max angular offset (rad)
const DIFFICULTY = {
  cue:    { speed: 2.5,  maxOffset: 0.40 },
  baton:  { speed: 0.7,  maxOffset: 0.12 },
  broken: { speed: 3.75, maxOffset: 0.60 }, // 1.5× cue
};

// CPU accuracy: random angle offset applied to each CPU shot
const CPU_ACCURACY = {
  cue:    0.28, // ± radians
  baton:  0.08,
  broken: 0.44,
};

const BALL_RADIUS = 9;
const POCKET_RADIUS = 20;
const BATON_BREAK_CHANCE = 0.25; // per ball pocketed with the baton

export class PlaceToBeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PlaceToBeScene' });
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  init() {
    this.gameState = STATE.CHAR_SELECT;
    this.selectedChar = null;
    this.selectedWeapon = null;
    this.opponentWeapon = null;

    // Player state
    this.batonBroken = false;
    this.playerScore = 0;

    // CPU state
    this.cpuBatonBroken = false;
    this.cpuScore = 0;
    this.cpuAimSet = false;

    // Turn state
    this.playerTurn = true;
    this.shotInProgress = false;
    this.shotHasMovedYet = false;
    this.aiTurnPending = false;

    // Aim/power
    this.aimAngle = Math.PI;
    this.aimWobbleOffset = 0;
    this.aimWobbleDir = 1;
    this.aimWobbleSpeed = 0;
    this.aimWobbleMaxOffset = 0;
    this.power = 0;
    this.powerCharging = false;
    this.powerDirection = 1;

    // Physics objects
    this.cueBall = null;
    this.targetBalls = [];
    this.totalBalls = 0;
    this.aimLine = null;
    this.cueStick = null;
    this.tableBounds = null;
    this.pocketPositions = [];

    // UI refs
    this.turnIndicatorText = null;
    this.playerScoreText = null;
    this.cpuScoreText = null;
    this.weaponText = null;
    this.cpuWeaponText = null;
    this.instrText = null;
    this.flashText = null;
    this.powerBarFill = null;

    // Game flow
    this.gameOver = false;

    // Estelle
    this.estelleVisible = false;
    this.estelleContainer = null;
    this.estelleTimer = null;
  }

  create() {
    ensureThemePlaying(this);
    this.showCharSelect();
  }

  // ------------------------------------------------------------------
  // SCREEN: Character Select
  // ------------------------------------------------------------------

  showCharSelect() {
    this.gameState = STATE.CHAR_SELECT;
    this._clearScene();

    const { width, height } = this.scale;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 1);
    bg.fillRect(0, 0, width, height);
    bg.fillGradientStyle(0x000000, 0x000000, 0x2a0000, 0x2a0000, 1);
    bg.fillRect(0, height * 0.55, width, height * 0.45);
    bg.lineStyle(2, 0x440000, 1);
    bg.lineBetween(0, height * 0.78, width, height * 0.78);

    this.add.text(width / 2, 48, 'CHOOSE YOUR FIGHTER', {
      fontSize: '38px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 7,
    }).setOrigin(0.5);

    this.add.text(width / 2, 92, '— The Place To Be —', {
      fontSize: '16px',
      fontFamily: 'Georgia, serif',
      color: '#888888',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.48, 'VS', {
      fontSize: '52px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#e94560',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setAlpha(0.35);

    this._createFighterCard(width * 0.27, height * 0.5, 'kramer');
    this._createFighterCard(width * 0.73, height * 0.5, 'frank');

    this.add.text(width / 2, height - 28, 'Click a fighter to select', {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#555555',
    }).setOrigin(0.5);

    this._addBackButton();
  }

  _createFighterCard(x, y, character) {
    const isKramer = character === 'kramer';

    const card = this.add.rectangle(x, y, 255, 370, 0x0d0d1e, 1)
      .setStrokeStyle(2, 0x222244)
      .setInteractive({ useHandCursor: true });

    const charContainer = this.add.container(x, y - 40);
    if (isKramer) {
      this._drawFighterKramer(charContainer);
    } else {
      this._drawFighterFrank(charContainer);
    }

    const nameBg = this.add.rectangle(x, y + 142, 255, 36, 0x1a0000, 1);
    const nameText = this.add.text(x, y + 143, isKramer ? 'KRAMER' : 'FRANK', {
      fontSize: '26px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const tagline = isKramer ? '"Giddy up!"' : '"Pool. My house. Tonight."';
    this.add.text(x, y + 167, tagline, {
      fontSize: '11px',
      fontFamily: 'Georgia, serif',
      color: '#666666',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    card.on('pointerover', () => {
      card.setFillStyle(0x1a1a33, 1);
      card.setStrokeStyle(3, 0xffcc00);
      nameText.setColor('#ffffff');
      nameBg.setFillStyle(0x330000, 1);
    });
    card.on('pointerout', () => {
      card.setFillStyle(0x0d0d1e, 1);
      card.setStrokeStyle(2, 0x222244);
      nameText.setColor('#ffcc00');
      nameBg.setFillStyle(0x1a0000, 1);
    });
    card.on('pointerup', () => {
      this.selectedChar = character;
      this.showWeaponSelect();
    });
  }

  // ------------------------------------------------------------------
  // SCREEN: Weapon Select
  // ------------------------------------------------------------------

  showWeaponSelect() {
    this.gameState = STATE.WEAPON_SELECT;
    this._clearScene();

    const { width, height } = this.scale;

    this.add.graphics().fillStyle(0x080812, 1).fillRect(0, 0, width, height);

    this.add.text(width / 2, 48, 'CHOOSE YOUR WEAPON', {
      fontSize: '36px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 7,
    }).setOrigin(0.5);

    const fighterName = this.selectedChar === 'kramer' ? 'KRAMER' : 'FRANK';
    const cpuName = this.selectedChar === 'kramer' ? 'FRANK' : 'KRAMER';
    this.add.text(width / 2, 90, `Fighter: ${fighterName}  vs  CPU: ${cpuName}`, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5);

    this._createWeaponCard(width * 0.28, height * 0.52, 'cue',
      'POOL CUE',
      'Old-fashioned technique.\nNotoriously hard to aim.\nCPU counters with baton.',
      0x8b6914);

    this._createWeaponCard(width * 0.72, height * 0.52, 'baton',
      "THE MAESTRO'S BATON",
      'Surprisingly effective.\nEasy to aim and control.\nCPU counters with cue.\nWarning: it might break!',
      0xddddee);

    this.add.text(width / 2, height - 28, 'CPU always uses the opposite weapon', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#444455',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    this._addBackButton();
  }

  _createWeaponCard(x, y, weapon, name, description, weaponColor) {
    const card = this.add.rectangle(x, y, 280, 330, 0x0d0d1e, 1)
      .setStrokeStyle(2, 0x222244)
      .setInteractive({ useHandCursor: true });

    const weaponG = this.add.graphics();
    if (weapon === 'cue') {
      weaponG.lineStyle(6, weaponColor, 1);
      weaponG.lineBetween(x - 70, y - 90, x + 70, y - 30);
      weaponG.lineStyle(3, 0xccaa55, 0.5);
      weaponG.lineBetween(x - 70, y - 90, x + 70, y - 30);
      weaponG.lineStyle(4, 0x4444aa, 1);
      weaponG.lineBetween(x - 70, y - 90, x - 60, y - 86);
    } else {
      weaponG.lineStyle(7, weaponColor, 1);
      weaponG.lineBetween(x - 55, y - 90, x + 55, y - 50);
      weaponG.lineStyle(2, 0xaaaacc, 1);
      weaponG.strokeCircle(x - 55, y - 90, 5);
      weaponG.strokeCircle(x + 55, y - 50, 5);
      weaponG.lineStyle(3, 0x888888, 0.5);
      weaponG.lineBetween(x + 25, y - 62, x + 55, y - 50);
    }

    const nameText = this.add.text(x, y + 20, name, {
      fontSize: '17px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(x, y + 85, description, {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#666666',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);

    card.on('pointerover', () => {
      card.setFillStyle(0x1a1a33, 1);
      card.setStrokeStyle(3, 0xffcc00);
      nameText.setColor('#ffffff');
    });
    card.on('pointerout', () => {
      card.setFillStyle(0x0d0d1e, 1);
      card.setStrokeStyle(2, 0x222244);
      nameText.setColor('#ffcc00');
    });
    card.on('pointerup', () => {
      this.selectedWeapon = weapon;
      this._startPoolGame();
    });
  }

  // ------------------------------------------------------------------
  // SCREEN: Pool Game
  // ------------------------------------------------------------------

  _startPoolGame() {
    this.gameState = STATE.PLAYING;
    this._clearScene();

    this.opponentWeapon = this.selectedWeapon === 'cue' ? 'baton' : 'cue';
    this.playerTurn = true;
    this.playerScore = 0;
    this.cpuScore = 0;
    this._updateDifficulty();

    this._drawRoom();
    this._drawPoolTable();
    this._setupBalls();
    this._setupInput();
    this._setupGameUI();
    this._scheduleEstelle();
    this._addBackButton();
  }

  _updateDifficulty() {
    const key = this.batonBroken ? 'broken' : this.selectedWeapon;
    this.aimWobbleSpeed = DIFFICULTY[key].speed;
    this.aimWobbleMaxOffset = DIFFICULTY[key].maxOffset;
  }

  // ------------------------------------------------------------------
  // Room + Table
  // ------------------------------------------------------------------

  _drawRoom() {
    const { width, height } = this.scale;
    const g = this.add.graphics();

    g.fillStyle(0x9aaa78, 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(0x8a9a68, 0.55);
    for (let rx = 0; rx < width; rx += 36) g.fillRect(rx, 0, 18, height);

    g.fillStyle(0xd4c9a0, 1);
    g.fillRect(0, 0, width, 18);
    g.fillStyle(0xc8b87a, 1);
    g.fillRect(0, height - 22, width, 22);

    g.fillStyle(0x9b6a1e, 1);
    g.fillRect(0, height * 0.77, width, height);
    g.lineStyle(1, 0x7a5210, 0.45);
    for (let fx = 0; fx < width; fx += 55) g.lineBetween(fx, height * 0.77, fx, height);

    // Framed picture
    g.fillStyle(0x6a5030, 1);
    g.fillRect(width - 110, 35, 80, 60);
    g.fillStyle(0xc0b090, 1);
    g.fillRect(width - 106, 39, 72, 52);
    g.fillStyle(0x8090a8, 0.5);
    g.fillRect(width - 100, 44, 60, 40);

    this.add.text(width / 2, 12, 'THE PLACE TO BE!', {
      fontSize: '22px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(10);
  }

  _drawPoolTable() {
    const { width, height } = this.scale;

    this.tableX = width / 2;
    this.tableY = height * 0.465;
    this.tableW = 490;
    this.tableH = 278;

    const g = this.add.graphics().setDepth(1);

    g.fillStyle(0x5c2e0a, 1);
    g.fillRoundedRect(
      this.tableX - this.tableW / 2 - 22, this.tableY - this.tableH / 2 - 22,
      this.tableW + 44, this.tableH + 44, 12);

    g.fillStyle(0x7a4418, 1);
    g.fillRoundedRect(
      this.tableX - this.tableW / 2 - 14, this.tableY - this.tableH / 2 - 14,
      this.tableW + 28, this.tableH + 28, 10);

    g.fillStyle(0x1a7a2e, 1);
    g.fillRect(this.tableX - this.tableW / 2, this.tableY - this.tableH / 2, this.tableW, this.tableH);

    g.lineStyle(1, 0x1e8a34, 0.25);
    for (let fy = this.tableY - this.tableH / 2 + 15; fy < this.tableY + this.tableH / 2; fy += 20) {
      g.lineBetween(this.tableX - this.tableW / 2, fy, this.tableX + this.tableW / 2, fy);
    }

    const cush = 9;
    g.fillStyle(0x229933, 1);
    g.fillRect(this.tableX - this.tableW / 2, this.tableY - this.tableH / 2, this.tableW, cush);
    g.fillRect(this.tableX - this.tableW / 2, this.tableY + this.tableH / 2 - cush, this.tableW, cush);
    g.fillRect(this.tableX - this.tableW / 2, this.tableY - this.tableH / 2, cush, this.tableH);
    g.fillRect(this.tableX + this.tableW / 2 - cush, this.tableY - this.tableH / 2, cush, this.tableH);

    this.pocketPositions = [
      { x: this.tableX - this.tableW / 2, y: this.tableY - this.tableH / 2 },
      { x: this.tableX + this.tableW / 2, y: this.tableY - this.tableH / 2 },
      { x: this.tableX - this.tableW / 2, y: this.tableY + this.tableH / 2 },
      { x: this.tableX + this.tableW / 2, y: this.tableY + this.tableH / 2 },
      { x: this.tableX,                   y: this.tableY - this.tableH / 2 },
      { x: this.tableX,                   y: this.tableY + this.tableH / 2 },
    ];

    this.pocketPositions.forEach(p => {
      g.fillStyle(0x000000, 1);
      g.fillCircle(p.x, p.y, POCKET_RADIUS + 1);
      g.lineStyle(1, 0x2a2a2a, 0.7);
      g.strokeCircle(p.x, p.y, POCKET_RADIUS + 1);
    });

    g.fillStyle(0x22903a, 0.6);
    g.fillCircle(this.tableX, this.tableY, 4);
    g.fillStyle(0x22903a, 0.5);
    g.fillCircle(this.tableX - this.tableW / 4, this.tableY, 3);
  }

  // ------------------------------------------------------------------
  // Balls + Input
  // ------------------------------------------------------------------

  _setupBalls() {
    const cbx = this.tableX - this.tableW / 4;
    const cby = this.tableY;
    this.cueBall = this.add.circle(cbx, cby, BALL_RADIUS, 0xffffff);
    this.cueBall.setStrokeStyle(1, 0xdddddd);
    this.physics.world.enable(this.cueBall);
    this.cueBall.body.setCircle(BALL_RADIUS);
    this.cueBall.body.setBounce(0.82);
    this.cueBall.body.setDrag(55);
    this.cueBall.body.setCollideWorldBounds(false);
    this.cueBall.setDepth(5);

    const colors = [0xe94560, 0xffcc00, 0x3355ee, 0x44aaee, 0xee7733, 0x44dd88];
    this.targetBalls = [];
    const spacing = BALL_RADIUS * 2 + 1.5;
    const apexX = this.tableX + this.tableW / 5;

    [1, 2, 3].forEach((count, row) => {
      for (let col = 0; col < count; col++) {
        const bx = apexX + row * spacing * 0.87;
        const by = this.tableY + (col - (count - 1) / 2) * spacing;
        const ball = this.add.circle(bx, by, BALL_RADIUS, colors[this.targetBalls.length]);
        ball.setStrokeStyle(1, 0x000000);
        this.physics.world.enable(ball);
        ball.body.setCircle(BALL_RADIUS);
        ball.body.setBounce(0.82);
        ball.body.setDrag(55);
        ball.body.setCollideWorldBounds(false);
        ball.setDepth(5);
        this.targetBalls.push(ball);
      }
    });

    this.totalBalls = this.targetBalls.length;
    this.physics.add.collider(this.cueBall, this.targetBalls);
    this.physics.add.collider(this.targetBalls, this.targetBalls);

    this.aimLine  = this.add.graphics().setDepth(6);
    this.cueStick = this.add.graphics().setDepth(6);

    this.aimAngle = Math.PI;
    this.aimWobbleOffset = 0;
    this.shotInProgress = false;
    this.shotHasMovedYet = false;

    const cush = 9;
    this.tableBounds = {
      left:   this.tableX - this.tableW / 2 + cush,
      right:  this.tableX + this.tableW / 2 - cush,
      top:    this.tableY - this.tableH / 2 + cush,
      bottom: this.tableY + this.tableH / 2 - cush,
    };
  }

  _setupInput() {
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  // ------------------------------------------------------------------
  // Game UI
  // ------------------------------------------------------------------

  _setupGameUI() {
    const { width, height } = this.scale;
    const playerName = this.selectedChar === 'kramer' ? 'KRAMER' : 'FRANK';
    const cpuName    = this.selectedChar === 'kramer' ? 'FRANK'  : 'KRAMER';

    // Player score (left)
    this.add.text(18, 28, `YOU (${playerName})`, {
      fontSize: '13px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#44dd88',
      stroke: '#000000',
      strokeThickness: 2,
    }).setDepth(10);

    this.playerScoreText = this.add.text(18, 45, '0 balls', {
      fontSize: '18px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#44dd88',
    }).setDepth(10);

    // CPU score (right)
    this.add.text(width - 18, 28, `CPU (${cpuName})`, {
      fontSize: '13px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#e94560',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(10);

    this.cpuScoreText = this.add.text(width - 18, 45, '0 balls', {
      fontSize: '18px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#e94560',
    }).setOrigin(1, 0).setDepth(10);

    // Turn indicator (center)
    this.turnIndicatorText = this.add.text(width / 2, 32, 'YOUR TURN', {
      fontSize: '16px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(10);

    // Player weapon label
    const pWName = this.selectedWeapon === 'cue' ? 'Pool Cue' : "Maestro's Baton";
    this.weaponText = this.add.text(18, 68, `Weapon: ${pWName}`, {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#aaaaaa',
    }).setDepth(10);

    // CPU weapon label
    const cWName = this.opponentWeapon === 'cue' ? 'Pool Cue' : "Maestro's Baton";
    this.cpuWeaponText = this.add.text(width - 18, 68, `CPU: ${cWName}`, {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#aaaaaa',
    }).setOrigin(1, 0).setDepth(10);

    // Power bar (right edge, vertical)
    const barX  = width - 22;
    const barCY = height / 2;
    const barH  = 140;
    this.add.rectangle(barX, barCY, 14, barH, 0x222233).setDepth(10);
    this.powerBarFill = this.add.rectangle(barX, barCY + barH / 2, 10, 0, 0xe94560)
      .setOrigin(0.5, 1).setDepth(11);
    this.add.text(barX, barCY - barH / 2 - 12, 'PWR', {
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(10);

    // Instructions
    this.instrText = this.add.text(width / 2, height - 18,
      '← → Aim  |  Hold SHIFT to charge, release to shoot', {
        fontSize: '12px',
        fontFamily: 'Courier New',
        color: '#aaaaaa',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 3 },
      }).setOrigin(0.5).setDepth(10);

    // Flash message
    this.flashText = this.add.text(width / 2, this.tableY - this.tableH / 2 - 36, '', {
      fontSize: '22px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(25).setVisible(false);
  }

  _updateTurnIndicator() {
    if (!this.turnIndicatorText) return;
    if (this.playerTurn) {
      this.turnIndicatorText.setText('YOUR TURN');
      this.turnIndicatorText.setColor('#ffcc00');
    } else {
      const cpuName = this.selectedChar === 'kramer' ? 'FRANK' : 'KRAMER';
      this.turnIndicatorText.setText(`${cpuName}'S TURN`);
      this.turnIndicatorText.setColor('#e94560');
    }
  }

  // ------------------------------------------------------------------
  // Game Loop
  // ------------------------------------------------------------------

  update(time, delta) {
    if (this.gameState !== STATE.PLAYING || this.gameOver) return;

    const dt = delta / 1000;
    const cbSpeed = this.cueBall?.body?.speed ?? 0;
    const anyMoving = cbSpeed > 4 ||
      this.targetBalls.some(b => b.visible && (b.body?.speed ?? 0) > 4);

    // Pocket checks first — before cushion bounce pushes balls away
    this._checkPockets();

    // Cushion bounce (skipped near pocket openings)
    if (this.cueBall) this._bounceOffCushions(this.cueBall);
    this.targetBalls.forEach(b => { if (b.visible) this._bounceOffCushions(b); });

    // Shot-end detection
    if (this.shotInProgress) {
      if (anyMoving) this.shotHasMovedYet = true;
      if (this.shotHasMovedYet && !anyMoving) {
        this.shotInProgress = false;
        this.shotHasMovedYet = false;
        this._onShotEnd();
        return;
      }
    }

    // Clear aim graphics while balls are moving
    if (anyMoving) {
      if (this.aimLine)  this.aimLine.clear();
      if (this.cueStick) this.cueStick.clear();
      return;
    }

    if (this.aiTurnPending) return;

    // Player turn input
    if (this.playerTurn) {
      this.aimWobbleOffset += this.aimWobbleSpeed * dt * this.aimWobbleDir;
      if (Math.abs(this.aimWobbleOffset) >= this.aimWobbleMaxOffset) {
        this.aimWobbleDir *= -1;
        this.aimWobbleOffset = Math.sign(this.aimWobbleOffset) * this.aimWobbleMaxOffset;
      }

      const rotSpeed = 1.8;
      if (this.cursors.left.isDown)  this.aimAngle -= rotSpeed * dt;
      if (this.cursors.right.isDown) this.aimAngle += rotSpeed * dt;

      if (this.shiftKey.isDown) {
        if (!this.powerCharging) {
          this.powerCharging = true;
          this.power = 0;
          this.powerDirection = 1;
        }
        this.power += this.powerDirection * delta * 0.15;
        if (this.power >= 100) { this.power = 100; this.powerDirection = -1; }
        else if (this.power <= 0) { this.power = 0; this.powerDirection = 1; }
        this.powerBarFill.height = (this.power / 100) * 140;
      } else if (this.powerCharging) {
        this.powerCharging = false;
        this._shoot();
      }

      this._drawAimLine(true);

    } else if (this.cpuAimSet) {
      // CPU aim is visible — draw it until the CPU fires
      this._drawAimLine(false);
    }
  }

  // ------------------------------------------------------------------
  // Physics helpers
  // ------------------------------------------------------------------

  _bounceOffCushions(ball) {
    if (!ball?.body) return;
    // If the ball is already in a pocket opening, let it fall — don't bounce it back
    if (this.pocketPositions.some(p =>
      Phaser.Math.Distance.Between(ball.x, ball.y, p.x, p.y) < POCKET_RADIUS + 10)) return;
    const b = this.tableBounds;
    const r = BALL_RADIUS;
    const rest = 0.82;
    const vx = ball.body.velocity.x;
    const vy = ball.body.velocity.y;

    if (ball.x - r < b.left) {
      ball.x = b.left + r;
      ball.body.setVelocityX(Math.abs(vx) * rest);
    } else if (ball.x + r > b.right) {
      ball.x = b.right - r;
      ball.body.setVelocityX(-Math.abs(vx) * rest);
    }
    if (ball.y - r < b.top) {
      ball.y = b.top + r;
      ball.body.setVelocityY(Math.abs(vy) * rest);
    } else if (ball.y + r > b.bottom) {
      ball.y = b.bottom - r;
      ball.body.setVelocityY(-Math.abs(vy) * rest);
    }
  }

  _checkPockets() {
    this.targetBalls.forEach(ball => {
      if (!ball.visible) return;
      this.pocketPositions.forEach(p => {
        if (Phaser.Math.Distance.Between(ball.x, ball.y, p.x, p.y) < POCKET_RADIUS + 10) {
          ball.setVisible(false);
          ball.body.enable = false;

          if (this.playerTurn) {
            this.playerScore++;
            this.playerScoreText?.setText(`${this.playerScore} ball${this.playerScore !== 1 ? 's' : ''}`);
            this._showFlash('Nice shot!', '#44dd88');
            // Player baton might break
            if (this.selectedWeapon === 'baton' && !this.batonBroken && Math.random() < BATON_BREAK_CHANCE) {
              this._breakBaton(true);
            }
          } else {
            this.cpuScore++;
            this.cpuScoreText?.setText(`${this.cpuScore} ball${this.cpuScore !== 1 ? 's' : ''}`);
            this._showFlash('CPU pocketed one!', '#ffaa44');
            // CPU baton might break
            if (this.opponentWeapon === 'baton' && !this.cpuBatonBroken && Math.random() < BATON_BREAK_CHANCE) {
              this._breakBaton(false);
            }
          }
        }
      });
    });

    // Cue ball scratch — reset position
    if (this.cueBall?.visible) {
      this.pocketPositions.forEach(p => {
        if (Phaser.Math.Distance.Between(this.cueBall.x, this.cueBall.y, p.x, p.y) < POCKET_RADIUS + 10) {
          this.cueBall.setPosition(this.tableX - this.tableW / 4, this.tableY);
          this.cueBall.body.setVelocity(0, 0);
          this._showFlash('Scratch! Ball in hand.', '#ffaa44');
        }
      });
    }
  }

  _breakBaton(isPlayer) {
    if (isPlayer) {
      this.batonBroken = true;
      this._updateDifficulty();
      this.time.delayedCall(700, () => {
        this._showFlash("You broke The Maestro's baton!", '#e94560');
        if (this.weaponText) {
          this.weaponText.setText('Weapon: Baton  ⚠ BROKEN ⚠');
          this.weaponText.setStyle({ color: '#e94560' });
        }
      });
    } else {
      this.cpuBatonBroken = true;
      this.time.delayedCall(700, () => {
        this._showFlash("CPU broke The Maestro's baton!", '#ffaa44');
        if (this.cpuWeaponText) {
          this.cpuWeaponText.setText('CPU: Baton  ⚠ BROKEN ⚠');
          this.cpuWeaponText.setStyle({ color: '#e94560' });
        }
      });
    }
  }

  // ------------------------------------------------------------------
  // Shooting
  // ------------------------------------------------------------------

  _shoot() {
    if (!this.cueBall) return;
    const effectiveAngle = this.aimAngle + this.aimWobbleOffset;
    const speed = 240 + (this.power / 100) * 660;
    this.cueBall.body.setVelocity(Math.cos(effectiveAngle) * speed, Math.sin(effectiveAngle) * speed);
    this.power = 0;
    this.powerBarFill.height = 0;
    this.powerDirection = 1;
    this.shotInProgress = true;
    this.shotHasMovedYet = false;
    if (this.instrText?.visible) this.instrText.setVisible(false);
  }

  _shootCPU() {
    if (!this.cueBall) return;
    const speed = 240 + (this.power / 100) * 660;
    this.cueBall.body.setVelocity(Math.cos(this.aimAngle) * speed, Math.sin(this.aimAngle) * speed);
    this.power = 0;
    this.powerBarFill.height = 0;
    this.cpuAimSet = false;
    this.shotInProgress = true;
    this.shotHasMovedYet = false;
  }

  // ------------------------------------------------------------------
  // Turn Management
  // ------------------------------------------------------------------

  _onShotEnd() {
    // Check if all balls have been pocketed
    const remaining = this.targetBalls.filter(b => b.visible).length;
    if (remaining === 0) {
      this._endGame();
      return;
    }

    // Switch turns
    this.playerTurn = !this.playerTurn;
    this._updateTurnIndicator();

    if (!this.playerTurn) {
      this.aiTurnPending = true;
      this.time.delayedCall(1000, () => {
        this.aiTurnPending = false;
        this._runAITurn();
      });
    }
  }

  _pickAITarget() {
    const visible = this.targetBalls.filter(b => b.visible);
    if (!visible.length) return null;
    let best = null;
    let bestDist = Infinity;
    visible.forEach(ball => {
      this.pocketPositions.forEach(p => {
        const d = Phaser.Math.Distance.Between(ball.x, ball.y, p.x, p.y);
        if (d < bestDist) { bestDist = d; best = ball; }
      });
    });
    return best;
  }

  _runAITurn() {
    if (this.gameState !== STATE.PLAYING || !this.cueBall) return;

    const target = this._pickAITarget();
    if (!target) { this._onShotEnd(); return; }

    // Compute ideal angle from cue ball to target
    const idealAngle = Math.atan2(target.y - this.cueBall.y, target.x - this.cueBall.x);

    // Add inaccuracy based on CPU's weapon
    const cpuKey = this.cpuBatonBroken ? 'broken' : this.opponentWeapon;
    const spread = CPU_ACCURACY[cpuKey];
    const angleError = (Math.random() * 2 - 1) * spread;

    this.aimAngle = idealAngle + angleError;
    this.power = Phaser.Math.Between(48, 88);
    this.cpuAimSet = true; // draw the aim line for CPU

    // Show power bar filling as if charging
    this.powerBarFill.height = (this.power / 100) * 140;

    // Brief delay so the player can see the CPU aim, then fire
    this.time.delayedCall(700, () => {
      if (this.gameState !== STATE.PLAYING) return;
      this._shootCPU();

      // CPU baton may break on shot
      if (this.opponentWeapon === 'baton' && !this.cpuBatonBroken && Math.random() < BATON_BREAK_CHANCE * 0.5) {
        this._breakBaton(false);
      }
    });
  }

  _endGame() {
    this.gameOver = true;
    const { width, height } = this.scale;

    const overlay = this.add.graphics().setDepth(40);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, width, height);

    let resultLine;
    let resultColor;
    if (this.playerScore > this.cpuScore) {
      resultLine = 'YOU WIN!';
      resultColor = '#44dd88';
    } else if (this.cpuScore > this.playerScore) {
      const cpuName = this.selectedChar === 'kramer' ? 'FRANK' : 'KRAMER';
      resultLine = `${cpuName} WINS!`;
      resultColor = '#e94560';
    } else {
      resultLine = "IT'S A TIE!";
      resultColor = '#ffcc00';
    }

    this.add.text(width / 2, height / 2 - 60, resultLine, {
      fontSize: '52px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      color: resultColor,
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(41);

    const playerName = this.selectedChar === 'kramer' ? 'KRAMER' : 'FRANK';
    const cpuName    = this.selectedChar === 'kramer' ? 'FRANK'  : 'KRAMER';
    this.add.text(width / 2, height / 2 + 10, `${playerName}: ${this.playerScore}  vs  ${cpuName}: ${this.cpuScore}`, {
      fontSize: '22px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(41);

    this.add.text(width / 2, height / 2 + 55, 'All balls pocketed!', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      color: '#888888',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(41);

    // Play Again button
    const replayBtn = this.add.text(width / 2, height / 2 + 100, '[ PLAY AGAIN ]', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
    replayBtn.on('pointerover', () => replayBtn.setColor('#ffffff'));
    replayBtn.on('pointerout',  () => replayBtn.setColor('#ffcc00'));
    replayBtn.on('pointerup',   () => this.scene.restart());
  }

  // ------------------------------------------------------------------
  // Aim Line Drawing
  // ------------------------------------------------------------------

  _drawAimLine(isPlayer) {
    if (!this.aimLine || !this.cueStick || !this.cueBall) return;
    this.aimLine.clear();
    this.cueStick.clear();

    const wobble = isPlayer ? this.aimWobbleOffset : 0;
    const effectiveAngle = this.aimAngle + wobble;
    const sx = this.cueBall.x;
    const sy = this.cueBall.y;
    const cx = Math.cos(effectiveAngle);
    const cy = Math.sin(effectiveAngle);

    // Dashed aim line
    this.aimLine.lineStyle(2, 0xffffff, 0.55);
    let d = BALL_RADIUS + 3;
    while (d < 180) {
      const segEnd = Math.min(d + 7, 180);
      this.aimLine.lineBetween(sx + cx * d, sy + cy * d, sx + cx * segEnd, sy + cy * segEnd);
      d = segEnd + 6;
    }

    // Cue stick
    const weapon   = isPlayer ? this.selectedWeapon : this.opponentWeapon;
    const isBroken = isPlayer ? this.batonBroken     : this.cpuBatonBroken;
    const pullback = (isPlayer && this.powerCharging) ? 16 + (this.power / 100) * 24 : 14;

    const cueStartX = sx - cx * pullback;
    const cueStartY = sy - cy * pullback;
    const cueEndX   = sx - cx * 85;
    const cueEndY   = sy - cy * 85;

    if (weapon === 'cue') {
      this.cueStick.lineStyle(5, 0x8b6914, 1);
      this.cueStick.lineBetween(cueStartX, cueStartY, cueEndX, cueEndY);
      this.cueStick.lineStyle(2, 0xd4aa55, 0.6);
      this.cueStick.lineBetween(cueStartX, cueStartY, cueEndX, cueEndY);
      this.cueStick.lineStyle(4, 0x4466cc, 1);
      this.cueStick.lineBetween(cueStartX, cueStartY, sx - cx * (pullback + 5), sy - cy * (pullback + 5));
    } else {
      const batonColor = isBroken ? 0x775533 : 0xddddf0;
      this.cueStick.lineStyle(7, batonColor, 1);
      this.cueStick.lineBetween(cueStartX, cueStartY, cueEndX, cueEndY);
      if (!isBroken) {
        this.cueStick.lineStyle(3, 0xaaaacc, 0.6);
        this.cueStick.lineBetween(cueEndX, cueEndY, sx - cx * 76, sy - cy * 76);
      } else {
        const midX = (cueStartX + cueEndX) / 2;
        const midY = (cueStartY + cueEndY) / 2;
        this.cueStick.lineStyle(3, 0x553311, 0.8);
        this.cueStick.lineBetween(midX, midY, midX + 6, midY - 10);
        this.cueStick.lineBetween(midX, midY, midX - 4, midY - 8);
      }
    }
  }

  // ------------------------------------------------------------------
  // Flash Messages
  // ------------------------------------------------------------------

  _showFlash(msg, color) {
    if (!this.flashText) return;
    this.flashText.setText(msg);
    this.flashText.setColor(color);
    this.flashText.setVisible(true).setAlpha(1).setScale(0.65);
    this.tweens.killTweensOf(this.flashText);
    this.tweens.add({
      targets: this.flashText,
      scale: 1,
      duration: 240,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.flashText,
          alpha: 0,
          duration: 650,
          delay: 900,
          onComplete: () => { if (this.flashText) this.flashText.setVisible(false); },
        });
      },
    });
  }

  // ------------------------------------------------------------------
  // Estelle Interruptions
  // ------------------------------------------------------------------

  _scheduleEstelle() {
    const delay = Phaser.Math.Between(90000, 150000);
    this.estelleTimer = this.time.delayedCall(delay, this._showEstelle, [], this);
  }

  _showEstelle() {
    if (this.estelleVisible) return;
    this.estelleVisible = true;

    const { height } = this.scale;
    const quotes = [
      '"Oh my god!"',
      '"You\'ve been cooped up\nin this room too long!"',
      '"George! What is going on\nin here?!"',
      '"Why are you still in here?!\nGet out!"',
      '"Don\'t make a mess!\nI just cleaned in here!"',
      '"It smells like a pool hall\nin here!"',
    ];

    this.estelleContainer = this.add.container(-100, height * 0.38).setDepth(35);
    this._drawEstelle(this.estelleContainer);

    const bubbleG = this.add.graphics();
    const bx = 70; const by = -95; const bw = 210; const bh = 80;
    bubbleG.fillStyle(0xffffff, 1);
    bubbleG.fillRoundedRect(bx, by, bw, bh, 10);
    bubbleG.lineStyle(2, 0x222222, 1);
    bubbleG.strokeRoundedRect(bx, by, bw, bh, 10);
    bubbleG.fillStyle(0xffffff, 1);
    bubbleG.fillTriangle(bx + 8, by + bh - 2, bx + 35, by + bh - 2, 60, by + bh + 22);
    bubbleG.lineStyle(2, 0x222222, 1);
    bubbleG.lineBetween(bx + 8, by + bh - 2, 60, by + bh + 22);
    bubbleG.lineBetween(60, by + bh + 22, bx + 35, by + bh - 2);

    const bubbleText = this.add.text(bx + bw / 2, by + bh / 2, Phaser.Utils.Array.GetRandom(quotes), {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#111111',
      align: 'center',
      wordWrap: { width: bw - 18 },
    }).setOrigin(0.5);

    this.estelleContainer.add([bubbleG, bubbleText]);

    this.tweens.add({
      targets: this.estelleContainer,
      x: 0,
      duration: 480,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(3800, () => {
          this.tweens.add({
            targets: this.estelleContainer,
            x: -160,
            duration: 480,
            ease: 'Back.easeIn',
            onComplete: () => {
              this.estelleContainer?.destroy();
              this.estelleContainer = null;
              this.estelleVisible = false;
              this._scheduleEstelle();
            },
          });
        });
      },
    });
  }

  // ------------------------------------------------------------------
  // Character Art
  // ------------------------------------------------------------------

  _drawEstelle(container) {
    const g = this.add.graphics();
    g.fillStyle(0xcc7899, 1);
    g.fillRoundedRect(-22, -5, 44, 65, 9);
    g.fillStyle(0xdd99bb, 1);
    g.fillTriangle(0, -5, -16, 25, 16, 25);
    g.fillStyle(0xcc7899, 1);
    g.fillRoundedRect(-44, 8, 24, 11, 4);
    g.fillRoundedRect(20, 8, 24, 11, 4);
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-6, -16, 12, 13);
    g.fillEllipse(0, -36, 40, 44);
    g.fillStyle(0x8a6020, 1);
    g.fillEllipse(0, -57, 48, 24);
    g.fillEllipse(-20, -48, 18, 22);
    g.fillEllipse(20, -48, 18, 22);
    g.fillEllipse(-10, -62, 22, 18);
    g.fillEllipse(10, -62, 22, 18);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-11, -37, 15, 13);
    g.fillEllipse(11, -37, 15, 13);
    g.fillStyle(0x111111, 1);
    g.fillCircle(-11, -37, 4);
    g.fillCircle(11, -37, 4);
    g.fillStyle(0x4444aa, 1);
    g.fillCircle(-10, -37, 2);
    g.fillCircle(12, -37, 2);
    g.lineStyle(2, 0xd4a070, 1);
    g.beginPath();
    g.moveTo(0, -36); g.lineTo(3, -27); g.lineTo(-2, -26);
    g.strokePath();
    g.fillStyle(0xcc3333, 1);
    g.fillEllipse(0, -20, 14, 10);
    g.fillStyle(0x111111, 1);
    g.fillEllipse(0, -20, 8, 6);
    g.fillStyle(0xffcc00, 1);
    g.fillCircle(-20, -34, 4);
    g.fillCircle(20, -34, 4);
    container.add(g);
  }

  _drawFighterKramer(container) {
    const g = this.add.graphics();
    // Boxer shorts (blue plaid)
    g.fillStyle(0x2255bb, 1);
    g.fillRect(-24, 18, 48, 44);
    g.fillStyle(0x1a3d88, 1);
    g.fillRect(-24, 18, 48, 8);
    g.fillStyle(0x4477dd, 0.35);
    g.fillRect(-12, 26, 5, 36);
    g.fillRect(7, 26, 5, 36);
    // Hawaiian shirt
    g.fillStyle(0xe08820, 1);
    g.fillRoundedRect(-22, -32, 44, 55, 5);
    g.fillStyle(0xf0a040, 1);
    g.fillTriangle(0, -32, -13, -6, 13, -6);
    g.fillStyle(0x44aa44, 0.7);
    for (const [fx, fy] of [[-12, -16], [10, -12], [-5, -22], [13, -24], [-14, -26]]) g.fillCircle(fx, fy, 4);
    g.fillStyle(0xffffff, 0.6);
    for (let bi = -20; bi <= 10; bi += 10) g.fillCircle(0, bi, 2);
    // Arms
    g.fillStyle(0xf2c89d, 1);
    g.beginPath();
    g.moveTo(-22, -28); g.lineTo(-30, -28); g.lineTo(-44, -56); g.lineTo(-36, -59);
    g.closePath(); g.fillPath();
    g.fillCircle(-40, -59, 7);
    g.beginPath();
    g.moveTo(22, -22); g.lineTo(30, -22); g.lineTo(44, -5); g.lineTo(36, -1);
    g.closePath(); g.fillPath();
    g.fillCircle(40, -2, 7);
    // Legs + shoes
    g.fillRect(-20, 62, 16, 50);
    g.fillRect(4, 62, 16, 50);
    g.fillStyle(0x222222, 1);
    g.fillRoundedRect(-22, 110, 20, 9, 3);
    g.fillRoundedRect(2, 110, 20, 9, 3);
    // Neck + head
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-6, -38, 12, 8);
    g.fillEllipse(0, -55, 32, 38);
    // Wild hair
    g.fillStyle(0x3a2010, 1);
    g.fillEllipse(0, -72, 36, 18);
    g.fillEllipse(-15, -65, 14, 18);
    g.fillEllipse(15, -65, 14, 18);
    g.lineStyle(3, 0x3a2010, 1);
    g.beginPath();
    for (const [hx, hy] of [[-8, -74], [-3, -76], [3, -76], [8, -74], [13, -68], [-13, -68]]) {
      g.moveTo(hx, hy); g.lineTo(hx + (hx < 0 ? -9 : 9), hy - 12);
    }
    g.strokePath();
    // Face
    g.lineStyle(2, 0x3a2010, 1);
    g.beginPath();
    g.moveTo(-10, -62); g.lineTo(-4, -65); g.moveTo(4, -65); g.lineTo(10, -62);
    g.strokePath();
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-6, -58, 10, 8); g.fillEllipse(6, -58, 10, 8);
    g.fillStyle(0x332211, 1);
    g.fillCircle(-5, -58, 3); g.fillCircle(7, -58, 3);
    g.lineStyle(2, 0xd4a574, 1);
    g.beginPath(); g.moveTo(0, -56); g.lineTo(2, -48); g.lineTo(-1, -47); g.strokePath();
    g.lineStyle(2, 0x994444, 1);
    g.beginPath(); g.arc(0, -43, 7, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(165)); g.strokePath();
    container.add(g);
  }

  _drawFighterFrank(container) {
    const g = this.add.graphics();
    // Boxer shorts (white with dots)
    g.fillStyle(0xeeeeee, 1);
    g.fillRect(-26, 18, 52, 44);
    g.fillStyle(0xaaaaaa, 1);
    g.fillRect(-26, 18, 52, 8);
    g.fillStyle(0x999999, 0.4);
    for (let dx2 = -20; dx2 <= 18; dx2 += 10) {
      for (let dy2 = 30; dy2 <= 58; dy2 += 10) g.fillCircle(dx2, dy2, 2.5);
    }
    // Undershirt
    g.fillStyle(0xf5f5f5, 1);
    g.fillRoundedRect(-22, -32, 44, 55, 4);
    g.fillStyle(0xe0e0e0, 1);
    g.fillRect(-22, -32, 6, 55); g.fillRect(16, -32, 6, 55);
    // Arms
    g.fillStyle(0xf2c89d, 1);
    g.beginPath();
    g.moveTo(-22, -22); g.lineTo(-30, -22); g.lineTo(-42, 10); g.lineTo(-30, 14);
    g.closePath(); g.fillPath();
    g.fillCircle(-36, 14, 8);
    g.beginPath();
    g.moveTo(22, -26); g.lineTo(30, -26); g.lineTo(44, -12); g.lineTo(36, -6);
    g.closePath(); g.fillPath();
    g.fillCircle(40, -7, 8);
    // Legs + shoes
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-22, 62, 18, 46); g.fillRect(4, 62, 18, 46);
    g.fillStyle(0x2a2a2a, 1);
    g.fillRoundedRect(-24, 106, 22, 9, 3); g.fillRoundedRect(2, 106, 22, 9, 3);
    // Neck + head
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-9, -40, 18, 10);
    g.fillEllipse(0, -58, 44, 44);
    // Orange/auburn hair (like the show)
    g.fillStyle(0xcc8822, 1);
    g.fillEllipse(0, -76, 36, 14);
    g.fillEllipse(-18, -68, 12, 16);
    g.fillEllipse(18, -68, 12, 16);
    // Thick eyebrows (darker auburn)
    g.lineStyle(6, 0x884400, 1);
    g.beginPath();
    g.moveTo(-14, -66); g.lineTo(-4, -70); g.moveTo(4, -70); g.lineTo(14, -66);
    g.strokePath();
    // Stern eyes
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-9, -60, 13, 9); g.fillEllipse(9, -60, 13, 9);
    g.fillStyle(0x332211, 1);
    g.fillCircle(-9, -60, 3); g.fillCircle(9, -60, 3);
    // Broad nose
    g.lineStyle(2.5, 0xd4a574, 1);
    g.beginPath();
    g.moveTo(0, -59); g.lineTo(0, -50); g.lineTo(-4, -47);
    g.moveTo(0, -50); g.lineTo(4, -47);
    g.strokePath();
    // Stern frown
    g.lineStyle(2.5, 0x884444, 1);
    g.beginPath();
    g.arc(0, -43, 8, Phaser.Math.DegToRad(210), Phaser.Math.DegToRad(330));
    g.strokePath();
    // Ears
    g.fillStyle(0xf2c89d, 1);
    g.fillCircle(-22, -60, 8); g.fillCircle(22, -60, 8);
    container.add(g);
  }

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------

  _clearScene() {
    this.children.removeAll(true);

    if (this.estelleTimer) { this.estelleTimer.remove(false); this.estelleTimer = null; }
    this.estelleContainer = null;
    this.estelleVisible = false;
    this.cueBall = null;
    this.targetBalls = [];
    this.aimLine = null;
    this.cueStick = null;
    this.gameOver = false;
    this.shotInProgress = false;
    this.shotHasMovedYet = false;
    this.aiTurnPending = false;
    this.cpuAimSet = false;
    this.powerCharging = false;
    this.power = 0;
    this.powerDirection = 1;
    this.flashText = null;
    this.weaponText = null;
    this.cpuWeaponText = null;
    this.playerScoreText = null;
    this.cpuScoreText = null;
    this.turnIndicatorText = null;
    this.powerBarFill = null;
    this.instrText = null;
  }

  _addBackButton() {
    const btn = this.add.text(20, this.scale.height - 28, '← Back to Menu', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setInteractive({ useHandCursor: true }).setDepth(10);
    btn.on('pointerover', () => btn.setColor('#ffdd44'));
    btn.on('pointerout',  () => btn.setColor('#ffffff'));
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
