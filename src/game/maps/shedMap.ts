/**
 * Zone — The Shed. A small utility yard south of the homestead where
 * Joseph's family keeps tools and water buckets. One screen, one job:
 * find the bucket — sitting in the open, directly reachable from the
 * entrance, with a low wall behind it for flavor only (never blocking
 * the approach). Pure data, deterministic, unit-testable.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const SHED_WIDTH = 16;
export const SHED_HEIGHT = 12;

/** Default spawn: just inside the north gate, arriving from the oasis. */
export const SHED_SPAWN = { x: 8, y: 2 } as const;
/** The bucket sits out in the open, a short straight walk from the gate. */
export const SHED_BUCKET = { x: 8, y: 5 } as const;
/** North-edge exit band → back to the oasis, south of the coop. */
export const SHED_NORTH_EXIT = { x1: 7, y1: 0, x2: 8, y2: 0 } as const;

export function buildShedMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];

  for (let y = 0; y < SHED_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < SHED_WIDTH; x++) {
      const h = cellHash(x, y);
      let name = "sand";
      if (h % 15 === 0) name = "sand2";
      else if (h % 11 === 0) name = "sand3";
      ground[y].push(name);
      decor[y].push(null);
    }
  }

  // A low backdrop wall BEHIND the bucket (south of it) — flavor only,
  // never between the entrance and the pickup. Gap in the middle keeps
  // it from reading as a fully enclosed room.
  decor[7][6] = "brick";
  decor[7][7] = cellHash(7, 7) % 3 === 0 ? "brickCracked" : "brick";
  decor[7][9] = "brick";
  decor[7][10] = cellHash(10, 7) % 3 === 0 ? "brickCracked" : "brick";
  decor[8][6] = "ruinPillar";
  decor[8][10] = "ruinPillar";

  // A water barrel and scattered flavor props, all clear of the direct
  // spawn-to-bucket path (column 7-9, rows 2-5).
  decor[6][3] = "pot";
  const rocks: Array<[number, number]> = [
    [3, 3],
    [13, 4],
    [12, 9],
    [3, 9]
  ];
  for (const [x, y] of rocks) decor[y][x] = "rock";
  const cacti: Array<[number, number]> = [
    [2, 6],
    [14, 7]
  ];
  for (const [x, y] of cacti) decor[y][x] = "cactus";
  decor[9][8] = "bones";

  // Map border, fully solid.
  for (let x = 0; x < SHED_WIDTH; x++) {
    decor[0][x] = "rock";
    decor[SHED_HEIGHT - 1][x] = "rock";
  }
  for (let y = 0; y < SHED_HEIGHT; y++) {
    decor[y][0] = "rock";
    decor[y][SHED_WIDTH - 1] = "rock";
  }

  // Visible gate: the north exit, back to the oasis.
  for (let x = SHED_NORTH_EXIT.x1; x <= SHED_NORTH_EXIT.x2; x++) {
    decor[0][x] = null;
    ground[0][x] = "sand2";
    ground[1][x] = "sand2";
  }

  return dressMap({ ground, decor });
}
