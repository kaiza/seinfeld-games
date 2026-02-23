import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { ContestScene } from './games/the-contest/ContestScene.js';
import { MarbleRyeScene } from './games/marble-rye/MarbleRyeScene.js';
import { SoupNaziScene } from './games/soup-nazi/SoupNaziScene.js';
import { ParkingGarageScene } from './games/parking-garage/ParkingGarageScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    MenuScene,
    ContestScene,
    MarbleRyeScene,
    SoupNaziScene,
    ParkingGarageScene,
  ],
};

const game = new Phaser.Game(config);

export default game;
