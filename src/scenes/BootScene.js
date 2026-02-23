import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.audio('seinfeld-theme', 'assets/audio/seinfeld.mp3');
  }

  create() {
    this.game.themeMusic = this.sound.add('seinfeld-theme', {
      loop: true,
      volume: 0.5,
    });

    this.scene.start('MenuScene');
  }
}

/**
 * Call this from any scene's create() to ensure the theme is playing.
 * Handles browser autoplay restrictions by starting on first interaction.
 */
export function ensureThemePlaying(scene) {
  const theme = scene.game.themeMusic;
  if (!theme || theme.isPlaying) return;

  const tryPlay = () => {
    if (theme.isPlaying) return;
    if (scene.sound.locked) return;
    theme.play();
  };

  // If sound system is unlocked, play immediately
  if (!scene.sound.locked) {
    tryPlay();
    return;
  }

  // Otherwise wait for Phaser to unlock audio on user interaction
  scene.sound.once('unlocked', () => {
    tryPlay();
  });
}
