import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene.js'
import { GameScene } from '../scenes/GameScene.js'

export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#102033',
  width: 960,
  height: 540,
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false,
    },
  },
  scene: [BootScene, GameScene],
}
