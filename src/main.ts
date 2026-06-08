import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 540,
  height: 960,
  backgroundColor: '#21354b',
  scene: [BootScene, MenuScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 980 },
      debug: false,
    },
  },
  input: {
    activePointers: 3,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
