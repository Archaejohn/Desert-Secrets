/**
 * Mine Entrance — a small vestibule screen between the open desert and
 * Cinnabar Mine proper, exactly the transition beat a tiny FF-style
 * world map needs: you don't walk straight from an overworld tile into
 * a full dungeon, you pass through a threshold first. Ground fades from
 * sand to mine floor as you approach the timber-framed mouth of the
 * mine. Sealed until Dusty opens the mine on the Trail (flags.mineOpen),
 * exactly like the Trail's own mine exit. Pure data, deterministic.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const MINE_ENTRANCE_WIDTH = 10;
export const MINE_ENTRANCE_HEIGHT = 10;

/** South-edge exit band → back to the open desert. */
export const MINE_ENTRANCE_SOUTH_EXIT = { x1: 4, y1: 9, x2: 5, y2: 9 } as const;
/** North-edge exit band → Cinnabar Mine (gated on flags.mineOpen). */
export const MINE_ENTRANCE_NORTH_EXIT = { x1: 4, y1: 0, x2: 5, y2: 0 } as const;
/** Default spawn, and where the player appears arriving from the desert. */
export const MINE_ENTRANCE_SPAWN = { x: 4, y: 7 } as const;
/** The walkable tile right at the mine mouth — the gate check happens here. */
export const MINE_ENTRANCE_THRESHOLD = { x: 4, y: 2 } as const;

export function buildMineEntranceMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];

  for (let y = 0; y < MINE_ENTRANCE_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < MINE_ENTRANCE_WIDTH; x++) {
      const h = cellHash(x, y);
      // Sand at the south, giving way to mine floor toward the mouth.
      let name = y >= 5 ? "sand" : "mineFloor";
      if (y >= 5 && h % 13 === 0) name = "sand2";
      else if (y < 5 && h % 9 === 0) name = "frostSand";
      ground[y].push(name);
      decor[y].push(null);
    }
  }

  // Rocky outcrop flanking the mine mouth.
  for (const [x, y] of [
    [2, 3],
    [7, 3],
    [2, 2],
    [7, 2]
  ] as const) {
    decor[y][x] = "mineWall";
  }
  // Timber framing the threshold itself.
  decor[2][3] = "mineTimber";
  decor[2][6] = "mineTimber";

  // A little scatter for life on the approach.
  for (const [x, y] of [
    [2, 6],
    [7, 6],
    [3, 8]
  ] as const) {
    decor[y][x] = cellHash(x, y) % 2 === 0 ? "creosote" : "bones";
  }

  // Map border: solid mountain, matching the overworld it opens onto.
  const MOUNTAIN_NAMES = [
    "mountain",
    "mountain2",
    "mountain3",
    "mountain4",
    "mountain5",
    "mountain6",
    "mountain7",
    "mountain8"
  ] as const;
  const mountainName = (x: number, y: number): string => MOUNTAIN_NAMES[cellHash(x, y) % MOUNTAIN_NAMES.length];
  for (let x = 0; x < MINE_ENTRANCE_WIDTH; x++) {
    decor[0][x] = mountainName(x, 0);
    decor[MINE_ENTRANCE_HEIGHT - 1][x] = mountainName(x, MINE_ENTRANCE_HEIGHT - 1);
  }
  for (let y = 0; y < MINE_ENTRANCE_HEIGHT; y++) {
    decor[y][0] = mountainName(0, y);
    decor[y][MINE_ENTRANCE_WIDTH - 1] = mountainName(MINE_ENTRANCE_WIDTH - 1, y);
  }

  // Visible gates.
  for (let x = MINE_ENTRANCE_SOUTH_EXIT.x1; x <= MINE_ENTRANCE_SOUTH_EXIT.x2; x++) {
    decor[MINE_ENTRANCE_HEIGHT - 1][x] = null;
    ground[MINE_ENTRANCE_HEIGHT - 1][x] = "sand2";
  }
  for (let x = MINE_ENTRANCE_NORTH_EXIT.x1; x <= MINE_ENTRANCE_NORTH_EXIT.x2; x++) {
    decor[0][x] = null;
    ground[0][x] = "frostSand";
  }
  // Keep the threshold and its approach clear of the flanking rock/timber.
  decor[MINE_ENTRANCE_THRESHOLD.y][MINE_ENTRANCE_THRESHOLD.x] = null;
  decor[1][4] = null;
  decor[1][5] = null;

  return dressMap({ ground, decor });
}
