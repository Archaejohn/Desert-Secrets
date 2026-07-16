/**
 * The Open Desert — a big, open FF3/FF6-style world map (docs/CONTRACTS.md
 * "v22"): a central mountain spine carrying the original winding pass (the
 * spring/wash stop south, back to the oasis; the Cinnabar Mine mouth stop
 * north), flanked by open desert valleys on both sides so the camera is
 * always scrolling as the player walks rather than hitting mountain at
 * every edge. A lake sits in the southeast (its northwest shore touching
 * the spine's own east wall wherever the two organic shapes happen to
 * meet), a small town sits in the northwest, and a mask-based dirt-road
 * autotile links the two stops to both landmarks. Random encounters run
 * the whole map (unchanged: `encounterZone: "overworld"` in
 * OverworldScene.ts is not location-scoped). Pure data, deterministic
 * (seeded noise only, no `Math.random`/`Date.now` anywhere in this file),
 * unit-testable.
 *
 * v9 (docs/CONTRACTS.md "v9") shipped this as a tiny 16×20 proof of
 * concept: solid mountain everywhere except one carved pass. v22 embeds
 * that exact same pass/stops/gates logic — untouched in shape — inside a
 * much bigger grid, adding the valleys, the lake, the town and the roads
 * around it.
 *
 * **The spine and the lake are procedurally GENERATED, not hand-drawn
 * geometry** (a hard rectangle and a perfect ellipse shipped first and
 * were rejected: "mountain ranges are never rectangular... you're trying
 * to procedurally draw a world map using your own thoughts instead of
 * writing an algorithm that generates it one time with organic shapes" —
 * see `buildSpineBounds`/`buildLakeRadiusFn` below for the actual
 * algorithms and the connectivity/solidity reasoning behind each one).
 *
 * Phase O (2.5D art pass, docs/ART_DIRECTION.md §4a) autotile dressing
 * still runs after layout: scree ground under every mountain cell, a
 * `screeShade` foot-shadow band, sand↔scree finger transitions, a
 * mask-based lakeShore ring around every body of water (v22 — see
 * `lakeShore.ts`), scree↔water finger transitions wherever the lake
 * touches the spine instead of open sand, plus the road autotile itself.
 * Solidity stays untouched by any of this (every dressing tile is a
 * walkable ground name; mountains and town buildings stay solid decor),
 * so enclosure/reachability invariants hold.
 */
import { cellHash } from "./cellHash";
import { makeRng } from "../../core/rng";
import type { ZoneMap } from "./types";

export const OVERWORLD_WIDTH = 64;
export const OVERWORLD_HEIGHT = 64;

/** South-edge exit band → back to the oasis (the wash/spring stop). */
export const OVERWORLD_SOUTH_EXIT = { x1: 31, y1: OVERWORLD_HEIGHT - 1, x2: 33, y2: OVERWORLD_HEIGHT - 1 } as const;
/** North-edge exit band → the mine entrance (the Cinnabar Mine stop). */
export const OVERWORLD_NORTH_EXIT = { x1: 31, y1: 0, x2: 33, y2: 0 } as const;
/** Where the player appears arriving from the oasis (also the default spawn). */
export const OVERWORLD_SOUTH_SPAWN = { x: 32, y: 61 } as const;
/** Where the player appears arriving back from the mine entrance. */
export const OVERWORLD_NORTH_SPAWN = { x: 32, y: 2 } as const;

// ---------------------------------------------------------------------------
// Deterministic 1D value noise (no Math.random/Date.now anywhere in this
// file — every generator below is seeded via makeRng, matching the
// pipeline's own mulberry32-only convention for cellHash/scatterMotifs/etc).
// ---------------------------------------------------------------------------

/**
 * Smoothed 1D noise: seeded random control points every `period` cells,
 * eased between them with smoothstep (not linear) so the result wanders
 * gently rather than kinking at each control point. This is what keeps the
 * organic boundaries below "one continuous wandering line" instead of
 * jittery per-cell noise, which would fray a boundary into single-cell
 * peninsulas/pinholes.
 */
function smoothNoise1D(length: number, period: number, amp: number, seed: number): number[] {
  const rng = makeRng(seed);
  const controlCount = Math.ceil(length / period) + 2;
  const controls: number[] = [];
  for (let i = 0; i < controlCount; i++) controls.push((rng() * 2 - 1) * amp);
  const out: number[] = new Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / period;
    const i0 = Math.floor(t);
    const frac = t - i0;
    const s = frac * frac * (3 - 2 * frac); // smoothstep easing
    out[i] = controls[i0] + (controls[i0 + 1] - controls[i0]) * s;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The mountain spine (docs/CONTRACTS.md "v22"): a per-row-noisy east/west
// boundary around a nominal center column, with the half-width itself
// tapering smoothly to zero over the first/last few rows instead of a hard
// rectangular cap — an organic silhouette that's SOLID AND CONNECTED BY
// CONSTRUCTION, no post-hoc cleanup needed:
//
// - Every row's mountain cells are exactly one contiguous interval
//   [left(y), right(y)] (never two separate runs), so there is no way for
//   this shape to enclose a hole.
// - `smoothNoise1D`'s smoothstep easing bounds how much left(y)/right(y)
//   can move from one row to the next; that delta is always small relative
//   to the interval's own width (verified — see the module's connectivity
//   note below), so every row's interval overlaps its neighbour's and the
//   whole spine is one connected mass, again by construction rather than a
//   flood-fill-and-hope check.
// - The north/south "cap" is organic too, but via width-tapering rather
//   than a SECOND, independent per-column noise field on top of the
//   per-row one: intersecting two independently-noisy boundaries (one
//   varying by row, one by column) risks a row whose valid-x interval gets
//   cut into two pieces by the column-noise dipping below that row in the
//   middle of an otherwise-open span — an actual hole. Tapering the SAME
//   per-row interval toward zero width as y approaches the spine's ends
//   gives a natural, non-rectangular termination (a real range trailing
//   off into foothills) without ever risking that failure mode. This is a
//   deliberate simplification, not an oversight.
// ---------------------------------------------------------------------------

/** Nominal center column — matches the exit/spawn column, so the pass's
 *  waypoints (below) stay centered in the spine regardless of how far the
 *  noisy boundary wanders on any given row. */
const SPINE_CX = 32;
/** Half-width in the spine's full-taper middle section (~ the old fixed
 *  rectangle's own half-width, so the map's overall proportions — how much
 *  is spine vs. valley — read the same as the version the project owner
 *  already approved). */
const SPINE_NOMINAL_HALF_WIDTH = 10;
/** Which rows have any spine at all — unchanged from a hard rectangle;
 *  only the WIDTH within this range is organic (see module note above). */
const SPINE_Y1 = 8;
const SPINE_Y2 = 55;
/** Rows over which the half-width eases from 0 (at SPINE_Y1/SPINE_Y2
 *  themselves) up to its full nominal value. */
const SPINE_TAPER_ROWS = 6;

function spineHalfWidthTaper(y: number): number {
  const d = Math.min(y - SPINE_Y1, SPINE_Y2 - y, SPINE_TAPER_ROWS);
  if (d <= 0) return 0;
  if (d >= SPINE_TAPER_ROWS) return 1;
  const t = d / SPINE_TAPER_ROWS;
  return t * t * (3 - 2 * t); // smoothstep
}

/**
 * Per-row [left, right] mountain interval, one pair per map row (rows
 * outside SPINE_Y1..SPINE_Y2 collapse to a single point at SPINE_CX, i.e.
 * zero width, via the taper — harmless, nothing ever reads them there).
 * Two noise octaves per edge (a slow wide wander + a faster small ripple)
 * for a genuinely irregular silhouette rather than one smooth sine-like
 * curve; both octaves are scaled by the same taper as the half-width
 * itself so the noise shrinks to nothing right alongside the width,
 * guaranteeing `left <= right` always (worst case both terms hit their
 * opposite extremes: nominal half-width 10 vs. combined noise amplitude
 * ≤4 per side, 8 total — never inverts).
 */
function buildSpineBounds(): { left: number[]; right: number[] } {
  const H = OVERWORLD_HEIGHT;
  const leftSlow = smoothNoise1D(H, 11, 3, 0x5a11e5); // "spine"
  const leftFast = smoothNoise1D(H, 4, 1, 0x5a11e6);
  const rightSlow = smoothNoise1D(H, 11, 3, 0x5a11e7);
  const rightFast = smoothNoise1D(H, 4, 1, 0x5a11e8);
  const left: number[] = new Array(H);
  const right: number[] = new Array(H);
  for (let y = 0; y < H; y++) {
    const taper = spineHalfWidthTaper(y);
    const half = SPINE_NOMINAL_HALF_WIDTH * taper;
    left[y] = Math.round(SPINE_CX - half + (leftSlow[y] + leftFast[y]) * taper);
    right[y] = Math.round(SPINE_CX + half + (rightSlow[y] + rightFast[y]) * taper);
  }
  return { left, right };
}

/**
 * The pass's spine, south to north (descending y): [y, centerX]. Rows
 * between waypoints interpolate linearly, giving a gentle S-curve rather
 * than a straight line between the two stops. `centerX` is pinned to
 * `SPINE_CX` at both ends of the actual SPINE_Y1..SPINE_Y2 mountain range
 * and beyond it, so the pass meets the gate bands and the two open valley
 * bands (north of the spine, south of it) in a straight line — all the
 * winding happens strictly inside the mountain mass. The waypoints'
 * extremes (24..35) stay comfortably inside even the narrowest plausible
 * per-row interval (half-width 10 minus ≤4 worst-case noise = 6, i.e.
 * SPINE_CX±6 = 26..38 guaranteed present at full taper) — verified against
 * the actual generated bounds by "carves a pass that stays inside the
 * spine's own generated bounds" in tests/game/maps.test.ts, not just
 * argued here.
 */
const PATH_WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [OVERWORLD_HEIGHT - 1, SPINE_CX],
  [58, SPINE_CX],
  [SPINE_Y2, SPINE_CX], // spine's south mouth
  [48, 27],
  [42, 24],
  [36, 29],
  [30, 35],
  [24, 30],
  [18, 25],
  [13, 28],
  [SPINE_Y1, SPINE_CX], // spine's north mouth
  [5, SPINE_CX],
  [0, SPINE_CX]
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
  return SPINE_CX;
}

// ---------------------------------------------------------------------------
// The lake (docs/CONTRACTS.md "v22"): a "noisy-radius blob" — a handful of
// seeded sine harmonics perturbing the radius as a function of angle
// around a center point. Star-shaped around that center by construction
// (radius(angle) > 0 for every angle, clamped — see below), so it's a
// single connected blob with no holes, no separate cleanup pass needed,
// exactly like the spine above.
// ---------------------------------------------------------------------------

const LAKE_CX = 52;
const LAKE_CY = 47;
/** Base radius before noise, in the aspect-normalized space below. */
const LAKE_BASE_RADIUS = 7.5;
/** Elongates the blob east-west before noise is applied (a lake reads more
 *  natural wider than tall than perfectly circular). */
const LAKE_ASPECT_X = 1.3;
const LAKE_ASPECT_Y = 0.85;

/**
 * Builds `radius(angle)`: a few low-order sine harmonics (so the outline
 * wanders smoothly, not spiky) with seeded random amplitude/phase per
 * harmonic. Clamped well above zero so the radius can never invert/collapse
 * regardless of how the harmonics happen to combine at a given angle —
 * that clamp is what guarantees the blob stays simply-connected (a
 * negative or near-zero radius at some angle would pinch the blob apart or
 * puncture it).
 */
function buildLakeRadiusFn(): (angle: number) => number {
  const rng = makeRng(0x1a4e5eed);
  const harmonics = [2, 3, 5];
  const terms = harmonics.map((k) => ({
    k,
    amp: LAKE_BASE_RADIUS * 0.22 * (0.6 + 0.4 * rng()),
    phase: rng() * Math.PI * 2
  }));
  return (angle: number): number => {
    let r = LAKE_BASE_RADIUS;
    for (const t of terms) r += t.amp * Math.sin(t.k * angle + t.phase);
    return Math.max(LAKE_BASE_RADIUS * 0.4, r);
  };
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
 * 1. Per-cell `variant = cellHash(x, y) % 5`. A large solid mountain mass
 *    is mostly interior cells that all share the same neighbor mask (every
 *    side present); if variant were assigned per contiguous mass (as an
 *    earlier version of this function did via connected-component flood
 *    fill), the whole mass would draw the SAME cached tile over and over —
 *    a giant mountain range would look like one texture wallpapered across
 *    a hundred cells, and a real map's mountain border is one huge
 *    connected ring, so in practice only 1–2 of the 5 families ever
 *    appeared. Hashing per cell instead means neighboring interior cells
 *    routinely draw from different families, breaking up the repeat the
 *    way FF6/SoM interior rock texture reads as varied rather than tiled.
 * 2. A 4-bit N/E/S/W neighbor mask per mountain cell (bit0=N=1, bit1=E=2,
 *    bit2=S=4, bit3=W=8 — must match `owMountains.ts`'s bit convention
 *    exactly), using the same is-mountain predicate. A neighbor beyond the
 *    map edge counts as "mountain present" (bit set): the overworld's
 *    outer border is intentionally solid mountain except at the two gate
 *    bands (see the enclosure assertions in tests/game/maps.test.ts), so
 *    treating off-map as sand there would round the map's own solid edge
 *    into a false gap. Only real interior boundaries against open
 *    sand/path (in-bounds, non-mountain neighbors) round off. (The v22
 *    mountain spine never touches the map edge, so this off-map rule only
 *    ever fires for the outer border ring, exactly as before.)
 */
function assignMountainTileNames(decor: (string | null)[][]): void {
  const H = decor.length;
  const W = decor[0].length;
  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  // Snapshot "is this cell mountain" BEFORE any mutation. The mask lookups
  // below must read this frozen snapshot, never `decor` itself: if a cell's
  // real name were written into `decor` as soon as it's computed (a single
  // forward row-major pass, mutating in place), then by the time a later
  // cell in the same row (or any cell in a later row) checks its W or N
  // neighbor, that neighbor would already have been overwritten from
  // MOUNTAIN_SENTINEL to a concrete "owMountain{v}_{m}" string — no longer
  // matching the sentinel — so the N/W checks would read "not mountain"
  // for almost every interior cell regardless of true topology, while E/S
  // (not yet visited) would still read correctly. That was a real,
  // shipped bug: it collapsed ~93% of the map's mountain cells to the
  // single mask "E+S present, N+W open" (6) regardless of where they
  // actually sat, which is exactly the "only one tile for every mountain"
  // symptom reported after ship — not an art-quality issue at all.
  const isMtnSnapshot: boolean[][] = decor.map((row) =>
    row.map((cell) => cell === MOUNTAIN_SENTINEL)
  );
  const isMtn = (x: number, y: number): boolean => inBounds(x, y) && isMtnSnapshot[y][x];
  const maskNeighborPresent = (x: number, y: number): boolean =>
    inBounds(x, y) ? isMtn(x, y) : true;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isMtn(x, y)) continue;
      const variant = cellHash(x, y) % OW_MOUNTAIN_VARIANT_COUNT;
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
 * finger transitions (which must see the band) → scree↔water finger
 * transitions (v22, mountain cells the sand pass left untouched because
 * their open side is water, not sand — must run before step 4 renames any
 * water cell, since it still reads plain "water"/"water2" names) → the
 * lakeShore autotile (v22, replacing the old straight-edge coast ring) →
 * the dirt-road autotile last (v22; it owns the final say over its own
 * ground cells, same way the pass itself always did for what used to be a
 * bare sand tile).
 */
function applyOverworldAutotile(
  ground: string[][],
  decor: (string | null)[][],
  isRoad: boolean[][]
): void {
  const H = ground.length;
  const W = ground[0].length;
  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const isMtn = (x: number, y: number): boolean => {
    if (!inBounds(x, y)) return false;
    const d = decor[y][x];
    return d !== null && d.startsWith(OW_MOUNTAIN_PREFIX);
  };
  // Broadened to also match lakeShore* (not just literal "water"/"water2"):
  // once step 4 below starts renaming shoreline water cells to
  // `lakeShore{mask}`, any LATER logic (step 5's defensive water check)
  // must still recognise those cells as water. Step 3b (which needs to see
  // the ORIGINAL "water"/"water2" names) runs before step 4 specifically
  // so it never observes the renamed form regardless.
  const isWater = (x: number, y: number): boolean => {
    if (!inBounds(x, y)) return false;
    const g = ground[y][x];
    return g === "water" || g === "water2" || g.startsWith("lakeShore");
  };

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
  //    the screeShade tile itself, and not water — see step 3b). The tile
  //    letter names where the SAND is.
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

  // 3b. Scree↔water finger transitions (v22): mountain-edge cells whose
  //     open side(s) are the lake instead of sand — the project owner's
  //     "same style of tileset as mountains/sand but with water instead of
  //     sand". Mirrors step 3 exactly, with water as the other material.
  //     The organic spine/lake boundaries can produce more mixed
  //     sand-on-one-side/water-on-another mountain cells than the old
  //     hand-placed rectangle/ellipse did (an irregular coastline just has
  //     more of these); those still fall through to whichever branch
  //     matches (or to plain scree for a genuine 3+-side/opposite-side
  //     case), the same graceful fallback screeSand already had — a full
  //     8-piece-plus-mixed-side treatment was judged unnecessary after
  //     visual review (see docs/CONTRACTS.md "v22"'s verification note).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isMtn(x, y)) continue;
      const wOpen = (dx: number, dy: number): boolean =>
        inBounds(x + dx, y + dy) && isWater(x + dx, y + dy);
      const n = wOpen(0, -1);
      const e = wOpen(1, 0);
      const s = wOpen(0, 1);
      const w = wOpen(-1, 0);
      let name: string | null = null;
      if (n && e && !s && !w) name = "screeWaterNE";
      else if (n && w && !s && !e) name = "screeWaterNW";
      else if (s && e && !n && !w) name = "screeWaterSE";
      else if (s && w && !n && !e) name = "screeWaterSW";
      else if (n && !e && !s && !w) name = "screeWaterN";
      else if (e && !n && !s && !w) name = "screeWaterE";
      else if (s && !n && !e && !w) name = "screeWaterS";
      else if (w && !n && !e && !s) name = "screeWaterW";
      if (name !== null) ground[y][x] = name;
    }
  }

  // 4. lakeShore autotile (v22, docs/CONTRACTS.md "v22"): replaces the old
  //    12-tile straight-edge coast ring, which "read as a concrete
  //    barrier" once the lake wasn't a hand-drawn rectangle/ellipse
  //    anymore. Same mask machinery as owMountains/the road pass, but
  //    placed on the WATER side (mask = which neighbours are ALSO water,
  //    exactly like a mountain cell's mask = which neighbours are also
  //    mountain) instead of dressing the land side. Must snapshot "is this
  //    cell water" BEFORE mutating `ground` in this same pass, for the
  //    identical reason assignMountainTileNames's own comment gives:
  //    reading a neighbour's freshly-overwritten "lakeShoreN" name back
  //    through a live isWater() check would need that check to already
  //    special-case the lakeShore prefix (it does, above) AND still risks
  //    subtly different results depending on scan order if it re-read
  //    `ground` live instead of a frozen snapshot — a frozen snapshot
  //    removes that ambiguity entirely, not just papers over it.
  //    Mask-15 (fully water-surrounded) cells are deliberately left as the
  //    plain alternating water/water2 ground instead of `lakeShore15` —
  //    see lakeShore.ts's module doc for why (the two-phase dash variety
  //    over a big lake interior reads better than one repeated frame).
  const isWaterSnapshot: boolean[][] = ground.map((row) =>
    row.map((name) => name === "water" || name === "water2")
  );
  const wasWater = (x: number, y: number): boolean => inBounds(x, y) && isWaterSnapshot[y][x];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!wasWater(x, y)) continue;
      let mask = 0;
      if (wasWater(x, y - 1)) mask |= 1; // N
      if (wasWater(x + 1, y)) mask |= 2; // E
      if (wasWater(x, y + 1)) mask |= 4; // S
      if (wasWater(x - 1, y)) mask |= 8; // W
      if (mask === 15) continue;
      ground[y][x] = `lakeShore${mask}`;
    }
  }

  // 5. Dirt-road autotile (v22): same N=1/E=2/S=4/W=8 bit convention as
  //    `assignMountainTileNames` above, reused verbatim. `isRoad` is a
  //    separate grid that is never mutated by this function (or anything
  //    upstream of it) — the mask below reads directly from it rather than
  //    re-deriving "is this a road cell" from `ground`'s own contents mid
  //    pass, which is exactly the snapshot-before-mutate discipline
  //    `assignMountainTileNames`'s own doc comment had to add after
  //    shipping the opposite (mutate-then-read) bug once already.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isRoad[y][x]) continue;
      if (isMtn(x, y) || isWater(x, y)) continue; // defensive; never true by construction
      let mask = 0;
      if (y > 0 && isRoad[y - 1][x]) mask |= 1; // N
      if (x < W - 1 && isRoad[y][x + 1]) mask |= 2; // E
      if (y < H - 1 && isRoad[y + 1][x]) mask |= 4; // S
      if (x > 0 && isRoad[y][x - 1]) mask |= 8; // W
      ground[y][x] = `road${mask}`;
    }
  }
}

/** Rectangular decor "building": a roof cap row, plain wall body, and a
 *  door-centered front row — entirely solid (walkable-up-to, no interior),
 *  same role as mineTimber/cart or truckCab/truckBox elsewhere on this map.
 *  Buildings are deliberately simple architecture, not organic terrain —
 *  only the spine/lake needed the procedural rework.
 *  `wallName`/`roofName` pick which town-kit variant dresses this building
 *  so a cluster of several doesn't wallpaper as one repeated box. */
function placeBuilding(
  decor: (string | null)[][],
  x0: number,
  y0: number,
  w: number,
  h: number,
  wallName: string,
  roofName: string
): void {
  for (let x = x0; x < x0 + w; x++) decor[y0][x] = roofName;
  for (let y = y0 + 1; y < y0 + h - 1; y++) {
    for (let x = x0; x < x0 + w; x++) decor[y][x] = wallName;
  }
  const doorX = x0 + Math.floor(w / 2);
  const frontY = y0 + h - 1;
  for (let x = x0; x < x0 + w; x++) decor[frontY][x] = x === doorX ? "townDoor" : wallName;
  // One window punched into the wall row, off-center from the door.
  if (h > 2) decor[y0 + 1][x0] = "townWindow";
}

/** Marks the connected dirt-road network into `isRoad` (grid coordinates
 *  only — `applyOverworldAutotile`'s step 5 turns this into actual tile
 *  names). Every segment is axis-aligned and shares an endpoint with its
 *  neighboring segment, so the whole thing is one connected line/tree:
 *  town ↔ north stop ↔ (down the winding pass, following the exact
 *  walkable centerline via `centerXForRow`) ↔ south stop ↔ lake. */
function markRoadCells(isRoad: boolean[][]): void {
  const mark = (x: number, y: number): void => {
    isRoad[y][x] = true;
  };
  const hLine = (y: number, x1: number, x2: number): void => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) mark(x, y);
  };
  const vLine = (x: number, y1: number, y2: number): void => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) mark(x, y);
  };

  // The pass itself: follow the exact walkable centerline through the
  // spine, so the road is always on open ground by construction. A pure
  // "one cell per row, x drifting" walk is only 8-connected wherever x
  // changes between consecutive rows (a diagonal step has no shared N/E/S/W
  // edge), which left isolated mask-0 road cells the first time this
  // shipped — bridging each row's old column to the new one with a short
  // horizontal run (still following the centerline, just not skipping the
  // corner) keeps the whole line 4-connected end to end.
  let prevX = centerXForRow(SPINE_Y1);
  mark(prevX, SPINE_Y1);
  for (let y = SPINE_Y1 + 1; y <= SPINE_Y2; y++) {
    const cx = centerXForRow(y);
    hLine(y - 1, prevX, cx);
    mark(cx, y);
    prevX = cx;
  }

  // South stem (spine's south mouth down to the wash) + branch east to the
  // lake's southwest shore. Routed at y=57 (not 59) so it passes a clean
  // two rows north of the wash pool (y=60..61) rather than skimming its
  // shore and eating the pool's own shore tiles.
  vLine(32, SPINE_Y2, 61);
  hLine(57, 32, 49);
  vLine(49, 56, 57);

  // North stem (spine's north mouth up to the mine mouth) + branch west to
  // the town's south plaza.
  vLine(32, 2, SPINE_Y1);
  hLine(4, 14, 32);
  vLine(14, 4, 12);
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
      decor[y].push(null); // open valley by default; the spine/border below add mountain
    }
  }

  // The mountain spine (see the module note above `buildSpineBounds`):
  // per-row noisy east/west bounds, tapering to zero width at both ends —
  // organic, solid and connected by construction.
  const { left: spineLeft, right: spineRight } = buildSpineBounds();
  for (let y = SPINE_Y1; y <= SPINE_Y2; y++) {
    for (let x = spineLeft[y]; x <= spineRight[y]; x++) {
      if (x > 0 && x < OVERWORLD_WIDTH - 1) decor[y][x] = MOUNTAIN_SENTINEL;
    }
  }

  // Carve the winding pass through the spine (a no-op outside it — those
  // cells are already open valley). No clearing-widen step is needed here:
  // the stops themselves sit in the already-open valley bands north/south
  // of the spine, not inside the mountain mass.
  for (let y = 1; y < OVERWORLD_HEIGHT - 1; y++) {
    const cx = centerXForRow(y);
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (x > 0 && x < OVERWORLD_WIDTH - 1) decor[y][x] = null;
    }
  }

  // The Wash: a spring pool near the south stop, ringed by open sand (so
  // the lakeShore ring has land on every side) with the overturned truck
  // off to the side. y=60..61 is well south of the spine's own range
  // (SPINE_Y2=55), so it's always clear of the mountain regardless of the
  // organic boundary's noise; kept a clean 5+ columns off the south road
  // stem (x=32) too, so its own west-facing shore tile survives the
  // road's ground overwrite rather than being swallowed by it.
  ground[60][36] = "water";
  ground[60][37] = "water2";
  ground[61][36] = "water2";
  ground[61][37] = "water";

  // The lake (southeast): a noisy-radius blob (see the module note above
  // `buildLakeRadiusFn`). Clipped to never place water at/behind the
  // spine's own (organic, per-row) east wall — `x > spineRight[y]` — so
  // the lake can never overlap a mountain decor cell regardless of exactly
  // where either boundary's noise lands on a given row; wherever the two
  // organically happen to sit close together, that's where the v22
  // screeWater tileset gets exercised (checked, not just hoped for — see
  // "touches the mountain spine somewhere along its shore" below).
  const lakeRadius = buildLakeRadiusFn();
  const lakeSpanY = Math.ceil((LAKE_BASE_RADIUS * 1.9) / LAKE_ASPECT_Y);
  const lakeSpanX = Math.ceil((LAKE_BASE_RADIUS * 1.9) / LAKE_ASPECT_X) * LAKE_ASPECT_X;
  const yFrom = Math.max(1, LAKE_CY - lakeSpanY);
  const yTo = Math.min(OVERWORLD_HEIGHT - 2, LAKE_CY + lakeSpanY);
  const xFrom = Math.max(1, Math.round(LAKE_CX - lakeSpanX));
  const xTo = Math.min(OVERWORLD_WIDTH - 2, Math.round(LAKE_CX + lakeSpanX));
  for (let y = yFrom; y <= yTo; y++) {
    for (let x = xFrom; x <= xTo; x++) {
      if (x <= spineRight[y]) continue; // never overlap the spine's own footprint
      const dx = (x - LAKE_CX) / LAKE_ASPECT_X;
      const dy = (y - LAKE_CY) / LAKE_ASPECT_Y;
      const dist = Math.hypot(dx, dy);
      if (dist > lakeRadius(Math.atan2(dy, dx))) continue;
      ground[y][x] = (x + y) % 2 === 0 ? "water" : "water2";
    }
  }

  // The road network (grid coordinates only, dressed into tile names by
  // applyOverworldAutotile below). Computed before decor scatter so scatter
  // can politely avoid laying scrub on top of the trail.
  const isRoad: boolean[][] = decor.map((row) => row.map(() => false));
  markRoadCells(isRoad);

  // Sparse non-blocking scatter across the open valleys and pass — kept
  // clear of any shoreline (so the lakeShore/screeWater rings stay legible)
  // and off the road.
  for (let y = 1; y < OVERWORLD_HEIGHT - 1; y++) {
    for (let x = 1; x < OVERWORLD_WIDTH - 1; x++) {
      if (decor[y][x] !== null || isRoad[y][x]) continue;
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
  decor[61][29] = "truckBox";
  decor[62][29] = "truckCab";

  // Cinnabar Mine: timber framing the approach, an abandoned cart beside
  // it, echoing the mine mouth Trail already frames at its own entrance.
  decor[2][29] = "mineTimber";
  decor[2][35] = "mineTimber";
  decor[3][30] = "cart";

  // Joshua trees flanking the two stops — rendered as full standing
  // billboards in the Mode-7 view (solid, like every tree trunk).
  decor[60][40] = "joshuaTrunk";
  decor[59][27] = "joshuaTrunk";
  decor[4][35] = "joshuaTrunk";
  decor[6][28] = "joshuaTrunk";

  // The northwest town: three small buildings around a plaza the road's
  // north branch feeds into, each dressed with a different town-kit wall
  // and roof variant so the cluster doesn't wallpaper as one repeated box.
  // Comfortably clear of even the spine's widest plausible west bulge
  // (nominal left at full taper = SPINE_CX - 10 = 22, minus ≤4 worst-case
  // noise = 18 — the closest building, B2, starts at x=16, 2 cells further
  // out still; verified against the actual generated bounds by
  // "keeps the town clear of the spine's generated west edge" below).
  placeBuilding(decor, 5, 6, 4, 4, "townWall", "townRoof");
  placeBuilding(decor, 16, 7, 4, 4, "townWall2", "townRoof2");
  placeBuilding(decor, 10, 13, 4, 4, "townWall3", "townRoof");
  decor[11][13] = "townSign";

  // Map border: solid mountain — the whole point is that nothing else is
  // reachable except through the pass, the valleys and the roads above.
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

  // Rounded-corner mountain autotile: pick each mountain cell's
  // owMountains.png tile by its N/E/S/W neighbor mask (docs/CONTRACTS.md
  // "owMountains"). Must run before the Phase O dressing pass below, whose
  // is-mountain predicate matches the resulting owMountain* names.
  assignMountainTileNames(decor);

  // Phase O dressing (+ v22 screeWater/lakeShore/road passes): pure
  // autotile selection over the finished layout.
  applyOverworldAutotile(ground, decor, isRoad);

  return { ground, decor };
}
