import Phaser from 'phaser';
import {
  COLORS,
  GRID_COLS,
  GRID_ROWS,
  type ColorKey,
  type GridState,
  type LevelDefinition,
  type PieceDefinition,
  levels,
} from '../data/levels';
import {
  getPerimeterOrder,
  type GridPosition,
  type ShiftDirection,
} from '../logic/board';
import { getNextLevelIndex, saveLevelIndex } from '../logic/progression';

type GamePhase = 'intro' | 'play' | 'win' | 'fail';

interface PieceCell {
  row: number;
  col: number;
  color: ColorKey;
}

interface PieceView {
  id: string;
  cells: PieceCell[];
  container: Phaser.GameObjects.Container;
  markers: Map<string, Phaser.GameObjects.Arc>;
}

interface ConveyorBall {
  id: number;
  color: ColorKey;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  progress: number;
  lastSlotIndex: number;
  loops: number;
  matching: boolean;
}

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const BOARD_SIZE = 428;
const CELL_SIZE = BOARD_SIZE / GRID_COLS;
const BOARD_ORIGIN = { x: (GAME_WIDTH - BOARD_SIZE) / 2, y: 228 };
const CONVEYOR_OFFSET = 22;
const FUNNEL_CENTER = { x: GAME_WIDTH / 2, y: 180 };
const FUNNEL_FLOOR_Y = BOARD_ORIGIN.y - CONVEYOR_OFFSET - 4;
const SWIPE_THRESHOLD = 10;
const CHAIN_WINDOW_MS = 900;
const QUEUE_PREVIEW_COUNT = 5;
const BUTTON_WIDTH = 180;
const BUTTON_HEIGHT = 54;
const SPEED_OPTIONS = [1, 1.5, 2, 3];
const CONVEYOR_ENTRY_INDEX = Math.floor(GRID_COLS / 2);
const MIN_CONVEYOR_GAP = 0.92;
const BOTTOM_PANEL_Y = 894;
const BOTTOM_BUTTON_Y = 892;
const CRATE_MOVE_DURATION_MS = 110;

export class GameScene extends Phaser.Scene {
  private currentLevelIndex = 0;
  private currentLevel!: LevelDefinition;
  private phase: GamePhase = 'intro';

  private grid: GridState = levels[0].board.map((row) => [...row]);
  private pieces = new Map<string, PieceView>();
  private pieceGrid: Array<Array<string | null>> = Array.from({ length: GRID_ROWS }, () => Array<string | null>(GRID_COLS).fill(null));
  private perimeterCells = getPerimeterOrder(GRID_ROWS, GRID_COLS);
  private conveyorPoints: Phaser.Math.Vector2[] = [];
  private beltMarkers: Phaser.GameObjects.Rectangle[] = [];
  private conveyorBalls: ConveyorBall[] = [];

  private dropColorQueueIndex = 0;
  private dropBall?: Phaser.Physics.Arcade.Image;
  private dropBallColor?: ColorKey;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private landingPad!: Phaser.Physics.Arcade.StaticImage;

  private score = 0;
  private moveCount = 0;
  private matchCount = 0;
  private chainCount = 0;
  private bestChain = 0;
  private lastMatchAt = -1000;
  private busy = false;
  private ballIdCounter = 0;
  private speedMultiplier = 1;
  private fullConveyorAt?: number;

  private swipeStart?: { pointerId: number; x: number; y: number; pieceId: string };

  private levelText!: Phaser.GameObjects.Text;
  private moveText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private queuePreviewBalls: Phaser.GameObjects.Image[] = [];
  private queuePreviewLabels: Phaser.GameObjects.Text[] = [];
  private tipPanel?: Phaser.GameObjects.Container;
  private modalOverlay!: Phaser.GameObjects.Rectangle;
  private modalPanel!: Phaser.GameObjects.Container;
  private modalTitle!: Phaser.GameObjects.Text;
  private modalBody!: Phaser.GameObjects.Text;
  private modalStars: Phaser.GameObjects.Image[] = [];
  private modalButtons: Phaser.GameObjects.Container[] = [];
  private speedButton?: Phaser.GameObjects.Container;

  constructor() {
    super('game');
  }

  init(data?: { levelIndex?: number }): void {
    if (typeof data?.levelIndex === 'number' && Number.isFinite(data.levelIndex)) {
      this.currentLevelIndex = Phaser.Math.Clamp(data.levelIndex, 0, levels.length - 1);
    } else {
      this.currentLevelIndex = 0;
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0c1118');
    this.buildStaticBackdrop();
    this.buildTopUi();
    this.buildBottomUi();
    this.buildModal();
    this.buildPhysics();
    this.registerInput();
    this.loadLevel(this.currentLevelIndex);
  }

  update(time: number, delta: number): void {
    this.updateBeltMarkers(time);
    this.updateConveyorBalls(delta);
    this.updateDropBallVisual();
    this.ensureDropBallResolves();

    if (this.phase === 'play' && this.dropBall === undefined && this.dropColorQueueIndex >= this.currentLevel.queue.length && this.conveyorBalls.length === 0 && this.pieces.size > 0) {
      this.failLevel('The queue ran dry before the board was cleared.');
    }
  }

  private buildStaticBackdrop(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0c1118);

    const glow = this.add.graphics();
    glow.fillGradientStyle(0x14354d, 0x10222f, 0x0d1420, 0x133448, 1, 1, 1, 1);
    glow.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    glow.fillStyle(0x7ad4ff, 0.07);
    glow.fillEllipse(140, 150, 250, 180);
    glow.fillStyle(0xffcf7c, 0.05);
    glow.fillEllipse(410, 810, 260, 220);

    this.add.image(GAME_WIDTH / 2, 62, 'panel-wide').setDisplaySize(500, 94);
    this.add.image(GAME_WIDTH / 2, BOTTOM_PANEL_Y, 'panel-wide').setDisplaySize(500, 84);

    const shellOuterX = BOARD_ORIGIN.x - 36;
    const shellOuterY = BOARD_ORIGIN.y - 40;
    const shellOuterWidth = BOARD_SIZE + 72;
    const shellOuterHeight = BOARD_SIZE + 160;
    const shellInnerX = BOARD_ORIGIN.x - 16;
    const shellInnerY = BOARD_ORIGIN.y - 18;
    const shellInnerWidth = BOARD_SIZE + 32;
    const shellInnerHeight = BOARD_SIZE + 106;

    const boardShell = this.add.graphics();
    boardShell.fillStyle(0x1a3040, 1);
    boardShell.fillRoundedRect(shellOuterX, shellOuterY, shellOuterWidth, shellOuterHeight, 34);
    boardShell.lineStyle(4, 0x274a61, 1);
    boardShell.strokeRoundedRect(shellOuterX, shellOuterY, shellOuterWidth, shellOuterHeight, 34);
    boardShell.fillStyle(0x111c27, 0.98);
    boardShell.fillRoundedRect(shellInnerX, shellInnerY, shellInnerWidth, shellInnerHeight, 28);

    this.drawFunnel();
    this.drawConveyorTrack();
    this.drawBoardCells();
  }

  private drawFunnel(): void {
    const lipY = 128;
    const leftX = BOARD_ORIGIN.x + 22;
    const rightX = BOARD_ORIGIN.x + BOARD_SIZE - 22;
    const neckHalfWidth = 54;
    const neckTopY = BOARD_ORIGIN.y - 74;
    const neckBottomY = FUNNEL_FLOOR_Y + 18;
    const neckLeftX = FUNNEL_CENTER.x - neckHalfWidth;
    const neckRightX = FUNNEL_CENTER.x + neckHalfWidth;

    const funnel = this.add.graphics();
    funnel.fillStyle(0x1b3343, 1);
    funnel.fillPoints(
      [
        { x: leftX, y: lipY },
        { x: rightX, y: lipY },
        { x: neckRightX, y: neckTopY },
        { x: neckRightX, y: neckBottomY },
        { x: neckLeftX, y: neckBottomY },
        { x: neckLeftX, y: neckTopY },
      ],
      true,
    );
    funnel.lineStyle(4, 0x507591, 1);
    funnel.strokePoints(
      [
        { x: leftX, y: lipY },
        { x: rightX, y: lipY },
        { x: neckRightX, y: neckTopY },
        { x: neckRightX, y: neckBottomY },
        { x: neckLeftX, y: neckBottomY },
        { x: neckLeftX, y: neckTopY },
      ],
      true,
    );
    funnel.fillStyle(0xffffff, 0.08);
    funnel.fillRoundedRect(leftX + 22, lipY + 10, rightX - leftX - 44, 10, 5);
    funnel.fillStyle(0x7ad4ff, 0.12);
    funnel.fillRoundedRect(neckLeftX + 10, neckBottomY - 14, neckHalfWidth * 2 - 20, 10, 4);
  }

  private drawConveyorTrack(): void {
    this.conveyorPoints = this.perimeterCells.map((position) => this.getConveyorPoint(position));

    const track = this.add.graphics();
    track.lineStyle(26, 0x263946, 1);
    track.strokePoints(this.conveyorPoints, true);
    track.lineStyle(18, 0x35566b, 1);
    track.strokePoints(this.conveyorPoints, true);
    track.lineStyle(3, 0xffffff, 0.08);
    track.strokePoints(this.conveyorPoints, true);

    this.conveyorPoints.forEach((point) => {
      this.add.circle(point.x, point.y, 12, 0x1a2b37, 1).setStrokeStyle(2, 0x4f7087, 0.85);
      this.add.circle(point.x, point.y, 7, 0x0e1821, 1).setStrokeStyle(1, 0x8bc8ea, 0.18);
    });

    this.beltMarkers = [];
    for (let index = 0; index < 26; index += 1) {
      const marker = this.add.rectangle(0, 0, 16, 6, 0xbfeeff, 0.6);
      marker.setBlendMode(Phaser.BlendModes.ADD);
      this.beltMarkers.push(marker);
    }
  }

  private drawBoardCells(): void {
    const board = this.add.graphics();
    board.fillStyle(0x172734, 0.95);
    board.fillRoundedRect(BOARD_ORIGIN.x - 8, BOARD_ORIGIN.y - 8, BOARD_SIZE + 16, BOARD_SIZE + 16, 28);
    const outerInset = 1;
    const innerInset = 2.5;
    const outerSize = CELL_SIZE - outerInset * 2;
    const innerSize = CELL_SIZE - innerInset * 2;
    const outerRadius = Math.max(6, CELL_SIZE * 0.18);
    const innerRadius = Math.max(4, CELL_SIZE * 0.12);

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const x = BOARD_ORIGIN.x + col * CELL_SIZE + outerInset;
        const y = BOARD_ORIGIN.y + row * CELL_SIZE + outerInset;
        board.fillStyle(0x223645, 1);
        board.fillRoundedRect(x, y, outerSize, outerSize, outerRadius);
        board.fillStyle(0x121c24, 0.9);
        board.fillRoundedRect(x + (innerInset - outerInset), y + (innerInset - outerInset), innerSize, innerSize, innerRadius);
      }
    }
  }

  private buildTopUi(): void {
    this.add.text(42, 28, 'Cargo Cascade', {
      fontFamily: 'Trebuchet MS',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#f3fbff',
    });

    this.levelText = this.add.text(42, 62, 'Level 1', {
      fontFamily: 'Trebuchet MS',
      fontSize: '16px',
      color: '#9fc5dc',
    });

    this.moveText = this.add.text(180, 28, 'Moves 0', {
      fontFamily: 'Trebuchet MS',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#f9f3d6',
    });

    this.scoreText = this.add.text(180, 56, 'Score 0', {
      fontFamily: 'Trebuchet MS',
      fontSize: '16px',
      color: '#b7d4e6',
    });

    this.add.text(344, 26, 'Incoming', {
      fontFamily: 'Trebuchet MS',
      fontSize: '16px',
      color: '#f1fbff',
      fontStyle: 'bold',
    });

    for (let index = 0; index < QUEUE_PREVIEW_COUNT; index += 1) {
      this.add.image(350 + index * 34, 62, 'queue-pill').setScale(0.58);
      const ball = this.add.image(350 + index * 34, 62, 'ball-generic').setScale(0.36);
      const label = this.add.text(350 + index * 34, 85, `${index + 1}`, {
        fontFamily: 'Trebuchet MS',
        fontSize: '12px',
        color: '#c7ddeb',
      }).setOrigin(0.5);
      this.queuePreviewBalls.push(ball);
      this.queuePreviewLabels.push(label);
    }
  }

  private buildBottomUi(): void {
    this.createButton(90, BOTTOM_BUTTON_Y, 'Restart', 'button-secondary', () => this.reloadLevel());
    this.speedButton = this.createButton(270, BOTTOM_BUTTON_Y, 'Speed 1x', 'button-primary', () => this.toggleSpeed());
    this.createButton(450, BOTTOM_BUTTON_Y, 'Menu', 'button-primary', () => this.scene.start('menu'));
  }

  private buildModal(): void {
    this.modalOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.72);
    this.modalOverlay.setVisible(false);

    this.modalPanel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    const panel = this.add.image(0, 0, 'panel-modal');
    this.modalTitle = this.add.text(0, -78, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#f7fbff',
      align: 'center',
    }).setOrigin(0.5);

    this.modalBody = this.add.text(0, -12, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '18px',
      color: '#cde1ef',
      align: 'center',
      wordWrap: { width: 280 },
    }).setOrigin(0.5);

    this.modalPanel.add([panel, this.modalTitle, this.modalBody]);
    this.modalPanel.setVisible(false);

    for (let index = 0; index < 3; index += 1) {
      const star = this.add.image(-62 + index * 62, -118, 'star-dim').setScale(0.72);
      this.modalPanel.add(star);
      this.modalStars.push(star);
    }
  }

  private buildPhysics(): void {
    this.physics.world.gravity.y = 950;
    this.landingPad = this.physics.add.staticImage(FUNNEL_CENTER.x, FUNNEL_FLOOR_Y, undefined);
    this.landingPad.setDisplaySize(104, 16);
    this.landingPad.refreshBody();
  }

  private registerInput(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.resolveSwipe(pointer);
    });

    this.input.on('pointerup', () => {
      if (this.swipeStart) {
        this.pieces.get(this.swipeStart.pieceId)?.container.setScale(1);
      }
      this.swipeStart = undefined;
    });
  }

  private resolveSwipe(pointer: Phaser.Input.Pointer): void {
    if (!this.swipeStart || this.phase !== 'play' || this.busy) {
      return;
    }

    if (pointer.id !== this.swipeStart.pointerId) {
      return;
    }

    const dx = pointer.x - this.swipeStart.x;
    const dy = pointer.y - this.swipeStart.y;

    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
      return;
    }

    const direction: ShiftDirection =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? 'right'
          : 'left'
        : dy > 0
          ? 'down'
          : 'up';

    const { pieceId } = this.swipeStart;
    this.swipeStart = undefined;
    this.tryMove(pieceId, direction);
  }

  private loadLevel(levelIndex: number): void {
    this.resetLevelState();

    this.currentLevelIndex = Phaser.Math.Clamp(levelIndex, 0, levels.length - 1);
    this.currentLevel = levels[this.currentLevelIndex];
    this.grid = this.currentLevel.board.map((row) => [...row]);
    this.pieceGrid = Array.from({ length: GRID_ROWS }, () => Array<string | null>(GRID_COLS).fill(null));
    this.dropColorQueueIndex = 0;
    this.phase = 'intro';
    this.score = 0;
    this.moveCount = 0;
    this.matchCount = 0;
    this.chainCount = 0;
    this.bestChain = 0;
    this.lastMatchAt = -1000;
    this.speedMultiplier = 1;
    this.fullConveyorAt = undefined;

    this.levelText.setText(`Level ${this.currentLevel.id} • ${this.currentLevel.name}`);
    this.renderPieces();
    this.updateQueuePreview();
    this.updateHud();
    this.updateSpeedButton();
    this.showOnboarding();

    this.time.delayedCall(600, () => {
      this.phase = 'play';
      this.scheduleSpawns();
    });
  }

  private resetLevelState(): void {
    this.spawnTimer?.remove(false);
    this.spawnTimer = undefined;

    if (this.dropBall) {
      this.dropBall.destroy();
      this.dropBall = undefined;
      this.dropBallColor = undefined;
    }

    this.conveyorBalls.forEach((ball) => {
      ball.sprite.destroy();
      ball.glow.destroy();
      ball.shadow.destroy();
    });
    this.conveyorBalls = [];

    this.pieces.forEach((view) => view.container.destroy());
    this.pieces.clear();
    this.pieceGrid = Array.from({ length: GRID_ROWS }, () => Array<string | null>(GRID_COLS).fill(null));

    this.tipPanel?.destroy();
    this.tipPanel = undefined;

    this.hideModal();
  }

  private renderPieces(): void {
    this.currentLevel.pieces.forEach((piece) => {
      const view = this.createPieceView(piece);
      this.pieces.set(piece.id, view);
      this.writePieceToGrid(view);
    });
  }

  private createPieceView(piece: PieceDefinition): PieceView {
    const cells = piece.cells.map((cell) => ({ ...cell }));
    const bounds = this.getPieceBounds(cells);
    const size = this.getPiecePixelSize(cells);
    const center = this.getPieceCenter(cells);
    const shadow = this.add.graphics();
    const body = this.add.graphics();
    const shell = this.add.graphics();
    const accents = this.add.graphics();
    const outline = this.add.graphics();
    const markers = new Map<string, Phaser.GameObjects.Arc>();
    const cellKeySet = new Set(cells.map((cell) => `${cell.row}:${cell.col}`));
    const primaryPalette = COLORS[cells[0].color];

    cells.forEach((cell) => {
      const local = this.getLocalCellRect(cell, bounds);
      const palette = COLORS[cell.color];

      shadow.fillStyle(0x000000, 0.22);
      shadow.fillRoundedRect(local.x + 4, local.y + 8, local.width - 4, local.height - 4, 12);

      body.fillStyle(palette.dark, 1);
      body.fillRoundedRect(local.x, local.y, local.width, local.height, 12);

      shell.fillStyle(palette.fill, 1);
      shell.fillRoundedRect(local.x + 4, local.y + 4, local.width - 8, local.height - 8, 10);
      shell.fillStyle(palette.light, 0.22);
      shell.fillRoundedRect(local.x + 10, local.y + 8, Math.max(16, local.width - 20), 8, 4);
    });

    if (cells.length > 1) {
      outline.lineStyle(4, primaryPalette.light, 0.95);

      cells.forEach((cell) => {
        const local = this.getLocalCellRect(cell, bounds);
        const left = local.x;
        const right = local.x + local.width;
        const top = local.y;
        const bottom = local.y + local.height;

        if (!cellKeySet.has(`${cell.row - 1}:${cell.col}`)) {
          outline.lineBetween(left + 6, top + 2, right - 6, top + 2);
        }

        if (!cellKeySet.has(`${cell.row + 1}:${cell.col}`)) {
          outline.lineBetween(left + 6, bottom - 2, right - 6, bottom - 2);
        }

        if (!cellKeySet.has(`${cell.row}:${cell.col - 1}`)) {
          outline.lineBetween(left + 2, top + 6, left + 2, bottom - 6);
        }

        if (!cellKeySet.has(`${cell.row}:${cell.col + 1}`)) {
          outline.lineBetween(right - 2, top + 6, right - 2, bottom - 6);
        }
      });
    }

    const markerObjects = cells.map((cell) => {
      const local = this.getLocalCellRect(cell, bounds);
      const marker = this.add.circle(
        local.x + local.width / 2,
        local.y + local.height / 2,
        Math.max(5, Math.min(local.width, local.height) * 0.16),
        0x091018,
        0.9,
      ).setStrokeStyle(2, 0xffffff, 0.08);

      accents.fillStyle(COLORS[cell.color].glow, 0.14);
      accents.fillCircle(local.x + local.width / 2, local.y + local.height / 2, Math.max(8, Math.min(local.width, local.height) * 0.2));
      markers.set(`${cell.row}:${cell.col}`, marker);
      return marker;
    });

    const container = this.add.container(center.x, center.y, [shadow, body, shell, accents, outline, ...markerObjects]);
    container.setDepth(5);
    container.setSize(size.width, size.height);
    const hitCells = cells.map((cell) => this.getLocalCellRect(cell, bounds));
    container.setInteractive(
      new Phaser.Geom.Rectangle(-size.width / 2, -size.height / 2, size.width, size.height),
      (_shape, x: number, y: number) =>
        hitCells.some((cell) =>
          x >= cell.x && x <= cell.x + cell.width && y >= cell.y && y <= cell.y + cell.height),
    );
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.phase !== 'play' || this.busy) {
        return;
      }

      this.swipeStart = { pointerId: pointer.id, x: pointer.x, y: pointer.y, pieceId: piece.id };
      container.setScale(1.02);
      this.dismissOnboarding();
    });
    container.on('pointerup', () => container.setScale(1));
    container.on('pointerout', () => {
      if (!this.swipeStart || this.swipeStart.pieceId !== piece.id) {
        container.setScale(1);
      }
    });

    return {
      id: piece.id,
      cells,
      container,
      markers,
    };
  }

  private scheduleSpawns(): void {
    this.spawnTimer?.remove(false);
    this.spawnTimer = this.time.addEvent({
      delay: this.currentLevel.spawnIntervalMs / this.speedMultiplier,
      loop: true,
      callback: () => {
        if (this.phase !== 'play') {
          return;
        }

        if (this.dropBall || this.dropColorQueueIndex >= this.currentLevel.queue.length) {
          return;
        }

        if (this.getOccupiedSlotCount() >= this.perimeterCells.length || !this.isConveyorSlotOpen(CONVEYOR_ENTRY_INDEX)) {
          return;
        }

        this.spawnDropBall(this.currentLevel.queue[this.dropColorQueueIndex]);
        this.dropColorQueueIndex += 1;
        this.updateQueuePreview();
      },
    });
  }

  private spawnDropBall(color: ColorKey): void {
    this.dropBallColor = color;
    this.dropBall = this.physics.add.image(FUNNEL_CENTER.x, FUNNEL_CENTER.y, 'ball-generic').setScale(0.82);
    this.dropBall.setTint(COLORS[color].fill);
    this.dropBall.setCircle(22);
    this.dropBall.setBounce(0.08);
    this.dropBall.setVelocity(
      Phaser.Math.Between(-8, 8) * Math.min(this.speedMultiplier, 2),
      Phaser.Math.Between(20, 50) * this.speedMultiplier,
    );
    this.dropBall.setDragX(220 / this.speedMultiplier);
    this.dropBall.setGravityY(250 * (this.speedMultiplier - 1));
    this.dropBall.setMaxVelocity(120, 420 * this.speedMultiplier);
    this.physics.add.collider(this.dropBall, this.landingPad, () => this.landDropBall(), undefined, this);

    this.tweens.add({
      targets: this.dropBall,
      scaleX: { from: 0.74, to: 0.82 },
      scaleY: { from: 1.08, to: 0.82 },
      duration: 220,
      ease: 'quad.out',
    });
  }

  private landDropBall(): void {
    if (!this.dropBall || !this.dropBallColor) {
      return;
    }

    const color = this.dropBallColor;
    this.dropBall.destroy();
    this.dropBall = undefined;
    this.dropBallColor = undefined;

    const ball = this.createConveyorBall(color);
    this.conveyorBalls.push(ball);

    this.spawnImpact(FUNNEL_CENTER.x, FUNNEL_FLOOR_Y + 8, COLORS[color].glow);
    this.triggerHaptic('light');
    this.playSoundHook('drop');
  }

  private createConveyorBall(color: ColorKey): ConveyorBall {
    const point = this.samplePath(CONVEYOR_ENTRY_INDEX);
    const shadow = this.add.ellipse(point.x, point.y + 12, 24, 10, 0x000000, 0.26).setDepth(2);
    const glow = this.add.circle(point.x, point.y, 20, COLORS[color].glow, 0.18).setDepth(3);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    const sprite = this.add.image(point.x, point.y, 'ball-generic').setTint(COLORS[color].fill).setScale(0.72).setDepth(4);

    return {
      id: this.ballIdCounter += 1,
      color,
      sprite,
      glow,
      shadow,
      progress: CONVEYOR_ENTRY_INDEX,
      lastSlotIndex: -1,
      loops: 0,
      matching: false,
    };
  }

  private updateConveyorBalls(delta: number): void {
    if (this.phase !== 'play') {
      return;
    }

    const speed = this.currentLevel.conveyorSpeed * this.speedMultiplier;
    const pathLength = this.perimeterCells.length;
    const movingBalls = this.conveyorBalls.filter((ball) => !ball.matching).sort((a, b) => a.progress - b.progress);
    const nextProgressById = new Map<number, number>();
    const step = speed * delta * 0.001;

    for (let index = movingBalls.length - 1; index >= 0; index -= 1) {
      const ball = movingBalls[index];
      const ahead = movingBalls[(index + 1) % movingBalls.length];
      const desiredProgress = ball.progress + step;

      let resolvedProgress = desiredProgress;
      if (movingBalls.length > 1) {
        const aheadProgress = nextProgressById.get(ahead.id) ?? ahead.progress;
        const aheadWrapped = aheadProgress <= ball.progress ? aheadProgress + pathLength : aheadProgress;
        resolvedProgress = Math.min(desiredProgress, aheadWrapped - MIN_CONVEYOR_GAP);
      }

      if (resolvedProgress < ball.progress) {
        resolvedProgress = ball.progress;
      }

      if (resolvedProgress >= pathLength) {
        resolvedProgress -= pathLength;
        ball.loops += 1;
      }

      nextProgressById.set(ball.id, resolvedProgress);
    }

    for (let index = this.conveyorBalls.length - 1; index >= 0; index -= 1) {
      const ball = this.conveyorBalls[index];
      if (ball.matching) {
        continue;
      }

      const previous = ball.progress;
      const nextProgress = nextProgressById.get(ball.id);
      if (typeof nextProgress === 'number') {
        ball.progress = nextProgress;
      }

      const point = this.samplePath(ball.progress);
      ball.sprite.setPosition(point.x, point.y);
      ball.shadow.setPosition(point.x, point.y + 14);
      ball.glow.setPosition(point.x, point.y);
      ball.sprite.rotation += (ball.progress - previous) * 0.18;

      const slotIndex = Math.floor(ball.progress + 0.5) % pathLength;
      if (slotIndex !== ball.lastSlotIndex) {
        ball.lastSlotIndex = slotIndex;
        this.tryMatchBall(ball, slotIndex);
      }
    }

    this.updateJamState();
  }

  private tryMatchBall(ball: ConveyorBall, slotIndex: number): void {
    const target = this.perimeterCells[slotIndex];
    const pieceId = this.pieceGrid[target.row][target.col];
    if (!pieceId) {
      return;
    }

    const piece = this.pieces.get(pieceId);
    const cellColor = this.grid[target.row][target.col];
    if (!piece || cellColor !== ball.color) {
      return;
    }

    ball.matching = true;
    this.busy = true;

    const startX = ball.sprite.x;
    const startY = ball.sprite.y;
    const end = this.getPieceCenter(piece);
    const travel = { value: 0 };

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 360,
      ease: 'cubic.in',
      onUpdate: (tween) => {
        travel.value = tween.getValue();
        const px = Phaser.Math.Linear(startX, end.x, travel.value);
        const py = Phaser.Math.Linear(startY, end.y, travel.value) - Math.sin(travel.value * Math.PI) * 34;
        ball.sprite.setPosition(px, py);
        ball.glow.setPosition(px, py);
        ball.shadow.setAlpha(0.12 + (1 - travel.value) * 0.1);
      },
      onComplete: () => {
        this.completeMatch(ball, piece);
      },
    });
  }

  private completeMatch(ball: ConveyorBall, piece: PieceView): void {
    this.conveyorBalls = this.conveyorBalls.filter((entry) => entry.id !== ball.id);
    ball.sprite.destroy();
    ball.glow.destroy();
    ball.shadow.destroy();

    const matchedCell = this.findMatchingPerimeterCell(piece, ball.color);
    if (!matchedCell) {
      this.busy = false;
      return;
    }

    const matchedMarker = piece.markers.get(`${matchedCell.row}:${matchedCell.col}`);
    matchedMarker?.setStrokeStyle(0);
    if (matchedMarker) {
      this.tweens.add({
        targets: matchedMarker,
        scaleX: 0.2,
        scaleY: 0.2,
        alpha: 0,
        duration: 120,
      });
    }

    this.grid[matchedCell.row][matchedCell.col] = null;
    this.clearPieceFromGrid(piece);
    this.pieces.delete(piece.id);

    const now = this.time.now;
    this.chainCount = now - this.lastMatchAt < CHAIN_WINDOW_MS ? this.chainCount + 1 : 1;
    this.bestChain = Math.max(this.bestChain, this.chainCount);
    this.lastMatchAt = now;
    this.fullConveyorAt = undefined;
    this.matchCount += 1;
    this.score += 100 * this.chainCount;

    this.spawnClearEffect(
      BOARD_ORIGIN.x + matchedCell.col * CELL_SIZE + CELL_SIZE / 2,
      BOARD_ORIGIN.y + matchedCell.row * CELL_SIZE + CELL_SIZE / 2,
      matchedCell.color,
      this.chainCount,
    );
    piece.container.destroy();
    this.rebuildSplitPieces(piece, matchedCell);

    this.playSoundHook(this.chainCount > 1 ? 'chain' : 'match');
    this.triggerHaptic(this.chainCount > 1 ? 'success' : 'light');
    this.updateHud();

    this.time.delayedCall(80, () => {
      this.busy = false;
      if (this.pieces.size === 0) {
        this.completeLevel(false);
      }
    });
  }

  private tryMove(pieceId: string, direction: ShiftDirection): void {
    const piece = this.pieces.get(pieceId);
    if (!piece) {
      return;
    }

    if (!this.canMovePiece(piece, direction)) {
      this.invalidShiftFeedback(piece);
      this.playSoundHook('invalid');
      this.triggerHaptic('error');
      piece.container.setScale(1);
      return;
    }

    this.busy = true;
    this.moveCount += 1;
    this.chainCount = 0;
    this.dismissOnboarding();

    this.clearPieceFromGrid(piece);
    piece.cells = piece.cells.map((cell) => this.translateCell(cell, direction));
    this.writePieceToGrid(piece);

    const center = this.getPieceCenter(piece);
    this.tweens.add({
      targets: piece.container,
      x: center.x,
      y: center.y,
      duration: CRATE_MOVE_DURATION_MS,
      ease: 'quad.out',
      onComplete: () => piece.container.setScale(1),
    });

    this.time.delayedCall(CRATE_MOVE_DURATION_MS + 25, () => {
      this.busy = false;
      this.updateHud();
    });

    this.playSoundHook('shift');
    this.triggerHaptic('light');
    this.updateHud();
  }

  private invalidShiftFeedback(piece: PieceView): void {
    const size = this.getPiecePixelSize(piece);
    const x = piece.container.x;
    const y = piece.container.y;
    const width = size.width - 10;
    const height = size.height - 10;
    const flash = this.add.rectangle(x, y, width, height, 0xffa29a, 0.18);
    flash.setStrokeStyle(3, 0xffcdc8, 0.8);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 180,
      onComplete: () => flash.destroy(),
    });
  }

  private completeLevel(skipped: boolean): void {
    this.phase = 'win';
    this.spawnTimer?.remove(false);
    saveLevelIndex(getNextLevelIndex(this.currentLevelIndex));

    const stars = skipped ? 1 : this.computeStars();
    const message = skipped
      ? 'Level skipped for iteration.'
      : `Score ${this.score}\nMoves ${this.moveCount}\nBest chain x${this.bestChain}`;

    this.showModal('Board Cleared!', message, stars, [
      {
        label: this.currentLevelIndex === levels.length - 1 ? 'Back To Menu' : 'Next Level',
        texture: 'button-primary',
        action: () => {
          if (this.currentLevelIndex === levels.length - 1) {
            this.scene.start('menu');
          } else {
            this.loadLevel(this.currentLevelIndex + 1);
          }
        },
      },
      {
        label: 'Replay',
        texture: 'button-secondary',
        action: () => this.reloadLevel(),
      },
    ]);

    this.playSoundHook('win');
    this.triggerHaptic('success');
  }

  private failLevel(reason: string): void {
    if (this.phase === 'fail' || this.phase === 'win') {
      return;
    }

    this.phase = 'fail';
    this.spawnTimer?.remove(false);
    this.showModal('Conveyor Jam!', reason, 0, [
      {
        label: 'Retry',
        texture: 'button-secondary',
        action: () => this.reloadLevel(),
      },
      {
        label: 'Menu',
        texture: 'button-primary',
        action: () => this.scene.start('menu'),
      },
    ]);

    this.playSoundHook('fail');
    this.triggerHaptic('error');
  }

  private reloadLevel(): void {
    this.loadLevel(this.currentLevelIndex);
  }

  private getOccupiedSlotCount(): number {
    const pathLength = this.perimeterCells.length;
    const occupiedSlots = new Set<number>();

    this.conveyorBalls.forEach((ball) => {
      const slotIndex = ball.lastSlotIndex >= 0
        ? ball.lastSlotIndex
        : Math.floor(ball.progress + 0.5) % pathLength;
      occupiedSlots.add(slotIndex);
    });

    return occupiedSlots.size;
  }

  private isConveyorSlotOpen(slotIndex: number): boolean {
    const pathLength = this.perimeterCells.length;

    return this.conveyorBalls.every((ball) => {
      if (ball.matching) {
        return true;
      }

      const difference = Math.abs(ball.progress - slotIndex);
      const wrappedDifference = Math.min(difference, pathLength - difference);
      return wrappedDifference >= MIN_CONVEYOR_GAP;
    });
  }

  private updateJamState(): void {
    const occupiedSlotCount = this.getOccupiedSlotCount();
    const pathLength = this.perimeterCells.length;

    if (occupiedSlotCount < pathLength) {
      this.fullConveyorAt = undefined;
      return;
    }

    if (this.fullConveyorAt === undefined) {
      this.fullConveyorAt = this.time.now;
      return;
    }

    const lapDurationMs = (pathLength / (this.currentLevel.conveyorSpeed * this.speedMultiplier)) * 1000;
    if (this.time.now - this.fullConveyorAt >= lapDurationMs) {
      this.failLevel('The conveyor stayed full for a full lap without any ball reaching a crate.');
    }
  }

  private toggleSpeed(): void {
    const currentIndex = SPEED_OPTIONS.indexOf(this.speedMultiplier);
    const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % SPEED_OPTIONS.length;
    this.speedMultiplier = SPEED_OPTIONS[nextIndex];
    this.updateSpeedButton();

    if (this.phase === 'play') {
      this.scheduleSpawns();
    }

    this.applySpeedToDropBall();

    this.spawnImpact(270, 906, 0xbfeeff);
    this.playSoundHook('shift');
    this.triggerHaptic('light');
  }

  private applySpeedToDropBall(): void {
    if (!this.dropBall) {
      return;
    }

    this.dropBall.setVelocity(
      this.dropBall.body.velocity.x * Math.min(this.speedMultiplier, 2),
      Math.max(this.dropBall.body.velocity.y, 40) * this.speedMultiplier,
    );
    this.dropBall.setDragX(220 / this.speedMultiplier);
    this.dropBall.setGravityY(250 * (this.speedMultiplier - 1));
  }

  private updateSpeedButton(): void {
    const label = this.speedButton?.getData('label') as Phaser.GameObjects.Text | undefined;
    const speedLabel = Number.isInteger(this.speedMultiplier) ? `${this.speedMultiplier}` : this.speedMultiplier.toFixed(1);
    label?.setText(`Speed ${speedLabel}x`);
  }

  private updateHud(): void {
    this.moveText.setText(`Moves ${this.moveCount}`);
    this.scoreText.setText(`Score ${this.score}`);
  }

  private updateQueuePreview(): void {
    for (let index = 0; index < QUEUE_PREVIEW_COUNT; index += 1) {
      const color = this.currentLevel.queue[this.dropColorQueueIndex + index];
      const ball = this.queuePreviewBalls[index];
      const label = this.queuePreviewLabels[index];

      if (!color) {
        ball.setVisible(false);
        label.setVisible(false);
        continue;
      }

      ball.setVisible(true);
      ball.setTint(COLORS[color].fill);
      label.setVisible(true);
      label.setText(`${index + 1}`);
    }
  }

  private showOnboarding(): void {
    if (!this.currentLevel.onboarding || this.currentLevel.onboarding.length === 0) {
      return;
    }

    this.tipPanel?.destroy();

    const panel = this.add.image(270, 210, 'panel-card').setDisplaySize(360, 112);
    const title = this.add.text(270, 180, 'Quick Tip', {
      fontFamily: 'Trebuchet MS',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#f4fbff',
    }).setOrigin(0.5);
    const body = this.add.text(270, 226, this.currentLevel.onboarding.join('\n'), {
      fontFamily: 'Trebuchet MS',
      fontSize: '16px',
      color: '#cde3f0',
      align: 'center',
      wordWrap: { width: 300 },
    }).setOrigin(0.5);

    this.tipPanel = this.add.container(0, 0, [panel, title, body]);
    this.tipPanel.setDepth(20);
  }

  private dismissOnboarding(): void {
    if (!this.tipPanel) {
      return;
    }

    this.tweens.add({
      targets: this.tipPanel,
      alpha: 0,
      y: -10,
      duration: 180,
      onComplete: () => {
        this.tipPanel?.destroy();
        this.tipPanel = undefined;
      },
    });
  }

  private showModal(
    title: string,
    message: string,
    stars: number,
    buttons: Array<{ label: string; texture: string; action: () => void }>,
  ): void {
    this.modalOverlay.setVisible(true);
    this.modalPanel.setVisible(true);
    this.modalTitle.setText(title);
    this.modalBody.setText(message);

    this.modalStars.forEach((star, index) => {
      star.setTexture(index < stars ? 'star-gold' : 'star-dim');
      star.setVisible(stars > 0);
    });

    this.modalButtons.forEach((button) => button.destroy());
    this.modalButtons = [];

    const spacing = buttons.length === 1 ? 0 : 176;
    buttons.forEach((buttonConfig, index) => {
      const x = buttons.length === 1 ? 0 : -spacing / 2 + index * spacing;
      const button = this.createButton(x + GAME_WIDTH / 2, GAME_HEIGHT / 2 + 86, buttonConfig.label, buttonConfig.texture, buttonConfig.action, true);
      this.modalButtons.push(button);
    });
  }

  private hideModal(): void {
    this.modalOverlay.setVisible(false);
    this.modalPanel.setVisible(false);
    this.modalButtons.forEach((button) => button.destroy());
    this.modalButtons = [];
  }

  private computeStars(): number {
    if (this.moveCount <= this.currentLevel.starThresholds.three) {
      return 3;
    }

    if (this.moveCount <= this.currentLevel.starThresholds.two) {
      return 2;
    }

    return 1;
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    texture: string,
    action: () => void,
    modal = false,
  ): Phaser.GameObjects.Container {
    const image = this.add.image(0, 0, texture).setDisplaySize(BUTTON_WIDTH, BUTTON_HEIGHT);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Trebuchet MS',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#f8fbff',
    }).setOrigin(0.5);
    const button = this.add.container(x, y, [image, text]);
    button.setSize(BUTTON_WIDTH, BUTTON_HEIGHT);
    button.setDepth(30);
    button.setData('label', text);

    const hitArea = this.add.rectangle(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, 0xffffff, 0.001);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.setDepth(31);

    hitArea.on('pointerover', () => button.setScale(1.03));
    hitArea.on('pointerout', () => button.setScale(1));
    hitArea.on('pointerdown', () => button.setScale(0.98));
    hitArea.on('pointerup', () => {
      button.setScale(1.03);
      if (modal) {
        this.hideModal();
      }
      action();
    });
    hitArea.on('pointerupoutside', () => button.setScale(1));
    button.once(Phaser.GameObjects.Events.DESTROY, () => hitArea.destroy());

    return button;
  }

  private samplePath(progress: number): Phaser.Math.Vector2 {
    const pathLength = this.conveyorPoints.length;
    const wrapped = ((progress % pathLength) + pathLength) % pathLength;
    const fromIndex = Math.floor(wrapped);
    const toIndex = (fromIndex + 1) % pathLength;
    const t = wrapped - fromIndex;
    const from = this.conveyorPoints[fromIndex];
    const to = this.conveyorPoints[toIndex];

    return new Phaser.Math.Vector2(
      Phaser.Math.Linear(from.x, to.x, t),
      Phaser.Math.Linear(from.y, to.y, t),
    );
  }

  private updateBeltMarkers(time: number): void {
    const pathLength = this.perimeterCells.length;
    this.beltMarkers.forEach((marker, index) => {
      const progress = (time * 0.0018 * this.currentLevel.conveyorSpeed * this.speedMultiplier + index * 0.6) % pathLength;
      const point = this.samplePath(progress);
      marker.setPosition(point.x, point.y);
      marker.setAlpha(0.24 + ((index + Math.floor(time / 120)) % 3) * 0.12);
    });
  }

  private getCellCenter(row: number, col: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      BOARD_ORIGIN.x + col * CELL_SIZE + CELL_SIZE / 2,
      BOARD_ORIGIN.y + row * CELL_SIZE + CELL_SIZE / 2,
    );
  }

  private getPieceCells(
    piece: Array<Pick<PieceCell, 'row' | 'col'>> | Pick<PieceView, 'cells'> | PieceDefinition | PieceView,
  ): Array<Pick<PieceCell, 'row' | 'col'>> {
    return Array.isArray(piece) ? piece : piece.cells;
  }

  private getPieceCenter(
    piece: Array<Pick<PieceCell, 'row' | 'col'>> | Pick<PieceView, 'cells'> | PieceDefinition | PieceView,
  ): Phaser.Math.Vector2 {
    const bounds = this.getPieceBounds(this.getPieceCells(piece));
    return new Phaser.Math.Vector2(
      BOARD_ORIGIN.x + bounds.minCol * CELL_SIZE + ((bounds.maxCol - bounds.minCol + 1) * CELL_SIZE) / 2,
      BOARD_ORIGIN.y + bounds.minRow * CELL_SIZE + ((bounds.maxRow - bounds.minRow + 1) * CELL_SIZE) / 2,
    );
  }

  private getPiecePixelSize(
    piece: Array<Pick<PieceCell, 'row' | 'col'>> | Pick<PieceView, 'cells'> | PieceDefinition | PieceView,
  ): { width: number; height: number } {
    const bounds = this.getPieceBounds(this.getPieceCells(piece));
    return {
      width: (bounds.maxCol - bounds.minCol + 1) * CELL_SIZE - 8,
      height: (bounds.maxRow - bounds.minRow + 1) * CELL_SIZE - 8,
    };
  }

  private getPieceBounds(cells: Array<Pick<PieceCell, 'row' | 'col'>>): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
    return {
      minRow: Math.min(...cells.map((cell) => cell.row)),
      maxRow: Math.max(...cells.map((cell) => cell.row)),
      minCol: Math.min(...cells.map((cell) => cell.col)),
      maxCol: Math.max(...cells.map((cell) => cell.col)),
    };
  }

  private getLocalCellRect(
    cell: Pick<PieceCell, 'row' | 'col'>,
    bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number },
  ): { x: number; y: number; width: number; height: number } {
    const width = CELL_SIZE - 8;
    const height = CELL_SIZE - 8;
    const totalWidth = (bounds.maxCol - bounds.minCol + 1) * CELL_SIZE - 8;
    const totalHeight = (bounds.maxRow - bounds.minRow + 1) * CELL_SIZE - 8;
    return {
      x: -totalWidth / 2 + (cell.col - bounds.minCol) * CELL_SIZE,
      y: -totalHeight / 2 + (cell.row - bounds.minRow) * CELL_SIZE,
      width,
      height,
    };
  }

  private writePieceToGrid(piece: Pick<PieceView, 'id' | 'cells'>): void {
    piece.cells.forEach((cell) => {
      this.pieceGrid[cell.row][cell.col] = piece.id;
    });
  }

  private clearPieceFromGrid(piece: Pick<PieceView, 'cells'>): void {
    piece.cells.forEach((cell) => {
      this.pieceGrid[cell.row][cell.col] = null;
    });
  }

  private translateCell(cell: PieceCell, direction: ShiftDirection): PieceCell {
    if (direction === 'left') {
      return { ...cell, col: cell.col - 1 };
    }

    if (direction === 'right') {
      return { ...cell, col: cell.col + 1 };
    }

    if (direction === 'up') {
      return { ...cell, row: cell.row - 1 };
    }

    return { ...cell, row: cell.row + 1 };
  }

  private canMovePiece(piece: PieceView, direction: ShiftDirection): boolean {
    return piece.cells.every((cell) => {
      const next = this.translateCell(cell, direction);
      if (next.row < 0 || next.col < 0 || next.row >= GRID_ROWS || next.col >= GRID_COLS) {
        return false;
      }

      const occupant = this.pieceGrid[next.row][next.col];
      return occupant === null || occupant === piece.id;
    });
  }

  private findMatchingPerimeterCell(piece: PieceView, color: ColorKey): PieceCell | null {
    for (const cell of piece.cells) {
      const isPerimeter = this.perimeterCells.some((slot) => slot.row === cell.row && slot.col === cell.col);
      if (isPerimeter && cell.color === color) {
        return cell;
      }
    }

    return null;
  }

  private rebuildSplitPieces(piece: PieceView, removedCell: PieceCell): void {
    const remaining = piece.cells.filter((cell) => !(cell.row === removedCell.row && cell.col === removedCell.col));
    const components = this.getConnectedComponents(remaining);

    components.forEach((cells, index) => {
      const nextPiece: PieceDefinition = {
        id: `${piece.id}-split-${index}-${this.time.now}`,
        cells,
      };
      const view = this.createPieceView(nextPiece);
      this.pieces.set(nextPiece.id, view);
      this.writePieceToGrid(view);
    });
  }

  private getConnectedComponents(cells: PieceCell[]): PieceCell[][] {
    const visited = new Set<string>();
    const byKey = new Map(cells.map((cell) => [`${cell.row}:${cell.col}`, cell]));
    const components: PieceCell[][] = [];

    cells.forEach((cell) => {
      const key = `${cell.row}:${cell.col}`;
      if (visited.has(key)) {
        return;
      }

      const queue = [cell];
      const component: PieceCell[] = [];
      visited.add(key);

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);

        const neighbors = [
          { row: current.row - 1, col: current.col },
          { row: current.row + 1, col: current.col },
          { row: current.row, col: current.col - 1 },
          { row: current.row, col: current.col + 1 },
        ];

        neighbors.forEach((neighbor) => {
          const neighborKey = `${neighbor.row}:${neighbor.col}`;
          if (visited.has(neighborKey)) {
            return;
          }

          const found = byKey.get(neighborKey);
          if (found) {
            visited.add(neighborKey);
            queue.push(found);
          }
        });
      }

      components.push(component);
    });

    return components;
  }

  private getConveyorPoint(position: GridPosition): Phaser.Math.Vector2 {
    const left = BOARD_ORIGIN.x - CONVEYOR_OFFSET;
    const right = BOARD_ORIGIN.x + BOARD_SIZE + CONVEYOR_OFFSET;
    const top = BOARD_ORIGIN.y - CONVEYOR_OFFSET;
    const bottom = BOARD_ORIGIN.y + BOARD_SIZE + CONVEYOR_OFFSET;

    if (position.row === 0) {
      return new Phaser.Math.Vector2(
        Phaser.Math.Linear(left, right, position.col / (GRID_COLS - 1)),
        top,
      );
    }

    if (position.col === GRID_COLS - 1) {
      return new Phaser.Math.Vector2(
        right,
        Phaser.Math.Linear(top, bottom, position.row / (GRID_ROWS - 1)),
      );
    }

    if (position.row === GRID_ROWS - 1) {
      return new Phaser.Math.Vector2(
        Phaser.Math.Linear(left, right, position.col / (GRID_COLS - 1)),
        bottom,
      );
    }

    return new Phaser.Math.Vector2(
      left,
      Phaser.Math.Linear(top, bottom, position.row / (GRID_ROWS - 1)),
    );
  }

  private spawnImpact(x: number, y: number, color: number): void {
    const ring = this.add.circle(x, y, 10, color, 0.22);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      scaleX: 2.3,
      scaleY: 2.3,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
  }

  private spawnClearEffect(x: number, y: number, color: ColorKey, chain: number): void {
    const tint = COLORS[color].glow;
    this.spawnImpact(x, y, tint);

    for (let index = 0; index < 6; index += 1) {
      const spark = this.add.image(x, y, 'spark').setTint(tint).setDepth(10);
      spark.setScale(0.7 + Math.random() * 0.3);
      spark.rotation = Math.random() * Math.PI;
      const angle = (Math.PI * 2 * index) / 6 + Math.random() * 0.4;
      const distance = 34 + Math.random() * 12;

      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 260,
        ease: 'quad.out',
        onComplete: () => spark.destroy(),
      });
    }

    if (chain > 1) {
      const text = this.add.text(x, y - 24, `x${chain}`, {
        fontFamily: 'Trebuchet MS',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#fff4cb',
        stroke: '#8d6730',
        strokeThickness: 6,
      }).setOrigin(0.5);

      this.tweens.add({
        targets: text,
        y: y - 62,
        alpha: 0,
        duration: 460,
        onComplete: () => text.destroy(),
      });
    }
  }

  private updateDropBallVisual(): void {
    if (!this.dropBall || !this.dropBallColor) {
      return;
    }

    this.dropBall.setTint(COLORS[this.dropBallColor].fill);
  }

  private ensureDropBallResolves(): void {
    if (!this.dropBall || !this.dropBallColor) {
      return;
    }

    const velocityY = this.dropBall.body.velocity.y;
    const reachedFunnelFloor = this.dropBall.y >= FUNNEL_FLOOR_Y - 6 && velocityY >= 0;
    const escapedBounds =
      this.dropBall.y > GAME_HEIGHT + 24 ||
      this.dropBall.x < -24 ||
      this.dropBall.x > GAME_WIDTH + 24;

    if (reachedFunnelFloor || escapedBounds) {
      this.landDropBall();
    }
  }

  private triggerHaptic(kind: 'light' | 'success' | 'error'): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return;
    }

    if (kind === 'light') {
      navigator.vibrate(12);
      return;
    }

    if (kind === 'success') {
      navigator.vibrate([16, 24, 16]);
      return;
    }

    navigator.vibrate([18, 30, 18, 30, 18]);
  }

  private playSoundHook(_cue: 'drop' | 'shift' | 'invalid' | 'match' | 'chain' | 'win' | 'fail'): void {
    // Placeholder hook for future audio integration.
  }
}
