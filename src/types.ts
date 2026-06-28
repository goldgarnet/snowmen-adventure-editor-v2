export type SunDirection = 'left' | 'right' | 'up' | 'down';
export type ObjectType = 'player' | 'snowball' | 'snowman' | 'block' | 'wall' | 'tree' | 'laser';
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
  // Soul-swap footplate: when the player steps onto it, the soul moves to another
  // snowman (nearest rule); the old body is left behind as a snowman.
  isSoulSwap?: boolean;
  // Key footplate: while any key tile exists on the map, the goal is only active
  // when every key tile is covered by an object.
  isKeyTile?: boolean;
}

export interface GameObject {
  type: ObjectType;
  size: number;
  isMelting: boolean;
  treeHeight?: number;
  laserDirection?: SunDirection;
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
  // When true, the player may press M to cycle the soul through the snowman queue.
  soulSwapEnabled: boolean;
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
