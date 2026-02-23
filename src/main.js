import Phaser from 'phaser';
import MainMenu from './scenes/MainMenu.js';
import NoSoupForYou from './games/NoSoupForYou.js';
import FestivusFeats from './games/FestivusFeats.js';
import YadaYada from './games/YadaYada.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  parent: document.body,
  scene: [MainMenu, NoSoupForYou, FestivusFeats, YadaYada],
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
};

new Phaser.Game(config);
