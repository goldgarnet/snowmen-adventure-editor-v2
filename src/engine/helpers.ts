import { Level, GameObject, Position, Direction } from '../types';
import { getDirectionDelta, isInBounds, getObjectHeight } from '../utils/level';

export function getNextPos(pos: Position, dir: Direction): Position {
  const delta = getDirectionDelta(dir);
  return { row: pos.row + delta.row, col: pos.col + delta.col };
}

/**
 * Returns true if there is an edge-arch on the boundary between `from` and `to`
 * (which are assumed to be adjacent cells in direction `dir`).
 * Edge arches are stored only on the top/left edges of tiles, so we normalize.
 */
export function hasEdgeArch(level: Level, from: Position, dir: Direction): boolean {
  // The edge between `from` and `getNextPos(from, dir)`
  switch (dir) {
    case 'right': {
      // Edge between from(r,c) and (r,c+1) = left edge of (r,c+1)
      const target = { row: from.row, col: from.col + 1 };
      if (!isInBounds(level, target)) return false;
      return !!level.tiles[target.row][target.col].edgeArchLeft;
    }
    case 'left': {
      // Edge between from(r,c) and (r,c-1) = left edge of (r,c)
      if (from.col < 0 || from.col >= level.width || from.row < 0 || from.row >= level.height) return false;
      return !!level.tiles[from.row][from.col].edgeArchLeft;
    }
    case 'down': {
      // Edge between from(r,c) and (r+1,c) = top edge of (r+1,c)
      const target = { row: from.row + 1, col: from.col };
      if (!isInBounds(level, target)) return false;
      return !!level.tiles[target.row][target.col].edgeArchTop;
    }
    case 'up': {
      // Edge between from(r,c) and (r-1,c) = top edge of (r,c)
      if (from.col < 0 || from.col >= level.width || from.row < 0 || from.row >= level.height) return false;
      return !!level.tiles[from.row][from.col].edgeArchTop;
    }
  }
}

/**
 * Can an object of given size pass through any edge-arch between `from` and the next cell in `dir`?
 * Edge arches only allow objects with size <= 1 to pass.
 */
export function canPassEdge(level: Level, from: Position, dir: Direction, obj: GameObject): boolean {
  if (!hasEdgeArch(level, from, dir)) return true;
  return obj.size <= 1;
}

export function canEnterTile(level: Level, pos: Position, dir: Direction, obj: GameObject): boolean {
  if (!isInBounds(level, pos)) return false;

  const tile = level.tiles[pos.row][pos.col];
  const height = getObjectHeight(obj);

  if (tile.isRowArch) {
    if (dir === 'left' || dir === 'right') return false;
    if (height > 1) return false;
  }
  if (tile.isColumnArch) {
    if (dir === 'up' || dir === 'down') return false;
    if (height > 1) return false;
  }

  return true;
}

export function canLeaveTile(level: Level, pos: Position, dir: Direction, obj: GameObject): boolean {
  const tile = level.tiles[pos.row][pos.col];
  const height = getObjectHeight(obj);

  if (tile.isRowArch) {
    if (dir === 'left' || dir === 'right') return false;
    if (height > 1) return false;
  }
  if (tile.isColumnArch) {
    if (dir === 'up' || dir === 'down') return false;
    if (height > 1) return false;
  }

  return true;
}

export function canMoveTo(level: Level, from: Position, dir: Direction, obj: GameObject): boolean {
  if (!canLeaveTile(level, from, dir, obj)) return false;
  if (!canPassEdge(level, from, dir, obj)) return false;
  const to = getNextPos(from, dir);
  if (!canEnterTile(level, to, dir, obj)) return false;
  return true;
}

export function isSnowMade(type: string): boolean {
  return type === 'player' || type === 'snowball' || type === 'snowman';
}

export function getPerpendicularDirs(dir: Direction): [Direction, Direction] {
  if (dir === 'left' || dir === 'right') return ['up', 'down'];
  return ['left', 'right'];
}

/**
 * Returns true if movement in direction `dir` from `pos` is "backed" — i.e. the cell
 * at `getNextPos(pos, dir)` acts as a wall for force/snowman-build backing purposes.
 *
 * Backing conditions:
 *  - The next cell is out of bounds (map edge counts as wall)
 *  - The next cell contains wall / block / tree
 *  - Movement from `pos` in `dir` is blocked by a tunnel (perpendicular orientation)
 *  - Movement from `pos` in `dir` is blocked by an edge-arch for a snowball of size >= 2
 *    (effectively: an edge-arch counts as a wall because the object being pushed is too big)
 *
 * Note: for force/build we treat objects of "size >= 2" (the typical pushed thing)
 * as needing the backing. We pass a "probe" object to test tunnel/edge-arch blockage.
 */
export function isBacked(level: Level, pos: Position, dir: Direction): boolean {
  const nextPos = getNextPos(pos, dir);
  if (!isInBounds(level, nextPos)) return true;

  const nextObj = level.objects[nextPos.row][nextPos.col];
  if (nextObj) {
    if (nextObj.type === 'wall' || nextObj.type === 'block' || nextObj.type === 'tree') {
      return true;
    }
    return false;
  }

  // No object at nextPos — but a tunnel or edge-arch may still block movement.
  // Probe with a "size 2 snowball"-like object: anything taller/wider than size 1
  // will be blocked by tunnels (height > 1) and by edge arches (size > 1).
  const probe: GameObject = {
    type: 'snowball',
    size: 2,
    isMelting: false,
    createdAt: 0,
  };
  if (!canMoveTo(level, pos, dir, probe)) {
    return true;
  }

  return false;
}
