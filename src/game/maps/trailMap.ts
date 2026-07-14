/**
 * Zone 3 — The Piggy Trail. Three readable sub-areas, west to east:
 * a frost-flecked dry lakebed, a Joshua-tree grove, and the Last Chance
 * Fuel station (Dusty's trading post) with an asphalt apron. The
 * northeast exit climbs to Cinnabar Mine (gated on mineOpen in the scene).
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const TRAIL_WIDTH = 48;
export const TRAIL_HEIGHT = 20;

/** Default spawn: arriving from the oasis on the west edge. */
export const TRAIL_SPAWN = { x: 2, y: 10 } as const;
/** West-edge exit band → oasis. */
export const TRAIL_WEST_EXIT = { x1: 1, y1: 9, x2: 1, y2: 11 } as const;
/** Northeast exit band → Cinnabar Mine (gated on mineOpen). */
export const TRAIL_MINE_EXIT = { x1: 45, y1: 1, x2: 46, y2: 1 } as const;
/** Where the player appears when walking back down from the mine. */
export const TRAIL_MINE_SPAWN = { x: 45, y: 3 } as const;

/** The three ice-chip collectibles (flags chip1/chip2/chip3, in order). */
export const TRAIL_CHIPS = [
  { x: 7, y: 12 },
  { x: 21, y: 13 },
  { x: 35, y: 11 }
] as const;
/** The jackrabbit that stole an ice chip (Joshua grove). */
export const TRAIL_RABBIT = { x: 19, y: 8 } as const;
/** Dusty the pack rat, out front of Last Chance Fuel. */
export const TRAIL_DUSTY = { x: 41, y: 7 } as const;
/** The gas pump on the station apron. */
export const TRAIL_PUMP = { x: 38, y: 8 } as const;

/** Sub-area boundaries (for readability + tests). */
export const TRAIL_LAKEBED_MAX_X = 15;
export const TRAIL_GROVE_MAX_X = 31;

/** Station facade (solid wall row with windows + sign). */
export const TRAIL_STATION = { x1: 36, y: 5, x2: 44, sign: { x: 40, y: 4 } } as const;

const JOSHUA_TREES: Array<[number, number]> = [
  [18, 6],
  [24, 10],
  [28, 7],
  [17, 14],
  [26, 15],
  [30, 12]
];

export function buildTrailMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < TRAIL_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < TRAIL_WIDTH; x++) {
      const h = cellHash(x, y);
      let name: string;
      if (x <= TRAIL_LAKEBED_MAX_X) {
        // Dry lakebed: cracked pale flats with sparkle and lingering frost.
        name = "sand3";
        if (h % 7 === 0) name = "sandSparkle";
        else if (h % 11 === 0) name = "frostSand";
        else if (h % 5 === 0) name = "sand2";
      } else if (x <= TRAIL_GROVE_MAX_X) {
        // Joshua-tree grove: warmer mixed sand.
        name = "sand";
        if (h % 13 === 0) name = "sand2";
        else if (h % 17 === 0) name = "sand3";
      } else {
        // Station outskirts.
        name = "sand";
        if (h % 13 === 0) name = "sand2";
        else if (h % 41 === 0) name = "sandSparkle";
      }
      ground[y].push(name);
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Asphalt apron in front of the station.
  for (let y = 6; y <= 9; y++) {
    for (let x = 35; x <= 45; x++) ground[y][x] = "asphalt";
  }

  // Sparse scatter: rocks/bones on the lakebed, creosote in the grove.
  for (let y = 1; y < TRAIL_HEIGHT - 1; y++) {
    for (let x = 1; x < TRAIL_WIDTH - 1; x++) {
      const h = cellHash(x, y);
      if (x <= TRAIL_LAKEBED_MAX_X) {
        if (h % 43 === 0) decor[y][x] = "rock";
        else if (h % 53 === 0) decor[y][x] = "bones";
      } else if (x <= TRAIL_GROVE_MAX_X) {
        if (h % 9 === 0) decor[y][x] = "creosote";
        else if (h % 47 === 0) decor[y][x] = "rock";
      } else if (ground[y][x] !== "asphalt" && h % 31 === 0) {
        decor[y][x] = "creosote";
      }
    }
  }

  // Joshua trees: trunk in decor (solid), crown in overhead.
  for (const [x, y] of JOSHUA_TREES) {
    decor[y][x] = "joshuaTrunk";
    overhead[y - 1][x] = "joshuaTop";
  }

  // Last Chance Fuel facade: wall row with two windows, sign above.
  for (let x: number = TRAIL_STATION.x1; x <= TRAIL_STATION.x2; x++) {
    decor[TRAIL_STATION.y][x] = x === 38 || x === 42 ? "stationWindow" : "stationWall";
  }
  decor[TRAIL_STATION.sign.y][TRAIL_STATION.sign.x] = "stationSign";

  // Keep gameplay tiles clear of scatter, then place the pump.
  const clear: Array<{ x: number; y: number }> = [
    TRAIL_SPAWN,
    TRAIL_MINE_SPAWN,
    TRAIL_RABBIT,
    TRAIL_DUSTY,
    ...TRAIL_CHIPS
  ];
  for (let y = TRAIL_WEST_EXIT.y1; y <= TRAIL_WEST_EXIT.y2; y++) {
    clear.push({ x: TRAIL_WEST_EXIT.x1, y });
    clear.push({ x: TRAIL_WEST_EXIT.x1 + 1, y });
  }
  // Mine exit + the path climbing to it, east of the station.
  for (let x = TRAIL_MINE_EXIT.x1; x <= TRAIL_MINE_EXIT.x2; x++) {
    for (let y = 1; y <= 5; y++) clear.push({ x, y });
  }
  for (const c of clear) decor[c.y][c.x] = null;
  decor[TRAIL_PUMP.y][TRAIL_PUMP.x] = "gasPump";

  // Map border: rocks all round.
  for (let x = 0; x < TRAIL_WIDTH; x++) {
    decor[0][x] = "rock";
    decor[TRAIL_HEIGHT - 1][x] = "rock";
  }
  for (let y = 0; y < TRAIL_HEIGHT; y++) {
    decor[y][0] = "rock";
    decor[y][TRAIL_WIDTH - 1] = "rock";
  }

  // Visible gates: west back to the oasis, north into the mine.
  for (let y = TRAIL_WEST_EXIT.y1; y <= TRAIL_WEST_EXIT.y2; y++) {
    decor[y][0] = null;
    ground[y][0] = "frostSand";
    ground[y][1] = "frostSand";
  }
  for (let x = TRAIL_MINE_EXIT.x1; x <= TRAIL_MINE_EXIT.x2; x++) {
    decor[0][x] = null;
    ground[0][x] = "frostSand";
    ground[1][x] = "frostSand";
    // Frame the opening with timbers so it reads as a mine mouth.
    decor[0][TRAIL_MINE_EXIT.x1 - 1] = "mineTimber";
    decor[0][TRAIL_MINE_EXIT.x2 + 1] = "mineTimber";
  }

  return { ground, decor, overhead };
}
