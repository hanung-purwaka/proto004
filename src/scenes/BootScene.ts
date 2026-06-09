import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    this.createSharedTextures();
    this.scene.start('menu');
  }

  private createSharedTextures(): void {
    this.createBallTexture('ball-generic');
    this.createCrateTextures();
    this.createPanelTexture('panel-wide', 500, 94, 0x193040, 0x0e1b25);
    this.createPanelTexture('panel-card', 420, 140, 0x173143, 0x0f1c27);
    this.createPanelTexture('panel-modal', 380, 270, 0x152d3b, 0x0d1720);
    this.createButtonTexture('button-primary', 180, 54, 0x4fd0ff, 0x2b7dd2);
    this.createButtonTexture('button-secondary', 180, 54, 0xf1b44f, 0xcc7f1d);
    this.createStarTexture('star-gold', 0xffd868);
    this.createStarTexture('star-dim', 0x3f5368);
    this.createSparkTexture('spark', 18);
    this.createQueuePillTexture('queue-pill', 52, 52);
  }

  private createBallTexture(key: string): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(26, 26, 24);
    graphics.fillStyle(0x000000, 0.1);
    graphics.fillCircle(28, 30, 18);
    graphics.fillStyle(0xffffff, 0.14);
    graphics.fillCircle(24, 22, 20);
    graphics.fillStyle(0xffffff, 0.74);
    graphics.fillCircle(18, 16, 7);
    graphics.fillStyle(0xffffff, 0.18);
    graphics.fillEllipse(31, 34, 12, 7);
    graphics.generateTexture(key, 52, 52);
    graphics.destroy();
  }

  private createCrateTextures(): void {
    if (this.textures.exists('crate-base')) {
      return;
    }

    const shadow = this.make.graphics({ x: 0, y: 0, add: false });
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(7, 10, 58, 58, 12);
    shadow.generateTexture('crate-shadow', 76, 76);
    shadow.destroy();

    const crate = this.make.graphics({ x: 0, y: 0, add: false });
    crate.fillStyle(0x7f6242, 1);
    crate.fillRoundedRect(6, 6, 60, 60, 12);
    crate.fillStyle(0xdccfb7, 1);
    crate.fillRoundedRect(9, 9, 54, 54, 10);
    crate.fillStyle(0xffffff, 0.1);
    crate.fillRoundedRect(13, 13, 42, 8, 4);
    crate.lineStyle(2, 0x8e7659, 1);
    crate.strokeRoundedRect(9, 9, 54, 54, 10);
    crate.generateTexture('crate-base', 72, 72);
    crate.destroy();

    const top = this.make.graphics({ x: 0, y: 0, add: false });
    top.fillStyle(0xffffff, 1);
    top.fillRoundedRect(0, 0, 50, 50, 9);
    top.fillStyle(0xffffff, 0.16);
    top.fillRoundedRect(4, 4, 34, 7, 4);
    top.lineStyle(2, 0xffffff, 0.18);
    top.strokeRoundedRect(1, 1, 48, 48, 8);
    top.generateTexture('crate-top', 50, 50);
    top.destroy();
  }

  private createPanelTexture(key: string, width: number, height: number, topColor: number, bottomColor: number): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1, 1, 1, 1);
    graphics.fillRoundedRect(0, 0, width, height, 28);
    graphics.lineStyle(3, 0xffffff, 0.08);
    graphics.strokeRoundedRect(2, 2, width - 4, height - 4, 26);
    graphics.fillStyle(0xffffff, 0.07);
    graphics.fillRoundedRect(12, 10, width - 24, 12, 6);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  private createButtonTexture(key: string, width: number, height: number, topColor: number, bottomColor: number): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1, 1, 1, 1);
    graphics.fillRoundedRect(0, 0, width, height, 22);
    graphics.lineStyle(3, 0xffffff, 0.18);
    graphics.strokeRoundedRect(2, 2, width - 4, height - 4, 20);
    graphics.fillStyle(0xffffff, 0.16);
    graphics.fillRoundedRect(14, 10, width - 28, 10, 5);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  private createStarTexture(key: string, color: number): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(28, 4);
    graphics.lineTo(34, 20);
    graphics.lineTo(52, 20);
    graphics.lineTo(38, 31);
    graphics.lineTo(44, 49);
    graphics.lineTo(28, 38);
    graphics.lineTo(12, 49);
    graphics.lineTo(18, 31);
    graphics.lineTo(4, 20);
    graphics.lineTo(22, 20);
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture(key, 56, 56);
    graphics.destroy();
  }

  private createSparkTexture(key: string, size: number): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(size / 2 - 2, 0, 4, size, 2);
    graphics.fillRoundedRect(0, size / 2 - 2, size, 4, 2);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private createQueuePillTexture(key: string, width: number, height: number): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x182e3e, 1);
    graphics.fillRoundedRect(0, 0, width, height, 18);
    graphics.lineStyle(2, 0xffffff, 0.08);
    graphics.strokeRoundedRect(1, 1, width - 2, height - 2, 17);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
}
