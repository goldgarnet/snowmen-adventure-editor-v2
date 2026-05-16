export type SunDirection = 'left' | 'right' | 'up' | 'down';
export type ObjectType = 'player' | 'snowball' | 'snowman' | 'block' | 'wall' | 'tree';
export type Direction = 'left' | 'right' | 'up' | 'down';

export interface Tile {
  isWarm: boolean;
  isShade: boolean;
  isFlake: boolean;
  isRowArch: boolean;        // legacy: now called "row tunnel" (가로 터널)
  isColumnArch: boolean;     // legacy: now called "column tunnel" (세로 터널)
  isGoal: boolean;
  // Edge arches: stored only on top/left edges of a tile to avoid duplication.
  // Value is the maximum object size that can pass: 1 = height-1 arch, 2 = height-2 arch.
  // Undefined / 0 = no arch.
  // - edgeArchTop: arch on the edge between this tile and the tile above (blocks vertical movement)
  // - edgeArchLeft: arch on the edge between this tile and the tile to the left (blocks horizontal movement)
  edgeArchTop?: number;
  edgeArchLeft?: number;
}

export interface GameObject {
  type: ObjectType;
  size: number;
  isMelting: boolean;
  treeHeight?: number;
  createdAt: number;
}

export interface Position {
  row: number;
  col: number;
}

export interface Level {
  width: number;
  height: number;
  sunDirection: SunDirection;
  hasShadow: boolean;
  tiles: Tile[][];
  objects: (GameObject | null)[][];
}

export type GameStatus = 'playing' | 'cleared' | 'gameover';

export interface GameState {
  level: Level;
  status: GameStatus;
  turnCount: number;
  history: Level[];
}
