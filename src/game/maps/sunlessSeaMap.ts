/**
 * Act 3, Zone 1 — The Sunless Sea (the entry overlook). Where the crack the
 * penguins dove through drops the party: the first sight of the
 * bioluminescent cavern ocean, before any real traversal. An overlook floe
 * (the comic Piggy-chase beat plays here — two shapes skating far out on the
 * water) and a short path down to the south gate into the kelp forest
 * proper. Mostly solid dark `seaWater` with walkable `floe` carved through
 * it; the one gate is the south way on (otherwise fully enclosed).
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const SEA_WIDTH = 24;
export const SEA_HEIGHT = 16;

/** Default spawn: dropped in through the crack at the north overlook. */
export const SEA_SPAWN = { x: 12, y: 3 } as const;
/** Where the player appears when walking back up from the kelp forest. */
export const SEA_KELP_RETURN_SPAWN = { x: 11, y: 12 } as const;
/** The chase overlook trigger — Piggy is spotted out on the ice. */
export const SEA_CHASE_TRIGGER = { x1: 9, y1: 5, x2: 14, y2: 5 } as const;

/** South gate → down into the kelp forest. */
export const SEA_EXIT_SOUTH = { x1: 11, y1: 14, x2: 12, y2: 14 } as const;
export const SEA_SOUTH_GATES = [
  { x: 11, y: 15 },
  { x: 12, y: 15 }
] as const;

/** Carved (walkable floe) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 7, y1: 2, x2: 16, y2: 6 }, // the entry overlook
  { x1: 11, y1: 6, x2: 12, y2: 14 }, // the descent corridor + south stub
  { x1: 7, y1: 10, x2: 16, y2: 13 } // the lower ledge
];

/** Bright wayfinding edge-floes. */
const FLOE_EDGES: Array<[number, number]> = [
  [12, 6],
  [11, 10],
  [12, 13]
];
/** Solid sea decor (walk-arounds — none seals the descent). */
const KELP_STALKS: Array<[number, number]> = [
  [8, 3],
  [15, 4],
  [8, 12],
  [15, 11]
];
const CORALS: Array<[number, number]> = [
  [14, 3],
  [9, 11]
];
/** Walkable flourishes. */
const ANEMONES: Array<[number, number]> = [
  [10, 3],
  [13, 12]
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

  // Carve the overlook and descent out of the water.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        ground[y][x] = cellHash(x, y) % 3 === 0 ? "floe2" : "floe";
      }
    }
  }
  for (const g of SEA_SOUTH_GATES) ground[g.y][g.x] = "floe";

  // Wayfinding bright edge-floes.
  for (const [x, y] of FLOE_EDGES) ground[y][x] = "floeEdge";

  // Solid decor obstacles (never on the descent corridor).
  for (const [x, y] of KELP_STALKS) decor[y][x] = "kelpStalk";
  for (const [x, y] of CORALS) decor[y][x] = "coral";
  for (const [x, y] of ANEMONES) decor[y][x] = "anemone";

  // Rising bubbles drift over the dark water (overhead, never solid).
  for (let y = 1; y < SEA_HEIGHT - 1; y++) {
    for (let x = 1; x < SEA_WIDTH - 1; x++) {
      const g = ground[y][x];
      if ((g === "seaWater" || g === "seaWater2") && cellHash(x, y) % 15 === 0) {
        overhead[y][x] = "bubbles";
      }
    }
  }

  return { ground, decor, overhead };
}
