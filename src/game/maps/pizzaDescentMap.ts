/**
 * Act 7, Zone 1 — The Warm Deep. The Act 6 → Act 7 entry zone: from the cold
 * reef the party pushes below everything, following the miners' old rumor of
 * smelled tomato pie (the Act 2 seed, paid off here). The floor darkens from
 * cold reef silt up top to warm ember stone, and a faint lava glow pools at the
 * south gate. One gate, south, on toward the lava vents; otherwise fully
 * enclosed. Mirrors Act 6's `reefDescent` single-forward-gate shape. No random
 * encounters (Act 7 is combat-free — a warm finale, not a fight).
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const PIZZA_D_WIDTH = 20;
export const PIZZA_D_HEIGHT = 14;

/** Default spawn: arriving from the reef court (the Act 6 → Act 7 hand-off). */
export const PIZZA_D_SPAWN = { x: 10, y: 2 } as const;
/** Where the player reappears walking back up from the vents. */
export const PIZZA_D_RETURN_SPAWN = { x: 10, y: 10 } as const;

/** The arrival trigger: the warm draft and the smell of baking bread. */
export const PIZZA_D_ENTRY_TRIGGER = { x1: 8, y1: 2, x2: 12, y2: 4 } as const;

/** South gate → on toward the lava vents. */
export const PIZZA_D_EXIT_SOUTH = { x1: 9, y1: 12, x2: 10, y2: 12 } as const;
export const PIZZA_D_SOUTH_GATES = [
  { x: 9, y: 13 },
  { x: 10, y: 13 }
] as const;

/** SOLID basalt outcrops (walk-arounds — none seals the way south). */
const BASALT: Array<[number, number]> = [
  [4, 4],
  [15, 5],
  [3, 9],
  [16, 9]
];

export function buildPizzaDescentMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Floor warms as it descends: cold reef silt up top, ember stone below, and
  // the lava's glow crusting the ground at the south gate.
  for (let y = 0; y < PIZZA_D_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < PIZZA_D_WIDTH; x++) {
      const h = cellHash(x, y);
      let g: string;
      if (y >= 10) g = h % 3 === 0 ? "lavaCrust" : "emberFloor2"; // lava glow from below
      else if (y >= 5) g = h % 4 === 0 ? "emberFloor2" : "emberFloor";
      else g = h % 3 === 0 ? "ashFloor" : "emberFloor"; // cooler up top
      ground[y].push(g);
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing basalt wall (one gate, south).
  for (let x = 0; x < PIZZA_D_WIDTH; x++) {
    decor[0][x] = "basaltWall";
    decor[PIZZA_D_HEIGHT - 1][x] = "basaltWall";
  }
  for (let y = 0; y < PIZZA_D_HEIGHT; y++) {
    decor[y][0] = "basaltWall";
    decor[y][PIZZA_D_WIDTH - 1] = "basaltWall";
  }
  for (const g of PIZZA_D_SOUTH_GATES) decor[g.y][g.x] = null; // open the gate

  // Solid basalt (walk-arounds — placed clear of the central corridor).
  for (const [x, y] of BASALT) decor[y][x] = "basaltWall";

  return { ground, decor, overhead };
}
