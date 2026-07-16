/**
 * polish.ts — shared sprite finishing techniques for the 2.5D art upgrade
 * (docs/ART_DIRECTION.md §6, G1/G2/G8).
 *
 * - `selOut` replaces the blanket `grid.outline("ink")`: the contour is drawn
 *   in the darkest ramp value of the material it wraps (sel-out), with pure
 *   `ink` reserved for bottom contact edges (feet / undersides) so sprites
 *   still sit firmly on the ground.
 * - `rimTopLeft` lays a 1px rim highlight along the upper-left silhouette arc
 *   of a region (a head, a shell crown) — the NNW key light catching the form.
 *
 * Both are pure grid transforms: deterministic, palette-locked, and silhouette
 * -preserving (selOut fills exactly the cells outline() would, rimTopLeft only
 * recolours existing body cells), so frame grids and motion stay contract-
 * identical.
 */
import type { PaletteName } from "../../../../src/shared/palette";
import { PixelGrid } from "../grid";

/**
 * Darkest ramp value per material (ART_DIRECTION §3 ramps): what a sel-out
 * contour uses instead of ink. Warm materials contour in umber, vegetation in
 * tealDeep, water/ice in indigo; the darks contour in the next dark down.
 */
export const contourOf: Record<PaletteName, PaletteName> = {
  // warm/terrain ramp
  bone: "umber",
  sandLight: "umber",
  sand: "umber",
  sandShade: "umber",
  amber: "umber",
  clay: "umber",
  rust: "umber",
  umber: "plum",
  // stone
  mauve: "plum",
  // vegetation ramp
  mint: "tealDeep",
  jade: "tealDeep",
  teal: "tealDeep",
  tealDeep: "ink",
  // water/ice ramp
  white: "indigo",
  skyBlue: "indigo",
  slate: "indigo",
  indigo: "ink",
  // UI accents (rare on sprites, but the LUT must be total)
  hpRed: "umber",
  atbGold: "umber",
  // darks
  plum: "ink",
  ink: "ink"
};

/**
 * One ramp step brighter, for rim highlights (G1). Top-of-ramp values map to
 * themselves — never introduces `white` (several sheets pin exact white/mint
 * glint counts in tests).
 */
export const highlightOf: Record<PaletteName, PaletteName> = {
  bone: "bone",
  sandLight: "bone",
  sand: "sandLight",
  sandShade: "sand",
  amber: "sand",
  clay: "amber",
  rust: "clay",
  umber: "rust",
  mauve: "clay",
  mint: "mint",
  jade: "mint",
  teal: "jade",
  tealDeep: "teal",
  white: "white",
  skyBlue: "bone",
  slate: "skyBlue",
  indigo: "slate",
  hpRed: "clay",
  atbGold: "sand",
  plum: "mauve",
  ink: "plum"
};

/**
 * Sel-out contour (G8). Fills every transparent cell 4-adjacent to an opaque
 * cell — the exact set `outline()` fills — but coloured per material:
 *
 * - a cell whose *upper* neighbour is opaque sits under the sprite (a foot
 *   sole, a shell underside): pure `ink`, the ground-contact anchor;
 * - every other edge cell takes `contourOf` the body pixel it touches
 *   (side/top neighbour priority: left, right, below).
 *
 * `overrides` retargets specific materials — e.g. cold sheets pass
 * `{ bone: "indigo" }` so an ice sheath contours cool instead of the warm
 * umber the bone ramp defaults to.
 */
export function selOut(g: PixelGrid, overrides?: Partial<Record<PaletteName, PaletteName>>): void {
  const edits: Array<[number, number, PaletteName]> = [];
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (g.get(x, y) !== null) continue;
      const above = g.get(x, y - 1);
      if (above !== null) {
        edits.push([x, y, "ink"]); // bottom contact edge
        continue;
      }
      const n = g.get(x - 1, y) ?? g.get(x + 1, y) ?? g.get(x, y + 1);
      if (n !== null) edits.push([x, y, overrides?.[n] ?? contourOf[n]]);
    }
  }
  for (const [x, y, c] of edits) g.px(x, y, c);
}

export interface RimRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 1px rim highlight along the upper-left silhouette arc inside `region` (G1
 * NNW light): body cells open to transparency above (left half of the region)
 * or to the left (upper half) step one ramp value brighter. Call BEFORE
 * `selOut` so "open" still means the sky, not the contour.
 */
export function rimTopLeft(g: PixelGrid, region: RimRegion): void {
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  const edits: Array<[number, number, PaletteName]> = [];
  for (let y = region.y; y < region.y + region.h; y++) {
    for (let x = region.x; x < region.x + region.w; x++) {
      const c = g.get(x, y);
      if (c === null) continue;
      const topOpen = g.get(x, y - 1) === null;
      const leftOpen = g.get(x - 1, y) === null;
      if ((topOpen && x <= cx) || (leftOpen && y <= cy)) {
        edits.push([x, y, highlightOf[c]]);
      }
    }
  }
  for (const [x, y, c] of edits) g.px(x, y, c);
}
