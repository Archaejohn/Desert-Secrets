/**
 * Act 4, Zone 1 — The Camp Outskirts. Where the miners' service ladder tops
 * out of the Sunless Sea: the frostbitten edge of Mo, Edda and Gus's camp,
 * seen from outside before the player reaches the home proper. This is where
 * the environmental storytelling of Piggy's night raids lands — frost tracks
 * in the dust, a stolen boot dropped in the open, and string lights glowing
 * deeper in toward the camp. `minersCamp` stays the id the Act 3 → Act 4
 * hand-off (`seaAscent`'s top gate) drops the party into, so that wiring is
 * unchanged. One gate, south, on into the camp proper; otherwise enclosed.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const CAMP_WIDTH = 22;
export const CAMP_HEIGHT = 14;

/** Default spawn: topping out of the ascent ladder at the north edge. */
export const CAMP_SPAWN = { x: 11, y: 2 } as const;
/** Where the player reappears walking back up from the camp proper. */
export const CAMP_RETURN_SPAWN = { x: 11, y: 11 } as const;

/** The stolen boot dropped in the dust (an environmental-storytelling beat). */
export const CAMP_BOOT = { x: 5, y: 6 } as const;
/** The arrival trigger: first sight of the camp from its outskirts. */
export const CAMP_ENTRY_TRIGGER = { x1: 8, y1: 2, x2: 14, y2: 4 } as const;

/** South gate → down into the camp proper. */
export const CAMP_EXIT_SOUTH = { x1: 10, y1: 12, x2: 11, y2: 12 } as const;
export const CAMP_SOUTH_GATES = [
  { x: 10, y: 13 },
  { x: 11, y: 13 }
] as const;

/** Solid gallery clutter (walk-arounds — none seals the way south). */
const CRATES: Array<[number, number]> = [
  [18, 4],
  [3, 3]
];
const CRATE_STACKS: Array<[number, number]> = [[17, 4]];
const BARRELS: Array<[number, number]> = [
  [18, 10],
  [2, 10]
];

/** Piggy's frosty night-raid tracks, wandering down toward the camp gate. */
const FROST_PRINTS: Array<[number, number]> = [
  [10, 4],
  [8, 6],
  [7, 8],
  [9, 10],
  [5, 6] // CAMP_BOOT — the tracks circle the dropped boot
];

export function buildMinersCampMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Cold plank/dust floor everywhere (two grains).
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

  // Enclosing camp wall around the whole outskirts (one gate, south).
  for (let x = 0; x < CAMP_WIDTH; x++) {
    decor[0][x] = "campWall";
    decor[CAMP_HEIGHT - 1][x] = "campWall";
  }
  for (let y = 0; y < CAMP_HEIGHT; y++) {
    decor[y][0] = "campWall";
    decor[y][CAMP_WIDTH - 1] = "campWall";
  }
  for (const g of CAMP_SOUTH_GATES) decor[g.y][g.x] = null; // open the gate

  // Solid clutter (walk-arounds).
  for (const [x, y] of CRATES) decor[y][x] = "crate";
  for (const [x, y] of CRATE_STACKS) decor[y][x] = "crateStack";
  for (const [x, y] of BARRELS) decor[y][x] = "barrel";

  // Frost tracks (walkable) — never stamped over a solid prop. The boot spot
  // circles the tracks; the scene narrates the dropped boot itself.
  for (const [x, y] of FROST_PRINTS) {
    if (decor[y][x] === null) decor[y][x] = "frostPrint";
  }

  // Overhead: string lights glowing deeper in, toward the camp gate (never
  // solid, so never on a wall the player can't stand under).
  for (const x of [9, 12]) overhead[11][x] = "stringLights";
  overhead[9][11] = "stringLights";

  return { ground, decor, overhead };
}
