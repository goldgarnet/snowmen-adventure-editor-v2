import { Level, Direction, GameStatus } from '../types';
import { cloneLevel, findPlayer } from '../utils/level';
import { recalcShadows } from './shadow';
import { executePush } from './push';

export interface TurnResult {
  level: Level;
  status: GameStatus;
}

const DIR_DELTA: Record<string, [number, number]> = {
  right: [0, 1], left: [0, -1], up: [-1, 0], down: [1, 0],
};
const LASER_BLOCKERS = new Set(['wall', 'block', 'tree', 'laser']);

function applyLaserCheck(level: Level): void {
  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      const obj = level.objects[r][c];
      if (!obj || obj.type !== 'laser') continue;
      const [dr, dc] = DIR_DELTA[obj.laserDirection ?? 'right'];
      let cr = r + dr;
      let cc = c + dc;
      while (cr >= 0 && cc >= 0 && cr < level.height && cc < level.width) {
        const hit = level.objects[cr][cc];
        if (hit) {
          if (LASER_BLOCKERS.has(hit.type)) break;
          hit.size = 0;
        }
        cr += dr;
        cc += dc;
      }
    }
  }
  processDeadObjects(level);
}

export function executeSkipTurn(level: Level): TurnResult {
  const newLevel = cloneLevel(level);
  const playerPos = findPlayer(newLevel);
  if (!playerPos) return { level: newLevel, status: 'gameover' };

  const turnCount = Date.now();
  applyLaserCheck(newLevel);
  endOfTurn(newLevel, turnCount);

  const finalPlayerPos = findPlayer(newLevel);
  if (!finalPlayerPos) return { level: newLevel, status: 'gameover' };

  const finalTile = newLevel.tiles[finalPlayerPos.row][finalPlayerPos.col];
  if (finalTile.isGoal) return { level: newLevel, status: 'cleared' };

  return { level: newLevel, status: 'playing' };
}

export function executeTurn(level: Level, dir: Direction): TurnResult {
  const newLevel = cloneLevel(level);
  const playerPos = findPlayer(newLevel);

  if (!playerPos) {
    return { level: newLevel, status: 'gameover' };
  }

  const turnCount = Date.now();
  const { playerMoved } = executePush(newLevel, playerPos, dir, turnCount);

  if (!playerMoved) {
    return { level: newLevel, status: 'playing' };
  }

  const newPlayerPos = findPlayer(newLevel);
  if (newPlayerPos) {
    const tile = newLevel.tiles[newPlayerPos.row][newPlayerPos.col];
    if (tile.isGoal) {
      return { level: newLevel, status: 'cleared' };
    }
  }

  applyLaserCheck(newLevel);
  endOfTurn(newLevel, turnCount);

  const finalPlayerPos = findPlayer(newLevel);
  if (!finalPlayerPos) {
    return { level: newLevel, status: 'gameover' };
  }

  const finalTile = newLevel.tiles[finalPlayerPos.row][finalPlayerPos.col];
  if (finalTile.isGoal) {
    return { level: newLevel, status: 'cleared' };
  }

  return { level: newLevel, status: 'playing' };
}

function endOfTurn(level: Level, _turnCount: number): void {
  // 1. Recalculate shadows (if shadow mechanic is enabled)
  if (level.hasShadow) recalcShadows(level);

  // 2. Melting / growing
  const sizesBefore = snapshotSizes(level);
  processMelting(level);

  // 3. Check for dead objects (size 0): only on full disappearance, mark tile cool
  processDeadObjects(level);

  // 4. If sizes changed, recalc shadows
  if (level.hasShadow && sizesChanged(level, sizesBefore)) {
    recalcShadows(level);
  }
}

function snapshotSizes(level: Level): (number | null)[][] {
  const snap: (number | null)[][] = [];
  for (let r = 0; r < level.height; r++) {
    snap.push([]);
    for (let c = 0; c < level.width; c++) {
      const obj = level.objects[r][c];
      snap[r].push(obj ? obj.size : null);
    }
  }
  return snap;
}

function sizesChanged(level: Level, snap: (number | null)[][]): boolean {
  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      const obj = level.objects[r][c];
      const prevSize = snap[r][c];
      const currSize = obj ? obj.size : null;
      if (prevSize !== currSize) return true;
    }
  }
  return false;
}

function processMelting(level: Level): void {
  // Per V2 rule: tile becomes cool ONLY when an object fully melts away (size→0).
  // While an object is merely shrinking (size>0 after melt), the tile stays warm.
  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      const obj = level.objects[r][c];
      if (!obj) continue;

      const tile = level.tiles[r][c];
      const isHeated = tile.isWarm && !tile.isShade;

      if (obj.type === 'player') {
        if (isHeated) {
          if (obj.isMelting) {
            obj.size -= 1;
          } else {
            obj.isMelting = true;
          }
        } else {
          if (obj.isMelting) {
            obj.isMelting = false;
          }
        }
      } else if (obj.type === 'snowball' || obj.type === 'snowman') {
        if (isHeated) {
          obj.size -= 1;
        }
      }
    }
  }
}

function processDeadObjects(level: Level): void {
  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      const obj = level.objects[r][c];
      if (!obj) continue;
      if (obj.size <= 0) {
        // Full melt: tile becomes cool
        level.tiles[r][c].isWarm = false;
        if (obj.type === 'player') {
          level.objects[r][c] = null;
          soulTransfer(level, { row: r, col: c });
        } else {
          level.objects[r][c] = null;
        }
      }
    }
  }
}

function soulTransfer(level: Level, playerPos: { row: number; col: number }): void {
  const snowmen: { row: number; col: number; dist: number; createdAt: number }[] = [];

  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      const obj = level.objects[r][c];
      if (obj?.type === 'snowman') {
        const dist = Math.sqrt(
          (r - playerPos.row) ** 2 + (c - playerPos.col) ** 2
        );
        snowmen.push({ row: r, col: c, dist, createdAt: obj.createdAt });
      }
    }
  }

  if (snowmen.length === 0) return;

  snowmen.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.createdAt - b.createdAt;
  });

  const target = snowmen[0];
  const snowman = level.objects[target.row][target.col]!;

  level.objects[target.row][target.col] = {
    type: 'player',
    size: snowman.size,
    isMelting: false,
    createdAt: 0,
  };
}
