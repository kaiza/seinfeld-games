import Phaser from 'phaser';
import { generateGarage, CELL } from './MazeGenerator.js';
import { Character, CHARACTER_DEFS } from './Characters.js';
import { SecurityGuard } from './SecurityGuard.js';

/**
 * The Parking Garage — A maze/navigation mini-game
 *
 * Switch between all 4 characters on a procedurally generated
 * multi-floor parking garage. Get everyone to the car before time runs out.
 */

const TILE_SIZE = 18;
const MAZE_COLS = 31;
const MAZE_ROWS = 23;
const TOTAL_TIME = 300; // 5 minutes
const NUM_FLOORS = 3;
const CAUGHT_PENALTY = 30; // seconds
const MAP_OFFSET_X = 180; // leave room for HUD on the left

const TILE_COLORS = {
  [CELL.WALL]: 0x333340,
  [CELL.FLOOR]: 0x555566,
  [CELL.STAIRS]: 0x4488cc,
  [CELL.BATHROOM]: 0xcc66aa,
  [CELL.AC_UNIT]: 0xffaa00,
  [CELL.CAR]: 0x44cc44,
  [CELL.GUARD_SPAWN]: 0x555566, // render as floor
  [CELL.KEYS]: 0x88ccff,
};

export class ParkingGarageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ParkingGarageScene' });
  }

  init() {
    this.timeLeft = TOTAL_TIME;
    this.isPlaying = false;
    this.gameOver = false;
    this.activeCharIndex = 0;
    this.characters = [];
    this.guards = [];
    this.tileGraphics = [];
    this.currentFloor = 0;
    this.acPickedUp = false;
    this.keysPickedUp = false;
    this.charsAtCar = 0;
    this.onStairs = false; // prevent stairs re-triggering every frame
  }

  create() {
    const { width, height } = this.scale;

    // Generate the garage
    this.garage = generateGarage(NUM_FLOORS, MAZE_COLS, MAZE_ROWS);

    // Draw the maze
    this.mazeContainer = this.add.container(MAP_OFFSET_X, 30);
    this.drawCurrentFloor();

    // Create characters
    this.createCharacters();

    // Create guards
    this.createGuards();

    // Create HUD
    this.createHUD();

    // Input
    this.setupInput();

    // Show floor initially — entities exist now so just update visibility
    this.updateFloorVisibility();
    // Ensure characters render above tiles
    for (const char of this.characters) {
      this.mazeContainer.bringToTop(char.sprite);
    }
    for (const guard of this.guards) {
      this.mazeContainer.bringToTop(guard.visionCone);
      this.mazeContainer.bringToTop(guard.sprite);
    }

    // Start prompt
    this.startText = this.add.text(width / 2, height / 2, 'Press any arrow key to begin!\nTab/1-4 to switch characters', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#44cc44',
      fontStyle: 'bold',
      align: 'center',
      backgroundColor: '#000000cc',
      padding: { x: 15, y: 10 },
    }).setOrigin(0.5).setDepth(200);

    this.addBackButton();
  }

  // ===================== DRAWING =====================

  drawCurrentFloor() {
    // Clear old tiles
    this.tileGraphics.forEach((t) => t.destroy());
    this.tileGraphics = [];

    const grid = this.garage.floors[this.currentFloor];

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        const cellType = grid[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        let color = TILE_COLORS[cellType] ?? 0x555566;

        const rect = this.add.rectangle(
          x + TILE_SIZE / 2,
          y + TILE_SIZE / 2,
          TILE_SIZE - 1,
          TILE_SIZE - 1,
          color,
        ).setDepth(1);

        this.mazeContainer.add(rect);
        this.tileGraphics.push(rect);

        // Special tile labels
        if (cellType === CELL.STAIRS) {
          const lbl = this.add.text(x + TILE_SIZE / 2, y + TILE_SIZE / 2, '⬆', {
            fontSize: '10px',
          }).setOrigin(0.5).setDepth(5);
          this.mazeContainer.add(lbl);
          this.tileGraphics.push(lbl);
        } else if (cellType === CELL.BATHROOM) {
          const lbl = this.add.text(x + TILE_SIZE / 2, y + TILE_SIZE / 2, '🚻', {
            fontSize: '8px',
          }).setOrigin(0.5).setDepth(5);
          this.mazeContainer.add(lbl);
          this.tileGraphics.push(lbl);
        } else if (cellType === CELL.AC_UNIT && !this.acPickedUp) {
          const lbl = this.add.text(x + TILE_SIZE / 2, y + TILE_SIZE / 2, '❄', {
            fontSize: '10px',
          }).setOrigin(0.5).setDepth(5);
          this.mazeContainer.add(lbl);
          this.tileGraphics.push(lbl);
        } else if (cellType === CELL.CAR) {
          const lbl = this.add.text(x + TILE_SIZE / 2, y + TILE_SIZE / 2, '🚗', {
            fontSize: '10px',
          }).setOrigin(0.5).setDepth(5);
          this.mazeContainer.add(lbl);
          this.tileGraphics.push(lbl);
        } else if (cellType === CELL.KEYS && !this.keysPickedUp) {
          const lbl = this.add.text(x + TILE_SIZE / 2, y + TILE_SIZE / 2, '🔑', {
            fontSize: '8px',
          }).setOrigin(0.5).setDepth(5);
          this.mazeContainer.add(lbl);
          this.tileGraphics.push(lbl);
        }
      }
    }
  }

  /**
   * Redraw the floor tiles, then re-add entity sprites on top
   * so that container render order keeps characters above tiles.
   */
  switchFloor() {
    this.drawCurrentFloor();
    // Re-add character and guard sprites so they sit above newly-added tiles
    for (const char of this.characters) {
      this.mazeContainer.bringToTop(char.sprite);
    }
    for (const guard of this.guards) {
      this.mazeContainer.bringToTop(guard.visionCone);
      this.mazeContainer.bringToTop(guard.sprite);
    }
    this.updateFloorVisibility();
  }

  // ===================== ENTITIES =====================

  createCharacters() {
    for (let i = 0; i < 4; i++) {
      const startPos = this.garage.startPositions[i];
      const char = new Character(
        this, CHARACTER_DEFS[i],
        startPos.r, startPos.c, startPos.floor,
        TILE_SIZE,
      );
      // Add sprite to the maze container
      this.mazeContainer.add(char.sprite);
      this.characters.push(char);
    }

    // Set first character active
    this.characters[0].setActive(true);
  }

  createGuards() {
    for (const spawn of this.garage.guardSpawns) {
      const grid = this.garage.floors[spawn.floor];
      const guard = new SecurityGuard(
        this, spawn.floor, spawn.r, spawn.c, TILE_SIZE, grid,
      );
      this.mazeContainer.add(guard.sprite);
      this.mazeContainer.add(guard.visionCone);
      this.guards.push(guard);
    }
  }

  // ===================== HUD =====================

  createHUD() {
    const hudX = 10;
    const hudY = 30;

    // Title
    this.add.text(90, 8, 'PARKING\nGARAGE', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#e94560',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(100);

    // Timer
    this.timerText = this.add.text(hudX, hudY + 30, `⏱ ${this.formatTime(this.timeLeft)}`, {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setDepth(100);

    // Floor indicator
    this.floorText = this.add.text(hudX, hudY + 52, `Floor: ${this.currentFloor + 1}/${NUM_FLOORS}`, {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#4488cc',
    }).setDepth(100);

    // Character portraits / status
    this.portraitTexts = [];
    const names = ['George', 'Elaine', 'Kramer', 'Jerry'];
    const statusLabels = ['AC: ✗', 'Bladder: 0%', 'Keys: ✗', 'Idle'];

    for (let i = 0; i < 4; i++) {
      const py = hudY + 80 + i * 65;

      const bg = this.add.rectangle(hudX + 75, py + 18, 155, 55, 0x16213e)
        .setStrokeStyle(1, i === 0 ? 0x00ff00 : 0x333355)
        .setDepth(99);

      const nameText = this.add.text(hudX + 5, py, `[${i + 1}] ${names[i]}`, {
        fontSize: '12px',
        fontFamily: 'Courier New',
        color: i === 0 ? '#00ff00' : '#aaaaaa',
        fontStyle: 'bold',
      }).setDepth(100);

      const statusText = this.add.text(hudX + 5, py + 17, statusLabels[i], {
        fontSize: '10px',
        fontFamily: 'Courier New',
        color: '#888888',
      }).setDepth(100);

      const floorLabel = this.add.text(hudX + 5, py + 32, 'F1', {
        fontSize: '10px',
        fontFamily: 'Courier New',
        color: '#4488cc',
      }).setDepth(100);

      this.portraitTexts.push({ bg, nameText, statusText, floorLabel });
    }

    // Legend
    const legendY = hudY + 350;
    const legendItems = [
      { emoji: '⬆', label: 'Stairs', color: '#4488cc' },
      { emoji: '🚻', label: 'Bathroom', color: '#cc66aa' },
      { emoji: '❄', label: 'AC Unit', color: '#ffaa00' },
      { emoji: '🔑', label: 'Keys', color: '#88ccff' },
      { emoji: '🚗', label: 'Car (Goal)', color: '#44cc44' },
    ];
    for (let i = 0; i < legendItems.length; i++) {
      this.add.text(hudX, legendY + i * 16, `${legendItems[i].emoji} ${legendItems[i].label}`, {
        fontSize: '10px',
        fontFamily: 'Courier New',
        color: legendItems[i].color,
      }).setDepth(100);
    }
  }

  updateHUD() {
    // Timer
    this.timerText.setText(`⏱ ${this.formatTime(this.timeLeft)}`);
    if (this.timeLeft <= 30) {
      this.timerText.setColor('#ff3333');
    }

    // Floor
    this.floorText.setText(`Floor: ${this.currentFloor + 1}/${NUM_FLOORS}`);

    // Character status
    for (let i = 0; i < 4; i++) {
      const char = this.characters[i];
      const pt = this.portraitTexts[i];
      const isActive = i === this.activeCharIndex;

      pt.bg.setStrokeStyle(1, isActive ? 0x00ff00 : 0x333355);
      pt.nameText.setColor(isActive ? '#00ff00' : (char.reachedCar ? '#44cc44' : '#aaaaaa'));

      // Floor label
      pt.floorLabel.setText(`F${char.floor + 1}${char.reachedCar ? ' ✓' : ''}`);

      // Status per character
      if (char.id === 'george') {
        pt.statusText.setText(`AC: ${char.hasAC ? '✓ (slow)' : '✗'}`);
        pt.statusText.setColor(char.hasAC ? '#ffaa00' : '#888888');
      } else if (char.id === 'elaine') {
        const pct = Math.floor(char.bladder);
        pt.statusText.setText(`Bladder: ${pct}% (${char.bladderMaxOuts}/3)`);
        pt.statusText.setColor(pct > 70 ? '#ff4444' : pct > 40 ? '#ffaa00' : '#888888');
      } else if (char.id === 'kramer') {
        pt.statusText.setText(`Keys: ${char.hasKeys ? '✓ (stable)' : '✗ (erratic)'}`);
        pt.statusText.setColor(char.hasKeys ? '#88ccff' : '#ff8844');
      } else if (char.id === 'jerry') {
        pt.statusText.setText(char.isFrozen ? 'Caught!' : 'Ready');
        pt.statusText.setColor(char.isFrozen ? '#ff4444' : '#888888');
      }
    }
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ===================== INPUT =====================

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keys1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.keys2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.keys3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.keys4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);

    // Prevent tab from leaving the game
    this.input.keyboard.addCapture('TAB');
  }

  // ===================== GAME LOOP =====================

  update(time, delta) {
    if (this.gameOver) return;

    if (!this.isPlaying) {
      if (this.cursors.up.isDown || this.cursors.down.isDown ||
          this.cursors.left.isDown || this.cursors.right.isDown) {
        this.isPlaying = true;
        if (this.startText) {
          this.startText.destroy();
          this.startText = null;
        }
        // Start timer
        this.timerEvent = this.time.addEvent({
          delay: 1000,
          callback: () => {
            this.timeLeft--;
            if (this.timeLeft <= 0) this.loseGame('Time\'s up! You never found the car.');
          },
          loop: true,
        });
      } else {
        return;
      }
    }

    // Character switching
    this.handleCharacterSwitch();

    // Movement
    this.handleMovement();

    // Update character mechanics
    for (const char of this.characters) {
      char.updateMechanics(delta);
    }

    // Elaine lose condition
    const elaine = this.characters[1];
    if (elaine.bladderMaxOuts >= 3) {
      this.loseGame('Elaine couldn\'t hold it 3 times. Game over!');
      return;
    }

    // Guard AI
    for (const guard of this.guards) {
      if (guard.floor === this.currentFloor) {
        guard.update(delta);
      }
      this.checkGuardDetection(guard);
    }

    // Tile interactions
    this.checkTileInteractions();

    // Update HUD
    this.updateHUD();
  }

  handleCharacterSwitch() {
    let newIndex = -1;

    if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      // Cycle to next non-car character
      for (let i = 1; i <= 4; i++) {
        const idx = (this.activeCharIndex + i) % 4;
        if (!this.characters[idx].reachedCar) {
          newIndex = idx;
          break;
        }
      }
    } else if (Phaser.Input.Keyboard.JustDown(this.keys1)) newIndex = 0;
    else if (Phaser.Input.Keyboard.JustDown(this.keys2)) newIndex = 1;
    else if (Phaser.Input.Keyboard.JustDown(this.keys3)) newIndex = 2;
    else if (Phaser.Input.Keyboard.JustDown(this.keys4)) newIndex = 3;

    if (newIndex >= 0 && newIndex !== this.activeCharIndex && !this.characters[newIndex].reachedCar) {
      this.characters[this.activeCharIndex].setActive(false);
      this.activeCharIndex = newIndex;
      this.characters[newIndex].setActive(true);

      // Only redraw tiles when the floor actually changes
      const newFloor = this.characters[newIndex].floor;
      if (newFloor !== this.currentFloor) {
        this.currentFloor = newFloor;
        this.switchFloor();
      }
      // Always refresh visibility so sprites on the same floor reappear
      this.updateFloorVisibility();
    }
  }

  handleMovement() {
    const char = this.characters[this.activeCharIndex];
    if (char.reachedCar) return;

    let dr = 0, dc = 0;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) dr = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) dr = 1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) dc = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) dc = 1;
    else return;

    char.tryMove(dr, dc, (r, c, floor) => {
      return this.canMoveTo(r, c, floor);
    });
  }

  canMoveTo(r, c, floor) {
    const grid = this.garage.floors[floor];
    if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) return false;
    return grid[r][c] !== CELL.WALL;
  }

  // ===================== INTERACTIONS =====================

  checkTileInteractions() {
    const char = this.characters[this.activeCharIndex];
    if (char.reachedCar || char.isMoving) return;

    const grid = this.garage.floors[char.floor];
    const cell = grid[char.gridR]?.[char.gridC];

    // Stairs — switch floors (only trigger once per entry)
    if (cell === CELL.STAIRS) {
      if (!this.onStairs) {
        this.onStairs = true;
        const newFloor = (char.floor + 1) % NUM_FLOORS;
        char.floor = newFloor;

        if (char.floor !== this.currentFloor) {
          this.currentFloor = char.floor;
          this.switchFloor();
        }

        char.showFloatingText(`Floor ${newFloor + 1}`, '#4488cc');
      }
    } else {
      this.onStairs = false;
    }

    // Bathroom — Elaine relief
    if (cell === CELL.BATHROOM && char.id === 'elaine') {
      char.useBathroom();
    }

    // AC Unit — George pickup
    if (cell === CELL.AC_UNIT && char.id === 'george' && !char.hasAC) {
      char.pickupAC();
      this.acPickedUp = true;
      // Remove the tile visually
      grid[char.gridR][char.gridC] = CELL.FLOOR;
      this.switchFloor();
    }

    // Keys — Kramer pickup
    if (cell === CELL.KEYS && char.id === 'kramer' && !char.hasKeys) {
      char.pickupKeys();
      this.keysPickedUp = true;
      grid[char.gridR][char.gridC] = CELL.FLOOR;
      this.switchFloor();
    }

    // Car — goal!
    if (cell === CELL.CAR) {
      // George must have AC
      if (char.id === 'george' && !char.hasAC) {
        char.showFloatingText('Need the AC unit first!', '#ff4444');
        return;
      }
      // Kramer must have keys
      if (char.id === 'kramer' && !char.hasKeys) {
        char.showFloatingText('Need the keys first!', '#ff4444');
        return;
      }
      if (!char.reachedCar) {
        char.reachedCar = true;
        char.showFloatingText('At the car! ✓', '#44cc44');
        this.charsAtCar++;

        // Switch to next available character
        if (this.charsAtCar < 4) {
          for (let i = 0; i < 4; i++) {
            if (!this.characters[i].reachedCar) {
              this.characters[this.activeCharIndex].setActive(false);
              this.activeCharIndex = i;
              this.characters[i].setActive(true);
              if (this.characters[i].floor !== this.currentFloor) {
                this.currentFloor = this.characters[i].floor;
                this.switchFloor();
              }
              break;
            }
          }
        }

        // Win check
        if (this.charsAtCar >= 4) {
          this.winGame();
        }
      }
    }
  }

  checkGuardDetection(guard) {
    for (const char of this.characters) {
      if (char.floor !== guard.floor || char.reachedCar || char.isFrozen || char.caughtPenalty) continue;

      if (guard.canSee(char.gridR, char.gridC)) {
        this.onCharacterCaught(char);
      }
    }
  }

  onCharacterCaught(char) {
    char.caughtPenalty = true;
    char.freeze(3000); // freeze briefly

    // Time penalty
    this.timeLeft = Math.max(0, this.timeLeft - CAUGHT_PENALTY);
    char.showFloatingText(`Caught! -${CAUGHT_PENALTY}s`, '#ff4444');

    // Camera flash
    this.cameras.main.flash(200, 255, 0, 0);

    // George drops AC if caught
    if (char.id === 'george' && char.hasAC) {
      char.dropAC();
      // Place AC back at a random floor cell
      const acFloor = char.floor;
      const grid = this.garage.floors[acFloor];
      const cells = [];
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
          if (grid[r][c] === CELL.FLOOR) cells.push({ r, c });
        }
      }
      if (cells.length > 0) {
        const pos = cells[Math.floor(Math.random() * cells.length)];
        grid[pos.r][pos.c] = CELL.AC_UNIT;
        this.acPickedUp = false;
        this.garage.acFloor = acFloor;
        this.garage.acPos = pos;
        if (acFloor === this.currentFloor) {
          this.switchFloor();
        }
      }
    }

    // Send character back to start
    const startPos = this.garage.startPositions[this.characters.indexOf(char)];
    char.gridR = startPos.r;
    char.gridC = startPos.c;
    char.floor = startPos.floor;
    char.updatePosition();

    // Update floor view if active character was caught
    if (char === this.characters[this.activeCharIndex] && char.floor !== this.currentFloor) {
      this.currentFloor = char.floor;
      this.switchFloor();
    }

    this.time.delayedCall(3000, () => {
      char.caughtPenalty = false;
    });
  }

  // ===================== FLOOR VISIBILITY =====================

  updateFloorVisibility() {
    // Show/hide characters based on current floor
    for (const char of this.characters) {
      char.setVisible(char.floor === this.currentFloor);
    }
    // Show/hide guards
    for (const guard of this.guards) {
      guard.setVisible(guard.floor === this.currentFloor);
    }
  }

  // ===================== WIN / LOSE =====================

  winGame() {
    this.gameOver = true;
    if (this.timerEvent) this.timerEvent.remove();

    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setDepth(300);

    this.add.text(width / 2, height / 2 - 60, 'YOU MADE IT!', {
      fontSize: '36px',
      fontFamily: 'Courier New',
      color: '#44cc44',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(301);

    this.add.text(width / 2, height / 2 - 15, 'Everyone reached the car!', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(301);

    this.add.text(width / 2, height / 2 + 15, `Time remaining: ${this.formatTime(this.timeLeft)}`, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(0.5).setDepth(301);

    this.addEndButtons(height);
  }

  loseGame(reason) {
    this.gameOver = true;
    if (this.timerEvent) this.timerEvent.remove();

    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setDepth(300);

    this.add.text(width / 2, height / 2 - 60, 'GAME OVER', {
      fontSize: '36px',
      fontFamily: 'Courier New',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(301);

    this.add.text(width / 2, height / 2 - 15, reason, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#cccccc',
    }).setOrigin(0.5).setDepth(301);

    this.add.text(width / 2, height / 2 + 15, `Characters at car: ${this.charsAtCar}/4`, {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(0.5).setDepth(301);

    this.addEndButtons(height);
  }

  addEndButtons(height) {
    const { width } = this.scale;

    const retryBtn = this.add.text(width / 2, height / 2 + 60, '[ PLAY AGAIN ]', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerover', () => retryBtn.setColor('#44cc44'));
    retryBtn.on('pointerout', () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    const menuBtn = this.add.text(width / 2, height / 2 + 95, '[ BACK TO MENU ]', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  addBackButton() {
    const btn = this.add.text(10, this.scale.height - 20, '← Menu', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setInteractive({ useHandCursor: true }).setDepth(100);

    btn.on('pointerover', () => btn.setColor('#e94560'));
    btn.on('pointerout', () => btn.setColor('#888888'));
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
