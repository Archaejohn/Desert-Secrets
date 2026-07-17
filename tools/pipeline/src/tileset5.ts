/**
 * Tileset 5 — sixteen 16×16 Act 4 tiles in the exact contract order
 * (docs/CONTRACTS.md §13): the Miners' Camp, a scrappy home built into an
 * abandoned Cinnabar gallery — string lights, a laundry line, supply crates.
 *
 * Same rules as tileset.ts..tileset4.ts: props are stamped onto an opaque
 * floor base via a transparent, ink-outlined layer; speckle is deterministic
 * (seeded mulberry32). Legibility is contractual: the warm plank `campFloor`
 * reads clearly walkable against the dark solid `campWall`; `crate`,
 * `crateStack`, `barrel`, `washtub`, `stove`, `campPost` and `crateOpen` are
 * solid standing obstacles; `stringLights` and `laundryLine` are the two
 * OVERHEAD tiles — they keep a transparent background (drawn above the
 * actors) while every other tile is fully opaque.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { clusterDither, hLine } from "./fx";
import { makeCap, makeFace, makeShadeVariant } from "./tilecraft";
import { TILE_SIZE } from "./tileset";

/** Contract tile order (row-major indices 0..15), plus the 2.5D dressing
 *  append (indices 16..23, docs/ART_DIRECTION.md §2/§5 — additive only). */
export const TILE5_NAMES = [
  "campFloor",
  "campFloor2",
  "campRug",
  "campWall",
  "crate",
  "crateStack",
  "barrel",
  "washtub",
  "bedroll",
  "stove",
  "campPost",
  "sockBasket",
  "frostPrint",
  "crateOpen",
  "stringLights",
  "laundryLine",
  // --- 2.5D dressing append (Phase Z) ---
  "campWallCap",
  "campWallCap2",
  "campWallFace",
  "campWallFace2",
  "campFloorShade",
  "campFloor2Shade",
  "campRugShade",
  "frostPrintShade",
] as const;

export type Tile5Name = (typeof TILE5_NAMES)[number];

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

/** Warm packed-plank camp floor — walkable. Redrawn for the 2.5D pass:
 *  a real board subgrid (each plank a lit sand top edge over a clay body,
 *  rust seams, staggered joints) with two seeded knot motifs (G5) instead
 *  of the per-pixel sawdust speckle. */
function floorBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "clay");
  // each plank's lit top edge (G1: light from the north)
  for (const y of [0, 4, 8, 12]) g.rect(0, y, TILE_SIZE, 1, "sand");
  // plank seams every four rows
  for (const y of [3, 7, 11, 15]) g.rect(0, y, TILE_SIZE, 1, "rust");
  // staggered board joints
  g.rect(5, 0, 1, 3, "rust");
  g.rect(11, 4, 1, 3, "rust");
  g.rect(3, 8, 1, 3, "rust");
  g.rect(9, 12, 1, 3, "rust");
  // two seeded knot/sawdust motifs (2px clusters)
  const rng = mulberry32(seed);
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rng() * 13);
    const y = [1, 5, 9, 13][Math.floor(rng() * 4)] + Math.floor(rng() * 2);
    hLine(g, x, y, 2, rng() < 0.5 ? "amber" : "sandLight");
  }
  return g;
}

/** Woven rug/mat — walkable warm decor. Rust field, jade/amber stripes,
 *  bone fringe top and bottom. */
function campRug(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "rust");
  g.rect(0, 1, TILE_SIZE, 1, "bone"); // fringe
  g.rect(0, 14, TILE_SIZE, 1, "bone");
  for (const [y, c] of [
    [4, "jade"],
    [6, "amber"],
    [8, "teal"],
    [10, "amber"],
    [12, "jade"],
  ] as const) {
    g.rect(1, y, TILE_SIZE - 2, 1, c);
  }
  // central diamond motif
  g.px(7, 7, "sandLight");
  g.px(8, 7, "sandLight");
  g.px(7, 8, "sandLight");
  g.px(8, 8, "sandLight");
  return g;
}

/** Gallery wall — SOLID. Redrawn for the 2.5D pass as the TOP of the wall
 *  mass (its south facade now comes from `campWallFace`): dark mauve stone
 *  with plum brick coursing and staggered head joints, clearly darker and
 *  heavier than the walkable floor. Speckle killed per G5 — two seeded
 *  mortar-fleck motifs only. */
function campWall(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "mauve");
  // brick coursing
  for (const y of [3, 7, 11, 15]) g.rect(0, y, TILE_SIZE, 1, "plum");
  // staggered head joints
  for (const [x, y] of [
    [5, 0],
    [11, 4],
    [3, 8],
    [13, 8],
    [8, 12],
  ] as const) {
    g.rect(x, y, 1, 3, "plum");
  }
  // two mortar-fleck motifs (2px)
  const rng = mulberry32(seed);
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rng() * 13);
    const y = [1, 5, 9, 13][Math.floor(rng() * 4)] + Math.floor(rng() * 2);
    hLine(g, x, y, 2, "sandLight");
  }
  return g;
}

/** Wooden supply crate — SOLID. Clay/amber box, ink plank lines, an X-brace. */
function crate(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(2, 3, 12, 11, "clay");
    l.rect(2, 3, 12, 2, "sand"); // lit top plane (G1)
    l.rect(2, 5, 12, 1, "amber"); // lip under the lid
    l.rect(2, 3, 1, 11, "amber"); // lit left rail
    l.rect(13, 3, 1, 11, "rust"); // shaded right rail
    l.rect(2, 13, 12, 1, "umber"); // shaded foot (G4)
    // X-brace on the shaded front face
    for (let i = 0; i < 7; i++) {
      l.px(4 + i, 6 + i, "rust");
      l.px(11 - i, 6 + i, "rust");
    }
    l.px(8, 9, "amber");
  });
}

/** Tall crate stack — SOLID. Two crates stacked; this is the one Piggy
 *  burrows into and pops out the far side of. Reads taller/heavier. */
function crateStack(): PixelGrid {
  return stamp(tile(), (l) => {
    // lower crate
    l.rect(2, 8, 12, 6, "clay");
    l.rect(2, 8, 12, 1, "amber");
    l.rect(2, 13, 12, 1, "umber"); // shaded foot (G4)
    l.px(8, 11, "rust");
    // upper crate, offset — its lid is the lit top plane (G1)
    l.rect(3, 1, 11, 7, "clay");
    l.rect(3, 1, 11, 2, "sand");
    l.rect(3, 3, 11, 1, "amber");
    l.rect(3, 1, 1, 7, "amber");
    l.rect(13, 1, 1, 7, "rust");
    l.rect(3, 7, 11, 1, "rust");
    for (let i = 0; i < 4; i++) l.px(5 + i, 3 + i, "rust"); // brace
    l.px(8, 5, "amber");
  });
}

/** Barrel — SOLID. Clay staves with rust hoops and a sand-lit belly. */
function barrel(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(4, 2, 8, 12, "clay");
    l.rect(3, 4, 10, 8, "clay"); // bulging belly
    l.rect(4, 2, 8, 2, "sand"); // lit lid plane (G1)
    l.rect(3, 5, 3, 6, "sand"); // lit stave
    l.rect(10, 5, 2, 6, "rust"); // shaded stave
    l.rect(4, 12, 8, 2, "umber"); // shaded foot (G4)
    // iron hoops
    l.rect(3, 5, 10, 1, "slate");
    l.rect(3, 10, 10, 1, "slate");
    l.rect(4, 4, 8, 1, "amber"); // lid rim
    for (let y = 5; y <= 11; y++) l.px(7, y, "rust"); // stave seam
  });
}

/** Laundry wash basin — SOLID. Slate tub brimming with sky-blue wash water,
 *  a bar of bone soap and a white glint. The laundry nook's centerpiece. */
function washtub(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(2, 5, 12, 9, "slate"); // tub body
    l.rect(2, 5, 12, 1, "skyBlue"); // rim
    l.rect(3, 6, 10, 5, "skyBlue"); // water
    l.rect(3, 6, 10, 1, "bone"); // suds line
    l.px(5, 8, "white"); // glint
    l.px(9, 9, "white");
    l.rect(7, 7, 3, 2, "bone"); // soap bar
    l.rect(2, 12, 12, 2, "plum"); // shaded foot
  });
}

/** Bedroll — walkable decor. A rolled blanket + pillow on the floor. */
function bedroll(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(2, 6, 12, 6, "teal"); // blanket
    l.rect(2, 6, 12, 1, "jade"); // lit fold
    l.rect(2, 11, 12, 1, "tealDeep"); // shaded fold
    for (let x = 3; x < 13; x += 2) l.px(x, 9, "jade"); // quilt stitching
    l.rect(2, 5, 4, 3, "bone"); // pillow
    l.px(3, 6, "sandLight");
  });
}

/** Pot-belly stove — SOLID. Slate iron body, a warm amber fire glow in the
 *  grate and a little flue; the camp's heart. */
function stove(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(4, 4, 8, 10, "slate"); // body
    l.rect(3, 6, 10, 6, "slate"); // belly
    l.rect(4, 4, 8, 1, "skyBlue"); // lit top
    l.rect(6, 1, 2, 3, "ink"); // flue
    // fire grate
    l.rect(6, 8, 4, 3, "hpRed");
    l.px(7, 9, "amber");
    l.px(8, 9, "atbGold");
    l.px(7, 10, "amber");
    l.rect(5, 12, 6, 1, "plum"); // shaded base
    l.px(10, 6, "sandLight"); // sheen
  });
}

/** Camp post — SOLID. A salvaged mine timber upright that carries the string
 *  lights and the laundry line; clay wood with an amber bulb hung on it. */
function campPost(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(6, 0, 4, 16, "clay");
    l.rect(6, 0, 1, 16, "sand"); // lit edge
    l.rect(9, 0, 1, 16, "rust"); // shaded edge
    for (const y of [3, 8, 13]) l.rect(6, y, 4, 1, "rust"); // banding
    l.rect(4, 2, 8, 1, "clay"); // crossarm
    l.px(4, 3, "amber"); // a hung bulb
    l.px(11, 3, "amber");
  });
}

/** Basket of the ripest socks — walkable decor and the sock-line landmark.
 *  A woven hamper spilling knotted bone/sand socks with a green reek waft. */
function sockBasket(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(3, 8, 10, 6, "amber"); // basket weave
    l.rect(3, 8, 10, 1, "sand");
    for (let x = 4; x < 13; x += 2) l.rect(x, 9, 1, 4, "rust"); // weave gaps
    // socks spilling over the rim
    l.rect(4, 5, 3, 4, "bone");
    l.rect(8, 4, 3, 5, "sandLight");
    l.px(5, 5, "clay"); // grubby toe
    l.px(9, 4, "clay");
    // reek waft
    l.px(6, 3, "jade");
    l.px(10, 2, "mint");
    l.px(8, 2, "jade");
  });
}

/** Penguin frost footprints — walkable decor: Piggy's tracks from his night
 *  raids, skyBlue/white prints rimed onto the warm floor. */
function frostPrint(): PixelGrid {
  const g = floorBase(519);
  for (const [x, y] of [
    [3, 4],
    [8, 6],
    [4, 10],
    [11, 12],
  ] as const) {
    g.px(x, y, "skyBlue");
    g.px(x + 1, y, "white");
    g.px(x, y + 1, "skyBlue");
    g.px(x + 1, y + 1, "skyBlue");
    g.px(x + 2, y + 1, "mint");
  }
  return g;
}

/** A cracked-open, emptied crate — SOLID walk-around (the one Piggy tumbled
 *  through). Splintered clay boards, one sprung loose, socks poking out. */
function crateOpen(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(2, 5, 12, 9, "clay");
    l.rect(2, 5, 12, 1, "sand"); // lit broken rim (G1)
    l.rect(2, 6, 12, 1, "amber");
    l.rect(2, 13, 12, 1, "umber"); // shaded foot (G4)
    // sprung board + jagged hole
    l.rect(3, 3, 7, 1, "rust");
    l.px(9, 4, "ink");
    l.px(10, 5, "ink");
    l.rect(5, 7, 5, 4, "ink"); // dark interior
    l.rect(6, 8, 3, 2, "bone"); // a sock left inside
    l.px(11, 8, "rust");
  });
}

/** OVERHEAD tile: string lights. Transparent background — a FLAT wire at a
 *  fixed height (not a per-tile sag), so placing these tiles edge to edge
 *  reads as one continuous strand instead of a repeating scalloped wave
 *  (which read as eyelashes, not lights). One clear round bulb per tile,
 *  with a socket cap and a soft glow halo. Drawn above the actors. */
function stringLights(): PixelGrid {
  const g = tile();
  g.rect(0, 2, TILE_SIZE, 1, "ink"); // flat wire, same height in every tile
  const bx = 7, by = 3;
  for (const [dx, dy] of [[-2, 1], [2, 1], [-1, 3], [1, 3], [0, 4]] as const) {
    g.px(bx + dx, by + dy, "rust"); // soft glow halo
  }
  g.rect(bx - 1, by, 3, 1, "plum"); // socket cap
  g.px(bx, by + 1, "amber");
  g.rect(bx - 1, by + 2, 3, 2, "amber");
  g.px(bx, by + 4, "amber");
  g.px(bx, by + 2, "atbGold"); // bright filament core
  g.px(bx, by + 3, "atbGold");
  g.outline("ink");
  return g;
}

/** OVERHEAD tile: laundry line. Transparent background — a wire pegged with
 *  hanging bone/sky-blue cloth (and one grubby sock). Drawn above the actors. */
function laundryLine(): PixelGrid {
  const g = tile();
  g.rect(0, 2, TILE_SIZE, 1, "ink"); // the line
  // hanging garments
  g.rect(2, 3, 3, 6, "bone");
  g.rect(3, 3, 1, 6, "sandLight");
  g.rect(7, 3, 3, 5, "skyBlue");
  g.rect(8, 3, 1, 5, "slate");
  g.rect(12, 3, 2, 7, "bone"); // a long sock
  g.px(12, 9, "clay"); // grubby toe
  g.px(13, 9, "clay");
  // pegs
  g.px(3, 2, "rust");
  g.px(8, 2, "rust");
  g.px(12, 2, "rust");
  g.outline("ink");
  return g;
}

// ---------------------------------------------------------------------------
// 2.5D dressing append (Phase Z, docs/ART_DIRECTION.md §2/§5).
// ---------------------------------------------------------------------------

/** 2x2 rust crack chip for the cap tops. */
function rustChip(): PixelGrid {
  const m = new PixelGrid(2, 2);
  m.rect(0, 0, 2, 2, "rust");
  return m;
}

/** The lit top of a camp gallery wall (§2 Cap): warm clay stone with a sand
 *  lit lip along the south edge and a couple of rust crack motifs. */
function campWallCap(seed: number): PixelGrid {
  const g = makeCap({
    base: "clay",
    lip: "sand",
    lipThickness: 2,
    seed,
    motifs: [rustChip()],
    motifCount: 2
  });
  // faint coursing on the top surface
  hLine(g, 2 + (seed % 4), 5, 3, "rust");
  hLine(g, 9, 9 + (seed % 2), 3, "rust");
  // thin dark north edge (§2: north-facing edges stay thin — cap + edge line)
  g.rect(0, 0, TILE_SIZE, 1, "plum");
  return g;
}

/** The vertical south face of a camp wall (§2 Face, G10): mauve → plum
 *  gradient with ink brick courses and the ink foot line. */
function campWallFace(seed: number): PixelGrid {
  const g = makeFace({
    top: "mauve",
    mid: "plum",
    bottom: "plum",
    foot: "ink",
    courseLine: "ink",
    seed
  });
  // break the gradient boundary with 2px cluster dither (G7)
  clusterDither(g, { x: 0, y: 4, w: TILE_SIZE, h: 3 }, "mauve", "plum", seed ^ 0x55, {
    density: 0.5
  });
  // a couple of sandLight mortar glints up top where the string lights catch
  hLine(g, 3 + (seed % 5), 2, 2, "clay");
  return g;
}

/** All contract tiles in order (see TILE5_NAMES). */
export function tile5Frames(): PixelGrid[] {
  return [
    floorBase(501),
    floorBase(502),
    campRug(),
    campWall(503),
    crate(),
    crateStack(),
    barrel(),
    washtub(),
    bedroll(),
    stove(),
    campPost(),
    sockBasket(),
    frostPrint(),
    crateOpen(),
    stringLights(),
    laundryLine(),
    // --- 2.5D dressing append (Phase Z) ---
    campWallCap(531),
    campWallCap(532),
    campWallFace(541),
    campWallFace(542),
    makeShadeVariant(floorBase(501)),
    makeShadeVariant(floorBase(502)),
    makeShadeVariant(campRug()),
    makeShadeVariant(frostPrint()),
  ];
}
