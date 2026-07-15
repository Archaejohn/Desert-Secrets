/**
 * Act 5, Zone 2 — The Grove Approach. Green begins in earnest: mossy stone,
 * fern clumps, and a bright thicket of dense needle-cactus in the east. Piggy
 * beat the party down and is snacking on a windfall of oranges here — and when
 * he's cornered, the near-catch fails as he waddle-sprints into the thicket,
 * too dense to follow. For the first time it isn't funny; he's scared. A real
 * traversal zone (sunwasps guard the fruit). Two gates: north back to the
 * descent, south on down to the river grotto; otherwise fully enclosed.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const APPROACH_WIDTH = 30;
export const APPROACH_HEIGHT = 18;

/** Default spawn: arriving from the descent (north gate). */
export const APPROACH_SPAWN = { x: 15, y: 2 } as const;
/** Where the player reappears walking back up from the river grotto. */
export const APPROACH_RETURN_SPAWN = { x: 15, y: 15 } as const;

/** The arrival trigger, up by the north spawn. */
export const APPROACH_ENTRY_TRIGGER = { x1: 13, y1: 2, x2: 17, y2: 4 } as const;

/** The windfall of fallen oranges Piggy is snacking on (walkable landmark). */
export const APPROACH_OLD_ROW = { x: 20, y: 9 } as const;
/** The dense needle-cactus thicket Piggy waddle-sprints into (SOLID). */
export const APPROACH_NEEDLE = { x: 24, y: 9 } as const;
/** The walk-over area, on the through-path, where the scared chase fires. */
export const APPROACH_CHASE_TRIGGER = { x1: 13, y1: 8, x2: 18, y2: 11 } as const;

/** North gate → back up to the descent. */
export const APPROACH_EXIT_NORTH = { x1: 14, y1: 1, x2: 15, y2: 1 } as const;
export const APPROACH_NORTH_GATES = [
  { x: 14, y: 0 },
  { x: 15, y: 0 }
] as const;

/** South gate → down to the river grotto. */
export const APPROACH_EXIT_SOUTH = { x1: 14, y1: 16, x2: 15, y2: 16 } as const;
export const APPROACH_SOUTH_GATES = [
  { x: 14, y: 17 },
  { x: 15, y: 17 }
] as const;

/** All border gates (for the enclosure test). */
export const APPROACH_BORDER_GATES = [
  ...APPROACH_NORTH_GATES,
  ...APPROACH_SOUTH_GATES
] as const;

/** SOLID mossy, vine-draped boulders (walk-arounds). */
const VINE_ROCKS: Array<[number, number]> = [
  [6, 5],
  [25, 13],
  [8, 13]
];
/** SOLID fern clumps (leafy walk-arounds), clear of the cactus thicket. */
const FERNS: Array<[number, number]> = [
  [10, 7],
  [22, 6],
  [7, 10],
  [27, 10],
  [12, 13]
];
/** SOLID cave-in rubble (walk-arounds). */
const COLLAPSED: Array<[number, number]> = [
  [4, 3],
  [27, 4],
  [3, 14]
];
/** Walkable wildflower blooms scattered in the turf. */
const FLOWERS: Array<[number, number]> = [
  [11, 4],
  [19, 4],
  [8, 8],
  [21, 13]
];

export function buildGroveApproachMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Lush river-fed grass with mossy grain (two grasses + occasional moss).
  for (let y = 0; y < APPROACH_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < APPROACH_WIDTH; x++) {
      // Clustered moss patches (not per-cell scatter) so the dressing pass
      // can author real moss↔grass transitions (§2/G9).
      const h = cellHash(x, y);
      const mossPatch = cellHash(x >> 2, y >> 2) % 5 === 0;
      ground[y].push(mossPatch ? "groveMoss" : h % 3 === 0 ? "groveGrass2" : "groveGrass");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing cave wall (two gates: north, south).
  for (let x = 0; x < APPROACH_WIDTH; x++) {
    decor[0][x] = "caveWall";
    decor[APPROACH_HEIGHT - 1][x] = "caveWall";
  }
  for (let y = 0; y < APPROACH_HEIGHT; y++) {
    decor[y][0] = "caveWall";
    decor[y][APPROACH_WIDTH - 1] = "caveWall";
  }
  for (const g of APPROACH_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // The dense needle-cactus thicket in the east — the wall Piggy vanishes into.
  for (let y = 7; y <= 10; y++) {
    for (let x = 23; x <= 26; x++) decor[y][x] = "needleCactus";
  }

  // The windfall Piggy snacks on: fallen oranges just west of the thicket.
  for (let x = 19; x <= 21; x++) ground[APPROACH_OLD_ROW.y][x] = "oldOrange";
  ground[APPROACH_OLD_ROW.y + 1][20] = "oldOrange";

  // Solid dressings (walk-arounds — none seals a needed path).
  for (const [x, y] of VINE_ROCKS) decor[y][x] = "vineRock";
  for (const [x, y] of FERNS) decor[y][x] = "fern";
  for (const [x, y] of COLLAPSED) decor[y][x] = "collapsedRock";

  // Walkable decor.
  for (const [x, y] of FLOWERS) if (decor[y][x] === null) decor[y][x] = "groveFlower";

  return dressMap({ ground, decor, overhead });
}
