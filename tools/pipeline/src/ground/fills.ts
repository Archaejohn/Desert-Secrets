/**
 * World-position ground fills. Each of the 19 grounds gets its own texture
 * STRUCTURE from the `texture.ts` primitive kit (ripples / wave bands / flowing
 * currents / crystalline facets / warped clumps / clustered grain / ridged
 * crack networks), sampled at absolute world coords so nothing repeats every
 * 16px. Output is a PaletteName from the terrain's ENRICHED ramp.
 *
 * AAP-64 blend register (owner direction, supersedes the dither-within-4 pass):
 *  - Each ground keeps its 4 IDENTITY colours; the BLEND between two adjacent
 *    body IDs runs through the intermediate AAP-64 tones inserted in
 *    `GROUND_RAMPS[key]` (see groundRamps.ts), dithered per-pixel — so a body
 *    transition reads as a smooth multi-step gradient, not a hard 2-colour step.
 *  - Structural features and sparse accents (facet seams, crack cores/fissures,
 *    wave crests, flow glints, rare specks) map to a specific ID's position via
 *    `GROUND_ID_POS[key]` — they're accents, they don't blend.
 *  - Body index roles below are quoted as the ORIGINAL 4-colour ID indices
 *    (0..3); `P[i] = GROUND_ID_POS[key][i]` is that ID's slot in the enriched
 *    ramp, and `R = GROUND_RAMPS[key]` is what we index into.
 *
 * Approved character preserved from the 6-ground prototype: distinct structure
 * per ground, calm/low-contrast body window, rare (≤~3%) extreme accents.
 * World-position, palette-locked (to GROUND_RAMPS), deterministic (h2 / noise).
 * Cliff sheets / terrains.ts floorFill are NOT touched.
 */
import { PixelGrid } from "../grid";
import { h2 } from "../cliffs/noise";
import { worldNoise, worldFbm } from "./worldNoise";
import { worley, cellTone, ridged, striate, warp, ditherRamp } from "./texture";
import { GROUND_RAMPS, GROUND_ID_POS } from "./groundRamps";
import { type TerrainKey } from "../cliffs/palette";
import type { PaletteName } from "../../../../src/shared/palette";

/** Stable, per-key distinct seed (replaces floorFill's collision-prone key.length*13). */
export const keySeed = (k: string): number =>
  [...k].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

const clampIdx = (i: number, n: number): number => (i < 0 ? 0 : i >= n ? n - 1 : i);

export function fill(key: TerrainKey, wx: number, wy: number): PaletteName {
  const R = GROUND_RAMPS[key];   // enriched light→dark ramp (IDs + intermediates)
  const P = GROUND_ID_POS[key];  // P[i] = slot of original ID i within R
  const seed = keySeed(key);
  const ix = Math.floor(wx), iy = Math.floor(wy); // integer world cell for sparse specks
  let idx: number;

  switch (key) {
    // ---- RIPPLES (striate, gentle near-horizontal) -----------------------
    // sand IDs [sandLight,sand,sandShade,umber]. Body blends sand(1)↔sandShade(2);
    // gentle sandLight(0) crest; rare umber(3) grain speck.
    case "sand": {
      const r = striate(wx, wy, Math.PI / 2 + 0.12, 0.16, 2.2, seed);       // near-horizontal
      const r2 = striate(wx, wy, Math.PI / 2 - 0.05, 0.42, 1.4, seed + 9);  // fine detail
      const band = r * 0.7 + r2 * 0.3;
      idx = ditherRamp(1 - band, wx, wy, seed + 17, P[1], P[2]); // blend sand→sandShade
      if (band > 0.90) idx = P[0];                // gentle light ripple crest (body-neighbour)
      if (h2(ix, iy, seed + 71) > 0.985) idx = P[3]; // rare umber grain speck only
      break;
    }
    // frostSand IDs [bone,sandLight,skyBlue,sandShade]. Body blends
    // sandLight(1)↔skyBlue(2); gentle bone(0) crest; rare sandShade(3) speck.
    case "frostSand": {
      const r = striate(wx, wy, Math.PI / 2 + 0.12, 0.16, 2.2, seed);
      const r2 = striate(wx, wy, Math.PI / 2 - 0.05, 0.42, 1.4, seed + 9);
      const band = r * 0.7 + r2 * 0.3;
      idx = ditherRamp(1 - band, wx, wy, seed + 17, P[1], P[2]); // blend sandLight→skyBlue
      if (band > 0.90) idx = P[0];                // gentle bone crest
      if (h2(ix, iy, seed + 71) > 0.985) idx = P[3]; // rare sandShade grain speck
      break;
    }

    // ---- FLOWING (double warp + worldFbm, no cells) ----------------------
    // lava IDs [atbGold,amber,hpRed,rust]. Flow field blends amber(1)↔hpRed(2)
    // (through clay); sparse hot atbGold(0) glints; rare rust(3) cooled specks.
    case "lava": {
      const [x1, y1] = warp(wx, wy, 8, seed);            // primary current bend
      const [x2, y2] = warp(x1, y1, 4.5, seed + 31);     // second pass → turbulent flow
      const flow = worldFbm(x2, y2, seed + 3);           // swirling molten current field
      idx = ditherRamp(1 - flow, wx, wy, seed + 17, P[1], P[2]); // blend amber→hpRed
      if (flow > 0.66 && h2(ix, iy, seed + 41) > 0.72) idx = P[0];      // sparse hot-gold flow glint
      else if (flow < 0.36 && h2(ix, iy, seed + 91) > 0.84) idx = P[3]; // rare dark cooled speck
      break;
    }

    // ---- FACETS (worley per-cell tone + faint seams) ---------------------
    // ice IDs [white,skyBlue,slate,indigo]. Each facet is a FLAT per-cell tone
    // quantized across white(0)→skyBlue(1) (through the icy blue intermediates);
    // faint slate(2) facet bevels; rarest indigo(3) hairline crack cores. The
    // seams stay hard — they are the crystalline structure.
    case "ice": {
      const w = worley(wx, wy, 0.10, seed);
      const edge = w.f2 - w.f1;
      if (edge < 0.03) {                          // facet seam (structural, hard)
        idx = edge < 0.01 ? P[3] : P[2];          // indigo hairline core / slate bevel
      } else {
        const tone = cellTone(w.cell, seed);      // flat per-facet tone
        idx = P[0] + Math.round(tone * (P[1] - P[0])); // white…skyBlue flat facet
      }
      break;
    }
    // frozenLake IDs [skyBlue,slate,indigo,ink]. Flat facets across
    // skyBlue(0)→slate(1); faint indigo(2) bevels; rarest ink(3) crack cores.
    case "frozenLake": {
      const w = worley(wx, wy, 0.09, seed);       // slightly larger lake-ice plates
      const edge = w.f2 - w.f1;
      if (edge < 0.03) {
        idx = edge < 0.01 ? P[3] : P[2];          // ink hairline core / indigo bevel
      } else {
        const tone = cellTone(w.cell, seed);
        idx = P[0] + Math.round(tone * (P[1] - P[0])); // skyBlue…slate flat facet
      }
      break;
    }

    // ---- WAVE BANDS (striate horizontal + slow drift + sparse crest) -----
    // reefWater IDs [skyBlue,teal,tealDeep,indigo]. Wave field blends
    // teal(1)↔tealDeep(2); sparse bright skyBlue(0) crests; rare indigo(3) deep.
    case "reefWater": {
      const fast = striate(wx, wy, Math.PI / 2, 0.24, 3.0, seed);            // primary caustic
      const slow = striate(wx, wy, Math.PI / 2 + 0.08, 0.08, 4.5, seed + 19); // slow swell
      const c = fast * 0.6 + slow * 0.4;
      idx = ditherRamp(1 - c, wx, wy, seed + 17, P[1], P[2]); // blend teal→tealDeep
      if (fast > 0.93 && h2(ix, iy, seed + 31) > 0.72) idx = P[0];      // sparse bright crest speck
      else if (c < 0.10 && h2(ix, iy, seed + 83) > 0.6) idx = P[3];     // rare indigo deep speck
      break;
    }
    // groveWater IDs [skyBlue,teal,tealDeep,indigo]. Same wave structure,
    // distinct seed. Body teal(1)↔tealDeep(2); skyBlue(0) crest; indigo(3) deep.
    case "groveWater": {
      const fast = striate(wx, wy, Math.PI / 2, 0.24, 3.0, seed);
      const slow = striate(wx, wy, Math.PI / 2 + 0.08, 0.08, 4.5, seed + 19);
      const c = fast * 0.6 + slow * 0.4;
      idx = ditherRamp(1 - c, wx, wy, seed + 17, P[1], P[2]);
      if (fast > 0.93 && h2(ix, iy, seed + 31) > 0.72) idx = P[0];
      else if (c < 0.10 && h2(ix, iy, seed + 83) > 0.6) idx = P[3];
      break;
    }

    // ---- CLUMPS (warp + threshold patches) -------------------------------
    // groveMoss IDs [jade,teal,umber,ink]. Clump field blends teal(1)↔umber(2)
    // (moss over soil, through stoneDark/mauve); sparse jade(0) crown; rare
    // ink(3) deep-gap speck.
    case "groveMoss": {
      const [x2, y2] = warp(wx, wy, 7, seed);
      const m = worldNoise(x2, y2, 0.07, seed + 3) * 0.7
              + worldNoise(x2, y2, 0.15, seed + 5) * 0.3; // big warped clumps
      idx = ditherRamp(1 - m, wx, wy, seed + 17, P[1], P[2]); // blend teal→umber
      if (m > 0.84 && h2(ix, iy, seed + 23) > 0.35) idx = P[0]; // sparse jade crown highlight
      if (m < 0.16 && h2(ix, iy, seed + 67) > 0.5) idx = P[3];  // rare ink deep-gap speck
      break;
    }
    // glowMoss IDs [mint,jade,teal,tealDeep]. Body jade(1)↔teal(2); signature
    // glow as a sparse-but-present mint(0) crown; rare tealDeep(3) deep gap.
    case "glowMoss": {
      const [x2, y2] = warp(wx, wy, 6, seed);
      const m = worldNoise(x2, y2, 0.08, seed + 3) * 0.7
              + worldNoise(x2, y2, 0.17, seed + 5) * 0.3;
      idx = ditherRamp(1 - m, wx, wy, seed + 17, P[1], P[2]); // blend jade→teal
      if (m > 0.80 && h2(ix, iy, seed + 23) > 0.25) idx = P[0]; // sparse mint glow crown
      if (m < 0.16 && h2(ix, iy, seed + 67) > 0.5) idx = P[3];  // rare tealDeep deep-gap speck
      break;
    }
    // rimeMoss IDs [mint,jade,teal,tealDeep]. Finer/frostier clumps. Body
    // jade(1)↔teal(2); sparse mint(0) crown; rare tealDeep(3) gap.
    case "rimeMoss": {
      const [x2, y2] = warp(wx, wy, 5, seed);
      const m = worldNoise(x2, y2, 0.11, seed + 3) * 0.65
              + worldNoise(x2, y2, 0.22, seed + 5) * 0.35; // finer clumps
      idx = ditherRamp(1 - m, wx, wy, seed + 17, P[1], P[2]); // blend jade→teal
      if (m > 0.85 && h2(ix, iy, seed + 23) > 0.4) idx = P[0];  // sparse mint frost crown
      if (m < 0.15 && h2(ix, iy, seed + 67) > 0.5) idx = P[3];  // rare tealDeep deep-gap speck
      break;
    }
    // groveGrass IDs [mint,jade,teal,tealDeep]. Broader lush blades. Body
    // jade(1)↔teal(2); sparse mint(0) blade highlight; rare tealDeep(3) gap.
    case "groveGrass": {
      const [x2, y2] = warp(wx, wy, 8, seed);
      const m = worldNoise(x2, y2, 0.06, seed + 3) * 0.72
              + worldNoise(x2, y2, 0.14, seed + 5) * 0.28; // broad clumps
      idx = ditherRamp(1 - m, wx, wy, seed + 17, P[1], P[2]); // blend jade→teal
      if (m > 0.80 && h2(ix, iy, seed + 23) > 0.4) idx = P[0];  // sparse mint blade highlight
      if (m < 0.16 && h2(ix, iy, seed + 67) > 0.55) idx = P[3]; // rare tealDeep gap speck
      break;
    }

    // ---- GRAIN (fine clustered warped worley cells) ----------------------
    // groveSoil IDs [clay,umber,stoneDeep,ink]. Grain cells blend
    // umber(1)↔stoneDeep(2) (through red1/grey2); sparse clay(0) light-grain
    // fleck; rare ink(3) hollow fleck.
    case "groveSoil": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.40, seed);        // fine grain cells
      const cluster = worldNoise(wx, wy, 0.06, seed + 11); // where grit gathers
      const tone = cellTone(w.cell, seed);
      idx = ditherRamp(1 - tone, wx, wy, seed + 17, P[1], P[2]); // blend umber→stoneDeep
      if (h2(ix, iy, seed + 29) > 0.94) idx = P[0];   // sparse clay light-grain fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = P[3]; // rare ink hollow fleck
      break;
    }
    // ash IDs [bone,sandShade,stone,stoneDark]. Grain blends sandShade(1)↔
    // stone(2); sparse bone(0) light-ash fleck; rare stoneDark(3) hollow fleck.
    case "ash": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.40, seed);
      const cluster = worldNoise(wx, wy, 0.06, seed + 11);
      const tone = cellTone(w.cell, seed);
      idx = ditherRamp(1 - tone, wx, wy, seed + 17, P[1], P[2]); // blend sandShade→stone
      if (h2(ix, iy, seed + 29) > 0.94) idx = P[0];   // sparse bone light-ash fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = P[3]; // rare stoneDark fleck
      break;
    }
    // reefSilt IDs [tealDeep,indigo,plum,ink]. Grain blends indigo(1)↔plum(2);
    // sparse tealDeep(0) light fleck; rare ink(3) hollow.
    case "reefSilt": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.42, seed);
      const cluster = worldNoise(wx, wy, 0.06, seed + 11);
      const tone = cellTone(w.cell, seed);
      idx = ditherRamp(1 - tone, wx, wy, seed + 17, P[1], P[2]); // blend indigo→plum
      if (h2(ix, iy, seed + 29) > 0.945) idx = P[0];  // sparse tealDeep light fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = P[3]; // rare ink hollow fleck
      break;
    }
    // asphalt IDs [slate,indigo,plum,ink]. Fine aggregate blends indigo(1)↔
    // plum(2); sparse slate(0) aggregate fleck; rare ink(3) pit fleck.
    case "asphalt": {
      const [x2, y2] = warp(wx, wy, 3, seed + 5);
      const w = worley(x2, y2, 0.5, seed);         // fine aggregate
      const cluster = worldNoise(wx, wy, 0.06, seed + 11);
      const tone = cellTone(w.cell, seed);
      idx = ditherRamp(1 - tone, wx, wy, seed + 17, P[1], P[2]); // blend indigo→plum
      if (h2(ix, iy, seed + 29) > 0.94) idx = P[0];   // sparse slate aggregate fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = P[3]; // rare ink pit fleck
      break;
    }
    // reefFloor IDs [teal,tealDeep,indigo,ink]. Grain blends tealDeep(1)↔
    // indigo(2); sparse teal(0) light fleck; rare ink(3) hollow.
    case "reefFloor": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.40, seed);
      const cluster = worldNoise(wx, wy, 0.06, seed + 11);
      const tone = cellTone(w.cell, seed);
      idx = ditherRamp(1 - tone, wx, wy, seed + 17, P[1], P[2]); // blend tealDeep→indigo
      if (h2(ix, iy, seed + 29) > 0.955) idx = P[0];  // sparse teal light fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = P[3]; // rare ink hollow fleck
      break;
    }

    // ---- CRACKED (ridged crack network over a subtle body) ---------------
    // emberRock IDs [clay,rust,stoneDeep,ink]. Warm basalt body blends
    // rust(1)↔stoneDeep(2) (through umber/mauve); the ridged crack network stays
    // hard: creases settle to stoneDeep(2), rarest cores to ink(3); rare warm
    // clay(0) glint.
    case "emberRock": {
      const r = ridged(wx, wy, seed);
      const body = worldFbm(wx, wy, seed + 3);
      idx = ditherRamp(1 - body, wx, wy, seed + 17, P[1], P[2]); // blend rust→stoneDeep
      if (r > 0.88) idx = P[2];                     // crease settles to stoneDeep (dark crack)
      if (r > 0.95 && h2(ix, iy, seed + 47) > 0.5) idx = P[3]; // rare deep ink crack core
      if (h2(ix, iy, seed + 71) > 0.975) idx = P[0]; // rare warm clay glint
      break;
    }
    // lavaCrust IDs [hpRed,rust,stoneDeep,ink]. INVERTED: dark crust body blends
    // stoneDeep(2)↔ink(3) (through grey1); the ridged crack network glows hard —
    // rust(1) fissures, rarest hottest cores flare hpRed(0).
    case "lavaCrust": {
      const r = ridged(wx, wy, seed);
      const body = worldFbm(wx, wy, seed + 3);
      idx = ditherRamp(1 - body, wx, wy, seed + 17, P[2], P[3]); // blend stoneDeep→ink
      if (r > 0.82) idx = P[1];                      // rust fissure glow along cracks
      if (r > 0.93 && h2(ix, iy, seed + 31) > 0.6) idx = P[0]; // rare bright hpRed hot core
      break;
    }

    // ---- SOFT DRIFT (broad gentle warp/macro, very smooth) ---------------
    // snow IDs [white,bone,skyBlue,slate]. Very smooth broad drift blends
    // white(0)↔bone(1); rare soft skyBlue(2) hollow; rarest slate(3) speck.
    case "snow": {
      const [x2, y2] = warp(wx, wy, 5, seed);
      const d = worldNoise(x2, y2, 0.04, seed + 3) * 0.7
              + worldNoise(x2, y2, 0.09, seed + 5) * 0.3; // broad, smooth
      idx = ditherRamp(1 - d, wx, wy, seed + 17, P[0], P[1]); // blend white→bone
      if (d < 0.24 && h2(ix, iy, seed + 41) > 0.6) idx = P[2]; // rare soft skyBlue hollow
      if (h2(ix, iy, seed + 83) > 0.985) idx = P[3];  // rarest slate speck
      break;
    }

    // ---- AUTHORED SLAB (submerged temple flagstones) ---------------------
    // 3x2-tile (48x32) slab lattice on the world grid: per-slab flat body tone,
    // per-slab shading off a top-left light (lit lip + far-edge shade), dark grout
    // joints at block boundaries, a ridged crack network, sparse wear, and a faint
    // near-horizontal skyBlue water sheen (the one off-ramp accent).
    case "templeSlab": {
      const BW = 48, BH = 32;
      const bx = Math.floor(wx / BW), by = Math.floor(wy / BH);
      const lx = wx - bx * BW, ly = wy - by * BH;   // 0..BW-1 / 0..BH-1
      // per-slab flat body tone: WARM variation between plum (P[1]) and one step
      // toward mauve (P[1]-1, a tan stone) — never toward indigo, so slabs read as
      // purple/tan flagstones, not blue. Indigo is reserved for grout/shade/cracks.
      const tone = h2(bx, by, seed);
      let i = tone > 0.5 ? P[1] : clampIdx(P[1] - 1, R.length);
      // per-slab shading off a top-left light.
      if (lx < 2 || ly < 2) i = P[0];               // lit lip (mauve) inside top/left
      if (lx >= BW - 1 || ly >= BH - 1) i = P[2];   // shaded far edge (indigo)
      // grout joints along block boundaries (override the lit lip so joints stay dark).
      if (lx === 0 || ly === 0) i = (lx === 0 && ly === 0) ? P[3] : P[2];
      // crack network crossing slabs: creases settle to indigo, rare ink cores.
      const r = ridged(wx, wy, seed + 5);
      if (r > 0.90) i = P[2];
      if (r > 0.965 && h2(ix, iy, seed + 47) > 0.5) i = P[3];
      // rare wear fleck toward the lit tone.
      if (h2(ix, iy, seed + 71) > 0.985) i = P[0];
      // faint water sheen: very sparse SCATTERED skyBlue glints (off-ramp accent) —
      // a wet sparkle on slab interiors, NOT a banded streak (an earlier striate
      // sheen concentrated into bright horizontal rivulets along block rows).
      if (lx > 1 && ly > 1 && h2(ix, iy, seed + 11) > 0.99) return "skyBlue";
      idx = i;
      break;
    }

    default: {
      const _never: never = key;
      throw new Error(`unknown terrain ${_never as string}`);
    }
  }
  return R[clampIdx(idx, R.length)];
}

export function fillField(key: TerrainKey, ox: number, oy: number, w: number, h: number): PixelGrid {
  const g = new PixelGrid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.px(x, y, fill(key, ox + x, oy + y));
  return g;
}
