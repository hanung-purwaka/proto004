export type ColorKey = 'coral' | 'cyan' | 'gold' | 'mint' | 'plum';
export type GridCell = ColorKey | null;
export type GridState = GridCell[][];

export interface StarThresholds {
  three: number;
  two: number;
}

export interface LevelDefinition {
  id: number;
  name: string;
  board: GridState;
  queue: ColorKey[];
  conveyorSpeed: number;
  spawnIntervalMs: number;
  maxLoopsPerBall: number;
  maxActiveBalls: number;
  starThresholds: StarThresholds;
  onboarding?: string[];
}

export interface ColorDefinition {
  key: ColorKey;
  label: string;
  fill: number;
  dark: number;
  glow: number;
  light: number;
}

export const COLOR_ORDER: ColorKey[] = ['coral', 'cyan', 'gold', 'mint', 'plum'];

export const COLORS: Record<ColorKey, ColorDefinition> = {
  coral: { key: 'coral', label: 'Coral', fill: 0xf26b62, dark: 0xc84b45, glow: 0xffb0aa, light: 0xffece7 },
  cyan: { key: 'cyan', label: 'Cyan', fill: 0x5bcdf9, dark: 0x2d86ca, glow: 0xa6eaff, light: 0xeefcff },
  gold: { key: 'gold', label: 'Gold', fill: 0xf6c452, dark: 0xc18f1f, glow: 0xffe5a0, light: 0xfff7df },
  mint: { key: 'mint', label: 'Mint', fill: 0x61d7a2, dark: 0x2b9f69, glow: 0xb7f5d8, light: 0xedfff5 },
  plum: { key: 'plum', label: 'Plum', fill: 0xb776f5, dark: 0x7f44c9, glow: 0xe0c0ff, light: 0xf7efff },
};

export const GRID_ROWS = 8;
export const GRID_COLS = 8;
export const LEVEL_STORAGE_KEY = 'conveyor-color-puzzle-level';

const parseCell = (cell: string): GridCell => {
  if (cell === '.') {
    return null;
  }

  if (cell === 'R') {
    return 'coral';
  }

  if (cell === 'B') {
    return 'cyan';
  }

  if (cell === 'Y') {
    return 'gold';
  }

  if (cell === 'G') {
    return 'mint';
  }

  if (cell === 'P') {
    return 'plum';
  }

  return null;
};

const makeGrid = (rows: string[]): GridState =>
  rows.map((row) => row.split('').map((cell) => parseCell(cell)));

const makeLayerQueue = (rows: string[]): ColorKey[] => {
  const chars = rows.map((row) => row.split(''));
  const queue: ColorKey[] = [];

  const collectLayer = (top: number, left: number, bottom: number, right: number): void => {
    if (top > bottom || left > right) {
      return;
    }

    for (let col = left; col <= right; col += 1) {
      const cell = parseCell(chars[top][col]);
      if (cell !== null) {
        queue.push(cell);
      }
    }

    for (let row = top + 1; row <= bottom; row += 1) {
      const cell = parseCell(chars[row][right]);
      if (cell !== null) {
        queue.push(cell);
      }
    }

    if (bottom > top) {
      for (let col = right - 1; col >= left; col -= 1) {
        const cell = parseCell(chars[bottom][col]);
        if (cell !== null) {
          queue.push(cell);
        }
      }
    }

    if (right > left) {
      for (let row = bottom - 1; row > top; row -= 1) {
        const cell = parseCell(chars[row][left]);
        if (cell !== null) {
          queue.push(cell);
        }
      }
    }

    collectLayer(top + 1, left + 1, bottom - 1, right - 1);
  };

  collectLayer(0, 0, rows.length - 1, rows[0].length - 1);

  return queue;
};

const createLayout = (rows: string[]) => ({
  board: makeGrid(rows),
  queue: makeLayerQueue(rows),
});

export const levels: LevelDefinition[] = [
  {
    id: 1,
    name: 'First Catch',
    ...createLayout([
      'RBYGPRBY',
      'BYGPRBYG',
      'YGPRBYGP',
      'GPRBYGPR',
      'PRBYGPRB',
      'RBYGPRBY',
      'BYGPRBYG',
      'YGPRBYGP',
    ]),
    conveyorSpeed: 2.05,
    spawnIntervalMs: 2200,
    maxLoopsPerBall: 6,
    maxActiveBalls: 12,
    starThresholds: { three: 2, two: 5 },
    onboarding: ['Watch the queue.', 'Swipe a crate toward an empty neighboring slot.'],
  },
  {
    id: 2,
    name: 'Color Corners',
    ...createLayout([
      'RPRBYGPR',
      'BYGYPRBY',
      'GPRBYGPR',
      'YPRBYGYP',
      'RBYGPRBY',
      'GYPRBYGP',
      'PRBYGYPR',
      'BYGPRBYG',
    ]),
    conveyorSpeed: 2.15,
    spawnIntervalMs: 2100,
    maxLoopsPerBall: 6,
    maxActiveBalls: 12,
    starThresholds: { three: 3, two: 7 },
    onboarding: ['Only outer-edge crates are targetable.', 'Plan the next color while the conveyor keeps moving.'],
  },
  {
    id: 3,
    name: 'Open The Lane',
    ...createLayout([
      'RBYGPRBY',
      'YGPRBYGP',
      'PRBYGPRB',
      'BYGPRBYG',
      'GPRBYGPR',
      'RBYGPRBY',
      'YGPRBYGP',
      'PRBYGPRB',
    ]),
    conveyorSpeed: 2.15,
    spawnIntervalMs: 2100,
    maxLoopsPerBall: 6,
    maxActiveBalls: 12,
    starThresholds: { three: 4, two: 8 },
    onboarding: ['Swipe a crate, not the whole row.', 'Your first clears create the gaps you can work with.'],
  },
  {
    id: 4,
    name: 'Fast Feed',
    ...createLayout([
      'RPGYBRPG',
      'BYRGPBYR',
      'GYBPRGYB',
      'PRGBYPRG',
      'YBGRPYBG',
      'RPGYBRPG',
      'BYRGPBYR',
      'GYBPRGYB',
    ]),
    conveyorSpeed: 2.35,
    spawnIntervalMs: 1800,
    maxLoopsPerBall: 6,
    maxActiveBalls: 13,
    starThresholds: { three: 5, two: 10 },
  },
  {
    id: 5,
    name: 'Three-Color Ring',
    ...createLayout([
      'YPRBGYPR',
      'BRGYPRBG',
      'GPYRGBPY',
      'YGRPBYGR',
      'PBGYRPBG',
      'RGYPBRGY',
      'YPRBGYPR',
      'BRGYPRBG',
    ]),
    conveyorSpeed: 2.25,
    spawnIntervalMs: 1900,
    maxLoopsPerBall: 6,
    maxActiveBalls: 13,
    starThresholds: { three: 6, two: 11 },
  },
  {
    id: 6,
    name: 'Pocket Setup',
    ...createLayout([
      'RGBYPRGB',
      'BYGPRBYG',
      'GPRYGGPR',
      'PRGYBPRG',
      'YPBRGYPB',
      'RGBYPRGB',
      'BYGPRBYG',
      'GPRYGGPR',
    ]),
    conveyorSpeed: 2.3,
    spawnIntervalMs: 1900,
    maxLoopsPerBall: 6,
    maxActiveBalls: 13,
    starThresholds: { three: 7, two: 12 },
  },
  {
    id: 7,
    name: 'Tight Sequence',
    ...createLayout([
      'RPGYBRPG',
      'GYBRPGYB',
      'BYPGYBYP',
      'PRYGBPRY',
      'YBGPRYBG',
      'RPGYBRPG',
      'GYBRPGYB',
      'BYPGYBYP',
    ]),
    conveyorSpeed: 2.45,
    spawnIntervalMs: 1750,
    maxLoopsPerBall: 6,
    maxActiveBalls: 14,
    starThresholds: { three: 8, two: 13 },
  },
  {
    id: 8,
    name: 'Slide The Void',
    ...createLayout([
      'GPYRBGPY',
      'RBGYPRBG',
      'YPRGBYPR',
      'BGPRYBGP',
      'PRYBGPRY',
      'GPYRBGPY',
      'RBGYPRBG',
      'YPRGBYPR',
    ]),
    conveyorSpeed: 2.55,
    spawnIntervalMs: 1750,
    maxLoopsPerBall: 7,
    maxActiveBalls: 14,
    starThresholds: { three: 9, two: 14 },
  },
  {
    id: 9,
    name: 'Chain Window',
    ...createLayout([
      'RPGYBRPG',
      'BYPRGBYP',
      'GPYRBGPY',
      'RBGPYRBG',
      'YGRBPYGR',
      'PRGYBPRG',
      'BYPRGBYP',
      'GPYRBGPY',
    ]),
    conveyorSpeed: 2.65,
    spawnIntervalMs: 1650,
    maxLoopsPerBall: 7,
    maxActiveBalls: 15,
    starThresholds: { three: 10, two: 15 },
  },
  {
    id: 10,
    name: 'Showcase Circuit',
    ...createLayout([
      'RPGYBRPG',
      'YBGPRYBG',
      'GRPBYGRP',
      'PYRGBPYR',
      'BGRYPBGR',
      'RPGYBRPG',
      'YBGPRYBG',
      'GRPBYGRP',
    ]),
    conveyorSpeed: 2.8,
    spawnIntervalMs: 1550,
    maxLoopsPerBall: 7,
    maxActiveBalls: 15,
    starThresholds: { three: 12, two: 18 },
  },
];

export const clampLevelIndex = (index: number): number =>
  Math.max(0, Math.min(levels.length - 1, Math.floor(index)));

export const cloneGrid = (grid: GridState): GridState => grid.map((row) => [...row]);
