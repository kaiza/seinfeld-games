/**
 * Procedural maze generator for the parking garage.
 * Uses recursive backtracker (depth-first) to carve a maze,
 * then places special tiles: stairs, bathrooms, AC unit, car, guard spawns.
 *
 * Grid cell values:
 *   0 = wall
 *   1 = floor
 *   2 = stairs (connects floors)
 *   3 = bathroom
 *   4 = AC unit (George pickup)
 *   5 = car (goal)
 *   6 = guard spawn
 */

const CELL = {
  WALL: 0,
  FLOOR: 1,
  STAIRS: 2,
  BATHROOM: 3,
  AC_UNIT: 4,
  CAR: 5,
  GUARD_SPAWN: 6,
  KEYS: 7,
};

/**
 * Generate a single-floor maze grid.
 * @param {number} cols - number of columns (odd recommended)
 * @param {number} rows - number of rows (odd recommended)
 * @returns {number[][]} 2D grid
 */
function generateFloorMaze(cols, rows) {
  // Ensure odd dimensions for clean maze walls
  cols = cols % 2 === 0 ? cols + 1 : cols;
  rows = rows % 2 === 0 ? rows + 1 : rows;

  // Start with all walls
  const grid = Array.from({ length: rows }, () => Array(cols).fill(CELL.WALL));

  // Recursive backtracker
  const stack = [];
  const startR = 1;
  const startC = 1;
  grid[startR][startC] = CELL.FLOOR;
  stack.push([startR, startC]);

  const dirs = [
    [-2, 0], [2, 0], [0, -2], [0, 2],
  ];

  while (stack.length > 0) {
    const [cr, cc] = stack[stack.length - 1];
    const neighbors = [];

    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === CELL.WALL) {
        neighbors.push([nr, nc, dr, dc]);
      }
    }

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const [nr, nc, dr, dc] = neighbors[Math.floor(Math.random() * neighbors.length)];
    // Carve the wall between current and neighbor
    grid[cr + dr / 2][cc + dc / 2] = CELL.FLOOR;
    grid[nr][nc] = CELL.FLOOR;
    stack.push([nr, nc]);
  }

  // Open up some extra passages to make it less claustrophobic (30% of inner walls)
  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      if (grid[r][c] === CELL.WALL && Math.random() < 0.15) {
        // Only remove if it doesn't create a 3x3 open area
        const floorNeighbors = [
          grid[r - 1]?.[c], grid[r + 1]?.[c], grid[r]?.[c - 1], grid[r]?.[c + 1],
        ].filter((v) => v !== CELL.WALL).length;
        if (floorNeighbors >= 2 && floorNeighbors <= 3) {
          grid[r][c] = CELL.FLOOR;
        }
      }
    }
  }

  return grid;
}

/**
 * Find all floor cells in a grid.
 */
function getFloorCells(grid) {
  const cells = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] === CELL.FLOOR) {
        cells.push({ r, c });
      }
    }
  }
  return cells;
}

/**
 * Pick a random floor cell, removing it from the pool.
 */
function pickAndRemove(cells) {
  const idx = Math.floor(Math.random() * cells.length);
  return cells.splice(idx, 1)[0];
}

/**
 * Generate a multi-floor parking garage.
 * @param {number} numFloors
 * @param {number} cols
 * @param {number} rows
 * @returns {{ floors: number[][][], stairPositions: {r,c}[], carFloor: number, carPos: {r,c}, acFloor: number, acPos: {r,c}, bathroomPositions: {floor,r,c}[], guardSpawns: {floor,r,c}[], keysFloor: number, keysPos: {r,c}, startPositions: {floor,r,c}[] }}
 */
export function generateGarage(numFloors = 3, cols = 31, rows = 23) {
  const floors = [];
  const stairPositions = []; // shared stair location across all floors

  for (let f = 0; f < numFloors; f++) {
    floors.push(generateFloorMaze(cols, rows));
  }

  // Place stairs — same column on every floor, 2 stairwells
  const floor0Cells = getFloorCells(floors[0]);
  for (let s = 0; s < 2; s++) {
    const pos = pickAndRemove(floor0Cells);
    stairPositions.push(pos);
    for (let f = 0; f < numFloors; f++) {
      floors[f][pos.r][pos.c] = CELL.STAIRS;
    }
  }

  // Place car on the top floor
  const carFloor = numFloors - 1;
  const topCells = getFloorCells(floors[carFloor]);
  const carPos = pickAndRemove(topCells);
  floors[carFloor][carPos.r][carPos.c] = CELL.CAR;

  // Place AC unit on a different floor than the car
  const acFloor = Math.floor(Math.random() * (numFloors - 1)); // not top floor
  const acCells = getFloorCells(floors[acFloor]);
  const acPos = pickAndRemove(acCells);
  floors[acFloor][acPos.r][acPos.c] = CELL.AC_UNIT;

  // Place Kramer's keys on a random floor
  const keysFloor = Math.floor(Math.random() * numFloors);
  const keysCells = getFloorCells(floors[keysFloor]);
  const keysPos = pickAndRemove(keysCells);
  floors[keysFloor][keysPos.r][keysPos.c] = CELL.KEYS;

  // Place bathrooms — 1 per floor
  const bathroomPositions = [];
  for (let f = 0; f < numFloors; f++) {
    const cells = getFloorCells(floors[f]);
    if (cells.length > 0) {
      const pos = pickAndRemove(cells);
      floors[f][pos.r][pos.c] = CELL.BATHROOM;
      bathroomPositions.push({ floor: f, r: pos.r, c: pos.c });
    }
  }

  // Place guard spawns — 1-2 per floor
  const guardSpawns = [];
  for (let f = 0; f < numFloors; f++) {
    const cells = getFloorCells(floors[f]);
    const guardCount = f === carFloor ? 2 : 1;
    for (let g = 0; g < guardCount && cells.length > 0; g++) {
      const pos = pickAndRemove(cells);
      floors[f][pos.r][pos.c] = CELL.GUARD_SPAWN;
      guardSpawns.push({ floor: f, r: pos.r, c: pos.c });
    }
  }

  // Character start positions — all on floor 0
  const startCells = getFloorCells(floors[0]);
  const startPositions = [];
  for (let i = 0; i < 4 && startCells.length > 0; i++) {
    const pos = pickAndRemove(startCells);
    startPositions.push({ floor: 0, r: pos.r, c: pos.c });
  }

  return {
    floors,
    stairPositions,
    carFloor,
    carPos,
    acFloor,
    acPos,
    bathroomPositions,
    guardSpawns,
    keysFloor,
    keysPos,
    startPositions,
  };
}

export { CELL };
