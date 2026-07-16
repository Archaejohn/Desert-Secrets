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
 * 2. **Landmarks** (`findInteriorStop` + the landmark-placement block in
 *    `generateWorld`): the mine-mouth stop (north) and the spring/truck
 *    stop (south) are INTERIOR — places you walk up to out in the desert,
 *    not openings in the map edge. Each is dropped INTO the terrain from
 *    phase 1, radiating out from a target point set well inside the map
 *    (`STOP_INSET`) until its whole clearing is free of mountain, so it
 *    lands in genuinely open ground rather than punching a hole in a
 *    range. Its exit is a short band of threshold tiles at the stop and
 *    its arrival spawn sits two rows clear of that band (so re-entry never
 *    bounces). Nothing about phase 1 knows these stops exist yet.
 * 3. **Barriers** (`BARRIER_TIER` masses in `generateWorld`): up to two
 *    more mountain masses, added LAST, using the exact same mass-
 *    generation primitive as phase 1 but now allowed to see (and required
 *    to avoid) both stops' clearings. These are a finishing touch on an
 *    already-complete, already-walkable world — not the world's organizing
 *    structure — and a candidate is simply skipped if it can't be placed
 *    without touching a stop clearing or another mass too closely; nothing
 *    here is required to exist for the map to work.
 *
 * The outer border is FULLY closed (the stops being interior, there are no
 * edge gates to leave gaps for) and is not a naive uniform 1-cell rectangle
 * either: the literal edge ring is guaranteed solid, and a second, noisy
 * inward "buffer" of 0–3 extra cells per edge position
 * (`buildBorderThickness`, same smoothed 1D noise v22's spine boundary used)
 * gives the border itself an irregular, varying-thickness profile.
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
import { AUTHORED_OVERWORLD } from "./overworldMap.authored";
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
// Phase 2 — landmarks as INTERIOR stops. The mine mouth (north) and the
// spring/truck stop (south) are not openings in the map edge — the border
// stays fully closed. Each stop is a place you walk UP TO out in the open
// desert: it's dropped into a patch of open ground (radiating out from a
// target point set well inside the map), its exit is a short band of tiles at
// the stop, and the arrival spawn sits a couple of tiles clear of that band so
// re-entering the zone doesn't instantly bounce you back out. Placed into
// whatever phase 1 left open, exactly like the old edge gates — just interior.
// ---------------------------------------------------------------------------

/** How far a stop's row sits from its own edge — genuinely interior, well
 *  clear of the border buffer, not hard against the map boundary. */
const STOP_INSET = 12;
/** The open clearing kept around a stop for its landmark decor + exit + spawn. */
const STOP_CLEAR_HALF_X = 6;
const STOP_CLEAR_UP = 3;
const STOP_CLEAR_DOWN = 4;

interface Stop {
  x: number;
  y: number;
}

/** The keep-clear box a placed stop occupies (barriers must avoid it). */
function stopClearBox(s: Stop): Rect {
  return {
    x1: s.x - STOP_CLEAR_HALF_X,
    y1: s.y - STOP_CLEAR_UP,
    x2: s.x + STOP_CLEAR_HALF_X,
    y2: s.y + STOP_CLEAR_DOWN
  };
}

/** Clears every mountain-mass cell inside a stop's clearing (interior only). */
function clearStopBox(decor: (string | null)[][], s: Stop, W: number, H: number): void {
  const b = stopClearBox(s);
  for (let y = Math.max(1, b.y1); y <= Math.min(H - 2, b.y2); y++) {
    for (let x = Math.max(1, b.x1); x <= Math.min(W - 2, b.x2); x++) decor[y][x] = null;
  }
}

/**
 * Finds an interior cell for a stop by radiating out (nearest-first) from a
 * target point until the stop's whole clearing is free of mountain mass —
 * so a stop lands in genuinely open desert rather than punching a hole in a
 * range. Falls back to the clamped target (clearing whatever's there) only if
 * nothing open is found, mirroring the old gate finder's fallback discipline.
 */
function findInteriorStop(
  decor: (string | null)[][],
  W: number,
  H: number,
  targetX: number,
  targetY: number
): Stop {
  const margin = BORDER_BUFFER_MAX + 2;
  const boxFree = (cx: number, cy: number): boolean => {
    const b = stopClearBox({ x: cx, y: cy });
    if (b.x1 < margin || b.x2 > W - 1 - margin || b.y1 < margin || b.y2 > H - 1 - margin) return false;
    for (let y = b.y1; y <= b.y2; y++) {
      for (let x = b.x1; x <= b.x2; x++) if (decor[y][x] === MOUNTAIN_SENTINEL) return false;
    }
    return true;
  };
  const maxR = Math.max(W, H);
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // square ring at radius r
        if (boxFree(targetX + dx, targetY + dy)) return { x: targetX + dx, y: targetY + dy };
      }
    }
  }
  const s: Stop = {
    x: Math.min(W - 1 - margin, Math.max(margin, targetX)),
    y: Math.min(H - 1 - margin, Math.max(margin, targetY))
  };
  clearStopBox(decor, s, W, H);
  return s;
}

/**
 * Opens a stop's exit band — a 3-wide strip of threshold sand at the stop row,
 * cleared of decor so it's steppable — and returns that exit rect plus the
 * arrival spawn, placed two rows off the band (`dir` = +1 south of the stop
 * for the north/mine stop, −1 north of it for the south/spring stop) so
 * re-entering the overworld never lands you back on the exit tile.
 */
function openStopExit(
  ground: string[][],
  decor: (string | null)[][],
  s: Stop,
  dir: 1 | -1
): { exit: Rect; spawn: Pt } {
  const exit: Rect = { x1: s.x - 1, y1: s.y, x2: s.x + 1, y2: s.y };
  for (let x = exit.x1; x <= exit.x2; x++) {
    decor[s.y][x] = null;
    ground[s.y][x] = "sand2";
  }
  const spawn: Pt = { x: s.x, y: s.y + 2 * dir };
  decor[spawn.y][spawn.x] = null;
  return { exit, spawn };
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

/**
 * Sparse non-blocking scatter (creosote / bones) across whatever open ground
 * is left — skipping any cell already carrying decor, and any cell adjacent to
 * water. Extracted so the procedural build and an authored layout dress their
 * open desert identically. Deterministic (keyed on `cellHash`), same as the
 * rest of the map.
 */
function applyScatter(ground: string[][], decor: (string | null)[][]): void {
  const H = ground.length;
  const W = ground[0].length;
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

  // ---- Phase 2: interior stops — placed into whatever phase 1 left open ----
  const centerX = Math.floor(W / 2);
  const northStop = findInteriorStop(decor, W, H, centerX, STOP_INSET);
  const southStop = findInteriorStop(decor, W, H, centerX, H - 1 - STOP_INSET);

  // ---- Phase 3: barriers — added last; must also avoid the two stops ----
  const barrierRng = makeRng(BARRIER_SEED);
  const allMasses = terrainMasses.slice();
  for (let i = 0; i < 2; i++) {
    const m = placeMass(barrierRng, BARRIER_TIER, W, H, allMasses, [
      stopClearBox(northStop),
      stopClearBox(southStop)
    ]);
    if (m) {
      allMasses.push(m);
      rasterizeMass(decor, m, W, H);
    }
  }

  // The border: fully closed now (the stops are interior, so there are no gate
  // openings) — literal edge unconditionally solid, plus the noisy inward
  // buffer for a genuinely irregular (not flat-rectangular) thickness.
  applyBorder(decor, W, H);

  // Both stops sit well inside the border buffer and barriers avoided them, so
  // re-clearing their clearings is belt-and-braces; then open each exit band
  // and dress it with landmark flavor.
  clearStopBox(decor, northStop, W, H);
  clearStopBox(decor, southStop, W, H);
  const north = openStopExit(ground, decor, northStop, 1);
  const south = openStopExit(ground, decor, southStop, -1);
  const northExit = north.exit;
  const northSpawn = north.spawn;
  const southExit = south.exit;
  const southSpawn = south.spawn;

  // Mine-mouth flavor framing the north stop (timbers either side of the exit
  // band, a cart and joshua trees around it) — never on the exit or spawn.
  decor[northStop.y - 1][northStop.x - 2] = "mineTimber";
  decor[northStop.y - 1][northStop.x + 2] = "mineTimber";
  decor[northStop.y - 1][northStop.x - 3] = "cart";
  decor[northStop.y + 1][northStop.x - 5] = "joshuaTrunk";
  decor[northStop.y - 1][northStop.x + 5] = "joshuaTrunk";

  // Spring/truck flavor at the south stop — the overturned truck and a small
  // spring pool off to the side of the walking line.
  decor[southStop.y + 1][southStop.x - 3] = "truckBox";
  decor[southStop.y + 2][southStop.x - 3] = "truckCab";
  ground[southStop.y + 1][southStop.x + 3] = "water";
  ground[southStop.y + 1][southStop.x + 4] = "water2";
  ground[southStop.y + 2][southStop.x + 3] = "water2";
  ground[southStop.y + 2][southStop.x + 4] = "water";
  decor[southStop.y + 1][southStop.x - 5] = "joshuaTrunk";
  decor[southStop.y - 1][southStop.x + 5] = "joshuaTrunk";

  // Sparse non-blocking scatter across whatever open ground is left.
  applyScatter(ground, decor);

  assignMountainTileNames(decor);
  applyOverworldAutotile(ground, decor);

  return { ground, decor, southExit, northExit, southSpawn, northSpawn };
}

// ---------------------------------------------------------------------------
// The human-touch path — a hand-authored layout (`tools/mapeditor`).
//
// The editor is a LAYOUT tool, not a tile-painting one: a person paints the
// semantic terrain (mountain / open sand / water) and drops the two landmarks
// and gates, and that is ALL an `AuthoredOverworld` stores — a compact
// terrain field plus a handful of markers, never concrete `owMountain*` /
// `scree*` / `lakeShore*` names. Turning that layout into a finished ZoneMap
// runs the exact same finishing passes as the procedural build
// (`assignMountainTileNames` + `applyOverworldAutotile` + `applyScatter`), so
// a hand-drawn map autotiles identically to a generated one and can never
// disagree with the game's own tiling. The editor previews with a JS port of
// those same passes, checked for parity in the map tests.
// ---------------------------------------------------------------------------

/** The compact, hand-editable overworld layout the map editor exports. */
export interface AuthoredOverworld {
  /**
   * One string per row, each `OVERWORLD_WIDTH` chars wide:
   * `.` = open sand, `#` = mountain mass, `~` = spring water.
   */
  terrainRows: string[];
  /** Landmark decor (mineTimber, cart, truckBox, truckCab, joshuaTrunk, …),
   *  placed at explicit cells rather than derived from a gate offset. */
  landmarks: ReadonlyArray<{ x: number; y: number; name: string }>;
  /** The mine (north) stop: step onto `northGate` → the mine entrance; arrive
   *  back from the mine at `northSpawn`. Both are interior tiles; keep the
   *  spawn off the gate band so re-entering the overworld doesn't bounce. */
  northGate: Pt;
  northSpawn: Pt;
  /** The spring/oasis (south) stop — same shape. */
  southGate: Pt;
  southSpawn: Pt;
}

const TERRAIN_MOUNTAIN = "#";
const TERRAIN_WATER = "~";

/**
 * Finishes a hand-authored layout into a ZoneMap using the SAME passes as the
 * procedural build. The authored terrain already contains whatever border the
 * human drew (the editor seeds from the procedural map, border included), so
 * this deliberately does NOT re-run `applyBorder` — it opens each interior
 * exit band (3 wide, threshold sand) at the author's gate, clears the two
 * arrival spawn cells, then autotiles. The map edge is never touched.
 */
function finishAuthoredLayout(a: AuthoredOverworld): GeneratedWorld {
  const H = a.terrainRows.length;
  const W = a.terrainRows[0].length;
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  for (let y = 0; y < H; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < W; x++) {
      const cell = a.terrainRows[y][x];
      const h = cellHash(x, y);
      let g = "sand";
      if (h % 17 === 0) g = "sand2";
      else if (h % 13 === 0) g = "sand3";
      else if (h % 61 === 0) g = "sandSparkle";
      let d: string | null = null;
      if (cell === TERRAIN_MOUNTAIN) d = MOUNTAIN_SENTINEL;
      else if (cell === TERRAIN_WATER) g = h % 2 === 0 ? "water" : "water2";
      ground[y].push(g);
      decor[y].push(d);
    }
  }

  // Landmark decor, exactly where the author placed it.
  for (const lm of a.landmarks) {
    if (lm.y >= 0 && lm.y < H && lm.x >= 0 && lm.x < W) decor[lm.y][lm.x] = lm.name;
  }

  // Open each interior exit band (3 wide at the gate) to threshold sand, and
  // clear the spawn cells so you always arrive on open ground.
  const openGate = (g: Pt): Rect => {
    const exit: Rect = { x1: g.x - 1, y1: g.y, x2: g.x + 1, y2: g.y };
    for (let x = exit.x1; x <= exit.x2; x++) {
      if (x >= 0 && x < W && g.y >= 0 && g.y < H) {
        decor[g.y][x] = null;
        ground[g.y][x] = "sand2";
      }
    }
    return exit;
  };
  const northExit = openGate(a.northGate);
  const southExit = openGate(a.southGate);
  for (const s of [a.northSpawn, a.southSpawn]) {
    if (s.x >= 0 && s.x < W && s.y >= 0 && s.y < H) decor[s.y][s.x] = null;
  }

  applyScatter(ground, decor);
  assignMountainTileNames(decor);
  applyOverworldAutotile(ground, decor);

  return { ground, decor, southExit, northExit, southSpawn: a.southSpawn, northSpawn: a.northSpawn };
}

/** Landmark decor the editor treats as movable markers (everything else on
 *  the decor layer is either mountain mass or regenerated scatter). */
const AUTHORED_LANDMARK_NAMES: ReadonlySet<string> = new Set([
  "mineTimber",
  "cart",
  "truckBox",
  "truckCab",
  "joshuaTrunk"
]);

/**
 * Derives the editable semantic layout from a finished ZoneMap — the seed the
 * map editor loads, and the inverse of `finishAuthoredLayout`. Mountains
 * become `#`, water/shore become `~`, everything walkable becomes `.`;
 * scatter (creosote/bones) is intentionally dropped (it is regenerated), while
 * the named landmarks are captured as markers. Round-tripping a procedural map
 * through derive→finish reproduces it exactly (asserted in the map tests).
 */
export function deriveAuthoredLayout(
  map: ZoneMap,
  stops: { northGate: Pt; northSpawn: Pt; southGate: Pt; southSpawn: Pt }
): AuthoredOverworld {
  const H = map.decor.length;
  const W = map.decor[0].length;
  const terrainRows: string[] = [];
  const landmarks: Array<{ x: number; y: number; name: string }> = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const d = map.decor[y][x];
      const g = map.ground[y][x];
      if (d !== null && d.startsWith(OW_MOUNTAIN_PREFIX)) row += TERRAIN_MOUNTAIN;
      else if (g === "water" || g === "water2" || g.startsWith("lakeShore")) row += TERRAIN_WATER;
      else row += ".";
      if (d !== null && AUTHORED_LANDMARK_NAMES.has(d)) landmarks.push({ x, y, name: d });
    }
    terrainRows.push(row);
  }
  return { terrainRows, landmarks, ...stops };
}

/** A hand-authored layout, if one has been dropped in, wins over the
 *  procedural build; otherwise the terrain-first generator runs. */
function buildWorld(): GeneratedWorld {
  return AUTHORED_OVERWORLD ? finishAuthoredLayout(AUTHORED_OVERWORLD) : generateWorld();
}

const WORLD = buildWorld();

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
  const fresh = buildWorld();
  return { ground: fresh.ground, decor: fresh.decor };
}

/** Finishes an authored layout to a ZoneMap through the shared autotile
 *  passes — the same transform `buildOverworldMap()` applies when an authored
 *  layout is active. Exposed for the editor's parity check and tests. */
export function buildAuthoredMap(a: AuthoredOverworld): ZoneMap {
  const fresh = finishAuthoredLayout(a);
  return { ground: fresh.ground, decor: fresh.decor };
}

/** The procedural generator's own build, ALWAYS (ignoring any authored
 *  override) — its map plus its interior stops. Exposed so the generator's
 *  strict invariants can be tested directly even when a hand-authored layout
 *  is the one that actually ships. */
export interface OverworldBuild {
  map: ZoneMap;
  northExit: { x1: number; y1: number; x2: number; y2: number };
  southExit: { x1: number; y1: number; x2: number; y2: number };
  northSpawn: { x: number; y: number };
  southSpawn: { x: number; y: number };
}

export function buildProceduralOverworld(): OverworldBuild {
  const w = generateWorld();
  return {
    map: { ground: w.ground, decor: w.decor },
    northExit: w.northExit,
    southExit: w.southExit,
    northSpawn: w.northSpawn,
    southSpawn: w.southSpawn
  };
}
