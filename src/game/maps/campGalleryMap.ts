/**
 * Act 4, Zone 4 — The Back Gallery. A disused Cinnabar drift climbing out of
 * the camp: the frost-print trail of Piggy's night raids leads up through it,
 * switching back past two half-collapsed walls toward a high ledge. This is
 * the connecting climb between the camp proper and Fluffball's overlook — a
 * real traversal zone (random encounters), not a bare hop. A south gate back
 * to the camp, a north gate up to the ledge; otherwise enclosed.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const GALLERY_WIDTH = 20;
export const GALLERY_HEIGHT = 18;

/** Default spawn: arriving from the camp proper (south gate). */
export const GALLERY_SPAWN = { x: 10, y: 15 } as const;
/** Where the player reappears climbing back down from the ledge. */
export const GALLERY_LEDGE_RETURN_SPAWN = { x: 10, y: 2 } as const;

/** The frost-track beat, midway up the climb (the raids' trail). */
export const GALLERY_TRACKS = { x: 4, y: 9 } as const;
/** The arrival trigger — the tracks catch the eye on the way in. */
export const GALLERY_ENTRY_TRIGGER = { x1: 8, y1: 13, x2: 12, y2: 15 } as const;

/** South gate → back to the camp proper. */
export const GALLERY_EXIT_SOUTH = { x1: 9, y1: 16, x2: 10, y2: 16 } as const;
export const GALLERY_SOUTH_GATES = [
  { x: 9, y: 17 },
  { x: 10, y: 17 }
] as const;

/** North gate → up to Fluffball's ledge. */
export const GALLERY_EXIT_NORTH = { x1: 9, y1: 1, x2: 10, y2: 1 } as const;
export const GALLERY_NORTH_GATES = [
  { x: 9, y: 0 },
  { x: 10, y: 0 }
] as const;

/** All border gates (for the enclosure test). */
export const GALLERY_BORDER_GATES = [
  ...GALLERY_SOUTH_GATES,
  ...GALLERY_NORTH_GATES
] as const;

/** The two half-collapsed cross-walls forcing the switchback climb. */
const WALL_A_ROW = 6; // gap on the east (x = 13..18)
const WALL_B_ROW = 11; // gap on the west (x = 1..6)

/** Solid mine clutter bracketing the drift (walk-arounds). */
const BARRELS: Array<[number, number]> = [
  [17, 8],
  [2, 14]
];
const CRATES: Array<[number, number]> = [[16, 14]];

/** The raids' frost tracks, climbing the switchback. */
const FROST_PRINTS: Array<[number, number]> = [
  [10, 13],
  [4, 12],
  [4, 9], // GALLERY_TRACKS
  [15, 8],
  [9, 4]
];

export function buildCampGalleryMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < GALLERY_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < GALLERY_WIDTH; x++) {
      ground[y].push(cellHash(x, y) % 4 === 0 ? "campFloor2" : "campFloor");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing camp wall (two gates: south, north).
  for (let x = 0; x < GALLERY_WIDTH; x++) {
    decor[0][x] = "campWall";
    decor[GALLERY_HEIGHT - 1][x] = "campWall";
  }
  for (let y = 0; y < GALLERY_HEIGHT; y++) {
    decor[y][0] = "campWall";
    decor[y][GALLERY_WIDTH - 1] = "campWall";
  }

  // Cross-wall A (gap east) and cross-wall B (gap west) — the switchback.
  for (let x = 1; x <= 12; x++) decor[WALL_A_ROW][x] = "campWall";
  for (let x = 7; x <= 18; x++) decor[WALL_B_ROW][x] = "campWall";
  for (const g of GALLERY_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // Solid clutter (walk-arounds — placed clear of the through-path).
  for (const [x, y] of BARRELS) decor[y][x] = "barrel";
  for (const [x, y] of CRATES) decor[y][x] = "crate";

  // The raids' frost tracks (walkable — never over a solid prop/wall).
  for (const [x, y] of FROST_PRINTS) {
    if (decor[y][x] === null) decor[y][x] = "frostPrint";
  }

  // Overhead: a strand of string lights spilling up from the camp (never solid).
  for (const x of [8, 11]) overhead[15][x] = "stringLights";

  return dressMap({ ground, decor, overhead });
}
