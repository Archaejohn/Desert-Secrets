/**
 * Act 7, Zone 2 — The Lava Vents. A volcanic gallery where the stone breathes
 * heat: molten `lavaVent` fissures (SOLID, animated) glow between walls of
 * basalt, and the smell of baking is unmistakable. A real traversal zone —
 * walk the ember floor around the vents. Two gates: north back to the descent,
 * south on to the old kitchens. No random encounters (Act 7 is combat-free).
 *
 * The vents and basalt are placed clear of the central corridor (x 12–13) and
 * the mid run (y=9), so the way north↔south is never sealed.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const PIZZA_V_WIDTH = 26;
export const PIZZA_V_HEIGHT = 18;

/** Default spawn: arriving from the warm descent (north gate). */
export const PIZZA_V_SPAWN = { x: 13, y: 2 } as const;
/** Where the player reappears walking back up from the kitchens. */
export const PIZZA_V_RETURN_SPAWN = { x: 13, y: 15 } as const;

/** The arrival trigger, up by the north spawn. */
export const PIZZA_V_ENTRY_TRIGGER = { x1: 11, y1: 2, x2: 15, y2: 4 } as const;

/** North gate → back up to the warm descent. */
export const PIZZA_V_EXIT_NORTH = { x1: 12, y1: 1, x2: 13, y2: 1 } as const;
export const PIZZA_V_NORTH_GATES = [
  { x: 12, y: 0 },
  { x: 13, y: 0 }
] as const;

/** South gate → on into the temple's old kitchens. */
export const PIZZA_V_EXIT_SOUTH = { x1: 12, y1: 16, x2: 13, y2: 16 } as const;
export const PIZZA_V_SOUTH_GATES = [
  { x: 12, y: 17 },
  { x: 13, y: 17 }
] as const;

/** All border gates (for the enclosure test). */
export const PIZZA_V_BORDER_GATES = [
  ...PIZZA_V_NORTH_GATES,
  ...PIZZA_V_SOUTH_GATES
] as const;

/** SOLID molten vents (glowing obstacles — animated; none seal a needed path). */
export const PIZZA_V_VENTS: Array<[number, number]> = [
  [5, 5],
  [8, 6],
  [18, 5],
  [20, 6],
  [6, 12],
  [19, 12],
  [9, 13],
  [17, 13]
];
/** SOLID basalt clusters (walk-arounds, clear of the central corridor). */
const BASALT: Array<[number, number]> = [
  [4, 9],
  [7, 9],
  [18, 9],
  [21, 9],
  [10, 6],
  [16, 12]
];

export function buildPizzaVentMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // The vent floor: warm ember stone threaded with ash and cooled crust.
  for (let y = 0; y < PIZZA_V_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < PIZZA_V_WIDTH; x++) {
      const h = cellHash(x, y);
      // Ash in clustered drifts (4x4 blocks) so the ash↔ember seams are
      // authored by the dressing pass instead of reading as noise (§2/G9).
      const ashDrift = cellHash(x >> 2, y >> 2) % 3 === 0;
      ground[y].push(ashDrift ? "ashFloor" : h % 6 === 0 ? "lavaCrust" : "emberFloor");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing basalt wall (two gates: north, south).
  for (let x = 0; x < PIZZA_V_WIDTH; x++) {
    decor[0][x] = "basaltWall";
    decor[PIZZA_V_HEIGHT - 1][x] = "basaltWall";
  }
  for (let y = 0; y < PIZZA_V_HEIGHT; y++) {
    decor[y][0] = "basaltWall";
    decor[y][PIZZA_V_WIDTH - 1] = "basaltWall";
  }
  for (const g of PIZZA_V_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // Molten vents (solid, animated) and basalt (solid) — obstacles to thread.
  for (const [x, y] of PIZZA_V_VENTS) decor[y][x] = "lavaVent";
  for (const [x, y] of BASALT) decor[y][x] = "basaltWall";

  return dressMap({ ground, decor, overhead });
}
