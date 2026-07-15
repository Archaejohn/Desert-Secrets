/**
 * Act 7, Zone 4 — La Pizzeria Sotterranea. The restaurant itself, carved into
 * the temple's old kitchens: a checkered dining floor, tables set for guests
 * who stopped coming three thousand years ago, temple columns, and the great
 * oven at the south end — flanked by molten lava vents that light the whole
 * room — where Chef Testudo works. The bake, the catch and the reveal all play
 * here. One gate, north, back to the old kitchens; the way onward (the walk
 * back up) is opened narratively after the reveal (hand-off to `pizzaAscent`),
 * so the map is otherwise enclosed. No random encounters.
 */
import type { ZoneMap } from "./types";

export const PIZZA_P_WIDTH = 26;
export const PIZZA_P_HEIGHT = 18;

/** Default spawn: arriving from the old kitchens (north gate). */
export const PIZZA_P_SPAWN = { x: 13, y: 2 } as const;

/** Chef Testudo stands in front of the great oven (walkable tile). */
export const PIZZA_P_TESTUDO = { x: 13, y: 11 } as const;
/** The oven's centre (behind Testudo; the lit heart of the room). */
export const PIZZA_P_OVEN = { x: 13, y: 13 } as const;
/** Where the cosmetic Piggy bursts in (the north doorway) and where he ends up
 *  (climbing into Joseph's arms, by Testudo). */
export const PIZZA_P_PIGGY_ARRIVE = { x: 13, y: 2 } as const;
export const PIZZA_P_PIGGY_END = { x: 13, y: 10 } as const;

/**
 * The rest point: a set dining table on the west side (the table at (8,9) is
 * solid; the party sits at the walkable tile just above it). A bowl of
 * Testudo's soup, usable while exploring the restaurant before the finale
 * beats begin. See docs/CONTRACTS.md ("v19").
 */
export const PIZZA_P_TABLE = { x: 8, y: 8 } as const;

/** The arrival trigger, up by the north spawn. */
export const PIZZA_P_ENTRY_TRIGGER = { x1: 11, y1: 2, x2: 15, y2: 4 } as const;

/** North gate → back up to the old kitchens. */
export const PIZZA_P_EXIT_NORTH = { x1: 12, y1: 1, x2: 13, y2: 1 } as const;
export const PIZZA_P_NORTH_GATES = [
  { x: 12, y: 0 },
  { x: 13, y: 0 }
] as const;

/** SOLID set dinner tables (walk-arounds — off the central approach lane). */
const TABLES: Array<[number, number]> = [
  [5, 5],
  [8, 5],
  [17, 5],
  [20, 5],
  [5, 9],
  [8, 9],
  [17, 9],
  [20, 9]
];
/** SOLID temple columns at the corners of the dining room. */
const COLUMNS: Array<[number, number]> = [
  [3, 3],
  [22, 3],
  [3, 14],
  [22, 14]
];
/** SOLID oven bricks (the great oven, behind Testudo). */
const OVEN: Array<[number, number]> = [
  [12, 13],
  [13, 13],
  [14, 13]
];
/** SOLID molten vents flanking the oven — the room's lava-vent light. */
const VENTS: Array<[number, number]> = [
  [10, 13],
  [16, 13]
];
/** Warm oven-lit floor around the hearth (walkable decor). */
const GLOW: Array<[number, number]> = [
  [12, 10],
  [13, 10],
  [14, 10],
  [11, 11],
  [12, 11],
  [14, 11],
  [15, 11],
  [12, 12],
  [14, 12]
];
/** Old signage hung overhead (never solid): over the door and the oven. */
const SIGNS: Array<[number, number]> = [
  [12, 3],
  [13, 3],
  [6, 4],
  [19, 4]
];

export function buildPizzeriaMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // The dining floor: a warm checker of tile floors.
  for (let y = 0; y < PIZZA_P_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < PIZZA_P_WIDTH; x++) {
      ground[y].push((x + y) % 2 === 0 ? "tileFloor" : "tileFloor2");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Warm oven-light on the floor around the hearth (walkable).
  for (const [x, y] of GLOW) ground[y][x] = "ovenGlow";

  // Enclosing basalt wall (one gate, north).
  for (let x = 0; x < PIZZA_P_WIDTH; x++) {
    decor[0][x] = "basaltWall";
    decor[PIZZA_P_HEIGHT - 1][x] = "basaltWall";
  }
  for (let y = 0; y < PIZZA_P_HEIGHT; y++) {
    decor[y][0] = "basaltWall";
    decor[y][PIZZA_P_WIDTH - 1] = "basaltWall";
  }
  for (const g of PIZZA_P_NORTH_GATES) decor[g.y][g.x] = null; // open the gate

  // Furnishings (all solid, all off the central approach lane at x=12–14).
  for (const [x, y] of TABLES) decor[y][x] = "pizzaTable";
  for (const [x, y] of COLUMNS) decor[y][x] = "stoneColumn";
  for (const [x, y] of OVEN) decor[y][x] = "pizzaOven";
  for (const [x, y] of VENTS) decor[y][x] = "lavaVent";
  for (const [x, y] of SIGNS) overhead[y][x] = "hangSign";

  return { ground, decor, overhead };
}
