import type { Cell, TerrainId, Unit, UnitType } from './types';
import { UNITS } from './units';

export const COLS = 24;
export const ROWS = 14;
export const HEX_SIZE = 30;
export const HW = Math.sqrt(3) * HEX_SIZE;
export const HH = 2 * HEX_SIZE;

export function hexToPixel(col: number, row: number) {
  return {
    x: HW * (col + (row & 1) * 0.5) + HEX_SIZE * 1.2,
    y: HH * 0.75 * row + HEX_SIZE,
  };
}

export function hexCorners(cx: number, cy: number, r = HEX_SIZE - 2): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

export function hexDist(c1: number, r1: number, c2: number, r2: number): number {
  const ax = c1 - Math.floor(r1 / 2);
  const az = r1;
  const bx = c2 - Math.floor(r2 / 2);
  const bz = r2;
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz), Math.abs((ax + az) - (bx + bz)));
}

// Simple pseudo-noise using multiple sin waves
function noise(x: number, y: number, seed: number): number {
  return (
    Math.sin(x * 0.7 + seed) * 0.3 +
    Math.sin(y * 0.9 + seed * 1.3) * 0.3 +
    Math.sin((x + y) * 0.5 + seed * 0.7) * 0.2 +
    Math.sin(x * 1.5 + y * 0.3 + seed * 2.1) * 0.2
  );
}

export function generateMap(seed: number = Date.now()): Cell[][] {
  const s = seed % 1000;
  const midRow = Math.floor(ROWS / 2);
  const grid: Cell[][] = [];

  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      let terrain: TerrainId;
      const n = noise(c, r, s);
      const edge = Math.min(c, COLS - 1 - c, r, ROWS - 1 - r);

      // Fixed special tiles
      if (c === 0 && r === midRow)                          terrain = 'playerCity';
      else if (c === COLS - 1 && r === midRow)              terrain = 'enemyCity';
      else if (c === COLS - 2 && r === midRow - 2)          terrain = 'enemyCity';
      // Neutral city in the middle
      else if (c === Math.floor(COLS / 2) && r === Math.floor(ROWS / 2)) terrain = 'neutralCity';
      // Barbarian camps at edges and some interior
      else if (c === COLS - 1 && r === 1)                   terrain = 'barbarianCamp';
      else if (c === COLS - 1 && r === ROWS - 2)            terrain = 'barbarianCamp';
      else if (c === Math.floor(COLS * 0.6) && r === 0)     terrain = 'barbarianCamp';
      else if (c === Math.floor(COLS * 0.6) && r === ROWS - 1) terrain = 'barbarianCamp';
      else {
        // Terrain from noise
        if (n < -0.35)       terrain = 'mountain';
        else if (n < -0.20)  terrain = 'river';
        else if (n < -0.10)  terrain = 'tundra';
        else if (n < 0.05)   terrain = 'swamp';
        else if (n < 0.20)   terrain = 'forest';
        else if (n < 0.30)   terrain = 'desert';
        // Special rare tiles
        else if (n > 0.55 && edge > 2 && Math.random() < 0.4) terrain = 'ancientLib';
        else if (n > 0.45 && edge > 2 && Math.random() < 0.3) terrain = 'crystal';
        else if (n > 0.35 && Math.random() < 0.15)            terrain = 'village';
        else                                                    terrain = 'meadow';
      }

      // Explored: only near player city initially
      const explored = hexDist(c, r, 0, midRow) <= 3;

      // Assign resource on some meadow/forest tiles
      let resource: Cell['resource'];
      if (terrain === 'meadow' && Math.random() < 0.08) resource = 'food';
      else if (terrain === 'mountain' && Math.random() < 0.25) resource = 'stone';
      else if (terrain === 'forest' && Math.random() < 0.1) resource = 'iron';
      else if (terrain === 'river' && Math.random() < 0.15) resource = 'gold';

      grid[r][c] = {
        col: c, row: r, terrain, explored,
        hasCamp: terrain === 'barbarianCamp',
        campCooldown: 0,
        resource,
      };
    }
  }
  return grid;
}

export function initUnits(civId: string | null): Unit[] {
  const midRow = Math.floor(ROWS / 2);

  const unitTypes: UnitType[] = (() => {
    if (civId === 'academy')    return ['warrior', 'warrior', 'scholar', 'scholar'];
    if (civId === 'legion')     return ['warrior', 'warrior', 'warrior', 'warrior', 'archer'];
    if (civId === 'innovators') return ['warrior', 'scholar', 'aiUnit'];
    if (civId === 'natureFolk') return ['warrior', 'warrior', 'scholar', 'archer'];
    return ['warrior', 'warrior', 'scholar'];
  })();

  const playerUnits: Unit[] = unitTypes.map((type, i) => {
    const def = UNITS[type];
    return {
      id: `p${i}_${type}`,
      type,
      col: 1,
      row: midRow + (i % 2 === 0 ? -Math.floor(i / 2) : Math.ceil(i / 2)),
      hp: def.maxHp,
      maxHp: def.maxHp,
      moves: def.maxMoves,
      maxMoves: def.maxMoves,
      owner: 'player' as const,
      xp: 0,
      level: 1,
    };
  });

  const enemyDef = UNITS['lazy'];
  const gamerDef = UNITS['gamer'];
  const enemyUnits: Unit[] = [
    { id: 'e1', type: 'lazy',  col: COLS - 2, row: midRow - 1, hp: enemyDef.maxHp, maxHp: enemyDef.maxHp, moves: enemyDef.maxMoves, maxMoves: enemyDef.maxMoves, owner: 'enemy', xp: 0, level: 1 },
    { id: 'e2', type: 'lazy',  col: COLS - 2, row: midRow + 1, hp: enemyDef.maxHp, maxHp: enemyDef.maxHp, moves: enemyDef.maxMoves, maxMoves: enemyDef.maxMoves, owner: 'enemy', xp: 0, level: 1 },
    { id: 'e3', type: 'gamer', col: COLS - 1, row: midRow,     hp: gamerDef.maxHp, maxHp: gamerDef.maxHp, moves: gamerDef.maxMoves, maxMoves: gamerDef.maxMoves, owner: 'enemy', xp: 0, level: 1 },
  ];

  // Barbarian units near camps
  const barb = UNITS['barbarian'];
  const barbUnits: Unit[] = [
    { id: 'b1', type: 'barbarian', col: COLS - 2, row: 1,         hp: barb.maxHp, maxHp: barb.maxHp, moves: barb.maxMoves, maxMoves: barb.maxMoves, owner: 'barbarian', xp: 0, level: 1 },
    { id: 'b2', type: 'barbarian', col: COLS - 2, row: ROWS - 2,  hp: barb.maxHp, maxHp: barb.maxHp, moves: barb.maxMoves, maxMoves: barb.maxMoves, owner: 'barbarian', xp: 0, level: 1 },
  ];

  return [...playerUnits, ...enemyUnits, ...barbUnits];
}
