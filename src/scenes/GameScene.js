import Phaser from 'phaser'

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game')
  }

  create() {
    this.score = 0
    this.createBackdrop()
    this.createPlatforms()
    this.createPlayer()
    this.createCollectible()
    this.createHud()
    this.createControls()

    this.physics.add.collider(this.player, this.platforms)
    this.physics.add.overlap(this.player, this.star, this.collectStar, null, this)
  }

  update() {
    const speed = 240
    const movingLeft = this.controls.left.isDown || this.controls.altLeft.isDown
    const movingRight = this.controls.right.isDown || this.controls.altRight.isDown

    if (movingLeft) {
      this.player.setVelocityX(-speed)
    } else if (movingRight) {
      this.player.setVelocityX(speed)
    } else {
      this.player.setVelocityX(0)
    }

    if ((this.controls.up.isDown || this.controls.jump.isDown) && this.player.body.blocked.down) {
      this.player.setVelocityY(-500)
    }
  }

  createBackdrop() {
    this.add.rectangle(480, 270, 960, 540, 0x102033)
    this.add.circle(810, 120, 88, 0xf1faee, 0.18)
    this.add.circle(730, 150, 54, 0xf4a261, 0.2)
    this.add.rectangle(480, 495, 960, 90, 0x0b1623)

    const title = this.add.text(32, 28, 'First playable scene', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#f1faee',
    })

    title.setShadow(0, 2, '#000000', 6)
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup()

    const platformData = [
      { x: 480, y: 520, scale: 4 },
      { x: 730, y: 410, scale: 1.2 },
      { x: 420, y: 320, scale: 1.1 },
      { x: 170, y: 245, scale: 1.1 },
    ]

    platformData.forEach(({ x, y, scale }) => {
      const platform = this.platforms.create(x, y, 'platform')
      platform.setScale(scale, 1)
      platform.refreshBody()
    })
  }

  createPlayer() {
    this.player = this.physics.add.sprite(120, 420, 'player')
    this.player.setCollideWorldBounds(true)
    this.player.setBounce(0.05)
  }

  createCollectible() {
    this.star = this.physics.add.sprite(760, 360, 'star')
    this.star.body.allowGravity = false
    this.starTween = this.tweens.add({
      targets: this.star,
      y: this.star.y - 14,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    })
  }

  createHud() {
    this.add.image(170, 78, 'panel').setAlpha(0.95)

    this.scoreText = this.add.text(56, 63, 'Score: 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#f1faee',
    })

    this.helpText = this.add.text(32, 470, 'Collect the star, then keep expanding the scene.', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#d7e3f4',
      wordWrap: { width: 360 },
    })
  }

  createControls() {
    this.controls = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      altLeft: Phaser.Input.Keyboard.KeyCodes.A,
      altRight: Phaser.Input.Keyboard.KeyCodes.D,
    })
  }

  collectStar(player, star) {
    star.disableBody(true, true)
    this.starTween.stop()
    this.score += 10
    this.scoreText.setText(`Score: ${this.score}`)
    this.helpText.setText('The starter is working. Next step is adding your real game rules.')

    this.time.delayedCall(1200, () => {
      star.enableBody(true, Phaser.Math.Between(120, 820), Phaser.Math.Between(140, 360), true, true)
      star.body.allowGravity = false

      this.starTween = this.tweens.add({
        targets: star,
        y: star.y - 14,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      })
    })
  }
}
