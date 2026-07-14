/**
 * Zone map data format. Maps are pure data (tile *names* spanning both
 * tilesets) so they can be unit tested without Phaser.
 */
export interface ZoneMap {
  /** Ground layer, every cell filled. */
  ground: string[][];
  /** Decor layer, null = empty. Solid names block movement. */
  decor: (string | null)[][];
  /** Overhead layer (drawn above actors), null = empty. Never solid. */
  overhead?: (string | null)[][];
}

/** Tile names (across both tilesets) that block movement. */
export const SOLID_TILE_NAMES: readonly string[] = [
  // tiles.png
  "water",
  "rock",
  "cactus",
  "brick",
  "brickCracked",
  "ruinPillar",
  "palmTrunk",
  "pot",
  // tiles2.png
  "truckCab",
  "truckBox",
  "joshuaTrunk",
  "stationWall",
  "stationWindow",
  "stationSign",
  "gasPump",
  "mineWall",
  "mineTimber",
  "cart",
  "lever",
  "leverOn",
  "iceWall",
  "iceWallCrack",
  "eggCluster",
  // tiles3.png (Act 2)
  "iceWallDeep",
  "crystalBig",
  "chasm",
  "lanternPost",
  "doorRime"
];

export function isSolidName(name: string | null): boolean {
  return name !== null && SOLID_TILE_NAMES.includes(name);
}

export function mapSize(map: ZoneMap): { width: number; height: number } {
  return { width: map.ground[0].length, height: map.ground.length };
}

/** True if the tile at (x, y) blocks movement (out of bounds = solid). */
export function isSolidAt(map: ZoneMap, x: number, y: number): boolean {
  const { width, height } = mapSize(map);
  if (x < 0 || y < 0 || x >= width || y >= height) return true;
  return isSolidName(map.decor[y][x]) || isSolidName(map.ground[y][x]);
}
