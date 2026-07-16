/**
 * lakeShore — a mask-based rounded-corner sand↔water autotile (v22 rework,
 * docs/CONTRACTS.md "v22"): replaces the old 12-tile `coast*` set
 * (`makeEdgeSet(sandRef, water(0), {style:"surf", ...})`, straight edges +
 * outer/inner corners only) after it was reported to read as "a concrete
 * barrier effective for a small dock, not a lake beach" once the lake
 * stopped being a hand-drawn rectangle/ellipse — a 4-piece straight-edge
 * set literally cannot round to an organic shoreline.
 *
 * The project owner's own fix: "the sand water transition should use the
 * same type of 16 tile set that the mountains use but with sand and
 * water." This is exactly that — the SAME geometry as `owMountains.ts`
 * (`roundedMaskDist`, ported to `roundedMask.ts` for this reuse), same 4-bit
 * N/E/S/W neighbor-mask convention (bit0=N=1, bit1=E=2, bit2=S=4, bit3=W=8,
 * a set bit meaning "the neighbor on that side is the SAME material"), same
 * ring-band structure (`fuzzyDist<1`/`<2`/`<4`/else). The one semantic
 * flip from owMountains: a lakeShore tile is placed on a WATER cell (mask =
 * which sides are ALSO water), not a land cell — the mask-owning "solid"
 * material is water here, sand is what a set bit's absence rounds toward,
 * exactly mirroring "mask-owning material = mountain, sand is what an
 * unset bit rounds toward" in owMountains. `overworldMap.ts`'s lake-shore
 * pass (`applyOverworldAutotile` step 4) places these on every non-deep
 * water cell of every water body (the lake AND the wash pool — the project
 * owner: no reason to keep two different shore-tile mechanisms).
 *
 * Only one texture family (no owMountains-style 5 variants): water tiles
 * are already visually simple (the plain `water`/`water2` 2-phase dash
 * pair), and this is one lake plus one small pool, not a sprawling
 * repeated landscape texture the way the mountain range is — variant
 * multiplication would be pure unused surface area. `overworldMap.ts`
 * deliberately leaves mask-15 (fully water-surrounded) cells as the
 * existing plain alternating `water`/`water2` ground rather than
 * `lakeShore15`: a big lake's interior tiling the SAME single frame
 * (`lakeShore15` samples water(0) only, uninterrupted at every deep-water
 * pixel since dist stays ≥4 across the whole tile) would read flatter than
 * the established two-phase dash offset, so the two systems are blended —
 * shoreline cells (mask 0..14) get the new rounded treatment, deep
 * interior keeps the existing look.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { DEFAULT_ROUNDED_CURVE_RADIUS, roundedMaskDist } from "./roundedMask";
import { sandBase, water, TILE_SIZE } from "./tileset";
import type { PaletteName } from "../../../src/shared/palette";

export const LAKE_SHORE_CURVE_RADIUS = DEFAULT_ROUNDED_CURVE_RADIUS;
/** 4-bit neighbor mask: 16 combinations (N=1, E=2, S=4, W=8) — same
 *  convention as owMountains/`assignMountainTileNames`/the road autotile. */
export const LAKE_SHORE_MASK_COUNT = 16;

/** Frame-index contract: `lakeShoreNames[i]` always matches
 *  `lakeShoreFrames()[i]`, mask-only (no variant dimension — see module
 *  doc), append-only within the tiles2.png sheet it's folded into. */
export const lakeShoreNames: string[] = (() => {
  const names: string[] = [];
  for (let mask = 0; mask < LAKE_SHORE_MASK_COUNT; mask++) names.push(`lakeShore${mask}`);
  return names;
})();

/**
 * One rounded-mask lakeshore tile (16x16, fully opaque). `seed` drives the
 * fuzzy-edge ring noise (ported verbatim from owMountains' own +/-0.75
 * uniform jitter) plus which of two colours a ring pixel picks; the edge
 * geometry itself is the pure function of `mask` shared with owMountains.
 * `sandRef`/`waterGrid` are passed in (not regenerated per tile) so every
 * mask's sand ring and deep-water fill sample the exact same underlying
 * art and seam perfectly against plain `sand`/`water` ground tiles.
 */
function generateLakeShoreTile(
  mask: number,
  sandRef: PixelGrid,
  waterGrid: PixelGrid,
  seed: number
): PixelGrid {
  const g = new PixelGrid(TILE_SIZE, TILE_SIZE);
  const rng = mulberry32(seed);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const dist = roundedMaskDist(mask, x, y, LAKE_SHORE_CURVE_RADIUS);
      const fuzzyDist = dist + (rng() * 1.5 - 0.75);

      let c: PaletteName;
      if (fuzzyDist < 1) {
        // Wet-sand edge: mostly the shared sand art (so the tile continues
        // any neighbouring plain-sand tile's own texture), with the odd
        // bone fleck of foam right at the waterline.
        c = rng() < 0.2 ? "bone" : ((sandRef.get(x, y) as PaletteName | null) ?? "sand");
      } else if (fuzzyDist < 2) {
        // Broken surf fringe — foam over shallow water, not a ruler line.
        c = rng() < 0.5 ? "bone" : "skyBlue";
      } else if (fuzzyDist < 4) {
        // Shallow water band.
        c = rng() < 0.5 ? "skyBlue" : "slate";
      } else {
        // Deep water: sampled straight from the real water tile art so a
        // shoreline tile's interior seams into an adjacent plain water
        // cell exactly.
        c = (waterGrid.get(x, y) as PaletteName | null) ?? "indigo";
      }
      g.px(x, y, c);
    }
  }
  return g;
}

/** All 16 tiles in `lakeShoreNames` order. */
export function lakeShoreFrames(): PixelGrid[] {
  const sandRef = sandBase(1); // identical seed to tileset2.ts's own sandRef — perfect seams
  const waterGrid = water(0);
  const frames: PixelGrid[] = [];
  for (let mask = 0; mask < LAKE_SHORE_MASK_COUNT; mask++) {
    frames.push(generateLakeShoreTile(mask, sandRef, waterGrid, 6000 + mask * 37));
  }
  return frames;
}
