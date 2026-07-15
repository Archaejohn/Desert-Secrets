/**
 * Act 3, Zone 5 — The Deep Kelp Bed. The climax zone of the Sunless Sea:
 * past where the light gives out, this is where the silverfin runs. A short
 * floe approach from the kelp forest (west gate) opens into a wide, dark
 * kelp-and-reef bed with the fishing spot at its heart. There is only the
 * one gate (back west to the kelp forest); the way ONWARD — up out of the
 * sea — is opened narratively once the silverfin is landed (the scene hands
 * off to the ascent zone), so the map itself is otherwise fully enclosed.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const DEEP_WIDTH = 28;
export const DEEP_HEIGHT = 20;

/** Default spawn: arriving from the kelp forest (west gate). */
export const DEEP_SPAWN = { x: 4, y: 9 } as const;
/** The silverfin fishing spot at the heart of the bed. */
export const DEEP_FISHING = { x: 15, y: 9 } as const;
/** A far corner landmark (for reachability). */
export const DEEP_FAR = { x: 20, y: 14 } as const;

/** West gate → back to the kelp forest. */
export const DEEP_EXIT_WEST = { x1: 1, y1: 9, x2: 1, y2: 10 } as const;
export const DEEP_WEST_GATES = [
  { x: 0, y: 9 },
  { x: 0, y: 10 }
] as const;

/** Carved (walkable) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 1, y1: 9, x2: 1, y2: 10 }, // west exit stub
  { x1: 2, y1: 9, x2: 6, y2: 10 }, // floe approach corridor
  { x1: 6, y1: 3, x2: 22, y2: 16 } // the deep kelp-and-reef bed
];

/** Solid sea decor (walk-arounds — none seals the fishing spot). */
const KELP_STALKS: Array<[number, number]> = [
  [9, 5],
  [19, 6],
  [12, 13],
  [21, 12],
  [8, 14]
];
const CORALS: Array<[number, number]> = [
  [18, 9],
  [11, 6],
  [20, 15]
];
const MOSS_ROCKS: Array<[number, number]> = [
  [13, 5],
  [17, 14],
  [9, 11]
];
/** Walkable flourishes; the silverfin water glitters. */
const ANEMONES: Array<[number, number]> = [
  [7, 4],
  [21, 4],
  [10, 15]
];
const SPARKLES: Array<[number, number]> = [
  [15, 8],
  [14, 10],
  [16, 10],
  [15, 11]
];

export function buildDeepBedMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < DEEP_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < DEEP_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 5 === 0 ? "seaWater2" : "seaWater");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Carve the approach and the deep bed out of the dark water.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        ground[y][x] = cellHash(x, y) % 3 === 0 ? "floe2" : "floe";
      }
    }
  }
  // The deep bed itself is kelp and reef glow.
  for (let y = 3; y <= 16; y++) {
    for (let x = 6; x <= 22; x++) {
      if (ground[y][x] === "floe" || ground[y][x] === "floe2") {
        ground[y][x] = cellHash(x, y) % 4 === 0 ? "reefGlow" : "kelpBed";
      }
    }
  }
  for (const g of DEEP_WEST_GATES) ground[g.y][g.x] = "floe";

  // Solid decor (walk-arounds).
  for (const [x, y] of KELP_STALKS) decor[y][x] = "kelpStalk";
  for (const [x, y] of CORALS) decor[y][x] = "coral";
  for (const [x, y] of MOSS_ROCKS) decor[y][x] = "mossRock";
  // Walkable flourishes.
  for (const [x, y] of ANEMONES) decor[y][x] = "anemone";
  for (const [x, y] of SPARKLES) decor[y][x] = "seaSparkle";

  // Rising bubbles over the water (overhead, never solid).
  for (let y = 1; y < DEEP_HEIGHT - 1; y++) {
    for (let x = 1; x < DEEP_WIDTH - 1; x++) {
      const g = ground[y][x];
      if ((g === "seaWater" || g === "seaWater2") && cellHash(x, y) % 17 === 0) {
        overhead[y][x] = "bubbles";
      }
    }
  }

  return dressMap({ ground, decor, overhead });
}
