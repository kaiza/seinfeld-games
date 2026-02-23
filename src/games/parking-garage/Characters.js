/**
 * Character definitions and behavior for the Parking Garage game.
 *
 * Each character has unique mechanics:
 * - George: must carry AC unit, 50% speed while carrying
 * - Elaine: bladder meter, must find bathrooms
 * - Kramer: fast but erratic, must collect keys first
 * - Jerry: normal, cosmetic complaints when idle
 */

export const CHARACTER_DEFS = [
  {
    id: 'george',
    name: 'George',
    color: 0xd4a574,
    shirtColor: 0x2266aa,
    speed: 1.0,
    key: '1',
    portrait: 'G',
  },
  {
    id: 'elaine',
    name: 'Elaine',
    color: 0xe0b8a0,
    shirtColor: 0xcc3366,
    speed: 1.0,
    key: '2',
    portrait: 'E',
  },
  {
    id: 'kramer',
    name: 'Kramer',
    color: 0xc9a89a,
    shirtColor: 0x884422,
    speed: 1.5,
    key: '3',
    portrait: 'K',
  },
  {
    id: 'jerry',
    name: 'Jerry',
    color: 0xdbb99a,
    shirtColor: 0xeeeeee,
    speed: 1.0,
    key: '4',
    portrait: 'J',
  },
];

const JERRY_COMPLAINTS = [
  "What's the deal with parking garages?",
  "We're like rats in a maze...",
  "I could be home watching TV.",
  "This is a nightmare.",
  "Who designed this place?!",
  "Are we on 3 or 4?",
  "I knew we should've taken a cab.",
  "Every floor looks the same!",
];

export class Character {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} def - from CHARACTER_DEFS
   * @param {number} startR - grid row
   * @param {number} startC - grid col
   * @param {number} startFloor
   * @param {number} tileSize
   */
  constructor(scene, def, startR, startC, startFloor, tileSize) {
    this.scene = scene;
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.gridR = startR;
    this.gridC = startC;
    this.floor = startFloor;
    this.tileSize = tileSize;
    this.baseSpeed = def.speed;
    this.currentSpeed = def.speed;
    this.isActive = false;
    this.reachedCar = false;
    this.isMoving = false;
    this.isFrozen = false;
    this.frozenTimer = 0;
    this.caughtPenalty = false;

    // George-specific
    this.hasAC = false;

    // Elaine-specific
    this.bladder = 0; // 0-100
    this.bladderMaxOuts = 0;
    this.BLADDER_RATE = 0.15; // per frame (~60fps)
    this.BLADDER_FREEZE_TIME = 5000; // 5s

    // Kramer-specific
    this.hasKeys = false;
    this.erraticTimer = 0;
    this.erraticDir = null;
    this.ERRATIC_INTERVAL = 2000; // ms

    // Jerry-specific
    this.idleTime = 0;
    this.COMPLAINT_INTERVAL = 8000;
    this.complaintText = null;

    this.sprite = this.createSprite();
    this.updatePosition();
  }

  createSprite() {
    const x = this.gridC * this.tileSize + this.tileSize / 2;
    const y = this.gridR * this.tileSize + this.tileSize / 2;

    const container = this.scene.add.container(x, y).setDepth(60);

    // Body
    const body = this.scene.add.rectangle(0, 4, 10, 10, this.def.shirtColor);
    // Head
    const head = this.scene.add.circle(0, -4, 6, this.def.color);

    container.add([body, head]);

    // George gets glasses
    if (this.id === 'george') {
      const g1 = this.scene.add.circle(-3, -5, 3, 0x333333, 0).setStrokeStyle(1, 0x333333);
      const g2 = this.scene.add.circle(3, -5, 3, 0x333333, 0).setStrokeStyle(1, 0x333333);
      container.add([g1, g2]);
    }

    // Kramer gets tall hair
    if (this.id === 'kramer') {
      const hair = this.scene.add.ellipse(0, -12, 10, 8, 0x332211);
      container.add(hair);
    }

    // Elaine gets curly hair
    if (this.id === 'elaine') {
      const hair = this.scene.add.ellipse(0, -10, 14, 6, 0x331111);
      container.add(hair);
    }

    // Name tag
    const tag = this.scene.add.text(0, 14, this.def.portrait, {
      fontSize: '8px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(tag);

    // Active indicator ring (hidden by default)
    this.activeRing = this.scene.add.circle(0, 0, 10, 0x00ff00, 0).setStrokeStyle(2, 0x00ff00);
    this.activeRing.setVisible(false);
    container.add(this.activeRing);

    return container;
  }

  updatePosition() {
    const x = this.gridC * this.tileSize + this.tileSize / 2;
    const y = this.gridR * this.tileSize + this.tileSize / 2;
    this.sprite.setPosition(x, y);
  }

  setActive(active) {
    this.isActive = active;
    this.activeRing.setVisible(active);
    if (active) this.idleTime = 0;
  }

  setVisible(visible) {
    this.sprite.setVisible(visible);
  }

  /**
   * Try to move in a direction. Returns true if moved.
   */
  tryMove(dr, dc, canMoveTo) {
    if (this.isFrozen || this.isMoving || this.reachedCar) return false;

    // Kramer erratic override — if he has a forced direction, use it
    if (this.id === 'kramer' && this.erraticDir && !this.hasKeys) {
      dr = this.erraticDir.dr;
      dc = this.erraticDir.dc;
    }

    const newR = this.gridR + dr;
    const newC = this.gridC + dc;

    if (!canMoveTo(newR, newC, this.floor)) return false;

    this.isMoving = true;
    this.gridR = newR;
    this.gridC = newC;

    const targetX = newC * this.tileSize + this.tileSize / 2;
    const targetY = newR * this.tileSize + this.tileSize / 2;

    const moveTime = 100 / this.currentSpeed;

    this.scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      y: targetY,
      duration: moveTime,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false;
      },
    });

    this.idleTime = 0;
    return true;
  }

  /**
   * Called every frame with delta time.
   */
  updateMechanics(delta) {
    if (this.reachedCar) return;

    // Handle frozen state
    if (this.isFrozen) {
      this.frozenTimer -= delta;
      if (this.frozenTimer <= 0) {
        this.isFrozen = false;
        this.sprite.setAlpha(1);
      }
      return;
    }

    // George: speed penalty when carrying AC
    if (this.id === 'george') {
      this.currentSpeed = this.hasAC ? this.baseSpeed * 0.5 : this.baseSpeed;
    }

    // Elaine: bladder mechanic
    if (this.id === 'elaine') {
      this.bladder = Math.min(100, this.bladder + this.BLADDER_RATE * (delta / 16.67));
      if (this.bladder >= 100) {
        this.bladderMaxOuts++;
        this.bladder = 0;
        this.freeze(this.BLADDER_FREEZE_TIME);

        // Show "oops" text
        this.showFloatingText("Can't hold it! 😫", '#ff66aa');
      }
    }

    // Kramer: erratic movement timer (only when no keys)
    if (this.id === 'kramer' && !this.hasKeys) {
      this.erraticTimer += delta;
      if (this.erraticTimer >= this.ERRATIC_INTERVAL) {
        this.erraticTimer = 0;
        const dirs = [
          { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
          { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
        ];
        this.erraticDir = dirs[Math.floor(Math.random() * dirs.length)];

        // Clear erratic after 500ms
        this.scene.time.delayedCall(500, () => {
          this.erraticDir = null;
        });
      }
    }

    // Jerry: idle complaints
    if (this.id === 'jerry' && this.isActive) {
      this.idleTime += delta;
      if (this.idleTime >= this.COMPLAINT_INTERVAL) {
        this.idleTime = 0;
        const complaint = JERRY_COMPLAINTS[Math.floor(Math.random() * JERRY_COMPLAINTS.length)];
        this.showFloatingText(complaint, '#ffffff');
      }
    }
  }

  freeze(duration) {
    this.isFrozen = true;
    this.frozenTimer = duration;
    this.sprite.setAlpha(0.5);
  }

  useBathroom() {
    if (this.id === 'elaine') {
      this.bladder = 0;
      this.showFloatingText('Relief! 😌', '#66ff66');
    }
  }

  pickupAC() {
    if (this.id === 'george') {
      this.hasAC = true;
      this.showFloatingText('Got the AC unit! 📦', '#ffcc00');
    }
  }

  pickupKeys() {
    if (this.id === 'kramer') {
      this.hasKeys = true;
      this.erraticDir = null;
      this.showFloatingText('Found the keys! 🔑', '#ffcc00');
    }
  }

  dropAC() {
    if (this.id === 'george') {
      this.hasAC = false;
      this.showFloatingText('Dropped the AC! 😱', '#ff4444');
    }
  }

  showFloatingText(text, color) {
    if (this.complaintText) this.complaintText.destroy();

    this.complaintText = this.scene.add.text(this.sprite.x, this.sprite.y - 20, text, {
      fontSize: '9px',
      fontFamily: 'Courier New',
      color: color,
      fontStyle: 'bold',
      backgroundColor: '#000000aa',
      padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(100);

    this.scene.tweens.add({
      targets: this.complaintText,
      y: this.sprite.y - 40,
      alpha: 0,
      duration: 2000,
      onComplete: () => {
        if (this.complaintText) {
          this.complaintText.destroy();
          this.complaintText = null;
        }
      },
    });
  }
}
