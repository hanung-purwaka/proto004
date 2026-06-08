import { type ColorKey, type GridCell, type GridState, cloneGrid } from '../data/levels';

export type ShiftDirection = 'left' | 'right' | 'up' | 'down';

export interface GridPosition {
  row: number;
  col: number;
}

export interface ShiftResult {
  moved: boolean;
  grid: GridState;
  moves: Array<{ from: GridPosition; to: GridPosition }>;
}

export const isOuterCell = (rows: number, cols: number, row: number, col: number): boolean =>
  row === 0 || col === 0 || row === rows - 1 || col === cols - 1;

export const countCrates = (grid: GridState): number =>
  grid.reduce((sum, row) => sum + row.filter((cell) => cell !== null).length, 0);

export const getPerimeterOrder = (rows: number, cols: number): GridPosition[] => {
  const order: GridPosition[] = [];

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

export const shiftRow = (grid: GridState, rowIndex: number, direction: 'left' | 'right'): ShiftResult => {
  const next = cloneGrid(grid);
  const moves: Array<{ from: GridPosition; to: GridPosition }> = [];
  const width = grid[0].length;
  const row = grid[rowIndex];

  if (direction === 'right') {
    for (let col = width - 2; col >= 0; col -= 1) {
      const crate = row[col];
      if (crate !== null && row[col + 1] === null) {
        next[rowIndex][col] = null;
        next[rowIndex][col + 1] = crate;
        moves.push({ from: { row: rowIndex, col }, to: { row: rowIndex, col: col + 1 } });
      }
    }
  } else {
    for (let col = 1; col < width; col += 1) {
      const crate = row[col];
      if (crate !== null && row[col - 1] === null) {
        next[rowIndex][col] = null;
        next[rowIndex][col - 1] = crate;
        moves.push({ from: { row: rowIndex, col }, to: { row: rowIndex, col: col - 1 } });
      }
    }
  }

  return {
    moved: moves.length > 0,
    grid: next,
    moves,
  };
};

export const shiftColumn = (grid: GridState, colIndex: number, direction: 'up' | 'down'): ShiftResult => {
  const next = cloneGrid(grid);
  const moves: Array<{ from: GridPosition; to: GridPosition }> = [];
  const height = grid.length;

  if (direction === 'down') {
    for (let row = height - 2; row >= 0; row -= 1) {
      const crate = grid[row][colIndex];
      if (crate !== null && grid[row + 1][colIndex] === null) {
        next[row][colIndex] = null;
        next[row + 1][colIndex] = crate;
        moves.push({ from: { row, col: colIndex }, to: { row: row + 1, col: colIndex } });
      }
    }
  } else {
    for (let row = 1; row < height; row += 1) {
      const crate = grid[row][colIndex];
      if (crate !== null && grid[row - 1][colIndex] === null) {
        next[row][colIndex] = null;
        next[row - 1][colIndex] = crate;
        moves.push({ from: { row, col: colIndex }, to: { row: row - 1, col: colIndex } });
      }
    }
  }

  return {
    moved: moves.length > 0,
    grid: next,
    moves,
  };
};

export const moveCrate = (
  grid: GridState,
  row: number,
  col: number,
  direction: ShiftDirection,
): ShiftResult => {
  const crate = getGridCell(grid, row, col);
  if (crate === null) {
    return { moved: false, grid: cloneGrid(grid), moves: [] };
  }

  const target =
    direction === 'left'
      ? { row, col: col - 1 }
      : direction === 'right'
        ? { row, col: col + 1 }
        : direction === 'up'
          ? { row: row - 1, col }
          : { row: row + 1, col };

  if (getGridCell(grid, target.row, target.col) !== null) {
    return { moved: false, grid: cloneGrid(grid), moves: [] };
  }

  const next = cloneGrid(grid);
  next[row][col] = null;
  next[target.row][target.col] = crate;

  return {
    moved: true,
    grid: next,
    moves: [{ from: { row, col }, to: target }],
  };
};

export const getGridCell = (grid: GridState, row: number, col: number): GridCell => {
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) {
    return null;
  }

  return grid[row][col];
};

export const findFirstAccessibleColor = (
  grid: GridState,
  orderedCells: GridPosition[],
  color: ColorKey,
): GridPosition | null => {
  for (const position of orderedCells) {
    if (grid[position.row][position.col] === color) {
      return position;
    }
  }

  return null;
};
