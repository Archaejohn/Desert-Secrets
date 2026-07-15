/**
 * Act 4, Zone 3 — The Laundry Nook. A dead-end pocket off the camp proper's
 * west gap: the damp corner where the miners' washing hangs, and where a nest
 * of midden mites has taken hold. The whole favor-quest fight happens in this
 * one sealed room. One gate, on the east border, back to the camp proper;
 * otherwise fully enclosed by camp wall (it is a cul-de-sac ZONE).
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const NOOK_WIDTH = 18;
export const NOOK_HEIGHT = 14;

/** Default spawn: arriving from the camp proper (east gate). */
export const NOOK_SPAWN = { x: 15, y: 7 } as const;
/** The midden-mite nest at the back of the nook (interact → forced battle). */
export const NOOK_NEST = { x: 4, y: 7 } as const;
/** The arrival trigger — the reek hits you on the way in. */
export const NOOK_ENTRY_TRIGGER = { x1: 12, y1: 5, x2: 15, y2: 9 } as const;

/** East gate → back to the camp proper. */
export const NOOK_EXIT_EAST = { x1: 16, y1: 7, x2: 16, y2: 7 } as const;
export const NOOK_EAST_GATES = [{ x: 17, y: 7 }] as const;

/** Solid nook fittings (walk-arounds — none seals the nest). */
const WASHTUBS: Array<[number, number]> = [
  [3, 3],
  [9, 10]
];
const BARRELS: Array<[number, number]> = [[13, 3]];
const CAMP_POSTS: Array<[number, number]> = [
  [7, 4],
  [7, 10]
];

/** Spilled bedding + damp frost around the nest (walkable). */
const BEDROLLS: Array<[number, number]> = [
  [5, 5],
  [3, 9]
];
const FROST_PRINTS: Array<[number, number]> = [
  [11, 7],
  [8, 7],
  [5, 8]
];

export function buildLaundryNookMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < NOOK_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < NOOK_WIDTH; x++) {
      ground[y].push(cellHash(x, y) % 4 === 0 ? "campFloor2" : "campFloor");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing camp wall (one gate, east).
  for (let x = 0; x < NOOK_WIDTH; x++) {
    decor[0][x] = "campWall";
    decor[NOOK_HEIGHT - 1][x] = "campWall";
  }
  for (let y = 0; y < NOOK_HEIGHT; y++) {
    decor[y][0] = "campWall";
    decor[y][NOOK_WIDTH - 1] = "campWall";
  }
  for (const g of NOOK_EAST_GATES) decor[g.y][g.x] = null; // open the gate

  // Solid fittings (walk-arounds).
  for (const [x, y] of WASHTUBS) decor[y][x] = "washtub";
  for (const [x, y] of BARRELS) decor[y][x] = "barrel";
  for (const [x, y] of CAMP_POSTS) decor[y][x] = "campPost";

  // Walkable decor: bedding, then damp frost tracks (never over a solid prop).
  for (const [x, y] of BEDROLLS) decor[y][x] = "bedroll";
  for (const [x, y] of FROST_PRINTS) {
    if (decor[y][x] === null) decor[y][x] = "frostPrint";
  }

  // Overhead: the laundry line strung across the damp nook (never solid).
  for (let x = 2; x <= 8; x++) overhead[2][x] = "laundryLine";

  return { ground, decor, overhead };
}
