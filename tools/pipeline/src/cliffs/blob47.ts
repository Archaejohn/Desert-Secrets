/**
 * 47-blob canonical autotile masks + overlay geometry, ported VERBATIM from
 * docs/prototypes/cliff-suite-v6.html:639-684 (`canonical`, the BLOB
 * canonical-set IIFE, `overlayMask`).
 *
 * ## 8-neighbor mask convention
 *
 * A mask is an 8-bit bitmask over the compass directions around a tile:
 *
 * ```
 *   128   1    2      NW  N  NE
 *    64  (x)   4  ==   W (x)  E
 *    32  16    8      SW  S  SE
 * ```
 *
 * N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128. A set bit means the
 * neighbor in that direction is the *same* terrain (i.e. also "over"
 * terrain, not base). This convention is self-contained to the 47-blob
 * autotiler and is unrelated to the pipeline's separate 4-bit
 * `roundedMask` (used elsewhere for simple rounded-corner autotiles).
 *
 * ## Why 256 masks reduce to 47
 *
 * A diagonal neighbor bit (NE/SE/SW/NW) only matters visually when *both*
 * adjacent cardinal neighbors are also set — a lone diagonal with no
 * flanking cardinals can't be distinguished from the diagonal being unset,
 * since there's no tile edge for it to affect. `canonical()` clears any
 * diagonal bit whose flanking cardinal pair isn't both set, collapsing the
 * 256 raw masks down to the 47 that are visually distinct.
 */
import { n1 } from "./noise";

const T = 16;

/**
 * Clear diagonal bits that aren't flanked by both adjacent cardinal bits
 * (e.g. NE only matters if both N and E are set). Idempotent.
 */
export function canonical(m: number): number {
  const N = !!(m & 1), E = !!(m & 4), S = !!(m & 16), W = !!(m & 64);
  if (!(N && E)) m &= ~2;
  if (!(E && S)) m &= ~8;
  if (!(S && W)) m &= ~32;
  if (!(W && N)) m &= ~128;
  return m;
}

/**
 * The 47 canonical masks, in the prototype's sort order: mask 255 (fully
 * interior) first, then ascending numeric order.
 */
export const CANONICAL_MASKS: number[] = (function () {
  const seen = new Set<number>();
  const all: number[] = [];
  for (let m = 0; m < 256; m++) {
    const c = canonical(m);
    if (!seen.has(c)) {
      seen.add(c);
      all.push(c);
    }
  }
  all.sort((a, b) => (b === 255 ? 1 : 0) - (a === 255 ? 1 : 0) || a - b);
  return all;
})();

/** mask -> position within CANONICAL_MASKS. */
export const BLOB_INDEX: Map<number, number> = new Map(
  CANONICAL_MASKS.map((c, i) => [c, i])
);

/**
 * Renders a 16x16 blob overlay mask (1 = over-terrain, 0 = base terrain)
 * for the given neighbor `mask`, using `inset` (base retreat distance in
 * px), `irreg` (0-20 wobble amplitude knob), `round` (corner rounding
 * radius), and `seed`.
 *
 * Ported verbatim from the prototype except that `seed` is an explicit
 * trailing parameter here rather than a closed-over module global.
 */
export function overlayMask(
  mask: number,
  inset: number,
  irreg: number,
  round: number,
  seed: number
): Uint8Array {
  const m = new Uint8Array(T * T), amp = irreg / 10;
  const N = !!(mask & 1), NE = !!(mask & 2), E = !!(mask & 4), SE = !!(mask & 8),
        S = !!(mask & 16), SW = !!(mask & 32), W = !!(mask & 64), NW = !!(mask & 128);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const qx = x < 8 ? 0 : 1, qy = y < 8 ? 0 : 1;
    const sH = qx === 0 ? W : E, sV = qy === 0 ? N : S;
    const dg = qx === 0 ? (qy === 0 ? NW : SW) : (qy === 0 ? NE : SE);
    const lx = qx === 0 ? x : T - 1 - x, ly = qy === 0 ? y : T - 1 - y;
    // the edge wobble tapers to zero approaching a tile corner, so every tile that
    // meets at that corner agrees on exactly how wide the base band is there
    const tapV = Math.min(1, Math.min(x, T - 1 - x) / 4);
    const tapH = Math.min(1, Math.min(y, T - 1 - y) / 4);
    const needV = sV ? -99 : inset + (n1(x, seed + 3) - 0.5) * 2 * amp * tapV;
    const needH = sH ? -99 : inset + (n1(y, seed + 9) - 0.5) * 2 * amp * tapH;
    let on = (ly >= needV) && (lx >= needH);
    // convex (outer) corner — quarter-circle arc rather than a 45-degree chamfer
    if (on && !sH && !sV && round > 0) {
      const ax = lx - needH, ay = ly - needV;
      if (ax < round && ay < round) on = (ax * ax + ay * ay) >= round * round;
    }
    // concave (inner) corner — pocket of base terrain. Its depth at each seam MUST be
    // exactly `inset`, because the three tiles sharing this corner each draw a quarter
    // of it; anything else (or any noise here) leaves the spike. `round` only controls
    // how square vs round the pocket is, never how deep.
    if (on && sH && sV && !dg && inset > 0) {
      const p = 2 + (5 - Math.min(5, round)) * 1.6;
      if (Math.pow(lx / inset, p) + Math.pow(ly / inset, p) < 1) on = false;
    }
    m[y * T + x] = on ? 1 : 0;
  }
  return m;
}
