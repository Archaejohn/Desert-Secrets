/**
 * Tileset — sixteen 16×16 tiles in the exact contract order.
 *
 * Ground tiles are fully opaque (sand or water base) so maps never show
 * holes. Props (rock, cactus, pot, pillar, palm) are stamped onto the base:
 * drawn on their own transparent grid, ink-outlined, then blitted — which is
 * how they get contours without outlining the whole tile.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";

export const TILE_SIZE = 16;

/** Contract tile order (row-major indices 0..15). */
export const TILE_NAMES = [
  "sand",
  "sand2",
  "sand3",
  "duneEdge",
  "rock",
  "cactus",
  "brick",
  "brickCracked",
  "water",
  "water2",
  "palmTrunk",
  "palmTop",
  "pot",
  "bones",
  "ruinPillar",
  "sandSparkle"
] as const;

export type TileName = (typeof TILE_NAMES)[number];

function tile(): PixelGrid {
  return new PixelGrid(TILE_SIZE, TILE_SIZE);
}

/** Sand base with deterministic speckle. Each caller passes its own seed so
 *  the three sand variants (and every prop tile) get distinct grain. */
function sandBase(seed: number, speckles = 14): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "sand");
  const rng = mulberry32(seed);
  for (let i = 0; i < speckles; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * TILE_SIZE);
    g.px(x, y, rng() < 0.5 ? "amber" : "sandLight");
  }
  return g;
}

/** Draw a prop on a transparent layer, ink-outline it, stamp it on `base`. */
function stamp(base: PixelGrid, draw: (layer: PixelGrid) => void): PixelGrid {
  const layer = tile();
  draw(layer);
  layer.outline("ink");
  base.blit(layer, 0, 0);
  return base;
}

function duneEdge(): PixelGrid {
  const g = sandBase(4, 8);
  for (let x = 0; x < TILE_SIZE; x++) {
    const y = 7 - Math.floor(x / 5); // gentle diagonal crest
    g.px(x, y - 1, "sandLight");
    g.px(x, y, "sandLight");
    g.px(x, y + 1, "amber"); // wind-shadow under the crest
  }
  return g;
}

function rock(): PixelGrid {
  return stamp(sandBase(5, 8), (l) => {
    l.rect(4, 6, 8, 6, "mauve");
    l.rect(5, 5, 6, 1, "mauve");
    l.rect(5, 12, 6, 1, "mauve");
    // sunlit top-left, plum shade bottom-right
    l.px(5, 5, "clay");
    l.px(6, 5, "clay");
    l.px(4, 6, "clay");
    l.px(5, 6, "clay");
    l.rect(8, 10, 3, 2, "plum");
    l.rect(9, 12, 2, 1, "plum");
    l.px(11, 9, "plum");
  });
}

function cactus(): PixelGrid {
  return stamp(sandBase(6, 8), (l) => {
    l.rect(7, 2, 2, 12, "jade"); // trunk
    // left arm (out then up)
    l.px(6, 8, "jade");
    l.px(5, 8, "jade");
    l.px(5, 7, "jade");
    l.px(5, 6, "jade");
    // right arm
    l.px(9, 10, "jade");
    l.px(10, 10, "jade");
    l.px(10, 9, "jade");
    l.px(10, 8, "jade");
    // shading + bloom
    for (let y = 3; y <= 13; y++) l.px(8, y, "teal");
    l.px(7, 2, "mint");
  });
}

function brickBase(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "mauve");
  // mortar courses
  for (const y of [3, 7, 11, 15]) g.rect(0, y, TILE_SIZE, 1, "plum");
  // staggered head joints
  for (let course = 0; course < 4; course++) {
    const y = course * 4;
    const offset = course % 2 === 0 ? 5 : 1;
    for (let x = offset; x < TILE_SIZE; x += 8) g.rect(x, y, 1, 3, "plum");
  }
  // a few weathered rust bricks + top-light on brick tops
  g.rect(6, 4, 5, 3, "rust");
  g.rect(2, 12, 4, 3, "rust");
  g.px(0, 0, "clay");
  g.px(1, 0, "clay");
  g.px(6, 4, "clay");
  g.px(2, 12, "clay");
  return g;
}

function brickCracked(): PixelGrid {
  const g = brickBase();
  // jagged crack down the face, with a chipped pocket
  const crack: Array<[number, number]> = [
    [8, 0],
    [8, 1],
    [7, 2],
    [8, 3],
    [9, 4],
    [9, 5],
    [8, 6],
    [7, 7],
    [7, 8],
    [8, 9],
    [9, 10],
    [9, 11],
    [10, 12],
    [10, 13],
    [11, 14],
    [11, 15]
  ];
  for (const [x, y] of crack) g.px(x, y, "ink");
  g.rect(6, 7, 2, 2, "plum"); // chipped pocket
  g.px(12, 14, "plum");
  return g;
}

function water(phase: 0 | 1): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "tealDeep");
  // ripple bands drift one pixel between the two frames
  const d = phase;
  for (const [ry, len, rx] of [
    [3, 5, 2],
    [4, 3, 9],
    [8, 4, 5],
    [9, 3, 12],
    [13, 5, 1],
    [12, 3, 10]
  ] as const) {
    const y = (ry + d) % TILE_SIZE;
    for (let i = 0; i < len; i++) g.px((rx + i + d) % TILE_SIZE, y, "teal");
  }
  // sky glints on the crests
  g.px((3 + d) % TILE_SIZE, (3 + d) % TILE_SIZE, "skyBlue");
  g.px((13 + d) % TILE_SIZE, 9, "skyBlue");
  g.px((6 + d) % TILE_SIZE, (13 + d) % TILE_SIZE, "skyBlue");
  return g;
}

function palmTrunk(): PixelGrid {
  return stamp(sandBase(7, 8), (l) => {
    l.rect(6, 0, 4, 16, "clay");
    for (const y of [2, 5, 8, 11, 14]) l.rect(6, y, 4, 1, "rust"); // ring bands
    for (let y = 0; y < 16; y++) if (y % 3 !== 2) l.px(6, y, "amber"); // lit edge
  });
}

function palmTop(): PixelGrid {
  return stamp(sandBase(8, 8), (l) => {
    // crown centre over the trunk line
    l.rect(7, 9, 2, 2, "clay");
    // fronds: sideways, upward and drooping diagonals
    l.rect(2, 8, 5, 1, "jade");
    l.rect(9, 8, 5, 1, "jade");
    l.px(3, 9, "teal");
    l.px(4, 9, "teal");
    l.px(11, 9, "teal");
    l.px(12, 9, "teal");
    l.px(6, 7, "jade");
    l.px(5, 6, "jade");
    l.px(4, 5, "jade");
    l.px(9, 7, "jade");
    l.px(10, 6, "jade");
    l.px(11, 5, "jade");
    l.px(7, 6, "jade");
    l.px(7, 5, "jade");
    l.px(8, 6, "jade");
    l.px(8, 4, "jade");
    // sun-tips
    l.px(2, 8, "mint");
    l.px(13, 8, "mint");
    l.px(8, 3, "mint");
    l.px(4, 4, "mint");
    l.px(12, 4, "mint");
  });
}

function pot(): PixelGrid {
  return stamp(sandBase(9, 8), (l) => {
    l.rect(6, 3, 4, 1, "rust"); // rim
    l.rect(6, 4, 4, 2, "clay"); // neck
    l.rect(5, 6, 6, 5, "clay"); // belly
    l.rect(6, 11, 4, 1, "clay"); // foot
    l.rect(7, 12, 2, 1, "rust"); // base
    // light left, shade right
    l.px(5, 6, "amber");
    l.px(5, 7, "amber");
    l.px(6, 6, "amber");
    l.px(6, 4, "amber");
    for (let y = 7; y <= 10; y++) l.px(10, y, "rust");
  });
}

function bones(): PixelGrid {
  // half-buried remains: soft rust shadows instead of hard ink outlines
  const g = sandBase(10, 8);
  g.rect(3, 8, 9, 1, "bone"); // spine
  for (const x of [4, 6, 8, 10]) {
    g.px(x, 6, "bone");
    g.px(x, 7, "bone");
    g.px(x, 9, "bone");
    g.px(x, 10, "bone");
    g.px(x, 11, "rust"); // shadow under each rib
  }
  // skull
  g.rect(12, 5, 3, 3, "bone");
  g.px(12, 8, "bone");
  g.px(13, 8, "bone");
  g.px(13, 6, "ink"); // eye socket
  g.px(14, 9, "rust");
  return g;
}

function ruinPillar(): PixelGrid {
  return stamp(sandBase(11, 8), (l) => {
    l.rect(4, 0, 8, 2, "mauve"); // capital
    l.rect(5, 2, 6, 12, "mauve"); // shaft
    l.rect(4, 14, 8, 2, "mauve"); // base
    // lit left edge, plum flutes and shade
    for (let y = 2; y <= 13; y++) l.px(5, y, "clay");
    for (let y = 3; y <= 13; y += 3) l.px(8, y, "plum");
    for (let y = 2; y <= 13; y++) l.px(10, y, "plum");
    l.rect(4, 1, 8, 1, "plum");
    l.rect(5, 15, 7, 1, "plum");
    l.px(4, 0, "clay");
    l.px(5, 0, "clay");
    l.px(9, 7, "plum"); // old chip
  });
}

function sandSparkle(): PixelGrid {
  const g = sandBase(12, 10);
  // four-point glints — something is buried here
  g.px(4, 5, "white");
  g.px(3, 5, "mint");
  g.px(5, 5, "mint");
  g.px(4, 4, "mint");
  g.px(4, 6, "mint");
  g.px(11, 11, "white");
  g.px(10, 11, "mint");
  g.px(12, 11, "mint");
  g.px(11, 10, "mint");
  g.px(11, 12, "mint");
  g.px(12, 3, "mint");
  g.px(7, 13, "mint");
  return g;
}

/** All 16 tiles in contract order (see TILE_NAMES). */
export function tileFrames(): PixelGrid[] {
  return [
    sandBase(1),
    sandBase(2),
    sandBase(3),
    duneEdge(),
    rock(),
    cactus(),
    brickBase(),
    brickCracked(),
    water(0),
    water(1),
    palmTrunk(),
    palmTop(),
    pot(),
    bones(),
    ruinPillar(),
    sandSparkle()
  ];
}
