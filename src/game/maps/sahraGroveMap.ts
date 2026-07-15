/**
 * Act 5, Zone 5 — Sahra's Grove. The sunniest corner of the chamber, just east
 * of the great tree: a tended little camp — drying racks, a cook-fire, the
 * grove's oldest row of oranges in neat beds — kept for decades by the woman
 * who found the cave-in. Sahra stands here; her reactive trade (the game's
 * first real Act 1 callback payoff) and the act's end card play in this zone.
 * One gate, west, back to the chamber; otherwise fully enclosed (the way on to
 * Act 6 is the end card, a teammate's next task). No random encounters.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const SAHRA_WIDTH = 22;
export const SAHRA_HEIGHT = 16;

/** Default spawn: arriving from the chamber (west gate). */
export const SAHRA_SPAWN = { x: 3, y: 8 } as const;

/** Sahra, keeper of the grove — she stands by the oldest orange row. */
export const SAHRA_NPC = { x: 11, y: 7 } as const;
/** The grove's oldest row — the ripe oranges Sahra trades (walkable landmark). */
export const SAHRA_OLD_ROW = { x: 14, y: 7 } as const;

/** The arrival trigger, by the west spawn. */
export const SAHRA_ENTRY_TRIGGER = { x1: 2, y1: 6, x2: 5, y2: 10 } as const;

/** West gate → back to the sunlit chamber. */
export const SAHRA_EXIT_WEST = { x1: 1, y1: 7, x2: 1, y2: 8 } as const;
export const SAHRA_WEST_GATES = [
  { x: 0, y: 7 },
  { x: 0, y: 8 }
] as const;

/** SOLID grove dressings (walk-arounds — none seals the way to Sahra). */
const VINE_ROCKS: Array<[number, number]> = [
  [17, 4],
  [6, 12]
];
const FERNS: Array<[number, number]> = [
  [8, 3],
  [16, 11],
  [4, 4]
];
/** Sahra's camp posts (drying racks) — SOLID props, clear of the path. */
const CAMP_POSTS: Array<[number, number]> = [
  [9, 4],
  [13, 4]
];

/** The sunlit nook where her camp sits. */
const SUNBEAM = { x1: 8, y1: 5, x2: 16, y2: 10 } as const;
/** The oldest orange row (walkable landmark tiles). */
const OLD_ROW: Array<[number, number]> = [
  [13, 7],
  [14, 7],
  [15, 7],
  [14, 8]
];
/** Walkable wildflower blooms. */
const FLOWERS: Array<[number, number]> = [
  [10, 10],
  [15, 10],
  [7, 8]
];

export function buildSahraGroveMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < SAHRA_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < SAHRA_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 7 === 0 ? "groveMoss" : h % 3 === 0 ? "groveGrass2" : "groveGrass");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing cave wall (one gate, west).
  for (let x = 0; x < SAHRA_WIDTH; x++) {
    decor[0][x] = "caveWall";
    decor[SAHRA_HEIGHT - 1][x] = "caveWall";
  }
  for (let y = 0; y < SAHRA_HEIGHT; y++) {
    decor[y][0] = "caveWall";
    decor[y][SAHRA_WIDTH - 1] = "caveWall";
  }
  for (const g of SAHRA_WEST_GATES) decor[g.y][g.x] = null; // open the gate

  // The sunlit nook where her camp sits.
  for (let y = SUNBEAM.y1; y <= SUNBEAM.y2; y++) {
    for (let x = SUNBEAM.x1; x <= SUNBEAM.x2; x++) ground[y][x] = "sunbeam";
  }

  // The oldest orange row (walkable landmark).
  for (const [x, y] of OLD_ROW) ground[y][x] = "oldOrange";

  // Solid dressings (walk-arounds — none seals the way to Sahra).
  for (const [x, y] of VINE_ROCKS) decor[y][x] = "vineRock";
  for (const [x, y] of FERNS) decor[y][x] = "fern";
  for (const [x, y] of CAMP_POSTS) decor[y][x] = "campPost";

  // Walkable decor.
  for (const [x, y] of FLOWERS) if (decor[y][x] === null) decor[y][x] = "groveFlower";

  return { ground, decor, overhead };
}
