/**
 * owMountains.png — mask-based rounded-corner overworld mountain autotile
 * (2.5D upgrade follow-up, docs/ART_DIRECTION.md §4a; docs/CONTRACTS.md
 * "owMountains"). Replaces the old per-cell content-hash pick among eight
 * neighbor-blind `mountain1..8` ridge tiles (`tileset2.ts`, still present
 * and untouched for the flat-tilemap fallback/legacy use) with a proper
 * 4-bit-neighbor-mask blob autotile, so contiguous mountain masses round
 * their boundary against sand instead of showing hard square/stair-step
 * edges.
 *
 * Ported from a reference React/canvas demo the user built to tune the
 * geometry (a per-quadrant Euclidean-distance-to-mask-edge field, "rounded
 * corner where both adjacent sides are open, straight edge where only one
 * is, deep interior where both are blocked"). The geometry/math/constants
 * are ported EXACTLY, including the deliberately large
 * `MOUNTAIN_CURVE_RADIUS = 16.5` (bigger than the tile's own half-width of
 * 8px) — at that radius the corner arc reads as a gentle chamfer rather
 * than a round bump. This is intentional per the reference and is not
 * "fixed" here.
 *
 * Neighbor mask bit convention (must match `overworldMap.ts`'s mask
 * computation exactly): bit0 = N (1), bit1 = E (2), bit2 = S (4), bit3 = W
 * (8). A set bit means "the neighbor on that side is also mountain" (i.e.
 * this tile's edge on that side is interior, not exposed to sand).
 *
 * Colour bands replace the reference demo's own throwaway palette/isotropic
 * banding with ours:
 * - fuzzyDist < 1 (outermost ring): `sand`/`sandLight` transition into sand
 *   (mostly `sand`, occasional `sandLight` fleck).
 * - fuzzyDist < 2: a dusty transition ring in `amber`/`sand` — NOT green
 *   scrub; this is an all-mineral desert (CLAUDE.md / ART_DIRECTION.md).
 * - fuzzyDist < 4: `clay` foothill ring.
 * - else (deep interior/peak): NOT the reference's isotropic diagonal wave
 *   banding (reads flat/directionless). Instead, the FF6 3/4-view rule
 *   (ART_DIRECTION.md §1 G1/G4, and the mountain recipe in §4a /
 *   `tileset2.ts`'s `mountainRidge`) drives a lit NW flank (`sand`/`clay`)
 *   vs a shaded SE flank (`rust`/`plum`, ~half the interior mass), split by
 *   ABSOLUTE tile-local position (is this pixel closer to the tile's NW
 *   corner or SE corner along the `x + y` diagonal) — not by the mask — so
 *   light direction stays globally consistent across every tile regardless
 *   of its mask. The reference's `(x + y) % 8` wave is repurposed only to
 *   add a crest-line zigzag texture within each flank (never to decide
 *   lit-vs-shadow). Rare `ink` crag flecks (~5%, matching the reference
 *   rate) finish the interior.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { TILE_SIZE } from "./tileset";
import type { PaletteName } from "../../../src/shared/palette";

/** Deliberately > the tile's own half-width (8px) — see module doc. Ported
 *  verbatim from the reference demo's tuned value. */
export const MOUNTAIN_CURVE_RADIUS = 16.5;

/** Five texture families for variety; one fixed seed base per family
 *  (deterministic constants, no Math.random/Date). */
const VARIANT_SEED_BASES = [1000, 2000, 3000, 4000, 5000] as const;
export const MOUNTAIN_VARIANT_COUNT = VARIANT_SEED_BASES.length;
/** 4-bit neighbor mask: 16 combinations (N=1, E=2, S=4, W=8). */
export const MOUNTAIN_MASK_COUNT = 16;

/**
 * Pure per-pixel geometry: the reference demo's "distToGrass" field for a
 * given neighbor mask, before the fuzzy-edge RNG noise is added. Exported
 * (no RNG involved) so tests can evaluate the exact rounding math directly
 * instead of inferring it from generated pixel colours.
 *
 * Ported verbatim from the reference `generateRoundedTile`'s per-quadrant
 * branch structure: TILE_SIZE=16 splits into four 8x8 quadrants; within
 * each quadrant, an exposed corner (both adjacent sides open) rounds via
 * `curveRadius - hypot(...)` to a point outside the tile, an exposed single
 * side clips straight to the distance from that edge, and a fully-blocked
 * corner (both adjacent sides mountain) stays at the sentinel 999 (deep
 * interior, never near an edge).
 */
export function mountainDistToGrass(
  mask: number,
  x: number,
  y: number,
  curveRadius: number = MOUNTAIN_CURVE_RADIUS
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

/** One rounded-mask mountain tile (16x16, fully opaque). `seed` drives the
 *  fuzzy-edge noise and the interior crag/fleck texture only — the edge
 *  geometry itself is pure function of `mask`. */
function generateMountainTile(mask: number, seed: number): PixelGrid {
  const g = new PixelGrid(TILE_SIZE, TILE_SIZE);
  const rng = mulberry32(seed);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const dist = mountainDistToGrass(mask, x, y);
      // Organic fuzzy edge (ported verbatim: +/- 0.75 uniform noise).
      const fuzzyDist = dist + (rng() * 1.5 - 0.75);

      let c: PaletteName;
      if (fuzzyDist < 1) {
        c = rng() < 0.2 ? "sandLight" : "sand";
      } else if (fuzzyDist < 2) {
        // Dusty transition ring — no green scrub in an all-mineral desert.
        c = rng() < 0.5 ? "amber" : "sand";
      } else if (fuzzyDist < 4) {
        c = "clay";
      } else {
        // Deep interior/peak: FF6 lit-NW / shaded-SE flanks, anchored to
        // ABSOLUTE tile-local position (not the mask) so light direction is
        // globally consistent. The old isotropic (x+y)%8 wave is kept only
        // as a crest-line zigzag texture WITHIN each flank.
        const wave = Math.abs((((x + y) % 8) + 8) % 8 - 4);
        if (x + y <= 15) {
          c = wave < 2 ? "sand" : "clay"; // lit NW flank
        } else {
          c = wave < 2 ? "rust" : "plum"; // shaded SE flank
        }
        if (rng() < 0.05) c = "ink"; // sparse crag fleck
      }
      g.px(x, y, c);
    }
  }
  return g;
}

/**
 * Frame-index contract (exact, append-only): variant-major, mask-minor —
 * variant 0 masks 0..15, then variant 1 masks 0..15, ... variant 4 masks
 * 0..15. 5 variants x 16 masks = 80 frames total. `owMountainNames[i]`
 * always matches `owMountainFrames()[i]`.
 */
export const owMountainNames: string[] = (() => {
  const names: string[] = [];
  for (let variant = 0; variant < MOUNTAIN_VARIANT_COUNT; variant++) {
    for (let mask = 0; mask < MOUNTAIN_MASK_COUNT; mask++) {
      names.push(`owMountain${variant}_${mask}`);
    }
  }
  return names;
})();

/** All 80 tiles in `owMountainNames` order (variant-major, mask-minor). */
export function owMountainFrames(): PixelGrid[] {
  const frames: PixelGrid[] = [];
  for (let variant = 0; variant < MOUNTAIN_VARIANT_COUNT; variant++) {
    for (let mask = 0; mask < MOUNTAIN_MASK_COUNT; mask++) {
      const seed = VARIANT_SEED_BASES[variant] + mask * 31;
      frames.push(generateMountainTile(mask, seed));
    }
  }
  return frames;
}
