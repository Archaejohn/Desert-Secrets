/**
 * Act 3, Zone 4 — Fluffball's Kelp Bed. A dead-end pocket off the kelp
 * forest, reached down the south spur. A single glimmering kelp bed where
 * the gray chick is cornered once, drops the silverfin clue, and bolts. One
 * gate, on the north border, back up to the kelp forest; otherwise fully
 * enclosed by solid water (a cul-de-sac ZONE).
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const FLUFFBED_WIDTH = 18;
export const FLUFFBED_HEIGHT = 14;

/** Default spawn: arriving from the kelp forest (north gate). */
export const FLUFFBED_SPAWN = { x: 8, y: 3 } as const;
/**
 * A five-stage chase across the bed before Fluffball is actually cornered:
 * first sighted mid-bed, flees deeper across four more waypoints (two of
 * them carrying a Joseph/Slither planning aside instead of a Fluffball
 * reaction line, so the player hears WHY they're doing this partway
 * through, not just at the very end), then finally corners himself in the
 * small nook (a dead end within the dead end) with nowhere left to run.
 * Each stage has its own approach-trigger rect.
 */
export const FLUFFBED_FLUFFBALL = { x: 12, y: 8 } as const;
export const FLUFFBED_TRIGGER = { x1: 10, y1: 6, x2: 13, y2: 9 } as const;

/** Stage 2 — a planning aside, no Fluffball reaction line. */
export const FLUFFBED_STAGE_A = { x: 10, y: 4 } as const;
export const FLUFFBED_STAGE_A_TRIGGER = { x1: 9, y1: 3, x2: 12, y2: 5 } as const;

export const FLUFFBED_STAGE2 = { x: 7, y: 7 } as const;
export const FLUFFBED_STAGE2_TRIGGER = { x1: 5, y1: 6, x2: 8, y2: 8 } as const;

/** Stage 4 — a second planning aside, no Fluffball reaction line. */
export const FLUFFBED_STAGE_C = { x: 5, y: 8 } as const;
export const FLUFFBED_STAGE_C_TRIGGER = { x1: 4, y1: 7, x2: 6, y2: 9 } as const;

/** The nook — where he's finally cornered, matching the CARVES nook rect. */
export const FLUFFBED_CORNERED = { x: 3, y: 10 } as const;
export const FLUFFBED_CORNERED_TRIGGER = { x1: 2, y1: 9, x2: 4, y2: 11 } as const;

/** North gate → back up to the kelp forest. */
export const FLUFFBED_EXIT_NORTH = { x1: 8, y1: 1, x2: 9, y2: 1 } as const;
export const FLUFFBED_NORTH_GATES = [
  { x: 8, y: 0 },
  { x: 9, y: 0 }
] as const;

/** Carved (walkable) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 8, y1: 1, x2: 9, y2: 2 }, // north exit stub (down into the bed)
  { x1: 3, y1: 3, x2: 14, y2: 10 }, // the kelp bed
  { x1: 2, y1: 9, x2: 4, y2: 11 } // a small nook
];

/** Solid sea decor (walk-arounds). */
const KELP_STALKS: Array<[number, number]> = [
  [5, 4],
  [13, 4],
  [6, 9]
];
const CORALS: Array<[number, number]> = [
  [11, 5],
  [3, 6]
];
/** Walkable flourishes. */
const ANEMONES: Array<[number, number]> = [
  [8, 5],
  [12, 9],
  [3, 10]
];
const SPARKLES: Array<[number, number]> = [
  [10, 7],
  [13, 8]
];

export function buildFluffballBedMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < FLUFFBED_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < FLUFFBED_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 5 === 0 ? "seaWater2" : "seaWater");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Carve the kelp bed out of the water.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        ground[y][x] = cellHash(x, y) % 4 === 0 ? "reefGlow" : "kelpBed";
      }
    }
  }
  for (const g of FLUFFBED_NORTH_GATES) ground[g.y][g.x] = "floe";

  // Solid decor (walk-arounds).
  for (const [x, y] of KELP_STALKS) decor[y][x] = "kelpStalk";
  for (const [x, y] of CORALS) decor[y][x] = "coral";
  // Walkable flourishes.
  for (const [x, y] of ANEMONES) decor[y][x] = "anemone";
  for (const [x, y] of SPARKLES) decor[y][x] = "seaSparkle";

  // Rising bubbles over the water (overhead, never solid).
  for (let y = 1; y < FLUFFBED_HEIGHT - 1; y++) {
    for (let x = 1; x < FLUFFBED_WIDTH - 1; x++) {
      const g = ground[y][x];
      if ((g === "seaWater" || g === "seaWater2") && cellHash(x, y) % 13 === 0) {
        overhead[y][x] = "bubbles";
      }
    }
  }

  return { ground, decor, overhead };
}
