/**
 * Act 3 — The Sunless Sea. A bioluminescent cavern ocean under the glacier:
 * mostly solid dark `seaWater`, with walkable ice `floe` paths threading
 * through it (floe-hopping traversal, tile-grid style — no new physics).
 *
 * Layout: an entry overlook (where Piggy is glimpsed playing tag), a west
 * corridor to a dead-end kelp bed where Fluffball is cornered, a central
 * floe hub, a flooded sun-temple ruin to the south-west, a bioluminescent
 * reef, and the deepest kelp bed to the south-east where the silverfin runs
 * (the fishing spot). The reef gives a second route to the deep bed (a
 * loop), so the sea isn't a single dead-straight corridor.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const SEA_WIDTH = 40;
export const SEA_HEIGHT = 28;

/** Default spawn: dropped in through the crack at the north overlook. */
export const SEA_SPAWN = { x: 19, y: 3 } as const;
/** The chase overlook trigger — Piggy is spotted out on the ice. */
export const SEA_CHASE_TRIGGER = { x1: 18, y1: 6, x2: 20, y2: 7 } as const;
/** Fluffball's dead-end kelp bed (glimpse-and-clue). */
export const SEA_FLUFFBALL = { x: 5, y: 4 } as const;
/** The single entrance tile to Fluffball's bed (solidify it → he's cut off). */
export const SEA_FLUFFBALL_ENTRANCE = { x: 8, y: 4 } as const;
/** The flooded sun-temple inspect point (a carved sun glyph on the floor). */
export const SEA_TEMPLE = { x: 9, y: 18 } as const;
/** The silverfin fishing spot in the deepest kelp bed. */
export const SEA_FISHING = { x: 33, y: 19 } as const;

/** Carved (walkable floe) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 17, y1: 2, x2: 22, y2: 5 }, // entry overlook
  { x1: 9, y1: 3, x2: 17, y2: 4 }, // west corridor
  { x1: 8, y1: 4, x2: 8, y2: 4 }, // Fluffball bed's single entrance tile
  { x1: 4, y1: 2, x2: 7, y2: 6 }, // Fluffball's dead-end kelp bed
  { x1: 18, y1: 5, x2: 20, y2: 10 }, // south corridor
  { x1: 13, y1: 10, x2: 27, y2: 16 }, // central hub
  { x1: 10, y1: 14, x2: 13, y2: 16 }, // hub → temple connector
  { x1: 6, y1: 15, x2: 13, y2: 22 }, // flooded sun-temple ruin
  { x1: 27, y1: 12, x2: 33, y2: 13 }, // east corridor
  { x1: 30, y1: 13, x2: 37, y2: 23 }, // deepest kelp bed (fishing)
  { x1: 24, y1: 16, x2: 26, y2: 18 }, // hub → reef connector
  { x1: 24, y1: 17, x2: 31, y2: 24 } // bioluminescent reef (loop to deep bed)
];

/** Rooms that get a special (non-floe) walkable floor. */
const KELP_ROOMS = [
  { x1: 4, y1: 2, x2: 7, y2: 6 }, // Fluffball's bed
  { x1: 30, y1: 13, x2: 37, y2: 23 } // deep silverfin bed
];
const TEMPLE_ROOM = { x1: 6, y1: 15, x2: 13, y2: 22 };
const REEF_ROOM = { x1: 24, y1: 17, x2: 31, y2: 24 };

/** Solid decor obstacles (walk-arounds) — hand-placed so none seals a path. */
const KELP_STALKS: Array<[number, number]> = [
  [19, 11],
  [31, 15],
  [35, 16],
  [32, 22],
  [15, 10],
  [25, 11]
];
const CORALS: Array<[number, number]> = [
  [16, 13],
  [27, 21],
  [22, 15]
];
const MOSS_ROCKS: Array<[number, number]> = [
  [22, 13],
  [29, 23],
  [11, 21]
];
/** Submerged temple pillars flanking the sun-glyph (solid, walk-around). */
const TEMPLE_PILLARS: Array<[number, number]> = [
  [7, 16],
  [11, 16],
  [7, 20],
  [11, 20]
];
/** Walkable decorative anemones / silverfin sparkles on the floes. */
const ANEMONES: Array<[number, number]> = [
  [5, 5],
  [21, 3],
  [26, 12],
  [14, 15]
];
const SPARKLES: Array<[number, number]> = [
  [33, 20],
  [34, 18],
  [32, 19],
  [31, 21]
];
/** Bright wayfinding edge-floes at the junctions. */
const FLOE_EDGES: Array<[number, number]> = [
  [19, 5],
  [13, 13],
  [27, 13],
  [24, 17]
];

export function buildSunlessSeaMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Fill with solid, faintly-shimmering dark water.
  for (let y = 0; y < SEA_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < SEA_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 5 === 0 ? "seaWater2" : "seaWater");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Carve the floe paths out of the water.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        ground[y][x] = cellHash(x, y) % 3 === 0 ? "floe2" : "floe";
      }
    }
  }

  // Special floors for the themed rooms (all walkable).
  for (const r of KELP_ROOMS) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        if (ground[y][x] === "floe" || ground[y][x] === "floe2") {
          ground[y][x] = cellHash(x, y) % 4 === 0 ? "reefGlow" : "kelpBed";
        }
      }
    }
  }
  for (let y = TEMPLE_ROOM.y1; y <= TEMPLE_ROOM.y2; y++) {
    for (let x = TEMPLE_ROOM.x1; x <= TEMPLE_ROOM.x2; x++) {
      if (ground[y][x] === "floe" || ground[y][x] === "floe2") ground[y][x] = "templeFloor";
    }
  }
  for (let y = REEF_ROOM.y1; y <= REEF_ROOM.y2; y++) {
    for (let x = REEF_ROOM.x1; x <= REEF_ROOM.x2; x++) {
      if (ground[y][x] === "floe" || ground[y][x] === "floe2") ground[y][x] = "reefGlow";
    }
  }

  // The carved sun-glyph inspect tile.
  ground[SEA_TEMPLE.y][SEA_TEMPLE.x] = "templeGlyph";

  // Wayfinding bright edge-floes at junctions.
  for (const [x, y] of FLOE_EDGES) ground[y][x] = "floeEdge";

  // Solid decor obstacles (never on a corridor or a single entrance tile).
  for (const [x, y] of KELP_STALKS) decor[y][x] = "kelpStalk";
  for (const [x, y] of CORALS) decor[y][x] = "coral";
  for (const [x, y] of MOSS_ROCKS) decor[y][x] = "mossRock";
  for (const [x, y] of TEMPLE_PILLARS) decor[y][x] = "templePillar";

  // Walkable decorative flourishes.
  for (const [x, y] of ANEMONES) decor[y][x] = "anemone";
  for (const [x, y] of SPARKLES) decor[y][x] = "seaSparkle";

  // Rising bubbles drift over the water and the reef glow (overhead, never
  // solid). Deterministic; only over non-floe tiles so paths stay clear.
  for (let y = 1; y < SEA_HEIGHT - 1; y++) {
    for (let x = 1; x < SEA_WIDTH - 1; x++) {
      const g = ground[y][x];
      const overWater = g === "seaWater" || g === "seaWater2" || g === "reefGlow" || g === "kelpBed";
      if (overWater && cellHash(x, y) % 17 === 0) overhead[y][x] = "bubbles";
    }
  }

  return { ground, decor, overhead };
}
