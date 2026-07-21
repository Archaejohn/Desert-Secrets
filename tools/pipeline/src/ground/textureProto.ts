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
    // STRUCTURE: fine near-horizontal wind ripples. LOW-CONTRAST tune: the
    // bulk stays within the two ADJACENT mids (sand ↔ sandShade); sandLight
    // crests and umber deep-grain are RARE, sparse accents only.
    case "sand": {
      const r = striate(wx, wy, Math.PI / 2 + 0.12, 0.16, 2.2, seed);   // near-horizontal
      const r2 = striate(wx, wy, Math.PI / 2 - 0.05, 0.42, 1.4, seed + 9); // fine detail
      const band = r * 0.7 + r2 * 0.3;
      idx = band >= 0.5 ? 1 : 2;                // bulk: sand ↔ sandShade
      if (band > 0.91) idx = 0;                 // rare light ripple crest
      else if (band < 0.10) idx = 3;            // rare deep grain in trough shadow
      break;
    }

    // reefWater ["skyBlue","teal","tealDeep","indigo"]
    // STRUCTURE: horizontal caustic wave bands. LOW-CONTRAST tune: bulk stays
    // teal ↔ tealDeep (adjacent); indigo deep troughs and bright skyBlue
    // crests are rare, sparse accents.
    case "reefWater": {
      const fast = striate(wx, wy, Math.PI / 2, 0.24, 3.0, seed);        // primary caustic
      const slow = striate(wx, wy, Math.PI / 2 + 0.08, 0.08, 4.5, seed + 17); // slow swell
      const c = fast * 0.6 + slow * 0.4;
      idx = c > 0.5 ? 1 : 2;                     // bulk: teal ↔ tealDeep
      if (c < 0.12) idx = 3;                     // rare indigo deep trough
      // rare bright ripple crest only where the fast caustic strongly peaks
      if (fast > 0.93 && h2(Math.floor(wx), Math.floor(wy), seed + 31) > 0.72) idx = 0;
      break;
    }

    // lava ["atbGold","amber","hpRed","rust"]
    // STRUCTURE: cracked molten cells. LOW-CONTRAST tune: bulk is the cooled
    // crust (hpRed ↔ rust, adjacent); seams mostly glow the DIMMER amber, with
    // only the thinnest/rarest seams flaring bright atbGold — occasional, not
    // every cell edge.
    case "lava": {
      const w = worley(wx, wy, 0.12, seed);
      const edge = w.f2 - w.f1;
      if (edge < 0.05) {                        // a cell seam
        // dim amber glow along seams; only the very thinnest seams, sparsely
        // gated, flare bright gold
        idx = (edge < 0.02 && h2(w.cell & 0xffff, w.cell >>> 16, seed + 41) > 0.8) ? 0 : 1;
      } else {
        const tone = cellTone(w.cell, seed);    // per-pool temperature
        idx = tone < 0.5 ? 3 : 2;               // bulk: rust ↔ hpRed cooled crust
      }
      break;
    }

    // groveMoss ["jade","teal","umber","ink"]
    // STRUCTURE: clumpy organic moss patches. LOW-CONTRAST tune: bulk is
    // teal ↔ umber (adjacent) — mossy green over soil; bright jade clump
    // highlights and ink shadows are rare accents. Softer clump edges.
    case "groveMoss": {
      const [x2, y2] = warp(wx, wy, 7, seed);
      const m = worldNoise(x2, y2, 0.07, seed + 3) * 0.7
              + worldNoise(x2, y2, 0.15, seed + 5) * 0.3; // big warped clumps
      idx = m > 0.5 ? 1 : 2;                     // bulk: teal moss ↔ umber soil
      if (m > 0.80) idx = 0;                     // rare bright jade clump crown
      else if (m < 0.18) idx = 3;               // rare ink deep-gap shadow
      break;
    }

    // ice ["white","skyBlue","slate","indigo"]
    // STRUCTURE: crystalline facets. LOW-CONTRAST tune: bulk is white ↔
    // skyBlue (adjacent) with a SMALL per-facet tone shift; seams are faint
    // (mostly slate) and only the thinnest hairlines darken to a rare indigo.
    case "ice": {
      const w = worley(wx, wy, 0.10, seed);
      const edge = w.f2 - w.f1;
      if (edge < 0.02) {
        idx = 3;                                // rare indigo hairline crack
      } else if (edge < 0.05) {
        idx = 2;                                // faint slate facet-boundary bevel
      } else {
        const tone = cellTone(w.cell, seed);    // subtle flat per-facet shade
        idx = tone > 0.6 ? 1 : 0;               // skyBlue-tinted facet / white facet
      }
      break;
    }

    // groveSoil ["clay","umber","stoneDeep","ink"]
    // STRUCTURE: granular clumped earth. LOW-CONTRAST tune: bulk is umber ↔
    // stoneDeep (adjacent) gritty earth; light clay grains and ink hollows are
    // rare, sparse accents.
    case "groveSoil": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.40, seed);      // fine grain cells
      const cluster = worldNoise(wx, wy, 0.06, seed + 11); // where grit gathers
      const tone = cellTone(w.cell, seed);
      idx = tone < 0.45 ? 2 : 1;                 // bulk: stoneDeep grit ↔ umber earth
      if (tone > 0.89) idx = 0;                  // rare clay light grain
      // ink only in the deepest hollows right on a grain seam
      if (cluster < 0.30 && w.f2 - w.f1 < 0.05) idx = 3;
      break;
    }

    default: {
      const _never: never = key;
      throw new Error(`protoFill: unsupported key ${_never as string}`);
    }
  }

  return ramp[clampIdx(idx, ramp.length)];
}
