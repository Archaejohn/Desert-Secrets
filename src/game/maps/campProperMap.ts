/**
 * Act 4, Zone 2 — The Miners' Camp proper. Mo, Edda and Gus's actual living
 * space: a warm hall built into an abandoned Cinnabar gallery — string lights
 * and a laundry line strung overhead, a stove and a woven rug at its heart,
 * the sock line along the west wall, supply crates stacked in the NE (where
 * Piggy is caught mid-raid). This is the hub of Act 4: a north gate back up to
 * the outskirts, a west gap into the laundry nook (the midden-mite nest), and
 * an east gate on into the back gallery that climbs to Fluffball's ledge.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const CAMPP_WIDTH = 34;
export const CAMPP_HEIGHT = 20;

/** Default spawn: arriving from the outskirts (north gate). */
export const CAMPP_SPAWN = { x: 16, y: 2 } as const;
/** Spawn-backs when returning from a neighbouring zone. */
export const CAMPP_NOOK_RETURN_SPAWN = { x: 2, y: 10 } as const;
export const CAMPP_GALLERY_RETURN_SPAWN = { x: 31, y: 10 } as const;

/** The arrival trigger — grounds the player in the camp on first entry. */
export const CAMPP_ENTRY_TRIGGER = { x1: 14, y1: 2, x2: 19, y2: 4 } as const;

/** Where Piggy is caught sniffing the supply crates (the comic chase). */
export const CAMPP_CRATE_TRIGGER = { x1: 24, y1: 3, x2: 27, y2: 6 } as const;
/** The crate stack Piggy burrows into and pops out the far side of. */
export const CAMPP_CRATE_STACK = { x: 29, y: 4 } as const;

/** The three miners live around the stove on the rug. */
export const CAMPP_MO = { x: 13, y: 10 } as const;
export const CAMPP_EDDA = { x: 16, y: 9 } as const;
export const CAMPP_GUS = { x: 19, y: 10 } as const;

/** The sock line along the west wall (interact → the reward, once cleared). */
export const CAMPP_SOCKS = { x: 6, y: 6 } as const;

/**
 * The camp rest point: the warm spot on the rug directly in front of the
 * stove (the stove itself, at (16,12), is solid). The camp is Act 4's hub,
 * so a player passes it before every spur. See docs/CONTRACTS.md ("v19").
 */
export const CAMPP_HEARTH = { x: 16, y: 11 } as const;

/** North gate → back up to the outskirts. */
export const CAMPP_EXIT_NORTH = { x1: 16, y1: 1, x2: 17, y2: 1 } as const;
export const CAMPP_NORTH_GATES = [
  { x: 16, y: 0 },
  { x: 17, y: 0 }
] as const;

/** West gate → the laundry nook (the midden-mite nest). */
export const CAMPP_EXIT_WEST = { x1: 1, y1: 10, x2: 1, y2: 10 } as const;
export const CAMPP_WEST_GATES = [{ x: 0, y: 10 }] as const;

/** East gate → the back gallery (up toward Fluffball's ledge). */
export const CAMPP_EXIT_EAST = { x1: 32, y1: 10, x2: 32, y2: 10 } as const;
export const CAMPP_EAST_GATES = [{ x: 33, y: 10 }] as const;

/** All border gates (for the enclosure test). */
export const CAMPP_BORDER_GATES = [
  ...CAMPP_NORTH_GATES,
  ...CAMPP_WEST_GATES,
  ...CAMPP_EAST_GATES
] as const;

/** Solid supply-crate props in the NE (loose cluster — seals no needed path). */
const CRATES: Array<[number, number]> = [
  [27, 3],
  [31, 3],
  [28, 4],
  [30, 4],
  [27, 5],
  [31, 5]
];
const CRATE_STACKS: Array<[number, number]> = [
  [29, 4], // CAMPP_CRATE_STACK
  [29, 5]
];
const CRATE_OPEN: Array<[number, number]> = [[27, 6]];

/** Salvaged mine timbers that carry the string lights / laundry line. */
const CAMP_POSTS: Array<[number, number]> = [
  [10, 7],
  [22, 7]
];

/** Barrels + a stove dress the hall (all solid). */
const BARRELS: Array<[number, number]> = [
  [2, 16],
  [31, 16]
];
const STOVE: [number, number] = [16, 12];
const BEDROLLS: Array<[number, number]> = [
  [12, 13],
  [20, 13]
];

/** A woven rug warms the miners' gathering spot. */
const RUG = { x1: 12, y1: 8, x2: 20, y2: 11 } as const;

/** Piggy's frosty night-raid tracks, from the crates toward the sock line. */
const FROST_PRINTS: Array<[number, number]> = [
  [23, 7],
  [18, 6],
  [11, 6],
  [8, 6]
];

export function buildCampProperMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Warm plank floor everywhere (two grains).
  for (let y = 0; y < CAMPP_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < CAMPP_WIDTH; x++) {
      ground[y].push(cellHash(x, y) % 4 === 0 ? "campFloor2" : "campFloor");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing camp wall (three gates).
  for (let x = 0; x < CAMPP_WIDTH; x++) {
    decor[0][x] = "campWall";
    decor[CAMPP_HEIGHT - 1][x] = "campWall";
  }
  for (let y = 0; y < CAMPP_HEIGHT; y++) {
    decor[y][0] = "campWall";
    decor[y][CAMPP_WIDTH - 1] = "campWall";
  }
  for (const g of CAMPP_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // Rug under the miners' hearth.
  for (let y = RUG.y1; y <= RUG.y2; y++) {
    for (let x = RUG.x1; x <= RUG.x2; x++) ground[y][x] = "campRug";
  }

  // Solid dressings (walk-arounds).
  for (const [x, y] of CRATES) decor[y][x] = "crate";
  for (const [x, y] of CRATE_STACKS) decor[y][x] = "crateStack";
  for (const [x, y] of CRATE_OPEN) decor[y][x] = "crateOpen";
  for (const [x, y] of CAMP_POSTS) decor[y][x] = "campPost";
  for (const [x, y] of BARRELS) decor[y][x] = "barrel";
  decor[STOVE[1]][STOVE[0]] = "stove";

  // The sock line: a basket of the ripest socks (walkable landmark).
  decor[CAMPP_SOCKS.y][CAMPP_SOCKS.x] = "sockBasket";

  // Walkable decor: bedrolls, then frost tracks (never over a solid prop).
  for (const [x, y] of BEDROLLS) decor[y][x] = "bedroll";
  for (const [x, y] of FROST_PRINTS) {
    if (decor[y][x] === null) decor[y][x] = "frostPrint";
  }

  // Overhead: string lights across the hall ceiling, a laundry line strung
  // over the sock corner. Overhead tiles are never solid, so they must sit on
  // cells the player can stand under.
  for (const x of [6, 10, 14, 18, 22, 26]) overhead[2][x] = "stringLights";
  overhead[5][10] = "stringLights";
  overhead[5][22] = "stringLights";
  for (let x = 4; x <= 9; x++) overhead[5][x] = "laundryLine";

  return { ground, decor, overhead };
}
