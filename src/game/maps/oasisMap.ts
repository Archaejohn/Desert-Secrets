/**
 * Zone 2 — Sahra's Oasis. Port of the original demo overworld: a desert
 * valley with an animated pond, palms, half-buried ruins and open dunes.
 * palmTop now lives in the overhead grid (drawn above actors) instead of
 * a runtime special case, and a frost-sand trail near the east exit hints
 * at Piggy's direction.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const OASIS_WIDTH = 32;
export const OASIS_HEIGHT = 20;

/** Default spawn: the southern flats. */
export const OASIS_SPAWN = { x: 8, y: 16 } as const;
/** Sahra the Keeper wanders near the pond. */
export const OASIS_SAHRA = { x: 23, y: 9 } as const;
/** The ambient patrolling scarab's home tile. */
export const OASIS_SCARAB = { x: 14, y: 13 } as const;
/** West-edge exit band → crash site. */
export const OASIS_WEST_EXIT = { x1: 1, y1: 9, x2: 1, y2: 11 } as const;
/** East-edge exit band → the Piggy Trail. */
export const OASIS_EAST_EXIT = { x1: 30, y1: 8, x2: 30, y2: 10 } as const;
/** Where the player appears when arriving from the crash site. */
export const OASIS_WEST_SPAWN = { x: 2, y: 10 } as const;
/** Where the player appears when arriving back from the trail. */
export const OASIS_EAST_SPAWN = { x: 29, y: 9 } as const;

export function buildOasisMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < OASIS_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < OASIS_WIDTH; x++) {
      const h = cellHash(x, y);
      let name = "sand";
      if (h % 17 === 0) name = "sand2";
      else if (h % 13 === 0) name = "sand3";
      else if (h % 61 === 0) name = "sandSparkle";
      ground[y].push(name);
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Dune crest lines across the open desert.
  for (const [row, x0, x1] of [
    [5, 2, 9],
    [12, 24, 30],
    [17, 14, 22]
  ] as const) {
    for (let x = x0; x <= x1; x++) ground[row][x] = "duneEdge";
  }

  // Oasis pond (top right) with palms around it.
  for (let y = 4; y <= 7; y++) {
    for (let x = 25; x <= 29; x++) {
      const edge = y === 4 || y === 7 || x === 25 || x === 29;
      // Rounded corners: keep the corners as sand.
      const corner = (y === 4 || y === 7) && (x === 25 || x === 29);
      if (!corner) ground[y][x] = edge && cellHash(x, y) % 3 === 0 ? "water2" : "water";
    }
  }
  const palms: Array<[number, number]> = [
    [24, 4],
    [30, 5],
    [26, 9]
  ];
  for (const [px, py] of palms) {
    decor[py][px] = "palmTrunk";
    overhead[py - 1][px] = "palmTop";
  }

  // Half-buried ruins (left side): broken walls, a pillar, relics.
  for (let x = 3; x <= 8; x++) decor[9][x] = cellHash(x, 9) % 4 === 0 ? "brickCracked" : "brick";
  for (let y = 10; y <= 12; y++) decor[y][3] = "brick";
  decor[10][8] = "brickCracked";
  decor[12][6] = "ruinPillar";
  decor[11][5] = "pot";
  decor[13][8] = "bones";

  // Scattered rocks and cacti.
  const rocks: Array<[number, number]> = [
    [13, 4],
    [18, 7],
    [12, 17],
    [27, 15],
    [20, 12]
  ];
  for (const [x, y] of rocks) decor[y][x] = "rock";
  const cacti: Array<[number, number]> = [
    [5, 3],
    [16, 3],
    [10, 11],
    [25, 17],
    [28, 14],
    [2, 14]
  ];
  for (const [x, y] of cacti) decor[y][x] = "cactus";

  // Frost-sand patches near the east exit: Piggy went that way.
  for (let y = 8; y <= 11; y++) {
    for (let x = 27; x <= 30; x++) {
      if (ground[y][x].startsWith("sand") && cellHash(x, y) % 3 === 0) {
        ground[y][x] = "frostSand";
      }
    }
  }
  // Map border: rocks so the player can't leave the valley.
  for (let x = 0; x < OASIS_WIDTH; x++) {
    decor[0][x] = "rock";
    decor[OASIS_HEIGHT - 1][x] = "rock";
  }
  for (let y = 0; y < OASIS_HEIGHT; y++) {
    decor[y][0] = "rock";
    decor[y][OASIS_WIDTH - 1] = "rock";
  }

  // Visible gates: open the border across both exit bands with frost paths.
  for (let y = OASIS_WEST_EXIT.y1; y <= OASIS_WEST_EXIT.y2; y++) {
    decor[y][0] = null;
    ground[y][0] = "frostSand";
    ground[y][1] = "frostSand";
  }
  for (let y = OASIS_EAST_EXIT.y1; y <= OASIS_EAST_EXIT.y2; y++) {
    decor[y][OASIS_WIDTH - 1] = null;
    ground[y][OASIS_WIDTH - 1] = "frostSand";
    ground[y][OASIS_WIDTH - 2] = "frostSand";
  }

  return { ground, decor, overhead };
}
