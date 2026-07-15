/**
 * Tileset 2 — the Act 1 tiles in the exact contract order
 * (docs/CONTRACTS.md §4): the crash-site highway, the gas station, the mine
 * and the frozen depths, plus (appended additively, docs/CONTRACTS.md "v9")
 * eight desert mountain ridge variants used by the overworld POC, plus
 * (appended additively again, docs/CONTRACTS.md "Phase O") the overworld
 * ground vocabulary of the 2.5D art pass: scree, foot-shadow and shade
 * tiles, the sand↔scree finger-transition set and the coast surf ring.
 *
 * Same rules as tileset.ts: every tile fully opaque, props stamped onto an
 * opaque base via a transparent outlined layer. 2.5D art pass (Phase O):
 * per-pixel speckle was replaced everywhere in this file by sparse 2×2
 * motif clusters (ART_DIRECTION G5/G6), the sand base is now shared with
 * tileset.ts (same dune-ridge lanes, so every sand-based tile here seams
 * against the sand plain), and mountain1–8 were redrawn in place with the
 * FF6 3/4-view recipe. tiles2.png's sha256 is deliberately re-pinned in
 * tests/pipeline/determinism.test.ts for this pass.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { TILE_SIZE, sandBase, water } from "./tileset";
import { scatterMotifs, shadeGrid, type Motif } from "./fx";
import { makeEdgeSet } from "./tilecraft";
import type { PaletteName } from "../../../src/shared/palette";

/** Contract tile order (row-major indices 0..55). */
export const TILE2_NAMES = [
  "asphalt",
  "asphaltLine",
  "truckCab",
  "truckBox",
  "crateBroken",
  "joshuaTrunk",
  "joshuaTop",
  "creosote",
  "stationWall",
  "stationWindow",
  "stationSign",
  "gasPump",
  "mineWall",
  "mineFloor",
  "mineTimber",
  "rail",
  "cart",
  "lever",
  "leverOn",
  "iceWall",
  "iceWallCrack",
  "frostSand",
  "iceChip",
  "eggCluster",
  "mountain",
  "mountain2",
  "mountain3",
  "mountain4",
  "mountain5",
  "mountain6",
  "mountain7",
  "mountain8",
  // --- Phase O appendix (2.5D art pass, ART_DIRECTION §4a) ---
  "scree",
  "scree2",
  "screeShade",
  "sandShade",
  "coastN",
  "coastE",
  "coastS",
  "coastW",
  "coastNE",
  "coastNW",
  "coastSE",
  "coastSW",
  "coastInNE",
  "coastInNW",
  "coastInSE",
  "coastInSW",
  "screeSandN",
  "screeSandE",
  "screeSandS",
  "screeSandW",
  "screeSandNE",
  "screeSandNW",
  "screeSandSE",
  "screeSandSW"
] as const;

export type Tile2Name = (typeof TILE2_NAMES)[number];

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

function motifStamp(cells: Array<[number, number, PaletteName]>): PixelGrid {
  const w = Math.max(...cells.map(([x]) => x)) + 1;
  const h = Math.max(...cells.map(([, y]) => y)) + 1;
  const m = new PixelGrid(w, h);
  for (const [x, y, c] of cells) m.px(x, y, c);
  return m;
}

const square = (c: PaletteName): PixelGrid =>
  motifStamp([
    [0, 0, c],
    [1, 0, c],
    [0, 1, c],
    [1, 1, c]
  ]);

/** Cracked desert highway: plum base, mauve wear bands (no speckle, G5). */
function asphaltBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "plum");
  scatterMotifs(
    g,
    seed,
    [
      square("mauve"),
      motifStamp([
        [0, 0, "mauve"],
        [1, 0, "mauve"],
        [2, 0, "mauve"],
        [0, 1, "mauve"],
        [1, 1, "ink"],
        [2, 1, "mauve"]
      ])
    ],
    3,
    { margin: 1, minSpacing: 5 }
  );
  // sun-bleached wear patch
  g.rect(2, 10, 4, 2, "mauve");
  return g;
}

function asphaltLine(): PixelGrid {
  const g = asphaltBase(21);
  // faded dashed centre line, horizontal so the road runs left-right
  g.rect(1, 7, 5, 2, "sandLight");
  g.rect(9, 7, 5, 2, "sandLight");
  g.px(5, 8, "sand"); // worn dash ends
  g.px(9, 7, "sand");
  return g;
}

/** Truck cab (left tile) — nose left, cab body flush to the right edge so
 *  it joins truckBox. Crashed: buckled hood, cracked windshield, flat tire. */
function truckCab(): PixelGrid {
  return stamp(sandBase(22, 1), (l) => {
    // hood, buckled up at the crash point
    l.rect(1, 7, 5, 4, "rust");
    l.px(1, 6, "rust"); // crumpled lip
    l.px(2, 6, "clay");
    l.rect(1, 7, 2, 1, "clay"); // lit edge
    // cab box, flush to the right edge (joins the box tile)
    l.rect(6, 3, 10, 8, "rust");
    l.rect(6, 3, 10, 1, "clay"); // roof light
    // windshield, cracked
    l.rect(7, 4, 4, 3, "skyBlue");
    l.px(8, 5, "ink"); // crack
    l.px(9, 4, "ink");
    l.px(9, 6, "ink");
    // door seam + handle
    l.rect(13, 5, 1, 5, "plum");
    l.px(14, 6, "clay");
    // skirt
    l.rect(2, 11, 14, 2, "plum");
    // wheels: front one blown flat
    l.rect(3, 13, 3, 2, "ink");
    l.px(4, 13, "slate");
    l.rect(11, 13, 3, 3, "ink");
    l.px(12, 14, "slate"); // hub
  });
}

/** Truck box (right tile) — cargo box flush to the left edge, torn open at
 *  the back. Composes with truckCab on its left into one crashed truck. */
function truckBox(): PixelGrid {
  return stamp(sandBase(23, 1), (l) => {
    // container spanning from the left edge (continues the cab silhouette)
    l.rect(0, 2, 14, 11, "bone");
    l.rect(0, 2, 14, 1, "sandLight"); // roof light
    l.rect(0, 12, 14, 1, "sand"); // lower shade
    // corrugation ribs
    for (const x of [2, 5, 8]) l.rect(x, 3, 1, 9, "sand");
    // torn-open rear door hanging off the back
    l.rect(11, 4, 3, 8, "plum");
    l.px(13, 3, "plum");
    l.px(14, 5, "plum"); // door flap
    l.px(14, 6, "plum");
    l.px(12, 6, "ink"); // dark interior showing
    l.px(12, 7, "ink");
    // crash dents
    l.px(4, 8, "sand");
    l.px(5, 9, "sand");
    l.px(1, 10, "sand");
    // wheel
    l.rect(3, 13, 3, 3, "ink");
    l.px(4, 14, "slate");
  });
}

function crateBroken(): PixelGrid {
  return stamp(sandBase(24, 1), (l) => {
    // crate shell, stove in at the top-right
    l.rect(3, 5, 10, 8, "clay");
    l.rect(3, 5, 10, 1, "amber"); // lit top plank
    l.rect(3, 8, 10, 1, "rust"); // plank seams
    l.rect(3, 11, 10, 1, "rust");
    l.rect(4, 6, 1, 6, "rust"); // side grain
    l.rect(11, 6, 1, 6, "rust");
    // the break: missing corner + splinters
    l.px(10, 5, null);
    l.px(11, 5, null);
    l.px(12, 5, null);
    l.px(11, 6, null);
    l.px(12, 6, null);
    l.px(12, 7, null);
    l.px(9, 4, "clay"); // thrown splinters
    l.px(13, 6, "clay");
    l.px(14, 8, "amber");
    l.px(10, 7, "ink"); // dark hollow inside
    l.px(10, 6, "ink");
  });
}

/** Joshua tree trunk — shaggy, fills the column under joshuaTop's stem. */
function joshuaTrunk(): PixelGrid {
  return stamp(sandBase(25, 1), (l) => {
    l.rect(6, 0, 4, 16, "clay");
    // shaggy dead-leaf thatch
    for (let y = 1; y < 16; y += 2) {
      l.px(5, y, "rust");
      l.px(10, y + 1, "rust");
      l.px(7 + (y % 3), y, "rust");
    }
    for (let y = 0; y < 16; y += 3) l.px(6, y, "amber"); // lit edge
    l.px(4, 12, "clay"); // low stump arm
    l.px(4, 11, "clay");
  });
}

/** Joshua tree crown — jade/teal spiky rosettes on a forked stem; the stem
 *  meets the bottom edge where joshuaTrunk continues. */
function joshuaTop(): PixelGrid {
  return stamp(sandBase(26, 1), (l) => {
    // forked stem rising from the trunk line
    l.rect(7, 10, 2, 6, "clay");
    l.px(6, 9, "clay");
    l.px(5, 8, "clay");
    l.px(10, 9, "clay");
    l.px(11, 8, "clay");
    // left rosette: spiky star
    l.rect(3, 5, 5, 3, "teal");
    l.px(2, 4, "jade");
    l.px(4, 3, "jade");
    l.px(6, 3, "jade");
    l.px(1, 6, "jade");
    l.px(2, 8, "jade");
    l.px(5, 2, "jade");
    l.px(4, 5, "jade"); // lit core
    // right rosette
    l.rect(9, 4, 5, 3, "teal");
    l.px(9, 2, "jade");
    l.px(11, 2, "jade");
    l.px(13, 3, "jade");
    l.px(14, 5, "jade");
    l.px(14, 7, "jade");
    l.px(10, 7, "jade");
    l.px(11, 5, "jade"); // lit core
    // mint sun-tips
    l.px(5, 2, "mint");
    l.px(11, 2, "mint");
  });
}

function creosote(): PixelGrid {
  return stamp(sandBase(27, 1), (l) => {
    // scraggly forked stems
    l.px(7, 12, "rust");
    l.px(8, 12, "rust");
    l.px(6, 11, "rust");
    l.px(9, 11, "rust");
    l.px(5, 10, "rust");
    l.px(10, 10, "rust");
    l.px(7, 10, "rust");
    // sparse resinous leaf tufts
    for (const [x, y] of [
      [4, 8],
      [5, 9],
      [6, 8],
      [7, 9],
      [8, 8],
      [10, 8],
      [11, 9],
      [3, 9],
      [9, 9],
      [12, 8]
    ] as const) {
      l.px(x, y, "jade");
    }
    l.px(5, 7, "teal");
    l.px(8, 7, "teal");
    l.px(11, 7, "teal");
    l.px(6, 7, "mint"); // tiny yellow-green blossom reads mint
  });
}

/** Gas station wall base: clay stucco with rust courses and grime bands. */
function stationWallBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "clay");
  g.rect(0, 0, TILE_SIZE, 1, "amber"); // sun-lit cornice
  g.rect(0, 12, TILE_SIZE, 1, "rust"); // wainscot line
  g.rect(0, 13, TILE_SIZE, 3, "rust"); // rust skirt
  g.px(0, 13, "amber");
  // grime clusters (2×2, G5 — replaces the old per-pixel speckle)
  scatterMotifs(g, seed, [square("rust"), square("amber")], 2, {
    margin: 2,
    minSpacing: 5
  });
  return g;
}

function stationWindow(): PixelGrid {
  const g = stationWallBase(29);
  // bone frame around a skyBlue pane
  g.rect(3, 3, 10, 8, "bone");
  g.rect(4, 4, 8, 6, "skyBlue");
  g.rect(4, 4, 8, 1, "white"); // sky reflection
  g.px(4, 5, "white");
  g.rect(7, 4, 1, 6, "bone"); // mullion
  g.px(10, 8, "slate"); // dim interior corner
  g.px(11, 9, "slate");
  return g;
}

function stationSign(): PixelGrid {
  const g = stationWallBase(30);
  // weathered board sign with rust lettering strokes
  g.rect(2, 3, 12, 7, "bone");
  g.rect(2, 3, 12, 1, "sandLight");
  g.rect(2, 9, 12, 1, "sand"); // bottom shade
  // "GAS" as chunky letterform strokes
  g.rect(3, 5, 2, 3, "rust");
  g.px(4, 5, "bone");
  g.px(4, 7, "rust");
  g.rect(6, 5, 2, 3, "rust");
  g.px(6, 7, "bone");
  g.rect(9, 5, 2, 3, "rust");
  g.px(10, 6, "bone");
  g.px(9, 6, "bone");
  g.px(12, 5, "hpRed"); // dying neon dot
  // rusted mounting bolts
  g.px(2, 3, "plum");
  g.px(13, 3, "plum");
  return g;
}

function gasPump(): PixelGrid {
  return stamp(sandBase(31, 1), (l) => {
    // pump body
    l.rect(5, 3, 6, 10, "rust");
    l.rect(5, 3, 6, 1, "clay"); // lit top
    l.px(5, 4, "clay");
    // dial window
    l.rect(6, 5, 4, 3, "bone");
    l.px(7, 6, "ink"); // needle
    l.px(8, 6, "ink");
    // brand stripe
    l.rect(6, 9, 4, 1, "amber");
    // base plinth
    l.rect(4, 13, 8, 2, "plum");
    // hose looping off the right side to the nozzle
    l.px(11, 6, "ink");
    l.px(12, 7, "ink");
    l.px(12, 8, "ink");
    l.px(12, 9, "ink");
    l.px(12, 10, "ink");
    l.px(11, 11, "ink");
    l.px(11, 12, "slate"); // nozzle
  });
}

/** Mine wall: solid mauve rock face — bright against the dark floor. */
function mineWall(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "mauve");
  // strata seams
  g.rect(0, 4, 6, 1, "plum");
  g.rect(9, 4, 7, 1, "plum");
  g.rect(3, 9, 8, 1, "plum");
  g.rect(0, 13, 5, 1, "plum");
  g.rect(11, 13, 5, 1, "plum");
  // pick scars catching lamplight (2px clusters, G6)
  g.rect(6, 2, 2, 1, "clay");
  g.rect(12, 7, 2, 1, "clay");
  g.rect(2, 11, 2, 1, "clay");
  // embedded stones (2×2 clusters — replaces the old per-pixel speckle)
  g.rect(10, 2, 2, 2, "plum");
  g.rect(4, 6, 2, 2, "clay");
  // dark undercut at the foot so it reads solid against the floor
  g.rect(0, 15, TILE_SIZE, 1, "ink");
  g.rect(0, 14, TILE_SIZE, 1, "plum");
  return g;
}

/** Mine floor: walkable dark — ink with faint plum rubble clusters. */
function mineFloor(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "ink");
  scatterMotifs(
    g,
    seed,
    [
      square("plum"),
      motifStamp([
        [0, 0, "plum"],
        [1, 0, "plum"]
      ])
    ],
    3,
    { margin: 1, minSpacing: 5 }
  );
  return g;
}

function mineTimber(): PixelGrid {
  const g = mineWall();
  // clay support beams framing the wall: two posts + header
  const layer = tile();
  layer.rect(1, 2, 3, 14, "clay");
  layer.rect(12, 2, 3, 14, "clay");
  layer.rect(0, 0, 16, 3, "clay"); // header beam
  layer.rect(0, 0, 16, 1, "amber"); // lamplit top edge
  layer.px(1, 2, "amber");
  layer.px(12, 2, "amber");
  // grain + iron nails
  layer.rect(2, 5, 1, 9, "rust");
  layer.rect(13, 5, 1, 9, "rust");
  layer.px(2, 3, "ink");
  layer.px(13, 3, "ink");
  layer.outline("ink");
  g.blit(layer, 0, 0);
  return g;
}

/** Rail on mine floor — two full-width slate rails so the tile repeats
 *  seamlessly left-right, clay sleepers underneath. */
function rail(): PixelGrid {
  const g = mineFloor(33);
  // sleepers: vertical clay ties, evenly spaced (pattern repeats across tiles)
  for (const x of [1, 5, 9, 13]) {
    g.rect(x, 4, 2, 9, "clay");
    g.px(x, 4, "rust");
    g.px(x + 1, 12, "rust");
  }
  // rails: unbroken across the full tile width
  g.rect(0, 5, TILE_SIZE, 1, "slate");
  g.rect(0, 6, TILE_SIZE, 1, "plum"); // rail web shadow
  g.rect(0, 10, TILE_SIZE, 1, "slate");
  g.rect(0, 11, TILE_SIZE, 1, "plum");
  return g;
}

function cart(): PixelGrid {
  const g = mineFloor(34);
  const layer = tile();
  // riveted tub, wider at the top
  layer.rect(2, 5, 12, 2, "slate");
  layer.rect(3, 7, 10, 5, "indigo");
  layer.px(3, 7, "slate");
  layer.px(4, 7, "slate"); // lit rim
  layer.px(12, 11, "plum");
  // ore heaped over the rim
  layer.rect(5, 4, 6, 1, "rust");
  layer.px(6, 3, "rust");
  layer.px(9, 3, "rust");
  layer.px(7, 3, "amber"); // a glinting shiny in the ore
  layer.px(8, 4, "amber");
  layer.outline("ink");
  g.blit(layer, 0, 0);
  // wheels after the blit so they stay chunky ink
  g.rect(4, 12, 2, 2, "ink");
  g.rect(10, 12, 2, 2, "ink");
  g.px(4, 12, "slate");
  g.px(10, 12, "slate");
  return g;
}

/** Lever on mine floor. `on` throws the handle to the other side and lights
 *  the indicator jade. */
function leverBase(on: boolean): PixelGrid {
  const g = mineFloor(on ? 36 : 35);
  const layer = tile();
  // mounting block
  layer.rect(5, 10, 6, 3, "slate");
  layer.rect(5, 10, 6, 1, "skyBlue");
  layer.px(6, 13, "plum");
  layer.px(9, 13, "plum");
  // handle: clay shaft with a knob, thrown left (off) or right (on)
  if (!on) {
    layer.px(6, 9, "clay");
    layer.px(5, 8, "clay");
    layer.px(4, 7, "clay");
    layer.px(3, 6, "rust"); // worn grip
    layer.rect(2, 4, 2, 2, "rust"); // knob
    layer.px(2, 4, "clay");
  } else {
    layer.px(9, 9, "clay");
    layer.px(10, 8, "clay");
    layer.px(11, 7, "clay");
    layer.px(12, 6, "rust");
    layer.rect(12, 4, 2, 2, "amber"); // knob catches the light
    layer.px(13, 4, "sandLight");
  }
  layer.outline("ink");
  g.blit(layer, 0, 0);
  // indicator lamp on the block face (after the blit so it stays 1px)
  g.px(8, 11, on ? "jade" : "rust");
  if (on) g.px(8, 10, "mint"); // glow
  return g;
}

/** Ice wall: skyBlue face with bone facets and paired white glints. */
function iceWallBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "skyBlue");
  // facet planes
  g.rect(1, 1, 5, 4, "bone");
  g.rect(9, 2, 6, 3, "mint");
  g.rect(2, 7, 4, 5, "mint");
  g.rect(8, 8, 6, 4, "bone");
  g.rect(4, 13, 7, 2, "mint");
  // facet edges
  g.px(6, 3, "slate");
  g.px(7, 6, "slate");
  g.px(6, 10, "slate");
  g.px(12, 7, "slate");
  g.px(3, 12, "slate");
  // glints: 2×1 clusters on the facets (G6 — no isolated single pixels)
  const rng = mulberry32(seed);
  for (let i = 0; i < 2; i++) {
    const x = 2 + Math.floor(rng() * 11);
    const y = 2 + Math.floor(rng() * 11);
    g.rect(x, y, 2, 1, "white");
  }
  g.rect(2, 2, 2, 1, "white");
  g.rect(10, 9, 2, 1, "white");
  return g;
}

/** Cracked ice wall: same face split by a dark fissure showing indigo. */
function iceWallCrack(): PixelGrid {
  const g = iceWallBase(37);
  // jagged fissure, two pixels of depth: indigo core with slate lips
  const path: Array<[number, number]> = [
    [7, 0],
    [7, 1],
    [8, 2],
    [8, 3],
    [7, 4],
    [6, 5],
    [6, 6],
    [7, 7],
    [8, 8],
    [8, 9],
    [9, 10],
    [9, 11],
    [8, 12],
    [7, 13],
    [7, 14],
    [8, 15]
  ];
  for (const [x, y] of path) {
    g.px(x, y, "indigo");
    g.px(x + 1, y, "slate"); // fractured lip
  }
  g.px(6, 2, "indigo"); // branch crack
  g.px(5, 3, "indigo");
  g.px(10, 9, "indigo");
  g.px(11, 8, "indigo");
  return g;
}

/** Sand rimed with frost creeping in from the depths. */
function frostSand(): PixelGrid {
  const g = sandBase(38, 1);
  // rime patches
  g.rect(1, 1, 4, 2, "mint");
  g.px(5, 2, "mint");
  g.px(2, 3, "mint");
  g.rect(10, 5, 4, 2, "mint");
  g.px(9, 6, "mint");
  g.rect(3, 11, 3, 2, "mint");
  g.px(6, 12, "mint");
  g.rect(12, 11, 2, 2, "mint");
  // frozen sparkle at the heart of each patch
  g.px(2, 2, "white");
  g.px(11, 6, "white");
  g.px(4, 12, "white");
  g.px(3, 2, "bone");
  g.px(12, 6, "bone");
  return g;
}

/** A collectible shard of impossible ice, half-buried in sand. */
function iceChip(): PixelGrid {
  return stamp(sandBase(39, 1), (l) => {
    // angular shard leaning right
    l.px(8, 4, "mint");
    l.rect(7, 5, 3, 2, "mint");
    l.rect(6, 7, 4, 3, "skyBlue");
    l.rect(6, 10, 5, 2, "skyBlue");
    l.px(6, 7, "mint");
    l.px(6, 8, "mint");
    // cold gleam
    l.px(8, 5, "white");
    l.px(7, 8, "white");
    // melt pooling at the base
    l.px(5, 11, "skyBlue");
    l.px(11, 11, "skyBlue");
  });
}

/** Scarab egg cluster on the dark depths floor. */
function eggCluster(): PixelGrid {
  const g = mineFloor(40);
  const layer = tile();
  // heaped bone eggs, sandLight where the queen's lamplight hits
  layer.rect(4, 8, 4, 4, "bone");
  layer.px(4, 8, "sandLight");
  layer.px(5, 8, "sandLight");
  layer.rect(9, 7, 4, 4, "bone");
  layer.px(9, 7, "sandLight");
  layer.rect(6, 4, 4, 4, "bone");
  layer.px(6, 4, "sandLight");
  layer.px(7, 4, "white"); // wet glint
  layer.rect(7, 11, 3, 3, "bone");
  // mauve speckling on the shells
  layer.px(6, 9, "mauve");
  layer.px(11, 9, "mauve");
  layer.px(8, 6, "mauve");
  layer.px(8, 12, "mauve");
  layer.outline("ink");
  g.blit(layer, 0, 0);
  // jade brood-slime strands (after the blit so they stay thin)
  g.px(3, 10, "jade");
  g.px(13, 8, "jade");
  g.px(10, 14, "jade");
  g.px(5, 13, "jade");
  return g;
}

/**
 * FF6-style 3/4-view desert mountain tile (Phase O redraw, ART_DIRECTION
 * §4a): an irregular peak (plus a lower shoulder) rising out of a plum
 * inter-peak shadow mass. The crest silhouette carries an umber/plum
 * zigzag; the NW flank is lit (sand near the crest, clay below), the SE
 * flank shaded (rust into plum, ~50% of the mass), and the south foot
 * darkens to umber so masses sit on the plain. `phase` (0..7) moves the
 * apexes so the eight variants read as a varied range when tiled densely;
 * `seed` scatters 2×2 crag clusters on the faces (G5 — the old per-pixel
 * flecks are gone). These tiles remain for the flat-tilemap fallback and
 * far texture; the near-field 3D read comes from the owBillboards layer.
 */
function mountainRidge(seed: number, phase: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "plum"); // shadowed inter-peak mass
  const mainAx = 3 + ((phase * 5) % 10);
  const mainAy = 1 + ((phase * 3) % 5); // varied heights: teeth, not a comb
  const peaks = [{ ax: mainAx, ay: mainAy }];
  if (phase % 2 === 0) {
    peaks.push({ ax: (mainAx + 8) % TILE_SIZE, ay: mainAy + 4 }); // lower shoulder
  }
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
    if (crestY >= TILE_SIZE) continue; // pure background shadow column
    for (let y = crestY; y < TILE_SIZE; y++) {
      const dc = y - crestY; // depth below the crest along this column
      let c: PaletteName;
      if (dc === 0) {
        c = ((x + y) & 2) === 0 ? "umber" : "plum"; // zigzag crest (G6 structural line)
      } else if (x <= owner.ax) {
        c = dc <= 3 ? "sand" : "clay"; // lit NW flank
      } else {
        c = dc <= 4 ? "rust" : "plum"; // shaded SE flank
      }
      // darkened south foot — broken, not a ruler line across the range
      if (y === TILE_SIZE - 1 && (x + phase * 3) % 8 < 6) c = "umber";
      g.px(x, y, c);
    }
  }
  // sunlit apex caps (structural crest highlights)
  for (const p of peaks) {
    if (p.ay < TILE_SIZE) {
      g.px(p.ax, p.ay, "sandLight");
      g.px(p.ax - 1, p.ay + 1, "sandLight");
    }
  }
  // 2×2 crag clusters on the faces (seeded, sparse — G5)
  const rng = mulberry32(seed);
  let placed = 0;
  for (let i = 0; i < 10 && placed < 2; i++) {
    const x = 1 + Math.floor(rng() * (TILE_SIZE - 3));
    const y = 4 + Math.floor(rng() * (TILE_SIZE - 6));
    const c = g.get(x, y);
    if (c === "clay" && g.get(x + 1, y + 1) === "clay") {
      g.rect(x, y, 2, 2, "rust");
      placed++;
    } else if (c === "rust" && g.get(x + 1, y + 1) === "rust") {
      g.rect(x, y, 2, 2, "plum");
      placed++;
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Phase O appendix — the overworld ground vocabulary (ART_DIRECTION §4a).
// ---------------------------------------------------------------------------

/** Warm scree/rock ground placed under mountain masses: clay base with
 *  sparse 2×2 pebble clusters (mauve/rust/sand — G5, no speckle). */
function screeBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "clay");
  const pebbles: readonly Motif[] = [
    motifStamp([
      [0, 0, "mauve"],
      [1, 0, "mauve"],
      [0, 1, "mauve"],
      [1, 1, "plum"]
    ]),
    square("rust"),
    square("sand")
  ];
  scatterMotifs(g, seed, pebbles, 3, { margin: 1, minSpacing: 5 });
  return g;
}

/**
 * The 24 appended Phase O tiles, in TILE2_NAMES order:
 * scree, scree2, screeShade, sandShade,
 * coast edges N/E/S/W (the letter = which side the water is on), coast
 * outer corners NE/NW/SE/SW (water on both named sides), coast inner
 * corners (water only diagonally), then the sand↔scree finger-transition
 * edges/outer corners with the same naming (letter = where the SAND is;
 * scree owns the border per G9).
 */
function overworldAppendix(): PixelGrid[] {
  const sandRef = sandBase(1); // identical to the "sand" tile → perfect seams
  const scree = screeBase(70);
  const scree2 = screeBase(71);

  // Mountain foot-shadow band (§4a): shadow-LUT scree whose south edge
  // hands off into sand with shaded fingers, so the band's usual south
  // neighbour (the sunlit pass) meets a broken boundary, not a ruler line.
  const screeShade = makeEdgeSet(shadeGrid(scree), sandRef, {
    style: "fingers",
    seed: 91,
    fingerColor: "rust",
    bandDepth: 3,
    fingerOpts: { depthMin: 1, depthMax: 2, density: 0.5 }
  }).edges.s;

  const sandShade = shadeGrid(sandRef);

  // Coast surf ring (land owns the border): dark land lip → broken bone
  // surf fringe → skyBlue shallows → open water matching the water tile.
  const coast = makeEdgeSet(sandRef, water(0), {
    style: "surf",
    seed: 92,
    surfLip: "umber",
    innerCorners: true
  });

  // Sand↔scree transition (scree owns the border): a sand band along the
  // boundary side with clustered 2px scree fingers reaching into it.
  const screeSand = makeEdgeSet(scree, sandRef, {
    style: "fingers",
    seed: 93,
    fingerColor: "clay",
    bandDepth: 5
  });

  return [
    scree,
    scree2,
    screeShade,
    sandShade,
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
    screeSand.edges.n,
    screeSand.edges.e,
    screeSand.edges.s,
    screeSand.edges.w,
    screeSand.outerCorners.ne,
    screeSand.outerCorners.nw,
    screeSand.outerCorners.se,
    screeSand.outerCorners.sw
  ];
}

/** All 56 tiles in contract order (see TILE2_NAMES). */
export function tile2Frames(): PixelGrid[] {
  return [
    asphaltBase(20),
    asphaltLine(),
    truckCab(),
    truckBox(),
    crateBroken(),
    joshuaTrunk(),
    joshuaTop(),
    creosote(),
    stationWallBase(28),
    stationWindow(),
    stationSign(),
    gasPump(),
    mineWall(),
    mineFloor(1),
    mineTimber(),
    rail(),
    cart(),
    leverBase(false),
    leverBase(true),
    iceWallBase(41),
    iceWallCrack(),
    frostSand(),
    iceChip(),
    eggCluster(),
    mountainRidge(42, 0),
    mountainRidge(43, 1),
    mountainRidge(44, 2),
    mountainRidge(45, 3),
    mountainRidge(46, 4),
    mountainRidge(47, 5),
    mountainRidge(48, 6),
    mountainRidge(49, 7),
    ...overworldAppendix()
  ];
}
