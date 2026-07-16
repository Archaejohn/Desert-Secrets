/**
 * Shared per-quadrant rounded-corner distance field for a 4-bit N/E/S/W
 * neighbor mask (bit0=N=1, bit1=E=2, bit2=S=4, bit3=W=8 — the mask
 * convention every autotile in this pipeline shares: owMountains.png,
 * lakeShore's sand↔water tileset, and overworldMap.ts's own mountain/
 * road/lake-shore mask passes).
 *
 * Originally written as `owMountains.ts`'s `mountainDistToGrass` (see that
 * module's doc comment for the full derivation history — ported from a
 * reference React/canvas demo, `curveRadius` deliberately larger than the
 * tile's own half-width). Extracted here, unchanged, so any "blob with
 * organically-rounded corners" tileset can reuse the exact same geometry
 * instead of re-deriving it — first reused for docs/CONTRACTS.md "v22"'s
 * lakeShore tileset. `owMountains.ts` re-exports `mountainDistToGrass` as a
 * thin wrapper around this for backward compatibility (existing tests
 * import it by that name).
 */

/**
 * Pure per-pixel geometry: within each 8x8 quadrant of a 16x16 tile, an
 * exposed corner (both adjacent sides open) rounds via `curveRadius -
 * hypot(...)` to a point outside the tile, an exposed single side clips
 * straight to the distance from that edge, and a fully-blocked corner
 * (both adjacent sides "present" per the mask) stays at the sentinel 999
 * (deep interior, never near an edge). No RNG involved — callers add their
 * own fuzzy-edge noise on top of this.
 */
export function roundedMaskDist(
  mask: number,
  x: number,
  y: number,
  curveRadius: number
): number {
  const hasN = (mask & 1) !== 0;
  const hasE = (mask & 2) !== 0;
  const hasS = (mask & 4) !== 0;
  const hasW = (mask & 8) !== 0;
  const C = curveRadius;

  let dist = 999;
  if (x < 8 && y < 8) {
    // top-left quadrant
    if (!hasN && !hasW) dist = C - Math.hypot(C - x, C - y);
    else if (!hasN) dist = y;
    else if (!hasW) dist = x;
  } else if (x >= 8 && y < 8) {
    // top-right quadrant
    if (!hasN && !hasE) dist = C - Math.hypot(x - (15 - C), C - y);
    else if (!hasN) dist = y;
    else if (!hasE) dist = 15 - x;
  } else if (x < 8 && y >= 8) {
    // bottom-left quadrant
    if (!hasS && !hasW) dist = C - Math.hypot(C - x, y - (15 - C));
    else if (!hasS) dist = 15 - y;
    else if (!hasW) dist = x;
  } else {
    // bottom-right quadrant
    if (!hasS && !hasE) dist = C - Math.hypot(x - (15 - C), y - (15 - C));
    else if (!hasS) dist = 15 - y;
    else if (!hasE) dist = 15 - x;
  }
  return dist;
}

/** Deliberately > the tile's own half-width (8px) — see module doc. Shared
 *  default so every consumer (owMountains, lakeShore) draws from the same
 *  tuned visual language unless it has a specific reason not to. */
export const DEFAULT_ROUNDED_CURVE_RADIUS = 16.5;
