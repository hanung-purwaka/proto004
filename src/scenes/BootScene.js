import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create() {
    this.createTexture('panel', 192, 48, 0x1d3557)
    this.createTexture('platform', 240, 28, 0x457b9d)
    this.createTexture('player', 36, 52, 0xf4a261)
    this.createTexture('star', 24, 24, 0xffd166)

    this.scene.start('game')
  }

  createTexture(key, width, height, color) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false })

    graphics.fillStyle(color, 1)
    graphics.fillRoundedRect(0, 0, width, height, 10)
    graphics.generateTexture(key, width, height)
    graphics.destroy()
  }
}
