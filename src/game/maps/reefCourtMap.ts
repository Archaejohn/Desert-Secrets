/**
 * Act 6, Zone 5 — The Crawler Court. The heart of the garden, where the crawler
 * elders keep the oldest, finest mint-kelp row. This is the diplomacy zone: the
 * crawler warden stands by the row, and getting the seaweed is a TRADE, not a
 * fight (see reefParley / ReefCourtScene). One gate, north, back to the hollow;
 * otherwise fully enclosed (the way on to Act 7 is the end card, a teammate's
 * next task). No random encounters.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const REEF_C_WIDTH = 22;
export const REEF_C_HEIGHT = 16;

/** Default spawn: arriving from the glowing hollow (north gate). */
export const REEF_C_SPAWN = { x: 11, y: 2 } as const;

/** The crawler warden — she stands by the oldest mint-kelp row. */
export const REEF_C_NPC = { x: 10, y: 8 } as const;
/** The oldest cultivated mint-kelp row — the seaweed traded (walkable landmark). */
export const REEF_C_OLD_ROW = { x: 13, y: 8 } as const;
/** Where the reef stalker knifes in if the trade turns to a fight (cosmetic). */
export const REEF_C_PREDATOR = { x: 17, y: 8 } as const;

/** The arrival trigger, up by the north spawn. */
export const REEF_C_ENTRY_TRIGGER = { x1: 9, y1: 2, x2: 13, y2: 4 } as const;

/** North gate → back up to the glowing hollow. */
export const REEF_C_EXIT_NORTH = { x1: 10, y1: 1, x2: 11, y2: 1 } as const;
export const REEF_C_NORTH_GATES = [
  { x: 10, y: 0 },
  { x: 11, y: 0 }
] as const;

/** SOLID crawler trellis frames (the court's tended structure) — off the path. */
const TRELLIS: Array<[number, number]> = [
  [8, 5],
  [12, 5],
  [16, 11]
];
/** SOLID coral + wild kelp (walk-arounds — none seals the way to the warden). */
const CORAL: Array<[number, number]> = [
  [17, 4],
  [5, 12]
];
const WILD_KELP: Array<[number, number]> = [
  [4, 4],
  [16, 6]
];
/** The oldest mint-kelp row (walkable landmark tiles, by the warden). */
const OLD_ROW: Array<[number, number]> = [
  [12, 8],
  [13, 8],
  [14, 8],
  [13, 9]
];
/** Walkable glow decor. */
const ANEMONES: Array<[number, number]> = [
  [7, 10],
  [15, 9]
];

export function buildReefCourtMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // The court floor: the garden's brightest bioluminescent glow-moss.
  for (let y = 0; y < REEF_C_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < REEF_C_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 7 === 0 ? "reefFloor" : h % 3 === 0 ? "reefFloor2" : "glowMoss");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing reef wall (one gate, north).
  for (let x = 0; x < REEF_C_WIDTH; x++) {
    decor[0][x] = "reefWall";
    decor[REEF_C_HEIGHT - 1][x] = "reefWall";
  }
  for (let y = 0; y < REEF_C_HEIGHT; y++) {
    decor[y][0] = "reefWall";
    decor[y][REEF_C_WIDTH - 1] = "reefWall";
  }
  for (const g of REEF_C_NORTH_GATES) decor[g.y][g.x] = null; // open the gate

  // The oldest mint-kelp row (walkable) the warden trades from.
  for (const [x, y] of OLD_ROW) ground[y][x] = "mintKelp";

  // Solid dressings (walk-arounds — none seals the way to the warden).
  for (const [x, y] of TRELLIS) decor[y][x] = "kelpTrellis";
  for (const [x, y] of CORAL) decor[y][x] = "coralHead";
  for (const [x, y] of WILD_KELP) decor[y][x] = "wildKelp";

  // Walkable glow decor.
  for (const [x, y] of ANEMONES) if (decor[y][x] === null) decor[y][x] = "seaAnemone";

  return { ground, decor, overhead };
}
