/**
 * Zone 5 — The Depths. A cold gallery below the elevator: frost-rimed
 * mine floor, a glacial ice wall to the north, an underground spring
 * (animated water) ringed by the Dust Queen's egg clusters, and the spot
 * where Act 1 ends. Piggy waits by the spring.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const DEPTHS_WIDTH = 26;
export const DEPTHS_HEIGHT = 16;

/** Default spawn: off the elevator at the south edge. */
export const DEPTHS_SPAWN = { x: 13, y: 12 } as const;
/** South exit band → back up to the mine elevator. */
export const DEPTHS_SOUTH_EXIT = { x1: 11, y1: 14, x2: 14, y2: 14 } as const;
/** The underground spring (water/water2, animated by the scene). */
export const DEPTHS_POOL = { x1: 10, y1: 3, x2: 14, y2: 5 } as const;
/** Piggy huddles at the spring's south rim (gap in the egg ring). */
export const DEPTHS_PIGGY = { x: 12, y: 6 } as const;
/** The Dust Queen stands between the entrance and Piggy. */
export const DEPTHS_QUEEN = { x: 12, y: 9 } as const;
/** Full-width approach band that triggers the confrontation. */
export const DEPTHS_APPROACH = { x1: 1, y1: 10, x2: 24, y2: 10 } as const;
/** Ice-wall tiles that crack open during the cliffhanger. */
export const DEPTHS_CRACK = [
  { x: 17, y: 1 },
  { x: 18, y: 1 }
] as const;
/** Where Piggy waddles to, beneath the crack (tile coords). */
export const DEPTHS_PIGGY_END = { x: 17, y: 2 } as const;

export function buildDepthsMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];

  for (let y = 0; y < DEPTHS_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < DEPTHS_WIDTH; x++) {
      // Frost is heaviest near the ice wall and the spring (the top).
      const frosty = cellHash(x, y) % 14 < Math.max(0, 4 - Math.floor(y / 4));
      ground[y].push(frosty ? "frostSand" : "mineFloor");
      decor[y].push(null);
    }
  }

  // Borders: glacial ice along the whole north edge, rock walls elsewhere.
  for (let x = 0; x < DEPTHS_WIDTH; x++) {
    ground[0][x] = "iceWall";
    ground[DEPTHS_HEIGHT - 1][x] = "mineWall";
  }
  for (let y = 1; y < DEPTHS_HEIGHT - 1; y++) {
    ground[y][0] = "mineWall";
    ground[y][DEPTHS_WIDTH - 1] = "mineWall";
  }
  // Second course of ice below the north edge — the cliffhanger cracks it.
  for (let x = 1; x < DEPTHS_WIDTH - 1; x++) decor[1][x] = "iceWall";

  // The underground spring.
  for (let y = DEPTHS_POOL.y1; y <= DEPTHS_POOL.y2; y++) {
    for (let x = DEPTHS_POOL.x1; x <= DEPTHS_POOL.x2; x++) {
      const edge =
        y === DEPTHS_POOL.y1 || y === DEPTHS_POOL.y2 || x === DEPTHS_POOL.x1 || x === DEPTHS_POOL.x2;
      ground[y][x] = edge && cellHash(x, y) % 3 === 0 ? "water2" : "water";
    }
  }

  // Egg clusters ring the spring, with a south-facing gap for Piggy.
  for (let y = DEPTHS_POOL.y1 - 1; y <= DEPTHS_POOL.y2 + 1; y++) {
    for (let x = DEPTHS_POOL.x1 - 1; x <= DEPTHS_POOL.x2 + 1; x++) {
      const ring =
        y === DEPTHS_POOL.y1 - 1 ||
        y === DEPTHS_POOL.y2 + 1 ||
        x === DEPTHS_POOL.x1 - 1 ||
        x === DEPTHS_POOL.x2 + 1;
      const gap = y === DEPTHS_POOL.y2 + 1 && x >= 11 && x <= 13;
      if (ring && !gap) decor[y][x] = "eggCluster";
    }
  }
  // Stray clutches against the gallery walls.
  decor[4][3] = "eggCluster";
  decor[10][4] = "eggCluster";
  decor[3][21] = "eggCluster";

  return dressMap({ ground, decor });
}
