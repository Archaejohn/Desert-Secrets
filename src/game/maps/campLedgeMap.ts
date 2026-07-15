/**
 * Act 4, Zone 5 — The Overlook Ledge. A small vantage at the head of the back
 * gallery, looking down over the camp's string lights. A dead-end pocket: the
 * gray chick is glimpsed here once, blurts clue #2 (the RIPEST socks), and
 * bolts. He does NOT join here (that's Act 5). One gate, on the south border,
 * back down to the gallery; otherwise fully enclosed (a cul-de-sac ZONE).
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const LEDGE_WIDTH = 18;
export const LEDGE_HEIGHT = 14;

/** Default spawn: cresting the gallery onto the ledge (south gate). */
export const LEDGE_SPAWN = { x: 9, y: 11 } as const;
/** Fluffball's perch on the high side of the ledge (glimpse + clue #2). */
export const LEDGE_FLUFFBALL = { x: 4, y: 3 } as const;
/** The arrival trigger, down by the spawn (kept clear of the glimpse rect). */
export const LEDGE_ENTRY_TRIGGER = { x1: 7, y1: 9, x2: 11, y2: 11 } as const;
/** The trigger area where the ledge glimpse fires (up on the perch). */
export const LEDGE_TRIGGER = { x1: 3, y1: 2, x2: 7, y2: 5 } as const;

/** South gate → back down to the gallery. */
export const LEDGE_EXIT_SOUTH = { x1: 8, y1: 12, x2: 9, y2: 12 } as const;
export const LEDGE_SOUTH_GATES = [
  { x: 8, y: 13 },
  { x: 9, y: 13 }
] as const;

/** Solid ledge props (walk-arounds — none seals Fluffball's perch). */
const CAMP_POSTS: Array<[number, number]> = [
  [7, 3],
  [12, 4]
];
const BARRELS: Array<[number, number]> = [[14, 9]];

/** Frost tracks up onto the perch (walkable). */
const FROST_PRINTS: Array<[number, number]> = [
  [9, 9],
  [7, 6],
  [5, 4]
];

export function buildCampLedgeMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < LEDGE_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < LEDGE_WIDTH; x++) {
      ground[y].push(cellHash(x, y) % 4 === 0 ? "campFloor2" : "campFloor");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing camp wall (one gate, south).
  for (let x = 0; x < LEDGE_WIDTH; x++) {
    decor[0][x] = "campWall";
    decor[LEDGE_HEIGHT - 1][x] = "campWall";
  }
  for (let y = 0; y < LEDGE_HEIGHT; y++) {
    decor[y][0] = "campWall";
    decor[y][LEDGE_WIDTH - 1] = "campWall";
  }
  for (const g of LEDGE_SOUTH_GATES) decor[g.y][g.x] = null; // open the gate

  // Solid props (walk-arounds).
  for (const [x, y] of CAMP_POSTS) decor[y][x] = "campPost";
  for (const [x, y] of BARRELS) decor[y][x] = "barrel";

  // Frost tracks up to the perch (walkable — never over a solid prop).
  for (const [x, y] of FROST_PRINTS) {
    if (decor[y][x] === null) decor[y][x] = "frostPrint";
  }

  // Overhead: string lights of the camp glimpsed below the ledge (never solid).
  for (const x of [10, 13]) overhead[10][x] = "stringLights";

  return dressMap({ ground, decor, overhead });
}
