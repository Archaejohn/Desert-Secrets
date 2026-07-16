/**
 * The Open Desert — a terrain-first, procedurally-generated world map
 * (docs/CONTRACTS.md "v23"). The project owner rejected the previous
 * approach (v22, preserved verbatim in `overworldMapPocV1.ts`): "we're
 * trying to build world around an existing zigzag path. and I think
 * that's the wrong approach. let's build the world first. then add in the
 * mine and truck turnover spot and spring into that world. we can add
 * barriers after it's made." This file follows that ordering literally,
 * as three separate, sequential phases:
 *
 * 1. **Terrain** (`buildTerrainMasses`): several organic mountain masses —
 *    "ranges", "massifs" and "buttes" of varying size — scattered across
 *    open desert, generated with ZERO knowledge of where any landmark or
 *    gate will end up. Each mass is a rotated, aspect-elongated "noisy-
 *    radius blob" (the exact technique v22's lake used for its shoreline,
 *    generalized here to rock and to an arbitrary center/rotation/aspect
 *    per mass — see `massRadiusFactorAt` below) — star-shaped around its
 *    own center by construction, so every mass is one connected, hole-free
 *    region without any flood-fill cleanup pass, same guarantee v22's
 *    spine/lake had.
 * 2. **Landmarks** (`findGateX` + the landmark-placement block in
 *    `generateWorld`): the mine-mouth stop (north) and the spring/truck
 *    stop (south) are placed INTO the terrain generated in phase 1, by
 *    scanning each edge for where the terrain actually left an opening
 *    wide and deep enough, radiating outward from the map's horizontal
 *    center so the search prefers a central gate but genuinely adapts if
 *    a mass happens to sit there. Nothing about phase 1 knows these gate
 *    x-positions exist yet.
 * 3. **Barriers** (`BARRIER_TIER` masses in `generateWorld`): up to two
 *    more mountain masses, added LAST, using the exact same mass-
 *    generation primitive as phase 1 but now allowed to see (and required
 *    to avoid) both landmarks' access corridors. These are a finishing
 *    touch on an already-complete, already-walkable world — not the
 *    world's organizing structure — and a candidate is simply skipped if
 *    it can't be placed without touching a landmark corridor or another
 *    mass too closely; nothing here is required to exist for the map to
 *    work.
 *
 * The outer border is no longer a naive uniform 1-cell rectangle either:
 * the literal edge ring is still guaranteed solid (so enclosure holds
 * unconditionally), but a second, noisy inward "buffer" of 0–3 extra
 * cells per edge position (`buildBorderThickness`, same smoothed 1D noise
 * v22's spine boundary used) gives the border itself an irregular,
 * varying-thickness profile instead of one flat frame.
 *
 * Only two landmarks ship this pass — the mine mouth and the spring/truck
 * stop. The lake, the town and the dirt-road network from v22 are
 * deliberately NOT rebuilt here (out of scope per the owner's staged
 * instructions); they still exist, preserved, in `overworldMapPocV1.ts`.
 *
 * Every generator in this file is seeded (`makeRng`) — no `Math.random`/
 * `Date.now` anywhere — so the whole map is pure, deterministic data.
 * Reachability (every walkable cell from at least one spawn) is verified
 * by BFS in `tests/game/maps.test.ts`, not assumed.
 */
import { cellHash } from "./cellHash";
import { makeRng } from "../../core/rng";
import type { ZoneMap } from "./types";

export const OVERWORLD_WIDTH = 64;
export const OVERWORLD_HEIGHT = 64;

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Pt {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Deterministic 1D value noise (ported unchanged from v22's own spine
// boundary generator — smoothstep-eased between seeded control points, so
// it wanders instead of jittering per cell). Used here only for the
// border's variable-thickness buffer.
// ---------------------------------------------------------------------------

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

/** Placeholder decor value for "this cell is mountain mass" during layout
 *  construction. `assignMountainTileNames` replaces every occurrence with a
 *  real `owMountain{variant}_{mask}` name before anything else sees it. */
const MOUNTAIN_SENTINEL = "__mountainSentinel__";

/** Prefix shared by every generated owMountains.png tile name. */
const OW_MOUNTAIN_PREFIX = "owMountain";

/** Five texture families (`owMountains.ts`'s `MOUNTAIN_VARIANT_COUNT`). */
const OW_MOUNTAIN_VARIANT_COUNT = 5;

// ---------------------------------------------------------------------------
// Phase 1 — terrain: organic mountain masses, no landmark knowledge.
//
// Each mass is a "noisy-radius blob" (v22's lake technique) generalized
// with a rotation and independent long/short-axis aspect, so the SAME
// primitive produces both round buttes and elongated ranges depending on
// its tier's parameters. Star-shaped around its own center by
// construction (the radius factor is clamped well above zero for every
// angle — see `massRadiusFactorAt`), so every mass is one connected,
// hole-free region, exactly like v22's spine/lake, with no flood-fill
// cleanup pass needed.
// ---------------------------------------------------------------------------

interface Harmonic {
  k: number;
  mult: number;
  phase: number;
}

interface Mass {
  cx: number;
  cy: number;
  rotation: number;
  aspectA: number;
  aspectB: number;
  base: number;
  maxFactor: number;
  harmonics: Harmonic[];
}

interface MassTier {
  baseRange: readonly [number, number];
  aspectARange: readonly [number, number];
  aspectBRange: readonly [number, number];
}

/** Six terrain masses: two elongated "ranges", two rounder "massifs", two
 *  small "buttes" — a real desert reads as scattered ranges/buttes with
 *  open valley around them, not one wall bisecting the map. */
const TERRAIN_TIERS: readonly MassTier[] = [
  { baseRange: [5, 7], aspectARange: [1.3, 1.6], aspectBRange: [0.65, 0.85] }, // range
  { baseRange: [5, 7], aspectARange: [1.3, 1.6], aspectBRange: [0.65, 0.85] }, // range
  { baseRange: [4, 5.5], aspectARange: [1.05, 1.3], aspectBRange: [0.8, 0.95] }, // massif
  { baseRange: [4, 5.5], aspectARange: [1.05, 1.3], aspectBRange: [0.8, 0.95] }, // massif
  { baseRange: [2.5, 3.5], aspectARange: [1.0, 1.1], aspectBRange: [0.9, 1.0] }, // butte
  { baseRange: [2.5, 3.5], aspectARange: [1.0, 1.1], aspectBRange: [0.9, 1.0] } // butte
];

/** Barrier masses (phase 3): a bit smaller than the "range" tier — a
 *  finishing touch, not a second wave of primary terrain. */
const BARRIER_TIER: MassTier = { baseRange: [3.5, 5], aspectARange: [1.1, 1.4], aspectBRange: [0.75, 0.9] };

/** How far (in cells) any mass's own reach must stay from the literal map
 *  edge, and the minimum gap (beyond each mass's own reach) kept between
 *  two masses so they read as separate ranges/buttes rather than fusing
 *  into one shapeless mass. */
const MASS_EDGE_MARGIN = 3;
const MASS_MIN_GAP = 5;

const TERRAIN_SEED = 0x7e44a1; // "terrain" — phase 1, zero landmark knowledge
const BARRIER_SEED = 0xba44ea; // "barrier" — phase 3, landmark-aware

function buildHarmonics(rng: () => number): Harmonic[] {
  // Three low-order sine harmonics (periods 2, 3, 5 — same as v22's lake),
  // seeded amplitude/phase, so the outline wanders smoothly instead of
  // spiking.
  return [2, 3, 5].map((k) => ({
    k,
    mult: 0.22 * (0.6 + 0.4 * rng()),
    phase: rng() * Math.PI * 2
  }));
}

/** `1 + Σ mult·sin(k·angle + phase)`, clamped well above zero — the clamp
 *  is what guarantees a mass stays star-shaped (one connected, hole-free
 *  region) regardless of how the harmonics combine at any given angle. */
function massRadiusFactorAt(harmonics: readonly Harmonic[], angle: number): number {
  let f = 1;
  for (const h of harmonics) f += h.mult * Math.sin(h.k * angle + h.phase);
  return Math.max(0.4, f);
}

/** Densely samples `massRadiusFactorAt` to find its true peak (72 samples
 *  comfortably resolves the highest harmonic frequency, k=5, whose period
 *  is 1/5 of a full turn), with a small safety margin for the gap between
 *  samples — used to compute exactly how far a mass can reach before it's
 *  even placed, so margin/spacing checks are precise rather than a rough
 *  worst-case bound. */
function sampleMaxFactor(harmonics: readonly Harmonic[]): number {
  let max = 0;
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    max = Math.max(max, massRadiusFactorAt(harmonics, angle));
  }
  return max * 1.05;
}

/** A mass's own bounding-circle radius: the true peak of its radius
 *  function, scaled by whichever aspect axis is longer (rotation doesn't
 *  change a bounding circle's radius, only its orientation). */
function massReach(m: Mass): number {
  return m.base * m.maxFactor * Math.max(m.aspectA, m.aspectB);
}

function massContains(m: Mass, x: number, y: number): boolean {
  const dx = x - m.cx;
  const dy = y - m.cy;
  const cos = Math.cos(-m.rotation);
  const sin = Math.sin(-m.rotation);
  const rx = (dx * cos - dy * sin) / m.aspectA;
  const ry = (dx * sin + dy * cos) / m.aspectB;
  const dist = Math.hypot(rx, ry);
  if (dist === 0) return true;
  const angle = Math.atan2(ry, rx);
  return dist <= m.base * massRadiusFactorAt(m.harmonics, angle);
}

/**
 * Rejection-samples one mass from `tier`: draws shape/rotation once, then
 * tries positions until one clears both the map margins and every
 * previously-placed mass/keep-clear box by `MASS_MIN_GAP`. If nothing
 * fits at the drawn size, `base` shrinks (proportionally — the harmonics
 * are fractions of `base`, so shrinking is a pure scale, not a re-roll)
 * and placement is retried, down to a floor; returns `null` only if even
 * the smallest attempt can't find room (the caller simply omits that
 * mass — deterministic, never blocks the build).
 */
function placeMass(
  rng: () => number,
  tier: MassTier,
  width: number,
  height: number,
  existing: readonly Mass[],
  keepClear: readonly Rect[]
): Mass | null {
  const harmonics = buildHarmonics(rng);
  const maxFactor = sampleMaxFactor(harmonics);
  const aspectA = tier.aspectARange[0] + rng() * (tier.aspectARange[1] - tier.aspectARange[0]);
  const aspectB = tier.aspectBRange[0] + rng() * (tier.aspectBRange[1] - tier.aspectBRange[0]);
  const rotation = rng() * Math.PI;
  let base = tier.baseRange[0] + rng() * (tier.baseRange[1] - tier.baseRange[0]);

  for (let shrink = 0; shrink < 8; shrink++, base *= 0.82) {
    const reach = base * maxFactor * Math.max(aspectA, aspectB);
    const xLo = MASS_EDGE_MARGIN + reach;
    const xHi = width - 1 - MASS_EDGE_MARGIN - reach;
    const yLo = MASS_EDGE_MARGIN + reach;
    const yHi = height - 1 - MASS_EDGE_MARGIN - reach;
    if (xLo > xHi || yLo > yHi) continue;

    for (let attempt = 0; attempt < 30; attempt++) {
      const cx = xLo + rng() * (xHi - xLo);
      const cy = yLo + rng() * (yHi - yLo);
      const tooCloseToExisting = existing.some((m) => {
        const d = Math.hypot(m.cx - cx, m.cy - cy);
        return d < massReach(m) + reach + MASS_MIN_GAP;
      });
      if (tooCloseToExisting) continue;
      const intrudesKeepClear = keepClear.some(
        (r) =>
          cx + reach >= r.x1 - MASS_MIN_GAP &&
          cx - reach <= r.x2 + MASS_MIN_GAP &&
          cy + reach >= r.y1 - MASS_MIN_GAP &&
          cy - reach <= r.y2 + MASS_MIN_GAP
      );
      if (intrudesKeepClear) continue;
      return { cx, cy, rotation, aspectA, aspectB, base, maxFactor, harmonics };
    }
  }
  return null;
}

/** Stamps one mass into `decor` as `MOUNTAIN_SENTINEL`, only scanning the
 *  cells within its own reach (plus a 1-cell margin) rather than the whole
 *  grid. */
function rasterizeMass(decor: (string | null)[][], m: Mass, width: number, height: number): void {
  const reach = massReach(m);
  const x0 = Math.max(1, Math.floor(m.cx - reach - 1));
  const x1 = Math.min(width - 2, Math.ceil(m.cx + reach + 1));
  const y0 = Math.max(1, Math.floor(m.cy - reach - 1));
  const y1 = Math.min(height - 2, Math.ceil(m.cy + reach + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (massContains(m, x, y)) decor[y][x] = MOUNTAIN_SENTINEL;
    }
  }
}

// ---------------------------------------------------------------------------
// The border: the literal outermost ring stays unconditionally solid (so
// enclosure holds no matter what), but an inward "buffer" of 0–3 extra
// cells per edge position — driven by the same smoothed 1D noise as v22's
// spine boundary — gives the border a genuinely irregular, non-rectangular
// thickness instead of one flat 1-cell frame.
// ---------------------------------------------------------------------------

const BORDER_BUFFER_MAX = 3;

function buildBorderThickness(length: number, seed: number): number[] {
  const noise = smoothNoise1D(length, 10, 1, seed);
  return noise.map((v) => {
    const t = Math.max(0, Math.min(1, (v + 1) / 2));
    return 1 + Math.round(t * BORDER_BUFFER_MAX);
  });
}

function applyBorder(decor: (string | null)[][], width: number, height: number): void {
  const north = buildBorderThickness(width, 0xb0de5001);
  const south = buildBorderThickness(width, 0xb0de5002);
  const west = buildBorderThickness(height, 0xb0de5003);
  const east = buildBorderThickness(height, 0xb0de5004);
  for (let x = 0; x < width; x++) {
    for (let d = 0; d < north[x]; d++) decor[d][x] = MOUNTAIN_SENTINEL;
    for (let d = 0; d < south[x]; d++) decor[height - 1 - d][x] = MOUNTAIN_SENTINEL;
  }
  for (let y = 0; y < height; y++) {
    for (let d = 0; d < west[y]; d++) decor[y][d] = MOUNTAIN_SENTINEL;
    for (let d = 0; d < east[y]; d++) decor[y][width - 1 - d] = MOUNTAIN_SENTINEL;
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — landmarks: find where the terrain (phase 1) actually left each
// edge open, rather than forcing terrain to conform to a hand-picked gate
// position (the thing the project owner rejected about v22). Scans
// outward from the map's horizontal center so a central gate is preferred
// when available, but genuinely adapts to whatever's actually there.
// ---------------------------------------------------------------------------

const GATE_SCAN_HALF = 6; // the gate's own band is narrower (±1); this is room for landmark decor either side
const CORRIDOR_DEPTH = 8; // rows/cols of guaranteed-open ground from the edge inward

/**
 * Finds an x position along the north (`dir=1`, `edgeY=0`) or south
 * (`dir=-1`, `edgeY=height-1`) edge where a `(2*half+1)`-wide,
 * `depth`-deep box is entirely free of mountain mass — scanning outward
 * from the horizontal center so the search prefers a central gate but
 * adapts to whatever the generated terrain actually left open. Mutates
 * `decor` only in the rare fallback case (see below).
 */
function findGateX(
  decor: (string | null)[][],
  width: number,
  height: number,
  edgeY: number,
  dir: 1 | -1,
  depth: number,
  half: number
): number {
  const isOpenColumn = (cx: number): boolean => {
    for (let x = cx - half; x <= cx + half; x++) {
      for (let k = 0; k < depth; k++) {
        const y = edgeY + dir * k;
        if (y < 0 || y >= height) return false;
        if (decor[y][x] === MOUNTAIN_SENTINEL) return false;
      }
    }
    return true;
  };

  const center = Math.floor(width / 2);
  const minCx = half + 1;
  const maxCx = width - 2 - half;
  for (let r = 0; r <= center; r++) {
    const candidates = r === 0 ? [center] : [center - r, center + r];
    for (const cx of candidates) {
      if (cx < minCx || cx > maxCx) continue;
      if (isOpenColumn(cx)) return cx;
    }
  }

  // Fallback — every column's full-depth box hits at least one mountain
  // cell (six scattered masses on a 64-wide map making this true
  // everywhere would be unusual, but not impossible). Rather than hand-
  // carving a whole corridor, nudge the terrain minimally: pick whichever
  // column has the FEWEST blocking cells in a shallower (4-deep) box and
  // clear just those specific cells.
  let bestCx = center;
  let bestBlocked: Array<[number, number]> = new Array(depth * (2 * half + 1) + 1);
  let bestCount = Infinity;
  for (let cx = minCx; cx <= maxCx; cx++) {
    const blocked: Array<[number, number]> = [];
    for (let x = cx - half; x <= cx + half; x++) {
      for (let k = 0; k < 4; k++) {
        const y = edgeY + dir * k;
        if (y < 0 || y >= height) continue;
        if (decor[y][x] === MOUNTAIN_SENTINEL) blocked.push([x, y]);
      }
    }
    if (blocked.length < bestCount) {
      bestCount = blocked.length;
      bestCx = cx;
      bestBlocked = blocked;
    }
  }
  for (const [x, y] of bestBlocked) decor[y][x] = null;
  return bestCx;
}

/**
 * Converts every `MOUNTAIN_SENTINEL` decor cell into a concrete
 * `owMountain{variant}_{mask}` name. Ported unchanged from v22 (see
 * `overworldMapPocV1.ts` for the original, fully-documented version this
 * was copied from) — the mutate-before-read discipline this function
 * exists to enforce is exactly as load-bearing here as it was there:
 * every mask lookup below reads a frozen PRE-mutation snapshot of "is this
 * cell mountain", never `decor` itself, because writing a cell's real name
 * into `decor` before a later cell's neighbor check reads it would corrupt
 * that check (a real, shipped bug the first time this function existed —
 * see the v22 file's own comment for the full incident writeup).
 */
function assignMountainTileNames(decor: (string | null)[][]): void {
  const H = decor.length;
  const W = decor[0].length;
  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const isMtnSnapshot: boolean[][] = decor.map((row) => row.map((cell) => cell === MOUNTAIN_SENTINEL));
  const isMtn = (x: number, y: number): boolean => inBounds(x, y) && isMtnSnapshot[y][x];
  const maskNeighborPresent = (x: number, y: number): boolean => (inBounds(x, y) ? isMtn(x, y) : true);

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
 * Pure autotile selection pass (Phase O, docs/ART_DIRECTION.md §4a) —
 * mutates the finished layout in place. v22's road/town/lake-specific
 * steps are gone (out of scope this pass — see the module doc); what's
 * left (scree dressing, the foot-shadow band, sand↔scree and scree↔water
 * finger transitions, and the mask-based sand↔water shore ring) is ported
 * unchanged from v22 because it's entirely generic — it never assumed the
 * mountain shape was a spine or the water body was "the lake", it just
 * reads whichever cells are mountain/water this build actually produced.
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
  const isWater = (x: number, y: number): boolean => {
    if (!inBounds(x, y)) return false;
    const g = ground[y][x];
    return g === "water" || g === "water2" || g.startsWith("lakeShore");
  };

  // 1. Scree ground under every mountain cell.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isMtn(x, y)) ground[y][x] = cellHash(x, y) % 2 === 0 ? "scree" : "scree2";
    }
  }

  // 2. Mountain foot-shadow band south of every mass.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isMtn(x, y) && !isWater(x, y) && isMtn(x, y - 1)) ground[y][x] = "screeShade";
    }
  }

  // 3. Sand↔scree finger transitions.
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
      if (name !== null) ground[y][x] = name;
    }
  }

  // 3b. Scree↔water finger transitions — defensive: with barrier masses
  //     (phase 3) placed after the spring pool exists, a mountain edge
  //     could in principle end up adjacent to it, even though placement
  //     keeps a clear gap by construction. Kept for the same reason v22
  //     kept it: cheap, generic, and correct if it's ever exercised.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isMtn(x, y)) continue;
      const wOpen = (dx: number, dy: number): boolean => inBounds(x + dx, y + dy) && isWater(x + dx, y + dy);
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

  // 4. lakeShore autotile on the spring pool: same generic mask-based
  //    sand↔water ring v22 used for its lake (mask = which N/E/S/W
  //    neighbours are ALSO water). Snapshotted before mutation for the
  //    same reason assignMountainTileNames is.
  const isWaterSnapshot: boolean[][] = ground.map((row) => row.map((name) => name === "water" || name === "water2"));
  const wasWater = (x: number, y: number): boolean => inBounds(x, y) && isWaterSnapshot[y][x];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!wasWater(x, y)) continue;
      let mask = 0;
      if (wasWater(x, y - 1)) mask |= 1;
      if (wasWater(x + 1, y)) mask |= 2;
      if (wasWater(x, y + 1)) mask |= 4;
      if (wasWater(x - 1, y)) mask |= 8;
      if (mask === 15) continue;
      ground[y][x] = `lakeShore${mask}`;
    }
  }
}

interface GeneratedWorld {
  ground: string[][];
  decor: (string | null)[][];
  southExit: Rect;
  northExit: Rect;
  southSpawn: Pt;
  northSpawn: Pt;
}

/**
 * The whole build, in the three phases the module doc describes. Pure and
 * deterministic — same seeds every call, so two calls produce
 * structurally-equal (though independent-array) results.
 */
function generateWorld(): GeneratedWorld {
  const W = OVERWORLD_WIDTH;
  const H = OVERWORLD_HEIGHT;
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  for (let y = 0; y < H; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < W; x++) {
      const h = cellHash(x, y);
      let name = "sand";
      if (h % 17 === 0) name = "sand2";
      else if (h % 13 === 0) name = "sand3";
      else if (h % 61 === 0) name = "sandSparkle";
      ground[y].push(name);
      decor[y].push(null);
    }
  }

  // ---- Phase 1: terrain, zero landmark knowledge ----
  const terrainRng = makeRng(TERRAIN_SEED);
  const terrainMasses: Mass[] = [];
  for (const tier of TERRAIN_TIERS) {
    const m = placeMass(terrainRng, tier, W, H, terrainMasses, []);
    if (m) {
      terrainMasses.push(m);
      rasterizeMass(decor, m, W, H);
    }
  }

  // ---- Phase 2: landmarks — placed into whatever phase 1 actually left open ----
  const northGateCx = findGateX(decor, W, H, 0, 1, CORRIDOR_DEPTH, GATE_SCAN_HALF);
  const southGateCx = findGateX(decor, W, H, H - 1, -1, CORRIDOR_DEPTH, GATE_SCAN_HALF);
  const northCorridor: Rect = {
    x1: northGateCx - GATE_SCAN_HALF,
    y1: 0,
    x2: northGateCx + GATE_SCAN_HALF,
    y2: CORRIDOR_DEPTH - 1
  };
  const southCorridor: Rect = {
    x1: southGateCx - GATE_SCAN_HALF,
    y1: H - CORRIDOR_DEPTH,
    x2: southGateCx + GATE_SCAN_HALF,
    y2: H - 1
  };

  // ---- Phase 3: barriers — landmark-aware, added last, purely a finishing touch ----
  const barrierRng = makeRng(BARRIER_SEED);
  const allMasses = terrainMasses.slice();
  for (let i = 0; i < 2; i++) {
    const m = placeMass(barrierRng, BARRIER_TIER, W, H, allMasses, [northCorridor, southCorridor]);
    if (m) {
      allMasses.push(m);
      rasterizeMass(decor, m, W, H);
    }
  }

  // The border: literal edge unconditionally solid, plus a noisy inward
  // buffer for a genuinely irregular (not flat-rectangular) thickness.
  applyBorder(decor, W, H);

  // Re-open both landmarks' interior corridors (rows 1..CORRIDOR_DEPTH-1,
  // not the literal edge row itself) in case the border buffer reached in
  // — phase 1/3 masses never placed cells here by construction, so this
  // only ever undoes the border step, never a real mass.
  const clearCorridor = (corridor: Rect, skipEdgeRow: number): void => {
    for (let y = corridor.y1; y <= corridor.y2; y++) {
      if (y === skipEdgeRow) continue;
      for (let x = Math.max(1, corridor.x1); x <= Math.min(W - 2, corridor.x2); x++) decor[y][x] = null;
    }
  };
  clearCorridor(northCorridor, 0);
  clearCorridor(southCorridor, H - 1);

  // Open the literal 3-wide gate bands at the true edge, last, so nothing
  // above re-seals them.
  const northExit: Rect = { x1: northGateCx - 1, y1: 0, x2: northGateCx + 1, y2: 0 };
  const southExit: Rect = { x1: southGateCx - 1, y1: H - 1, x2: southGateCx + 1, y2: H - 1 };
  for (let x = northExit.x1; x <= northExit.x2; x++) {
    decor[0][x] = null;
    ground[0][x] = "sand2";
  }
  for (let x = southExit.x1; x <= southExit.x2; x++) {
    decor[H - 1][x] = null;
    ground[H - 1][x] = "sand2";
  }

  // Landmark decor, placed relative to each gate's own x (fixed offsets —
  // the gate position itself was the only thing computed, the shape of
  // "a mine mouth"/"a spring stop" is authored flavor, same as v22's).
  decor[2][northGateCx - 3] = "mineTimber";
  decor[2][northGateCx + 3] = "mineTimber";
  decor[3][northGateCx - 2] = "cart";
  decor[4][northGateCx - 5] = "joshuaTrunk";
  decor[6][northGateCx + 5] = "joshuaTrunk";

  decor[H - 3][southGateCx - 3] = "truckBox";
  decor[H - 2][southGateCx - 3] = "truckCab";
  ground[H - 4][southGateCx + 4] = "water";
  ground[H - 4][southGateCx + 5] = "water2";
  ground[H - 3][southGateCx + 4] = "water2";
  ground[H - 3][southGateCx + 5] = "water";
  decor[H - 4][southGateCx - 5] = "joshuaTrunk";
  decor[H - 5][southGateCx + 2] = "joshuaTrunk";

  const southSpawn: Pt = { x: southGateCx, y: H - 3 };
  const northSpawn: Pt = { x: northGateCx, y: 2 };

  // Sparse non-blocking scatter across whatever open ground is left —
  // clear of mountain, water and any decor already placed.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
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

  assignMountainTileNames(decor);
  applyOverworldAutotile(ground, decor);

  return { ground, decor, southExit, northExit, southSpawn, northSpawn };
}

const WORLD = generateWorld();

/** South-edge exit band → back to the oasis (the spring/truck stop). */
export const OVERWORLD_SOUTH_EXIT = WORLD.southExit;
/** North-edge exit band → the mine entrance (the Cinnabar Mine stop). */
export const OVERWORLD_NORTH_EXIT = WORLD.northExit;
/** Where the player appears arriving from the oasis (also the default spawn). */
export const OVERWORLD_SOUTH_SPAWN = WORLD.southSpawn;
/** Where the player appears arriving back from the mine entrance. */
export const OVERWORLD_NORTH_SPAWN = WORLD.northSpawn;

export function buildOverworldMap(): ZoneMap {
  // A fresh independent build every call (not a shared/aliased reference
  // to `WORLD`) — cheap for a 64x64 grid, and it means nothing downstream
  // can mutate the module-level constants above by mutating a returned map.
  const fresh = generateWorld();
  return { ground: fresh.ground, decor: fresh.decor };
}
