import { Level, Tile, GameObject, SunDirection } from '../types';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SUN_DIRS: SunDirection[] = ['left', 'right', 'up', 'down'];

// Version marker: 3 bits immediately after sentinel.
// In v1 codes the bits immediately after the sentinel are width-2's high bits
// (width is 2..20 → width-2 is 0..18 → high 3 bits ∈ 0b000..0b100), so neither
// 0b111 nor 0b110 ever appear in v1 codes and can be used as version flags.
//   0b111 = v2 (boolean edge arches)
//   0b110 = v3 (2-bit edge arch levels: 0/1/2)
const V2_MARKER = 0b111;
const V3_MARKER = 0b110;

function pushBits(bits: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) {
    bits.push((value >> i) & 1);
  }
}

function readBits(bits: number[], offset: number, count: number): number {
  let val = 0;
  for (let i = 0; i < count; i++) {
    val = (val << 1) | (bits[offset + i] ?? 0);
  }
  return val;
}

function encodeTileV3(bits: number[], tile: Tile): void {
  pushBits(bits, tile.isWarm ? 1 : 0, 1);
  pushBits(bits, tile.isFlake ? 1 : 0, 1);
  pushBits(bits, tile.isGoal ? 1 : 0, 1);
  pushBits(bits, tile.isRowArch ? 1 : 0, 1);
  pushBits(bits, tile.isColumnArch ? 1 : 0, 1);
  // 2 bits per edge field: 0 = none, 1 = height-1 arch, 2 = height-2 arch.
  pushBits(bits, Math.min(3, Math.max(0, tile.edgeArchTop ?? 0)), 2);
  pushBits(bits, Math.min(3, Math.max(0, tile.edgeArchLeft ?? 0)), 2);
}

function encodeObject(bits: number[], obj: GameObject | null): void {
  if (!obj) {
    pushBits(bits, 0, 4);
    return;
  }
  switch (obj.type) {
    case 'player': pushBits(bits, 1, 4); break;
    case 'snowball': pushBits(bits, obj.size === 1 ? 2 : 3, 4); break;
    case 'snowman':
      pushBits(bits, obj.size === 1 ? 7 : obj.size === 2 ? 8 : 9, 4);
      break;
    case 'wall': pushBits(bits, 4, 4); break;
    case 'block': pushBits(bits, 5, 4); break;
    case 'tree': {
      pushBits(bits, 6, 4);
      const h = obj.treeHeight ?? 1;
      const hVal = Math.min(Math.max(Math.round(h * 2), 1), 63);
      pushBits(bits, hVal, 6);
      break;
    }
  }
}

function bitsToBase62(bits: number[]): string {
  let n = 0n;
  for (const b of bits) {
    n = (n << 1n) | BigInt(b);
  }
  if (n === 0n) return BASE62[0];
  let result = '';
  while (n > 0n) {
    result = BASE62[Number(n % 62n)] + result;
    n = n / 62n;
  }
  return result;
}

function base62ToBits(str: string): number[] {
  let n = 0n;
  for (const ch of str) {
    const idx = BASE62.indexOf(ch);
    if (idx < 0) return [];
    n = n * 62n + BigInt(idx);
  }
  const bits: number[] = [];
  if (n === 0n) return [0];
  while (n > 0n) {
    bits.unshift(Number(n & 1n));
    n = n >> 1n;
  }
  return bits;
}

export function encodeLevelCode(level: Level): string {
  const bits: number[] = [];

  // Sentinel
  bits.push(1);
  // v3 marker
  pushBits(bits, V3_MARKER, 3);

  pushBits(bits, level.width - 2, 5);
  pushBits(bits, level.height - 2, 5);
  pushBits(bits, SUN_DIRS.indexOf(level.sunDirection), 2);
  pushBits(bits, level.hasShadow ? 1 : 0, 1);

  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      encodeTileV3(bits, level.tiles[r][c]);
      encodeObject(bits, level.objects[r][c]);
    }
  }

  return bitsToBase62(bits);
}

export function decodeLevelCode(code: string): Level | null {
  try {
    const bits = base62ToBits(code.trim());
    if (bits.length < 13) return null;

    const sentinel = bits.indexOf(1);
    if (sentinel < 0) return null;
    let pos = sentinel + 1;

    // Detect version by checking 3-bit marker
    const marker = readBits(bits, pos, 3);
    const isV3 = marker === V3_MARKER;
    const isV2 = marker === V2_MARKER;
    const isV2OrLater = isV2 || isV3;
    if (isV2OrLater) pos += 3;

    const width = readBits(bits, pos, 5) + 2; pos += 5;
    const height = readBits(bits, pos, 5) + 2; pos += 5;
    const sunIdx = readBits(bits, pos, 2); pos += 2;
    const sunDirection = SUN_DIRS[sunIdx] ?? 'left';

    if (width < 2 || width > 33 || height < 2 || height > 33) return null;

    let hasShadow = true;
    if (isV2OrLater) {
      hasShadow = readBits(bits, pos, 1) === 1; pos += 1;
    }

    const tiles: Tile[][] = [];
    const objects: (GameObject | null)[][] = [];

    for (let r = 0; r < height; r++) {
      tiles.push([]);
      objects.push([]);
      for (let c = 0; c < width; c++) {
        const isWarm = readBits(bits, pos, 1) === 1; pos += 1;
        const isFlake = readBits(bits, pos, 1) === 1; pos += 1;
        const isGoal = readBits(bits, pos, 1) === 1; pos += 1;
        const isRowArch = readBits(bits, pos, 1) === 1; pos += 1;
        const isColumnArch = readBits(bits, pos, 1) === 1; pos += 1;

        let edgeArchTop = 0;
        let edgeArchLeft = 0;
        if (isV3) {
          edgeArchTop = readBits(bits, pos, 2); pos += 2;
          edgeArchLeft = readBits(bits, pos, 2); pos += 2;
        } else if (isV2) {
          // v2: 1 bit per edge — interpret as height-1 arch
          edgeArchTop = readBits(bits, pos, 1) === 1 ? 1 : 0; pos += 1;
          edgeArchLeft = readBits(bits, pos, 1) === 1 ? 1 : 0; pos += 1;
        }

        tiles[r].push({
          isWarm,
          isShade: isRowArch || isColumnArch,
          isFlake,
          isGoal,
          isRowArch,
          isColumnArch,
          edgeArchTop,
          edgeArchLeft,
        });

        const objType = readBits(bits, pos, 4); pos += 4;
        let obj: GameObject | null = null;

        switch (objType) {
          case 0: break;
          case 1: obj = { type: 'player', size: 2, isMelting: false, createdAt: 0 }; break;
          case 2: obj = { type: 'snowball', size: 1, isMelting: false, createdAt: 0 }; break;
          case 3: obj = { type: 'snowball', size: 2, isMelting: false, createdAt: 0 }; break;
          case 4: obj = { type: 'wall', size: 100, isMelting: false, createdAt: 0 }; break;
          case 5: obj = { type: 'block', size: 1, isMelting: false, createdAt: 0 }; break;
          case 6: {
            const hVal = readBits(bits, pos, 6); pos += 6;
            const treeHeight = Math.max(hVal, 1) / 2;
            obj = { type: 'tree', size: 100, isMelting: false, treeHeight, createdAt: 0 };
            break;
          }
          case 7: obj = { type: 'snowman', size: 1, isMelting: false, createdAt: 0 }; break;
          case 8: obj = { type: 'snowman', size: 2, isMelting: false, createdAt: 0 }; break;
          case 9: obj = { type: 'snowman', size: 3, isMelting: false, createdAt: 0 }; break;
          default: break;
        }

        objects[r].push(obj);
      }
    }

    return { width, height, sunDirection, hasShadow, tiles, objects };
  } catch {
    return null;
  }
}
