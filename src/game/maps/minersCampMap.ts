/**
 * Act 4 — The Miners' Camp ("Dirty Laundry"). Mo, Edda and Gus, rescued in
 * Act 2, now actually live here: a scrappy home built into an abandoned
 * Cinnabar gallery, strung with lights and a laundry line, floored with
 * salvaged planks. This is a genuinely new zone, NOT a revisit of Act 2's
 * galleries map.
 *
 * Layout: a warm central hall (string lights overhead, a stove, bedrolls,
 * the miners) reached from the north tunnel the party climbs up through.
 * The supply-crate stacks Piggy raids sit in the NE; Fluffball watches from
 * a ledge in the NW. The laundry nook is a walled-off cul-de-sac in the SW
 * behind a single entrance tile — the midden-mite nest and the sock line
 * both live inside it, so the favor-quest (clear the mites, take the socks)
 * happens in one sealed room. Fully enclosed by camp wall: no zone exits,
 * the act ends on a card (Act 5's zone is a teammate's next task).
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const CAMP_WIDTH = 32;
export const CAMP_HEIGHT = 20;

/** Default spawn: dropped in at the north tunnel mouth from the sea below. */
export const CAMP_SPAWN = { x: 16, y: 2 } as const;

/** Where Piggy is caught sniffing the supply crates (the comic chase). */
export const CAMP_CRATE_TRIGGER = { x1: 21, y1: 4, x2: 23, y2: 7 } as const;
/** The crate stack Piggy burrows into and pops out the far side of. */
export const CAMP_CRATE_STACK = { x: 26, y: 4 } as const;

/** Fluffball's ledge (glimpse-and-clue #2). */
export const CAMP_FLUFFBALL = { x: 3, y: 3 } as const;
/** The trigger area where the ledge glimpse fires. */
export const CAMP_FLUFFBALL_TRIGGER = { x1: 2, y1: 2, x2: 5, y2: 5 } as const;

/** The three miners live around the stove in the central hall. */
export const CAMP_MO = { x: 13, y: 9 } as const;
export const CAMP_EDDA = { x: 16, y: 9 } as const;
export const CAMP_GUS = { x: 19, y: 10 } as const;

/** The midden-mite nest in the laundry nook (interact → forced battle). */
export const CAMP_NEST = { x: 4, y: 16 } as const;
/** The sock line in the nook (interact → the reward, once the nest is clear). */
export const CAMP_SOCKS = { x: 6, y: 14 } as const;
/** The nook's single entrance tile — solidify it and the nook is cut off. */
export const CAMP_NOOK_ENTRANCE = { x: 9, y: 15 } as const;

/** Solid supply-crate props (loose cluster — none seals a needed path). */
const CRATES: Array<[number, number]> = [
  [24, 3],
  [28, 3],
  [25, 4],
  [27, 4],
  [24, 5],
  [28, 5],
];
const CRATE_STACKS: Array<[number, number]> = [
  [26, 4], // CAMP_CRATE_STACK
  [26, 5],
];
const CRATE_OPEN: Array<[number, number]> = [[24, 6]];

/** Salvaged mine timbers that carry the string lights / laundry line. */
const CAMP_POSTS: Array<[number, number]> = [
  [10, 6],
  [22, 6],
];

/** Barrels + a stove + bedrolls dress the hall (stove/barrels solid). */
const BARRELS: Array<[number, number]> = [
  [2, 8],
  [29, 9],
];
const STOVE: [number, number] = [16, 12];
const BEDROLLS: Array<[number, number]> = [
  [12, 11],
  [20, 11],
];

/** Piggy's frosty night-raid tracks, from the crates toward the nook. */
const FROST_PRINTS: Array<[number, number]> = [
  [23, 8],
  [20, 11],
  [15, 13],
  [11, 15],
];

/** A woven rug warms the miners' gathering spot. */
const RUG = { x1: 12, y1: 8, x2: 20, y2: 10 } as const;

export function buildMinersCampMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Warm plank floor everywhere (two grains).
  for (let y = 0; y < CAMP_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < CAMP_WIDTH; x++) {
      ground[y].push(cellHash(x, y) % 4 === 0 ? "campFloor2" : "campFloor");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing camp wall around the whole gallery (no exits — end card).
  for (let x = 0; x < CAMP_WIDTH; x++) {
    decor[0][x] = "campWall";
    decor[CAMP_HEIGHT - 1][x] = "campWall";
  }
  for (let y = 0; y < CAMP_HEIGHT; y++) {
    decor[y][0] = "campWall";
    decor[y][CAMP_WIDTH - 1] = "campWall";
  }

  // The laundry nook: walled off in the SW, one entrance tile.
  for (let x = 1; x <= 9; x++) decor[12][x] = "campWall"; // north wall
  for (let y = 13; y <= 18; y++) decor[y][9] = "campWall"; // east wall
  decor[CAMP_NOOK_ENTRANCE.y][CAMP_NOOK_ENTRANCE.x] = null; // the single doorway

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

  // The laundry nook fittings: a wash basin, the sock line, spilled bedding.
  decor[17][2] = "washtub";
  decor[CAMP_SOCKS.y][CAMP_SOCKS.x] = "sockBasket"; // walkable landmark
  decor[16][7] = "bedroll";

  // Walkable decor.
  for (const [x, y] of BEDROLLS) decor[y][x] = "bedroll";
  for (const [x, y] of FROST_PRINTS) {
    // Never stamp a print over a solid prop (bedrolls can share a tile).
    if (decor[y][x] === null || decor[y][x] === "bedroll") decor[y][x] = "frostPrint";
  }

  // Overhead: string lights across the hall ceiling (strung above, but not
  // on, the solid camp posts), laundry hung over the nook. Overhead tiles are
  // never solid, so they must not sit on a wall/prop the player can't stand on.
  for (const x of [6, 10, 14, 20, 24, 28]) overhead[2][x] = "stringLights";
  overhead[5][10] = "stringLights";
  overhead[5][22] = "stringLights";
  for (let x = 2; x <= 7; x++) overhead[13][x] = "laundryLine";

  return { ground, decor, overhead };
}
