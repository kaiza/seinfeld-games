import Phaser from 'phaser';

/**
 * Jerry vs. The Rye — Match-3 Mini-Game
 *
 * Match identical social situations on a grid to lower Jerry's Suspicion meter
 * and advance him along the street toward placing the marble rye.
 *
 * Tile types represent awkward social scenarios Jerry must navigate.
 * Matching 3+ of the same lowers suspicion. Mis-swaps spike it.
 * If suspicion hits 100 Jerry is caught doing "something weird."
 * Clear enough matches to advance Jerry through all stages to the goal.
 */

// ---------- CONSTANTS ----------

const GRID_COLS = 7;
const GRID_ROWS = 7;
const TILE_SIZE = 56;
const GRID_OFFSET_X = 200;
const GRID_OFFSET_Y = 80;

const TILE_TYPES = [
  { id: 0, emoji: '🥖', label: 'Marble Rye', color: 0xcc8833 },
  { id: 1, emoji: '😬', label: 'Awkward Pause', color: 0xccaa44 },
  { id: 2, emoji: '🏪', label: 'Bakery Panic', color: 0x44aa88 },
  { id: 3, emoji: '🕵️', label: 'Sneaky Entry', color: 0x6644aa },
  { id: 4, emoji: '👵', label: 'Old Lady', color: 0xaa4466 },
  { id: 5, emoji: '🎣', label: 'Fishing Line', color: 0x4488cc },
];

const STAGES = [
  'Leave apartment',
  'Walk to bakery',
  'Buy the rye',
  'Sneak past lobby',
  'Fishing line up!',
  'Place the rye!',
];

const SUSPICION_PER_BAD_SWAP = 15;
const SUSPICION_PER_MATCH = -8;
const SUSPICION_DECAY_RATE = 0.3; // per second
const MATCHES_PER_STAGE = 5;
const MAX_SUSPICION = 100;

export class RyeMatch3Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'RyeMatch3Scene' });
  }

  init() {
    this.suspicion = 0;
    this.stage = 0;
    this.matchCount = 0;
    this.totalMatches = 0;
    this.isSwapping = false;
    this.selectedTile = null;
    this.gameOver = false;
    this.grid = []; // [row][col] = { type, sprite, emoji }
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a1e);

    this.createGrid();
    this.createHUD();
    this.createJerryProgress();
    this.addBackButton();

    // Initial cascade to clear any pre-existing matches
    this.time.delayedCall(300, () => this.processMatches());
  }

  // ===================== GRID =====================

  createGrid() {
    this.grid = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        this.spawnTile(r, c, false);
      }
    }
  }

  spawnTile(r, c, animated) {
    // Avoid creating initial matches
    let type;
    let attempts = 0;
    do {
      type = Phaser.Math.Between(0, TILE_TYPES.length - 1);
      attempts++;
    } while (attempts < 20 && this.wouldMatch(r, c, type));

    const x = GRID_OFFSET_X + c * TILE_SIZE + TILE_SIZE / 2;
    const y = GRID_OFFSET_Y + r * TILE_SIZE + TILE_SIZE / 2;
    const startY = animated ? GRID_OFFSET_Y - TILE_SIZE : y;

    const tileDef = TILE_TYPES[type];

    // Background tile
    const bg = this.add.rectangle(x, startY, TILE_SIZE - 4, TILE_SIZE - 4, tileDef.color, 0.3)
      .setStrokeStyle(1, tileDef.color)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);

    // Emoji
    const emoji = this.add.text(x, startY, tileDef.emoji, {
      fontSize: '28px',
    }).setOrigin(0.5).setDepth(11);

    const tile = { type, bg, emoji, r, c };
    this.grid[r][c] = tile;

    // Click handler
    bg.on('pointerdown', () => this.onTileClick(tile));

    // Selection hover
    bg.on('pointerover', () => {
      if (!this.isSwapping && !this.gameOver) {
        bg.setStrokeStyle(2, 0xffffff);
      }
    });
    bg.on('pointerout', () => {
      if (tile !== this.selectedTile) {
        bg.setStrokeStyle(1, tileDef.color);
      }
    });

    // Drop animation
    if (animated) {
      this.tweens.add({
        targets: [bg, emoji],
        y: y,
        duration: 200 + r * 40,
        ease: 'Bounce.easeOut',
      });
    }

    return tile;
  }

  wouldMatch(r, c, type) {
    // Check horizontal
    if (c >= 2 &&
        this.grid[r]?.[c - 1]?.type === type &&
        this.grid[r]?.[c - 2]?.type === type) {
      return true;
    }
    // Check vertical
    if (r >= 2 &&
        this.grid[r - 1]?.[c]?.type === type &&
        this.grid[r - 2]?.[c]?.type === type) {
      return true;
    }
    return false;
  }

  getTilePos(r, c) {
    return {
      x: GRID_OFFSET_X + c * TILE_SIZE + TILE_SIZE / 2,
      y: GRID_OFFSET_Y + r * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  // ===================== INTERACTION =====================

  onTileClick(tile) {
    if (this.isSwapping || this.gameOver) return;

    if (!this.selectedTile) {
      // Select first tile
      this.selectedTile = tile;
      tile.bg.setStrokeStyle(3, 0x00ff00);
      return;
    }

    if (this.selectedTile === tile) {
      // Deselect
      this.deselectTile();
      return;
    }

    // Check adjacency
    const dr = Math.abs(this.selectedTile.r - tile.r);
    const dc = Math.abs(this.selectedTile.c - tile.c);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
      this.trySwap(this.selectedTile, tile);
    } else {
      // Not adjacent — reselect
      this.deselectTile();
      this.selectedTile = tile;
      tile.bg.setStrokeStyle(3, 0x00ff00);
    }
  }

  deselectTile() {
    if (this.selectedTile) {
      const tileDef = TILE_TYPES[this.selectedTile.type];
      this.selectedTile.bg.setStrokeStyle(1, tileDef.color);
      this.selectedTile = null;
    }
  }

  trySwap(a, b) {
    this.isSwapping = true;
    this.deselectTile();

    // Swap in grid
    this.grid[a.r][a.c] = b;
    this.grid[b.r][b.c] = a;

    const tempR = a.r, tempC = a.c;
    a.r = b.r; a.c = b.c;
    b.r = tempR; b.c = tempC;

    const posA = this.getTilePos(a.r, a.c);
    const posB = this.getTilePos(b.r, b.c);

    // Animate swap
    this.tweens.add({
      targets: [a.bg, a.emoji],
      x: posA.x,
      y: posA.y,
      duration: 150,
    });

    this.tweens.add({
      targets: [b.bg, b.emoji],
      x: posB.x,
      y: posB.y,
      duration: 150,
      onComplete: () => {
        // Check if swap produced a match
        const matches = this.findMatches();
        if (matches.size === 0) {
          // Bad swap — reverse and punish
          this.reverseSwap(a, b);
          this.addSuspicion(SUSPICION_PER_BAD_SWAP);
          this.showFloating(posA.x, posA.y - 30, '⚠ Suspicious!', '#ff4444');
        } else {
          this.processMatches();
        }
      },
    });
  }

  reverseSwap(a, b) {
    this.grid[a.r][a.c] = b;
    this.grid[b.r][b.c] = a;

    const tempR = a.r, tempC = a.c;
    a.r = b.r; a.c = b.c;
    b.r = tempR; b.c = tempC;

    const posA = this.getTilePos(a.r, a.c);
    const posB = this.getTilePos(b.r, b.c);

    this.tweens.add({
      targets: [a.bg, a.emoji],
      x: posA.x,
      y: posA.y,
      duration: 150,
    });

    this.tweens.add({
      targets: [b.bg, b.emoji],
      x: posB.x,
      y: posB.y,
      duration: 150,
      onComplete: () => {
        this.isSwapping = false;
      },
    });
  }

  // ===================== MATCH LOGIC =====================

  findMatches() {
    const matched = new Set();

    // Horizontal
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS - 2; c++) {
        const t = this.grid[r][c]?.type;
        if (t !== undefined &&
            this.grid[r][c + 1]?.type === t &&
            this.grid[r][c + 2]?.type === t) {
          matched.add(`${r},${c}`);
          matched.add(`${r},${c + 1}`);
          matched.add(`${r},${c + 2}`);
          // Extend
          let ext = c + 3;
          while (ext < GRID_COLS && this.grid[r][ext]?.type === t) {
            matched.add(`${r},${ext}`);
            ext++;
          }
        }
      }
    }

    // Vertical
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS - 2; r++) {
        const t = this.grid[r][c]?.type;
        if (t !== undefined &&
            this.grid[r + 1]?.[c]?.type === t &&
            this.grid[r + 2]?.[c]?.type === t) {
          matched.add(`${r},${c}`);
          matched.add(`${r + 1},${c}`);
          matched.add(`${r + 2},${c}`);
          let ext = r + 3;
          while (ext < GRID_ROWS && this.grid[ext]?.[c]?.type === t) {
            matched.add(`${ext},${c}`);
            ext++;
          }
        }
      }
    }

    return matched;
  }

  processMatches() {
    const matches = this.findMatches();
    if (matches.size === 0) {
      this.isSwapping = false;
      return;
    }

    this.isSwapping = true;

    // Count distinct match groups for scoring
    const matchGroupCount = Math.floor(matches.size / 3);

    // Remove matched tiles
    for (const key of matches) {
      const [r, c] = key.split(',').map(Number);
      const tile = this.grid[r][c];
      if (tile) {
        // Pop animation
        this.tweens.add({
          targets: [tile.bg, tile.emoji],
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            tile.bg.destroy();
            tile.emoji.destroy();
          },
        });
        this.grid[r][c] = null;
      }
    }

    // Score
    this.matchCount += matchGroupCount;
    this.totalMatches += matchGroupCount;
    this.addSuspicion(SUSPICION_PER_MATCH * matchGroupCount);

    // Check stage advance
    if (this.matchCount >= MATCHES_PER_STAGE) {
      this.matchCount -= MATCHES_PER_STAGE;
      this.advanceStage();
    }

    this.updateHUD();

    // After remove animation, collapse and refill
    this.time.delayedCall(250, () => {
      this.collapseGrid();
      this.time.delayedCall(350, () => {
        this.refillGrid();
        this.time.delayedCall(400, () => {
          // Cascade — check for new matches
          this.processMatches();
        });
      });
    });
  }

  collapseGrid() {
    // Move tiles down to fill gaps
    for (let c = 0; c < GRID_COLS; c++) {
      let writeRow = GRID_ROWS - 1;
      for (let r = GRID_ROWS - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (r !== writeRow) {
            const tile = this.grid[r][c];
            this.grid[writeRow][c] = tile;
            this.grid[r][c] = null;
            tile.r = writeRow;
            tile.c = c;

            const pos = this.getTilePos(writeRow, c);
            this.tweens.add({
              targets: [tile.bg, tile.emoji],
              y: pos.y,
              duration: 150 + (writeRow - r) * 30,
              ease: 'Bounce.easeOut',
            });
          }
          writeRow--;
        }
      }
    }
  }

  refillGrid() {
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        if (this.grid[r][c] === null) {
          this.spawnTile(r, c, true);
        }
      }
    }
  }

  // ===================== SUSPICION & STAGES =====================

  addSuspicion(amount) {
    this.suspicion = Phaser.Math.Clamp(this.suspicion + amount, 0, MAX_SUSPICION);

    if (this.suspicion >= MAX_SUSPICION) {
      this.loseGame();
    }

    this.updateHUD();
  }

  advanceStage() {
    this.stage++;

    if (this.stage >= STAGES.length) {
      this.winGame();
      return;
    }

    this.updateJerryProgress();

    // Flash celebration
    this.cameras.main.flash(200, 0, 200, 0);
    const { width } = this.scale;
    this.showFloating(width / 2, 30, `Stage: ${STAGES[this.stage]}`, '#44cc44');

    // Suspicion bonus for advancing
    this.addSuspicion(-10);
  }

  // ===================== HUD =====================

  createHUD() {
    const hudX = 10;

    this.add.text(hudX, 10, 'JERRY vs. THE RYE', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#cc8833',
      fontStyle: 'bold',
    }).setDepth(100);

    this.add.text(hudX, 35, 'Match-3', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setDepth(100);

    // Suspicion bar
    this.add.text(hudX, 65, 'SUSPICION', {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#ff6666',
    }).setDepth(100);

    this.suspicionBarBg = this.add.rectangle(hudX + 75, 73, 100, 14, 0x333333)
      .setOrigin(0, 0.5).setDepth(100);
    this.suspicionBarFill = this.add.rectangle(hudX + 75, 73, 0, 12, 0xff4444)
      .setOrigin(0, 0.5).setDepth(101);
    this.suspicionText = this.add.text(hudX + 75 + 105, 73, '0%', {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#ff6666',
    }).setOrigin(0, 0.5).setDepth(100);

    // Stage info
    this.stageText = this.add.text(hudX, 95, `Stage: ${STAGES[0]}`, {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#44cc44',
    }).setDepth(100);

    // Progress to next stage
    this.progressText = this.add.text(hudX, 115, `Matches: 0/${MATCHES_PER_STAGE}`, {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#aaaaaa',
    }).setDepth(100);

    // Total matches
    this.totalText = this.add.text(hudX, 135, 'Total: 0', {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setDepth(100);

    // Legend
    const legendY = 170;
    this.add.text(hudX, legendY, 'TILES:', {
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: '#666666',
    }).setDepth(100);

    TILE_TYPES.forEach((t, i) => {
      this.add.text(hudX, legendY + 16 + i * 16, `${t.emoji} ${t.label}`, {
        fontSize: '10px',
        fontFamily: 'Courier New',
        color: '#888888',
      }).setDepth(100);
    });

    // Instructions
    this.add.text(hudX, legendY + 16 + TILE_TYPES.length * 16 + 10, 'Click two adjacent\ntiles to swap.\nMatch 3+ to clear!', {
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: '#555555',
      lineSpacing: 4,
    }).setDepth(100);
  }

  updateHUD() {
    const pct = Math.floor(this.suspicion);
    this.suspicionBarFill.width = (this.suspicion / MAX_SUSPICION) * 100;

    if (this.suspicion > 70) {
      this.suspicionBarFill.setFillStyle(0xff0000);
    } else if (this.suspicion > 40) {
      this.suspicionBarFill.setFillStyle(0xff8800);
    } else {
      this.suspicionBarFill.setFillStyle(0xff4444);
    }

    this.suspicionText.setText(`${pct}%`);
    this.stageText.setText(`Stage: ${STAGES[Math.min(this.stage, STAGES.length - 1)]}`);
    this.progressText.setText(`Matches: ${this.matchCount}/${MATCHES_PER_STAGE}`);
    this.totalText.setText(`Total: ${this.totalMatches}`);
  }

  // ===================== JERRY PROGRESS BAR =====================

  createJerryProgress() {
    const barY = this.scale.height - 40;
    const barX = GRID_OFFSET_X;
    const barW = GRID_COLS * TILE_SIZE;

    // Track background
    this.add.rectangle(barX + barW / 2, barY, barW, 20, 0x222222)
      .setStrokeStyle(1, 0x444444).setDepth(100);

    // Stage markers
    for (let i = 0; i <= STAGES.length; i++) {
      const x = barX + (i / STAGES.length) * barW;
      this.add.rectangle(x, barY, 2, 20, 0x666666).setDepth(101);
      if (i < STAGES.length) {
        this.add.text(x + 4, barY + 14, `${i + 1}`, {
          fontSize: '8px',
          fontFamily: 'Courier New',
          color: '#666666',
        }).setDepth(101);
      }
    }

    // Jerry marker
    this.jerryMarker = this.add.text(barX, barY, '🚶', {
      fontSize: '18px',
    }).setOrigin(0, 0.5).setDepth(102);

    // Goal
    this.add.text(barX + barW - 5, barY, '🥖', {
      fontSize: '16px',
    }).setOrigin(1, 0.5).setDepth(102);

    this.jerryBarX = barX;
    this.jerryBarW = barW;
    this.jerryBarY = barY;
  }

  updateJerryProgress() {
    const progress = this.stage / STAGES.length;
    const targetX = this.jerryBarX + progress * this.jerryBarW;

    this.tweens.add({
      targets: this.jerryMarker,
      x: targetX,
      duration: 500,
      ease: 'Quad.easeOut',
    });
  }

  // ===================== WIN / LOSE =====================

  winGame() {
    this.gameOver = true;
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setDepth(300);

    this.add.text(width / 2, height / 2 - 50, '🥖 RYE DELIVERED! 🥖', {
      fontSize: '32px',
      fontFamily: 'Courier New',
      color: '#cc8833',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(301);

    this.add.text(width / 2, height / 2, 'Jerry placed the marble rye without getting caught!', {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(301);

    this.add.text(width / 2, height / 2 + 30, `Total Matches: ${this.totalMatches}  |  Final Suspicion: ${Math.floor(this.suspicion)}%`, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(0.5).setDepth(301);

    this.addEndButtons();
  }

  loseGame() {
    this.gameOver = true;
    const { width, height } = this.scale;

    this.cameras.main.shake(300, 0.02);

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setDepth(300);

    this.add.text(width / 2, height / 2 - 50, 'BUSTED!', {
      fontSize: '36px',
      fontFamily: 'Courier New',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(301);

    this.add.text(width / 2, height / 2, '"What are you doing with that bread?!"', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#cccccc',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(301);

    this.add.text(width / 2, height / 2 + 30, `Stage reached: ${STAGES[this.stage]}  |  Total Matches: ${this.totalMatches}`, {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(0.5).setDepth(301);

    this.addEndButtons();
  }

  addEndButtons() {
    const { width, height } = this.scale;

    const retryBtn = this.add.text(width / 2, height / 2 + 75, '[ PLAY AGAIN ]', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerover', () => retryBtn.setColor('#cc8833'));
    retryBtn.on('pointerout', () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    const menuBtn = this.add.text(width / 2, height / 2 + 110, '[ BACK TO MENU ]', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  // ===================== HELPERS =====================

  showFloating(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: color,
      fontStyle: 'bold',
      backgroundColor: '#000000cc',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 1500,
      onComplete: () => t.destroy(),
    });
  }

  addBackButton() {
    const btn = this.add.text(10, this.scale.height - 15, '← Menu', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setInteractive({ useHandCursor: true }).setDepth(100);

    btn.on('pointerover', () => btn.setColor('#e94560'));
    btn.on('pointerout', () => btn.setColor('#888888'));
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  update(time, delta) {
    if (this.gameOver) return;

    // Slow suspicion decay over time
    if (this.suspicion > 0) {
      this.suspicion = Math.max(0, this.suspicion - SUSPICION_DECAY_RATE * (delta / 1000));
      this.updateHUD();
    }
  }
}
