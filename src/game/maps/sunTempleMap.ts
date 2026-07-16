/**
 * Act 3, Zone 3 — The Sun-Temple Ruin. A dead-end pocket off the kelp
 * forest: the flooded ruins of a sun-god's temple nobody topside ever knew
 * was down here. A few rooms to explore — an antechamber by the entrance, a
 * pillared main hall with the carved sun-glyph on its floor, and a small
 * inner sanctum beyond. One gate, on the east border, back up to the kelp
 * forest; otherwise fully enclosed by solid water (it is a cul-de-sac ZONE).
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const SUNTEMPLE_WIDTH = 22;
export const SUNTEMPLE_HEIGHT = 16;

/** Default spawn: arriving from the kelp forest (east gate). */
export const SUNTEMPLE_SPAWN = { x: 18, y: 7 } as const;
/** The carved sun-glyph on the main hall floor (the templeLore inspect point). */
export const SUNTEMPLE_GLYPH = { x: 7, y: 7 } as const;
/** The inner sanctum, a step beyond the hall. */
export const SUNTEMPLE_SANCTUM = { x: 2, y: 8 } as const;

/** East gate → back up to the kelp forest. */
export const SUNTEMPLE_EXIT_EAST = { x1: 20, y1: 7, x2: 20, y2: 7 } as const;
export const SUNTEMPLE_EAST_GATES = [{ x: 21, y: 7 }] as const;

/** Carved (walkable) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 20, y1: 7, x2: 20, y2: 7 }, // east exit stub
  { x1: 14, y1: 5, x2: 19, y2: 10 }, // antechamber
  { x1: 10, y1: 7, x2: 14, y2: 7 }, // corridor A
  { x1: 4, y1: 4, x2: 10, y2: 11 }, // pillared main hall
  { x1: 2, y1: 8, x2: 4, y2: 8 }, // corridor B
  { x1: 1, y1: 6, x2: 3, y2: 10 } // inner sanctum
];

/** Submerged temple pillars flanking the hall (solid, walk-around). */
const TEMPLE_PILLARS: Array<[number, number]> = [
  [5, 5],
  [9, 5],
  [5, 10],
  [9, 10]
];
/** Solid sea decor (walk-arounds). */
const MOSS_ROCKS: Array<[number, number]> = [
  [17, 9],
  [2, 6]
];
const CORALS: Array<[number, number]> = [[16, 6]];
/** Walkable flourishes. */
const ANEMONES: Array<[number, number]> = [
  [18, 8],
  [8, 8],
  [2, 9]
];

export function buildSunTempleMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < SUNTEMPLE_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < SUNTEMPLE_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 5 === 0 ? "seaWater2" : "seaWater");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Carve the temple out of the flooded dark.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) ground[y][x] = "templeFloor";
    }
  }
  for (const g of SUNTEMPLE_EAST_GATES) ground[g.y][g.x] = "templeFloor";

  // The carved sun-glyph.
  ground[SUNTEMPLE_GLYPH.y][SUNTEMPLE_GLYPH.x] = "templeGlyph";

  // Solid decor (walk-arounds).
  for (const [x, y] of TEMPLE_PILLARS) decor[y][x] = "templePillar";
  for (const [x, y] of MOSS_ROCKS) decor[y][x] = "mossRock";
  for (const [x, y] of CORALS) decor[y][x] = "coral";
  for (const [x, y] of ANEMONES) decor[y][x] = "anemone";

  // Rising bubbles over the drowned floor (overhead, never solid).
  for (let y = 1; y < SUNTEMPLE_HEIGHT - 1; y++) {
    for (let x = 1; x < SUNTEMPLE_WIDTH - 1; x++) {
      const g = ground[y][x];
      if ((g === "seaWater" || g === "seaWater2") && cellHash(x, y) % 15 === 0) {
        overhead[y][x] = "bubbles";
      }
    }
  }

  return dressMap({ ground, decor, overhead });
}
