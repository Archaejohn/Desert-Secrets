/**
 * Act 2, Zone 1 — The Crevasse. The entry hall under the Depths: an ice
 * cave that teaches the act's grammar. The entry room has three ways out:
 * a corridor that loops straight back into the room (false lead), a
 * dead-end pocket holding Mo the lost miner (dead ends can pay off), and
 * the true path south to the Ice Maze. A camp corner in the entry room
 * collects rescued miners as their flags are set. Chasm pits stud the
 * lower hall as walk-around hazards.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const CREVASSE_WIDTH = 20;
export const CREVASSE_HEIGHT = 16;

/** Default spawn: dropped in at the top of the entry room (from the Depths). */
export const CREVASSE_SPAWN = { x: 12, y: 2 } as const;
/** Where the player appears when walking back up from the maze. */
export const CREVASSE_MAZE_RETURN_SPAWN = { x: 9, y: 13 } as const;
/** The entry room (camp corner in its north-west). */
export const CREVASSE_ENTRY_ROOM = { x1: 5, y1: 1, x2: 14, y2: 5 } as const;
/** Camp spots where rescued miners gather, per flag. */
export const CREVASSE_CAMP = {
  mo: { x: 6, y: 2 },
  edda: { x: 7, y: 2 },
  gus: { x: 6, y: 3 }
} as const;
/** Mo is stranded at the far end of the dead-end pocket. */
export const CREVASSE_MO = { x: 2, y: 4 } as const;
/** The pocket's single entrance tile (solidify it: Mo is unreachable). */
export const CREVASSE_MO_ENTRANCE = { x: 4, y: 4 } as const;
/** The loop corridor's two mouths — both open into the entry room. */
export const CREVASSE_LOOP_MOUTH_A = { x: 15, y: 2 } as const;
export const CREVASSE_LOOP_MOUTH_B = { x: 13, y: 6 } as const;
/** South exit band → down into the Ice Maze. */
export const CREVASSE_SOUTH_EXIT = { x1: 9, y1: 14, x2: 10, y2: 14 } as const;
/** Open border cells of the south exit (for the enclosure test). */
export const CREVASSE_SOUTH_GATES = [
  { x: 9, y: 15 },
  { x: 10, y: 15 }
] as const;
/** Chasm pits in the lower hall — solid hazards to walk around. */
export const CREVASSE_CHASMS = [
  { x: 6, y: 11 },
  { x: 7, y: 11 },
  { x: 6, y: 12 },
  { x: 12, y: 11 },
  { x: 13, y: 11 },
  { x: 13, y: 12 }
] as const;

/** Carved (walkable) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { ...CREVASSE_ENTRY_ROOM }, // entry room with the camp corner
  { x1: 15, y1: 2, x2: 17, y2: 2 }, // loop: east arm out
  { x1: 17, y1: 2, x2: 17, y2: 7 }, // loop: down the far side
  { x1: 13, y1: 7, x2: 17, y2: 7 }, // loop: back west
  { x1: 13, y1: 6, x2: 13, y2: 7 }, // loop: mouth B re-enters the room
  { x1: 2, y1: 4, x2: 4, y2: 4 }, // Mo's dead-end pocket
  { x1: 9, y1: 6, x2: 10, y2: 9 }, // true path: shaft south
  { x1: 6, y1: 10, x2: 13, y2: 13 }, // lower hall (chasm field)
  { x1: 9, y1: 14, x2: 10, y2: 14 } // exit stub to the maze
];

export function buildCrevasseMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < CREVASSE_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < CREVASSE_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 11 === 0 ? "mossGlow" : h % 4 === 0 ? "iceFloor2" : "iceFloor");
      decor[y].push("iceWallDeep");
      overhead[y].push(null);
    }
  }

  // Carve the cave out of the deep ice.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) decor[y][x] = null;
    }
  }
  // Open the south border at the exit (the way down stays visible).
  for (const g of CREVASSE_SOUTH_GATES) decor[g.y][g.x] = null;

  // Chasm pits in the lower hall.
  for (const c of CREVASSE_CHASMS) decor[c.y][c.x] = "chasm";
  // Hand nudge: keep the ground beside every pit plain ice so the dressing
  // pass can lip the whole rim (mossGlow has no chasm-lip variants).
  for (const c of CREVASSE_CHASMS) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ] as const) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (ground[ny]?.[nx] === "mossGlow") ground[ny][nx] = "iceFloor";
    }
  }

  // The miner camp corner: a drift to sleep on, an amber lantern.
  decor[1][5] = "snowdrift";
  decor[2][5] = "lanternPost";

  // Crystals (big ones are solid; placed clear of every doorway).
  decor[1][14] = "crystalBig";
  decor[13][6] = "crystalBig";
  decor[1][9] = "crystalSmall";
  decor[10][11] = "crystalSmall";
  decor[7][16] = "crystalSmall";

  // Icicles hang from wall lips (overhead layer, never solid). Deterministic.
  for (let y = 1; y < CREVASSE_HEIGHT - 1; y++) {
    for (let x = 1; x < CREVASSE_WIDTH - 1; x++) {
      if (decor[y][x] === null && decor[y - 1][x] === "iceWallDeep" && cellHash(x, y) % 6 === 0) {
        overhead[y][x] = "icicle";
      }
    }
  }

  return dressMap({ ground, decor, overhead });
}
