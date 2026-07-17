/**
 * Tileset 6 — sixteen 16×16 Act 5 tiles in the exact contract order
 * (docs/CONTRACTS.md §14): the Sunlit Cave-In, an underground orange grove
 * inside Cinnabar Mine. A mine chamber whose ceiling collapsed long ago,
 * letting a shaft of desert sunlight down onto a lush, river-fed floor —
 * the greenest place in the whole game, in deliberate contrast to the dark
 * stone around it.
 *
 * Same rules as tileset.ts..tileset5.ts: props stamped onto an opaque floor
 * base via a transparent, ink-outlined layer; deterministic speckle from a
 * seeded mulberry32. Legibility is contractual: the lush `groveGrass` reads
 * clearly walkable and green against the dark solid `caveWall`; the
 * `sunbeam` shaft is the BRIGHTEST tile in the set (the hole in the roof);
 * `caveWall`, `collapsedRock`, `vineRock`, `fern`, `groveWater`,
 * `groveWater2`, `orangeTreeTrunk` and `needleCactus` are solid; `groveWater`
 * ↔ `groveWater2` animate like every other water pair; `orangeTreeCanopy`
 * is the one OVERHEAD tile — transparent background, drawn above the actors
 * so the party walks *under* the tree.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { canopyLobes, clusterDither, ellipse, hLine } from "./fx";
import { makeCap, makeEdgeSet, makeFace, makeShadeVariant } from "./tilecraft";
import { TILE_SIZE } from "./tileset";
import { generateCanopyPieces, type CanopyFootprint } from "./canopy";

/** Contract tile order (row-major indices 0..15). */
export const TILE6_NAMES = [
  "groveGrass",
  "groveGrass2",
  "groveMoss",
  "sunbeam",
  "caveWall",
  "collapsedRock",
  "vineRock",
  "fern",
  "groveWater",
  "groveWater2",
  "riverStone",
  "orangeTreeTrunk",
  "orangeTreeCanopy",
  "oldOrange",
  "needleCactus",
  "groveFlower",
  // --- 2.5D dressing append (Phase Z, docs/ART_DIRECTION.md §2/§5) ---
  "caveWallCap",
  "caveWallCap2",
  "caveWallFace",
  "caveWallFace2",
  "groveGrassShade",
  "groveMossShade",
  "oldOrangeShade",
  "riverStoneShade",
  "mossGrassN",
  "mossGrassE",
  "mossGrassS",
  "mossGrassW",
  "mossGrassNE",
  "mossGrassNW",
  "mossGrassSE",
  "mossGrassSW",
  "grassWaterN",
  "grassWaterE",
  "grassWaterS",
  "grassWaterW",
  "grassWaterNE",
  "grassWaterNW",
  "grassWaterSE",
  "grassWaterSW",
  "sunGrassN",
  "sunGrassE",
  "sunGrassS",
  "sunGrassW",
  "sunGrassNE",
  "sunGrassNW",
  "sunGrassSE",
  "sunGrassSW",
  // --- wild orange canopy append (post-ship fix, docs/ART_DIRECTION.md §5;
  // replaces the single repeated `orangeTreeCanopy` tile — see
  // ORANGE_CANOPY_FOOTPRINT below) ---
  "orangeCanopy_r0c1",
  "orangeCanopy_r0c2",
  "orangeCanopy_r0c3",
  "orangeCanopy_r1c0",
  "orangeCanopy_r1c1",
  "orangeCanopy_r1c2",
  "orangeCanopy_r1c3",
  "orangeCanopy_r1c4",
  "orangeCanopy_r2c0",
  "orangeCanopy_r2c1",
  "orangeCanopy_r2c2",
  "orangeCanopy_r2c3",
  "orangeCanopy_r2c4",
  "orangeCanopy_r3c1",
  "orangeCanopy_r3c2",
  "orangeCanopy_r3c3",
] as const;

export type Tile6Name = (typeof TILE6_NAMES)[number];

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

/** Lush river-fed grass — walkable. Redrawn for the 2.5D pass (G5, SoM
 *  organic school): a calm teal turf carrying 4 rounded jade tuft motifs
 *  (arced blades with an occasional mint lit tip) and two tealDeep shade
 *  pockets — no per-pixel speckle. `seed` varies the tuft layout. */
function grassBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "teal");
  const rng = mulberry32(seed);
  // grass tufts: little 3-wide arcs of jade
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(rng() * 12);
    const y = 3 + Math.floor(rng() * 11);
    g.px(x, y, "jade");
    g.px(x + 1, y - 1, "jade");
    g.px(x + 2, y, "jade");
    if (rng() < 0.5) g.px(x + 1, y - 2, "mint"); // lit tip
  }
  // deep shade pockets (2px clusters)
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rng() * 13);
    const y = 1 + Math.floor(rng() * 14);
    hLine(g, x, y, 2, "tealDeep");
  }
  return g;
}

/** Mossy stone floor — walkable. Redrawn for the 2.5D pass (SoM organic
 *  school): mauve rock with plum wear pockets, cushioned over by rounded
 *  jade moss lobes with mint upper-left highlights — no bands, no speckle. */
function groveMoss(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "mauve");
  // plum wear pockets in the stone
  hLine(g, 3, 12, 3, "plum");
  hLine(g, 4, 13, 2, "plum");
  hLine(g, 10, 3, 3, "plum");
  // rounded moss cushions (5-8px lobes, NNW-lit)
  canopyLobes(g, seed, {
    lobes: 6,
    rMin: 1.8,
    rMax: 2.6,
    base: "jade",
    highlight: "mint",
    crevice: "tealDeep"
  });
  return g;
}

/** The sunbeam shaft floor — walkable and the BRIGHTEST tile in the set:
 *  grass washed pale gold where the cave-in lets desert light straight down.
 *  bone/sandLight ground shot through with amber and a few jade blades. */
function sunbeam(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "sandLight");
  const rng = mulberry32(seed);
  // soft bone pooling — rounded patches, no hard rectangle (§5: the beam is
  // a soft additive column, not a painted band)
  for (let i = 0; i < 2; i++) {
    const cx = 3 + Math.floor(rng() * 10);
    const cy = 3 + Math.floor(rng() * 10);
    ellipse(g, cx, cy, 2.5, 1.8, "bone");
  }
  // warm amber pooling at the beam's soft edges (2px clusters)
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rng() * 13);
    const y = 1 + Math.floor(rng() * 14);
    hLine(g, x, y, 2, "amber");
  }
  // a few jade blades poke through the light (paired, no lone pixels)
  g.px(3, 11, "jade");
  g.px(4, 10, "jade");
  g.px(11, 13, "jade");
  g.px(12, 12, "jade");
  return g;
}

/** Cinnabar cave wall — SOLID. Dark ink/plum stone with a rust-cinnabar vein
 *  and a little jade moss creeping up from the grove; clearly the darkest,
 *  heaviest tile so the walls read hard against the lush floor. */
/** Redrawn for the 2.5D pass as the TOP of the cave-wall mass (its south
 *  facade now comes from `caveWallFace`): plum rock, ink fissures, a
 *  cinnabar vein, mauve facet chips and creeping moss — no full-width
 *  bands, no speckle. Still the darkest, heaviest tile in the set. */
function caveWall(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "plum");
  // ink fissures (staggered)
  for (const [x, y] of [
    [5, 2],
    [9, 6],
    [2, 8],
    [13, 5],
    [7, 12],
  ] as const) {
    g.rect(x, y, 1, 3, "ink");
  }
  // cinnabar (rust) ore vein wandering through
  for (const [x, y] of [
    [3, 3],
    [4, 4],
    [10, 2],
    [11, 3],
    [12, 9],
    [6, 7],
  ] as const) {
    g.px(x, y, "rust");
  }
  // mauve facet chips catching what little light reaches the rock
  const rng = mulberry32(seed);
  hLine(g, 2 + Math.floor(rng() * 4), 1, 3, "mauve");
  hLine(g, 8, 10, 3, "mauve");
  // moss creeping across the foot
  hLine(g, 1, 13, 2, "jade");
  hLine(g, 12, 14, 2, "teal");
  return g;
}

/** Collapsed rubble from the cave-in — SOLID. A heap of ink/mauve broken
 *  stone with jade moss and vines beginning to reclaim it. */
function collapsedRock(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(2, 6, 12, 8, "mauve");
    l.rect(3, 4, 9, 3, "mauve");
    l.rect(1, 10, 14, 4, "plum"); // shaded pile foot
    // broken block facets
    l.px(3, 6, "mauve");
    l.px(4, 5, "clay"); // a lit facet
    l.px(11, 6, "clay");
    l.rect(6, 8, 3, 2, "ink"); // a dark gap between blocks
    l.px(9, 11, "ink");
    // moss + vine reclaiming the rubble
    l.px(2, 6, "jade");
    l.px(8, 5, "jade");
    l.px(13, 7, "teal");
    l.px(5, 13, "mint");
  });
}

/** Mossy grove boulder draped in vines — SOLID walk-around. */
function vineRock(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(3, 5, 10, 9, "mauve");
    l.rect(4, 4, 8, 1, "mauve");
    l.px(3, 5, "clay"); // lit top-left
    l.px(4, 4, "clay");
    l.rect(9, 10, 3, 3, "plum"); // shade
    // moss cap
    for (const [x, y] of [
      [4, 4],
      [6, 4],
      [8, 4],
      [10, 4],
      [5, 5],
      [11, 5],
    ] as const) {
      l.px(x, y, "jade");
    }
    l.px(6, 4, "mint");
    // vines hanging down the face
    for (const vx of [5, 9, 12] as const) {
      for (let y = 6; y < 14; y++) l.px(vx, y, y % 2 ? "teal" : "jade");
    }
  });
}

/** Fern clump — SOLID leafy walk-around: arching jade/mint fronds. */
function fern(): PixelGrid {
  return stamp(tile(), (l) => {
    // crown of arching fronds from a low base
    for (const [dx, dir] of [
      [-1, -1],
      [0, 0],
      [1, 1],
    ] as const) {
      const bx = 8 + dx * 3;
      for (let i = 0; i < 8; i++) {
        const x = bx + dir * i;
        const y = 13 - i;
        l.px(x, y, i < 5 ? "jade" : "mint"); // lit tips
        l.px(x + dir, y, "teal");
      }
    }
    l.rect(7, 12, 3, 2, "teal"); // root tuft
    l.px(8, 13, "tealDeep");
  });
}

/** The underground river — SOLID. Clear sky-lit water: teal/skyBlue with a
 *  bone glint. `phase` drifts the ripples so groveWater ↔ groveWater2
 *  animate like the desert pond / the sea. */
function groveWater(phase: 0 | 1): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "teal");
  const d = phase;
  g.rect(0, 9, TILE_SIZE, 7, "tealDeep"); // deeper channel
  // sky reflected in the clear water (this river sees the cave-in's light)
  for (const [ry, len, rx] of [
    [2, 5, 1],
    [5, 4, 8],
    [10, 5, 2],
    [13, 3, 10],
  ] as const) {
    const y = (ry + d) % TILE_SIZE;
    for (let i = 0; i < len; i++) g.px((rx + i + d) % TILE_SIZE, y, "skyBlue");
  }
  // white sparkle where the light hits the surface
  g.px((5 + d) % TILE_SIZE, (3 + d) % TILE_SIZE, "white");
  g.px((12 + d) % TILE_SIZE, 7, "bone");
  g.px((3 + d) % TILE_SIZE, (11 + d) % TILE_SIZE, "white");
  return g;
}

/** Wet river stones — walkable stepping-stone/bank tile: slate/mauve rock
 *  beaded with skyBlue water, set into the grass. */
function riverStone(): PixelGrid {
  return stamp(grassBase(614), (l) => {
    for (const [x, y, w, h] of [
      [2, 4, 4, 3],
      [8, 3, 5, 4],
      [4, 9, 5, 4],
      [10, 10, 4, 3],
    ] as const) {
      l.rect(x, y, w, h, "slate");
      l.px(x, y, "skyBlue"); // wet lit edge
      l.px(x + w - 1, y + h - 1, "plum"); // shade
    }
    l.px(9, 4, "skyBlue"); // water beads
    l.px(5, 10, "white");
    l.px(12, 11, "skyBlue");
  });
}

/** Orange-tree trunk — SOLID. Clay/rust bark, the base of the one tree at
 *  the centre of the grove; the canopy is the separate OVERHEAD tile above. */
function orangeTreeTrunk(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(5, 0, 6, 16, "clay");
    l.rect(5, 0, 1, 16, "amber"); // lit left edge
    l.rect(10, 0, 1, 16, "rust"); // shaded right edge
    // bark seams + a knot
    for (const y of [3, 7, 11, 14]) l.rect(6, y, 4, 1, "rust");
    l.px(7, 5, "ink");
    l.px(8, 9, "rust");
    // roots spreading into the grass
    l.px(4, 14, "clay");
    l.px(3, 15, "clay");
    l.px(11, 14, "clay");
    l.px(12, 15, "clay");
  });
}

/** Orange-tree canopy — the one OVERHEAD tile: transparent background, a
 *  leafy jade/teal crown studded with ripe amber oranges, drawn above the
 *  actors so the party passes *under* the tree at the grove's centre. */
function orangeTreeCanopy(): PixelGrid {
  const g = tile();
  // rounded leaf mass
  g.rect(3, 2, 10, 10, "jade");
  g.rect(2, 4, 12, 6, "jade");
  g.rect(5, 1, 6, 1, "jade");
  g.rect(4, 12, 8, 1, "jade");
  // depth: teal shade in the lower/right, mint lit crown top-left
  g.rect(8, 8, 5, 4, "teal");
  g.px(3, 3, "mint");
  g.px(5, 2, "mint");
  g.px(4, 5, "mint");
  g.px(2, 6, "mint");
  // ripe oranges tucked in the leaves
  for (const [x, y] of [
    [5, 5],
    [10, 4],
    [7, 8],
    [11, 9],
    [4, 9],
    [9, 11],
  ] as const) {
    g.px(x, y, "amber");
    g.px(x + 1, y, "clay"); // shaded side of the fruit
    g.px(x, y - 1, "atbGold"); // sunlit top
  }
  g.outline("ink");
  return g;
}

/**
 * The wild orange canopy's footprint, relative to its own 5x4 bounding box
 * — matches the overhead cells `groveChamberMap.ts` places the tree's
 * canopy at exactly (x 13..17, y 6..9 there = col 0..4, row 0..3 here): a
 * full oval, wider than the original diamond so the tree reads as a fuller
 * "large elegant wild tree" rather than a lonely point at top/bottom.
 * true = this cell grows canopy. `generateCanopyPieces` (canopy.ts) grows
 * ONE big lobed leaf mass across the whole true region and slices it into
 * these 16 pieces, instead of the original approach of stamping one small,
 * individually-outlined `orangeTreeCanopy` tile at every position — twelve
 * (now sixteen) copies of the same little blob is exactly why it read as
 * "a series of circles" rather than one tree.
 */
const ORANGE_CANOPY_FOOTPRINT: CanopyFootprint = [
  [false, true, true, true, false],
  [true, true, true, true, true],
  [true, true, true, true, true],
  [false, true, true, true, false]
];

/** Row-major order of `ORANGE_CANOPY_FOOTPRINT`'s true cells — must line up
 *  1:1 with `generateCanopyPieces`' Map iteration order (also row-major)
 *  and with the `orangeCanopy_r{row}c{col}` block appended to
 *  `TILE6_NAMES`. 16 pieces so the sheet's 8-tile column width divides
 *  evenly (48 existing + 16 = 64 = 8x8) — a coincidence that also happens
 *  to be the fuller, better-looking footprint on its own merits. */
const ORANGE_CANOPY_NAMES = [
  "orangeCanopy_r0c1",
  "orangeCanopy_r0c2",
  "orangeCanopy_r0c3",
  "orangeCanopy_r1c0",
  "orangeCanopy_r1c1",
  "orangeCanopy_r1c2",
  "orangeCanopy_r1c3",
  "orangeCanopy_r1c4",
  "orangeCanopy_r2c0",
  "orangeCanopy_r2c1",
  "orangeCanopy_r2c2",
  "orangeCanopy_r2c3",
  "orangeCanopy_r2c4",
  "orangeCanopy_r3c1",
  "orangeCanopy_r3c2",
  "orangeCanopy_r3c3"
] as const;

/** The 16 orange-canopy pieces, in `ORANGE_CANOPY_NAMES` order. Fruit is
 *  scattered sparsely across the WHOLE mass (14 across 16 tiles) rather
 *  than a fixed six per tile — a large tree with a handful of visible
 *  ripe oranges reads as elegant; six per every tile (72 total) is what
 *  made the original look overstuffed as well as blobby. */
function orangeCanopyPieces(): PixelGrid[] {
  const pieces = generateCanopyPieces(ORANGE_CANOPY_FOOTPRINT, 6150, {
    base: "jade",
    highlight: "mint",
    crevice: "tealDeep",
    lobesPerCell: 2.5,
    fruit: { count: 14, fruit: "amber", fruitShade: "clay", fruitGlint: "atbGold" }
  });
  return ORANGE_CANOPY_NAMES.map((name) => {
    const key = name.replace("orangeCanopy_", "");
    const piece = pieces.get(key);
    if (!piece) throw new Error(`generateCanopyPieces: missing piece for ${name} (key ${key})`);
    return piece;
  });
}

/** The grove's oldest row — walkable landmark: windfall oranges piled in the
 *  grass, the ripe ones Piggy (and Sahra's trade) are after. */
function oldOrange(): PixelGrid {
  const g = tile();
  for (const [x, y] of [
    [3, 4],
    [6, 6],
    [10, 5],
    [12, 9],
    [5, 11],
    [9, 12],
    [8, 8],
  ] as const) {
    g.px(x, y, "amber");
    g.px(x + 1, y, "amber");
    g.px(x, y + 1, "clay"); // shaded underside
    g.px(x + 1, y - 1, "atbGold"); // sunlit pip
    g.px(x, y - 1, "jade"); // a leaf still on the stem
  }
  return g;
}

/** Dense needle-cactus — SOLID. The thicket too tight for Joseph to follow
 *  Piggy into: a wall of jade/teal paddles bristling with bone/sand spines. */
function needleCactus(): PixelGrid {
  return stamp(tile(), (l) => {
    // clustered paddles
    l.rect(2, 5, 4, 9, "teal");
    l.rect(6, 2, 4, 12, "jade");
    l.rect(10, 6, 4, 8, "teal");
    // lit and shaded edges
    l.rect(6, 2, 1, 12, "mint");
    l.rect(2, 5, 1, 9, "jade");
    l.rect(13, 6, 1, 8, "tealDeep");
    l.rect(9, 2, 1, 12, "tealDeep");
    // bristling spines (bone/sand), dense
    for (let y = 3; y < 14; y += 2) {
      for (let x = 2; x < 14; x += 2) {
        l.px(x, y, (x + y) % 4 === 0 ? "bone" : "sand");
      }
    }
  });
}

/** Grove wildflower — walkable decor: a bright bloom in the turf. */
function groveFlower(): PixelGrid {
  const g = grassBase(618);
  // a couple of blooms: amber/atbGold petals around a bone centre
  const bloom = (cx: number, cy: number, petal: "amber" | "hpRed") => {
    g.px(cx, cy - 1, petal);
    g.px(cx - 1, cy, petal);
    g.px(cx + 1, cy, petal);
    g.px(cx, cy + 1, petal);
    g.px(cx, cy, "bone");
  };
  bloom(4, 5, "amber");
  bloom(11, 8, "hpRed");
  bloom(7, 12, "amber");
  // stems
  g.px(4, 6, "jade");
  g.px(11, 9, "jade");
  g.px(7, 13, "jade");
  return g;
}

// ---------------------------------------------------------------------------
// 2.5D dressing append (Phase Z, docs/ART_DIRECTION.md §2/§5).
// ---------------------------------------------------------------------------

/** 2x2 chip motif. */
function chip(c: "rust" | "jade"): PixelGrid {
  const m = new PixelGrid(2, 2);
  m.rect(0, 0, 2, 2, c);
  return m;
}

/** The lit top of a cave-wall run (§2 Cap): mauve stone, clay lit lip,
 *  cinnabar and moss chips on the surface. */
function caveWallCap(seed: number): PixelGrid {
  const g = makeCap({
    base: "mauve",
    lip: "clay",
    lipThickness: 2,
    seed,
    motifs: [chip("rust"), chip("jade")],
    motifCount: 3
  });
  hLine(g, 3 + (seed % 4), 8, 2, "plum"); // a hairline seam
  // thin dark north edge (§2: north-facing edges stay thin — cap + edge line)
  g.rect(0, 0, TILE_SIZE, 1, "plum");
  return g;
}

/** The vertical south face of a cave wall (§2 Face, G10): mauve → plum
 *  gradient, broken strata, ink foot line, a rust vein and moss overhang. */
function caveWallFace(seed: number): PixelGrid {
  const g = makeFace({ top: "mauve", mid: "plum", bottom: "plum", foot: "ink", seed });
  // break the gradient boundary with 2px cluster dither (G7)
  clusterDither(g, { x: 0, y: 4, w: TILE_SIZE, h: 3 }, "mauve", "plum", seed ^ 0x55, {
    density: 0.5
  });
  // moss spilling over the lip above
  hLine(g, 2 + (seed % 5), 0, 2, "jade");
  hLine(g, 10, 0, 2, "teal");
  // a glint of cinnabar mid-face
  g.px(6 + (seed % 3), 7, "rust");
  g.px(7 + (seed % 3), 8, "rust");
  return g;
}

/** All contract tiles in order (see TILE6_NAMES). */
export function tile6Frames(): PixelGrid[] {
  // Moss owns its border against the grass: a grass band eaten into by
  // rounded jade moss fingers (SoM organic school, hand-AA'd — no dither).
  const mossGrass = makeEdgeSet(groveMoss(603), grassBase(601), {
    style: "fingers",
    fingerColor: "jade",
    bandDepth: 5,
    seed: 630,
    fingerOpts: { density: 0.5 }
  });
  // The sunbeam's soft edge: the beam owns its border against the grass — a
  // grass band with sandLight fingers of spilled light reaching into it, so
  // the shaft has no hard rectangle edge (§5).
  const sunGrass = makeEdgeSet(sunbeam(604), grassBase(601), {
    style: "fingers",
    fingerColor: "sandLight",
    bandDepth: 4,
    seed: 650,
    fingerOpts: { density: 0.55 }
  });
  // The riverbank lip: grass owns its border against the grove river — dark
  // turf lip, broken bone waterline glint, skyBlue shallows, open water.
  const bank = makeEdgeSet(grassBase(601), groveWater(0), {
    style: "surf",
    seed: 640,
    surfLip: "tealDeep",
    surfLipThickness: 2,
    fringeColor: "bone",
    fringeDepth: 2,
    shallowColor: "skyBlue",
    shallowDepth: 2,
    waterDepth: 3
  });
  return [
    grassBase(601),
    grassBase(602),
    groveMoss(603),
    sunbeam(604),
    caveWall(605),
    collapsedRock(),
    vineRock(),
    fern(),
    groveWater(0),
    groveWater(1),
    riverStone(),
    orangeTreeTrunk(),
    orangeTreeCanopy(),
    oldOrange(),
    needleCactus(),
    groveFlower(),
    // --- 2.5D dressing append (Phase Z) ---
    caveWallCap(631),
    caveWallCap(632),
    caveWallFace(641),
    caveWallFace(642),
    makeShadeVariant(grassBase(601)),
    makeShadeVariant(groveMoss(603)),
    makeShadeVariant(oldOrange()),
    makeShadeVariant(riverStone()),
    mossGrass.edges.n,
    mossGrass.edges.e,
    mossGrass.edges.s,
    mossGrass.edges.w,
    mossGrass.outerCorners.ne,
    mossGrass.outerCorners.nw,
    mossGrass.outerCorners.se,
    mossGrass.outerCorners.sw,
    bank.edges.n,
    bank.edges.e,
    bank.edges.s,
    bank.edges.w,
    bank.outerCorners.ne,
    bank.outerCorners.nw,
    bank.outerCorners.se,
    bank.outerCorners.sw,
    sunGrass.edges.n,
    sunGrass.edges.e,
    sunGrass.edges.s,
    sunGrass.edges.w,
    sunGrass.outerCorners.ne,
    sunGrass.outerCorners.nw,
    sunGrass.outerCorners.se,
    sunGrass.outerCorners.sw,
    // --- wild orange canopy append (post-ship fix) ---
    ...orangeCanopyPieces(),
  ];
}
