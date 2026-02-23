import Phaser from 'phaser';
import { ensureThemePlaying } from './BootScene.js';

const WHEEL_SCROLL_SPEED = 0.5;
const DRAG_THRESHOLD = 8;

const GAMES = [
  { key: 'LaserPointerScene', title: 'The Laser Pointer', description: 'Zap George in the movie theater!' },
  { key: 'FroggerScene', title: 'The Frogger', description: 'Push the arcade machine across the street!' },
  { key: 'HoleInOneScene', title: 'Hole in One', description: 'Hit the whale with a golf ball as Kramer' },
  { key: 'RyeMatch3Scene', title: 'Jerry vs. The Rye', description: 'Match-3 your way to placing the marble rye!' },
  { key: 'ParkingGarageScene', title: 'Parking Garage', description: 'Find your car before time runs out' },
  { key: 'SoupNaziScene', title: 'The Soup Nazi', description: 'Serve the right soup before customers lose patience!' },
  { key: 'OilBladderScene', title: "Kramer's Oil Bladder", description: 'Drop the bladder from the roof and hit the girlfriend below!' },
];

// Seinfeld-style letter offsets for the wavy baseline effect
const LOGO_LETTERS = [
  { ch: 'S', dx: 0, dy: 4, rot: -0.08, scale: 1.05 },
  { ch: 'E', dx: 0, dy: -2, rot: 0.04, scale: 1.0 },
  { ch: 'I', dx: 0, dy: 2, rot: -0.06, scale: 0.95 },
  { ch: 'N', dx: 0, dy: -3, rot: 0.03, scale: 1.02 },
  { ch: 'F', dx: 0, dy: 5, rot: -0.05, scale: 1.0 },
  { ch: 'E', dx: 0, dy: -1, rot: 0.06, scale: 0.98 },
  { ch: 'L', dx: 0, dy: 3, rot: -0.04, scale: 1.0 },
  { ch: 'D', dx: 0, dy: -4, rot: 0.05, scale: 1.04 },
];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    ensureThemePlaying(this);
    const { width, height } = this.scale;

    // ---------- Background ----------
    // Subtle NYC skyline silhouette at the bottom
    this.drawSkyline(width, height);

    // ---------- Seinfeld Logo ----------
    this.drawLogo(width);

    // "GAMES" subtitle
    this.add.text(width / 2, 95, '✦  G A M E S  ✦', {
      fontSize: '18px',
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 6,
    }).setOrigin(0.5);

    // Tagline
    this.add.text(width / 2, 122, 'A game about nothing... and everything', {
      fontSize: '13px',
      fontFamily: 'Georgia, serif',
      color: '#777777',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Divider line
    const g = this.add.graphics();
    g.lineStyle(1, 0x333355);
    g.lineBetween(width / 2 - 250, 142, width / 2 + 250, 142);

    // ---------- Scrollable Game Buttons ----------
    const listTop = 153;
    const listBottom = height - 22;
    const listVisibleHeight = listBottom - listTop;
    const buttonSpacing = 68;
    const totalContentHeight = GAMES.length * buttonSpacing;

    this.listTop = listTop;
    this.listBottom = listBottom;
    this.scrollY = 0;
    this.maxScroll = Math.max(0, totalContentHeight - listVisibleHeight);
    this.isDragging = false;

    // Container holds all game buttons; scrolling shifts its Y
    this.listContainer = this.add.container(0, 0);

    GAMES.forEach((game, index) => {
      const y = 185 + index * buttonSpacing;
      this.createGameButton(width, y, game);
    });

    // Mask clips the container to the visible list area
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillRect(0, listTop, width, listVisibleHeight);
    this.listContainer.setMask(maskShape.createGeometryMask());

    // Scroll hint (shown when list overflows)
    this.scrollHint = this.add.text(width / 2, listBottom - 8, '▼  scroll for more', {
      fontSize: '11px',
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#555577',
    }).setOrigin(0.5).setAlpha(0);

    if (this.maxScroll > 0) {
      this.tweens.add({
        targets: this.scrollHint,
        alpha: { from: 0.3, to: 0.8 },
        yoyo: true,
        repeat: -1,
        duration: 1200,
      });
    }

    // Mouse-wheel scrolling
    this.input.on('wheel', (ptr, objs, dx, dy) => {
      this._setScroll(this.scrollY + dy * WHEEL_SCROLL_SPEED);
    });

    // Touch / pointer drag scrolling
    let dragStartY = 0;
    let dragStartScroll = 0;
    let dragActive = false;

    this.input.on('pointerdown', (ptr) => {
      if (ptr.y >= this.listTop && ptr.y <= this.listBottom) {
        dragStartY = ptr.y;
        dragStartScroll = this.scrollY;
        this.isDragging = false;
        dragActive = true;
      } else {
        dragActive = false;
      }
    });

    this.input.on('pointermove', (ptr) => {
      if (!ptr.isDown || !dragActive) return;
      const delta = dragStartY - ptr.y;
      if (Math.abs(delta) > DRAG_THRESHOLD) {
        this.isDragging = true;
        this._setScroll(dragStartScroll + delta);
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
      dragActive = false;
    });

    // Footer
    this.add.text(width / 2, height - 14, 'No soup for you.', {
      fontSize: '10px',
      fontFamily: 'Georgia, serif',
      color: '#444444',
      fontStyle: 'italic',
    }).setOrigin(0.5);
  }

  _setScroll(newScrollY) {
    this.scrollY = Phaser.Math.Clamp(newScrollY, 0, this.maxScroll);
    this.listContainer.setY(-this.scrollY);
    if (this.scrollHint) {
      if (this.scrollY >= this.maxScroll) {
        this.tweens.killTweensOf(this.scrollHint);
        this.scrollHint.setAlpha(0);
      } else if (!this.tweens.isTweening(this.scrollHint) && this.maxScroll > 0) {
        this.tweens.add({
          targets: this.scrollHint,
          alpha: { from: 0.3, to: 0.8 },
          yoyo: true,
          repeat: -1,
          duration: 1200,
        });
      }
    }
  }

  drawLogo(width) {
    const centerX = width / 2;
    const baseY = 52;
    const letterSpacing = 42;
    const totalWidth = (LOGO_LETTERS.length - 1) * letterSpacing;
    const startX = centerX - totalWidth / 2;

    // Logo background swoosh
    const swoosh = this.add.graphics();
    swoosh.fillStyle(0xe94560, 0.12);
    swoosh.fillRoundedRect(centerX - totalWidth / 2 - 30, baseY - 35, totalWidth + 60, 60, 12);

    for (let i = 0; i < LOGO_LETTERS.length; i++) {
      const l = LOGO_LETTERS[i];
      const x = startX + i * letterSpacing + l.dx;
      const y = baseY + l.dy;

      // Shadow
      this.add.text(x + 2, y + 2, l.ch, {
        fontSize: '46px',
        fontFamily: 'Impact, Arial Black, sans-serif',
        color: '#331111',
        fontStyle: 'bold',
      }).setOrigin(0.5).setScale(l.scale).setRotation(l.rot);

      // Main letter — alternating red/yellow like the iconic logo
      const color = i % 2 === 0 ? '#e94560' : '#ffcc00';
      const letter = this.add.text(x, y, l.ch, {
        fontSize: '46px',
        fontFamily: 'Impact, Arial Black, sans-serif',
        color: color,
        fontStyle: 'bold',
      }).setOrigin(0.5).setScale(l.scale).setRotation(l.rot);

      // Gentle idle bob animation
      this.tweens.add({
        targets: letter,
        y: y + 3,
        duration: 1200 + i * 150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  drawSkyline(width, height) {
    const g = this.add.graphics();
    g.fillStyle(0x111118, 1);
    g.fillRect(0, 0, width, height);

    // Gradient overlay (dark blue to darker at bottom)
    const gradColors = [0x1a1a2e, 0x0f0f1a];
    for (let i = 0; i < height; i++) {
      const t = i / height;
      const r = Phaser.Math.Linear((gradColors[0] >> 16) & 0xff, (gradColors[1] >> 16) & 0xff, t);
      const gr = Phaser.Math.Linear((gradColors[0] >> 8) & 0xff, (gradColors[1] >> 8) & 0xff, t);
      const b = Phaser.Math.Linear(gradColors[0] & 0xff, gradColors[1] & 0xff, t);
      g.fillStyle(Phaser.Display.Color.GetColor(Math.floor(r), Math.floor(gr), Math.floor(b)), 1);
      g.fillRect(0, i, width, 1);
    }

    // Building silhouettes
    g.fillStyle(0x0a0a14, 1);
    const buildings = [
      { x: 20, w: 45, h: 80 },
      { x: 70, w: 35, h: 55 },
      { x: 110, w: 50, h: 95 },
      { x: 170, w: 30, h: 60 },
      { x: 210, w: 55, h: 110 },
      { x: 280, w: 40, h: 70 },
      { x: 330, w: 60, h: 85 },
      { x: 400, w: 35, h: 100 },
      { x: 445, w: 50, h: 65 },
      { x: 510, w: 45, h: 90 },
      { x: 565, w: 55, h: 75 },
      { x: 630, w: 40, h: 105 },
      { x: 680, w: 50, h: 60 },
      { x: 740, w: 45, h: 80 },
    ];

    buildings.forEach((b) => {
      g.fillRect(b.x, height - b.h, b.w, b.h);
      // Window lights
      g.fillStyle(0x222244, 0.6);
      for (let wy = height - b.h + 8; wy < height - 10; wy += 12) {
        for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 10) {
          if (Math.random() > 0.4) {
            const winColor = Math.random() > 0.7 ? 0xffcc44 : 0x334466;
            g.fillStyle(winColor, Math.random() * 0.3 + 0.1);
            g.fillRect(wx, wy, 5, 6);
          }
        }
      }
      g.fillStyle(0x0a0a14, 1);
    });
  }

  createGameButton(width, y, game) {
    const bg = this.add.rectangle(width / 2, y, 520, 58, 0x16213e, 0.85)
      .setStrokeStyle(1, 0x1a3a5c)
      .setInteractive({ useHandCursor: true });

    // Accent bar on the left
    const accent = this.add.rectangle(width / 2 - 258, y, 4, 50, 0xe94560);

    const title = this.add.text(width / 2, y - 10, game.title, {
      fontSize: '20px',
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#e94560',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const desc = this.add.text(width / 2, y + 14, game.description, {
      fontSize: '12px',
      fontFamily: 'Georgia, serif',
      color: '#777777',
    }).setOrigin(0.5);

    this.listContainer.add([bg, accent, title, desc]);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x1a3a5c, 0.95);
      bg.setStrokeStyle(2, 0xe94560);
      title.setColor('#ffffff');
      accent.setFillStyle(0xffcc00);
      desc.setColor('#aaaaaa');
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x16213e, 0.85);
      bg.setStrokeStyle(1, 0x1a3a5c);
      title.setColor('#e94560');
      accent.setFillStyle(0xe94560);
      desc.setColor('#777777');
    });

    bg.on('pointerup', (ptr) => {
      // Only navigate if it was a tap (not a scroll drag) and pointer is in the list area
      if (!this.isDragging && ptr.y >= this.listTop && ptr.y <= this.listBottom) {
        this.cameras.main.fadeOut(200, 0, 0, 0);
        this.time.delayedCall(200, () => {
          this.scene.start(game.key);
        });
      }
    });
  }
}
