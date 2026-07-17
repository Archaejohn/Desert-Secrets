/**
 * Tileset 3 — sixteen 16×16 Act 2 tiles in the exact contract order
 * (docs/CONTRACTS.md §7): the ice maze under the desert.
 *
 * Same rules as tileset.ts/tileset2.ts: props stamped onto an opaque base
 * via a transparent outlined layer, deterministic speckle from seeded
 * mulberry32. Legibility is contractual: iceFloor is clearly DARKER than
 * iceWallDeep (walkable vs solid), doorRime vs doorOpen and lakeIce vs
 * lakeCrack clearly differ, chasm reads as a near-black pit, and icicle is
 * the one OVERHEAD tile — it keeps a transparent background while every
 * other tile is fully opaque.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { clusterDither, hLine } from "./fx";
import { makeCap, makeEdgeSet, makeFace, makeShadeVariant } from "./tilecraft";
import { TILE_SIZE } from "./tileset";

/** Contract tile order (row-major indices 0..15), plus the 2.5D dressing
 *  append (indices 16..31, docs/ART_DIRECTION.md §2/§5 — additive only). */
export const TILE3_NAMES = [
  "iceFloor",
  "iceFloor2",
  "iceWallDeep",
  "crystalSmall",
  "crystalBig",
  "icicle",
  "chasm",
  "snowdrift",
  "lanternPost",
  "lakeIce",
  "lakeCrack",
  "bridgePlank",
  "doorRime",
  "doorOpen",
  "shard",
  "mossGlow",
  // --- 2.5D dressing append (Phase Z) ---
  "iceWallDeepCap",
  "iceWallDeepCap2",
  "iceWallDeepFace",
  "iceWallDeepFace2",
  "iceFloorShade",
  "iceFloor2Shade",
  "mossGlowShade",
  "lakeIceShade",
  "iceFloorChasmN",
  "iceFloorChasmE",
  "iceFloorChasmS",
  "iceFloorChasmW",
  "iceFloorChasmNE",
  "iceFloorChasmNW",
  "iceFloorChasmSE",
  "iceFloorChasmSW"
] as const;

export type Tile3Name = (typeof TILE3_NAMES)[number];

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

/** Walkable maze ground: deep teal with lantern-sheen bands and a few
 *  indigo rubble chips — clearly darker than every wall tile so the path
 *  always reads. Redrawn for the 2.5D pass (G5): the per-pixel speckle is
 *  replaced by two horizontal sheen bands (light skidding across the ice)
 *  plus 2–3 rubble motif clusters. */
function iceFloorBase(seed: number): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "tealDeep");
  const rng = mulberry32(seed);
  // two sheen bands, upper and lower half, jittered per grain
  for (const bandY of [3, 10] as const) {
    const y = bandY + Math.floor(rng() * 3);
    const x = 1 + Math.floor(rng() * 7);
    const len = 4 + Math.floor(rng() * 3);
    hLine(g, x, y, len, "teal");
    hLine(g, x + 1, y + 1, Math.max(2, len - 3), "teal");
  }
  // 2–3 indigo rubble chips (2x2 clusters, never single pixels)
  const chips = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < chips; i++) {
    const x = 1 + Math.floor(rng() * (TILE_SIZE - 3));
    const y = 1 + Math.floor(rng() * (TILE_SIZE - 3));
    g.rect(x, y, 2, 2, "indigo");
  }
  return g;
}

/** Solid deep-ice wall — redrawn for the 2.5D pass as the calm TOP of the
 *  ice mass (its south facade now comes from `iceWallDeepFace`): bright
 *  skyBlue body with two quiet bone planes and a mint pane, hairline slate
 *  seams — no white-glint speckle, no undercut band, so large wall masses
 *  read as one surface instead of noise. Still clearly brighter than the
 *  dark walkable floor (contract §7 legibility). */
function iceWallDeep(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "skyBlue");
  // two quiet facet planes + one mint pane, asymmetric
  g.rect(2, 2, 6, 4, "bone");
  g.rect(9, 8, 5, 4, "bone");
  g.rect(11, 3, 3, 3, "mint");
  g.rect(3, 11, 4, 2, "mint");
  // hairline frozen seams
  hLine(g, 8, 4, 2, "slate");
  hLine(g, 5, 9, 3, "slate");
  hLine(g, 10, 13, 2, "slate");
  return g;
}

/** Small crystal spur on the walkable floor (decor). */
function crystalSmall(): PixelGrid {
  return stamp(tile(), (l) => {
    // jade spur leaning right
    l.px(7, 6, "jade");
    l.rect(6, 7, 3, 2, "jade");
    l.rect(6, 9, 4, 3, "jade");
    l.px(6, 7, "mint"); // lit facet
    l.px(7, 6, "mint");
    l.px(8, 10, "teal"); // depth
    // skyBlue chip beside it
    l.rect(10, 10, 2, 2, "skyBlue");
    l.px(10, 10, "white");
    l.px(7, 8, "white"); // sparkle
  });
}

/** Big crystal formation — SOLID (blocks movement), so it nearly fills. */
function crystalBig(): PixelGrid {
  return stamp(tile(), (l) => {
    // main jade spire
    l.rect(7, 1, 2, 2, "jade");
    l.rect(6, 3, 4, 5, "jade");
    l.rect(5, 8, 6, 6, "jade");
    // lit left facet, teal-shaded right facet
    for (let y = 3; y <= 12; y++) l.px(y < 8 ? 6 : 5, y, "mint");
    for (let y = 4; y <= 13; y++) l.px(y < 8 ? 9 : 10, y, "teal");
    l.px(7, 1, "mint");
    // skyBlue side spire
    l.rect(11, 5, 3, 9, "skyBlue");
    l.px(11, 5, "mint");
    l.px(12, 4, "skyBlue");
    l.px(13, 12, "slate");
    // stub chip at the left foot
    l.rect(2, 10, 2, 4, "skyBlue");
    l.px(2, 10, "mint");
    // glints
    l.px(7, 2, "white");
    l.px(12, 6, "white");
    l.px(6, 9, "white");
  });
}

/** OVERHEAD tile: icicles hanging from the ceiling line. Transparent
 *  background — the only tile in the set that is not fully opaque. */
function icicle(): PixelGrid {
  const g = tile();
  // ceiling rim
  g.rect(0, 0, TILE_SIZE, 1, "bone");
  g.rect(0, 1, TILE_SIZE, 1, "skyBlue");
  // hanging spikes: 2px wide, tapering to a glinting tip
  const drop = (x: number, len: number): void => {
    for (let i = 0; i < len; i++) {
      g.px(x, 2 + i, "skyBlue");
      if (i < len - 2) g.px(x + 1, 2 + i, "skyBlue");
    }
    g.px(x, 2, "bone"); // lit root
    g.px(x, 2 + len - 1, "white"); // dripping tip
  };
  drop(2, 9);
  drop(6, 5);
  drop(10, 11);
  drop(13, 4);
  g.outline("ink");
  return g;
}

/** Chasm: a near-black pit. Mostly ink with a faint plum lip and specks of
 *  depth so it clearly reads as a hole, not a floor. */
function chasm(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "ink");
  g.rect(0, 0, TILE_SIZE, 1, "plum"); // broken lip catching light
  g.px(3, 1, "plum");
  g.px(9, 1, "plum");
  const rng = mulberry32(106);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = 2 + Math.floor(rng() * 6);
    g.px(x, y, "plum"); // ledges fading into the dark
  }
  return g;
}

/** Snowdrift: a bone bank with white sparkle and skyBlue wind-shadow. */
function snowdrift(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "bone");
  // drift crest curving across the tile
  for (let x = 0; x < TILE_SIZE; x++) {
    const y = 9 + Math.floor(x / 4) - Math.floor(x / 11) * 2;
    g.px(x, y, "skyBlue"); // shadow under the crest
    g.px(x, y - 1, "white"); // lit crest line
  }
  // hollows in the lee
  g.rect(2, 12, 4, 2, "skyBlue");
  g.rect(10, 13, 4, 2, "skyBlue");
  const rng = mulberry32(107);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * 8);
    g.px(x, y, rng() < 0.5 ? "white" : "sandLight"); // powder sparkle
  }
  return g;
}

/** Lantern post — the amber wayfinding landmark at maze junctions. */
function lanternPost(): PixelGrid {
  const g = stamp(tile(), (l) => {
    // post
    l.rect(7, 6, 2, 8, "plum");
    l.px(7, 13, "ink"); // shaded foot
    // bracket + cap
    l.rect(6, 1, 4, 1, "rust");
    l.px(7, 5, "rust");
    l.px(8, 5, "rust");
    // the lantern: amber box with a white-hot heart
    l.rect(6, 2, 4, 3, "amber");
    l.px(7, 3, "white");
    l.px(8, 3, "white");
  });
  // glow spilling onto the ice (after the stamp so it isn't outlined)
  g.px(4, 4, "amber");
  g.px(11, 3, "amber");
  g.px(5, 12, "amber");
  g.px(11, 13, "amber");
  g.px(3, 8, "amber");
  g.px(12, 8, "amber");
  return g;
}

/** Frozen lake surface: pale, still, faintly streaked. */
function lakeIce(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "skyBlue");
  // long sheen streaks frozen into the surface
  g.rect(2, 3, 4, 1, "bone");
  g.rect(7, 6, 5, 1, "bone");
  g.rect(3, 10, 4, 1, "bone");
  g.rect(9, 12, 4, 1, "bone");
  // hairline seams
  g.px(6, 4, "slate");
  g.px(12, 9, "slate");
  g.px(4, 13, "slate");
  g.px(13, 2, "slate");
  const rng = mulberry32(109);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * TILE_SIZE);
    g.px(x, y, "bone");
  }
  g.px(3, 3, "white"); // glints
  g.px(10, 6, "white");
  return g;
}

/** Cracked lake ice: the same surface split by a dark diagonal fracture. */
function lakeCrack(): PixelGrid {
  const g = lakeIce();
  // main fracture running corner to corner
  const path: Array<[number, number]> = [
    [1, 14],
    [2, 13],
    [3, 12],
    [4, 12],
    [5, 11],
    [6, 10],
    [7, 9],
    [8, 9],
    [9, 8],
    [10, 7],
    [11, 6],
    [12, 5],
    [12, 4],
    [13, 3],
    [14, 2],
    [15, 1]
  ];
  for (const [x, y] of path) {
    g.px(x, y, "ink"); // open water showing through
    g.px(x + 1, y, "indigo"); // fractured lip
    g.px(x, y + 1, "slate"); // crushed edge
  }
  // branch cracks
  g.px(5, 13, "indigo");
  g.px(6, 12, "indigo");
  g.px(10, 5, "indigo");
  g.px(9, 4, "indigo");
  return g;
}

/** Plank bridge over the dark — planks run horizontal so tiles join. */
function bridgePlank(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "ink"); // the gap below
  for (const y of [1, 6, 11] as const) {
    g.rect(0, y, TILE_SIZE, 4, "clay"); // plank
    g.rect(0, y, TILE_SIZE, 1, "amber"); // lamplit top edge
    g.rect(0, y + 3, TILE_SIZE, 1, "rust"); // shaded underside
    g.px(4, y + 2, "rust"); // grain
    g.px(9, y + 1, "rust");
    g.px(13, y + 2, "rust");
    g.px(2, y + 1, "plum"); // bolts
    g.px(13, y + 1, "plum");
  }
  return g;
}

/** Door frame shared by doorRime / doorOpen: mauve posts + lintel. */
function doorFrame(): PixelGrid {
  const g = tile();
  g.rect(0, 0, TILE_SIZE, TILE_SIZE, "mauve");
  g.rect(0, 0, TILE_SIZE, 1, "plum"); // lintel shadow line
  g.rect(2, 2, 1, 14, "plum"); // inner frame edges
  g.rect(13, 2, 1, 14, "plum");
  g.rect(2, 2, 12, 1, "plum");
  g.px(1, 1, "clay"); // worn lit corners
  g.px(14, 1, "clay");
  g.px(0, 15, "plum");
  g.px(15, 15, "plum");
  return g;
}

/** Sealed door: the passage choked with rime — clearly shut. */
function doorRime(): PixelGrid {
  const g = doorFrame();
  // frost plug filling the doorway
  g.rect(3, 3, 10, 13, "skyBlue");
  // rime webbing across the plug
  g.rect(4, 4, 3, 2, "bone");
  g.rect(9, 6, 4, 2, "bone");
  g.rect(5, 9, 4, 2, "bone");
  g.rect(8, 12, 4, 2, "bone");
  g.px(7, 7, "bone");
  g.px(6, 13, "bone");
  g.px(11, 10, "bone");
  // frozen seams + glints
  g.px(8, 5, "slate");
  g.px(6, 11, "slate");
  g.px(10, 14, "slate");
  g.px(5, 4, "white");
  g.px(10, 7, "white");
  g.px(9, 13, "white");
  return g;
}

/** Open door: the same frame around a dark walkable passage. */
function doorOpen(): PixelGrid {
  const g = doorFrame();
  // the passage beyond
  g.rect(3, 3, 10, 13, "ink");
  g.px(3, 3, "plum"); // light catching the reveal
  g.px(12, 3, "plum");
  g.px(3, 8, "plum");
  g.px(12, 8, "plum");
  // floor continuing through the doorway
  g.rect(3, 13, 10, 3, "tealDeep");
  g.px(5, 13, "indigo");
  g.px(10, 14, "indigo");
  return g;
}

/** Shard pickup: mint four-point sparkles on the floor — grab it. */
function shard(): PixelGrid {
  const g = iceFloorBase(110);
  g.px(6, 6, "white");
  g.px(5, 6, "mint");
  g.px(7, 6, "mint");
  g.px(6, 5, "mint");
  g.px(6, 7, "mint");
  g.px(11, 11, "white");
  g.px(10, 11, "mint");
  g.px(12, 11, "mint");
  g.px(11, 10, "mint");
  g.px(11, 12, "mint");
  g.px(12, 3, "mint");
  g.px(3, 12, "mint");
  return g;
}

/** Moss-lit floor variant: jade growth with a mint bioluminescent rim. */
function mossGlow(): PixelGrid {
  const g = iceFloorBase(111);
  // moss patches
  g.rect(2, 2, 4, 2, "jade");
  g.rect(9, 4, 5, 2, "jade");
  g.rect(4, 9, 3, 3, "jade");
  g.rect(10, 11, 4, 2, "jade");
  // teal cores
  g.px(3, 3, "teal");
  g.px(11, 5, "teal");
  g.px(5, 10, "teal");
  g.px(11, 12, "teal");
  // mint glow rims + spores drifting off the moss
  g.px(2, 2, "mint");
  g.px(5, 3, "mint");
  g.px(9, 4, "mint");
  g.px(13, 5, "mint");
  g.px(4, 9, "mint");
  g.px(6, 11, "mint");
  g.px(10, 11, "mint");
  g.px(13, 12, "mint");
  g.px(7, 5, "mint");
  g.px(8, 13, "mint");
  return g;
}

// ---------------------------------------------------------------------------
// 2.5D dressing append (Phase Z, docs/ART_DIRECTION.md §2/§5).
// ---------------------------------------------------------------------------

/** 3x2 facet chip motif for the wall cap tops. */
function facetChip(c: "bone" | "mint"): PixelGrid {
  const m = new PixelGrid(3, 2);
  m.rect(0, 0, 3, 2, c);
  return m;
}

/** The lit top of a deep-ice wall run (§2 Cap): skyBlue body, bone/mint
 *  facet chips, and the bone lit lip along the south edge. */
function iceWallDeepCap(seed: number): PixelGrid {
  const g = makeCap({
    base: "skyBlue",
    lip: "bone",
    lipThickness: 2,
    seed,
    motifs: [facetChip("bone"), facetChip("mint")],
    motifCount: 3
  });
  // hairline frozen seams between facets
  hLine(g, 2 + (seed % 3), 6, 2, "slate");
  hLine(g, 10, 9 + (seed % 2), 2, "slate");
  // thin dark north edge (§2: north-facing edges stay thin — cap + edge line)
  g.rect(0, 0, TILE_SIZE, 1, "slate");
  return g;
}

/** The vertical south face of a deep-ice wall (§2 Face, G10): skyBlue →
 *  slate → indigo gradient, broken strata courses, ink foot line. */
function iceWallDeepFace(seed: number): PixelGrid {
  const g = makeFace({ top: "skyBlue", mid: "slate", bottom: "indigo", foot: "ink", seed });
  // break the gradient's band boundaries with 2px cluster dither (G7) so the
  // face reads as one shaded surface, not three stripes
  clusterDither(g, { x: 0, y: 4, w: TILE_SIZE, h: 3 }, "skyBlue", "slate", seed ^ 0x55, {
    density: 0.5
  });
  clusterDither(g, { x: 0, y: 9, w: TILE_SIZE, h: 3 }, "slate", "indigo", seed ^ 0x66, {
    density: 0.5
  });
  return g;
}

/** All contract tiles in order (see TILE3_NAMES). */
export function tile3Frames(): PixelGrid[] {
  const chasmLips = makeEdgeSet(iceFloorBase(100), chasm(), {
    style: "lip",
    lipColor: "ink",
    lipThickness: 2,
    seed: 330
  });
  return [
    iceFloorBase(100),
    iceFloorBase(101),
    iceWallDeep(),
    crystalSmall(),
    crystalBig(),
    icicle(),
    chasm(),
    snowdrift(),
    lanternPost(),
    lakeIce(),
    lakeCrack(),
    bridgePlank(),
    doorRime(),
    doorOpen(),
    shard(),
    mossGlow(),
    // --- 2.5D dressing append (Phase Z) ---
    iceWallDeepCap(301),
    iceWallDeepCap(302),
    iceWallDeepFace(311),
    iceWallDeepFace(312),
    makeShadeVariant(iceFloorBase(100)),
    makeShadeVariant(iceFloorBase(101)),
    makeShadeVariant(mossGlow()),
    makeShadeVariant(lakeIce()),
    chasmLips.edges.n,
    chasmLips.edges.e,
    chasmLips.edges.s,
    chasmLips.edges.w,
    chasmLips.outerCorners.ne,
    chasmLips.outerCorners.nw,
    chasmLips.outerCorners.se,
    chasmLips.outerCorners.sw
  ];
}
