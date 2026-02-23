import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

/**
 * The Frogger - Classic Frogger-style mini-game
 *
 * Based on "The Frogger" episode — George discovers his old Frogger
 * arcade machine still has the high score. He has to push it across
 * a busy NYC street without getting hit by traffic.
 *
 * Arrow keys to move the Frogger cabinet across lanes of traffic.
 */

const LANE_HEIGHT = 50;
const NUM_LANES = 8;
const SAFE_ZONE_HEIGHT = 60;
const ROAD_TOP = 70;

// Vehicle definitions per lane (direction, speed range, color, width)
const LANE_CONFIGS = [
  { dir: 1, speedMin: 100, speedMax: 140, color: 0xcccc00, w: 80, h: 30, label: 'TAXI' },
  { dir: -1, speedMin: 80, speedMax: 120, color: 0x3366cc, w: 100, h: 35, label: 'BUS' },
  { dir: 1, speedMin: 130, speedMax: 170, color: 0xcc3333, w: 70, h: 28, label: '' },
  { dir: -1, speedMin: 90, speedMax: 130, color: 0x33cc33, w: 60, h: 26, label: '' },
  { dir: 1, speedMin: 150, speedMax: 200, color: 0xff6600, w: 65, h: 28, label: '' },
  { dir: -1, speedMin: 70, speedMax: 110, color: 0x9933cc, w: 90, h: 32, label: '' },
  { dir: 1, speedMin: 110, speedMax: 160, color: 0xcccc00, w: 80, h: 30, label: 'TAXI' },
  { dir: -1, speedMin: 160, speedMax: 220, color: 0xffffff, w: 75, h: 28, label: '' },
];

export class FroggerScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FroggerScene' });
  }

  init() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.isPlaying = false;
    this.isMoving = false;
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    this.drawBackground();
    this.createPlayer();
    this.createVehicles();
    this.createUI();
    this.setupInput();

    // Start prompt
    this.startText = this.add.text(width / 2, height / 2, 'Press any arrow key to start!', {
      fontSize: '22px',
      fontFamily: 'Courier New',
      color: '#00ff00',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    this.addBackButton();
  }

  // ---------- DRAWING ----------

  drawBackground() {
    const { width, height } = this.scale;

    // Sky / top safe zone (the goal — other side of the street)
    this.add.rectangle(width / 2, ROAD_TOP / 2, width, ROAD_TOP, 0x224422);
    this.add.text(width / 2, ROAD_TOP / 2, '🏁  SAFE ZONE  🏁', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#66ff66',
    }).setOrigin(0.5);

    // Road lanes
    for (let i = 0; i < NUM_LANES; i++) {
      const y = ROAD_TOP + i * LANE_HEIGHT + LANE_HEIGHT / 2;
      const shade = i % 2 === 0 ? 0x333333 : 0x2a2a2a;
      this.add.rectangle(width / 2, y, width, LANE_HEIGHT, shade);

      // Lane divider dashes
      if (i < NUM_LANES - 1) {
        const dividerY = ROAD_TOP + (i + 1) * LANE_HEIGHT;
        for (let dx = 20; dx < width; dx += 60) {
          this.add.rectangle(dx, dividerY, 30, 2, 0x555555);
        }
      }
    }

    // Bottom safe zone (starting sidewalk)
    const sidewalkY = ROAD_TOP + NUM_LANES * LANE_HEIGHT + SAFE_ZONE_HEIGHT / 2;
    this.add.rectangle(width / 2, sidewalkY, width, SAFE_ZONE_HEIGHT, 0x555555);
    // Sidewalk texture lines
    for (let dx = 0; dx < width; dx += 40) {
      this.add.rectangle(dx, sidewalkY - 20, 1, SAFE_ZONE_HEIGHT, 0x666666);
    }
    this.add.text(width / 2, sidewalkY + 10, "Mario's Pizza", {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#999999',
    }).setOrigin(0.5);
  }

  createPlayer() {
    const { width } = this.scale;

    // Starting position: center of bottom safe zone
    const startX = width / 2;
    const startY = ROAD_TOP + NUM_LANES * LANE_HEIGHT + SAFE_ZONE_HEIGHT / 2;

    this.playerStartX = startX;
    this.playerStartY = startY;

    // The "player" is the Frogger arcade cabinet being pushed by George
    this.player = this.add.container(startX, startY).setDepth(50);

    // Arcade cabinet body
    const cabinet = this.add.rectangle(0, -5, 34, 40, 0x1a5c1a).setStrokeStyle(2, 0x0d3d0d);
    // Screen
    const screen = this.add.rectangle(0, -14, 24, 16, 0x003300).setStrokeStyle(1, 0x00ff00);
    // "FROGGER" text on cabinet
    const label = this.add.text(0, -14, 'F', {
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: '#00ff00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    // Controls panel
    const controls = this.add.rectangle(0, 2, 20, 6, 0x222222);
    // George behind the cabinet (pushing)
    const georgeHead = this.add.circle(0, 20, 10, 0xd4a574);
    const glasses1 = this.add.circle(-4, 18, 4, 0x333333, 0).setStrokeStyle(1.5, 0x333333);
    const glasses2 = this.add.circle(4, 18, 4, 0x333333, 0).setStrokeStyle(1.5, 0x333333);
    const body = this.add.rectangle(0, 32, 20, 14, 0x2266aa);

    this.player.add([body, georgeHead, glasses1, glasses2, cabinet, screen, label, controls]);

    // Physics body for collision
    this.physics.world.enable(this.player);
    this.player.body.setSize(34, 50);
    this.player.body.setOffset(-17, -30);
  }

  createVehicles() {
    const { width } = this.scale;

    this.vehicles = this.physics.add.group();

    for (let i = 0; i < NUM_LANES; i++) {
      const config = LANE_CONFIGS[i];
      const y = ROAD_TOP + i * LANE_HEIGHT + LANE_HEIGHT / 2;

      // Spawn 2-3 vehicles per lane
      const count = Phaser.Math.Between(2, 3);
      const spacing = width / count;

      for (let v = 0; v < count; v++) {
        const startX = config.dir === 1
          ? v * spacing + Phaser.Math.Between(0, 50)
          : width - v * spacing - Phaser.Math.Between(0, 50);

        this.spawnVehicle(startX, y, i);
      }
    }

    // Collision detection
    this.physics.add.overlap(this.player, this.vehicles, this.onHitVehicle, null, this);
  }

  spawnVehicle(x, y, laneIndex) {
    const config = LANE_CONFIGS[laneIndex];
    const speed = Phaser.Math.Between(config.speedMin, config.speedMax) * this.level;

    // Create vehicle as a rectangle with physics
    const vehicle = this.add.rectangle(x, y, config.w, config.h, config.color)
      .setStrokeStyle(1, 0x000000)
      .setDepth(30);

    // Add to group first (which enables physics), THEN set velocity
    vehicle.laneIndex = laneIndex;
    this.vehicles.add(vehicle);
    vehicle.body.setVelocityX(speed * config.dir);
    vehicle.body.setImmovable(true);

    // Headlights
    const hlOffset = config.dir === 1 ? config.w / 2 - 3 : -config.w / 2 + 3;
    this.add.circle(x + hlOffset, y - 5, 3, 0xffffaa, 0.7).setDepth(31);
    this.add.circle(x + hlOffset, y + 5, 3, 0xffffaa, 0.7).setDepth(31);

    // Label if exists
    if (config.label) {
      this.add.text(x, y, config.label, {
        fontSize: '9px',
        fontFamily: 'Courier New',
        color: '#000000',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(32);
    }

    return vehicle;
  }

  createUI() {
    const { width } = this.scale;

    this.add.text(width / 2, ROAD_TOP + NUM_LANES * LANE_HEIGHT + SAFE_ZONE_HEIGHT + 8, 'THE FROGGER', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#00ff00',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.scoreText = this.add.text(20, ROAD_TOP + NUM_LANES * LANE_HEIGHT + SAFE_ZONE_HEIGHT + 4, 'Score: 0', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#00ff00',
    }).setDepth(50);

    this.livesText = this.add.text(20, ROAD_TOP + NUM_LANES * LANE_HEIGHT + SAFE_ZONE_HEIGHT + 22, '❤️ ❤️ ❤️', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ff0000',
    }).setDepth(50);

    this.levelText = this.add.text(width - 20, ROAD_TOP + NUM_LANES * LANE_HEIGHT + SAFE_ZONE_HEIGHT + 4, `Level: ${this.level}`, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(1, 0).setDepth(50);
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // ---------- GAME LOOP ----------

  update() {
    if (!this.isPlaying) {
      // Wait for first keypress
      if (this.cursors.up.isDown || this.cursors.down.isDown ||
          this.cursors.left.isDown || this.cursors.right.isDown) {
        this.isPlaying = true;
        if (this.startText) {
          this.startText.destroy();
          this.startText = null;
        }
      } else {
        this.wrapVehicles();
        return;
      }
    }

    this.wrapVehicles();
    this.handleMovement();
    this.checkWin();
  }

  wrapVehicles() {
    const { width } = this.scale;
    const margin = 120;

    this.vehicles.getChildren().forEach((v) => {
      const config = LANE_CONFIGS[v.laneIndex];
      if (config.dir === 1 && v.x > width + margin) {
        v.x = -margin;
      } else if (config.dir === -1 && v.x < -margin) {
        v.x = width + margin;
      }
    });
  }

  handleMovement() {
    if (this.isMoving) return;

    const step = LANE_HEIGHT;
    const { width } = this.scale;
    let targetX = this.player.x;
    let targetY = this.player.y;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      targetY -= step;
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      targetY += step;
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
      targetX -= step;
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
      targetX += step;
    } else {
      return;
    }

    // Clamp within bounds
    const topBound = ROAD_TOP / 2;
    const bottomBound = ROAD_TOP + NUM_LANES * LANE_HEIGHT + SAFE_ZONE_HEIGHT / 2;
    targetY = Phaser.Math.Clamp(targetY, topBound, bottomBound);
    targetX = Phaser.Math.Clamp(targetX, 30, width - 30);

    if (targetX === this.player.x && targetY === this.player.y) return;

    // Hop animation
    this.isMoving = true;
    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: targetY,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.isMoving = false;
      },
    });
  }

  checkWin() {
    // Reached the top safe zone
    if (this.player.y <= ROAD_TOP / 2 + 10) {
      this.score += 100 * this.level;
      this.scoreText.setText(`Score: ${this.score}`);

      const { width } = this.scale;

      // Victory flash
      const msg = this.add.text(width / 2, this.scale.height / 2, 'SAFE! +' + (100 * this.level), {
        fontSize: '28px',
        fontFamily: 'Courier New',
        color: '#00ff00',
        fontStyle: 'bold',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }).setOrigin(0.5).setDepth(200);

      this.cameras.main.flash(300, 0, 255, 0);

      // Next level
      this.level++;
      this.levelText.setText(`Level: ${this.level}`);

      // Reset player position after short delay
      this.isPlaying = false;
      this.isMoving = true; // prevent input during reset

      this.time.delayedCall(1200, () => {
        msg.destroy();
        this.resetPlayer();
        this.speedUpTraffic();
        this.isPlaying = true;
        this.isMoving = false;
      });
    }
  }

  onHitVehicle() {
    if (!this.isPlaying || this.isMoving === 'dying') return;
    this.isMoving = 'dying';

    this.lives--;
    this.updateLives();

    // Death effect
    this.cameras.main.shake(300, 0.02);

    // Flatten effect
    this.tweens.add({
      targets: this.player,
      scaleY: 0.1,
      scaleX: 1.8,
      duration: 200,
      yoyo: false,
    });

    const { width } = this.scale;
    const splat = this.add.text(this.player.x, this.player.y - 30, 'SPLAT!', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(200);

    if (this.lives <= 0) {
      this.time.delayedCall(800, () => {
        splat.destroy();
        this.endGame();
      });
    } else {
      this.time.delayedCall(1000, () => {
        splat.destroy();
        this.player.setScale(1, 1);
        this.resetPlayer();
        this.isMoving = false;
      });
    }
  }

  resetPlayer() {
    this.player.setPosition(this.playerStartX, this.playerStartY);
    this.player.setScale(1, 1);
  }

  speedUpTraffic() {
    this.vehicles.getChildren().forEach((v) => {
      const config = LANE_CONFIGS[v.laneIndex];
      const speed = Phaser.Math.Between(config.speedMin, config.speedMax) * this.level;
      v.body.setVelocityX(speed * config.dir);
    });
  }

  updateLives() {
    const hearts = [];
    for (let i = 0; i < 3; i++) {
      hearts.push(i < this.lives ? '❤️' : '🖤');
    }
    this.livesText.setText(hearts.join(' '));
  }

  endGame() {
    this.isPlaying = false;
    const { width, height } = this.scale;

    // Stop all vehicles
    this.vehicles.getChildren().forEach((v) => v.body.setVelocity(0));

    // Dim overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(150);

    this.add.text(width / 2, height / 2 - 70, 'GAME OVER', {
      fontSize: '40px',
      fontFamily: 'Courier New',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 - 25, '"Why did the Frogger cross the road?"', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#cccccc',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(width / 2, height / 2 + 10, `Final Score: ${this.score}  |  Level: ${this.level}`, {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
    }).setOrigin(0.5).setDepth(151);

    // Retry
    const retryBtn = this.add.text(width / 2, height / 2 + 60, '[ PLAY AGAIN ]', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerover', () => retryBtn.setColor('#00ff00'));
    retryBtn.on('pointerout', () => retryBtn.setColor('#888888'));
    retryBtn.on('pointerdown', () => this.scene.restart());

    // Menu
    const menuBtn = this.add.text(width / 2, height / 2 + 100, '[ BACK TO MENU ]', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#e94560'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#888888'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  addBackButton() {
    const y = ROAD_TOP + NUM_LANES * LANE_HEIGHT + SAFE_ZONE_HEIGHT + 22;
    const btn = this.add.text(this.scale.width - 20, y, '← Menu', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#888888',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(50);

    btn.on('pointerover', () => btn.setColor('#e94560'));
    btn.on('pointerout', () => btn.setColor('#888888'));
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
