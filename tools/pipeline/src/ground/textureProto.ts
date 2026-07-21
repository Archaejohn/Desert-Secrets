/**
 * DESIGN EXPLORATION — distinct per-material ground texture prototypes.
 *
 * The shipped G1 `fills.ts` gives every ground the SAME recipe (a
 * world-fbm mottle + scattered single-pixel flecks), so all 19 grounds read
 * as recolours of one concept. This module prototypes a kit of world-position
 * texture PRIMITIVES so each material class can have its own STRUCTURE
 * (cellular pools, ripple bands, crystalline facets, clumped patches…), then
 * uses them in `protoFill` to re-texture 6 diverse grounds.
 *
 * NOT wired into the pipeline. Does not touch fills.ts / terrains.ts / any
 * baked sheet. This is a review artifact only.
 *
 * Hard rules (identical to the shipped pipeline):
 *  - World-position + non-repeating: sample absolute world coords; never a
 *    16px period. Built only on `h2` and the worldNoise helpers.
 *  - Palette-locked: every pixel is a PaletteName from `TERRAIN_RAMPS[key]`.
 *  - Deterministic: pure fn of (key, wx, wy) via h2 / world-noise. No
 *    Math.random, no Date.
 */
import { h2 } from "../cliffs/noise";
import { worldNoise, worldFbm } from "./worldNoise";
import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";
import type { PaletteName } from "../../../../src/shared/palette";

const clampIdx = (i: number, n: number): number => (i < 0 ? 0 : i >= n ? n - 1 : i);

// ---------------------------------------------------------------------------
// Primitive kit — all world-position, all non-wrapping, all deterministic.
// ---------------------------------------------------------------------------

export interface WorleyResult {
  /** distance to the nearest jittered feature point (in cell units). */
  f1: number;
  /** distance to the 2nd-nearest feature point. `f2 - f1` ~ 0 near edges. */
  f2: number;
  /** stable integer id of the nearest feature cell (for per-cell tone). */
  cell: number;
}

/**
 * Jittered-grid cellular (Worley) noise at absolute world coords. Lays a grid
 * at `freq`, jitters one feature point inside each cell by `h2`, searches the
 * 3×3 neighbourhood of the sample's home cell, and reports the nearest and
 * 2nd-nearest feature-point distances plus a stable integer cell id.
 *
 *  - `f2 - f1` → cell-edge closeness (near 0 on a boundary): cracks / seams.
 *  - `cell`    → per-cell tone (hash it with `h2`): molten pools, ice facets.
 */
export function worley(wx: number, wy: number, freq: number, s: number): WorleyResult {
  const fx = wx * freq, fy = wy * freq;
  const cx = Math.floor(fx), cy = Math.floor(fy);
  let f1 = Infinity, f2 = Infinity, wcx = cx, wcy = cy;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j;
      // one jittered feature point per grid cell
      const px = gx + h2(gx, gy, s);
      const py = gy + h2(gx, gy, s + 101);
      const dx = px - fx, dy = py - fy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) {
        f2 = f1; f1 = d; wcx = gx; wcy = gy;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  // fold winner coords into a small stable non-negative integer id
  const cell = ((wcx & 0xffff) << 16 | (wcy & 0xffff)) >>> 0;
  return { f1, f2, cell };
}

/** Per-cell tone in [0,1) from a `worley` cell id — stable, well-distributed. */
export const cellTone = (cell: number, s: number): number =>
  h2(cell & 0xffff, (cell >>> 16) & 0xffff, s);

/**
 * Ridged fbm: `1 - |2*worldNoise - 1|` summed over two octaves. Produces sharp
 * crack-like ridges (values pile toward 1 along thin creases) rather than the
 * soft blobs of plain fbm. Result normalised to ~[0,1].
 */
export function ridged(wx: number, wy: number, s: number): number {
  const oct = (freq: number, sd: number): number => {
    const n = worldNoise(wx, wy, freq, sd);
    return 1 - Math.abs(2 * n - 1);
  };
  return oct(0.12, s) * 0.6 + oct(0.25, s + 1) * 0.4;
}

/**
 * Directional bands: project (wx,wy) onto `angle`, then `sin(proj*freq +
 * worldFbm*warp)`. Gives wind ripples / wave bands whose lines run
 * perpendicular to `angle`, warped organically by `warp`. Result in [0,1].
 */
export function striate(
  wx: number, wy: number, angle: number, freq: number, warp: number, s: number,
): number {
  const proj = wx * Math.cos(angle) + wy * Math.sin(angle);
  const w = (worldFbm(wx, wy, s) - 0.5) * warp;
  return (Math.sin(proj * freq + w) + 1) * 0.5;
}

/**
 * Domain warp: offset the sample coords by low-freq worldFbm * `amp`. Feeding
 * the warped coords into another primitive bends its features into organic,
 * flowing shapes (used for moss clumps and clumped grain).
 */
export function warp(wx: number, wy: number, amp: number, s: number): [number, number] {
  const ox = (worldFbm(wx, wy, s) - 0.5) * amp;
  const oy = (worldFbm(wx, wy, s + 53) - 0.5) * amp;
  return [wx + ox, wy + oy];
}

// ---------------------------------------------------------------------------
// protoFill — 6 grounds, each a genuinely different texture STRUCTURE.
// Same ramp/colours as shipped; only the pattern changes.
// ---------------------------------------------------------------------------

/** Stable per-key seed (same construction fills.ts uses). */
const keySeed = (k: string): number =>
  [...k].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

/** The 6 grounds this prototype re-textures. */
export const PROTO_KEYS = [
  "sand", "reefWater", "lava", "groveMoss", "ice", "groveSoil",
] as const;
export type ProtoKey = (typeof PROTO_KEYS)[number];

export function protoFill(key: ProtoKey, wx: number, wy: number): PaletteName {
  const ramp = TERRAIN_RAMPS[key as TerrainKey];
  const seed = keySeed(key);
  let idx: number;

  switch (key) {
    // sand ["sandLight","sand","sandShade","umber"]
    // STRUCTURE: fine near-horizontal wind ripples. Bands, not dots — gentle,
    // low amplitude, so most pixels are base `sand` with faint light/dark
    // ripple crests and troughs marching across.
    case "sand": {
      const r = striate(wx, wy, Math.PI / 2 + 0.12, 0.16, 2.2, seed);   // near-horizontal
      const r2 = striate(wx, wy, Math.PI / 2 - 0.05, 0.42, 1.4, seed + 9); // fine detail
      const band = r * 0.7 + r2 * 0.3;
      idx = 1;                                  // base sand
      if (band > 0.70) idx = 0;                 // light ripple crest
      else if (band < 0.30) idx = 2;            // shaded ripple trough
      if (band < 0.12) idx = 3;                 // rare deep grain (umber) in trough shadow
      break;
    }

    // reefWater ["skyBlue","teal","tealDeep","indigo"]
    // STRUCTURE: horizontal caustic wave bands — a fast band crossed with a
    // slow band, plus sparse bright skyBlue crests. Flowing, no dots.
    case "reefWater": {
      const fast = striate(wx, wy, Math.PI / 2, 0.24, 3.0, seed);        // primary caustic
      const slow = striate(wx, wy, Math.PI / 2 + 0.08, 0.08, 4.5, seed + 17); // slow swell
      const c = fast * 0.6 + slow * 0.4;
      idx = c > 0.55 ? 1 : 2;                   // teal shallows / tealDeep depths
      if (c < 0.22) idx = 3;                    // indigo deep troughs
      // sparse bright ripple crest where the fast caustic peaks
      if (fast > 0.86 && h2(Math.floor(wx), Math.floor(wy), seed + 31) > 0.55) idx = 0;
      break;
    }

    // lava ["atbGold","amber","hpRed","rust"]
    // STRUCTURE: cracked molten cells. worley cells are cooling pools (tone by
    // cell); cell EDGES (f2-f1 ~ 0) glow bright gold — a cracked-magma look.
    case "lava": {
      const w = worley(wx, wy, 0.12, seed);
      const edge = w.f2 - w.f1;
      if (edge < 0.07) {
        idx = 0;                                // atbGold molten crack glowing at seams
      } else {
        const tone = cellTone(w.cell, seed);    // per-pool temperature
        idx = tone < 0.35 ? 3 : tone < 0.70 ? 2 : 1; // rust crust / hpRed / amber pool
        // a hot core near each pool centre (small f1) stays bright amber/gold
        if (w.f1 < 0.30 && tone > 0.5) idx = 1;
      }
      break;
    }

    // groveMoss ["jade","teal","umber","ink"]
    // STRUCTURE: clumpy organic moss patches — domain-warped low-freq field
    // thresholded into irregular jade clumps over teal, umber soil in the gaps.
    case "groveMoss": {
      const [x2, y2] = warp(wx, wy, 7, seed);
      const m = worldNoise(x2, y2, 0.07, seed + 3) * 0.7
              + worldNoise(x2, y2, 0.15, seed + 5) * 0.3; // big warped clumps
      if (m > 0.58) idx = 0;                    // jade moss clump
      else if (m > 0.44) idx = 1;               // teal understory
      else if (m > 0.30) idx = 2;               // umber soil showing through gaps
      else idx = 3;                             // ink — deepest gap shadow
      break;
    }

    // ice ["white","skyBlue","slate","indigo"]
    // STRUCTURE: crystalline facets — each worley cell a flat facet with a
    // slight per-cell tone shift, hairline seams where f2-f1 is tiny (this is
    // also how ice gets its cracks back, non-tiling).
    case "ice": {
      const w = worley(wx, wy, 0.10, seed);
      const edge = w.f2 - w.f1;
      if (edge < 0.035) {
        idx = 3;                                // indigo hairline crack seam
      } else if (edge < 0.09) {
        idx = 2;                                // slate — soft facet-boundary bevel
      } else {
        const tone = cellTone(w.cell, seed);    // flat per-facet shade
        idx = tone > 0.72 ? 1 : 0;              // skyBlue tinted facet / white facet
      }
      break;
    }

    // groveSoil ["clay","umber","stoneDeep","ink"]
    // STRUCTURE: granular clumped earth — warped, higher-freq worley grains
    // gather into gritty clumps (light clay flecks + dark stone grit) rather
    // than uniform single-pixel speckle.
    case "groveSoil": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.40, seed);      // fine grain cells
      const cluster = worldNoise(wx, wy, 0.06, seed + 11); // where grit gathers
      const tone = cellTone(w.cell, seed);
      idx = 1;                                    // umber earth body
      if (tone > 0.68) idx = 0;                   // clay light grain
      else if (tone < 0.30) idx = 2;              // stoneDeep dark grit
      // dark grit concentrates in low-cluster hollows; edges deepen to ink
      if (cluster < 0.40 && w.f2 - w.f1 < 0.08) idx = 3;
      break;
    }

    default: {
      const _never: never = key;
      throw new Error(`protoFill: unsupported key ${_never as string}`);
    }
  }

  return ramp[clampIdx(idx, ramp.length)];
}
