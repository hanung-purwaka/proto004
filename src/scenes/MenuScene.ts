import Phaser from 'phaser';
import { levels } from '../data/levels';
import { getSavedLevelIndex } from '../logic/progression';

const BUTTON_WIDTH = 180;
const BUTTON_HEIGHT = 54;
const LEVEL_CHIP_SIZE = 62;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    const savedLevel = getSavedLevelIndex();

    this.cameras.main.setBackgroundColor('#0c1118');
    this.add.rectangle(270, 480, 540, 960, 0x0c1118);

    const wash = this.add.graphics();
    wash.fillGradientStyle(0x113148, 0x0a1822, 0x0d1722, 0x143b52, 1, 1, 1, 1);
    wash.fillRect(0, 0, 540, 960);
    wash.fillStyle(0x63d4ff, 0.08);
    wash.fillEllipse(150, 180, 240, 180);
    wash.fillStyle(0xf3b858, 0.08);
    wash.fillEllipse(390, 760, 260, 220);

    this.add.image(270, 132, 'panel-card');
    this.add.text(270, 92, 'Cargo Cascade', {
      fontFamily: 'Trebuchet MS',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#f3fbff',
    }).setOrigin(0.5);
    this.add.text(270, 148, 'Swipe a crate into an empty neighboring slot to set up the next match.', {
      fontFamily: 'Trebuchet MS',
      fontSize: '18px',
      color: '#b7d4e6',
      align: 'center',
      wordWrap: { width: 340 },
    }).setOrigin(0.5);

    this.add.image(270, 430, 'panel-wide');
    this.add.text(270, 334, 'How It Plays', {
      fontFamily: 'Trebuchet MS',
      fontSize: '28px',
      color: '#f1fbff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const rules = [
      'Balls drop automatically from the funnel.',
      'Only outer-edge crates can be matched.',
      'Swipe a crate only if its next slot is empty.',
      'Clear every crate before the conveyor overloads.',
    ];

    rules.forEach((line, index) => {
      this.add.text(102, 382 + index * 34, `• ${line}`, {
        fontFamily: 'Trebuchet MS',
        fontSize: '18px',
        color: '#d6ebf6',
      });
    });

    this.add.text(270, 548, `${levels.length} handcrafted levels`, {
      fontFamily: 'Trebuchet MS',
      fontSize: '20px',
      color: '#ffe8b4',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(270, 602, 'Select Level', {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#f3fbff',
    }).setOrigin(0.5);

    levels.forEach((level, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const x = 118 + col * 76;
      const y = 660 + row * 86;
      this.createLevelChip(x, y, level.id, index, index === savedLevel);
    });

    this.add.text(270, 850, 'Bright queue planning, tactile shifts, and satisfying chain clears.', {
      fontFamily: 'Trebuchet MS',
      fontSize: '17px',
      color: '#9eb7c9',
      align: 'center',
      wordWrap: { width: 360 },
    }).setOrigin(0.5);
  }

  private createButton(
    x: number,
    y: number,
    texture: string,
    label: string,
    action: () => void,
  ): Phaser.GameObjects.Container {
    const image = this.add.image(0, 0, texture).setDisplaySize(BUTTON_WIDTH, BUTTON_HEIGHT);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#f7fbff',
    }).setOrigin(0.5);
    const container = this.add.container(x, y, [image, text]);
    container.setSize(BUTTON_WIDTH, BUTTON_HEIGHT);
    container.setDepth(3);

    const hitArea = this.add.rectangle(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, 0xffffff, 0.001);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.setDepth(4);

    hitArea.on('pointerover', () => container.setScale(1.03));
    hitArea.on('pointerout', () => container.setScale(1));
    hitArea.on('pointerdown', () => container.setScale(0.98));
    hitArea.on('pointerup', () => {
      container.setScale(1.03);
      action();
    });
    hitArea.on('pointerupoutside', () => container.setScale(1));
    container.once(Phaser.GameObjects.Events.DESTROY, () => hitArea.destroy());

    return container;
  }

  private createLevelChip(
    x: number,
    y: number,
    levelNumber: number,
    levelIndex: number,
    isSavedLevel: boolean,
  ): Phaser.GameObjects.Container {
    const bg = this.add.image(0, 0, isSavedLevel ? 'button-primary' : 'button-secondary')
      .setDisplaySize(LEVEL_CHIP_SIZE, LEVEL_CHIP_SIZE);
    const text = this.add.text(0, -2, String(levelNumber), {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#f8fbff',
    }).setOrigin(0.5);
    const tag = this.add.text(0, 26, isSavedLevel ? 'LAST' : '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#eef8ff',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, text, tag]);
    container.setDepth(3);

    const hitArea = this.add.rectangle(x, y, LEVEL_CHIP_SIZE + 10, LEVEL_CHIP_SIZE + 10, 0xffffff, 0.001);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.setDepth(4);

    hitArea.on('pointerover', () => container.setScale(1.05));
    hitArea.on('pointerout', () => container.setScale(1));
    hitArea.on('pointerdown', () => container.setScale(0.96));
    hitArea.on('pointerup', () => {
      container.setScale(1.05);
      this.scene.start('game', { levelIndex });
    });
    hitArea.on('pointerupoutside', () => container.setScale(1));
    container.once(Phaser.GameObjects.Events.DESTROY, () => hitArea.destroy());

    return container;
  }
}
