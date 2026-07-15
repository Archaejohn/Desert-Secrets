/**
 * Act 3, Zone 6 — The Ascent. The physical, narrated way OUT of the Sunless
 * Sea: an old miners' service shaft climbs from a last floe landing up
 * through a rime-crusted chimney toward the surface workings. The party
 * reaches it from the deep bed (spawned in at the bottom landing once the
 * silverfin is caught); the top gate hands off to the miners' camp (Act 4).
 * Fully enclosed by solid water/ice except that single top gate.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const ASCENT_WIDTH = 20;
export const ASCENT_HEIGHT = 18;

/** Default spawn: the last floe landing at the foot of the shaft. */
export const ASCENT_SPAWN = { x: 9, y: 15 } as const;
/** The midway ledge where the climb is narrated. */
export const ASCENT_LEDGE = { x: 9, y: 9 } as const;
/** The climb-beat trigger area on the ledge. */
export const ASCENT_TRIGGER = { x1: 7, y1: 8, x2: 12, y2: 10 } as const;

/** Top gate → up into the miners' camp (Act 4). */
export const ASCENT_EXIT_TOP = { x1: 9, y1: 1, x2: 10, y2: 1 } as const;
export const ASCENT_TOP_GATES = [
  { x: 9, y: 0 },
  { x: 10, y: 0 }
] as const;

/** Carved (walkable) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 9, y1: 1, x2: 10, y2: 2 }, // top exit stub
  { x1: 9, y1: 3, x2: 10, y2: 13 }, // the chimney shaft
  { x1: 6, y1: 8, x2: 13, y2: 10 }, // the midway ledge
  { x1: 7, y1: 13, x2: 12, y2: 16 } // the foot landing
];

/** The service ladder's rungs run up the shaft (walkable wayfinding). */
const FLOE_EDGES: Array<[number, number]> = [
  [9, 4],
  [10, 6],
  [9, 8],
  [10, 11],
  [9, 13]
];
/** Solid rime rocks bracketing the shaft (walk-arounds). */
const MOSS_ROCKS: Array<[number, number]> = [
  [6, 9],
  [13, 9],
  [7, 16],
  [12, 16]
];
const ANEMONES: Array<[number, number]> = [
  [8, 15],
  [11, 15]
];

export function buildSeaAscentMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < ASCENT_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < ASCENT_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 5 === 0 ? "seaWater2" : "seaWater");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Carve the shaft, ledge and landing out of the dark.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        ground[y][x] = cellHash(x, y) % 3 === 0 ? "floe2" : "floe";
      }
    }
  }
  for (const g of ASCENT_TOP_GATES) ground[g.y][g.x] = "floe";

  // Ladder rungs (bright wayfinding) and solid rime rocks.
  for (const [x, y] of FLOE_EDGES) ground[y][x] = "floeEdge";
  for (const [x, y] of MOSS_ROCKS) decor[y][x] = "mossRock";
  for (const [x, y] of ANEMONES) decor[y][x] = "anemone";

  // Rising bubbles cluster low, near the drowned foot of the shaft.
  for (let y = 1; y < ASCENT_HEIGHT - 1; y++) {
    for (let x = 1; x < ASCENT_WIDTH - 1; x++) {
      const g = ground[y][x];
      if ((g === "seaWater" || g === "seaWater2") && y > 6 && cellHash(x, y) % 11 === 0) {
        overhead[y][x] = "bubbles";
      }
    }
  }

  return { ground, decor, overhead };
}
