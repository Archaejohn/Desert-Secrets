/**
 * Act 6, Zone 4 — The Glowing Hollow. A quiet breather cavern past the coral
 * warren: dark reef silt lit only by bioluminescence, a still bioluminescent
 * pool and a cold reef channel with a stepping-stone crossing keeping both
 * banks reachable. The crawlers' cultivated mint-kelp beds run down through it
 * toward their elders. A beat to let the tense chase settle before the
 * diplomacy. Two gates: north back to the warren, south on to the crawler
 * court; otherwise enclosed. No random encounters.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const REEF_H_WIDTH = 22;
export const REEF_H_HEIGHT = 16;

/** Default spawn: arriving from the warren (north gate). */
export const REEF_H_SPAWN = { x: 11, y: 2 } as const;
/** Where the player reappears walking back up from the crawler court. */
export const REEF_H_RETURN_SPAWN = { x: 11, y: 13 } as const;

/** The arrival trigger, up by the north spawn. */
export const REEF_H_ENTRY_TRIGGER = { x1: 9, y1: 2, x2: 13, y2: 4 } as const;

/** The still bioluminescent pool (scenic landmark, on the north bank). */
export const REEF_H_POOL = { x: 11, y: 6 } as const;

/** North gate → back up to the coral warren. */
export const REEF_H_EXIT_NORTH = { x1: 10, y1: 1, x2: 11, y2: 1 } as const;
export const REEF_H_NORTH_GATES = [
  { x: 10, y: 0 },
  { x: 11, y: 0 }
] as const;

/** South gate → on to the crawler court. */
export const REEF_H_EXIT_SOUTH = { x1: 10, y1: 14, x2: 11, y2: 14 } as const;
export const REEF_H_SOUTH_GATES = [
  { x: 10, y: 15 },
  { x: 11, y: 15 }
] as const;

/** All border gates (for the enclosure test). */
export const REEF_H_BORDER_GATES = [
  ...REEF_H_NORTH_GATES,
  ...REEF_H_SOUTH_GATES
] as const;

/** SOLID coral + wild kelp (walk-arounds, clear of the crossing). */
const CORAL: Array<[number, number]> = [
  [4, 4],
  [17, 11]
];
const WILD_KELP: Array<[number, number]> = [
  [3, 11],
  [18, 4],
  [6, 12]
];
/** Cultivated mint-kelp beds (WALKABLE decor) leading down to the court. */
const MINT_ROWS: Array<[number, number]> = [
  [11, 11],
  [12, 11],
  [11, 12],
  [10, 12]
];

/** The reef channel (two animated water rows) spanning the hollow. */
const RIVER_ROWS = [8, 9] as const;
const RIVER_X1 = 2;
const RIVER_X2 = 19;
/** The wet stepping-stone crossing that keeps the far bank reachable. */
const CROSSING_X = [10, 11] as const;

export function buildReefHollowMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < REEF_H_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < REEF_H_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 5 === 0 ? "glowMoss" : "reefSilt");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing reef wall (two gates: north, south).
  for (let x = 0; x < REEF_H_WIDTH; x++) {
    decor[0][x] = "reefWall";
    decor[REEF_H_HEIGHT - 1][x] = "reefWall";
  }
  for (let y = 0; y < REEF_H_HEIGHT; y++) {
    decor[y][0] = "reefWall";
    decor[y][REEF_H_WIDTH - 1] = "reefWall";
  }
  for (const g of REEF_H_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // The reef channel across the middle, with a wet-stone bank and one
  // stepping-stone crossing so both banks stay reachable.
  for (let x = RIVER_X1; x <= RIVER_X2; x++) {
    ground[RIVER_ROWS[0]][x] = "reefWater";
    ground[RIVER_ROWS[1]][x] = "reefWater2";
    decor[RIVER_ROWS[0]][x] = "reefWater";
    decor[RIVER_ROWS[1]][x] = "reefWater2";
    ground[RIVER_ROWS[0] - 1][x] = "reefStone"; // north bank
  }
  for (const x of CROSSING_X) {
    for (const y of RIVER_ROWS) {
      ground[y][x] = "reefStone";
      decor[y][x] = null; // open the crossing (walkable)
    }
    ground[RIVER_ROWS[1] + 1][x] = "reefStone"; // south landing
  }

  // Cultivated mint-kelp beds (walkable) on the south bank.
  for (const [x, y] of MINT_ROWS) ground[y][x] = "mintKelp";

  // Solid dressings (walk-arounds — none seals the crossing).
  for (const [x, y] of CORAL) decor[y][x] = "coralHead";
  for (const [x, y] of WILD_KELP) decor[y][x] = "wildKelp";

  return { ground, decor, overhead };
}
