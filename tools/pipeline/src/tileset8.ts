/**
 * Tileset 8 — sixteen 16×16 Act 7 tiles in contract order (docs/CONTRACTS.md
 * §18): La Pizzeria Sotterranea, deep beneath everything — a volcanic descent
 * lit by lava vents that opens onto a restaurant carved into the temple's old
 * kitchens. Two looks in one sheet: raw warm volcanic rock (ember floor, ash,
 * basalt walls, molten lava vents) transitioning into something BUILT (carved
 * steps, a checkered dining floor, set tables, a great pizza oven, temple
 * columns, a hanging sign).
 *
 * Same rules as tileset.ts..tileset7.ts: props stamped onto an opaque floor
 * base via a transparent, ink-outlined layer; deterministic speckle from a
 * seeded mulberry32. Solid: `basaltWall`, `lavaVent`, `lavaVent2`,
 * `pizzaTable`, `pizzaOven`, `stoneColumn`. `lavaVent` ↔ `lavaVent2` animate
 * like every water pair (the molten glow churns). `hangSign` is the one
 * OVERHEAD tile (transparent background, drawn above the actors — the party
 * walks beneath the old signage).
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { clusterDither, ellipse, hLine } from "./fx";
import { makeCap, makeEdgeSet, makeFace, makeShadeVariant } from "./tilecraft";
import { TILE_SIZE } from "./tileset";

/** Contract tile order (row-major indices 0..15). */
export const TILE8_NAMES = [
  "emberFloor",
  "emberFloor2",
  "ashFloor",
  "carvedStep",
  "basaltWall",
  "lavaVent",
  "lavaVent2",
  "lavaCrust",
  "tileFloor",
  "tileFloor2",
  "pizzaTable",
  "pizzaOven",
  "stoneColumn",
  "hangSign",
  "ovenGlow",
  "steamCrack",
  // --- 2.5D dressing append (Phase Z, docs/ART_DIRECTION.md §2/§5) ---
  "basaltWallCap",
  "basaltWallCap2",
  "basaltWallFace",
  "basaltWallFace2",
  "tileFloorShade",
  "tileFloor2Shade",
  "emberFloorShade",
  "emberFloor2Shade",
  "ashFloorShade",
  "lavaCrustShade",
  "carvedStepShade",
  "ovenGlowShade",
  "ashEmberN",
  "ashEmberE",
  "ashEmberS",
  "ashEmberW",
] as const;

export type Tile8Name = (typeof TILE8_NAMES)[number];

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

/** Warm volcanic floor — walkable. Dark basalt plum/ink shot through with ember
 *  motes glowing up from below; a few slate grains. `seed`/`warm` vary it. */
/** Redrawn for the 2.5D pass (G5): dark basalt — plum body with rounded ink
 *  hollows between the stones and 2–3 paired ember-glow motifs seeping up
 *  through the cracks. No half-tile band, no per-pixel speckle. */
function emberFloor(seed: number, warm: boolean): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "plum");
  const rng = mulberry32(seed);
  // rounded ink hollows (crack pockets between crust plates)
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rng() * 11);
    const y = 2 + Math.floor(rng() * 11);
    hLine(g, x + 1, y, 2, "ink");
    hLine(g, x, y + 1, 4, "ink");
  }
  // ember motifs: a warm pair glowing in a crack (amber head, ramp tail)
  const embers = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < embers; i++) {
    const x = 1 + Math.floor(rng() * 13);
    const y = 1 + Math.floor(rng() * 14);
    g.px(x, y, "amber");
    g.px(x + 1, y, warm ? "rust" : "hpRed");
  }
  // slate grit chips
  hLine(g, 3, 5, 2, "slate");
  hLine(g, 11, 12, 2, "slate");
  return g;
}

/** Ashen floor — walkable. A cooler gray drift of volcanic ash: slate/mauve
 *  base with pale bone/sand ash flecks. */
/** Redrawn for the 2.5D pass (G5): cool ash — mauve body with rounded plum
 *  drift hollows and 2–3 pale ash-fleck motifs (2px). No band, no speckle. */
function ashFloor(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "mauve");
  const rng = mulberry32(seed);
  // rounded plum drift hollows
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rng() * 11);
    const y = 2 + Math.floor(rng() * 11);
    hLine(g, x + 1, y, 3, "plum");
    hLine(g, x, y + 1, 4, "plum");
  }
  // pale ash flecks settling in pairs
  for (let i = 0; i < 3; i++) {
    const x = 1 + Math.floor(rng() * 13);
    const y = 1 + Math.floor(rng() * 14);
    hLine(g, x, y, 2, rng() < 0.5 ? "bone" : "sand");
  }
  // slate grit
  hLine(g, 4, 4, 2, "slate");
  hLine(g, 10, 11, 2, "slate");
  return g;
}

/** Carved stone step — walkable. The "built" transition: a dressed clay/sand
 *  block with a crisp ink step-shadow and a lit sand top edge. */
function carvedStep(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "clay");
  g.rect(0, 0, TILE_SIZE, 3, "sand"); // lit tread
  g.rect(0, 8, TILE_SIZE, 1, "ink"); // step line
  g.rect(0, 9, TILE_SIZE, 7, "rust"); // riser in shadow
  // tooled chisel marks
  for (const x of [2, 6, 10, 14] as const) {
    g.px(x, 5, "amber");
    g.px(x, 12, "clay");
  }
  g.px(0, 0, "sandLight");
  g.px(15, 2, "sandLight");
  return g;
}

/** Basalt cavern wall — SOLID. Near-black volcanic rock: ink/plum blocks with a
 *  rust mineral vein and a hot amber crack glowing from within. */
function basaltWall(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "ink");
  g.rect(0, 0, TILE_SIZE, 1, "plum"); // faint lit top
  for (const [x, y, w, h] of [
    [1, 2, 5, 4],
    [8, 2, 6, 3],
    [2, 8, 5, 4],
    [9, 8, 5, 4],
  ] as const) {
    g.rect(x, y, w, h, "plum");
    g.px(x, y, "slate"); // lit corner
  }
  // rust mineral vein
  for (const [x, y] of [
    [7, 3],
    [8, 4],
    [12, 7],
    [5, 11],
  ] as const) {
    g.px(x, y, "rust");
  }
  // a hot crack glowing from deep inside
  g.px(6, 6, "amber");
  g.px(7, 7, "hpRed");
  g.px(6, 8, "amber");
  g.px(13, 12, "amber");
  const rng = mulberry32(seed);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * TILE_SIZE);
    g.px(x, y, "plum");
  }
  return g;
}

/** Molten lava vent — SOLID + animated. Glowing hpRed/rust magma veined with
 *  amber/atbGold and a black crust skin; `phase` drifts the glow so lavaVent ↔
 *  lavaVent2 churn. The heat and light of the whole act. */
/** Redrawn for the 2.5D pass (§5 glow ramp): a molten eye — rust cooled rim
 *  ramping through hpRed and amber to a white-hot bone centre, with crust
 *  chips riding the melt. `phase` swings the hot centre so lavaVent ↔
 *  lavaVent2 churn. */
function lavaVent(phase: 0 | 1): PixelGrid {
  const g = tile();
  const d = phase;
  // the glow ramp, outside-in: rust rim → hpRed melt → amber pool → bone heart
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "rust");
  ellipse(g, 7.5 + d, 7.5 - d, 6.5, 6, "hpRed");
  ellipse(g, 7.5 + d, 7.5 - d, 4.2, 3.8, "amber");
  ellipse(g, 7 + d * 2, 7 - d, 1.8, 1.4, "bone");
  g.px(7 + d * 2, 7 - d, "white"); // the white-hot core spark
  // atbGold flares circling the pool
  g.px((4 + d * 3) % TILE_SIZE, 5, "atbGold");
  g.px((11 - d * 3) % TILE_SIZE, 10, "atbGold");
  // black crust chips riding the melt (2px, drifting)
  hLine(g, (2 + d) % TILE_SIZE, 2, 2, "ink");
  hLine(g, (12 + d) % TILE_SIZE, 13, 2, "ink");
  hLine(g, (13 - d) % TILE_SIZE, 4, 2, "ink");
  return g;
}

/** Cooled lava crust — walkable. A dark plum/ink crust skin with amber cracks
 *  glowing up through it; the safe ground beside the vents. */
function lavaCrust(): PixelGrid {
  return stamp(emberFloor(801, true), (l) => {
    // a jigsaw of crust plates with glowing seams
    for (const [x, y] of [
      [3, 4],
      [8, 5],
      [12, 6],
      [5, 10],
      [10, 11],
      [13, 12],
    ] as const) {
      l.px(x, y, "amber");
      l.px(x + 1, y, "hpRed");
    }
    l.rect(6, 8, 4, 1, "ink"); // a dark seam
    l.px(7, 8, "amber");
    l.px(2, 13, "atbGold");
  });
}

/** Restaurant checker floor — walkable. Redrawn for the 2.5D pass: the 8×8
 *  two-square checker gains a real tile subgrid — bone grout on both axes,
 *  a sandLight lit bevel along each square's top-left (G1) and a rust worn
 *  edge low-right. `alt` flips the checker so tileFloor/tileFloor2 lay a
 *  real diamond floor. */
function tileFloor(alt: boolean): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "clay");
  // an 8×8 two-square checker
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const light = (cx + cy) % 2 === (alt ? 1 : 0);
      if (light) g.rect(cx * 8, cy * 8, 8, 8, "sand");
    }
  }
  // bone grout between the squares
  g.rect(0, 7, TILE_SIZE, 1, "bone");
  g.rect(7, 0, 1, TILE_SIZE, "bone");
  // each square's lit top-left bevel and worn low-right edge
  for (const [qx, qy] of [
    [0, 0],
    [8, 0],
    [0, 8],
    [8, 8],
  ] as const) {
    const light = ((qx >> 3) + (qy >> 3)) % 2 === (alt ? 1 : 0);
    hLine(g, qx, qy, 3, light ? "sandLight" : "sand");
    g.px(qx, qy + 1, light ? "sandLight" : "sand");
    hLine(g, qx + 4, qy + 6, 2, "rust");
  }
  return g;
}

/** A set dinner table — SOLID walk-around. A round clay/sand table with a bone
 *  plate and a single lit candle — set for a guest three thousand years gone. */
function pizzaTable(): PixelGrid {
  return stamp(tileFloor(false), (l) => {
    l.rect(3, 5, 10, 8, "clay"); // table top
    l.rect(4, 4, 8, 2, "sand"); // lit near edge
    l.rect(3, 12, 10, 2, "rust"); // shaded skirt
    // a bone place setting
    l.rect(6, 8, 4, 3, "bone");
    l.px(6, 8, "sandLight");
    // a little candle, still burning
    l.px(8, 5, "amber");
    l.px(8, 4, "atbGold"); // flame
    l.px(8, 6, "bone"); // wax
  });
}

/** The great pizza oven — SOLID. A domed clay/sand brick oven with a black
 *  arched mouth glowing hpRed/amber inside — Testudo's oven, the act's hearth. */
function pizzaOven(): PixelGrid {
  return stamp(carvedStep(), (l) => {
    l.rect(2, 3, 12, 11, "clay"); // dome body
    l.rect(3, 2, 10, 2, "sand"); // lit crown
    l.rect(2, 13, 12, 2, "rust"); // shaded base
    // brick courses
    for (const y of [5, 9] as const) l.rect(2, y, 12, 1, "rust");
    l.px(4, 4, "bone");
    l.px(10, 4, "bone");
    // the arched mouth, glowing
    l.rect(5, 8, 6, 5, "ink");
    l.rect(6, 9, 4, 3, "hpRed");
    l.px(7, 10, "amber");
    l.px(8, 10, "atbGold");
    l.px(7, 11, "amber");
  });
}

/** A temple column — SOLID. A fluted sand/clay pillar with an ink shade side —
 *  the old kitchens' structure, holding the roof up over the dining room. */
function stoneColumn(): PixelGrid {
  return stamp(tileFloor(true), (l) => {
    l.rect(4, 0, 8, TILE_SIZE, "sand"); // shaft
    l.rect(4, 0, 2, TILE_SIZE, "sandLight"); // lit edge
    l.rect(10, 0, 2, TILE_SIZE, "clay"); // shade edge
    l.rect(11, 0, 1, TILE_SIZE, "rust");
    // fluting
    for (const x of [6, 8] as const) l.rect(x, 1, 1, 14, "clay");
    // capital + base
    l.rect(3, 0, 10, 2, "clay");
    l.rect(3, 14, 10, 2, "clay");
    l.px(3, 0, "sand");
  });
}

/** The hanging sign — the one OVERHEAD tile: transparent background, a bone
 *  board on a rust chain with faded amber lettering; the party walks beneath
 *  the old "LA PIZZERIA" sign. */
function hangSign(): PixelGrid {
  const g = tile();
  // chain up to the ceiling
  g.px(8, 0, "rust");
  g.px(8, 1, "slate");
  g.px(8, 2, "rust");
  // the board
  g.rect(2, 3, 12, 7, "bone");
  g.rect(2, 3, 12, 1, "sandLight"); // lit top edge
  g.rect(2, 9, 12, 1, "clay"); // shaded bottom
  // faded amber lettering (two words, unreadable-old)
  g.rect(3, 5, 8, 1, "amber");
  g.rect(4, 7, 6, 1, "amber");
  g.px(3, 5, "rust");
  g.px(11, 5, "rust");
  // little ring-bolts
  g.px(2, 3, "slate");
  g.px(13, 3, "slate");
  g.outline("ink");
  return g;
}

/** Oven-lit floor — walkable decor. A dining tile washed warm by the oven's
 *  glow: the checker floor with a pooled amber underlight. */
function ovenGlow(): PixelGrid {
  const g = tileFloor(false);
  // a warm pool of firelight over the tiles
  for (const [x, y] of [
    [4, 4],
    [7, 3],
    [10, 5],
    [5, 9],
    [9, 10],
    [12, 8],
    [7, 12],
  ] as const) {
    g.px(x, y, "amber");
  }
  g.px(8, 7, "atbGold");
  g.px(6, 6, "amber");
  g.px(11, 11, "amber");
  return g;
}

/** A steaming crack — walkable decor. A fissure in the ash floor venting a pale
 *  skyBlue/bone steam wisp, with an amber ember down in the crack. */
function steamCrack(): PixelGrid {
  const g = ashFloor(802);
  // the crack
  g.rect(7, 4, 2, 9, "ink");
  g.px(7, 6, "amber"); // ember in the deep
  g.px(8, 9, "hpRed");
  // steam rising
  g.px(7, 3, "skyBlue");
  g.px(8, 2, "bone");
  g.px(6, 1, "skyBlue");
  g.px(9, 1, "bone");
  g.px(7, 0, "skyBlue");
  return g;
}

// ---------------------------------------------------------------------------
// 2.5D dressing append (Phase Z, docs/ART_DIRECTION.md §2/§5).
// ---------------------------------------------------------------------------

/** 2x2 slate facet chip for the cap tops. */
function slateChip(): PixelGrid {
  const m = new PixelGrid(2, 2);
  m.rect(0, 0, 2, 2, "slate");
  return m;
}

/** The lit top of a basalt wall run (§2 Cap): plum volcanic stone with
 *  slate facet chips, a mauve lit lip and one ember seam. */
function basaltWallCap(seed: number): PixelGrid {
  const g = makeCap({
    base: "plum",
    lip: "mauve",
    lipThickness: 2,
    seed,
    motifs: [slateChip()],
    motifCount: 3
  });
  // a hot hairline seam glowing on the top surface
  g.px(4 + (seed % 5), 6, "amber");
  g.px(5 + (seed % 5), 6, "rust");
  // thin dark north edge (§2: north-facing edges stay thin — cap + edge line)
  g.rect(0, 0, TILE_SIZE, 1, "ink");
  return g;
}

/** The vertical south face of a basalt wall (§2 Face, G10): mauve → plum
 *  gradient into near-black, strata courses, ink foot — and a thin amber
 *  glow seam near the foot where the vents' light catches the rock. */
function basaltWallFace(seed: number): PixelGrid {
  const g = makeFace({ top: "mauve", mid: "plum", bottom: "plum", foot: "ink", seed });
  // break the gradient boundary with 2px cluster dither (G7)
  clusterDither(g, { x: 0, y: 4, w: TILE_SIZE, h: 3 }, "mauve", "plum", seed ^ 0x55, {
    density: 0.5
  });
  // vent-light seam near the foot (a motif, not a light source)
  g.px(3 + (seed % 6), 13, "rust");
  g.px(4 + (seed % 6), 13, "amber");
  g.px(5 + (seed % 6), 13, "rust");
  return g;
}

/** All contract tiles in order (see TILE8_NAMES). */
export function tile8Frames(): PixelGrid[] {
  // Ash owns its border against the ember stone: clustered mauve ash
  // fingers reaching into a band of ember floor (edges only — the drifts
  // are authored as bands, so corners never show).
  const ashEmber = makeEdgeSet(ashFloor(805), emberFloor(803, false), {
    style: "fingers",
    fingerColor: "mauve",
    bandDepth: 4,
    seed: 830,
    fingerOpts: { density: 0.5 }
  });
  return [
    emberFloor(803, false),
    emberFloor(804, true),
    ashFloor(805),
    carvedStep(),
    basaltWall(806),
    lavaVent(0),
    lavaVent(1),
    lavaCrust(),
    tileFloor(false),
    tileFloor(true),
    pizzaTable(),
    pizzaOven(),
    stoneColumn(),
    hangSign(),
    ovenGlow(),
    steamCrack(),
    // --- 2.5D dressing append (Phase Z) ---
    basaltWallCap(831),
    basaltWallCap(832),
    basaltWallFace(841),
    basaltWallFace(842),
    makeShadeVariant(tileFloor(false)),
    makeShadeVariant(tileFloor(true)),
    makeShadeVariant(emberFloor(803, false)),
    makeShadeVariant(emberFloor(804, true)),
    makeShadeVariant(ashFloor(805)),
    makeShadeVariant(lavaCrust()),
    makeShadeVariant(carvedStep()),
    makeShadeVariant(ovenGlow()),
    ashEmber.edges.n,
    ashEmber.edges.e,
    ashEmber.edges.s,
    ashEmber.edges.w,
  ];
}
