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
  "mountain",
  "mountain2",
  "mountain3",
  "mountain4",
  "mountain5",
  "mountain6",
  "mountain7",
  "mountain8",
  // tiles3.png (Act 2)
  "iceWallDeep",
  "crystalBig",
  "chasm",
  "lanternPost",
  "doorRime",
  // tiles4.png (Act 3 — the Sunless Sea)
  "seaWater",
  "seaWater2",
  "kelpStalk",
  "coral",
  "templePillar",
  "mossRock",
  // tiles5.png (Act 4 — the Miners' Camp)
  "campWall",
  "crate",
  "crateStack",
  "barrel",
  "washtub",
  "stove",
  "campPost",
  "crateOpen",
  // tiles6.png (Act 5 — the Sunlit Cave-In / Sahra's grove)
  "caveWall",
  "collapsedRock",
  "vineRock",
  "fern",
  "groveWater",
  "groveWater2",
  "orangeTreeTrunk",
  "needleCactus",
  // tiles7.png (Act 6 — The Reef / the crawlers' garden)
  "reefWall",
  "coralHead",
  "crystalCluster",
  "reefWater",
  "reefWater2",
  "wildKelp",
  "kelpTrellis",
  // tiles8.png (Act 7 — La Pizzeria Sotterranea / the lava vents)
  "basaltWall",
  "lavaVent",
  "lavaVent2",
  "pizzaTable",
  "pizzaOven",
  "stoneColumn"
];

const SOLID_SET = new Set(SOLID_TILE_NAMES);

/**
 * Dressed wall-role suffixes (see `dressing.ts` / docs/ART_DIRECTION.md §2).
 * Solidity is extended MECHANICALLY: every `<wall>Face` / `<wall>Cap` of a
 * solid base is solid. Every other dressed variant (`<floor>Shade`,
 * transition/lip tiles) belongs to a walkable base and is simply absent from
 * the solid set, so it stays walkable without listing.
 */
const SOLID_ROLE_SUFFIXES = ["Face", "Face2", "Cap", "Cap2"] as const;

export function isSolidName(name: string | null): boolean {
  if (name === null) return false;
  if (SOLID_SET.has(name)) return true;
  for (const suffix of SOLID_ROLE_SUFFIXES) {
    if (name.length > suffix.length && name.endsWith(suffix)) {
      if (SOLID_SET.has(name.slice(0, -suffix.length))) return true;
    }
  }
  return false;
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
