/**
 * Act 3, Zone 2 — The Kelp Forest. The main floe-hopping through-route of
 * the Sunless Sea: an entry room (arriving from the entry overlook), a
 * central hub, and a TRUE FORK east to the deep-kelp exit — two disjoint
 * floe corridors (routes A and B) that both reach the east exit room, so
 * blocking one pinch leaves the other open (block both and the deep bed is
 * cut off). A false-lead alcove dead-ends off the hub. Two dead-end SPURS
 * hang off the hub, each behind a single entrance tile: a west spur whose
 * gate drops into the flooded sun-temple ruin, and a south spur whose gate
 * drops into Fluffball's kelp bed. The north gate climbs back to the entry
 * overlook.
 *
 * Topology (tested in tests/game/maps2.test.ts):
 * - Routes A (north, y=12) and B (south, y=15) are vertex-disjoint outside
 *   the hub; KELP_PINCH_A / KELP_PINCH_B are one tile of each.
 * - The temple spur and the Fluffball spur are true cul-de-sacs behind
 *   KELP_TEMPLE_ENTRANCE / KELP_FLUFF_ENTRANCE.
 * - The false-lead alcove is a true dead end reached only through the hub.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const KELP_WIDTH = 40;
export const KELP_HEIGHT = 26;

/** Default spawn: arriving from the entry overlook (north gate). */
export const KELP_SPAWN = { x: 19, y: 4 } as const;
/** Spawn-backs when returning from a neighbouring zone. */
export const KELP_TEMPLE_RETURN_SPAWN = { x: 6, y: 13 } as const;
export const KELP_FLUFF_RETURN_SPAWN = { x: 19, y: 22 } as const;
export const KELP_DEEP_RETURN_SPAWN = { x: 35, y: 14 } as const;

/** The entry room and the hub (for reachability landmarks). */
export const KELP_ENTRY_ROOM = { x1: 17, y1: 2, x2: 22, y2: 6 } as const;
export const KELP_HUB = { x1: 14, y1: 11, x2: 26, y2: 16 } as const;

/** One tile of each disjoint east route (see the disjointness tests). */
export const KELP_PINCH_A = { x: 30, y: 12 } as const; // route A (upper)
export const KELP_PINCH_B = { x: 30, y: 15 } as const; // route B (lower)

/**
 * The hub rest point (a warm mineral current welling up through the floe).
 * Sits on the walkable anemone flourish at the centre of the hub — the zone
 * the whole forest forks through, so it tops HP off before any fork. See the
 * rest-point system in docs/CONTRACTS.md ("v19").
 */
export const KELP_REST = { x: 16, y: 13 } as const;

/** A false-lead alcove that dead-ends off the hub (no exit). */
export const KELP_FALSE_LEAD = { x: 13, y: 7 } as const;
export const KELP_FALSE_ENTRANCE = { x: 14, y: 10 } as const;

/** North gate → back up to the entry overlook. */
export const KELP_EXIT_NORTH = { x1: 19, y1: 1, x2: 20, y2: 1 } as const;
export const KELP_NORTH_GATES = [
  { x: 19, y: 0 },
  { x: 20, y: 0 }
] as const;

/** West spur → the flooded sun-temple ruin (a cul-de-sac). */
export const KELP_EXIT_WEST = { x1: 1, y1: 13, x2: 1, y2: 13 } as const;
export const KELP_WEST_GATES = [{ x: 0, y: 13 }] as const;
export const KELP_TEMPLE_ENTRANCE = { x: 13, y: 13 } as const;

/** South spur → Fluffball's kelp bed (a cul-de-sac). */
export const KELP_EXIT_SOUTH = { x1: 19, y1: 24, x2: 20, y2: 24 } as const;
export const KELP_SOUTH_GATES = [
  { x: 19, y: 25 },
  { x: 20, y: 25 }
] as const;
export const KELP_FLUFF_ENTRANCE = { x: 19, y: 17 } as const;

/** East route → the deep kelp bed (the fishing zone). */
export const KELP_EXIT_EAST = { x1: 38, y1: 13, x2: 38, y2: 14 } as const;
export const KELP_EAST_GATES = [
  { x: 39, y: 13 },
  { x: 39, y: 14 }
] as const;

/** All border gates (for the enclosure test). */
export const KELP_BORDER_GATES = [
  ...KELP_NORTH_GATES,
  ...KELP_WEST_GATES,
  ...KELP_SOUTH_GATES,
  ...KELP_EAST_GATES
] as const;

/** Carved (walkable floe) rectangles, inclusive tile coords. */
const CARVES: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { ...KELP_ENTRY_ROOM }, // entry room
  { x1: 19, y1: 1, x2: 20, y2: 1 }, // north exit stub
  { x1: 19, y1: 6, x2: 20, y2: 11 }, // entry → hub corridor
  { ...KELP_HUB }, // central hub
  { x1: 14, y1: 9, x2: 14, y2: 10 }, // false-lead neck up out of the hub
  { x1: 12, y1: 6, x2: 15, y2: 8 }, // false-lead alcove (dead end)
  { x1: 8, y1: 13, x2: 13, y2: 13 }, // west spur corridor (temple)
  { x1: 2, y1: 11, x2: 7, y2: 15 }, // west room
  { x1: 1, y1: 13, x2: 1, y2: 13 }, // west exit stub
  { x1: 19, y1: 17, x2: 19, y2: 20 }, // south spur corridor (Fluffball)
  { x1: 16, y1: 21, x2: 23, y2: 24 }, // south room
  { x1: 19, y1: 24, x2: 20, y2: 24 }, // south exit stub
  { x1: 26, y1: 12, x2: 33, y2: 12 }, // route A (upper) → east room
  { x1: 26, y1: 15, x2: 33, y2: 15 }, // route B (lower) → east room
  { x1: 33, y1: 11, x2: 38, y2: 16 } // east exit room (deep bed)
];

/** Bright wayfinding edge-floes at the true junctions. */
const FLOE_EDGES: Array<[number, number]> = [
  [20, 11],
  [26, 12],
  [26, 15],
  [13, 13],
  [19, 17]
];
/** Solid kelp/coral/rock decor (walk-arounds — none seals a needed path). */
const KELP_STALKS: Array<[number, number]> = [
  [17, 12],
  [24, 14],
  [35, 12],
  [22, 22],
  [4, 12]
];
const CORALS: Array<[number, number]> = [
  [23, 13],
  [36, 15],
  [18, 3]
];
const MOSS_ROCKS: Array<[number, number]> = [
  [25, 14],
  [6, 14],
  [34, 13]
];
/** Walkable decorative anemones / sparkles. */
const ANEMONES: Array<[number, number]> = [
  [21, 4],
  [16, 13],
  [3, 13],
  [37, 13]
];

export function buildKelpForestMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  // Fill with solid, faintly-shimmering dark water.
  for (let y = 0; y < KELP_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < KELP_WIDTH; x++) {
      const h = cellHash(x, y);
      ground[y].push(h % 5 === 0 ? "seaWater2" : "seaWater");
      decor[y].push(null);
      overhead[y].push(null);
    }
  }

  // Carve the floe paths out of the water.
  for (const r of CARVES) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        ground[y][x] = cellHash(x, y) % 3 === 0 ? "floe2" : "floe";
      }
    }
  }
  // Open the border gates.
  for (const g of KELP_BORDER_GATES) ground[g.y][g.x] = "floe";

  // Kelp-bed floor in the west and south rooms (themed pockets).
  for (const r of [
    { x1: 2, y1: 11, x2: 7, y2: 15 },
    { x1: 16, y1: 21, x2: 23, y2: 24 }
  ]) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        if (ground[y][x] === "floe" || ground[y][x] === "floe2") {
          ground[y][x] = cellHash(x, y) % 4 === 0 ? "reefGlow" : "kelpBed";
        }
      }
    }
  }

  // Wayfinding bright edge-floes at junctions.
  for (const [x, y] of FLOE_EDGES) ground[y][x] = "floeEdge";

  // Solid decor obstacles (never on a corridor or a single entrance tile).
  for (const [x, y] of KELP_STALKS) decor[y][x] = "kelpStalk";
  for (const [x, y] of CORALS) decor[y][x] = "coral";
  for (const [x, y] of MOSS_ROCKS) decor[y][x] = "mossRock";
  // Walkable flourishes.
  for (const [x, y] of ANEMONES) decor[y][x] = "anemone";

  // Rising bubbles drift over the dark water (overhead, never solid).
  for (let y = 1; y < KELP_HEIGHT - 1; y++) {
    for (let x = 1; x < KELP_WIDTH - 1; x++) {
      const g = ground[y][x];
      const overWater = g === "seaWater" || g === "seaWater2";
      if (overWater && cellHash(x, y) % 17 === 0) overhead[y][x] = "bubbles";
    }
  }

  return dressMap({ ground, decor, overhead });
}
