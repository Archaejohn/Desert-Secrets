/**
 * Act 7, Zone 5 — The Long Way Up. The finale: the walk back toward the
 * surface, Piggy caught and full and following the party. A climbing shaft that
 * switchbacks up past two staggered basalt cross-walls (BFS-verified: the climb
 * from the bottom entry to the top finale trigger threads both gaps). It is
 * deliberately ENCLOSED with no gate — the only way out is the floor giving way
 * (the Part One cliffhanger, driven by the finale trigger near the top). No
 * random encounters.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const PIZZA_ASCENT_WIDTH = 20;
export const PIZZA_ASCENT_HEIGHT = 18;

/** Default spawn: arriving from the pizzeria (the hand-off after the reveal). */
export const PIZZA_ASCENT_SPAWN = { x: 10, y: 15 } as const;

/** The arrival beat (Piggy following, the warm quiet before the finale). */
export const PIZZA_ASCENT_ENTRY_TRIGGER = { x1: 8, y1: 13, x2: 12, y2: 15 } as const;
/** Near the top: Rosa's radio crackles back, then the floor gives way. */
export const PIZZA_ASCENT_FINALE_TRIGGER = { x1: 8, y1: 2, x2: 12, y2: 4 } as const;

/** The two staggered switchback walls (SOLID; each leaves one gap). */
export const PIZZA_ASCENT_WALL_LOWER_Y = 11;
export const PIZZA_ASCENT_WALL_UPPER_Y = 6;
/** The gaps that thread the climb (walkable — proof the switchback connects). */
export const PIZZA_ASCENT_GAP_LOWER = { x: 15, y: 11 } as const;
export const PIZZA_ASCENT_GAP_UPPER = { x: 4, y: 6 } as const;

export function buildPizzaAscentMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Floor cools as it climbs toward the surface: warm ember/crust at the
  // bottom, carved steps mid, cool ash up top.
  for (let y = 0; y < PIZZA_ASCENT_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < PIZZA_ASCENT_WIDTH; x++) {
      const h = cellHash(x, y);
      let g: string;
      if (y >= 12) g = h % 3 === 0 ? "lavaCrust" : "emberFloor";
      else if (y >= 6) g = h % 4 === 0 ? "ashFloor" : "carvedStep";
      else g = h % 3 === 0 ? "emberFloor" : "ashFloor";
      ground[y].push(g);
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Enclosing basalt wall (NO gate — the way out is the collapse).
  for (let x = 0; x < PIZZA_ASCENT_WIDTH; x++) {
    decor[0][x] = "basaltWall";
    decor[PIZZA_ASCENT_HEIGHT - 1][x] = "basaltWall";
  }
  for (let y = 0; y < PIZZA_ASCENT_HEIGHT; y++) {
    decor[y][0] = "basaltWall";
    decor[y][PIZZA_ASCENT_WIDTH - 1] = "basaltWall";
  }

  // Lower switchback wall: spans the width but for a single gap on the right.
  for (let x = 1; x <= PIZZA_ASCENT_WIDTH - 2; x++) {
    if (x !== PIZZA_ASCENT_GAP_LOWER.x) decor[PIZZA_ASCENT_WALL_LOWER_Y][x] = "basaltWall";
  }
  // Upper switchback wall: spans the width but for a single gap on the left.
  for (let x = 1; x <= PIZZA_ASCENT_WIDTH - 2; x++) {
    if (x !== PIZZA_ASCENT_GAP_UPPER.x) decor[PIZZA_ASCENT_WALL_UPPER_Y][x] = "basaltWall";
  }

  return { ground, decor, overhead };
}
