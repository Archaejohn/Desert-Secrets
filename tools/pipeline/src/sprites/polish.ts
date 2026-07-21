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
  // cool stone ramp — contour in the deep navy of the same ramp
  stoneLit: "stoneDeep",
  stone: "stoneDeep",
  stoneDark: "stoneDeep",
  stoneDeep: "ink",
  // UI accents (rare on sprites, but the LUT must be total)
  hpRed: "umber",
  atbGold: "umber",
  // darks
  plum: "ink",
  ink: "ink",

  // AAP-64 remainder (39 names appended by the CORE=AAP-64 migration,
  // 2026-07-20): none are drawn by any sprite sheet yet, so there is no
  // designed contour target. Self-map as a neutral placeholder to keep this
  // LUT total; revisit per-color once a sheet actually adopts one.
  red0: "red0",
  red1: "red1",
  red2: "red2",
  red3: "red3",
  red4: "red4",
  red5: "red5",
  orange0: "orange0",
  orange1: "orange1",
  orange2: "orange2",
  orange3: "orange3",
  orange4: "orange4",
  orange5: "orange5",
  yellow0: "yellow0",
  green0: "green0",
  green1: "green1",
  green2: "green2",
  green3: "green3",
  green4: "green4",
  green5: "green5",
  green6: "green6",
  green7: "green7",
  teal0: "teal0",
  teal1: "teal1",
  blue0: "blue0",
  blue1: "blue1",
  blue2: "blue2",
  blue3: "blue3",
  blue4: "blue4",
  blue5: "blue5",
  blue6: "blue6",
  blue7: "blue7",
  blue8: "blue8",
  pink0: "pink0",
  pink1: "pink1",
  pink2: "pink2",
  pink3: "pink3",
  grey0: "grey0",
  grey1: "grey1",
  grey2: "grey2"
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
  // cool stone ramp — one step brighter up its own ramp
  stoneLit: "stoneLit",
  stone: "stoneLit",
  stoneDark: "stone",
  stoneDeep: "stoneDark",
  hpRed: "clay",
  atbGold: "sand",
  plum: "mauve",
  ink: "plum",

  // AAP-64 remainder (39 names appended by the CORE=AAP-64 migration,
  // 2026-07-20): same rationale as contourOf above — self-map placeholder,
  // never `white` (satisfies the "never mints a new glint" rule below).
  red0: "red0",
  red1: "red1",
  red2: "red2",
  red3: "red3",
  red4: "red4",
  red5: "red5",
  orange0: "orange0",
  orange1: "orange1",
  orange2: "orange2",
  orange3: "orange3",
  orange4: "orange4",
  orange5: "orange5",
  yellow0: "yellow0",
  green0: "green0",
  green1: "green1",
  green2: "green2",
  green3: "green3",
  green4: "green4",
  green5: "green5",
  green6: "green6",
  green7: "green7",
  teal0: "teal0",
  teal1: "teal1",
  blue0: "blue0",
  blue1: "blue1",
  blue2: "blue2",
  blue3: "blue3",
  blue4: "blue4",
  blue5: "blue5",
  blue6: "blue6",
  blue7: "blue7",
  blue8: "blue8",
  pink0: "pink0",
  pink1: "pink1",
  pink2: "pink2",
  pink3: "pink3",
  grey0: "grey0",
  grey1: "grey1",
  grey2: "grey2"
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
