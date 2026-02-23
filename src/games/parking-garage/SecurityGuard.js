import { CELL } from './MazeGenerator.js';

/**
 * Security guard that patrols the garage.
 * Has a patrol route, cone of vision, and catches characters.
 */

const GUARD_SPEED = 3; // tiles per second
const VISION_RANGE = 4; // tiles ahead
const VISION_CONE_HALF = 1; // tiles to each side at max range

export class SecurityGuard {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} floor
   * @param {number} startR
   * @param {number} startC
   * @param {number} tileSize
   * @param {number[][]} mazeGrid
   */
  constructor(scene, floor, startR, startC, tileSize, mazeGrid) {
    this.scene = scene;
    this.floor = floor;
    this.gridR = startR;
    this.gridC = startC;
    this.tileSize = tileSize;
    this.maze = mazeGrid;
    this.isMoving = false;
    this.moveTimer = 0;
    this.MOVE_INTERVAL = 1000 / GUARD_SPEED;

    // Patrol direction
    this.dir = { dr: 0, dc: 1 }; // start moving right
    this.facingName = 'right';

    // Build patrol path via random walk
    this.sprite = this.createSprite();
    this.visionCone = this.createVisionCone();
    this.updatePosition();
  }

  createSprite() {
    const x = this.gridC * this.tileSize + this.tileSize / 2;
    const y = this.gridR * this.tileSize + this.tileSize / 2;

    const container = this.scene.add.container(x, y).setDepth(55);

    // Guard body (dark uniform)
    const body = this.scene.add.rectangle(0, 3, 12, 12, 0x222266);
    // Head
    const head = this.scene.add.circle(0, -5, 6, 0xddb88a);
    // Cap
    const cap = this.scene.add.rectangle(0, -10, 12, 4, 0x111144);
    // Badge
    const badge = this.scene.add.circle(3, 1, 2, 0xffcc00);
    // Label
    const label = this.scene.add.text(0, 14, '👮', {
      fontSize: '8px',
    }).setOrigin(0.5);

    container.add([body, head, cap, badge, label]);
    return container;
  }

  createVisionCone() {
    // Simple triangle as vision indicator
    const cone = this.scene.add.graphics().setDepth(45);
    this.drawCone(cone);
    return cone;
  }

  drawCone(graphics) {
    graphics.clear();
    graphics.fillStyle(0xff0000, 0.08);
    graphics.lineStyle(1, 0xff0000, 0.15);

    const x = this.gridC * this.tileSize + this.tileSize / 2;
    const y = this.gridR * this.tileSize + this.tileSize / 2;
    const range = VISION_RANGE * this.tileSize;
    const spread = VISION_CONE_HALF * this.tileSize;

    const { dr, dc } = this.dir;

    if (dc === 1) { // right
      graphics.fillTriangle(x, y, x + range, y - spread, x + range, y + spread);
    } else if (dc === -1) { // left
      graphics.fillTriangle(x, y, x - range, y - spread, x - range, y + spread);
    } else if (dr === 1) { // down
      graphics.fillTriangle(x, y, x - spread, y + range, x + spread, y + range);
    } else if (dr === -1) { // up
      graphics.fillTriangle(x, y, x - spread, y - range, x + spread, y - range);
    }
  }

  updatePosition() {
    const x = this.gridC * this.tileSize + this.tileSize / 2;
    const y = this.gridR * this.tileSize + this.tileSize / 2;
    this.sprite.setPosition(x, y);
    this.drawCone(this.visionCone);
  }

  setVisible(visible) {
    this.sprite.setVisible(visible);
    this.visionCone.setVisible(visible);
  }

  /**
   * Update patrol movement.
   */
  update(delta) {
    if (this.isMoving) return;

    this.moveTimer += delta;
    if (this.moveTimer < this.MOVE_INTERVAL) return;
    this.moveTimer = 0;

    // Try to continue in current direction, or pick a new one
    const newR = this.gridR + this.dir.dr;
    const newC = this.gridC + this.dir.dc;

    if (this.canWalk(newR, newC)) {
      this.moveTo(newR, newC);
    } else {
      // Pick a new direction
      this.pickNewDirection();
    }
  }

  canWalk(r, c) {
    if (r < 0 || r >= this.maze.length || c < 0 || c >= this.maze[0].length) return false;
    const cell = this.maze[r][c];
    return cell !== CELL.WALL;
  }

  pickNewDirection() {
    const dirs = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
      { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
    ];

    // Shuffle and try each
    const shuffled = dirs.sort(() => Math.random() - 0.5);
    for (const d of shuffled) {
      const newR = this.gridR + d.dr;
      const newC = this.gridC + d.dc;
      if (this.canWalk(newR, newC)) {
        this.dir = d;
        this.moveTo(newR, newC);
        return;
      }
    }
  }

  moveTo(r, c) {
    this.isMoving = true;
    this.gridR = r;
    this.gridC = c;

    const targetX = c * this.tileSize + this.tileSize / 2;
    const targetY = r * this.tileSize + this.tileSize / 2;

    this.scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      y: targetY,
      duration: this.MOVE_INTERVAL * 0.8,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false;
        this.drawCone(this.visionCone);
      },
    });
  }

  /**
   * Check if a character at (charR, charC) is within the guard's vision cone.
   */
  canSee(charR, charC) {
    const { dr, dc } = this.dir;

    for (let dist = 1; dist <= VISION_RANGE; dist++) {
      const lookR = this.gridR + dr * dist;
      const lookC = this.gridC + dc * dist;

      // Check wall blocking line of sight
      if (!this.canWalk(lookR, lookC)) break;

      // Check the cone width at this distance
      const spread = Math.ceil((dist / VISION_RANGE) * VISION_CONE_HALF);

      for (let s = -spread; s <= spread; s++) {
        const checkR = lookR + (dc !== 0 ? s : 0);
        const checkC = lookC + (dr !== 0 ? s : 0);

        if (checkR === charR && checkC === charC) {
          return true;
        }
      }
    }

    // Also check adjacent (guard catches if right next to you)
    if (Math.abs(this.gridR - charR) + Math.abs(this.gridC - charC) <= 1) {
      return true;
    }

    return false;
  }
}
