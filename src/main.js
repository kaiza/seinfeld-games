import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { ParkingGarageScene } from './games/parking-garage/ParkingGarageScene.js';
import { LaserPointerScene } from './games/laser-pointer/LaserPointerScene.js';
import { FroggerScene } from './games/frogger/FroggerScene.js';
import { HoleInOneScene } from './games/hole-in-one/HoleInOneScene.js';
import { RyeMatch3Scene } from './games/rye-match3/RyeMatch3Scene.js';
import { SoupNaziScene } from './games/soup-nazi/SoupNaziScene.js';
import { OilBladderScene } from './games/oil-bladder/OilBladderScene.js';
import { SpareASquareScene } from './games/spare-a-square/SpareASquareScene.js';
import { FestivusScene } from './games/festivus/FestivusScene.js';
import { MailChaosScene } from './games/mail-chaos/MailChaosScene.js';
import { LittleKicksScene } from './games/little-kicks/LittleKicksScene.js';
import { JeanPaulScene } from './games/jean-paul/JeanPaulScene.js';
import { FireEscapeScene } from './games/fire-escape/FireEscapeScene.js';

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
    ParkingGarageScene,
    LaserPointerScene,
    FroggerScene,
    HoleInOneScene,
    RyeMatch3Scene,
    SoupNaziScene,
    OilBladderScene,
    SpareASquareScene,
    FestivusScene,
    MailChaosScene,
    LittleKicksScene,
    JeanPaulScene,
    FireEscapeScene,
  ],
};

const game = new Phaser.Game(config);

export default game;
