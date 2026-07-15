/**
 * Act 5, Zone 1 — The Warm Descent. The passage deeper into the stone from the
 * camp's back gallery (the Act 4 → Act 5 hand-off drops the party in here at
 * DESCENT_SPAWN, so `groveDescent` is the id that wiring targets). The floor
 * shifts from the camp's cold plank to the first creep of moss, and a shaft of
 * warm light glows up from below at the south gate — the first hint of the
 * sunlit chamber ahead. One gate, south, on into the grove approach; otherwise
 * fully enclosed. Mirrors Act 4's `minersCamp` entry-zone shape.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const DESCENT_WIDTH = 20;
export const DESCENT_HEIGHT = 14;

/** Default spawn: arriving from the camp above (the Act 4 → Act 5 hand-off). */
export const DESCENT_SPAWN = { x: 10, y: 2 } as const;
/** Where the player reappears walking back down from the grove approach. */
export const DESCENT_RETURN_SPAWN = { x: 10, y: 10 } as const;

/** The arrival trigger: the warmth and the glow catch the eye on the way in. */
export const DESCENT_ENTRY_TRIGGER = { x1: 8, y1: 2, x2: 12, y2: 4 } as const;

/** South gate → on into the grove approach. */
export const DESCENT_EXIT_SOUTH = { x1: 9, y1: 12, x2: 10, y2: 12 } as const;
export const DESCENT_SOUTH_GATES = [
  { x: 9, y: 13 },
  { x: 10, y: 13 }
] as const;

/** Solid cave-in rubble (walk-arounds — none seals the way south). */
const COLLAPSED: Array<[number, number]> = [
  [4, 4],
  [15, 5],
  [3, 9],
  [16, 9]
];

export function buildGroveDescentMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Floor greens as it descends: cold camp plank up top, moss creeping in
  // below, and the warm sunbeam glow pooling up at the south gate.
  for (let y = 0; y < DESCENT_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < DESCENT_WIDTH; x++) {
      const h = cellHash(x, y);
      let g: string;
      if (y >= 10) g = "sunbeam"; // the glow from the chamber below
      else if (y >= 6) g = h % 3 === 0 ? "groveMoss" : "groveGrass2"; // moss creeps in
      else g = h % 4 === 0 ? "campFloor2" : "campFloor"; // still cold plank up top
      ground[y].push(g);
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing cave wall (one gate, south).
  for (let x = 0; x < DESCENT_WIDTH; x++) {
    decor[0][x] = "caveWall";
    decor[DESCENT_HEIGHT - 1][x] = "caveWall";
  }
  for (let y = 0; y < DESCENT_HEIGHT; y++) {
    decor[y][0] = "caveWall";
    decor[y][DESCENT_WIDTH - 1] = "caveWall";
  }
  for (const g of DESCENT_SOUTH_GATES) decor[g.y][g.x] = null; // open the gate

  // Solid rubble (walk-arounds — placed clear of the central corridor).
  for (const [x, y] of COLLAPSED) decor[y][x] = "collapsedRock";

  return { ground, decor, overhead };
}
