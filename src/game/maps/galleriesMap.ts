/**
 * Act 2, Zone 3 — The Galleries. Frozen-over mine workings: the old
 * Cinnabar crew's deep galleries, part rock and timber, part swallowed
 * by the glacier (mine tiles mixed with deep ice, thickening toward the
 * east). Two ways in from the maze (west hall and north hall), Gus's
 * dead-end side gallery to the south, and the rime door at the far east
 * end sealing the way to the Sanctum until Slither unbolts it.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const GALLERIES_WIDTH = 36;
export const GALLERIES_HEIGHT = 20;

/** Spawn arriving from the maze's EAST exit (west hall). Also the default. */
export const GALLERIES_SPAWN_WEST = { x: 3, y: 10 } as const;
/** Spawn arriving from the maze's SOUTH exit (north hall). */
export const GALLERIES_SPAWN_NORTH = { x: 15, y: 4 } as const;
/** Spawn stepping back in from the sanctum (just inside the open door). */
export const GALLERIES_DOOR_SPAWN = { x: 33, y: 10 } as const;

/** West exit band → back to the maze's east-exit room. */
export const GALLERIES_EXIT_WEST = { x1: 1, y1: 9, x2: 1, y2: 10 } as const;
/** North exit band → back to the maze's south-exit room. */
export const GALLERIES_EXIT_NORTH = { x1: 15, y1: 1, x2: 16, y2: 1 } as const;
/** East exit band (beyond the rime door) → the Sanctum. */
export const GALLERIES_EXIT_EAST = { x1: 34, y1: 10, x2: 34, y2: 11 } as const;
/** Open border cells at the three exits (for the enclosure test). */
export const GALLERIES_BORDER_GATES = [
  { x: 0, y: 9 },
  { x: 0, y: 10 },
  { x: 15, y: 0 },
  { x: 16, y: 0 },
  { x: 35, y: 10 },
  { x: 35, y: 11 }
] as const;

/** Gus, holed up at the end of the side gallery. */
export const GALLERIES_GUS = { x: 12, y: 16 } as const;

/** The two rime-door gate tiles sealing the east passage. */
export const GALLERIES_DOOR_TILES = [
  { x: 32, y: 10 },
  { x: 32, y: 11 }
] as const;
/** Walkable column in front of the door (scene trigger). */
export const GALLERIES_DOOR_TRIGGER = { x1: 31, y1: 9, x2: 31, y2: 12 } as const;

/** Carved (walkable) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 1, y1: 8, x2: 8, y2: 12 }, // west hall (from the maze)
  { x1: 14, y1: 1, x2: 18, y2: 6 }, // north hall (from the maze)
  { x1: 15, y1: 7, x2: 16, y2: 7 }, // north connector down
  { x1: 8, y1: 8, x2: 27, y2: 13 }, // the main gallery (rail line)
  { x1: 12, y1: 14, x2: 12, y2: 15 }, // side-gallery corridor
  { x1: 10, y1: 16, x2: 14, y2: 17 }, // Gus's pocket
  { x1: 28, y1: 9, x2: 31, y2: 12 }, // door antechamber
  { x1: 33, y1: 10, x2: 34, y2: 11 } // passage beyond the rime door
];

/** Timber supports narrowing the halls (solid, none sealing a path). */
const TIMBERS: Array<[number, number]> = [
  [11, 9],
  [19, 12],
  [23, 9],
  [5, 8]
];

export function buildGalleriesMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < GALLERIES_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < GALLERIES_WIDTH; x++) {
      const h = cellHash(x, y);
      // The glacier has crept in from the east: ice thickens toward the door.
      const icy = h % 9 < Math.floor(x / 5);
      ground[y].push(
        icy ? (h % 3 === 0 ? "iceFloor2" : "iceFloor") : h % 7 === 0 ? "frostSand" : "mineFloor"
      );
      decor[y].push(h % 3 === 0 ? "iceWallDeep" : "mineWall");
      overhead[y].push(null);
    }
  }

  // Carve the workings.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) decor[y][x] = null;
    }
  }
  for (const g of GALLERIES_BORDER_GATES) decor[g.y][g.x] = null;

  // The rime door: two sealed gate tiles (solid until Slither unbolts them).
  for (const d of GALLERIES_DOOR_TILES) decor[d.y][d.x] = "doorRime";

  // The old rail line runs the main gallery, with a frozen-in cart.
  for (let x = 9; x <= 26; x++) {
    if (decor[11][x] === null) decor[11][x] = "rail";
  }
  decor[11][24] = "cart";

  // Timber supports.
  for (const [x, y] of TIMBERS) decor[y][x] = "mineTimber";

  // Flavor: bones and a broken crate where the crew holed up, crystals east.
  decor[16][13] = "bones";
  decor[17][11] = "crateBroken";
  decor[9][29] = "crystalSmall";
  decor[12][30] = "crystalSmall";
  decor[2][14] = "snowdrift";
  decor[13][9] = "snowdrift";

  // Icicles hang where a wall lip overhangs walkable floor.
  for (let y = 1; y < GALLERIES_HEIGHT - 1; y++) {
    for (let x = 1; x < GALLERIES_WIDTH - 1; x++) {
      const wallAbove = decor[y - 1][x] === "iceWallDeep" || decor[y - 1][x] === "mineWall";
      if (decor[y][x] === null && wallAbove && cellHash(x, y) % 6 === 0) {
        overhead[y][x] = "icicle";
      }
    }
  }

  return { ground, decor, overhead };
}
