/**
 * Act 6, Zone 3 — The Coral Warren. A twisting maze of coral walls and dead-end
 * pockets where the party finally corners Piggy for real. The tense near-catch
 * plays on the central path (`REEF_W_CHASE_TRIGGER`): he's cornered in a coral
 * dead-end (the east alcove), frightened rather than playful, and slips through
 * a gap too thin for Joseph. A real traversal/encounter zone. Two gates: north
 * back to the garden, south on to the glowing hollow. The east alcove is a
 * BFS-proven cul-de-sac behind a single entrance tile (`REEF_W_ALCOVE_ENTRANCE`).
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const REEF_W_WIDTH = 26;
export const REEF_W_HEIGHT = 18;

/** Default spawn: arriving from the garden (north gate). */
export const REEF_W_SPAWN = { x: 13, y: 2 } as const;
/** Where the player reappears walking back up from the hollow. */
export const REEF_W_RETURN_SPAWN = { x: 13, y: 15 } as const;

/** The arrival trigger, up by the north spawn. */
export const REEF_W_ENTRY_TRIGGER = { x1: 11, y1: 2, x2: 15, y2: 4 } as const;
/** The walk-over path where the tense chase-and-turn beat fires. */
export const REEF_W_CHASE_TRIGGER = { x1: 11, y1: 8, x2: 14, y2: 10 } as const;

/** The coral dead-end where Piggy is cornered (walkable, inside the alcove). */
export const REEF_W_CORNER = { x: 22, y: 9 } as const;
/** The single entrance tile of the east alcove (the cul-de-sac's mouth). */
export const REEF_W_ALCOVE_ENTRANCE = { x: 18, y: 9 } as const;
/** The thin gap Piggy slips through, too tight for Joseph (cosmetic vanish). */
export const REEF_W_GAP = { x: 24, y: 9 } as const;

/** North gate → back up to the crawlers' garden. */
export const REEF_W_EXIT_NORTH = { x1: 12, y1: 1, x2: 13, y2: 1 } as const;
export const REEF_W_NORTH_GATES = [
  { x: 12, y: 0 },
  { x: 13, y: 0 }
] as const;

/** South gate → down into the glowing hollow. */
export const REEF_W_EXIT_SOUTH = { x1: 12, y1: 16, x2: 13, y2: 16 } as const;
export const REEF_W_SOUTH_GATES = [
  { x: 12, y: 17 },
  { x: 13, y: 17 }
] as const;

/** All border gates (for the enclosure test). */
export const REEF_W_BORDER_GATES = [
  ...REEF_W_NORTH_GATES,
  ...REEF_W_SOUTH_GATES
] as const;

/** SOLID coral/wild-kelp maze clusters (walk-arounds — none seal a needed path). */
const CORAL: Array<[number, number]> = [
  [5, 5],
  [9, 6],
  [6, 13],
  [16, 5],
  [16, 13],
  [8, 10],
  [4, 9]
];
const WILD_KELP: Array<[number, number]> = [
  [7, 3],
  [10, 14],
  [20, 3],
  [20, 14]
];

export function buildReefWarrenMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // The warren floor: dark reef silt threaded with a little glow.
  for (let y = 0; y < REEF_W_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < REEF_W_WIDTH; x++) {
      const h = cellHash(x, y);
      // Blockwise patches (4x4) rather than per-cell scatter, so the silt
      // owns real, authored borders against the floor pockets (§2/G9).
      const b = cellHash(x >> 2, y >> 2);
      ground[y].push(
        b % 6 === 0 ? "glowMoss" : b % 3 === 0 ? (h % 3 === 0 ? "reefFloor2" : "reefFloor") : "reefSilt"
      );
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing reef wall (two gates: north, south).
  for (let x = 0; x < REEF_W_WIDTH; x++) {
    decor[0][x] = "reefWall";
    decor[REEF_W_HEIGHT - 1][x] = "reefWall";
  }
  for (let y = 0; y < REEF_W_HEIGHT; y++) {
    decor[y][0] = "reefWall";
    decor[y][REEF_W_WIDTH - 1] = "reefWall";
  }
  for (const g of REEF_W_BORDER_GATES) decor[g.y][g.x] = null; // open the gates

  // The east coral alcove — the dead-end Piggy is cornered in. Walled off on
  // three interior sides (the border is its east wall) with a single mouth at
  // REEF_W_ALCOVE_ENTRANCE, so it is a true cul-de-sac.
  for (let x = 18; x <= 24; x++) {
    decor[6][x] = "coralHead"; // north wall of the alcove
    decor[12][x] = "coralHead"; // south wall of the alcove
  }
  for (let y = 7; y <= 11; y++) decor[y][18] = "coralHead"; // west wall
  decor[REEF_W_ALCOVE_ENTRANCE.y][REEF_W_ALCOVE_ENTRANCE.x] = null; // open the mouth

  // Maze dressings (walk-arounds — placed clear of the central corridor and
  // the run east to the alcove mouth at y=9).
  for (const [x, y] of CORAL) decor[y][x] = "coralHead";
  for (const [x, y] of WILD_KELP) decor[y][x] = "wildKelp";

  return dressMap({ ground, decor, overhead });
}
