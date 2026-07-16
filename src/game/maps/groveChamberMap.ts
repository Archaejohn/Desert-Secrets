/**
 * Act 5, Zone 4 — The Sunlit Cave-In. THE grove chamber: a disused Cinnabar
 * gallery whose ceiling collapsed long ago, opening a shaft straight up to the
 * desert floor. Sunlight pours down through the hole; the underground river
 * waters the floor into the greenest place in the whole game — moss, ferns,
 * vines up the collapsed rock. **One orange tree grows at the dead centre of
 * the chamber** (CHAMBER_TREE): a solid trunk under a leafy OVERHEAD canopy the
 * party walks beneath, standing in the bright `sunbeam` shaft — the visual and
 * narrative focal point. Fluffball, shaken by the scared chase, edges out of
 * the ferns and JOINS here. Two gates: north back to the grotto, east on to
 * Sahra's corner; otherwise fully enclosed. Sunwasps guard the fruit.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const CHAMBER_WIDTH = 30;
export const CHAMBER_HEIGHT = 20;

/** Default spawn: arriving from the river grotto (north gate). */
export const CHAMBER_SPAWN = { x: 15, y: 3 } as const;
/** Where the player reappears walking back west from Sahra's corner. */
export const CHAMBER_RETURN_SPAWN = { x: 26, y: 10 } as const;

/** The one orange tree, dead centre — SOLID trunk, OVERHEAD canopy above. */
export const CHAMBER_TREE = { x: 15, y: 10 } as const;

/** The arrival trigger, up by the north spawn (the sunlit reveal). */
export const CHAMBER_ENTRY_TRIGGER = { x1: 13, y1: 2, x2: 17, y2: 4 } as const;
/** The walk-over area at the foot of the tree where Fluffball joins. */
export const CHAMBER_JOIN_TRIGGER = { x1: 13, y1: 12, x2: 17, y2: 13 } as const;
/** Where Fluffball edges out of the ferns to join (just east of the tree). */
export const CHAMBER_FLUFF = { x: 19, y: 12 } as const;

/** North gate → back up to the river grotto. */
export const CHAMBER_EXIT_NORTH = { x1: 14, y1: 1, x2: 15, y2: 1 } as const;
export const CHAMBER_NORTH_GATES = [
  { x: 14, y: 0 },
  { x: 15, y: 0 }
] as const;

/** East gate → on to Sahra's corner of the grove. */
export const CHAMBER_EXIT_EAST = { x1: 28, y1: 9, x2: 28, y2: 10 } as const;
export const CHAMBER_EAST_GATES = [
  { x: 29, y: 9 },
  { x: 29, y: 10 }
] as const;

/** All border gates (for the enclosure test). */
export const CHAMBER_BORDER_GATES = [
  ...CHAMBER_NORTH_GATES,
  ...CHAMBER_EAST_GATES
] as const;

/** The sunbeam shaft — bright sunlit floor pooling around the tree. */
const SUNBEAM = { x1: 12, y1: 5, x2: 18, y2: 14 } as const;

/** SOLID cave-in rubble (the collapse that opened the roof) — corners/edges. */
const COLLAPSED: Array<[number, number]> = [
  [3, 3],
  [26, 3],
  [4, 16],
  [25, 16],
  [9, 5],
  [21, 5]
];
/** SOLID mossy, vine-draped boulders (walk-arounds). */
const VINE_ROCKS: Array<[number, number]> = [
  [6, 9],
  [24, 13],
  [8, 14]
];
/** SOLID fern clumps (leafy walk-arounds), incl. the clump Fluffball hides by. */
const FERNS: Array<[number, number]> = [
  [20, 13],
  [11, 6],
  [19, 6],
  [7, 12],
  [23, 8]
];
/** Walkable wildflower blooms scattered in the turf. */
const FLOWERS: Array<[number, number]> = [
  [10, 3],
  [20, 3],
  [6, 6],
  [24, 6],
  [9, 16]
];

export function buildGroveChamberMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Lush river-fed grass everywhere (two grains + occasional moss).
  for (let y = 0; y < CHAMBER_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < CHAMBER_WIDTH; x++) {
      // Moss grows in clustered patches (4x4 blocks), not per-cell scatter,
      // so the dressing pass can author real moss↔grass transitions (§2/G9).
      const h = cellHash(x, y);
      const mossPatch = cellHash(x >> 2, y >> 2) % 5 === 0;
      ground[y].push(mossPatch ? "groveMoss" : h % 3 === 0 ? "groveGrass2" : "groveGrass");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing cave wall (two gates: north, east).
  for (let x = 0; x < CHAMBER_WIDTH; x++) {
    decor[0][x] = "caveWall";
    decor[CHAMBER_HEIGHT - 1][x] = "caveWall";
  }
  for (let y = 0; y < CHAMBER_HEIGHT; y++) {
    decor[y][0] = "caveWall";
    decor[y][CHAMBER_WIDTH - 1] = "caveWall";
  }
  for (const g of CHAMBER_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // The sunbeam shaft pours straight down onto the centre of the chamber.
  for (let y = SUNBEAM.y1; y <= SUNBEAM.y2; y++) {
    for (let x = SUNBEAM.x1; x <= SUNBEAM.x2; x++) ground[y][x] = "sunbeam";
  }

  // The underground river across the south (scenic; the gameplay path stays
  // north of it). Solid water with a wet-stone north bank.
  for (let x = 4; x <= 25; x++) {
    ground[16][x] = "groveWater";
    ground[17][x] = "groveWater2";
    decor[16][x] = "groveWater";
    decor[17][x] = "groveWater2";
    ground[15][x] = "riverStone"; // north bank
  }

  // The one orange tree, dead centre: solid trunk (two tiles tall) under a
  // leafy OVERHEAD canopy the party walks beneath.
  decor[CHAMBER_TREE.y][CHAMBER_TREE.x] = "orangeTreeTrunk";
  decor[CHAMBER_TREE.y + 1][CHAMBER_TREE.x] = "orangeTreeTrunk";
  for (const [x, y] of [
    [15, 6],
    [14, 7],
    [15, 7],
    [16, 7],
    [13, 8],
    [14, 8],
    [15, 8],
    [16, 8],
    [17, 8],
    [14, 9],
    [15, 9],
    [16, 9]
  ] as const) {
    overhead[y][x] = "orangeTreeCanopy";
  }

  // Solid dressings (walk-arounds — none seals a needed path). Rubble and
  // boulders never land on the sunbeam cross or the through-path to the gates.
  for (const [x, y] of COLLAPSED) decor[y][x] = "collapsedRock";
  for (const [x, y] of VINE_ROCKS) decor[y][x] = "vineRock";
  for (const [x, y] of FERNS) decor[y][x] = "fern";

  // Walkable decor.
  for (const [x, y] of FLOWERS) if (decor[y][x] === null) decor[y][x] = "groveFlower";

  return dressMap({ ground, decor, overhead });
}
