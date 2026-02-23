import Phaser from 'phaser';
import { ensureThemePlaying } from '../../scenes/BootScene.js';

const LANE_COUNT = 3;
const ROAD_LEFT = 200;
const ROAD_RIGHT = 600;
const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;
const CAR_WIDTH = 40;
const CAR_HEIGHT = 60;
const TARGET_DISTANCE = 10000;
const STARTING_SPEED = 3;
const MAX_SPEED = 8;
const NEAR_MISS_THRESHOLD = 20;
const INVINCIBLE_DURATION = 1500;

const OBSTACLE_TYPES = [
  { type: 'taxi', width: 36, height: 56, speed: 0, laneChange: true, color: 0xffcc00, label: 'TAXI' },
  { type: 'cyclist', width: 16, height: 30, speed: -1, laneChange: false, color: 0x44cc44, label: null },
  { type: 'pedestrian', width: 20, height: 20, speed: 0, laneChange: false, color: 0xf2c89d, label: null, crosses: true },
  { type: 'truck', width: 44, height: 70, speed: 0, laneChange: false, color: 0x8B6914, label: 'UPS' },
  { type: 'hotdog', width: 24, height: 24, speed: 0, laneChange: false, color: 0xcc4444, label: null },
  { type: 'pothole', width: 30, height: 16, speed: 0, laneChange: false, color: 0x222222, label: null, noDamage: true },
  { type: 'police', width: 36, height: 56, speed: 1.5, laneChange: true, color: 0x4466cc, label: null },
];

const CUTSCENE_STEPS = [
  { delay: 0, action: 'showApartment' },
  { delay: 1500, action: 'jerryEnters' },
  { delay: 3500, action: 'jerrySpeaks', text: "Jean-Paul! JEAN-PAUL!\nIt's 8:47!", speaker: 'jerry' },
  { delay: 6500, action: 'jeanPaulWakes', text: "8:47?! The marathon...\nshe starts at 9!", speaker: 'jeanpaul' },
  { delay: 9000, action: 'jerryPanic', text: "We gotta go! NOW!", speaker: 'jerry' },
  { delay: 11000, action: 'jeanPaulReply', text: "You idiot!\nI trusted you!", speaker: 'jeanpaul' },
  { delay: 13000, action: 'bothRun' },
  { delay: 14500, action: 'transition' },
];

export class JeanPaulScene extends Phaser.Scene {
  constructor() {
    super({ key: 'JeanPaulScene' });
  }

  init(data) {
    this.phase = data && data.skipCutscene ? 'driving' : 'cutscene';
    this.score = 0;
    this.lives = 3;
    this.distance = 0;
    this.roadSpeed = STARTING_SPEED;
    this.gameTime = 8 * 60 + 47; // 8:47 in minutes
    this.elapsedMs = 0;
    this.gameOver = false;
    this.gameWon = false;
    this.obstacles = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1200;
    this.lineOffset = 0;
    this.invincibleTimer = 0;
    this.carLane = 1; // middle lane
    this.carTargetX = 0;
    this.nearMissScore = 0;
    this.decorBuildings = [];
    this.cutsceneTimers = [];
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    this.cursors = this.input.keyboard.createCursorKeys();

    if (this.phase === 'cutscene') {
      this.startCutscene(width, height);
    } else {
      this.startDriving(width, height);
    }

    this.addBackButton();
  }

  update(time, delta) {
    if (this.phase === 'cutscene') {
      this.updateCutscene(delta);
    } else if (this.phase === 'driving' && !this.gameOver && !this.gameWon) {
      this.updateDriving(delta);
    }
  }

  // ===================== CUTSCENE =====================

  startCutscene(width, height) {
    this.cutsceneContainer = this.add.container(0, 0);

    // Draw Jerry's apartment background
    this.drawApartment(width, height);

    // Jean-Paul sleeping on couch
    this.jeanPaulContainer = this.add.container(300, 360);
    this.drawSleepingJeanPaul(this.jeanPaulContainer);
    this.cutsceneContainer.add(this.jeanPaulContainer);

    // Z's floating animation
    this.zTexts = [];
    for (let i = 0; i < 3; i++) {
      const z = this.add.text(320 + i * 15, 310 - i * 20, 'Z', {
        fontSize: (14 + i * 4) + 'px',
        fontFamily: 'Courier New',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setAlpha(0.6 - i * 0.15);
      this.cutsceneContainer.add(z);
      this.zTexts.push(z);
      this.tweens.add({
        targets: z,
        y: z.y - 15,
        alpha: 0,
        duration: 1500,
        delay: i * 400,
        yoyo: true,
        repeat: -1,
      });
    }

    // Jerry (hidden initially, enters from right)
    this.jerryContainer = this.add.container(850, 380);
    this.drawJerryCutscene(this.jerryContainer);
    this.cutsceneContainer.add(this.jerryContainer);

    // Speech bubble container
    this.speechContainer = this.add.container(0, 0).setDepth(20);
    this.speechContainer.setAlpha(0);

    // Schedule cutscene events
    CUTSCENE_STEPS.forEach((step) => {
      const timer = this.time.delayedCall(step.delay, () => {
        this.executeCutsceneStep(step);
      });
      this.cutsceneTimers.push(timer);
    });
  }

  executeCutsceneStep(step) {
    const { width, height } = this.scale;

    switch (step.action) {
      case 'showApartment':
        // Already visible
        break;

      case 'jerryEnters':
        this.tweens.add({
          targets: this.jerryContainer,
          x: 520,
          duration: 800,
          ease: 'Power2',
        });
        break;

      case 'jerrySpeaks':
      case 'jerryPanic':
        this.showCutsceneSpeech(this.jerryContainer.x, this.jerryContainer.y - 80, step.text);
        break;

      case 'jeanPaulWakes':
        // Remove Z's
        this.zTexts.forEach(z => {
          this.tweens.killTweensOf(z);
          z.setVisible(false);
        });
        // Sit up animation
        this.jeanPaulContainer.removeAll(true);
        this.drawSittingJeanPaul(this.jeanPaulContainer);
        this.showCutsceneSpeech(this.jeanPaulContainer.x, this.jeanPaulContainer.y - 80, step.text);
        break;

      case 'jeanPaulReply':
        this.showCutsceneSpeech(this.jeanPaulContainer.x, this.jeanPaulContainer.y - 80, step.text);
        break;

      case 'bothRun':
        this.hideSpeech();
        // Both run toward the door (left side)
        this.tweens.add({
          targets: this.jerryContainer,
          x: -50,
          duration: 1000,
          ease: 'Power2',
        });
        this.tweens.add({
          targets: this.jeanPaulContainer,
          x: -50,
          duration: 1200,
          ease: 'Power2',
        });
        break;

      case 'transition':
        this.cameras.main.flash(300, 255, 255, 255);
        const transText = this.add.text(width / 2, height / 2, 'GET TO THE CAR!', {
          fontSize: '48px',
          fontFamily: 'Courier New',
          color: '#ffcc00',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 6,
        }).setOrigin(0.5).setDepth(50).setScale(0);

        this.tweens.add({
          targets: transText,
          scale: 1,
          duration: 400,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.time.delayedCall(1000, () => {
              this.tweens.add({
                targets: transText,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                  transText.destroy();
                  this.transitionToDriving();
                },
              });
            });
          },
        });
        break;
    }
  }

  showCutsceneSpeech(x, y, text) {
    this.speechContainer.removeAll(true);
    this.speechContainer.setPosition(x, y);
    this.speechContainer.setAlpha(0).setScale(0);

    const padding = 16;
    const tempText = this.add.text(0, 0, text, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#1a1a2e',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    const bw = tempText.width + padding * 2;
    const bh = tempText.height + padding * 2;

    const bubbleG = this.add.graphics();
    bubbleG.fillStyle(0xffffff, 0.95);
    bubbleG.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
    // Triangle pointer
    bubbleG.fillTriangle(0, bh / 2 - 2, -10, bh / 2 + 14, 10, bh / 2 - 2);

    this.speechContainer.add(bubbleG);
    this.speechContainer.add(tempText);

    this.tweens.add({
      targets: this.speechContainer,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  hideSpeech() {
    this.tweens.add({
      targets: this.speechContainer,
      alpha: 0,
      duration: 200,
    });
  }

  updateCutscene() {
    // Cutscene is timer-driven, no per-frame logic needed
  }

  transitionToDriving() {
    // Clean up cutscene
    if (this.cutsceneContainer) this.cutsceneContainer.destroy();
    if (this.speechContainer) this.speechContainer.destroy();
    this.cutsceneTimers = [];

    this.phase = 'driving';
    const { width, height } = this.scale;
    this.startDriving(width, height);
  }

  // ===================== DRIVING GAME =====================

  startDriving(width, height) {
    this.drivingContainer = this.add.container(0, 0);

    // Road background
    this.roadGfx = this.add.graphics();
    this.drivingContainer.add(this.roadGfx);

    // Decorative buildings on sides
    this.buildingGfx = this.add.graphics();
    this.drivingContainer.add(this.buildingGfx);
    this.generateBuildings();

    // Jerry's car
    this.carX = this.getLaneX(1);
    this.carTargetX = this.carX;
    this.carContainer = this.add.container(this.carX, height - 100);
    this.drawCar(this.carContainer);
    this.carContainer.setDepth(10);

    // Obstacle group container
    this.obstacleContainer = this.add.container(0, 0).setDepth(5);

    // UI Elements
    this.createDrivingUI(width);

    this.drawRoad();
  }

  createDrivingUI(width) {
    // Score (top-left)
    this.scoreText = this.add.text(20, 16, 'Score: 0', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setDepth(30);

    // Lives (top-left, below score)
    this.livesText = this.add.text(20, 38, this.getLivesString(), {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#e94560',
    }).setDepth(30);

    // Clock (top-right)
    this.clockText = this.add.text(width - 20, 16, this.formatTime(this.gameTime), {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(30);

    this.clockLabel = this.add.text(width - 20, 38, 'GET THERE BY 9:00!', {
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: '#aaaaaa',
    }).setOrigin(1, 0).setDepth(30);

    // Progress bar (top-center)
    this.add.text(width / 2, 8, 'MARATHON START', {
      fontSize: '10px',
      fontFamily: 'Courier New',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0).setDepth(30);

    const barWidth = 200;
    this.progressBarBg = this.add.rectangle(width / 2, 30, barWidth, 10, 0x333333)
      .setDepth(30);
    this.progressBarFill = this.add.rectangle(width / 2 - barWidth / 2, 30, 0, 8, 0x44cc44)
      .setOrigin(0, 0.5).setDepth(30);
    this.progressBarWidth = barWidth;

    // Near miss flash text
    this.nearMissText = this.add.text(width / 2, 80, '', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#ffcc00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30).setAlpha(0);
  }

  updateDriving(delta) {
    const { width, height } = this.scale;

    // Increase speed over time
    const progress = this.distance / TARGET_DISTANCE;
    this.roadSpeed = STARTING_SPEED + (MAX_SPEED - STARTING_SPEED) * Math.min(1, progress);

    // Update distance
    this.distance += this.roadSpeed * (delta / 16);
    this.score = Math.floor(this.distance);
    this.scoreText.setText('Score: ' + this.score);

    // Update time based on real elapsed seconds (~13 game-minutes over 45 real seconds)
    this.elapsedMs += delta;
    this.gameTime = 8 * 60 + 47 + (this.elapsedMs / 45000) * 13;

    // Check time loss
    if (this.gameTime >= 9 * 60) {
      this.loseGame('TIME\'S UP!\nThe marathon started without Jean-Paul!');
      return;
    }

    this.clockText.setText(this.formatTime(this.gameTime));

    // Flash clock when close to 9:00
    if (this.gameTime >= 8 * 60 + 57) {
      this.clockText.setColor(Math.floor(this.time.now / 300) % 2 === 0 ? '#e94560' : '#ffcc00');
    }

    // Update progress bar
    const pct = Math.min(1, this.distance / TARGET_DISTANCE);
    this.progressBarFill.width = this.progressBarWidth * pct;

    // Check win
    if (this.distance >= TARGET_DISTANCE) {
      this.winGame();
      return;
    }

    // Update road lines
    this.lineOffset = (this.lineOffset + this.roadSpeed) % 40;
    this.drawRoad();

    // Update invincibility
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= delta;
      this.carContainer.setAlpha(Math.floor(this.time.now / 100) % 2 === 0 ? 0.4 : 1);
    } else {
      this.carContainer.setAlpha(1);
    }

    // Car steering
    if (this.cursors.left.isDown) {
      this.carX -= 4;
    } else if (this.cursors.right.isDown) {
      this.carX += 4;
    }
    this.carX = Phaser.Math.Clamp(this.carX, ROAD_LEFT + CAR_WIDTH / 2 + 5, ROAD_RIGHT - CAR_WIDTH / 2 - 5);
    this.carContainer.x = this.carX;

    // Spawn obstacles
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      // Decrease spawn interval as game progresses
      this.spawnInterval = Math.max(400, 1200 - progress * 800);
      this.spawnTimer = this.spawnInterval + Phaser.Math.Between(-200, 200);
    }

    // Update obstacles
    this.updateObstacles(delta, height);

    // Update building scroll
    this.updateBuildings();
  }

  // ===================== ROAD DRAWING =====================

  drawRoad() {
    const { height } = this.scale;
    const g = this.roadGfx;
    g.clear();

    // Sky / background
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(0, 0, 800, height);

    // Sidewalks
    g.fillStyle(0x555555, 1);
    g.fillRect(ROAD_LEFT - 20, 0, 20, height);
    g.fillRect(ROAD_RIGHT, 0, 20, height);

    // Road surface
    g.fillStyle(0x333333, 1);
    g.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, height);

    // Lane markings (dashed)
    g.lineStyle(2, 0xffffff, 0.6);
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      const lx = ROAD_LEFT + lane * LANE_WIDTH;
      for (let y = -40 + this.lineOffset; y < height; y += 40) {
        g.lineBetween(lx, y, lx, y + 20);
      }
    }

    // Road edges (solid yellow lines)
    g.lineStyle(3, 0xffcc00, 1);
    g.lineBetween(ROAD_LEFT, 0, ROAD_LEFT, height);
    g.lineBetween(ROAD_RIGHT, 0, ROAD_RIGHT, height);
  }

  // ===================== BUILDINGS =====================

  generateBuildings() {
    this.decorBuildings = [];
    for (let i = 0; i < 20; i++) {
      this.decorBuildings.push({
        side: i % 2 === 0 ? 'left' : 'right',
        y: i * 80 - 200,
        w: Phaser.Math.Between(40, 80),
        h: Phaser.Math.Between(60, 120),
        color: Phaser.Utils.Array.GetRandom([0x2a2a4e, 0x3a2a2e, 0x2a3a4e, 0x4a3a2e]),
        windows: Phaser.Math.Between(2, 5),
      });
    }
  }

  updateBuildings() {
    const { height } = this.scale;
    const g = this.buildingGfx;
    g.clear();

    this.decorBuildings.forEach(b => {
      b.y += this.roadSpeed * 0.5;
      if (b.y > height + 100) {
        b.y -= 20 * 80 + 200;
      }

      const x = b.side === 'left' ? ROAD_LEFT - 20 - b.w : ROAD_RIGHT + 20;
      g.fillStyle(b.color, 1);
      g.fillRect(x, b.y, b.w, b.h);

      // Windows
      g.fillStyle(0xffcc44, 0.3);
      const winSize = 6;
      const winGap = 12;
      for (let wy = b.y + 8; wy < b.y + b.h - 8; wy += winGap) {
        for (let wx = x + 8; wx < x + b.w - 8; wx += winGap) {
          g.fillRect(wx, wy, winSize, winSize);
        }
      }
    });
  }

  // ===================== CAR DRAWING =====================

  drawCar(container) {
    const g = this.add.graphics();

    // Car body (top-down view)
    g.fillStyle(0x4488cc, 1);
    g.fillRoundedRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT, 6);

    // Windshield
    g.fillStyle(0x88bbdd, 0.7);
    g.fillRect(-CAR_WIDTH / 2 + 4, -CAR_HEIGHT / 2 + 4, CAR_WIDTH - 8, 14);

    // Rear window
    g.fillStyle(0x88bbdd, 0.7);
    g.fillRect(-CAR_WIDTH / 2 + 4, CAR_HEIGHT / 2 - 14, CAR_WIDTH - 8, 10);

    // Roof
    g.fillStyle(0x3377aa, 1);
    g.fillRect(-CAR_WIDTH / 2 + 6, -8, CAR_WIDTH - 12, 20);

    // Jerry (driver, left dot)
    g.fillStyle(0xf2c89d, 1);
    g.fillCircle(-6, 2, 5);
    // Jerry's hair
    g.fillStyle(0x2a2a2e, 1);
    g.slice(-6, 0, 5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), true);
    g.fillPath();

    // Jean-Paul (passenger, right dot)
    g.fillStyle(0x8B6914, 1);
    g.fillCircle(8, 2, 5);
    // Jean-Paul's headband
    g.lineStyle(2, 0xe94560, 1);
    g.beginPath();
    g.arc(8, 0, 5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
    g.strokePath();

    // Wheels
    g.fillStyle(0x111111, 1);
    g.fillRect(-CAR_WIDTH / 2 - 3, -18, 5, 12);
    g.fillRect(-CAR_WIDTH / 2 - 3, 8, 5, 12);
    g.fillRect(CAR_WIDTH / 2 - 2, -18, 5, 12);
    g.fillRect(CAR_WIDTH / 2 - 2, 8, 5, 12);

    container.add(g);
  }

  // ===================== OBSTACLES =====================

  spawnObstacle() {
    const lane = Phaser.Math.Between(0, LANE_COUNT - 1);
    const typeDef = Phaser.Utils.Array.GetRandom(OBSTACLE_TYPES);
    const x = this.getLaneX(lane);

    const obstacle = {
      ...typeDef,
      x: typeDef.crosses ? ROAD_LEFT - 30 : x,
      y: -80,
      lane,
      laneChangeTimer: typeDef.laneChange ? Phaser.Math.Between(1000, 3000) : 0,
      targetX: x,
      crossed: false,
      speechShown: false,
      container: this.add.container(0, 0),
    };

    this.drawObstacle(obstacle);
    this.obstacleContainer.add(obstacle.container);
    this.obstacles.push(obstacle);
  }

  drawObstacle(obs) {
    const g = this.add.graphics();
    const hw = obs.width / 2;
    const hh = obs.height / 2;

    switch (obs.type) {
      case 'taxi':
        g.fillStyle(0xffcc00, 1);
        g.fillRoundedRect(-hw, -hh, obs.width, obs.height, 4);
        g.fillStyle(0xeeaa00, 1);
        g.fillRect(-hw + 3, -hh + 3, obs.width - 6, 10);
        g.fillStyle(0x333333, 1);
        g.fillRect(-hw + 3, hh - 10, obs.width - 6, 7);
        // "TAXI" text on roof
        const taxiLabel = this.add.text(0, 0, 'TAXI', {
          fontSize: '8px', fontFamily: 'Courier New', color: '#333333', fontStyle: 'bold',
        }).setOrigin(0.5);
        obs.container.add(taxiLabel);
        break;

      case 'cyclist':
        // Bike frame
        g.lineStyle(2, 0x666666, 1);
        g.strokeCircle(-4, 6, 6);
        g.strokeCircle(4, 6, 6);
        g.lineBetween(-4, 6, 0, -4);
        g.lineBetween(4, 6, 0, -4);
        // Rider
        g.fillStyle(obs.color, 1);
        g.fillCircle(0, -10, 5);
        break;

      case 'pedestrian':
        g.fillStyle(obs.color, 1);
        g.fillCircle(0, -6, 5);
        // Body
        g.fillStyle(0x4444aa, 1);
        g.fillRect(-4, -1, 8, 10);
        // Legs
        g.fillRect(-4, 9, 3, 6);
        g.fillRect(1, 9, 3, 6);
        break;

      case 'truck':
        g.fillStyle(0x8B6914, 1);
        g.fillRoundedRect(-hw, -hh, obs.width, obs.height, 3);
        g.fillStyle(0x6B4914, 1);
        g.fillRect(-hw + 2, -hh + 2, obs.width - 4, 12);
        const truckLabel = this.add.text(0, 5, 'DELIVERY', {
          fontSize: '7px', fontFamily: 'Courier New', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);
        obs.container.add(truckLabel);
        break;

      case 'hotdog':
        // Cart base
        g.fillStyle(0xcc4444, 1);
        g.fillRect(-hw, -hh, obs.width, obs.height);
        // Umbrella
        g.fillStyle(0xffcc00, 1);
        g.fillEllipse(0, -hh + 2, obs.width + 4, 10);
        // Wheels
        g.fillStyle(0x333333, 1);
        g.fillCircle(-hw + 2, hh, 3);
        g.fillCircle(hw - 2, hh, 3);
        break;

      case 'pothole':
        g.fillStyle(0x111111, 1);
        g.fillEllipse(0, 0, obs.width, obs.height);
        g.lineStyle(1, 0x444444, 0.5);
        g.strokeEllipse(0, 0, obs.width, obs.height);
        break;

      case 'police':
        g.fillStyle(0x2244aa, 1);
        g.fillRoundedRect(-hw, -hh, obs.width, obs.height, 4);
        g.fillStyle(0xffffff, 1);
        g.fillRect(-hw + 3, -hh + 20, obs.width - 6, 4);
        // Lights on top
        this.policeFlashTimer = 0;
        const lightLeft = this.add.rectangle(-8, -hh + 4, 8, 6, 0xe94560).setDepth(1);
        const lightRight = this.add.rectangle(8, -hh + 4, 8, 6, 0x4488ff).setDepth(1);
        obs.container.add([lightLeft, lightRight]);
        obs._lights = [lightLeft, lightRight];
        break;
    }

    obs.container.add(g);
  }

  updateObstacles(delta, height) {
    const carBounds = {
      left: this.carX - CAR_WIDTH / 2,
      right: this.carX + CAR_WIDTH / 2,
      top: this.carContainer.y - CAR_HEIGHT / 2,
      bottom: this.carContainer.y + CAR_HEIGHT / 2,
    };

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];

      // Move obstacle down
      const effectiveSpeed = this.roadSpeed + obs.speed;
      obs.y += effectiveSpeed;

      // Cyclist wobble
      if (obs.type === 'cyclist') {
        obs.x += Math.sin(this.time.now / 300 + i) * 0.5;
      }

      // Pedestrian crosses horizontally
      if (obs.type === 'pedestrian' && obs.crosses) {
        obs.x += 1.5;
        if (obs.x > ROAD_RIGHT + 30) obs.crossed = true;

        // Speech bubble is shown on near miss instead
      }

      // Lane-changing behavior
      if (obs.laneChange && obs.laneChangeTimer > 0) {
        obs.laneChangeTimer -= delta;
        if (obs.laneChangeTimer <= 0) {
          const newLane = Phaser.Math.Between(0, LANE_COUNT - 1);
          obs.targetX = this.getLaneX(newLane);
          obs.laneChangeTimer = Phaser.Math.Between(1500, 3000);
        }
      }

      // Smooth lane transition
      if (obs.targetX && obs.type !== 'pedestrian') {
        obs.x = Phaser.Math.Linear(obs.x, obs.targetX, 0.03);
      }

      // Police lights flash
      if (obs.type === 'police' && obs._lights) {
        const flash = Math.floor(this.time.now / 150) % 2 === 0;
        obs._lights[0].setFillStyle(flash ? 0xe94560 : 0x440000);
        obs._lights[1].setFillStyle(flash ? 0x4488ff : 0x001144);
      }

      // Update container position
      obs.container.setPosition(obs.x, obs.y);

      // Remove off-screen obstacles
      if (obs.y > height + 100 || obs.crossed) {
        obs.container.destroy();
        this.obstacles.splice(i, 1);
        continue;
      }

      // Collision detection
      if (this.invincibleTimer <= 0) {
        const obsBounds = {
          left: obs.x - obs.width / 2,
          right: obs.x + obs.width / 2,
          top: obs.y - obs.height / 2,
          bottom: obs.y + obs.height / 2,
        };

        if (this.rectsOverlap(carBounds, obsBounds)) {
          if (obs.type === 'pothole') {
            this.hitPothole();
          } else {
            if (obs.type === 'pedestrian') {
              this.showPedestrianSpeech(obs);
            }
            this.hitObstacle(obs);
          }
          obs.container.destroy();
          this.obstacles.splice(i, 1);
          continue;
        }

        // Near miss detection (obstacle passed car vertically and was close horizontally)
        if (obs.y > carBounds.bottom && obs.y < carBounds.bottom + 10) {
          const hDist = Math.abs(obs.x - this.carX);
          if (hDist < obs.width / 2 + CAR_WIDTH / 2 + NEAR_MISS_THRESHOLD && hDist > obs.width / 2 + CAR_WIDTH / 2) {
            this.onNearMiss();
            if (obs.type === 'pedestrian' && !obs.speechShown) {
              obs.speechShown = true;
              this.showPedestrianSpeech(obs);
            }
          }
        }
      }
    }
  }

  showPedestrianSpeech(obs) {
    const bubble = this.add.container(obs.x, obs.y - 30).setDepth(25);
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 0.9);
    bg.fillRoundedRect(-60, -14, 120, 24, 6);
    bg.fillTriangle(0, 10, -5, 16, 5, 10);
    const txt = this.add.text(0, -2, "Hey, I'm walkin' here!", {
      fontSize: '8px', fontFamily: 'Courier New', color: '#1a1a2e', fontStyle: 'bold',
    }).setOrigin(0.5);
    bubble.add([bg, txt]);

    this.tweens.add({
      targets: bubble,
      alpha: 0,
      y: bubble.y - 20,
      duration: 1500,
      delay: 800,
      onComplete: () => bubble.destroy(),
    });
  }

  rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  hitObstacle() {
    this.lives--;
    this.livesText.setText(this.getLivesString());
    this.invincibleTimer = INVINCIBLE_DURATION;

    // Camera shake
    this.cameras.main.shake(300, 0.02);

    // Flash red
    this.cameras.main.flash(200, 255, 0, 0);

    if (this.lives <= 0) {
      this.loseGame('CRASHED!\nJerry totaled the car!');
    }
  }

  hitPothole() {
    // Slow down temporarily and shake
    this.cameras.main.shake(200, 0.01);
    const prevSpeed = this.roadSpeed;
    this.roadSpeed = Math.max(1, this.roadSpeed - 2);
    this.time.delayedCall(500, () => {
      this.roadSpeed = prevSpeed;
    });
  }

  onNearMiss() {
    this.score += 50;
    this.nearMissScore++;
    this.scoreText.setText('Score: ' + this.score);

    this.nearMissText.setText('NEAR MISS! +50');
    this.nearMissText.setAlpha(1).setScale(0.5);
    this.tweens.killTweensOf(this.nearMissText);
    this.tweens.add({
      targets: this.nearMissText,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.nearMissText,
          alpha: 0,
          duration: 600,
          delay: 300,
        });
      },
    });
  }

  // ===================== WIN / LOSE =====================

  winGame() {
    this.gameWon = true;
    const { width, height } = this.scale;

    // "MARATHON START" banner scrolling down
    const banner = this.add.container(width / 2, -60).setDepth(40);
    const bannerBg = this.add.rectangle(0, 0, ROAD_WIDTH + 40, 50, 0xe94560);
    const bannerText = this.add.text(0, 0, 'MARATHON START', {
      fontSize: '28px', fontFamily: 'Courier New', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    banner.add([bannerBg, bannerText]);

    this.tweens.add({
      targets: banner,
      y: height / 2 - 60,
      duration: 1500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.showWinScreen(width, height);
      },
    });
  }

  showWinScreen(width, height) {
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setDepth(45);

    this.add.text(width / 2, height / 2 - 80, 'JEAN-PAUL MADE IT!', {
      fontSize: '32px', fontFamily: 'Courier New', color: '#44cc44', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(50);

    this.add.text(width / 2, height / 2 - 35, 'The marathon can begin!', {
      fontSize: '16px', fontFamily: 'Courier New', color: '#ffffff',
    }).setOrigin(0.5).setDepth(50);

    this.add.text(width / 2, height / 2 + 10, 'Score: ' + this.score, {
      fontSize: '24px', fontFamily: 'Courier New', color: '#ffffff',
    }).setOrigin(0.5).setDepth(50);

    this.add.text(width / 2, height / 2 + 40, 'Near Misses: ' + this.nearMissScore, {
      fontSize: '14px', fontFamily: 'Courier New', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(50);

    this.add.text(width / 2, height / 2 + 60, 'Time: ' + this.formatTime(this.gameTime), {
      fontSize: '14px', fontFamily: 'Courier New', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(50);

    this.addEndButtons(width, height);
  }

  loseGame(message) {
    this.gameOver = true;
    const { width, height } = this.scale;

    this.cameras.main.shake(500, 0.03);

    this.time.delayedCall(600, () => {
      const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
        .setDepth(45);

      this.add.text(width / 2, height / 2 - 60, 'GAME OVER', {
        fontSize: '42px', fontFamily: 'Courier New', color: '#e94560', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(50);

      this.add.text(width / 2, height / 2, message, {
        fontSize: '16px', fontFamily: 'Courier New', color: '#ffffff', align: 'center',
      }).setOrigin(0.5).setDepth(50);

      this.add.text(width / 2, height / 2 + 40, 'Score: ' + this.score, {
        fontSize: '20px', fontFamily: 'Courier New', color: '#ffffff',
      }).setOrigin(0.5).setDepth(50);

      this.addEndButtons(width, height);
    });
  }

  addEndButtons(width, height) {
    const restartBtn = this.add.text(width / 2, height / 2 + 90, '[ Play Again ]', {
      fontSize: '20px', fontFamily: 'Courier New', color: '#ffcc00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerover', () => restartBtn.setColor('#ffffff'));
    restartBtn.on('pointerout', () => restartBtn.setColor('#ffcc00'));
    restartBtn.on('pointerdown', () => this.scene.restart({ skipCutscene: true }));

    const menuBtn = this.add.text(width / 2, height / 2 + 125, '\u2190 Back to Menu', {
      fontSize: '16px', fontFamily: 'Courier New', color: '#ffffff',
    }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#ffdd44'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#ffffff'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  // ===================== HELPERS =====================

  getLaneX(lane) {
    return ROAD_LEFT + LANE_WIDTH * lane + LANE_WIDTH / 2;
  }

  getLivesString() {
    const hearts = [];
    for (let i = 0; i < 3; i++) {
      hearts.push(i < this.lives ? '\u2665' : '\u2661');
    }
    return hearts.join(' ');
  }

  formatTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.floor(totalMinutes % 60);
    const secs = Math.floor((totalMinutes % 1) * 60);
    return hours + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  addBackButton() {
    const btn = this.add.text(20, 560, '\u2190 Back to Menu', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffffff',
    }).setInteractive({ useHandCursor: true }).setDepth(100);

    btn.on('pointerover', () => btn.setColor('#ffdd44'));
    btn.on('pointerout', () => btn.setColor('#ffffff'));
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  // ===================== CUTSCENE DRAWING =====================

  drawApartment(width, height) {
    const g = this.add.graphics();

    // Floor
    g.fillStyle(0x8B7355, 1);
    g.fillRect(0, 420, width, height - 420);

    // Wall
    g.fillStyle(0xd4c5a0, 1);
    g.fillRect(0, 0, width, 420);

    // Baseboard
    g.fillStyle(0x6B5B3A, 1);
    g.fillRect(0, 415, width, 8);

    // Door (left side)
    g.fillStyle(0x8B6914, 1);
    g.fillRect(50, 180, 70, 230);
    g.fillStyle(0xBB9944, 1);
    g.fillRect(55, 185, 60, 100);
    g.fillRect(55, 295, 60, 100);
    // Doorknob
    g.fillStyle(0xccaa44, 1);
    g.fillCircle(105, 300, 5);

    // Window (back wall)
    g.fillStyle(0x334466, 1);
    g.fillRect(350, 100, 120, 140);
    g.lineStyle(4, 0xcccccc, 1);
    g.strokeRect(350, 100, 120, 140);
    g.lineBetween(410, 100, 410, 240);
    g.lineBetween(350, 170, 470, 170);
    // NYC skyline through window
    g.fillStyle(0x222244, 1);
    g.fillRect(355, 180, 20, 55);
    g.fillRect(380, 160, 15, 75);
    g.fillRect(400, 190, 25, 45);
    g.fillRect(430, 170, 18, 65);
    g.fillRect(452, 185, 14, 50);

    // Couch
    g.fillStyle(0x6B4444, 1);
    g.fillRoundedRect(200, 340, 220, 70, 8);
    // Couch back
    g.fillStyle(0x5B3434, 1);
    g.fillRoundedRect(200, 310, 220, 40, { tl: 8, tr: 8, bl: 0, br: 0 });
    // Cushions
    g.lineStyle(1, 0x4B2424, 0.5);
    g.lineBetween(275, 345, 275, 400);
    g.lineBetween(345, 345, 345, 400);
    // Armrests
    g.fillStyle(0x5B3434, 1);
    g.fillRoundedRect(192, 330, 16, 80, 4);
    g.fillRoundedRect(412, 330, 16, 80, 4);

    // Clock on wall
    g.fillStyle(0xdddddd, 1);
    g.fillCircle(600, 150, 30);
    g.lineStyle(2, 0x333333, 1);
    g.strokeCircle(600, 150, 30);
    // Clock hands showing 8:47
    g.lineStyle(2, 0x333333, 1);
    // Hour hand (between 8 and 9)
    const hourAngle = ((8 + 47 / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    g.lineBetween(600, 150, 600 + Math.cos(hourAngle) * 16, 150 + Math.sin(hourAngle) * 16);
    // Minute hand (at 47 minutes)
    const minAngle = (47 / 60) * Math.PI * 2 - Math.PI / 2;
    g.lineStyle(1.5, 0x333333, 1);
    g.lineBetween(600, 150, 600 + Math.cos(minAngle) * 24, 150 + Math.sin(minAngle) * 24);
    // Clock label
    const clockLabel = this.add.text(600, 195, '8:47', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#333333', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cutsceneContainer.add(clockLabel);

    // Small table with items
    g.fillStyle(0x6B5B3A, 1);
    g.fillRect(500, 380, 60, 40);
    // Coffee mug
    g.fillStyle(0xffffff, 1);
    g.fillRect(515, 370, 12, 14);
    g.lineStyle(2, 0xcccccc, 1);
    g.beginPath();
    g.arc(530, 377, 5, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(90));
    g.strokePath();

    this.cutsceneContainer.add(g);
  }

  drawSleepingJeanPaul(container) {
    const g = this.add.graphics();

    // Body lying on couch
    g.fillStyle(0x2244aa, 1);
    g.fillRoundedRect(-40, -10, 80, 25, 4);

    // Head (on left, lying down)
    g.fillStyle(0x8B6914, 1);
    g.fillEllipse(-50, -5, 22, 20);

    // Headband
    g.lineStyle(3, 0xe94560, 1);
    g.beginPath();
    g.arc(-50, -8, 10, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360));
    g.strokePath();

    // Closed eyes
    g.lineStyle(2, 0x332211, 1);
    g.lineBetween(-55, -5, -50, -5);
    g.lineBetween(-47, -5, -42, -5);

    // Blanket
    g.fillStyle(0x334488, 0.6);
    g.fillRoundedRect(-35, -5, 70, 20, 4);

    // Feet sticking out
    g.fillStyle(0x8B6914, 1);
    g.fillEllipse(42, 5, 10, 8);

    container.add(g);
  }

  drawSittingJeanPaul(container) {
    const g = this.add.graphics();

    // Sitting torso
    g.fillStyle(0x2244aa, 1);
    g.fillRoundedRect(-15, -30, 30, 35, 4);

    // Head
    g.fillStyle(0x8B6914, 1);
    g.fillEllipse(0, -48, 22, 22);

    // Headband
    g.lineStyle(3, 0xe94560, 1);
    g.beginPath();
    g.arc(0, -52, 10, Phaser.Math.DegToRad(160), Phaser.Math.DegToRad(380));
    g.strokePath();

    // Eyes (wide open, surprised)
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-5, -48, 8, 7);
    g.fillEllipse(5, -48, 8, 7);
    g.fillStyle(0x332211, 1);
    g.fillCircle(-5, -48, 2.5);
    g.fillCircle(5, -48, 2.5);

    // Eyebrows raised
    g.lineStyle(2, 0x332211, 1);
    g.lineBetween(-9, -56, -3, -57);
    g.lineBetween(3, -57, 9, -56);

    // Open mouth (shocked)
    g.fillStyle(0x332211, 1);
    g.fillEllipse(0, -40, 8, 6);

    // Arms out in shock
    g.fillStyle(0x8B6914, 1);
    g.beginPath();
    g.moveTo(-15, -25);
    g.lineTo(-30, -35);
    g.lineTo(-28, -39);
    g.lineTo(-13, -29);
    g.closePath();
    g.fillPath();
    g.fillCircle(-30, -37, 4);

    g.beginPath();
    g.moveTo(15, -25);
    g.lineTo(30, -35);
    g.lineTo(28, -39);
    g.lineTo(13, -29);
    g.closePath();
    g.fillPath();
    g.fillCircle(30, -37, 4);

    // Legs
    g.fillStyle(0x2244aa, 1);
    g.fillRect(-12, 2, 10, 15);
    g.fillRect(2, 2, 10, 15);

    container.add(g);
  }

  drawJerryCutscene(container) {
    const g = this.add.graphics();

    // Legs
    g.fillStyle(0x3a3a6e, 1);
    g.fillRect(-8, 10, 7, 20);
    g.fillRect(1, 10, 7, 20);

    // Shoes
    g.fillStyle(0x222222, 1);
    g.fillRoundedRect(-10, 28, 12, 7, 2);
    g.fillRoundedRect(0, 28, 12, 7, 2);

    // Torso (puffy shirt... just kidding, regular shirt)
    g.fillStyle(0xeeeeee, 1);
    g.fillRoundedRect(-12, -18, 24, 30, 4);

    // Arms (running pose)
    g.fillStyle(0xf2c89d, 1);
    g.beginPath();
    g.moveTo(-12, -14);
    g.lineTo(-22, -24);
    g.lineTo(-18, -26);
    g.lineTo(-10, -18);
    g.closePath();
    g.fillPath();
    g.fillCircle(-20, -26, 4);

    g.beginPath();
    g.moveTo(12, -14);
    g.lineTo(20, 0);
    g.lineTo(16, 2);
    g.lineTo(10, -12);
    g.closePath();
    g.fillPath();
    g.fillCircle(18, 2, 4);

    // Neck
    g.fillStyle(0xf2c89d, 1);
    g.fillRect(-3, -24, 6, 7);

    // Head
    g.fillStyle(0xf2c89d, 1);
    g.fillEllipse(0, -36, 22, 22);

    // Hair (dark, short)
    g.fillStyle(0x2a2a2e, 1);
    g.fillEllipse(0, -48, 22, 10);
    g.fillRect(-10, -48, 20, 6);

    // Eyes (panicked)
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-5, -36, 7, 6);
    g.fillEllipse(5, -36, 7, 6);
    g.fillStyle(0x332211, 1);
    g.fillCircle(-5, -36, 2);
    g.fillCircle(5, -36, 2);

    // Eyebrows (worried)
    g.lineStyle(2, 0x2a2a2e, 1);
    g.lineBetween(-9, -43, -3, -42);
    g.lineBetween(3, -42, 9, -43);

    // Mouth (open, yelling)
    g.fillStyle(0x332211, 1);
    g.fillEllipse(0, -28, 8, 5);

    // Label
    const label = this.add.text(0, 42, 'JERRY', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(label);

    container.add(g);
  }
}
