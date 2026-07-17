/**
 * Zone 4 — Cinnabar Mine. A carved mini-dungeon: winding corridors cut
 * out of solid mineWall, timber supports, a rail siding with a cart, a
 * lever-gated elevator corridor (three mineTimber tiles block the way
 * until the lever is pulled), the Foreman's chamber and the elevator
 * down to the Depths. Frost thickens toward the bottom of the map.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const MINE_WIDTH = 30;
export const MINE_HEIGHT = 22;

/** Default spawn: the entry chamber, just up from the south exit. */
export const MINE_SPAWN = { x: 14, y: 18 } as const;
/** South exit band → back down to the trail. */
export const MINE_SOUTH_EXIT = { x1: 13, y1: 20, x2: 16, y2: 20 } as const;
/** The lever fixture on the wall (solid decor tile). */
export const MINE_LEVER = { x: 21, y: 5 } as const;
/** The walkable tile in front of the lever (choice trigger). */
export const MINE_LEVER_PLATE = { x: 21, y: 6 } as const;
/** Three mineTimber tiles sealing the elevator corridor. */
export const MINE_GATE_TILES = [
  { x: 22, y: 6 },
  { x: 22, y: 7 },
  { x: 22, y: 8 }
] as const;
/** The Foreman Scarab stands before the elevator. */
export const MINE_FOREMAN = { x: 24, y: 7 } as const;
/** Elevator platform floor → the Depths (needs foremanDefeated). */
export const MINE_ELEVATOR = { x1: 26, y1: 6, x2: 27, y2: 8 } as const;
/** Where the player appears when riding back up from the Depths. */
export const MINE_ELEVATOR_SPAWN = { x: 24, y: 8 } as const;
/** The ore cart at the end of the rail siding. */
export const MINE_CART = { x: 12, y: 11 } as const;

/** Lantern-post torches mounted at chamber corners/edges (solid decor, all
 *  in wide chambers so none narrows a path — BFS-verified). MineScene hangs a
 *  warm flickering LightMask glow on each. */
export const MINE_TORCHES = [
  { x: 13, y: 15 }, // entry chamber, north wall
  { x: 17, y: 18 }, // entry chamber, east wall
  { x: 8, y: 13 }, // rail chamber, SW corner
  { x: 23, y: 5 }, // elevator chamber, NW corner
  { x: 27, y: 9 } // elevator chamber, SE corner
] as const;

/** Carved (walkable) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 12, y1: 15, x2: 17, y2: 19 }, // entry chamber
  { x1: 13, y1: 19, x2: 16, y2: 20 }, // south stub to the exit
  { x1: 5, y1: 15, x2: 12, y2: 16 }, // west corridor
  { x1: 5, y1: 7, x2: 6, y2: 16 }, // west shaft
  { x1: 5, y1: 7, x2: 21, y2: 8 }, // north corridor
  { x1: 8, y1: 10, x2: 12, y2: 13 }, // rail chamber
  { x1: 9, y1: 8, x2: 10, y2: 10 }, // rail chamber connector
  { x1: 19, y1: 8, x2: 20, y2: 15 }, // east shaft
  { x1: 17, y1: 15, x2: 20, y2: 16 }, // east corridor back to entry
  { x1: 21, y1: 6, x2: 22, y2: 8 }, // gate approach
  { x1: 23, y1: 5, x2: 27, y2: 9 } // elevator chamber
];

/** Timber supports narrowing corridors (all solid, none sealing a path). */
const TIMBERS: Array<[number, number]> = [
  [9, 7],
  [15, 7],
  [5, 12],
  [19, 12],
  [12, 15]
];

export function buildMineMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];

  for (let y = 0; y < MINE_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < MINE_WIDTH; x++) {
      // Frost thickens toward the bottom of the mine — the Depths breathe.
      const frosty = cellHash(x, y) % 12 < Math.floor(y / 5);
      ground[y].push(frosty ? "frostSand" : "mineFloor");
      decor[y].push("mineWall");
    }
  }

  // Carve the corridors and chambers out of the rock.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) decor[y][x] = null;
    }
  }

  // Rail siding with an ore cart.
  for (let x = 8; x <= 11; x++) decor[11][x] = "rail";
  decor[MINE_CART.y][MINE_CART.x] = "cart";

  // Elevator platform: rails mark the cage floor.
  for (let y = MINE_ELEVATOR.y1; y <= MINE_ELEVATOR.y2; y++) {
    for (let x = MINE_ELEVATOR.x1; x <= MINE_ELEVATOR.x2; x++) decor[y][x] = "rail";
  }

  // Timber supports.
  for (const [x, y] of TIMBERS) decor[y][x] = "mineTimber";

  // The gate: three timbers sealing the elevator corridor, lever beside.
  for (const g of MINE_GATE_TILES) decor[g.y][g.x] = "mineTimber";
  decor[MINE_LEVER.y][MINE_LEVER.x] = "lever";

  // A few bones for flavor in the entry chamber.
  decor[17][16] = "bones";

  // Lantern-post torches (LightMask glows hung on them in MineScene).
  for (const t of MINE_TORCHES) decor[t.y][t.x] = "lanternPost";

  return dressMap({ ground, decor });
}
