/**
 * World-position ground texture PRIMITIVES — production kit.
 *
 * A small set of deterministic, non-wrapping, palette-agnostic pattern
 * generators used by `fills.ts` to give each of the 19 grounds its own texture
 * STRUCTURE (cellular facets, ripple/wave bands, flowing currents, warped
 * clumps, ridged crack networks) instead of one shared fbm-mottle+fleck recipe.
 *
 * Promoted from the owner-approved `textureProto.ts` prototype; the six tuned
 * exemplars (sand, reefWater, lava, groveMoss, ice, groveSoil) validated these
 * signatures/behaviour before promotion.
 *
 * Hard rules (identical to the rest of the pipeline):
 *  - World-position + non-repeating: sample absolute world coords; never a
 *    16px period. Built only on `h2` and the worldNoise helpers.
 *  - Deterministic: pure functions of world coords + seed via h2 / world-noise.
 *    No Math.random, no Date.
 *  - Palette selection happens in `fills.ts` (these primitives return scalars /
 *    cell ids only, so they stay palette-agnostic).
 */
import { h2 } from "../cliffs/noise";
import { worldNoise, worldFbm } from "./worldNoise";

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
 *  - `cell`    → per-cell tone (hash it with `cellTone`): molten pools, ice facets.
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
 * flowing shapes (used for moss clumps, flowing lava, and clumped grain).
 */
export function warp(wx: number, wy: number, amp: number, s: number): [number, number] {
  const ox = (worldFbm(wx, wy, s) - 0.5) * amp;
  const oy = (worldFbm(wx, wy, s + 53) - 0.5) * amp;
  return [wx + ox, wy + oy];
}
