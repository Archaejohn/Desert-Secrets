/**
 * Act 6, Zone 2 — The Crawlers' Garden. The crystal-crawlers FARM glowing kelp
 * here on purpose: cultivated MINT kelp climbing trellises in tidy, walkable
 * rows (bright, orderly — the crop the party is after), set against tangled
 * SOLID wild kelp and coral. Establishes the crawlers as territorial farmers,
 * not monsters — but a predator (the reefstalker) hunts the rows, so this is a
 * real traversal/encounter zone. Two gates: north back to the descent, south on
 * to the coral warren; otherwise fully enclosed.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const REEF_G_WIDTH = 30;
export const REEF_G_HEIGHT = 18;

/** Default spawn: arriving from the descent (north gate). */
export const REEF_G_SPAWN = { x: 15, y: 2 } as const;
/** Where the player reappears walking back up from the coral warren. */
export const REEF_G_RETURN_SPAWN = { x: 15, y: 15 } as const;

/** The arrival trigger, up by the north spawn. */
export const REEF_G_ENTRY_TRIGGER = { x1: 13, y1: 2, x2: 17, y2: 4 } as const;

/** A tended row of cultivated mint kelp (walkable landmark — the crop). */
export const REEF_G_MINT_ROW = { x: 21, y: 9 } as const;

/** North gate → back up to the drowned stair. */
export const REEF_G_EXIT_NORTH = { x1: 14, y1: 1, x2: 15, y2: 1 } as const;
export const REEF_G_NORTH_GATES = [
  { x: 14, y: 0 },
  { x: 15, y: 0 }
] as const;

/** South gate → down into the coral warren. */
export const REEF_G_EXIT_SOUTH = { x1: 14, y1: 16, x2: 15, y2: 16 } as const;
export const REEF_G_SOUTH_GATES = [
  { x: 14, y: 17 },
  { x: 15, y: 17 }
] as const;

/** All border gates (for the enclosure test). */
export const REEF_G_BORDER_GATES = [
  ...REEF_G_NORTH_GATES,
  ...REEF_G_SOUTH_GATES
] as const;

/** SOLID coral heads (walk-arounds). */
const CORAL: Array<[number, number]> = [
  [6, 5],
  [25, 13],
  [8, 13],
  [23, 5]
];
/** SOLID tangled wild kelp (walk-arounds — the untended growth). */
const WILD_KELP: Array<[number, number]> = [
  [10, 7],
  [7, 10],
  [27, 10],
  [12, 13]
];
/** SOLID crawler trellis frames (the farming structure). */
const TRELLIS: Array<[number, number]> = [
  [19, 6],
  [23, 9],
  [19, 12]
];
/** Cultivated mint-kelp rows — WALKABLE decor (the crop, in neat columns). */
const MINT_ROWS: Array<[number, number]> = [
  [20, 8],
  [20, 9],
  [20, 10],
  [21, 8],
  [21, 9],
  [21, 10],
  [22, 8],
  [22, 9],
  [22, 10]
];
/** Walkable glow decor scattered in the garden. */
const ANEMONES: Array<[number, number]> = [
  [11, 4],
  [8, 8],
  [26, 7]
];
const SHELLS: Array<[number, number]> = [
  [19, 4],
  [10, 12],
  [24, 12]
];

export function buildReefGardenMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // The garden floor: glowing bioluminescent moss with darker reef patches.
  for (let y = 0; y < REEF_G_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < REEF_G_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 5 === 0 ? "reefFloor" : h % 3 === 0 ? "reefFloor2" : "glowMoss");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing reef wall (two gates: north, south).
  for (let x = 0; x < REEF_G_WIDTH; x++) {
    decor[0][x] = "reefWall";
    decor[REEF_G_HEIGHT - 1][x] = "reefWall";
  }
  for (let y = 0; y < REEF_G_HEIGHT; y++) {
    decor[y][0] = "reefWall";
    decor[y][REEF_G_WIDTH - 1] = "reefWall";
  }
  for (const g of REEF_G_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // Cultivated mint-kelp rows (walkable) — the tended crop the party wants.
  for (const [x, y] of MINT_ROWS) ground[y][x] = "mintKelp";

  // Solid dressings (walk-arounds — none seals a needed path).
  for (const [x, y] of CORAL) decor[y][x] = "coralHead";
  for (const [x, y] of WILD_KELP) {
    decor[y][x] = "wildKelp";
    // overhanging wild-kelp canopy the party swims beneath (overhead, non-solid)
    overhead[y - 1][x] = "kelpCanopy";
  }
  for (const [x, y] of TRELLIS) decor[y][x] = "kelpTrellis";

  // Walkable glow decor.
  for (const [x, y] of ANEMONES) if (decor[y][x] === null) decor[y][x] = "seaAnemone";
  for (const [x, y] of SHELLS) if (decor[y][x] === null) decor[y][x] = "shellCluster";

  return dressMap({ ground, decor, overhead });
}
