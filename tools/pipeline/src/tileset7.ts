/**
 * Tileset 7 — sixteen 16×16 Act 6 tiles in the exact contract order
 * (docs/CONTRACTS.md §17): The Reef, the crystal-crawlers' home — a drowned
 * cavern deeper than Act 2's galleries, where the crawlers FARM glowing kelp
 * in tended rows. Deliberately reads DIFFERENTLY from Act 3's wild kelp sea
 * (tiles4): that was a dim teal wilderness; this is a cultivated garden, a
 * dark reef floor lit cold from within by bioluminescent mint/skyBlue glow,
 * neat trellised MINT kelp rows (the seaweed the party is after) set against
 * tangled dark WILD kelp — so the cultivated crop reads distinct from the
 * wild growth by colour, order and walkability.
 *
 * Same rules as tileset.ts..tileset6.ts: props stamped onto an opaque floor
 * base via a transparent, ink-outlined layer; deterministic speckle from a
 * seeded mulberry32. Solid: `reefWall`, `coralHead`, `crystalCluster`,
 * `reefWater`, `reefWater2`, `wildKelp`, `kelpTrellis`. `reefWater` ↔
 * `reefWater2` animate like every other water pair. `kelpCanopy` is the one
 * OVERHEAD tile (transparent background, drawn above the actors so the party
 * swims *under* the wild kelp). The cultivated `mintKelp` is WALKABLE decor —
 * the party walks the farm rows — where the solid `wildKelp` is a walk-around.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { canopyLobes, clusterDither, hLine } from "./fx";
import { makeCap, makeEdgeSet, makeFace, makeShadeVariant } from "./tilecraft";
import { TILE_SIZE } from "./tileset";

/** Contract tile order (row-major indices 0..15). */
export const TILE7_NAMES = [
  "reefFloor",
  "reefFloor2",
  "reefSilt",
  "glowMoss",
  "reefWall",
  "coralHead",
  "crystalCluster",
  "mintKelp",
  "reefWater",
  "reefWater2",
  "reefStone",
  "wildKelp",
  "kelpTrellis",
  "kelpCanopy",
  "seaAnemone",
  "shellCluster",
  // --- 2.5D dressing append (Phase Z, docs/ART_DIRECTION.md §2/§5) ---
  "reefWallCap",
  "reefWallCap2",
  "reefWallFace",
  "reefWallFace2",
  "reefFloorShade",
  "reefSiltShade",
  "glowMossShade",
  "mintKelpShade",
  "siltFloorN",
  "siltFloorE",
  "siltFloorS",
  "siltFloorW",
  "siltFloorNE",
  "siltFloorNW",
  "siltFloorSE",
  "siltFloorSW",
] as const;

export type Tile7Name = (typeof TILE7_NAMES)[number];

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

/** The reef seabed — walkable. A dark tealDeep/indigo silt floor lit cold from
 *  within by a scatter of skyBlue/mint biolight motes; a few sand grains show
 *  through. `seed` varies the speckle grain. This is the garden's dark ground
 *  against which the cultivated glow reads bright. */
/** Redrawn for the 2.5D pass (G5): calm tealDeep seabed with rounded indigo
 *  silt pockets, paired slate grit chips and one soft biolight mote pair —
 *  no half-tile band, no per-pixel speckle. */
function reefBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "tealDeep");
  const rng = mulberry32(seed);
  // rounded indigo silt pockets
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rng() * 11);
    const y = 2 + Math.floor(rng() * 11);
    hLine(g, x + 1, y, 2, "indigo");
    hLine(g, x, y + 1, 4, "indigo");
  }
  // slate grit chips (2px)
  hLine(g, 3, 3, 2, "slate");
  hLine(g, 11, 7, 2, "slate");
  hLine(g, 6, 12, 2, "slate");
  // one biolight mote pair — the garden's cold light
  const bx = 2 + Math.floor(rng() * 12);
  const by = 2 + Math.floor(rng() * 12);
  g.px(bx, by, "skyBlue");
  g.px(bx + 1, by, "mint");
  return g;
}

/** Darker deep silt — walkable. A cooler, near-black tealDeep/ink floor for
 *  the deep hollow, threaded with faint indigo and a lone biolight. */
/** Redrawn for the 2.5D pass (G5): near-black silt — indigo body, rounded
 *  ink hollows, paired tealDeep grain and one soft mint glow. No band. */
function reefSilt(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "indigo");
  const rng = mulberry32(seed);
  // rounded ink hollows
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rng() * 11);
    const y = 2 + Math.floor(rng() * 11);
    hLine(g, x + 1, y, 2, "ink");
    hLine(g, x, y + 1, 4, "ink");
    hLine(g, x + 1, y + 2, 2, "ink");
  }
  // tealDeep grain (2px pairs)
  hLine(g, 4, 3, 2, "tealDeep");
  hLine(g, 10, 8, 2, "tealDeep");
  hLine(g, 5, 13, 2, "tealDeep");
  g.px(6, 11, "mint"); // one soft glow
  g.px(12, 4, "skyBlue");
  g.px(13, 4, "skyBlue");
  return g;
}

/** Glowing moss bed — walkable and the BRIGHTEST floor in the set: the cold
 *  bioluminescent turf the crawlers grow their garden on. mint/jade lit crust
 *  over tealDeep, shot through with skyBlue and white sparks. */
/** Redrawn for the 2.5D pass (G5, organic school): the cold luminous garden
 *  turf as rounded jade cushions over teal, each cushion carrying a mint
 *  lit arc, with paired skyBlue glints — no bands, no speckle. Still the
 *  brightest floor in the set. */
function glowMoss(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "teal");
  canopyLobes(g, seed, {
    lobes: 5,
    rMin: 2.2,
    rMax: 3.4,
    base: "jade",
    highlight: "mint",
    crevice: "tealDeep"
  });
  // cold skyBlue glints in the glow (2px pairs)
  const rng = mulberry32(seed ^ 0x7717);
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rng() * 13);
    const y = 1 + Math.floor(rng() * 14);
    g.px(x, y, "skyBlue");
    g.px(x + 1, y, "mint");
  }
  return g;
}

/** Reef cavern wall — SOLID. Heavy ink/plum drowned stone with slate facets, a
 *  rust-mineral vein and cold biolight crusting the cracks; the darkest, most
 *  solid tile so the walls read hard against the lit garden floor. */
function reefWall(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "plum");
  g.rect(0, 11, TILE_SIZE, 5, "ink"); // shadowed base
  g.rect(0, 0, TILE_SIZE, 1, "slate"); // faint lit top
  // slate block facets
  for (const [x, y, w, h] of [
    [2, 2, 4, 3],
    [9, 2, 4, 4],
    [3, 7, 5, 3],
    [10, 8, 4, 3],
  ] as const) {
    g.rect(x, y, w, h, "slate");
    g.px(x, y, "skyBlue"); // lit corner
  }
  // rust mineral vein
  for (const [x, y] of [
    [7, 3],
    [8, 4],
    [12, 6],
    [5, 10],
  ] as const) {
    g.px(x, y, "rust");
  }
  // biolight crusting the cracks
  g.px(1, 6, "mint");
  g.px(14, 11, "skyBlue");
  g.px(6, 13, "mint");
  const rng = mulberry32(seed);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * 10);
    g.px(x, y, "plum");
  }
  return g;
}

/** Coral head — SOLID walk-around. A knobbly clay/rust coral bloom crowned
 *  with amber polyps, growing off the dark reef floor. */
function coralHead(): PixelGrid {
  return stamp(tile(), (l) => {
    l.rect(4, 6, 8, 8, "clay");
    l.rect(5, 4, 6, 3, "clay");
    l.rect(3, 10, 10, 4, "rust"); // shaded foot
    // knobs
    l.px(4, 5, "amber");
    l.px(7, 3, "amber");
    l.px(10, 5, "amber");
    l.px(6, 6, "amber");
    l.px(9, 7, "amber");
    // polyp mouths
    l.px(6, 8, "hpRed");
    l.px(10, 9, "hpRed");
    l.px(8, 11, "ink");
    // a lit rim
    l.px(4, 6, "sand");
    l.px(11, 6, "sand");
  });
}

/** Crystal cluster — SOLID walk-around. A shard of the same skyBlue/mint
 *  crystal that marked the crawlers' territory in Act 2's galleries — the
 *  boundary-stones of their home, glinting cold. */
function crystalCluster(): PixelGrid {
  return stamp(tile(), (l) => {
    // three angular shards
    for (const [bx, h] of [
      [4, 8],
      [7, 11],
      [10, 7],
    ] as const) {
      for (let i = 0; i < h; i++) {
        const y = 13 - i;
        const half = Math.max(0, Math.round((1 - i / h) * 2));
        for (let dx = -half; dx <= half; dx++) l.px(bx + dx, y, "skyBlue");
      }
      l.px(bx, 13 - h + 1, "white"); // lit tip
      l.px(bx + 1, 13 - Math.floor(h / 2), "mint"); // inner glint
    }
    l.rect(3, 12, 10, 2, "slate"); // rock socket
  });
}

/** CULTIVATED mint kelp — WALKABLE decor. The crop the crawlers farm on
 *  purpose, and the very seaweed the party is after: bright, tidy mint fronds
 *  climbing a short trellis stake in a neat row, unmistakably tended (vs. the
 *  tangled dark wild kelp). Drawn on the glowing garden bed. */
function mintKelp(): PixelGrid {
  const g = glowMoss(713);
  // a slim stake with paired mint fronds — orderly, cultivated
  for (let y = 3; y <= 13; y++) g.px(8, y, "teal"); // the trellis stake
  for (const [y, spread] of [
    [4, 3],
    [6, 4],
    [8, 4],
    [10, 3],
    [12, 2],
  ] as const) {
    g.px(8 - spread, y, "mint");
    g.px(8 - spread + 1, y, "jade");
    g.px(8 + spread, y, "mint");
    g.px(8 + spread - 1, y, "jade");
  }
  // bright lit tips
  g.px(8, 2, "mint");
  g.px(5, 4, "white");
  g.px(11, 6, "white");
  return g;
}

/** The reef water — SOLID. Cold deep water: tealDeep/indigo with skyBlue
 *  reflections and a mint biolight shimmer. `phase` drifts the ripples so
 *  reefWater ↔ reefWater2 animate like every other water pair. */
function reefWater(phase: 0 | 1): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "indigo");
  const d = phase;
  g.rect(0, 8, TILE_SIZE, 8, "tealDeep"); // deeper channel
  // skyBlue ripples drifting with the phase
  for (const [ry, len, rx] of [
    [2, 5, 1],
    [5, 4, 8],
    [10, 5, 2],
    [13, 3, 10],
  ] as const) {
    const y = (ry + d) % TILE_SIZE;
    for (let i = 0; i < len; i++) g.px((rx + i + d) % TILE_SIZE, y, "skyBlue");
  }
  // mint biolight shimmer + white sparks
  g.px((5 + d) % TILE_SIZE, (3 + d) % TILE_SIZE, "mint");
  g.px((12 + d) % TILE_SIZE, 7, "skyBlue");
  g.px((3 + d) % TILE_SIZE, (11 + d) % TILE_SIZE, "white");
  return g;
}

/** Reef stone — WALKABLE stepping-stone/bank tile: pale slate rock beaded with
 *  skyBlue water, set into the dark reef floor to keep crossings passable. */
function reefStone(): PixelGrid {
  return stamp(reefBase(714), (l) => {
    for (const [x, y, w, h] of [
      [2, 4, 4, 3],
      [8, 3, 5, 4],
      [4, 9, 5, 4],
      [10, 10, 4, 3],
    ] as const) {
      l.rect(x, y, w, h, "slate");
      l.px(x, y, "skyBlue"); // wet lit edge
      l.px(x + w - 1, y + h - 1, "indigo"); // shade
    }
    l.px(9, 4, "mint"); // biolight bead
    l.px(5, 10, "white");
    l.px(12, 11, "skyBlue");
  });
}

/** WILD kelp — SOLID walk-around. Tangled, overgrown dark kelp, the untended
 *  wild growth the garden was cleared out of: heavy teal/tealDeep stalks with
 *  only a dull jade sheen — deliberately dimmer and messier than the tidy,
 *  bright cultivated mintKelp. */
function wildKelp(): PixelGrid {
  return stamp(tile(), (l) => {
    // a knot of leaning, overlapping stalks
    for (const [bx, lean] of [
      [4, 1],
      [7, -1],
      [9, 1],
      [12, -1],
    ] as const) {
      for (let i = 0; i < 12; i++) {
        const y = 13 - i;
        const x = bx + Math.round((lean * i) / 5);
        l.px(x, y, i > 8 ? "jade" : "teal"); // only the tips catch light
        if (i % 3 === 0) l.px(x + lean, y, "tealDeep"); // stray fronds
      }
    }
    l.rect(3, 12, 11, 2, "tealDeep"); // dark holdfast tangle
    l.px(6, 4, "jade");
    l.px(10, 3, "jade");
  });
}

/** Kelp trellis — SOLID. The crawler-built frame the cultivated mint kelp is
 *  grown up: a lashed clay/rust cross-frame, evidence of deliberate farming. */
function kelpTrellis(): PixelGrid {
  return stamp(tile(), (l) => {
    // two uprights and two cross-bars, lashed
    l.rect(4, 2, 1, 13, "clay");
    l.rect(11, 2, 1, 13, "clay");
    l.rect(4, 5, 8, 1, "clay");
    l.rect(4, 10, 8, 1, "clay");
    // rust lashings at the joints
    for (const [x, y] of [
      [4, 5],
      [11, 5],
      [4, 10],
      [11, 10],
    ] as const) {
      l.px(x, y, "rust");
    }
    // lit edges + a couple of trained mint sprigs on the frame
    l.px(4, 2, "sand");
    l.px(11, 2, "sand");
    l.px(6, 6, "mint");
    l.px(9, 11, "mint");
  });
}

/** Wild-kelp canopy — the one OVERHEAD tile: transparent background, a dense
 *  dark teal/jade frond mass drawn above the actors so the party swims *under*
 *  the overhanging wild kelp; cold mint biolights glint in the leaves. */
function kelpCanopy(): PixelGrid {
  const g = tile();
  // rounded frond mass
  g.rect(2, 1, 12, 9, "teal");
  g.rect(3, 0, 10, 2, "teal");
  g.rect(1, 3, 14, 5, "teal");
  g.rect(3, 10, 8, 2, "tealDeep");
  // depth: tealDeep shade lower/right, jade lit crown up top
  g.rect(8, 7, 6, 4, "tealDeep");
  g.px(3, 2, "jade");
  g.px(5, 1, "jade");
  g.px(4, 4, "jade");
  g.px(2, 5, "jade");
  // cold biolights tucked in the leaves
  for (const [x, y] of [
    [5, 4],
    [10, 3],
    [7, 7],
    [11, 8],
    [4, 8],
  ] as const) {
    g.px(x, y, "mint");
    g.px(x + 1, y, "skyBlue");
  }
  g.outline("ink");
  return g;
}

/** Sea anemone — WALKABLE decor: a bright glowing bloom in the garden turf,
 *  hpRed/amber tendrils around a skyBlue core. */
function seaAnemone(): PixelGrid {
  const g = tile();
  // a squat column
  g.rect(6, 9, 4, 5, "mauve");
  g.px(6, 9, "clay"); // lit side
  // a crown of waving tendrils
  for (const [x, y, c] of [
    [5, 7, "hpRed"],
    [7, 6, "amber"],
    [9, 6, "hpRed"],
    [10, 7, "amber"],
    [4, 8, "amber"],
    [11, 8, "hpRed"],
    [8, 5, "amber"],
  ] as const) {
    g.px(x, y, c);
    g.px(x, y - 1, "sand");
  }
  g.px(7, 8, "skyBlue"); // glowing mouth
  g.px(8, 8, "white");
  return g;
}

/** Shell cluster — WALKABLE decor: a little heap of bone/sand shells and one
 *  skyBlue pearl, strewn on the reef floor. */
function shellCluster(): PixelGrid {
  const g = tile();
  for (const [x, y] of [
    [3, 9],
    [6, 11],
    [10, 10],
    [12, 12],
  ] as const) {
    // a small fan shell
    g.px(x, y, "bone");
    g.px(x + 1, y, "sand");
    g.px(x, y + 1, "sand");
    g.px(x + 1, y + 1, "clay"); // shaded hinge
    g.px(x, y - 1, "bone");
  }
  g.px(8, 8, "skyBlue"); // a pearl
  g.px(8, 7, "white");
  return g;
}

// ---------------------------------------------------------------------------
// 2.5D dressing append (Phase Z, docs/ART_DIRECTION.md §2/§5).
// ---------------------------------------------------------------------------

/** 2x2 chip motif. */
function chip7(c: "mint" | "slate"): PixelGrid {
  const m = new PixelGrid(2, 2);
  m.rect(0, 0, 2, 2, c);
  return m;
}

/** The lit top of a reef wall run (§2 Cap): slate drowned stone, skyBlue
 *  lit lip, biolight crusting the surface. */
function reefWallCap(seed: number): PixelGrid {
  const g = makeCap({
    base: "slate",
    lip: "skyBlue",
    lipThickness: 2,
    seed,
    motifs: [chip7("mint"), chip7("slate")],
    motifCount: 3
  });
  hLine(g, 2 + (seed % 4), 6, 3, "indigo"); // a hairline seam
  // thin dark north edge (§2: north-facing edges stay thin — cap + edge line)
  g.rect(0, 0, TILE_SIZE, 1, "indigo");
  return g;
}

/** The vertical south face of a reef wall (§2 Face, G10): slate → indigo
 *  gradient, broken strata, ink foot line and a cold biolight crack. */
function reefWallFace(seed: number): PixelGrid {
  const g = makeFace({ top: "slate", mid: "indigo", bottom: "indigo", foot: "ink", seed });
  // break the gradient boundary with 2px cluster dither (G7)
  clusterDither(g, { x: 0, y: 4, w: TILE_SIZE, h: 3 }, "slate", "indigo", seed ^ 0x55, {
    density: 0.5
  });
  // biolight crusting a crack mid-face
  g.px(4 + (seed % 4), 9, "mint");
  g.px(5 + (seed % 4), 10, "skyBlue");
  return g;
}

/** All contract tiles in order (see TILE7_NAMES). */
export function tile7Frames(): PixelGrid[] {
  // Silt owns its border against the reef floor: a floor band eaten into by
  // clustered indigo silt fingers (organic school, no dither).
  const siltFloor = makeEdgeSet(reefSilt(703), reefBase(701), {
    style: "fingers",
    fingerColor: "indigo",
    bandDepth: 5,
    seed: 730,
    fingerOpts: { density: 0.5 }
  });
  return [
    reefBase(701),
    reefBase(702),
    reefSilt(703),
    glowMoss(704),
    reefWall(705),
    coralHead(),
    crystalCluster(),
    mintKelp(),
    reefWater(0),
    reefWater(1),
    reefStone(),
    wildKelp(),
    kelpTrellis(),
    kelpCanopy(),
    seaAnemone(),
    shellCluster(),
    // --- 2.5D dressing append (Phase Z) ---
    reefWallCap(731),
    reefWallCap(732),
    reefWallFace(741),
    reefWallFace(742),
    makeShadeVariant(reefBase(701)),
    makeShadeVariant(reefSilt(703)),
    makeShadeVariant(glowMoss(704)),
    makeShadeVariant(mintKelp()),
    siltFloor.edges.n,
    siltFloor.edges.e,
    siltFloor.edges.s,
    siltFloor.edges.w,
    siltFloor.outerCorners.ne,
    siltFloor.outerCorners.nw,
    siltFloor.outerCorners.se,
    siltFloor.outerCorners.sw,
  ];
}
