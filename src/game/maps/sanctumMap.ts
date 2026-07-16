/**
 * Act 2, Zone 4 — The Sanctum. The frozen lake at the bottom of the
 * world: a broad lakeIce field ringed by an icy shore, the Rime Warden
 * standing sentinel mid-lake, and a dark tunnel mouth in the north-east
 * corner where two penguin silhouettes vanish at the act's end. The
 * ending flips SANCTUM_CRACK's tiles from lakeIce to lakeCrack in a
 * racing line.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";
import { dressMap } from "./dressing";

export const SANCTUM_WIDTH = 26;
export const SANCTUM_HEIGHT = 18;

/** Default spawn: on the west shore, in from the galleries door. */
export const SANCTUM_SPAWN = { x: 3, y: 9 } as const;
/** West exit band → back through the rime door to the galleries. */
export const SANCTUM_EXIT_WEST = { x1: 1, y1: 8, x2: 1, y2: 9 } as const;
/** Open border cells of the west exit (for the enclosure test). */
export const SANCTUM_WEST_GATES = [
  { x: 0, y: 8 },
  { x: 0, y: 9 }
] as const;

/** The frozen lake (ground = lakeIce throughout). */
export const SANCTUM_LAKE = { x1: 5, y1: 4, x2: 20, y2: 13 } as const;
/** The Rime Warden stands mid-lake. */
export const SANCTUM_WARDEN = { x: 13, y: 8 } as const;
/** Full-height approach band that wakes the Warden. */
export const SANCTUM_APPROACH = { x1: 9, y1: 1, x2: 9, y2: 16 } as const;
/** The crack line: lakeIce tiles that flip to lakeCrack, west to east. */
export const SANCTUM_CRACK: ReadonlyArray<{ x: number; y: number }> = Array.from(
  { length: 16 },
  (_, i) => ({ x: 5 + i, y: 9 })
);
/** The tunnel mouth (NE) the penguins dive into. */
export const SANCTUM_TUNNEL = { x: 23, y: 4 } as const;
/** Where the two penguins start their crossing (west end of the crack). */
export const SANCTUM_PENGUIN_START = {
  piggy: { x: 4, y: 9 },
  fluffball: { x: 3, y: 10 }
} as const;

export function buildSanctumMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  const overhead: (string | null)[][] = [];

  for (let y = 0; y < SANCTUM_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    overhead.push([]);
    for (let x = 0; x < SANCTUM_WIDTH; x++) {
      const h = cellHash(x, y);
      const inLake =
        x >= SANCTUM_LAKE.x1 && x <= SANCTUM_LAKE.x2 && y >= SANCTUM_LAKE.y1 && y <= SANCTUM_LAKE.y2;
      ground[y].push(inLake ? "lakeIce" : h % 12 === 0 ? "mossGlow" : h % 4 === 0 ? "iceFloor2" : "iceFloor");
      // Solid border only; the cavern floor is open.
      const border = x === 0 || y === 0 || x === SANCTUM_WIDTH - 1 || y === SANCTUM_HEIGHT - 1;
      decor[y].push(border ? "iceWallDeep" : null);
      overhead[y].push(null);
    }
  }

  // Open the west border at the exit back to the galleries.
  for (const g of SANCTUM_WEST_GATES) decor[g.y][g.x] = null;

  // The tunnel mouth: a dark opening framed against the north-east shore.
  decor[3][22] = "chasm";
  decor[3][23] = "chasm";
  decor[3][24] = "chasm";
  // Hand nudge: plain ice around the mouth so the dressing pass can lip its
  // whole rim (mossGlow has no chasm-lip variants).
  for (const [x, y] of [
    [22, 2],
    [23, 2],
    [24, 2],
    [21, 3],
    [25, 3],
    [22, 4],
    [23, 4],
    [24, 4]
  ] as const) {
    if (ground[y][x] === "mossGlow") ground[y][x] = "iceFloor";
  }
  decor[5][22] = "crystalBig";
  decor[5][24] = "crystalBig";

  // Shore dressing: drifts and crystal glints (never on the lake).
  for (let y = 1; y < SANCTUM_HEIGHT - 1; y++) {
    for (let x = 1; x < SANCTUM_WIDTH - 1; x++) {
      if (decor[y][x] !== null || ground[y][x] === "lakeIce") continue;
      const h = cellHash(x, y);
      if (h % 10 === 0) decor[y][x] = "snowdrift";
      else if (h % 17 === 0) decor[y][x] = "crystalSmall";
    }
  }
  // Big crystals well clear of the exit, the crack line and the tunnel.
  decor[15][3] = "crystalBig";
  decor[2][2] = "crystalBig";
  decor[15][22] = "crystalBig";

  // Icicles fringe the walls (overhead layer, never solid).
  for (let x = 1; x < SANCTUM_WIDTH - 1; x++) {
    if (decor[1][x] === null && cellHash(x, 1) % 5 === 0) overhead[1][x] = "icicle";
  }

  return dressMap({ ground, decor, overhead });
}
