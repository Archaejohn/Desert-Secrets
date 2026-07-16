/**
 * The Open Desert — a small proof-of-concept world map in the FF3/FF6
 * style: a tiny, compressed terrain layer between two focused zones
 * rather than a fully detailed one. Everything except a single winding
 * mountain pass is solid mountain ridge, and the pass has exactly two
 * stops: the spring/wash near the overturned truck (south, back to the
 * oasis) and Cinnabar Mine (north, into the mine entrance). Random
 * encounters run the whole length of the pass. Pure data, deterministic,
 * unit-testable.
 *
 * Phase O (2.5D art pass, docs/ART_DIRECTION.md §4a): after the layout is
 * placed, a pure autotile selection pass dresses the terrain — scree
 * ground under every mountain cell, a `screeShade` foot-shadow band on the
 * open cells directly south of mountain masses, sand↔scree finger
 * transitions on mountain-edge cells that face open sand, and a coast
 * surf ring on the land cells around the spring pool. Solidity is
 * untouched (all dressing tiles are walkable ground names; mountains stay
 * solid decor), so enclosure/reachability/walkable-ratio invariants hold.
 */
import { cellHash } from "./cellHash";
import type { ZoneMap } from "./types";

export const OVERWORLD_WIDTH = 16;
export const OVERWORLD_HEIGHT = 20;

/** South-edge exit band → back to the oasis (the wash/spring stop). */
export const OVERWORLD_SOUTH_EXIT = { x1: 7, y1: 19, x2: 9, y2: 19 } as const;
/** North-edge exit band → the mine entrance (the Cinnabar Mine stop). */
export const OVERWORLD_NORTH_EXIT = { x1: 7, y1: 0, x2: 9, y2: 0 } as const;
/** Where the player appears arriving from the oasis (also the default spawn). */
export const OVERWORLD_SOUTH_SPAWN = { x: 8, y: 17 } as const;
/** Where the player appears arriving back from the mine entrance. */
export const OVERWORLD_NORTH_SPAWN = { x: 8, y: 2 } as const;

/**
 * The pass's spine, south to north (descending y): [y, centerX]. Rows
 * between waypoints interpolate linearly, giving a gentle S-curve rather
 * than a straight line between the two stops.
 */
const PATH_WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [19, 8],
  [16, 8],
  [13, 6],
  [10, 5],
  [7, 6],
  [4, 8],
  [0, 8]
];

function centerXForRow(y: number): number {
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const [y0, x0] = PATH_WAYPOINTS[i];
    const [y1, x1] = PATH_WAYPOINTS[i + 1];
    if (y <= y0 && y >= y1) {
      const t = y0 === y1 ? 0 : (y0 - y) / (y0 - y1);
      return Math.round(x0 + (x1 - x0) * t);
    }
  }
  return 8;
}

/** Placeholder decor value for "this cell is mountain mass", used only
 *  during layout construction below. `assignMountainTileNames` replaces
 *  every occurrence with a real `owMountain{variant}_{mask}` name before
 *  `applyOverworldAutotile` (and the returned map) ever see it. */
const MOUNTAIN_SENTINEL = "__mountainSentinel__";

/** Prefix shared by every generated owMountains.png tile name
 *  (`owMountains.ts`'s `owMountainNames`: `owMountain{0..4}_{0..15}`). */
const OW_MOUNTAIN_PREFIX = "owMountain";

/** Five texture families (`owMountains.ts`'s `MOUNTAIN_VARIANT_COUNT`). */
const OW_MOUNTAIN_VARIANT_COUNT = 5;

/**
 * Converts every `MOUNTAIN_SENTINEL` decor cell into a concrete
 * `owMountain{variant}_{mask}` name (docs/CONTRACTS.md "owMountains"):
 *
 * 1. Connected-component flood fill (4-connectivity, deterministic
 *    row-major scan order so component IDs — and therefore variants — are
 *    reproducible) over the sentinel cells, clustering contiguous mountain
 *    masses. `variant = componentId % 5`, so one contiguous range reads as
 *    one consistent texture family throughout.
 * 2. A 4-bit N/E/S/W neighbor mask per mountain cell (bit0=N=1, bit1=E=2,
 *    bit2=S=4, bit3=W=8 — must match `owMountains.ts`'s bit convention
 *    exactly), using the same is-mountain predicate. A neighbor beyond the
 *    map edge counts as "mountain present" (bit set): the overworld's
 *    outer border is intentionally solid mountain except at the two gate
 *    bands (see the enclosure assertions in tests/game/maps.test.ts), so
 *    treating off-map as sand there would round the map's own solid edge
 *    into a false gap. Only real interior boundaries against open
 *    sand/path (in-bounds, non-mountain neighbors) round off.
 */
function assignMountainTileNames(decor: (string | null)[][]): void {
  const H = decor.length;
  const W = decor[0].length;
  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const isMtn = (x: number, y: number): boolean =>
    inBounds(x, y) && decor[y][x] === MOUNTAIN_SENTINEL;

  // 1. Connected components, 4-connectivity, row-major scan order.
  const componentId: number[][] = decor.map((row) => row.map(() => -1));
  let nextId = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isMtn(x, y) || componentId[y][x] !== -1) continue;
      const id = nextId++;
      const stack: Array<[number, number]> = [[x, y]];
      componentId[y][x] = id;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (isMtn(nx, ny) && componentId[ny][nx] === -1) {
            componentId[ny][nx] = id;
            stack.push([nx, ny]);
          }
        }
      }
    }
  }

  // 2. Per-cell neighbor mask -> owMountain{variant}_{mask}.
  const maskNeighborPresent = (x: number, y: number): boolean =>
    inBounds(x, y) ? isMtn(x, y) : true;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isMtn(x, y)) continue;
      const variant = componentId[y][x] % OW_MOUNTAIN_VARIANT_COUNT;
      let mask = 0;
      if (maskNeighborPresent(x, y - 1)) mask |= 1; // N
      if (maskNeighborPresent(x + 1, y)) mask |= 2; // E
      if (maskNeighborPresent(x, y + 1)) mask |= 4; // S
      if (maskNeighborPresent(x - 1, y)) mask |= 8; // W
      decor[y][x] = `${OW_MOUNTAIN_PREFIX}${variant}_${mask}`;
    }
  }
}

/**
 * Pure autotile selection pass (§4a) — mutates the freshly built grids in
 * place before `buildOverworldMap` returns. Every choice is a function of
 * the placed layout only, so the whole build stays deterministic.
 * Ordering matters: scree under mountains → foot-shadow band → scree
 * finger transitions (which must see the band) → coast ring (which wins
 * over the band where the pool touches a mountain's shadow row).
 */
function applyOverworldAutotile(ground: string[][], decor: (string | null)[][]): void {
  const H = ground.length;
  const W = ground[0].length;
  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const isMtn = (x: number, y: number): boolean => {
    if (!inBounds(x, y)) return false;
    const d = decor[y][x];
    return d !== null && d.startsWith(OW_MOUNTAIN_PREFIX);
  };
  const isWater = (x: number, y: number): boolean =>
    inBounds(x, y) && (ground[y][x] === "water" || ground[y][x] === "water2");

  // 1. Scree ground under every mountain cell (the billboard layer skips
  //    mountain decor when painting the Mode-7 ground, so what shows
  //    beneath/around the standing masses is rock, not bare sand).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isMtn(x, y)) ground[y][x] = cellHash(x, y) % 2 === 0 ? "scree" : "scree2";
    }
  }

  // 2. Mountain foot-shadow band: the open cell directly south of a
  //    mountain mass sits in its shadow, so the masses visibly SIT on the
  //    plain instead of floating.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isMtn(x, y) && !isWater(x, y) && isMtn(x, y - 1)) ground[y][x] = "screeShade";
    }
  }

  // 3. Sand↔scree finger transitions: mountain-edge cells whose N/E/W side
  //    faces open sand (not the shadow band — that hand-off is baked into
  //    the screeShade tile itself). The tile letter names where the SAND is.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isMtn(x, y)) continue;
      const open = (dx: number, dy: number): boolean =>
        inBounds(x + dx, y + dy) &&
        !isMtn(x + dx, y + dy) &&
        !isWater(x + dx, y + dy) &&
        ground[y + dy][x + dx] !== "screeShade";
      const n = open(0, -1);
      const e = open(1, 0);
      const s = open(0, 1);
      const w = open(-1, 0);
      let name: string | null = null;
      if (n && e && !s && !w) name = "screeSandNE";
      else if (n && w && !s && !e) name = "screeSandNW";
      else if (s && e && !n && !w) name = "screeSandSE";
      else if (s && w && !n && !e) name = "screeSandSW";
      else if (n && !e && !s && !w) name = "screeSandN";
      else if (e && !n && !s && !w) name = "screeSandE";
      else if (s && !n && !e && !w) name = "screeSandS";
      else if (w && !n && !e && !s) name = "screeSandW";
      // opposite-side / 3+-side cases (a one-tile spur) keep plain scree
      if (name !== null) ground[y][x] = name;
    }
  }

  // 4. Coast surf ring around the spring pool (land owns the border, G9).
  //    The tile letter names where the WATER is; In* = water only diagonal.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isWater(x, y) || isMtn(x, y)) continue;
      const wN = isWater(x, y - 1);
      const wE = isWater(x + 1, y);
      const wS = isWater(x, y + 1);
      const wW = isWater(x - 1, y);
      let name: string | null = null;
      if (wN && wE) name = "coastNE";
      else if (wN && wW) name = "coastNW";
      else if (wS && wE) name = "coastSE";
      else if (wS && wW) name = "coastSW";
      else if (wN) name = "coastN";
      else if (wE) name = "coastE";
      else if (wS) name = "coastS";
      else if (wW) name = "coastW";
      else if (isWater(x + 1, y - 1)) name = "coastInNE";
      else if (isWater(x - 1, y - 1)) name = "coastInNW";
      else if (isWater(x + 1, y + 1)) name = "coastInSE";
      else if (isWater(x - 1, y + 1)) name = "coastInSW";
      if (name !== null) ground[y][x] = name;
    }
  }
}

export function buildOverworldMap(): ZoneMap {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];

  for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < OVERWORLD_WIDTH; x++) {
      const h = cellHash(x, y);
      let name = "sand";
      if (h % 17 === 0) name = "sand2";
      else if (h % 13 === 0) name = "sand3";
      else if (h % 61 === 0) name = "sandSparkle";
      ground[y].push(name);
      decor[y].push(MOUNTAIN_SENTINEL); // everything starts as impassable mountain
    }
  }

  // Carve the winding pass. Widens into a clearing at each stop so the
  // truck/spring and mine-mouth flavor has room beside the walking line.
  for (let y = 1; y < OVERWORLD_HEIGHT - 1; y++) {
    const cx = centerXForRow(y);
    const half = y >= 15 || y <= 3 ? 3 : 1;
    for (let x = cx - half; x <= cx + half; x++) {
      if (x > 0 && x < OVERWORLD_WIDTH - 1) decor[y][x] = null;
    }
  }

  // The Wash: a spring pool ringed by open sand (so the coast surf ring
  // has land on every side), with the overturned truck off to the side.
  ground[16][9] = "water";
  ground[16][10] = "water2";
  ground[17][9] = "water2";
  ground[17][10] = "water";

  // Sparse non-blocking scatter along the walkable pass only — kept clear
  // of the pool's shore so the surf ring stays legible.
  for (let y = 1; y < OVERWORLD_HEIGHT - 1; y++) {
    for (let x = 1; x < OVERWORLD_WIDTH - 1; x++) {
      if (decor[y][x] !== null) continue;
      let nearWater = false;
      for (let dy = -1; dy <= 1 && !nearWater; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const g = ground[y + dy]?.[x + dx];
          if (g === "water" || g === "water2") {
            nearWater = true;
            break;
          }
        }
      }
      if (nearWater) continue;
      const h = cellHash(x, y);
      if (h % 29 === 0) decor[y][x] = "creosote";
      else if (h % 41 === 0) decor[y][x] = "bones";
    }
  }

  // The overturned truck beside the wash.
  decor[17][5] = "truckBox";
  decor[18][5] = "truckCab";

  // Joshua trees flanking the clearings — rendered as full standing
  // billboards in the Mode-7 view (solid, like every tree trunk).
  decor[16][5] = "joshuaTrunk";
  decor[15][11] = "joshuaTrunk";
  decor[3][11] = "joshuaTrunk";

  // Cinnabar Mine: timber framing the approach, an abandoned cart beside
  // it, echoing the mine mouth Trail already frames at its own entrance.
  decor[2][6] = "mineTimber";
  decor[2][10] = "mineTimber";
  decor[3][5] = "cart";

  // Map border: solid mountain — the whole point is that nothing else is
  // reachable except this one pass.
  for (let x = 0; x < OVERWORLD_WIDTH; x++) {
    decor[0][x] = MOUNTAIN_SENTINEL;
    decor[OVERWORLD_HEIGHT - 1][x] = MOUNTAIN_SENTINEL;
  }
  for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
    decor[y][0] = MOUNTAIN_SENTINEL;
    decor[y][OVERWORLD_WIDTH - 1] = MOUNTAIN_SENTINEL;
  }

  // Visible gates: the two stops, opened last so nothing above re-seals them.
  for (let x = OVERWORLD_SOUTH_EXIT.x1; x <= OVERWORLD_SOUTH_EXIT.x2; x++) {
    decor[OVERWORLD_HEIGHT - 1][x] = null;
    ground[OVERWORLD_HEIGHT - 1][x] = "sand2";
  }
  for (let x = OVERWORLD_NORTH_EXIT.x1; x <= OVERWORLD_NORTH_EXIT.x2; x++) {
    decor[OVERWORLD_NORTH_EXIT.y1][x] = null;
    ground[OVERWORLD_NORTH_EXIT.y1][x] = "sand2";
  }

  // Rounded-corner mountain autotile: flood-fill contiguous mountain masses
  // into variant families and pick each cell's owMountains.png tile by its
  // N/E/S/W neighbor mask (docs/CONTRACTS.md "owMountains"). Must run
  // before the Phase O dressing pass below, whose is-mountain predicate
  // matches the resulting owMountain* names.
  assignMountainTileNames(decor);

  // Phase O dressing: pure autotile selection over the finished layout.
  applyOverworldAutotile(ground, decor);

  return { ground, decor };
}
