/**
 * Act 5, Zone 3 — The River Grotto. A short connecting cavern where the
 * underground river wells up out of the rock and runs on toward the light —
 * the same water table that feeds the oasis spring far above. A quiet breather
 * between the tense approach and the big reveal: a mossy pool, wet stepping
 * stones, first real green. Two gates: north back to the approach, south on
 * into the sunlit chamber; otherwise enclosed. No random encounters.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const GROTTO_WIDTH = 22;
export const GROTTO_HEIGHT = 16;

/** Default spawn: arriving from the approach (north gate). */
export const GROTTO_SPAWN = { x: 11, y: 2 } as const;
/** Where the player reappears walking back up from the sunlit chamber. */
export const GROTTO_RETURN_SPAWN = { x: 11, y: 13 } as const;

/** The arrival trigger, up by the north spawn. */
export const GROTTO_ENTRY_TRIGGER = { x1: 9, y1: 2, x2: 13, y2: 4 } as const;

/** The river's source pool (scenic landmark, on the north bank). */
export const GROTTO_POOL = { x: 11, y: 6 } as const;

/** North gate → back up to the approach. */
export const GROTTO_EXIT_NORTH = { x1: 10, y1: 1, x2: 11, y2: 1 } as const;
export const GROTTO_NORTH_GATES = [
  { x: 10, y: 0 },
  { x: 11, y: 0 }
] as const;

/** South gate → on into the sunlit chamber. */
export const GROTTO_EXIT_SOUTH = { x1: 10, y1: 14, x2: 11, y2: 14 } as const;
export const GROTTO_SOUTH_GATES = [
  { x: 10, y: 15 },
  { x: 11, y: 15 }
] as const;

/** All border gates (for the enclosure test). */
export const GROTTO_BORDER_GATES = [
  ...GROTTO_NORTH_GATES,
  ...GROTTO_SOUTH_GATES
] as const;

/** SOLID mossy boulders + ferns (walk-arounds, clear of the crossing). */
const VINE_ROCKS: Array<[number, number]> = [
  [4, 4],
  [17, 11]
];
const FERNS: Array<[number, number]> = [
  [3, 11],
  [18, 4],
  [6, 12]
];

/** The river channel (two animated water rows) spanning the grotto. */
const RIVER_ROWS = [8, 9] as const;
const RIVER_X1 = 2;
const RIVER_X2 = 19;
/** The wet stepping-stone crossing that keeps the far bank reachable. */
const CROSSING_X = [10, 11] as const;

export function buildGroveGrottoMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < GROTTO_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < GROTTO_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 5 === 0 ? "groveGrass2" : "groveMoss");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing cave wall (two gates: north, south).
  for (let x = 0; x < GROTTO_WIDTH; x++) {
    decor[0][x] = "caveWall";
    decor[GROTTO_HEIGHT - 1][x] = "caveWall";
  }
  for (let y = 0; y < GROTTO_HEIGHT; y++) {
    decor[y][0] = "caveWall";
    decor[y][GROTTO_WIDTH - 1] = "caveWall";
  }
  for (const g of GROTTO_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // The underground river across the middle, with wet-stone banks and one
  // stepping-stone crossing so both banks stay reachable.
  for (let x = RIVER_X1; x <= RIVER_X2; x++) {
    ground[RIVER_ROWS[0]][x] = "groveWater";
    ground[RIVER_ROWS[1]][x] = "groveWater2";
    decor[RIVER_ROWS[0]][x] = "groveWater";
    decor[RIVER_ROWS[1]][x] = "groveWater2";
    ground[RIVER_ROWS[0] - 1][x] = "riverStone"; // north bank
  }
  for (const x of CROSSING_X) {
    for (const y of RIVER_ROWS) {
      ground[y][x] = "riverStone";
      decor[y][x] = null; // open the crossing (walkable)
    }
    ground[RIVER_ROWS[1] + 1][x] = "riverStone"; // south landing
  }

  // Solid dressings (walk-arounds — none seals the crossing).
  for (const [x, y] of VINE_ROCKS) decor[y][x] = "vineRock";
  for (const [x, y] of FERNS) decor[y][x] = "fern";

  return { ground, decor, overhead };
}
