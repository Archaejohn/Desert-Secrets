/**
 * Zone — The Shed. A small utility yard south of the homestead where
 * Joseph's family keeps tools and water buckets. One screen, one job:
 * find the bucket. Pure data, deterministic, unit-testable.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const SHED_WIDTH = 16;
export const SHED_HEIGHT = 12;

/** Default spawn: just inside the north gate, arriving from the oasis. */
export const SHED_SPAWN = { x: 8, y: 2 } as const;
/** The bucket sits against the back wall of the lean-to. */
export const SHED_BUCKET = { x: 8, y: 6 } as const;
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

  // A small three-sided lean-to sheltering the bucket: brick back wall
  // and two short side walls, open to the north (where the player enters).
  for (let x = 6; x <= 10; x++) decor[5][x] = cellHash(x, 5) % 4 === 0 ? "brickCracked" : "brick";
  for (let y = 5; y <= 8; y++) {
    decor[y][6] = "ruinPillar";
    decor[y][10] = "ruinPillar";
  }

  // A water barrel and scattered flavor props.
  decor[7][8] = "pot";
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

  return { ground, decor };
}
