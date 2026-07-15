/**
 * Act 6, Zone 1 — The Drowned Stair. The Act 5 → Act 6 entry zone: from Sahra's
 * warm grove the party pushes deeper than Act 2's galleries ever went, down a
 * flooded stair back into cold water — the crystal-crawlers' home. The floor
 * darkens from dry reef silt up top to glowing garden moss at the south gate,
 * the first hint of the tended kelp beyond. One gate, south, on into the
 * crawlers' garden; otherwise fully enclosed. Mirrors Act 5's `groveDescent`
 * single-forward-gate entry shape. No random encounters.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const REEF_D_WIDTH = 20;
export const REEF_D_HEIGHT = 14;

/** Default spawn: arriving from Sahra's grove (the Act 5 → Act 6 hand-off). */
export const REEF_D_SPAWN = { x: 10, y: 2 } as const;
/** Where the player reappears walking back up from the garden. */
export const REEF_D_RETURN_SPAWN = { x: 10, y: 10 } as const;

/** The arrival trigger: the cold water and the glow catch the eye. */
export const REEF_D_ENTRY_TRIGGER = { x1: 8, y1: 2, x2: 12, y2: 4 } as const;

/** South gate → on into the crawlers' garden. */
export const REEF_D_EXIT_SOUTH = { x1: 9, y1: 12, x2: 10, y2: 12 } as const;
export const REEF_D_SOUTH_GATES = [
  { x: 9, y: 13 },
  { x: 10, y: 13 }
] as const;

/** SOLID coral heads (walk-arounds — none seals the way south). */
const CORAL: Array<[number, number]> = [
  [4, 4],
  [15, 5],
  [3, 9],
  [16, 9]
];

export function buildReefDescentMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Floor darkens then glows as it descends: dry reef silt up top, reef floor
  // below, and the garden's bioluminescent glow-moss pooling at the south gate.
  for (let y = 0; y < REEF_D_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < REEF_D_WIDTH; x++) {
      const h = cellHash(x, y);
      let g: string;
      if (y >= 10) g = "glowMoss"; // the garden's glow from below
      else if (y >= 6) g = h % 3 === 0 ? "reefFloor2" : "reefFloor";
      // Silt drifts in clustered patches (4x4 blocks) so the dressing pass
      // can author real silt↔floor transitions (§2/G9).
      else g = cellHash(x >> 2, y >> 2) % 3 === 0 ? "reefSilt" : "reefFloor";
      ground[y].push(g);
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing reef wall (one gate, south).
  for (let x = 0; x < REEF_D_WIDTH; x++) {
    decor[0][x] = "reefWall";
    decor[REEF_D_HEIGHT - 1][x] = "reefWall";
  }
  for (let y = 0; y < REEF_D_HEIGHT; y++) {
    decor[y][0] = "reefWall";
    decor[y][REEF_D_WIDTH - 1] = "reefWall";
  }
  for (const g of REEF_D_SOUTH_GATES) decor[g.y][g.x] = null; // open the gate

  // Solid coral (walk-arounds — placed clear of the central corridor).
  for (const [x, y] of CORAL) decor[y][x] = "coralHead";

  return dressMap({ ground, decor, overhead });
}
