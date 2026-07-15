/**
 * tilecraft.ts — tile-role composers for the 2.5D upgrade, built on `fx.ts`
 * (docs/ART_DIRECTION.md §2 floor/wall/edge grammar, §4a transitions).
 *
 * Where `fx.ts` provides the individual drawing techniques, this module
 * assembles whole 16×16 tiles from them: wall Caps and Faces, `...Shade`
 * floor variants, and complete 4-edge + 4-corner terrain-transition sets.
 * Everything is pure and deterministic (seeded rng only).
 */
import type { PaletteName } from "../../../src/shared/palette";
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import {
  capLip,
  edgeFingers,
  edgeLen,
  edgeXY,
  faceGradient,
  scatterMotifs,
  shadeGrid,
  SIDES,
  strata,
  type FingerOptions,
  type Motif,
  type Side
} from "./fx";

// ---------------------------------------------------------------------------
// Cap / Face / Shade (ART_DIRECTION §2 wall roles).
// ---------------------------------------------------------------------------

export interface CapOptions {
  /** Tile size in px (default 16). */
  size?: number;
  /** Cap body colour — the material's lit top value (G1/G4: lightest). */
  base: PaletteName;
  /** Lit lip colour along the south edge (§2 Cap: 2–3px lip). */
  lip: PaletteName;
  /** Lip thickness, 2–3 (default 2). */
  lipThickness?: number;
  /** Seed for motif scatter (default 1). */
  seed?: number;
  /** Optional sparse motif stamps for the cap top (G5). */
  motifs?: readonly Motif[];
  /** Motifs to place, 2–5 per G5 (default 3). */
  motifCount?: number;
}

/**
 * The lit horizontal top of a wall run (§2 Cap): body in the material's top
 * texture with 2–5 motif clusters (G5), plus the 2–3px lit lip band along
 * its south edge. Returns a new tile grid.
 */
export function makeCap(options: CapOptions): PixelGrid {
  const { size = 16, base, lip, lipThickness = 2, seed = 1, motifs, motifCount = 3 } = options;
  const g = new PixelGrid(size, size);
  g.rect(0, 0, size, size, base);
  if (motifs && motifs.length > 0) scatterMotifs(g, seed, motifs, motifCount);
  capLip(g, { color: lip, thickness: lipThickness });
  return g;
}

export interface FaceOptions {
  /** Tile size in px (default 16). */
  size?: number;
  /** Gradient values top→bottom (G10: value-2 at top → value-4 at bottom). */
  top: PaletteName;
  mid: PaletteName;
  bottom: PaletteName;
  /** Foot-line colour on the bottom row (default "ink" per §2); null skips. */
  foot?: PaletteName | null;
  /** Seed for the broken strata courses (default 1). */
  seed?: number;
  /** Explicit course colour; omit to shade each crossed pixel via the LUT. */
  courseLine?: PaletteName;
  /** Course spacing bounds in rows (default 4..6 per G10). */
  spacingMin?: number;
  spacingMax?: number;
  /** Chance each course segment is skipped/broken (default 0.3). */
  breakChance?: number;
}

/**
 * The vertical south-facing surface of a wall (§2 Face): vertical light→dark
 * gradient, broken horizontal courses every 4–6px (G10), and a 1px darkest
 * foot line on the bottom row. Returns a new tile grid.
 */
export function makeFace(options: FaceOptions): PixelGrid {
  const {
    size = 16,
    top,
    mid,
    bottom,
    foot = "ink",
    seed = 1,
    courseLine,
    spacingMin = 4,
    spacingMax = 6,
    breakChance = 0.3
  } = options;
  const g = new PixelGrid(size, size);
  faceGradient(g, top, mid, bottom, { foot });
  strata(g, { seed, spacingMin, spacingMax, line: courseLine, breakChance });
  return g;
}

/**
 * The `...Shade` variant of a floor tile (§2 foot shadow): the same art
 * recoloured through the global shadow LUT (G2). Returns a new grid; the
 * input tile is untouched.
 */
export function makeShadeVariant(tileGrid: PixelGrid): PixelGrid {
  return shadeGrid(tileGrid);
}

// ---------------------------------------------------------------------------
// Terrain-transition sets (G9: every terrain boundary is authored;
// §4a coast ring / scree fingers; §5 organic seams).
// ---------------------------------------------------------------------------

/**
 * - `"lip"`     — chasm/void treatment: 1–2px darkest edge on the boundary
 *                 side (§2 void boundaries).
 * - `"fingers"` — organic interpenetration: a band of the other material
 *                 with clustered 2px fingers of the base material reaching
 *                 into it (§4a sand↔scree, §5 grass↔moss; G9).
 * - `"surf"`    — the coast recipe: dark land lip → broken bone surf fringe
 *                 → skyBlue shallow band → open water (§4a coast ring).
 */
export type EdgeStyle = "lip" | "fingers" | "surf";

export type Corner = "ne" | "nw" | "se" | "sw";

export interface EdgeSetOptions {
  style: EdgeStyle;
  /** One seed drives the whole set; sides/corners are mixed in so no two
   *  tiles repeat (default 1). */
  seed?: number;

  // --- "lip" style ---
  /** Lip colour (default "ink" — G2 sanctions ink for deep voids). */
  lipColor?: PaletteName;
  /** Lip thickness 1–2px (default 2). */
  lipThickness?: number;

  // --- "fingers" style ---
  /** Depth of the other-material band along the boundary side (default 5). */
  bandDepth?: number;
  /** Colour of the base-material fingers reaching into the band — pick the
   *  base tile's dominant colour (required for "fingers"). */
  fingerColor?: PaletteName;
  /** Tuning forwarded to `edgeFingers` (depth/density/wander). */
  fingerOpts?: FingerOptions;

  // --- "surf" style ---
  /** Dark land lip colour (default "umber"). */
  surfLip?: PaletteName;
  /** Land-lip thickness 1–2px (default 2). */
  surfLipThickness?: number;
  /** Broken surf-fringe colour (default "bone"). */
  fringeColor?: PaletteName;
  /** Fringe depth in px (default 2 — keeps clusters ≥2×2 per G6). */
  fringeDepth?: number;
  /** Shallow-water colour (default "skyBlue"). */
  shallowColor?: PaletteName;
  /** Shallow band depth 2–4px (default 3). */
  shallowDepth?: number;
  /** Rows of true other-material (open water) at the tile edge so the seam
   *  matches the neighbouring pure tile (default 3). */
  waterDepth?: number;

  /** Also build the four inner-corner tiles (other material only diagonal). */
  innerCorners?: boolean;
}

export interface EdgeSet {
  /** `edges.n` = base tile whose NORTH neighbour is the other material, etc.
   *  (the base/owner material owns the border per G9). */
  edges: Record<Side, PixelGrid>;
  /** `outerCorners.ne` = other material to the north AND east, etc. */
  outerCorners: Record<Corner, PixelGrid>;
  /** `innerCorners.ne` = other material only diagonally at the NE corner. */
  innerCorners?: Record<Corner, PixelGrid>;
}

interface Span {
  from: number;
  to: number;
}

const OPPOSITE: Record<Side, Side> = { n: "s", s: "n", w: "e", e: "w" };

/** Strip-local coordinates for a boundary band along `side` (see below). */
function stripXY(side: Side, u: number, d: number, span: Span, band: number): [number, number] {
  switch (side) {
    case "n":
      return [u - span.from, d];
    case "s":
      return [u - span.from, band - 1 - d];
    case "w":
      return [d, u - span.from];
    case "e":
      return [band - 1 - d, u - span.from];
  }
}

/** Apply one style's boundary treatment along `side`, limited to `span`. */
function applyTransition(
  out: PixelGrid,
  otherTile: PixelGrid,
  side: Side,
  span: Span,
  opts: EdgeSetOptions,
  seed: number
): void {
  const sideSeed = (seed ^ (SIDES.indexOf(side) * 0x85ebca6b)) >>> 0;
  if (opts.style === "lip") {
    const { lipColor = "ink", lipThickness = 2 } = opts;
    for (let d = 0; d < lipThickness; d++) {
      for (let u = span.from; u < span.to; u++) {
        const [x, y] = edgeXY(out, side, u, d);
        out.px(x, y, lipColor);
      }
    }
    return;
  }

  if (opts.style === "fingers") {
    const { bandDepth = 5, fingerColor, fingerOpts } = opts;
    if (!fingerColor) throw new Error('makeEdgeSet style "fingers" requires fingerColor');
    // Build the other-material band as its own strip, oriented so the strip's
    // `side` edge is the tile edge; pixels are copied from the SAME x/y of
    // the other tile so the seam continues into the neighbouring pure tile.
    const horizontal = side === "n" || side === "s";
    const len = span.to - span.from;
    const strip = new PixelGrid(horizontal ? len : bandDepth, horizontal ? bandDepth : len);
    for (let u = span.from; u < span.to; u++) {
      for (let d = 0; d < bandDepth; d++) {
        const [x, y] = edgeXY(out, side, u, d);
        const c = otherTile.get(x, y);
        if (c !== null) {
          const [sx, sy] = stripXY(side, u, d, span, bandDepth);
          strip.px(sx, sy, c);
        }
      }
    }
    // Base-material fingers reach INTO the band from the interior boundary —
    // i.e. from the strip's opposite side (G9: rougher/owner reaches out).
    edgeFingers(strip, OPPOSITE[side], fingerColor, sideSeed, fingerOpts);
    const [bx, by] = (() => {
      switch (side) {
        case "n":
          return [span.from, 0];
        case "s":
          return [span.from, out.height - bandDepth];
        case "w":
          return [0, span.from];
        case "e":
          return [out.width - bandDepth, span.from];
      }
    })();
    out.blit(strip, bx, by);
    return;
  }

  // "surf" — §4a coast ring, from the tile edge inward:
  // open water (other tile) → shallow band → broken surf fringe → land lip.
  const {
    surfLip = "umber",
    surfLipThickness = 2,
    fringeColor = "bone",
    fringeDepth = 2,
    shallowColor = "skyBlue",
    shallowDepth = 3,
    waterDepth = 3
  } = opts;
  const shallowEnd = waterDepth + shallowDepth;
  const fringeEnd = shallowEnd + fringeDepth;
  const lipEnd = fringeEnd + surfLipThickness;
  for (let u = span.from; u < span.to; u++) {
    for (let d = 0; d < lipEnd; d++) {
      const [x, y] = edgeXY(out, side, u, d);
      if (d < waterDepth) {
        const c = otherTile.get(x, y);
        if (c !== null) out.px(x, y, c);
      } else if (d < fringeEnd) {
        out.px(x, y, shallowColor); // fringe rows start as shallow water
      } else {
        out.px(x, y, surfLip);
      }
    }
  }
  // Broken bone surf fringe: seeded 2–3px clusters spanning the fringe rows
  // (≥2×2 per G6), with gaps so the surf reads as foam, not a stripe.
  const rng = mulberry32(sideSeed);
  for (let u = span.from; u < span.to; u += 2) {
    const roll = rng();
    const run = 2 + Math.floor(rng() * 2);
    if (roll >= 0.55) continue;
    for (let i = 0; i < run && u + i < span.to; i++) {
      for (let d = shallowEnd; d < fringeEnd; d++) {
        const [x, y] = edgeXY(out, side, u + i, d);
        out.px(x, y, fringeColor);
      }
    }
  }
}

/**
 * Build a complete terrain-transition set between `baseTile` (the border
 * owner — higher/rougher material per G9) and `otherTile`: four edge tiles,
 * four outer-corner tiles, and optionally four inner-corner tiles
 * (ART_DIRECTION §2/§4a). Generic across coast rings (`"surf"`), scree
 * fingers (`"fingers"`) and chasm lips (`"lip"`). Inputs are not mutated.
 */
export function makeEdgeSet(
  baseTile: PixelGrid,
  otherTile: PixelGrid,
  options: EdgeSetOptions
): EdgeSet {
  if (baseTile.width !== otherTile.width || baseTile.height !== otherTile.height) {
    throw new Error("makeEdgeSet requires equal-sized base and other tiles");
  }
  const seed = options.seed ?? 1;
  const W = baseTile.width;
  const H = baseTile.height;
  const full = (side: Side): Span => ({ from: 0, to: edgeLen(baseTile, side) });

  const edge = (side: Side): PixelGrid => {
    const g = baseTile.clone();
    applyTransition(g, otherTile, side, full(side), options, seed);
    return g;
  };

  const CORNER_SIDES: Record<Corner, [Side, Side]> = {
    ne: ["n", "e"],
    nw: ["n", "w"],
    se: ["s", "e"],
    sw: ["s", "w"]
  };

  const outerCorner = (corner: Corner): PixelGrid => {
    const g = baseTile.clone();
    for (const side of CORNER_SIDES[corner]) {
      // Mix the corner into the seed so corners don't just repeat the edges.
      applyTransition(g, otherTile, side, full(side), options, (seed + 0x51ed) >>> 0);
    }
    return g;
  };

  /** For an inner corner, each side's treatment covers only the half of the
   *  edge nearest that corner — a quarter-tile notch of the other material. */
  const innerCorner = (corner: Corner): PixelGrid => {
    const g = baseTile.clone();
    const [v, h] = CORNER_SIDES[corner]; // vertical (n/s) then horizontal (e/w)
    const vSpan: Span = h === "e" ? { from: W >> 1, to: W } : { from: 0, to: W >> 1 };
    const hSpan: Span = v === "n" ? { from: 0, to: H >> 1 } : { from: H >> 1, to: H };
    applyTransition(g, otherTile, v, vSpan, options, (seed + 0xa11) >>> 0);
    applyTransition(g, otherTile, h, hSpan, options, (seed + 0xa11) >>> 0);
    return g;
  };

  const set: EdgeSet = {
    edges: { n: edge("n"), e: edge("e"), s: edge("s"), w: edge("w") },
    outerCorners: {
      ne: outerCorner("ne"),
      nw: outerCorner("nw"),
      se: outerCorner("se"),
      sw: outerCorner("sw")
    }
  };
  if (options.innerCorners) {
    set.innerCorners = {
      ne: innerCorner("ne"),
      nw: innerCorner("nw"),
      se: innerCorner("se"),
      sw: innerCorner("sw")
    };
  }
  return set;
}
