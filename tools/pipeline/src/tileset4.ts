/**
 * Tileset 4 — sixteen 16×16 Act 3 tiles in the exact contract order
 * (docs/CONTRACTS.md §12): the Sunless Sea under the glacier.
 *
 * Same rules as tileset.ts/tileset2.ts/tileset3.ts: props stamped onto an
 * opaque base via a transparent outlined layer, deterministic speckle from
 * seeded mulberry32. Legibility is contractual: the walkable `floe` tiles
 * are clearly BRIGHTER (bone/skyBlue) than the solid `seaWater` fill
 * (tealDeep/indigo dark), so the hop-path always reads against the water;
 * `kelpStalk`/`coral`/`templePillar`/`mossRock` are solid and read as
 * standing obstacles; `bubbles` is the one OVERHEAD tile — it keeps a
 * transparent background while every other tile is fully opaque.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { hLine } from "./fx";
import { makeEdgeSet, makeShadeVariant } from "./tilecraft";
import { TILE_SIZE } from "./tileset";

/** Contract tile order (row-major indices 0..15), plus the 2.5D dressing
 *  append (indices 16..31, docs/ART_DIRECTION.md §2/§5 — additive only). */
export const TILE4_NAMES = [
  "seaWater",
  "seaWater2",
  "floe",
  "floe2",
  "floeEdge",
  "kelpBed",
  "reefGlow",
  "templeFloor",
  "kelpStalk",
  "coral",
  "templePillar",
  "templeGlyph",
  "anemone",
  "seaSparkle",
  "bubbles",
  "mossRock",
  // --- 2.5D dressing append (Phase Z) ---
  "floeSeaN",
  "floeSeaE",
  "floeSeaS",
  "floeSeaW",
  "floeSeaNE",
  "floeSeaNW",
  "floeSeaSE",
  "floeSeaSW",
  "floeSeaInNE",
  "floeSeaInNW",
  "floeSeaInSE",
  "floeSeaInSW",
  "templeFloorShade",
  "templeGlyphShade",
  "floeShade",
  "kelpBedShade"
] as const;

export type Tile4Name = (typeof TILE4_NAMES)[number];

function tile(): PixelGrid {
  return new PixelGrid(TILE_SIZE, TILE_SIZE);
}

/** Draw a prop on a transparent layer, ink-outline it, stamp it on `base`. */
function stamp(base: PixelGrid, draw: (layer: PixelGrid) => void): PixelGrid {
  const layer = tile();
  draw(layer);
  layer.outline("ink");
  base.blit(layer, 0, 0);
  return base;
}

/** Dark bioluminescent water — SOLID. tealDeep/indigo base with drifting
 *  teal ripple bands and a few mint plankton glints. `phase` drifts the
 *  ripples one pixel so seaWater ↔ seaWater2 animate like the desert pond. */
function seaWater(phase: 0 | 1): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "tealDeep");
  const d = phase;
  // 3-value ramp (§4a wave recipe): tealDeep body, rounded indigo swells,
  // teal wave dashes — two per tile, loosely row-aligned, drifting.
  g.rect(2 + d, 5, 4, 2, "indigo");
  g.rect(9 - d, 11, 4, 2, "indigo");
  for (const [ry, len, rx] of [
    [3, 5, 2],
    [12, 4, 8]
  ] as const) {
    const y = (ry + d) % TILE_SIZE;
    const x = (rx + d) % TILE_SIZE;
    hLine(g, x, y, len, "teal");
    g.px(Math.min(x + len - 1, TILE_SIZE - 1), y - 1, "teal"); // the crest curls
  }
  // bioluminescent plankton (2px pairs — the sea's own light)
  g.px((4 + d) % TILE_SIZE, 8, "mint");
  g.px((5 + d) % TILE_SIZE, 8, "mint");
  g.px((12 + d) % TILE_SIZE, (2 + d) % TILE_SIZE, "mint");
  return g;
}

/** Walkable ice floe base — pale bone/skyBlue so the raft path pops bright
 *  against the dark water. Distinct speckle per seed. */
function floeBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "skyBlue");
  // lit crown of the floe
  g.rect(2, 2, 12, 7, "bone");
  g.rect(3, 9, 10, 3, "sandLight");
  // shaded meltwater rim at the foot
  g.rect(0, 13, TILE_SIZE, 3, "skyBlue");
  // melt-glint chips (2px motif clusters per G5, not per-pixel speckle)
  const rng = mulberry32(seed);
  for (let i = 0; i < 2; i++) {
    const x = 3 + Math.floor(rng() * 9);
    const y = 3 + Math.floor(rng() * 5);
    hLine(g, x, y, 2, "white");
  }
  // frozen seams (2px dashes)
  hLine(g, 6, 5, 2, "slate");
  hLine(g, 10, 8, 2, "slate");
  hLine(g, 4, 11, 2, "slate");
  return g;
}

/** Floe with a mint-lit edge — a bright landmark tile for wayfinding. */
function floeEdge(): PixelGrid {
  const g = floeBase(204);
  // glowing mint rim along the top and left (bioluminescent algae line)
  for (let x = 1; x < TILE_SIZE - 1; x++) g.px(x, 1, "mint");
  for (let y = 1; y < 12; y++) g.px(1, y, "mint");
  g.px(2, 2, "white");
  g.px(13, 1, "white");
  return g;
}

/** Deep kelp-bed floor — walkable dark bed with jade/mint fronds trailing
 *  across it (the beds you fish the silverfin from). Darker than a floe but
 *  clearly not the solid open water: it has a walkable teal floor tone. */
function kelpBed(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "teal");
  g.rect(0, 10, TILE_SIZE, 6, "tealDeep"); // shaded bed floor
  const rng = mulberry32(seed);
  // fronds lying across the bed
  for (const [x, top, len] of [
    [3, 1, 9],
    [7, 2, 11],
    [11, 1, 8],
    [13, 3, 9]
  ] as const) {
    for (let i = 0; i < len; i++) {
      const xx = x + (i % 2 === 0 ? 0 : 1);
      g.px(xx, top + i, i < 3 ? "jade" : "teal");
    }
    g.px(x, top, "mint"); // lit tip
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * TILE_SIZE);
    g.px(x, y, "mint"); // glowing spores
  }
  return g;
}

/** Reef-glow floor — walkable dark floor lit by jade coral bloom underfoot. */
function reefGlow(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "tealDeep");
  const rng = mulberry32(seed);
  // coral bloom patches
  g.rect(2, 3, 4, 3, "jade");
  g.rect(9, 5, 4, 3, "jade");
  g.rect(5, 10, 4, 3, "jade");
  g.px(3, 3, "mint");
  g.px(10, 5, "mint");
  g.px(6, 10, "mint");
  g.px(4, 4, "teal");
  g.px(11, 7, "teal");
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * TILE_SIZE);
    g.px(x, y, rng() < 0.5 ? "mint" : "teal");
  }
  return g;
}

/** Flooded temple flagstones — walkable submerged mauve/slate stone under a
 *  faint skyBlue water sheen. */
function templeFloor(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "mauve");
  // flagstone subgrid: 8x8 flags with plum joints (speckle killed per G5)
  for (const y of [0, 8]) g.rect(0, y, TILE_SIZE, 1, "plum");
  for (const x of [0, 8]) g.rect(x, 0, 1, TILE_SIZE, "plum");
  // per-flag lit top-left bevel (G1) and a plum wear pocket low-right
  for (const [fx, fy] of [
    [1, 1],
    [9, 1],
    [1, 9],
    [9, 9]
  ] as const) {
    hLine(g, fx, fy, 3, "clay");
    g.px(fx, fy + 1, "clay");
    g.px(fx + 5, fy + 5, "plum");
    g.px(fx + 6, fy + 5, "plum");
  }
  // one submerged water-sheen glint per tile (seeded position)
  const rng = mulberry32(seed);
  const x = 2 + Math.floor(rng() * 11);
  const y = 2 + Math.floor(rng() * 11);
  hLine(g, x, y, 2, "skyBlue");
  return g;
}

/** Tall kelp stalk — SOLID column of jade/teal fronds blocking the water. */
function kelpStalk(): PixelGrid {
  return stamp(tile(), (l) => {
    // twin trunks
    l.rect(5, 0, 2, 16, "teal");
    l.rect(9, 1, 2, 15, "teal");
    for (let y = 0; y < 16; y++) {
      if (y % 3 !== 2) l.px(5, y, "jade"); // lit edge
      if (y % 3 !== 0) l.px(10, y, "jade");
    }
    // bladder leaves
    l.px(4, 3, "jade");
    l.px(11, 5, "jade");
    l.px(4, 9, "jade");
    l.px(11, 11, "jade");
    // glowing tips
    l.px(5, 0, "mint");
    l.px(9, 1, "mint");
    l.px(4, 3, "mint");
    l.px(11, 5, "mint");
  });
}

/** Reef coral outcrop — SOLID branching clay/rust coral with jade polyps. */
function coral(): PixelGrid {
  return stamp(tile(), (l) => {
    // stony base
    l.rect(4, 9, 8, 5, "clay");
    l.rect(6, 12, 4, 3, "rust");
    // branches
    l.rect(5, 4, 2, 6, "clay");
    l.rect(9, 3, 2, 7, "clay");
    l.rect(7, 6, 2, 4, "clay");
    l.px(5, 4, "amber"); // sunlit branch tops
    l.px(9, 3, "amber");
    l.px(7, 6, "amber");
    // jade polyps + mint glow
    l.px(5, 5, "jade");
    l.px(10, 4, "jade");
    l.px(8, 7, "jade");
    l.px(6, 10, "mint");
    l.px(10, 11, "mint");
  });
}

/** Sun-temple pillar, submerged — SOLID mauve column with a skyBlue water
 *  line and a faint amber sun glyph still catching the sea-glow. */
function templePillar(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(3, 0, 10, 2, "mauve"); // capital
    l.rect(3, 0, 10, 1, "plum"); // dark against the ceiling (base-lit read)
    l.rect(4, 2, 8, 12, "mauve"); // shaft
    l.rect(3, 14, 10, 2, "mauve"); // base
    l.rect(3, 14, 10, 1, "clay"); // sea-glow catching the base from below
    for (let y = 6; y <= 13; y++) l.px(4, y, "clay"); // lit lower-left edge
    for (let y = 2; y <= 9; y++) l.px(11, y, "plum"); // shade up top
    // sun glyph carved mid-shaft
    l.px(7, 6, "amber");
    l.px(8, 6, "amber");
    l.px(6, 7, "amber");
    l.px(9, 7, "amber");
    l.px(7, 8, "amber");
    l.px(8, 8, "amber");
    l.px(7, 7, "sandLight");
    // water line across the shaft
    l.rect(4, 10, 8, 1, "skyBlue");
  });
}

/** Temple floor carved with a sun glyph — walkable inspect landmark. */
function templeGlyph(): PixelGrid {
  const g = templeFloor(211);
  // amber sun disc with rays
  g.rect(6, 6, 4, 4, "amber");
  g.px(7, 7, "sandLight");
  g.px(8, 7, "sandLight");
  g.px(7, 8, "sandLight");
  for (const [x, y] of [
    [7, 3],
    [8, 3],
    [7, 12],
    [8, 12],
    [3, 7],
    [3, 8],
    [12, 7],
    [12, 8],
    [4, 4],
    [11, 4],
    [4, 11],
    [11, 11]
  ] as const) {
    g.px(x, y, "amber");
  }
  return g;
}

/** Sea anemone — walkable decor: mint/jade tendrils on a floe. */
function anemone(): PixelGrid {
  return stamp(tile(), (l) => {
    // stalk
    l.rect(7, 9, 2, 4, "mauve");
    // crown of tendrils
    l.rect(5, 6, 6, 3, "jade");
    l.px(4, 6, "jade");
    l.px(11, 6, "jade");
    l.px(5, 5, "mint");
    l.px(7, 4, "mint");
    l.px(9, 5, "mint");
    l.px(6, 6, "mint");
    l.px(10, 6, "mint");
    l.px(8, 7, "teal");
  });
}

/** Silverfin sparkle — walkable decor on a floe: white/mint four-point
 *  glints hinting at fish under the ice (the fishing tell). */
function seaSparkle(): PixelGrid {
  const g = floeBase(213);
  g.px(5, 5, "white");
  g.px(4, 5, "mint");
  g.px(6, 5, "mint");
  g.px(5, 4, "mint");
  g.px(5, 6, "mint");
  g.px(11, 10, "white");
  g.px(10, 10, "mint");
  g.px(12, 10, "mint");
  g.px(11, 9, "mint");
  g.px(11, 11, "skyBlue");
  g.px(12, 3, "mint");
  g.px(3, 11, "mint");
  return g;
}

/** OVERHEAD tile: rising bubbles. Transparent background — the only tile in
 *  the set that is not fully opaque (drawn above the actors). */
function bubbles(): PixelGrid {
  const g = tile();
  const bubble = (cx: number, cy: number, r: number): void => {
    g.rect(cx - r, cy - r, r * 2, r * 2, "skyBlue");
    g.px(cx - r, cy - r, null);
    g.px(cx + r - 1, cy - r, null);
    g.px(cx - r, cy + r - 1, null);
    g.px(cx + r - 1, cy + r - 1, null);
    g.px(cx - 1, cy - 1, "white"); // highlight
  };
  bubble(4, 4, 2);
  bubble(11, 7, 2);
  bubble(6, 11, 1);
  bubble(13, 13, 1);
  bubble(9, 2, 1);
  g.outline("ink");
  return g;
}

/** Mint-crusted boulder — SOLID mauve rock furred with jade/mint moss. */
function mossRock(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(3, 5, 10, 8, "mauve");
    l.rect(4, 4, 8, 1, "mauve");
    l.rect(4, 13, 8, 1, "mauve");
    // lit top-left
    l.px(3, 5, "clay");
    l.px(4, 4, "clay");
    l.px(4, 5, "clay");
    // plum shade bottom-right
    l.rect(9, 10, 3, 3, "plum");
    // jade/mint moss crust on top
    for (const [x, y] of [
      [4, 4],
      [6, 4],
      [8, 4],
      [10, 4],
      [3, 6],
      [5, 5],
      [11, 6]
    ] as const) {
      l.px(x, y, "jade");
    }
    l.px(5, 4, "mint");
    l.px(9, 4, "mint");
    l.px(4, 6, "mint");
  });
}

/** All contract tiles in order (see TILE4_NAMES). */
export function tile4Frames(): PixelGrid[] {
  // The floe coast ring (§4a/§5): land owns the border — dark slate lip,
  // broken bone surf fringe, skyBlue shallow band, then open water whose
  // pixels are copied from the seaWater tile so the seam continues.
  const coast = makeEdgeSet(floeBase(202), seaWater(0), {
    style: "surf",
    seed: 430,
    surfLip: "slate",
    surfLipThickness: 2,
    fringeColor: "bone",
    fringeDepth: 2,
    shallowColor: "skyBlue",
    shallowDepth: 3,
    waterDepth: 3,
    innerCorners: true
  });
  return [
    seaWater(0),
    seaWater(1),
    floeBase(202),
    floeBase(203),
    floeEdge(),
    kelpBed(205),
    reefGlow(206),
    templeFloor(207),
    kelpStalk(),
    coral(),
    templePillar(),
    templeGlyph(),
    anemone(),
    seaSparkle(),
    bubbles(),
    mossRock(),
    // --- 2.5D dressing append (Phase Z) ---
    coast.edges.n,
    coast.edges.e,
    coast.edges.s,
    coast.edges.w,
    coast.outerCorners.ne,
    coast.outerCorners.nw,
    coast.outerCorners.se,
    coast.outerCorners.sw,
    coast.innerCorners!.ne,
    coast.innerCorners!.nw,
    coast.innerCorners!.se,
    coast.innerCorners!.sw,
    makeShadeVariant(templeFloor(207)),
    makeShadeVariant(templeGlyph()),
    makeShadeVariant(floeBase(202)),
    makeShadeVariant(kelpBed(205))
  ];
}
