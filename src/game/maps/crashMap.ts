/**
 * Zone 1 — Highway 95, the crash site. An asphalt highway runs across the
 * top of the map with Rosa's jackknifed aquarium truck on it; creosote
 * flats fan out below. Pure data, deterministic, unit-testable.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const CRASH_WIDTH = 24;
export const CRASH_HEIGHT = 14;

/** Default spawn: on the shoulder, just west of the wreck. */
export const CRASH_SPAWN = { x: 4, y: 8 } as const;
/** Rosa stands by the truck, next to the broken crate. */
export const CRASH_ROSA = { x: 10, y: 7 } as const;
/** The broken crate that Piggy escaped from. */
export const CRASH_CRATE = { x: 12, y: 6 } as const;
/** The frost feather (iceChip prop + one-time XP trigger). */
export const CRASH_FEATHER = { x: 14, y: 7 } as const;
/** East-edge exit band → oasis (gated on metRosa in the scene). */
export const CRASH_EXIT_EAST = { x1: 22, y1: 6, x2: 22, y2: 9 } as const;
/** Where the player appears when walking back in from the oasis. */
export const CRASH_EAST_SPAWN = { x: 21, y: 7 } as const;

/** Truck composition on the highway (all solid). */
export const CRASH_TRUCK = {
  cab: { x: 11, y: 5 },
  box1: { x: 12, y: 4 },
  box2: { x: 13, y: 4 }
} as const;

const HIGHWAY_TOP = 3;
const HIGHWAY_BOTTOM = 5;

export function buildCrashMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];

  for (let y = 0; y < CRASH_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < CRASH_WIDTH; x++) {
      const h = cellHash(x, y);
      let name = "sand";
      if (h % 17 === 0) name = "sand2";
      else if (h % 13 === 0) name = "sand3";
      else if (h % 61 === 0) name = "sandSparkle";
      if (y >= HIGHWAY_TOP && y <= HIGHWAY_BOTTOM) {
        // The highway: dashed centerline down the middle lane.
        name = y === 4 && x % 2 === 0 ? "asphaltLine" : "asphalt";
      }
      ground[y].push(name);
      decor[y].push(null);
    }
  }

  // Scrub scatter on the flats below the road.
  for (let y = HIGHWAY_BOTTOM + 1; y < CRASH_HEIGHT - 1; y++) {
    for (let x = 1; x < CRASH_WIDTH - 1; x++) {
      const h = cellHash(x, y);
      if (h % 23 === 0) decor[y][x] = "creosote";
      else if (h % 37 === 0) decor[y][x] = "rock";
      else if (h % 53 === 0) decor[y][x] = "bones";
    }
  }

  // The jackknifed truck and the broken crate beside it.
  decor[CRASH_TRUCK.cab.y][CRASH_TRUCK.cab.x] = "truckCab";
  decor[CRASH_TRUCK.box1.y][CRASH_TRUCK.box1.x] = "truckBox";
  decor[CRASH_TRUCK.box2.y][CRASH_TRUCK.box2.x] = "truckBox";
  decor[CRASH_CRATE.y][CRASH_CRATE.x] = "crateBroken";

  // Keep gameplay tiles clear of scatter.
  const clear: Array<{ x: number; y: number }> = [
    CRASH_SPAWN,
    CRASH_ROSA,
    CRASH_FEATHER,
    CRASH_EAST_SPAWN
  ];
  for (let y = CRASH_EXIT_EAST.y1; y <= CRASH_EXIT_EAST.y2; y++) {
    clear.push({ x: CRASH_EXIT_EAST.x1, y });
    clear.push({ x: CRASH_EXIT_EAST.x1 - 1, y }); // approach lane
  }
  for (const c of clear) decor[c.y][c.x] = null;

  // Map border: rocks so the player can't leave the shoulder.
  for (let x = 0; x < CRASH_WIDTH; x++) {
    decor[0][x] = "rock";
    decor[CRASH_HEIGHT - 1][x] = "rock";
  }
  for (let y = 0; y < CRASH_HEIGHT; y++) {
    decor[y][0] = "rock";
    decor[y][CRASH_WIDTH - 1] = "rock";
  }

  // Visible east gate: open the border across the exit band and lay a
  // frost trail toward it — the way out must LOOK like a way out.
  for (let y = CRASH_EXIT_EAST.y1; y <= CRASH_EXIT_EAST.y2; y++) {
    decor[y][CRASH_WIDTH - 1] = null;
    ground[y][CRASH_WIDTH - 1] = "frostSand";
  }
  for (let x = CRASH_FEATHER.x + 1; x < CRASH_WIDTH; x++) {
    for (const y of [7, 8]) {
      if (decor[y][x] === null && cellHash(x, y) % 2 === 0) ground[y][x] = "frostSand";
    }
  }

  return dressMap({ ground, decor });
}
