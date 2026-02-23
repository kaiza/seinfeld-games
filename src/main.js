import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { ContestScene } from './games/the-contest/ContestScene.js';
import { MarbleRyeScene } from './games/marble-rye/MarbleRyeScene.js';
import { SoupNaziScene } from './games/soup-nazi/SoupNaziScene.js';
import { ParkingGarageScene } from './games/parking-garage/ParkingGarageScene.js';
import { LaserPointerScene } from './games/laser-pointer/LaserPointerScene.js';
import { FroggerScene } from './games/frogger/FroggerScene.js';
import { HoleInOneScene } from './games/hole-in-one/HoleInOneScene.js';

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
    LaserPointerScene,
    FroggerScene,
    HoleInOneScene,
  ],
};

const game = new Phaser.Game(config);

export default game;
