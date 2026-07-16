/**
 * Act 2, Zone 2 — The Ice Maze. The centerpiece: seven rooms joined by
 * single-width corridors carved out of deep ice, with lantern posts
 * marking the true junctions.
 *
 * Topology (tested in tests/game/maps2.test.ts):
 * - Route A (north): entry R1 → A1 → R2 → A2 → R3 → A3 → R6 (east-exit room).
 * - Route B (south): R1 → B1 → R4 → B2 → R5 → B3 → R7 (south-exit room),
 *   with C1 linking R7 ↔ R6. Routes A and B are vertex-disjoint outside
 *   the entry room: MAZE_PINCH_A / MAZE_PINCH_B are one tile of each —
 *   blocking either leaves both galleries exits reachable, blocking both
 *   cuts the entry room off entirely.
 * - A loop corridor leaves the entry room and re-enters it (false lead).
 * - Three false-lead dead ends: the shard cache (off A2), Edda's pocket
 *   (off R5), and the ambush pocket (off R3) — each behind a single
 *   entrance tile.
 * - A doorRime crack (shortcut) joins R2 to R5 once Slither opens it.
 * - TWO exits to the galleries on different edges (east from R6, south
 *   from R7) plus the way back north to the crevasse.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const MAZE_WIDTH = 44;
export const MAZE_HEIGHT = 28;

/** Default spawn, in the entry room (arriving from the crevasse). */
export const MAZE_SPAWN = { x: 5, y: 4 } as const;
/** Spawn-backs used when returning from the galleries. */
export const MAZE_EAST_RETURN_SPAWN = { x: 41, y: 13 } as const;
export const MAZE_SOUTH_RETURN_SPAWN = { x: 31, y: 25 } as const;

/** The seven rooms (R1 is the entry room). */
export const MAZE_ROOMS = [
  { x1: 2, y1: 2, x2: 9, y2: 8 }, // R1 entry room
  { x1: 16, y1: 2, x2: 23, y2: 7 }, // R2 north-central
  { x1: 30, y1: 2, x2: 37, y2: 7 }, // R3 north-east
  { x1: 3, y1: 16, x2: 10, y2: 21 }, // R4 south-west
  { x1: 16, y1: 16, x2: 23, y2: 22 }, // R5 south-central
  { x1: 35, y1: 11, x2: 41, y2: 16 }, // R6 east-exit room
  { x1: 29, y1: 20, x2: 35, y2: 25 } // R7 south-exit room
] as const;
export const MAZE_ENTRY_ROOM = MAZE_ROOMS[0];

/** One tile of each disjoint route (see the disjointness tests). */
export const MAZE_PINCH_A = { x: 12, y: 4 } as const; // on A1 (R1 → R2)
export const MAZE_PINCH_B = { x: 9, y: 12 } as const; // on B1 (R1 → R4)

/** The loop corridor's two mouths — both open into the entry room. */
export const MAZE_LOOP_MOUTH_A = { x: 3, y: 9 } as const;
export const MAZE_LOOP_MOUTH_B = { x: 7, y: 9 } as const;

/** False lead 1: the shard cache (heal + XP), off corridor A2. */
export const MAZE_SHARD = { x: 26, y: 1 } as const;
export const MAZE_SHARD_ENTRANCE = { x: 26, y: 3 } as const;
/** False lead 2: Edda's pocket, off room R5. */
export const MAZE_EDDA = { x: 17, y: 25 } as const;
export const MAZE_EDDA_ENTRANCE = { x: 17, y: 23 } as const;
/** False lead 3: the ambush pocket, off room R3. */
export const MAZE_AMBUSH_RECT = { x1: 31, y1: 9, x2: 33, y2: 10 } as const;
export const MAZE_AMBUSH_SHARD = { x: 32, y: 10 } as const;
export const MAZE_AMBUSH_ENTRANCE = { x: 32, y: 8 } as const;

/** The rime-sealed crack on the shortcut between R2 and R5. */
export const MAZE_DOOR = { x: 19, y: 11 } as const;
/** Walkable approach tiles either side of the crack (scene trigger). */
export const MAZE_DOOR_TRIGGER = { x1: 19, y1: 10, x2: 19, y2: 12 } as const;

/** Exits: north back up to the crevasse; east and south to the galleries. */
export const MAZE_EXIT_NORTH = { x1: 4, y1: 1, x2: 5, y2: 1 } as const;
export const MAZE_EXIT_EAST = { x1: 42, y1: 13, x2: 42, y2: 14 } as const;
export const MAZE_EXIT_SOUTH = { x1: 31, y1: 26, x2: 32, y2: 26 } as const;
/** Open border cells at the three exits (for the enclosure test). */
export const MAZE_BORDER_GATES = [
  { x: 4, y: 0 },
  { x: 5, y: 0 },
  { x: 43, y: 13 },
  { x: 43, y: 14 },
  { x: 31, y: 27 },
  { x: 32, y: 27 }
] as const;

/** Lantern posts marking true junctions (solid, wayfinding landmarks). */
export const MAZE_LANTERNS = [
  { x: 9, y: 3 }, // R1: the A1 doorway east
  { x: 8, y: 8 }, // R1: the B1 doorway south
  { x: 16, y: 3 }, // R2: arrival from A1
  { x: 23, y: 5 }, // R2: the A2 doorway east
  { x: 35, y: 7 }, // R3: the A3 doorway down
  { x: 36, y: 16 }, // R6: the C1 doorway south
  { x: 16, y: 17 }, // R5: arrival from B2
  { x: 20, y: 16 } // R5: the shortcut mouth
] as const;

/** Carved (walkable) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  ...MAZE_ROOMS.map((r) => ({ ...r })),
  { x1: 10, y1: 4, x2: 15, y2: 4 }, // A1: R1 → R2 (pinch A)
  { x1: 24, y1: 4, x2: 29, y2: 4 }, // A2: R2 → R3
  { x1: 36, y1: 8, x2: 36, y2: 10 }, // A3: R3 → R6
  { x1: 9, y1: 9, x2: 9, y2: 15 }, // B1: R1 → R4 (pinch B)
  { x1: 11, y1: 18, x2: 15, y2: 18 }, // B2: R4 → R5
  { x1: 24, y1: 21, x2: 28, y2: 21 }, // B3: R5 → R7
  { x1: 35, y1: 17, x2: 35, y2: 19 }, // C1: R6 ↔ R7 link
  { x1: 3, y1: 9, x2: 3, y2: 12 }, // loop: west arm down
  { x1: 4, y1: 12, x2: 6, y2: 12 }, // loop: along the bottom
  { x1: 7, y1: 9, x2: 7, y2: 12 }, // loop: east arm back up
  { x1: 19, y1: 8, x2: 19, y2: 15 }, // shortcut R2 → R5 (rime crack at y 11)
  { x1: 25, y1: 1, x2: 27, y2: 2 }, // shard-cache pocket
  { x1: 26, y1: 3, x2: 26, y2: 3 }, // shard-cache entrance
  { x1: 16, y1: 24, x2: 18, y2: 25 }, // Edda's pocket
  { x1: 17, y1: 23, x2: 17, y2: 23 }, // Edda's entrance
  { x1: 31, y1: 9, x2: 33, y2: 10 }, // ambush pocket
  { x1: 32, y1: 8, x2: 32, y2: 8 }, // ambush entrance
  { x1: 4, y1: 1, x2: 5, y2: 1 }, // north exit stub (to crevasse)
  { x1: 42, y1: 13, x2: 42, y2: 14 }, // east exit stub (to galleries)
  { x1: 31, y1: 26, x2: 32, y2: 26 } // south exit stub (to galleries)
];

/** Big crystals for flavor (solid; all clear of doorways and corridors). */
const BIG_CRYSTALS: Array<[number, number]> = [
  [2, 8],
  [37, 2],
  [41, 11],
  [29, 25],
  [3, 16],
  [23, 16]
];

export function buildMazeMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < MAZE_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < MAZE_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 13 === 0 ? "mossGlow" : h % 4 === 0 ? "iceFloor2" : "iceFloor");
      decor[y].push("iceWallDeep");
      overhead[y].push(null);
    }
  }

  // Carve rooms, corridors, pockets and exit stubs out of the deep ice.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) decor[y][x] = null;
    }
  }
  for (const g of MAZE_BORDER_GATES) decor[g.y][g.x] = null;

  // The rime-sealed crack on the shortcut (solid until Slither opens it).
  decor[MAZE_DOOR.y][MAZE_DOOR.x] = "doorRime";

  // Lantern posts at the true junctions.
  for (const l of MAZE_LANTERNS) decor[l.y][l.x] = "lanternPost";

  // Crystals: big solid ones in room corners, small glints on the floor.
  for (const [x, y] of BIG_CRYSTALS) decor[y][x] = "crystalBig";
  for (const r of MAZE_ROOMS) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        if (decor[y][x] === null && cellHash(x, y) % 19 === 0) decor[y][x] = "crystalSmall";
      }
    }
  }
  // The shard cache glitters.
  decor[1][25] = "crystalSmall";
  decor[1][27] = "crystalSmall";
  // Snow has drifted into the south rooms.
  for (const r of [MAZE_ROOMS[3], MAZE_ROOMS[4], MAZE_ROOMS[6]]) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        if (decor[y][x] === null && cellHash(x, y) % 23 === 0) decor[y][x] = "snowdrift";
      }
    }
  }

  // Icicles hang from wall lips (overhead layer, never solid).
  for (let y = 1; y < MAZE_HEIGHT - 1; y++) {
    for (let x = 1; x < MAZE_WIDTH - 1; x++) {
      if (decor[y][x] === null && decor[y - 1][x] === "iceWallDeep" && cellHash(x, y) % 7 === 0) {
        overhead[y][x] = "icicle";
      }
    }
  }

  return dressMap({ ground, decor, overhead });
}
