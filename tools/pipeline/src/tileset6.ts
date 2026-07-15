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
import { TILE_SIZE } from "./tileset";

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

/** Lush river-fed grass — walkable. Jade/teal turf with mint highlights and
 *  a scatter of amber sun-flecks. `seed` varies the speckle grain. */
function grassBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "teal");
  // brighter jade blades in a loose weave
  for (const [x, y] of [
    [1, 2],
    [5, 1],
    [9, 3],
    [13, 1],
    [3, 6],
    [11, 6],
    [7, 8],
    [2, 11],
    [14, 10],
    [6, 13],
    [10, 13],
  ] as const) {
    g.px(x, y, "jade");
    g.px(x, y + 1, "jade");
  }
  // deep tealDeep shade pockets
  g.px(4, 9, "tealDeep");
  g.px(12, 12, "tealDeep");
  g.px(8, 4, "tealDeep");
  const rng = mulberry32(seed);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * TILE_SIZE);
    g.px(x, y, rng() < 0.5 ? "mint" : "amber"); // dew + sun-flecks
  }
  return g;
}

/** Mossy stone floor — walkable. Mauve rock furred over with jade/mint moss;
 *  a darker, cooler walkable grain than the open grass. */
function groveMoss(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "mauve");
  g.rect(0, 10, TILE_SIZE, 6, "plum"); // shaded lower stone
  // moss crust
  for (const [x, y] of [
    [1, 1],
    [4, 2],
    [8, 1],
    [12, 2],
    [2, 5],
    [6, 5],
    [10, 6],
    [14, 5],
    [3, 9],
    [9, 10],
    [13, 11],
  ] as const) {
    g.px(x, y, "jade");
    g.px(x + 1, y, "teal");
  }
  const rng = mulberry32(seed);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * TILE_SIZE);
    g.px(x, y, "mint");
  }
  return g;
}

/** The sunbeam shaft floor — walkable and the BRIGHTEST tile in the set:
 *  grass washed pale gold where the cave-in lets desert light straight down.
 *  bone/sandLight ground shot through with amber and a few jade blades. */
function sunbeam(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "sandLight");
  g.rect(0, 0, TILE_SIZE, 6, "bone"); // brightest at the top of the shaft
  // warm amber pooling
  for (const [x, y] of [
    [2, 8],
    [6, 10],
    [10, 9],
    [13, 12],
    [4, 13],
    [8, 6],
  ] as const) {
    g.px(x, y, "amber");
  }
  // a few jade blades poke through the light
  g.px(3, 11, "jade");
  g.px(11, 13, "jade");
  g.px(7, 12, "jade");
  const rng = mulberry32(seed);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * TILE_SIZE);
    g.px(x, y, rng() < 0.5 ? "white" : "sandLight"); // motes in the light
  }
  return g;
}

/** Cinnabar cave wall — SOLID. Dark ink/plum stone with a rust-cinnabar vein
 *  and a little jade moss creeping up from the grove; clearly the darkest,
 *  heaviest tile so the walls read hard against the lush floor. */
function caveWall(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "plum");
  g.rect(0, 11, TILE_SIZE, 5, "ink"); // shadowed base
  g.rect(0, 0, TILE_SIZE, 1, "mauve"); // faint lit top
  // cinnabar (rust) ore veins
  for (const [x, y] of [
    [3, 3],
    [4, 4],
    [10, 2],
    [11, 3],
    [7, 6],
    [12, 9],
  ] as const) {
    g.px(x, y, "rust");
  }
  // mortar cracks
  for (const [x, y] of [
    [5, 2],
    [9, 6],
    [2, 8],
    [13, 5],
  ] as const) {
    g.rect(x, y, 1, 3, "ink");
  }
  // moss creeping in from below
  g.px(1, 11, "jade");
  g.px(6, 12, "jade");
  g.px(14, 11, "teal");
  const rng = mulberry32(seed);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * 10);
    g.px(x, y, "mauve");
  }
  return g;
}

/** Collapsed rubble from the cave-in — SOLID. A heap of ink/mauve broken
 *  stone with jade moss and vines beginning to reclaim it. */
function collapsedRock(): PixelGrid {
  return stamp(grassBase(611), (l) => {
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
  return stamp(grassBase(612), (l) => {
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
  return stamp(grassBase(613), (l) => {
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
  return stamp(grassBase(615), (l) => {
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

/** The grove's oldest row — walkable landmark: windfall oranges piled in the
 *  grass, the ripe ones Piggy (and Sahra's trade) are after. */
function oldOrange(): PixelGrid {
  const g = grassBase(616);
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
  return stamp(grassBase(617), (l) => {
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

/** All 16 tiles in contract order (see TILE6_NAMES). */
export function tile6Frames(): PixelGrid[] {
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
  ];
}
