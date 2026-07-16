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
 * - else (deep interior/peak): sampled from a precomputed per-variant
 *   "peak grid" (`generatePeakGrid`, below) — a real triangular ridge
 *   silhouette adapted from the proven `tileset2.ts` `mountainRidge`
 *   recipe (irregular apex, zigzag crest, lit NW flank / shaded SE flank
 *   split by distance from the apex, sunlit apex cap, broken foot line,
 *   sparse crag clusters), NOT a flat `x+y` diagonal split. A flat
 *   corner-to-corner split was tried first and was wrong: it is identical
 *   on every mask=15 (fully-surrounded) tile regardless of variant or
 *   position, and mask=15 dominates any solid mountain mass by tile count,
 *   so the whole mass rendered as one repeating "hash mark" pattern
 *   instead of peaks — the actual bug reported after the first ship. The
 *   peak grid is computed ONCE per variant (not per mask) and sampled by
 *   (x, y) wherever a pixel falls in the deep-interior band; masks differ
 *   only in how much of the ring erodes into that shared peak texture.
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

/**
 * One distinct triangular-peak apex/shape configuration per variant family
 * (5 entries, matching `MOUNTAIN_VARIANT_COUNT`). Apex x/y spread across the
 * tile so the five families read as genuinely different peak positions and
 * heights, not just fleck noise — the earlier bug's other half: even after
 * fixing the flat-diagonal interior, if every variant's peak sat in the
 * same spot the families would still look interchangeable. `shoulder`
 * mirrors `mountainRidge`'s lower secondary peak for some variants (a
 * ridge, not a single lonely spike).
 */
const PEAK_CONFIGS: ReadonlyArray<{ ax: number; ay: number; shoulder: boolean }> = [
  { ax: 4, ay: 1, shoulder: true },
  { ax: 10, ay: 3, shoulder: false },
  { ax: 6, ay: 0, shoulder: true },
  { ax: 12, ay: 2, shoulder: false },
  { ax: 2, ay: 3, shoulder: true }
];

/**
 * A real triangular ridge silhouette for one variant family, full 16x16,
 * ignoring mask/ring concerns entirely (those are layered on top by the
 * caller via `mountainDistToGrass`). Adapted from `tileset2.ts`'s proven
 * `mountainRidge`: an irregular apex (optionally with a lower shoulder
 * peak), a zigzag crest line, a lit NW flank left of the apex, a shaded SE
 * flank right of it, a sunlit apex cap, a broken darkened foot line, and
 * sparse seeded crag clusters. Computed once per variant and sampled by
 * (x, y) for every mask that shares the family, so the family's interior
 * "identity" (peak shape) stays consistent while only the outer rounding
 * rings vary per mask.
 */
function generatePeakGrid(variant: number): PixelGrid {
  const { ax, ay, shoulder } = PEAK_CONFIGS[variant];
  const g = new PixelGrid(TILE_SIZE, TILE_SIZE);
  const peaks = [{ ax, ay }];
  if (shoulder) peaks.push({ ax: (ax + 8) % TILE_SIZE, ay: ay + 4 });

  for (let x = 0; x < TILE_SIZE; x++) {
    let crestY = 99;
    let owner = peaks[0];
    for (const p of peaks) {
      const y = p.ay + Math.abs(x - p.ax);
      if (y < crestY) {
        crestY = y;
        owner = p;
      }
    }
    for (let y = 0; y < TILE_SIZE; y++) {
      if (y < crestY) {
        // Above this column's crest: background shadow mass (fills the
        // corners the ridge silhouette doesn't reach).
        g.px(x, y, "plum");
        continue;
      }
      const dc = y - crestY;
      let c: PaletteName;
      if (dc === 0) {
        c = ((x + y) & 2) === 0 ? "umber" : "plum"; // zigzag crest (G6 structural line)
      } else if (x <= owner.ax) {
        c = dc <= 3 ? "sand" : "clay"; // lit NW flank
      } else {
        c = dc <= 4 ? "rust" : "plum"; // shaded SE flank
      }
      if (y === TILE_SIZE - 1 && (x + variant * 3) % 8 < 6) c = "umber"; // broken foot shadow
      g.px(x, y, c);
    }
  }
  for (const p of peaks) {
    if (p.ay >= 0 && p.ay < TILE_SIZE) {
      g.px(p.ax, p.ay, "sandLight"); // sunlit apex cap
      if (p.ay + 1 < TILE_SIZE && p.ax - 1 >= 0) g.px(p.ax - 1, p.ay + 1, "sandLight");
    }
  }
  // Sparse seeded crag clusters on the faces (G5) — deterministic per variant.
  const rng = mulberry32(7000 + variant * 53);
  let placed = 0;
  for (let i = 0; i < 12 && placed < 3; i++) {
    const cx = 1 + Math.floor(rng() * (TILE_SIZE - 3));
    const cy = 4 + Math.floor(rng() * (TILE_SIZE - 6));
    const c = g.get(cx, cy);
    if (c === "clay" && g.get(cx + 1, cy + 1) === "clay") {
      g.rect(cx, cy, 2, 2, "rust");
      placed++;
    } else if (c === "rust" && g.get(cx + 1, cy + 1) === "rust") {
      g.rect(cx, cy, 2, 2, "plum");
      placed++;
    }
  }
  return g;
}

/** One rounded-mask mountain tile (16x16, fully opaque). `seed` drives only
 *  the fuzzy-edge ring noise; the edge geometry is a pure function of
 *  `mask`, and the deep-interior colour is sampled from `peakGrid` (that
 *  variant's precomputed peak silhouette). */
function generateMountainTile(mask: number, peakGrid: PixelGrid, seed: number): PixelGrid {
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
        c = (peakGrid.get(x, y) as PaletteName | null) ?? "plum";
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
    const peakGrid = generatePeakGrid(variant);
    for (let mask = 0; mask < MOUNTAIN_MASK_COUNT; mask++) {
      const seed = VARIANT_SEED_BASES[variant] + mask * 31;
      frames.push(generateMountainTile(mask, peakGrid, seed));
    }
  }
  return frames;
}
