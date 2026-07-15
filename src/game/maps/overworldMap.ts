/**
 * The Open Desert — a small proof-of-concept world map in the FF3/FF6
 * style: a tiny, compressed terrain layer between two focused zones
 * rather than a fully detailed one. Everything except a single winding
 * mountain pass is solid mountain ridge (the "mountain"/"mountain2"
 * tiles — a big shingled slope, not the small "rock" boulder used
 * elsewhere), and the pass has exactly two stops: the spring/wash near
 * the overturned truck (south, back to the oasis) and Cinnabar Mine
 * (north, into the mine entrance). Random encounters run the whole
 * length of the pass. Pure data, deterministic, unit-testable.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const OVERWORLD_WIDTH = 16;
export const OVERWORLD_HEIGHT = 20;

/** South-edge exit band → back to the oasis (the wash/spring stop). */
export const OVERWORLD_SOUTH_EXIT = { x1: 7, y1: 19, x2: 9, y2: 19 } as const;
/** North-edge exit band → the mine entrance (the Cinnabar Mine stop). */
export const OVERWORLD_NORTH_EXIT = { x1: 7, y1: 0, x2: 9, y2: 0 } as const;
/** Where the player appears arriving from the oasis (also the default spawn). */
export const OVERWORLD_SOUTH_SPAWN = { x: 8, y: 17 } as const;
/** Where the player appears arriving back from the mine entrance. */
export const OVERWORLD_NORTH_SPAWN = { x: 8, y: 2 } as const;

/**
 * The pass's spine, south to north (descending y): [y, centerX]. Rows
 * between waypoints interpolate linearly, giving a gentle S-curve rather
 * than a straight line between the two stops.
 */
const PATH_WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [19, 8],
  [16, 8],
  [13, 6],
  [10, 5],
  [7, 6],
  [4, 8],
  [0, 8]
];

function centerXForRow(y: number): number {
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const [y0, x0] = PATH_WAYPOINTS[i];
    const [y1, x1] = PATH_WAYPOINTS[i + 1];
    if (y <= y0 && y >= y1) {
      const t = y0 === y1 ? 0 : (y0 - y) / (y0 - y1);
      return Math.round(x0 + (x1 - x0) * t);
    }
  }
  return 8;
}

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

/** Picks among all eight mountain variants for visual variety, like sand/sand2/sand3. */
function mountainName(x: number, y: number): string {
  return MOUNTAIN_NAMES[cellHash(x, y) % MOUNTAIN_NAMES.length];
}

export function buildOverworldMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];

  for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < OVERWORLD_WIDTH; x++) {
      const h = cellHash(x, y);
      let name = "sand";
      if (h % 17 === 0) name = "sand2";
      else if (h % 13 === 0) name = "sand3";
      else if (h % 61 === 0) name = "sandSparkle";
      ground[y].push(name);
      decor[y].push(mountainName(x, y)); // everything starts as impassable mountain
    }
  }

  // Carve the winding pass. Widens into a clearing at each stop so the
  // truck/spring and mine-mouth flavor has room beside the walking line.
  for (let y = 1; y < OVERWORLD_HEIGHT - 1; y++) {
    const cx = centerXForRow(y);
    const half = y >= 15 || y <= 3 ? 3 : 1;
    for (let x = cx - half; x <= cx + half; x++) {
      if (x > 0 && x < OVERWORLD_WIDTH - 1) decor[y][x] = null;
    }
  }

  // Sparse non-blocking scatter along the walkable pass only.
  for (let y = 1; y < OVERWORLD_HEIGHT - 1; y++) {
    for (let x = 1; x < OVERWORLD_WIDTH - 1; x++) {
      if (decor[y][x] !== null) continue;
      const h = cellHash(x, y);
      if (h % 29 === 0) decor[y][x] = "creosote";
      else if (h % 41 === 0) decor[y][x] = "bones";
    }
  }

  // The Wash: the overturned truck and a spring pool, off to the side of
  // the walking line into the south clearing.
  decor[17][5] = "truckBox";
  decor[18][5] = "truckCab";
  ground[16][10] = "water";
  ground[16][11] = "water2";
  ground[17][10] = "water2";
  ground[17][11] = "water";

  // Cinnabar Mine: timber framing the approach, an abandoned cart beside
  // it, echoing the mine mouth Trail already frames at its own entrance.
  decor[2][6] = "mineTimber";
  decor[2][10] = "mineTimber";
  decor[3][5] = "cart";

  // Map border: solid mountain — the whole point is that nothing else is
  // reachable except this one pass.
  for (let x = 0; x < OVERWORLD_WIDTH; x++) {
    decor[0][x] = mountainName(x, 0);
    decor[OVERWORLD_HEIGHT - 1][x] = mountainName(x, OVERWORLD_HEIGHT - 1);
  }
  for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
    decor[y][0] = mountainName(0, y);
    decor[y][OVERWORLD_WIDTH - 1] = mountainName(OVERWORLD_WIDTH - 1, y);
  }

  // Visible gates: the two stops, opened last so nothing above re-seals them.
  for (let x = OVERWORLD_SOUTH_EXIT.x1; x <= OVERWORLD_SOUTH_EXIT.x2; x++) {
    decor[OVERWORLD_HEIGHT - 1][x] = null;
    ground[OVERWORLD_HEIGHT - 1][x] = "sand2";
  }
  for (let x = OVERWORLD_NORTH_EXIT.x1; x <= OVERWORLD_NORTH_EXIT.x2; x++) {
    decor[0][x] = null;
    ground[0][x] = "sand2";
  }

  return { ground, decor };
}
