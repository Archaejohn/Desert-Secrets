/**
 * Act 7, Zone 3 — The Old Kitchens. The space turns from raw volcanic rock into
 * something BUILT: the ash/ember floor gives way to carved steps and a dressed
 * stone floor, temple columns hold up the roof, a cold pizza-oven relic stands
 * against the wall, and old signage hangs overhead — the temple's kitchens,
 * repurposed. Two gates: north back to the vents, south on into the restaurant.
 * No random encounters.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const PIZZA_A_WIDTH = 24;
export const PIZZA_A_HEIGHT = 16;

/** Default spawn: arriving from the lava vents (north gate). */
export const PIZZA_A_SPAWN = { x: 12, y: 2 } as const;
/** Where the player reappears walking back up from the restaurant. */
export const PIZZA_A_RETURN_SPAWN = { x: 12, y: 13 } as const;

/** The arrival trigger, up by the north spawn. */
export const PIZZA_A_ENTRY_TRIGGER = { x1: 10, y1: 2, x2: 14, y2: 4 } as const;

/** North gate → back up to the lava vents. */
export const PIZZA_A_EXIT_NORTH = { x1: 11, y1: 1, x2: 12, y2: 1 } as const;
export const PIZZA_A_NORTH_GATES = [
  { x: 11, y: 0 },
  { x: 12, y: 0 }
] as const;

/** South gate → on into La Pizzeria Sotterranea. */
export const PIZZA_A_EXIT_SOUTH = { x1: 11, y1: 14, x2: 12, y2: 14 } as const;
export const PIZZA_A_SOUTH_GATES = [
  { x: 11, y: 15 },
  { x: 12, y: 15 }
] as const;

/** All border gates (for the enclosure test). */
export const PIZZA_A_BORDER_GATES = [
  ...PIZZA_A_NORTH_GATES,
  ...PIZZA_A_SOUTH_GATES
] as const;

/** SOLID temple columns (a colonnade; walk-arounds clear of the centre lane). */
const COLUMNS: Array<[number, number]> = [
  [5, 6],
  [18, 6],
  [5, 10],
  [18, 10]
];
/** A cold pizza-oven relic against the wall (SOLID, off-path). */
const OVEN_RELIC: Array<[number, number]> = [[3, 8]];
/** Old signage hung overhead (never solid, drawn above the actors). */
const SIGNS: Array<[number, number]> = [
  [8, 4],
  [15, 4]
];

export function buildPizzaApproachMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Floor turns from raw rock (top) to dressed stone (bottom): ash/ember up
  // top, carved steps mid, a built tile floor at the restaurant threshold.
  for (let y = 0; y < PIZZA_A_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < PIZZA_A_WIDTH; x++) {
      const h = cellHash(x, y);
      let g: string;
      if (y >= 10) g = h % 3 === 0 ? "tileFloor2" : "tileFloor"; // built floor
      else if (y >= 5) g = h % 4 === 0 ? "ashFloor" : "carvedStep"; // carved steps
      else g = h % 3 === 0 ? "ashFloor" : "emberFloor"; // raw rock
      ground[y].push(g);
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing basalt wall (two gates: north, south).
  for (let x = 0; x < PIZZA_A_WIDTH; x++) {
    decor[0][x] = "basaltWall";
    decor[PIZZA_A_HEIGHT - 1][x] = "basaltWall";
  }
  for (let y = 0; y < PIZZA_A_HEIGHT; y++) {
    decor[y][0] = "basaltWall";
    decor[y][PIZZA_A_WIDTH - 1] = "basaltWall";
  }
  for (const g of PIZZA_A_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // The built dressings.
  for (const [x, y] of COLUMNS) decor[y][x] = "stoneColumn";
  for (const [x, y] of OVEN_RELIC) decor[y][x] = "pizzaOven";
  for (const [x, y] of SIGNS) overhead[y][x] = "hangSign";

  return { ground, decor, overhead };
}
