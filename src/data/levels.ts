export type ColorKey = 'coral' | 'cyan' | 'gold' | 'mint' | 'plum' | 'orange' | 'indigo' | 'lime';
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
  pieces: PieceDefinition[];
  queue: ColorKey[];
  conveyorSpeed: number;
  spawnIntervalMs: number;
  maxLoopsPerBall: number;
  maxActiveBalls: number;
  starThresholds: StarThresholds;
  onboarding?: string[];
}

export interface PieceDefinition {
  id: string;
  cells: Array<{ row: number; col: number; color: ColorKey }>;
}

export interface ColorDefinition {
  key: ColorKey;
  label: string;
  fill: number;
  dark: number;
  glow: number;
  light: number;
}

export const COLOR_ORDER: ColorKey[] = ['coral', 'cyan', 'gold', 'mint', 'plum', 'orange', 'indigo', 'lime'];

export const COLORS: Record<ColorKey, ColorDefinition> = {
  coral: { key: 'coral', label: 'Coral', fill: 0xff5f6d, dark: 0xd93a48, glow: 0xffb7bf, light: 0xffeef0 },
  cyan: { key: 'cyan', label: 'Cyan', fill: 0x28d7ff, dark: 0x0a8fca, glow: 0x9df2ff, light: 0xe9fdff },
  gold: { key: 'gold', label: 'Gold', fill: 0xffc83d, dark: 0xd28d00, glow: 0xffe89b, light: 0xfff8df },
  mint: { key: 'mint', label: 'Mint', fill: 0x35e59b, dark: 0x129c63, glow: 0xa9ffd8, light: 0xecfff7 },
  plum: { key: 'plum', label: 'Plum', fill: 0xc965ff, dark: 0x8b28d1, glow: 0xe9b6ff, light: 0xfbebff },
  orange: { key: 'orange', label: 'Orange', fill: 0xff8f1f, dark: 0xcc5b00, glow: 0xffc382, light: 0xfff0df },
  indigo: { key: 'indigo', label: 'Indigo', fill: 0x6172ff, dark: 0x3240c5, glow: 0xc2cbff, light: 0xf0f3ff },
  lime: { key: 'lime', label: 'Lime', fill: 0xb8f133, dark: 0x6fa700, glow: 0xe1ff9d, light: 0xf9ffe6 },
};

export const GRID_ROWS = 8;
export const GRID_COLS = 8;
export const LEVEL_STORAGE_KEY = 'conveyor-color-puzzle-level';

interface MergeRect {
  row: number;
  col: number;
  width: number;
  height: number;
}

const SYMBOL_TO_COLOR: Record<string, ColorKey> = {
  R: 'coral',
  B: 'cyan',
  Y: 'gold',
  G: 'mint',
  P: 'plum',
  O: 'orange',
  I: 'indigo',
  L: 'lime',
};

const BASE_SYMBOL_ORDER = ['R', 'B', 'Y', 'G', 'P'] as const;

const parseCell = (cell: string): GridCell => SYMBOL_TO_COLOR[cell] ?? null;

const makeGrid = (rows: string[]): GridState =>
  rows.map((row) => row.split('').map((cell) => parseCell(cell)));

const makePieceGrid = (pieces: PieceDefinition[]): Array<Array<string | null>> => {
  const pieceGrid = Array.from({ length: GRID_ROWS }, () => Array<string | null>(GRID_COLS).fill(null));

  pieces.forEach((piece) => {
    piece.cells.forEach(({ row, col }) => {
        pieceGrid[row][col] = piece.id;
    });
  });

  return pieceGrid;
};

const getPerimeterOrder = (rows: number, cols: number): Array<{ row: number; col: number }> => {
  const order: Array<{ row: number; col: number }> = [];

  for (let col = 0; col < cols; col += 1) {
    order.push({ row: 0, col });
  }

  for (let row = 1; row < rows; row += 1) {
    order.push({ row, col: cols - 1 });
  }

  for (let col = cols - 2; col >= 0; col -= 1) {
    order.push({ row: rows - 1, col });
  }

  for (let row = rows - 2; row >= 1; row -= 1) {
    order.push({ row, col: 0 });
  }

  return order;
};

const getConnectedComponents = (
  cells: Array<{ row: number; col: number; color: ColorKey }>,
): Array<Array<{ row: number; col: number; color: ColorKey }>> => {
  const visited = new Set<string>();
  const byKey = new Map(cells.map((cell) => [`${cell.row}:${cell.col}`, cell]));
  const components: Array<Array<{ row: number; col: number; color: ColorKey }>> = [];

  cells.forEach((cell) => {
    const key = `${cell.row}:${cell.col}`;
    if (visited.has(key)) {
      return;
    }

    const queue = [cell];
    const component: Array<{ row: number; col: number; color: ColorKey }> = [];
    visited.add(key);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      [
        { row: current.row - 1, col: current.col },
        { row: current.row + 1, col: current.col },
        { row: current.row, col: current.col - 1 },
        { row: current.row, col: current.col + 1 },
      ].forEach((neighbor) => {
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
};

const makePlayableQueue = (grid: GridState, pieces: PieceDefinition[]): ColorKey[] => {
  const queue: ColorKey[] = [];
  const board = grid.map((row) => [...row]);
  let activePieces = pieces.map((piece) => ({
    id: piece.id,
    cells: piece.cells.map((cell) => ({ ...cell })),
  }));
  let splitCounter = 0;
  const perimeter = getPerimeterOrder(grid.length, grid[0].length);

  while (activePieces.length > 0) {
    const pieceGrid = makePieceGrid(activePieces);
    let matched = false;

    for (const slot of perimeter) {
      const color = board[slot.row][slot.col];
      if (color === null) {
        continue;
      }

      const pieceId = pieceGrid[slot.row][slot.col];
      if (!pieceId) {
        continue;
      }

      const pieceIndex = activePieces.findIndex((piece) => piece.id === pieceId);
      if (pieceIndex === -1) {
        continue;
      }

      const piece = activePieces[pieceIndex];
      const removedCell = piece.cells.find((cell) => cell.row === slot.row && cell.col === slot.col);
      if (!removedCell) {
        continue;
      }

      queue.push(removedCell.color);
      board[slot.row][slot.col] = null;

      const remaining = piece.cells.filter((cell) => !(cell.row === removedCell.row && cell.col === removedCell.col));
      activePieces.splice(pieceIndex, 1);

      getConnectedComponents(remaining).forEach((component) => {
        activePieces.push({
          id: `${piece.id}-split-${splitCounter += 1}`,
          cells: component,
        });
      });

      matched = true;
      break;
    }

    if (!matched) {
      throw new Error('Unable to generate a playable queue from the current piece layout.');
    }
  }

  return queue;
};

const countPieceColors = (pieces: PieceDefinition[]): Record<ColorKey, number> => {
  return countColors(pieces.flatMap((piece) => piece.cells.map((cell) => cell.color)));
};

const countColors = (cells: Array<ColorKey | null>): Record<ColorKey, number> => {
  const counts = Object.fromEntries(COLOR_ORDER.map((color) => [color, 0])) as Record<ColorKey, number>;

  cells.forEach((cell) => {
    if (cell !== null) {
      counts[cell] += 1;
    }
  });

  return counts;
};

const validatePiecesAndQueue = (pieces: PieceDefinition[], queue: ColorKey[]): void => {
  const pieceCounts = countPieceColors(pieces);
  const queueCounts = countColors(queue);

  const mismatch = COLOR_ORDER.some((color) => pieceCounts[color] !== queueCounts[color]);
  if (mismatch || queue.length !== pieces.flatMap((piece) => piece.cells).length) {
    throw new Error('Level queue must match piece counts exactly.');
  }
};

const expandPaletteRows = (rows: string[], paletteSeed: number): string[] =>
  rows.map((row, rowIndex) =>
    row
      .split('')
      .map((cell, colIndex) => {
        if (cell === '.') {
          return cell;
        }

        const baseIndex = BASE_SYMBOL_ORDER.indexOf(cell as (typeof BASE_SYMBOL_ORDER)[number]);
        if (baseIndex === -1) {
          return cell;
        }

        const shift = (paletteSeed + rowIndex * 2 + colIndex * 3 + rowIndex * colIndex) % BASE_SYMBOL_ORDER.length;
        return BASE_SYMBOL_ORDER[(baseIndex + shift) % BASE_SYMBOL_ORDER.length];
      })
      .join(''),
  );

const makePieces = (grid: GridState, mergeRects: MergeRect[]): PieceDefinition[] => {
  const claimed = Array.from({ length: GRID_ROWS }, () => Array<boolean>(GRID_COLS).fill(false));
  const pieces: PieceDefinition[] = [];
  let pieceIndex = 0;

  mergeRects
    .slice()
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .forEach((rect) => {
      if (grid[rect.row]?.[rect.col] === null || grid[rect.row]?.[rect.col] === undefined) {
        return;
      }

      const cells: Array<{ row: number; col: number; color: ColorKey }> = [];

      for (let row = rect.row; row < rect.row + rect.height; row += 1) {
        for (let col = rect.col; col < rect.col + rect.width; col += 1) {
          const color = grid[row]?.[col];
          if (row >= GRID_ROWS || col >= GRID_COLS || color === null || color === undefined || claimed[row][col]) {
            return;
          }

          cells.push({ row, col, color });
        }
      }

      cells.forEach(({ row, col }) => {
        claimed[row][col] = true;
      });

      pieces.push({
        id: `piece-${pieceIndex += 1}`,
        cells,
      });
    });

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const color = grid[row][col];
      if (color === null || claimed[row][col]) {
        continue;
      }

      claimed[row][col] = true;
      pieces.push({
        id: `piece-${pieceIndex += 1}`,
        cells: [{ row, col, color }],
      });
    }
  }

  return pieces;
};

const createLayout = (rows: string[], paletteSeed: number, mergeRects: MergeRect[]) => {
  const expandedRows = expandPaletteRows(rows, paletteSeed);
  const board = makeGrid(expandedRows);
  const pieces = makePieces(board, mergeRects);
  const queue = makePlayableQueue(board, pieces);

  validatePiecesAndQueue(pieces, queue);

  return {
    board,
    pieces,
    queue,
  };
};

const LEVEL_MERGES: MergeRect[][] = [
  [
    { row: 0, col: 0, width: 1, height: 2 },
    { row: 1, col: 3, width: 2, height: 2 },
    { row: 4, col: 5, width: 1, height: 3 },
  ],
  [
    { row: 0, col: 5, width: 1, height: 3 },
    { row: 2, col: 1, width: 2, height: 2 },
    { row: 5, col: 4, width: 3, height: 1 },
  ],
  [
    { row: 0, col: 2, width: 3, height: 1 },
    { row: 2, col: 5, width: 2, height: 2 },
    { row: 5, col: 0, width: 1, height: 3 },
  ],
  [
    { row: 1, col: 1, width: 2, height: 2 },
    { row: 0, col: 5, width: 3, height: 1 },
    { row: 4, col: 3, width: 1, height: 3 },
  ],
  [
    { row: 0, col: 0, width: 3, height: 3 },
    { row: 4, col: 5, width: 2, height: 2 },
    { row: 6, col: 2, width: 3, height: 1 },
  ],
  [
    { row: 0, col: 6, width: 1, height: 2 },
    { row: 2, col: 2, width: 2, height: 2 },
    { row: 5, col: 4, width: 1, height: 3 },
  ],
  [
    { row: 1, col: 0, width: 3, height: 1 },
    { row: 3, col: 4, width: 2, height: 2 },
    { row: 5, col: 1, width: 1, height: 3 },
  ],
  [
    { row: 0, col: 4, width: 1, height: 3 },
    { row: 3, col: 0, width: 2, height: 2 },
    { row: 5, col: 4, width: 3, height: 1 },
  ],
  [
    { row: 0, col: 1, width: 2, height: 2 },
    { row: 2, col: 5, width: 1, height: 3 },
    { row: 6, col: 3, width: 2, height: 2 },
  ],
  [
    { row: 0, col: 0, width: 3, height: 1 },
    { row: 2, col: 2, width: 2, height: 2 },
    { row: 4, col: 4, width: 3, height: 3 },
  ],
];

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
    ], 1, LEVEL_MERGES[0]),
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
    ], 2, LEVEL_MERGES[1]),
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
    ], 3, LEVEL_MERGES[2]),
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
    ], 4, LEVEL_MERGES[3]),
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
    ], 5, LEVEL_MERGES[4]),
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
    ], 6, LEVEL_MERGES[5]),
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
    ], 7, LEVEL_MERGES[6]),
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
    ], 8, LEVEL_MERGES[7]),
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
    ], 9, LEVEL_MERGES[8]),
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
    ], 10, LEVEL_MERGES[9]),
    conveyorSpeed: 2.8,
    spawnIntervalMs: 1550,
    maxLoopsPerBall: 7,
    maxActiveBalls: 15,
    starThresholds: { three: 12, two: 18 },
  },
];

export const clampLevelIndex = (index: number): number =>
  Number.isFinite(index)
    ? Math.max(0, Math.min(levels.length - 1, Math.floor(index)))
    : 0;

export const cloneGrid = (grid: GridState): GridState => grid.map((row) => [...row]);
