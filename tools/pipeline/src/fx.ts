/**
 * fx.ts — the shared drawing-technique library for the 2.5D art upgrade
 * (docs/ART_DIRECTION.md §1 G-rules, §3 palette ramps, §8 Phase F).
 *
 * Everything here is a pure function over `PixelGrid` + palette names:
 * deterministic (seeded mulberry32 only — no Math.random, no Date), and
 * palette-locked by construction. Functions follow the existing pipeline
 * idiom: they MUTATE the grid passed in (like `PixelGrid.rect`), except the
 * ones documented as returning a new grid (`shadeGrid`).
 */
import type { PaletteName } from "../../../src/shared/palette";
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";

// ---------------------------------------------------------------------------
// Shadow LUT (G2: shadows are palette ramp steps, cooler — never black,
// never alpha; ART_DIRECTION §3 ramps).
// ---------------------------------------------------------------------------

/**
 * Declared LUT terminators — the only names allowed to map to themselves.
 * `plum` is the universal shadow terminator (§3); `ink` is already the
 * darkest value in the palette. Repeated recolors converge onto these.
 */
export const SHADOW_TERMINATORS: readonly PaletteName[] = ["plum", "ink"];

/**
 * The global shadow LUT (§3): every colour maps to a darker, cooler palette
 * neighbour on its own ramp so shaded material keeps its identity — a shaded
 * sand floor still reads as sand, shaded water still reads as water. Drives
 * every cast shadow, canopy south rim and `...Shade` tile variant.
 */
export const shadowOf: Record<PaletteName, PaletteName> = {
  // Warm/terrain ramp: bone → sandLight → sand → sandShade → clay → rust →
  // umber → plum. (amber also shades to clay; sandShade skips amber because
  // amber is *brighter* than sandShade — §3 added sandShade precisely for
  // shadows where amber reads too orange.)
  bone: "sandLight",
  sandLight: "sand",
  sand: "sandShade",
  sandShade: "clay",
  amber: "clay",
  clay: "rust",
  rust: "umber",
  umber: "plum",

  // Stone (warm rock): mauve sits between clay and plum.
  mauve: "plum",

  // Vegetation ramp: mint → jade → teal → tealDeep, then into the cool darks.
  mint: "jade",
  jade: "teal",
  teal: "tealDeep",
  tealDeep: "indigo",

  // Water/ice ramp: white(glint) → skyBlue → slate → indigo → plum.
  white: "skyBlue",
  skyBlue: "slate",
  slate: "indigo",
  indigo: "plum",

  // UI gauge colours (rare on tiles, but the LUT must be total): keep hue
  // identity while stepping darker.
  hpRed: "rust",
  atbGold: "amber",

  // Terminators (see SHADOW_TERMINATORS): repeated shading converges here.
  plum: "plum",
  ink: "ink"
};

/**
 * New grid with every opaque cell recoloured through the shadow LUT (G2).
 * The transparency pattern is preserved; the input grid is not touched.
 * This *is* the `...Shade` tile variant recipe (§2 foot shadows).
 */
export function shadeGrid(grid: PixelGrid): PixelGrid {
  const out = new PixelGrid(grid.width, grid.height);
  grid.forEach((x, y, c) => {
    if (c !== null) out.px(x, y, shadowOf[c]);
  });
  return out;
}

export interface ShadeTopRowsOptions {
  /** Seed for the broken boundary (default 1). */
  seed?: number;
  /** Chance a 2px cluster on the boundary row is also shaded (default 0.5). */
  jitterChance?: number;
}

/**
 * Half-shadow tile: recolour the top `rows` rows through the shadow LUT,
 * with a broken lower boundary made of 2px clusters (G7 — dither is
 * seasoning; §2 foot shadow under 1-tile walls). Mutates `grid`.
 */
export function shadeTopRows(grid: PixelGrid, rows: number, options: ShadeTopRowsOptions = {}): void {
  const { seed = 1, jitterChance = 0.5 } = options;
  const solid = Math.min(rows, grid.height);
  for (let y = 0; y < solid; y++) {
    for (let x = 0; x < grid.width; x++) {
      const c = grid.get(x, y);
      if (c !== null) grid.px(x, y, shadowOf[c]);
    }
  }
  // Broken boundary: seeded 2px clusters dip one row further (G7 clusters,
  // never a ruler-straight shadow edge).
  if (rows > 0 && rows < grid.height) {
    const rng = mulberry32(seed);
    for (let x = 0; x < grid.width; x += 2) {
      if (rng() < jitterChance) {
        for (const xx of [x, x + 1]) {
          const c = grid.get(xx, rows);
          if (c !== null) grid.px(xx, rows, shadowOf[c]);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Small drawing utilities.
// ---------------------------------------------------------------------------

/** Horizontal 1px line (clipped). */
export function hLine(grid: PixelGrid, x: number, y: number, len: number, c: PaletteName): void {
  grid.rect(x, y, len, 1, c);
}

/** Vertical 1px line (clipped). */
export function vLine(grid: PixelGrid, x: number, y: number, len: number, c: PaletteName): void {
  grid.rect(x, y, 1, len, c);
}

/**
 * Filled axis-aligned ellipse (clipped) — blob shadows, canopy lobes (§6
 * engine grounding, `canopyLobes`). Radii must be > 0.
 */
export function ellipse(
  grid: PixelGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  c: PaletteName
): void {
  if (rx <= 0 || ry <= 0) throw new Error(`Invalid ellipse radii ${rx}x${ry}`);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) grid.px(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Motif scatter (G5: texture = 2–5 sparse motif clusters, not speckle).
// ---------------------------------------------------------------------------

/** A motif is a tiny stamp grid or a draw callback rooted at (x, y). */
export type Motif =
  | PixelGrid
  | ((grid: PixelGrid, x: number, y: number, rng: () => number) => void);

export interface ScatterOptions {
  /** Keep motif origins at least this far from every grid edge (default 2). */
  margin?: number;
  /** Minimum Manhattan distance between motif origins (default 4). */
  minSpacing?: number;
  /** Placement attempts per motif before giving up (default 40). */
  maxAttempts?: number;
  /** Optional placement gate checked at the candidate origin — e.g. "only
   *  on top of already-painted canopy pixels, not the transparent
   *  background". Undefined means every position is valid (default). */
  isValid?: (x: number, y: number) => boolean;
}

/**
 * Place `count` small motif stamps at seeded positions with minimum spacing,
 * avoiding the tile edges (G5 — this replaces per-pixel speckle). Mutates
 * `grid`; returns the origins actually placed (≤ count if the grid is too
 * crowded for the spacing constraint).
 */
export function scatterMotifs(
  grid: PixelGrid,
  seed: number,
  motifs: readonly Motif[],
  count: number,
  options: ScatterOptions = {}
): Array<{ x: number; y: number }> {
  if (motifs.length === 0) throw new Error("scatterMotifs needs at least one motif");
  const { margin = 2, minSpacing = 4, maxAttempts = 40, isValid } = options;
  const rng = mulberry32(seed);
  const placed: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const motif = motifs[Math.floor(rng() * motifs.length)];
    const mw = motif instanceof PixelGrid ? motif.width : 1;
    const mh = motif instanceof PixelGrid ? motif.height : 1;
    const maxX = grid.width - margin - mw;
    const maxY = grid.height - margin - mh;
    if (maxX < margin || maxY < margin) continue;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = margin + Math.floor(rng() * (maxX - margin + 1));
      const y = margin + Math.floor(rng() * (maxY - margin + 1));
      if (isValid && !isValid(x, y)) continue;
      if (placed.every((p) => Math.abs(p.x - x) + Math.abs(p.y - y) >= minSpacing)) {
        placed.push({ x, y });
        if (motif instanceof PixelGrid) grid.blit(motif, x, y);
        else motif(grid, x, y, rng);
        break;
      }
    }
  }
  return placed;
}

// ---------------------------------------------------------------------------
// Cluster dither (G7: 2px-cluster interleaving, ≤15% of a tile, never
// full-tile checker).
// ---------------------------------------------------------------------------

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DitherOptions {
  /** Hard cap on swapped pixels as a fraction of the region (default 0.15). */
  maxCoverage?: number;
  /** Cluster height: 2 → 2×2 clusters, 1 → 2×1 clusters (default 2). */
  clusterHeight?: 1 | 2;
  /** Chance each lattice slot swaps (default 0.35). */
  density?: number;
}

/**
 * Interleave two ramp values across a boundary band with 2×2 / 2×1 clusters
 * (G7). Within the region, seeded clusters swap cells of `colorA` ↔ `colorB`
 * in place; total swapped pixels never exceed `maxCoverage` of the region.
 * Cells that are neither colour are left alone. Mutates `grid`.
 */
export function clusterDither(
  grid: PixelGrid,
  region: Region,
  colorA: PaletteName,
  colorB: PaletteName,
  seed: number,
  options: DitherOptions = {}
): void {
  const { maxCoverage = 0.15, clusterHeight = 2, density = 0.35 } = options;
  const rng = mulberry32(seed);
  const budget = Math.floor(region.w * region.h * maxCoverage);
  let spent = 0;
  for (let y = region.y; y < region.y + region.h; y += clusterHeight) {
    for (let x = region.x; x < region.x + region.w; x += 2) {
      const roll = rng(); // always consume, so the pattern is stable
      if (roll >= density || spent + 2 * clusterHeight > budget) continue;
      for (let dy = 0; dy < clusterHeight; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const c = grid.get(x + dx, y + dy);
          if (c === colorA) {
            grid.px(x + dx, y + dy, colorB);
            spent++;
          } else if (c === colorB) {
            grid.px(x + dx, y + dy, colorA);
            spent++;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ridge lines (§4a sand plain: paired dune ridge lines that continue across
// tile boundaries; G6 allows the 1px crest as a structural line).
// ---------------------------------------------------------------------------

export interface RidgeOptions {
  /**
   * World-phase offset in pixels — pass `tileCol * TILE_SIZE` (plus any map
   * offset) so adjacent tiles drawn with the same seed continue the same
   * S-curve seamlessly. The crest height is a pure function of `x + phase`.
   */
  phase?: number;
  /** Mean crest height (default: grid mid-height). */
  baseY?: number;
  /** Primary wave amplitude in px (default 2). */
  amplitude?: number;
  /** Primary wavelength in px (default 24 — roughly one ridge per 1–2 tiles). */
  wavelength?: number;
  /** Crest colour (default "sandLight"). */
  crest?: PaletteName;
  /** Wind-shadow colour drawn directly beneath the crest (default "amber"). */
  shade?: PaletteName;
  /** Crest thickness, 1 or 2 px (default 1). */
  thickness?: 1 | 2;
}

/**
 * A wavy near-horizontal paired ridge: 1–2px light crest line with a shade
 * line directly beneath, S-curving across the tile (§4a dune recipe). The
 * curve is a pure function of world-x, so adjacent tiles that share `seed`
 * and pass consecutive `phase` offsets join without a seam. Mutates `grid`.
 */
export function ridgeLine(grid: PixelGrid, seed: number, options: RidgeOptions = {}): void {
  const {
    phase = 0,
    baseY = Math.floor(grid.height / 2),
    amplitude = 2,
    wavelength = 24,
    crest = "sandLight",
    shade = "amber",
    thickness = 1
  } = options;
  const rng = mulberry32(seed);
  const p1 = rng() * Math.PI * 2; // primary phase shift
  const p2 = rng() * Math.PI * 2; // secondary harmonic phase shift
  for (let x = 0; x < grid.width; x++) {
    const t = ((x + phase) / wavelength) * Math.PI * 2;
    const y = Math.round(
      baseY + amplitude * Math.sin(t + p1) + (amplitude / 2) * Math.sin(t / 2 + p2)
    );
    for (let k = 0; k < thickness; k++) grid.px(x, y - k, crest);
    grid.px(x, y + 1, shade);
  }
}

// ---------------------------------------------------------------------------
// Canopy lobes (§5 organic school: vegetation masses as overlapping rounded
// lobes, NNW-lit per G1).
// ---------------------------------------------------------------------------

export interface LobeOptions {
  /** Area the lobes may occupy (default: whole grid). */
  region?: Region;
  /** Number of lobes (default 4). */
  lobes?: number;
  /** Min/max lobe radius in px — 2.5..4 gives the 5–8px lobes of §5. */
  rMin?: number;
  rMax?: number;
  /** Lobe fill colour (default "jade"). */
  base?: PaletteName;
  /** Upper-left highlight arc colour (default "mint") — G1 NNW light. */
  highlight?: PaletteName;
  /** Crevice colour between lobes (default "tealDeep") — G2 ramp shadow. */
  crevice?: PaletteName;
}

/**
 * Overlapping rounded lobes (5–8px) with upper-left highlight arcs and dark
 * crevice pixels where lobes meet — the vegetation-mass recipe (§5 organic
 * school; G1 light from NNW; G3 three values per material). Mutates `grid`.
 */
export function canopyLobes(grid: PixelGrid, seed: number, options: LobeOptions = {}): void {
  const {
    region = { x: 0, y: 0, w: grid.width, h: grid.height },
    lobes = 4,
    rMin = 2.5,
    rMax = 4,
    base = "jade",
    highlight = "mint",
    crevice = "tealDeep"
  } = options;
  const rng = mulberry32(seed);
  const centers: Array<{ cx: number; cy: number; rx: number; ry: number }> = [];
  for (let i = 0; i < lobes; i++) {
    const r = rMin + rng() * (rMax - rMin);
    const rx = r;
    const ry = r * 0.85; // slightly squashed reads as foliage seen from above
    const cx = Math.round(region.x + rx + rng() * Math.max(1, region.w - 2 * rx));
    const cy = Math.round(region.y + ry + rng() * Math.max(1, region.h - 2 * ry));
    centers.push({ cx, cy, rx, ry });
  }
  // Fills first — overlaps merge into one mass.
  for (const l of centers) ellipse(grid, l.cx, l.cy, l.rx, l.ry, base);
  // Dark crevices where neighbouring lobes press together (2px clusters, G6).
  for (let i = 1; i < centers.length; i++) {
    const a = centers[i - 1];
    const b = centers[i];
    const mx = Math.round((a.cx + b.cx) / 2);
    const my = Math.round((a.cy + b.cy) / 2);
    for (const [x, y] of [
      [mx, my],
      [mx + 1, my]
    ] as const) {
      if (grid.get(x, y) === base) grid.px(x, y, crevice);
    }
  }
  // Upper-left highlight arc per lobe (G1: light from the top, biased left).
  for (const l of centers) {
    for (let a = Math.PI * 1.05; a <= Math.PI * 1.55; a += 0.18) {
      const x = Math.round(l.cx + Math.cos(a) * Math.max(1, l.rx - 1));
      const y = Math.round(l.cy + Math.sin(a) * Math.max(1, l.ry - 1));
      if (grid.get(x, y) === base) grid.px(x, y, highlight);
    }
  }
}

// ---------------------------------------------------------------------------
// Wall-face texture (G10: vertical faces get horizontal courses with a
// vertical light→dark gradient and a darkest foot line).
// ---------------------------------------------------------------------------

export interface StrataOptions {
  /** Seed for course breaks/offsets (default 1). */
  seed?: number;
  /** Min/max rows between course lines (default 4..6). */
  spacingMin?: number;
  spacingMax?: number;
  /**
   * Course-line colour. Omit to recolour each crossed pixel through the
   * shadow LUT instead — courses then stay on-ramp for whatever material
   * they cross (recommended for gradient faces).
   */
  line?: PaletteName;
  /** Area to texture (default: whole grid). */
  region?: Region;
  /** Chance each 2–5px segment is skipped, breaking the course (default 0.3). */
  breakChance?: number;
}

/**
 * Horizontal course lines every 4–6px, broken/offset by seed (G10 —
 * orientation via texture direction for vertical faces). Keeps off the
 * bottom row so the foot line stays clean. Mutates `grid`.
 */
export function strata(grid: PixelGrid, options: StrataOptions = {}): void {
  const {
    seed = 1,
    spacingMin = 4,
    spacingMax = 6,
    line,
    region = { x: 0, y: 0, w: grid.width, h: grid.height },
    breakChance = 0.3
  } = options;
  const rng = mulberry32(seed);
  const spacing = (): number => spacingMin + Math.floor(rng() * (spacingMax - spacingMin + 1));
  let y = region.y + spacing() - 1;
  while (y < region.y + region.h - 1) {
    let x = region.x;
    while (x < region.x + region.w) {
      const run = 2 + Math.floor(rng() * 4); // 2–5px segments
      if (rng() >= breakChance) {
        for (let i = 0; i < run && x + i < region.x + region.w; i++) {
          const c = grid.get(x + i, y);
          if (c !== null) grid.px(x + i, y, line ?? shadowOf[c]);
        }
      }
      x += run + (rng() < 0.3 ? 1 : 0); // occasional 1px offset break
    }
    y += spacing();
  }
}

export interface FaceGradientOptions {
  /** Area to fill (default: whole grid). */
  region?: Region;
  /** Darkest foot-line colour on the bottom row (default "ink", G8/§2);
   *  pass null to skip. */
  foot?: PaletteName | null;
}

/**
 * Vertical light→dark gradient for a wall face: top third `topColor`, middle
 * third `midColor`, bottom `bottomColor`, plus a 1px darkest foot line on
 * the bottom row (G10, G4 value hierarchy). Mutates `grid`.
 */
export function faceGradient(
  grid: PixelGrid,
  topColor: PaletteName,
  midColor: PaletteName,
  bottomColor: PaletteName,
  options: FaceGradientOptions = {}
): void {
  const { region = { x: 0, y: 0, w: grid.width, h: grid.height }, foot = "ink" } = options;
  const third = Math.floor(region.h / 3);
  grid.rect(region.x, region.y, region.w, third, topColor);
  grid.rect(region.x, region.y + third, region.w, third, midColor);
  grid.rect(region.x, region.y + 2 * third, region.w, region.h - 2 * third, bottomColor);
  if (foot !== null) grid.rect(region.x, region.y + region.h - 1, region.w, 1, foot);
}

export interface CapLipOptions {
  /** Lip colour — the lit rounded edge before the face drops (G1). */
  color: PaletteName;
  /** Lip thickness in rows, 2–3 (default 2). */
  thickness?: number;
  /** Area whose south edge gets the lip (default: whole grid). */
  region?: Region;
}

/**
 * The 2–3px lit lip band along a cap tile's south edge (§2 Cap role: the
 * lightest tile in the family, G1/G4). Mutates `grid`.
 */
export function capLip(grid: PixelGrid, options: CapLipOptions): void {
  const { color, thickness = 2, region = { x: 0, y: 0, w: grid.width, h: grid.height } } = options;
  grid.rect(region.x, region.y + region.h - thickness, region.w, thickness, color);
}

// ---------------------------------------------------------------------------
// Edge treatments (G9: every terrain boundary is authored; §2 void lips;
// §4a organic finger transitions).
// ---------------------------------------------------------------------------

/** Tile side, compass-named: n = top edge, s = bottom, w = left, e = right. */
export type Side = "n" | "e" | "s" | "w";

export const SIDES: readonly Side[] = ["n", "e", "s", "w"];

/** Map (u, d) — u along the given edge, d = depth into the tile — to x/y. */
export function edgeXY(grid: PixelGrid, side: Side, u: number, d: number): [number, number] {
  switch (side) {
    case "n":
      return [u, d];
    case "s":
      return [u, grid.height - 1 - d];
    case "w":
      return [d, u];
    case "e":
      return [grid.width - 1 - d, u];
  }
}

/** Length of a grid's edge along the given side. */
export function edgeLen(grid: PixelGrid, side: Side): number {
  return side === "n" || side === "s" ? grid.width : grid.height;
}

export interface FingerOptions {
  /** Finger reach beyond the base band, in px (default 2..4 — G9/§4a). */
  depthMin?: number;
  depthMax?: number;
  /** Solid rows of `colorInto` along the edge before fingers (default 0). */
  band?: number;
  /** Chance each 2px slot grows a finger (default 0.45 — clustered, gappy). */
  density?: number;
  /** Max lateral wander of each finger from its slot, in px (default 3). */
  wander?: number;
}

/**
 * Clustered 2px-wide fingers of `colorInto` penetrating 2–4px into the tile
 * from `side`, wandering ±3px laterally (G9 organic transitions, §4a
 * clustered-finger interpenetration; 2px width satisfies G6). The side is
 * mixed into the seed so the four sides of a transition set differ even with
 * one shared seed. Mutates `grid`.
 */
export function edgeFingers(
  grid: PixelGrid,
  side: Side,
  colorInto: PaletteName,
  seed: number,
  options: FingerOptions = {}
): void {
  const { depthMin = 2, depthMax = 4, band = 0, density = 0.45, wander = 3 } = options;
  const rng = mulberry32((seed ^ (SIDES.indexOf(side) * 0x9e3779b9)) >>> 0);
  const len = edgeLen(grid, side);
  // Solid band along the edge first (0 rows by default).
  for (let d = 0; d < band; d++) {
    for (let u = 0; u < len; u++) {
      const [x, y] = edgeXY(grid, side, u, d);
      grid.px(x, y, colorInto);
    }
  }
  // Fingers on a 2px lattice, each jittered laterally and 2–4px deep.
  for (let slot = 0; slot < len; slot += 2) {
    if (rng() >= density) continue;
    const jitter = Math.round((rng() * 2 - 1) * wander);
    const u0 = Math.max(0, Math.min(len - 2, slot + jitter));
    const depth = depthMin + Math.floor(rng() * (depthMax - depthMin + 1));
    for (let d = band; d < band + depth; d++) {
      for (const du of [0, 1]) {
        const [x, y] = edgeXY(grid, side, u0 + du, d);
        grid.px(x, y, colorInto);
      }
    }
  }
}

/**
 * 1–2px darkest edge on the void side of a floor tile (§2 chasm/water/void
 * boundaries; G2 sanctions ink for deep voids). Mutates `grid`.
 */
export function voidLip(grid: PixelGrid, side: Side, color: PaletteName, thickness = 2): void {
  for (let d = 0; d < thickness; d++) {
    for (let u = 0; u < edgeLen(grid, side); u++) {
      const [x, y] = edgeXY(grid, side, u, d);
      grid.px(x, y, color);
    }
  }
}
