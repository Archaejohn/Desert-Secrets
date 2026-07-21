/**
 * World-position ground fills. Each of the 19 grounds gets its own texture
 * STRUCTURE from the `texture.ts` primitive kit (ripples / wave bands / flowing
 * currents / crystalline facets / warped clumps / clustered grain / ridged
 * crack networks), sampled at absolute world coords so nothing repeats every
 * 16px. Output is a PaletteName from the terrain's ramp.
 *
 * Approved design register (owner-signed-off on the 6-ground prototype, now
 * rolled across all 19):
 *  1. Each ground reads as a distinct STRUCTURE, not the old single-pixel speckle.
 *  2. SHADED recipe: the texture modulates only within the material's body
 *     index ±1 window. The ramp EXTREMES (idx0 lightest, idx3 darkest) are RARE
 *     sparse specks (≤ ~3%), never a structural band/cell/clump. (Exception the
 *     owner blessed: idx0 as the *light body-neighbour* may be a gentle
 *     crest/highlight, kept sparse. And lavaCrust is inverted by design — its
 *     glowing fissures ARE the light accents over a dark crust body.)
 *  3. Low contrast — a calm surface with quiet structure, not a graphic pattern.
 *  4. World-position, palette-locked, deterministic (h2 / world-noise only).
 */
import { PixelGrid } from "../grid";
import { h2 } from "../cliffs/noise";
import { worldNoise, worldFbm } from "./worldNoise";
import { worley, cellTone, ridged, striate, warp, ditherRamp } from "./texture";
import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";
import type { PaletteName } from "../../../../src/shared/palette";

/** Stable, per-key distinct seed (replaces floorFill's collision-prone key.length*13). */
export const keySeed = (k: string): number =>
  [...k].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

const clampIdx = (i: number, n: number): number => (i < 0 ? 0 : i >= n ? n - 1 : i);

export function fill(key: TerrainKey, wx: number, wy: number): PaletteName {
  const ramp = TERRAIN_RAMPS[key];
  const seed = keySeed(key);
  const ix = Math.floor(wx), iy = Math.floor(wy); // integer world cell for sparse specks
  let idx: number;

  switch (key) {
    // ---- RIPPLES (striate, gentle near-horizontal) -----------------------
    // sand ["sandLight","sand","sandShade","umber"] — TUNED exemplar. Body
    // shades sand(1) ↔ sandShade(2); gentle sandLight(0) crest; rare umber(3)
    // grain speck only. No brown bands.
    case "sand": {
      const r = striate(wx, wy, Math.PI / 2 + 0.12, 0.16, 2.2, seed);       // near-horizontal
      const r2 = striate(wx, wy, Math.PI / 2 - 0.05, 0.42, 1.4, seed + 9);  // fine detail
      const band = r * 0.7 + r2 * 0.3;
      idx = ditherRamp(1 - band, wx, wy, seed + 17, 1, 2); // dithered sand ↔ sandShade (smooth transition)
      if (band > 0.90) idx = 0;                   // gentle light ripple crest (body-neighbour)
      if (h2(ix, iy, seed + 71) > 0.985) idx = 3; // rare umber grain speck only
      break;
    }
    // frostSand ["bone","sandLight","skyBlue","sandShade"] — same ripple
    // structure. Body shades sandLight(1) ↔ skyBlue(2) (the frost-tinted body
    // window); gentle bone(0) crest; rare sandShade(3) grain speck.
    case "frostSand": {
      const r = striate(wx, wy, Math.PI / 2 + 0.12, 0.16, 2.2, seed);
      const r2 = striate(wx, wy, Math.PI / 2 - 0.05, 0.42, 1.4, seed + 9);
      const band = r * 0.7 + r2 * 0.3;
      idx = ditherRamp(1 - band, wx, wy, seed + 17, 1, 2); // dithered sandLight ↔ skyBlue
      if (band > 0.90) idx = 0;                   // gentle bone crest
      if (h2(ix, iy, seed + 71) > 0.985) idx = 3; // rare sandShade grain speck
      break;
    }

    // ---- FLOWING (double warp + worldFbm, no cells) ----------------------
    // lava ["atbGold","amber","hpRed","rust"] — TUNED exemplar. Two warp
    // passes swirl the coords, worldFbm gives streaming currents. Body shades
    // amber(1) ↔ hpRed(2); sparse hot atbGold(0) glints; rare rust(3) specks.
    case "lava": {
      const [x1, y1] = warp(wx, wy, 8, seed);            // primary current bend
      const [x2, y2] = warp(x1, y1, 4.5, seed + 31);     // second pass → turbulent flow
      const flow = worldFbm(x2, y2, seed + 3);           // swirling molten current field
      idx = flow > 0.5 ? 1 : 2;                           // shade within amber ↔ hpRed
      if (flow > 0.66 && h2(ix, iy, seed + 41) > 0.72) idx = 0;      // sparse hot-gold flow glint
      else if (flow < 0.36 && h2(ix, iy, seed + 91) > 0.84) idx = 3; // rare dark cooled speck
      break;
    }

    // ---- FACETS (worley per-cell tone + faint seams) ---------------------
    // ice ["white","skyBlue","slate","indigo"] — TUNED exemplar. Facets shade
    // white(0) ↔ skyBlue(1) (both cool-light body tones); faint slate(2) facet
    // bevels; rarest indigo(3) hairline crack cores only.
    case "ice": {
      const w = worley(wx, wy, 0.10, seed);
      const edge = w.f2 - w.f1;
      if (edge < 0.03) {                          // facet seam
        idx = edge < 0.01 ? 3 : 2;                // rare indigo hairline core / faint slate bevel
      } else {
        const tone = cellTone(w.cell, seed);      // subtle flat per-facet shade
        idx = tone > 0.6 ? 1 : 0;                 // skyBlue-tinted facet / white facet
      }
      break;
    }
    // frozenLake ["skyBlue","slate","indigo","ink"] — same crystalline
    // faceting. Facets shade skyBlue(0) ↔ slate(1) (the light body pair);
    // faint indigo(2) bevels; rarest ink(3) hairline crack cores only.
    case "frozenLake": {
      const w = worley(wx, wy, 0.09, seed);       // slightly larger lake-ice plates
      const edge = w.f2 - w.f1;
      if (edge < 0.03) {
        idx = edge < 0.01 ? 3 : 2;                // rare ink hairline core / faint indigo bevel
      } else {
        const tone = cellTone(w.cell, seed);
        idx = tone > 0.6 ? 1 : 0;                 // slate facet / skyBlue facet
      }
      break;
    }

    // ---- WAVE BANDS (striate horizontal + slow drift + sparse crest) -----
    // reefWater ["skyBlue","teal","tealDeep","indigo"] — TUNED exemplar. Fast
    // caustic × slow swell. Body shades teal(1) ↔ tealDeep(2); sparse bright
    // skyBlue(0) crest specks; rare indigo(3) deep specks.
    case "reefWater": {
      const fast = striate(wx, wy, Math.PI / 2, 0.24, 3.0, seed);            // primary caustic
      const slow = striate(wx, wy, Math.PI / 2 + 0.08, 0.08, 4.5, seed + 17); // slow swell
      const c = fast * 0.6 + slow * 0.4;
      idx = c > 0.5 ? 1 : 2;                       // shade within teal ↔ tealDeep
      if (fast > 0.93 && h2(ix, iy, seed + 31) > 0.72) idx = 0;      // sparse bright crest speck
      else if (c < 0.10 && h2(ix, iy, seed + 83) > 0.6) idx = 3;     // rare indigo deep speck
      break;
    }
    // groveWater ["skyBlue","teal","tealDeep","indigo"] — same wave-band
    // structure (same ramp as reefWater); distinct seed. Body teal(1) ↔
    // tealDeep(2); sparse skyBlue(0) crest; rare indigo(3) deep speck.
    case "groveWater": {
      const fast = striate(wx, wy, Math.PI / 2, 0.24, 3.0, seed);
      const slow = striate(wx, wy, Math.PI / 2 + 0.08, 0.08, 4.5, seed + 17);
      const c = fast * 0.6 + slow * 0.4;
      idx = c > 0.5 ? 1 : 2;
      if (fast > 0.93 && h2(ix, iy, seed + 31) > 0.72) idx = 0;
      else if (c < 0.10 && h2(ix, iy, seed + 83) > 0.6) idx = 3;
      break;
    }

    // ---- CLUMPS (warp + threshold patches) -------------------------------
    // groveMoss ["jade","teal","umber","ink"] — TUNED exemplar. Warp the
    // coords, threshold a low-freq field into clumps. Body shades teal(1) ↔
    // umber(2); sparse jade(0) crown highlight; rare ink(3) deep-gap speck.
    case "groveMoss": {
      const [x2, y2] = warp(wx, wy, 7, seed);
      const m = worldNoise(x2, y2, 0.07, seed + 3) * 0.7
              + worldNoise(x2, y2, 0.15, seed + 5) * 0.3; // big warped clumps
      idx = m > 0.5 ? 1 : 2;                       // shade within teal ↔ umber
      if (m > 0.84 && h2(ix, iy, seed + 23) > 0.35) idx = 0; // sparse jade crown highlight
      if (m < 0.16 && h2(ix, iy, seed + 67) > 0.5) idx = 3;  // rare ink deep-gap speck
      break;
    }
    // glowMoss ["mint","jade","teal","tealDeep"] — clumps. Body shades
    // jade(1) ↔ teal(2); the signature glow kept as a sparse-but-present
    // mint(0) crown on clump crowns; rare tealDeep(3) deep-gap speck.
    case "glowMoss": {
      const [x2, y2] = warp(wx, wy, 6, seed);
      const m = worldNoise(x2, y2, 0.08, seed + 3) * 0.7
              + worldNoise(x2, y2, 0.17, seed + 5) * 0.3;
      idx = ditherRamp(1 - m, wx, wy, seed + 17, 1, 2); // dithered jade ↔ teal (soft clump edges)
      if (m > 0.80 && h2(ix, iy, seed + 23) > 0.25) idx = 0; // sparse mint glow crown
      if (m < 0.16 && h2(ix, iy, seed + 67) > 0.5) idx = 3;  // rare tealDeep deep-gap speck
      break;
    }
    // rimeMoss ["mint","jade","teal","tealDeep"] — clumps, finer/frostier than
    // glowMoss. Body jade(1) ↔ teal(2); sparse mint(0) crown; rare tealDeep(3).
    case "rimeMoss": {
      const [x2, y2] = warp(wx, wy, 5, seed);
      const m = worldNoise(x2, y2, 0.11, seed + 3) * 0.65
              + worldNoise(x2, y2, 0.22, seed + 5) * 0.35; // finer clumps
      idx = ditherRamp(1 - m, wx, wy, seed + 17, 1, 2); // dithered jade ↔ teal (soft clump edges)
      if (m > 0.85 && h2(ix, iy, seed + 23) > 0.4) idx = 0;  // sparse mint frost crown
      if (m < 0.15 && h2(ix, iy, seed + 67) > 0.5) idx = 3;  // rare tealDeep deep-gap speck
      break;
    }
    // groveGrass ["mint","jade","teal","tealDeep"] — clumps, broader lush
    // blades. Body jade(1) ↔ teal(2); sparse mint(0) crown; rare tealDeep(3).
    case "groveGrass": {
      const [x2, y2] = warp(wx, wy, 8, seed);
      const m = worldNoise(x2, y2, 0.06, seed + 3) * 0.72
              + worldNoise(x2, y2, 0.14, seed + 5) * 0.28; // broad clumps
      idx = ditherRamp(1 - m, wx, wy, seed + 17, 1, 2); // dithered jade ↔ teal (soft clump edges)
      if (m > 0.80 && h2(ix, iy, seed + 23) > 0.4) idx = 0;  // sparse mint blade highlight
      if (m < 0.16 && h2(ix, iy, seed + 67) > 0.55) idx = 3; // rare tealDeep gap speck
      break;
    }

    // ---- GRAIN (fine clustered warped worley cells) ----------------------
    // groveSoil ["clay","umber","stoneDeep","ink"] — TUNED exemplar. Warped
    // higher-freq worley grains clustered by a low-freq field. Body shades
    // umber(1) ↔ stoneDeep(2); sparse clay(0) light-grain fleck; rare ink(3)
    // hollow fleck.
    case "groveSoil": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.40, seed);        // fine grain cells
      const cluster = worldNoise(wx, wy, 0.06, seed + 11); // where grit gathers
      const tone = cellTone(w.cell, seed);
      idx = ditherRamp(1 - tone, wx, wy, seed + 17, 1, 2); // dithered umber ↔ stoneDeep (soft grit)
      if (h2(ix, iy, seed + 29) > 0.94) idx = 0;   // sparse clay light-grain fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = 3; // rare ink hollow fleck
      break;
    }
    // ash ["bone","sandShade","stone","stoneDark"] — grain. Body shades
    // sandShade(1) ↔ stone(2); sparse bone(0) light-grain fleck; rare
    // stoneDark(3) hollow fleck.
    case "ash": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.40, seed);
      const cluster = worldNoise(wx, wy, 0.06, seed + 11);
      const tone = cellTone(w.cell, seed);
      idx = ditherRamp(1 - tone, wx, wy, seed + 17, 1, 2); // dithered sandShade ↔ stone (soft grain)
      if (h2(ix, iy, seed + 29) > 0.94) idx = 0;   // sparse bone light-ash fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = 3; // rare stoneDark fleck
      break;
    }
    // reefSilt ["tealDeep","indigo","plum","ink"] — grain. Body shades
    // indigo(1) ↔ plum(2); sparse tealDeep(0) light fleck; rare ink(3) hollow.
    case "reefSilt": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.42, seed);
      const cluster = worldNoise(wx, wy, 0.06, seed + 11);
      const tone = cellTone(w.cell, seed);
      idx = ditherRamp(1 - tone, wx, wy, seed + 17, 1, 2); // dithered indigo ↔ plum (soft silt)
      if (h2(ix, iy, seed + 29) > 0.945) idx = 0;  // sparse tealDeep light fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = 3; // rare ink hollow fleck
      break;
    }
    // asphalt ["slate","indigo","plum","ink"] — grain (fine aggregate). Body
    // shades indigo(1) ↔ plum(2); sparse slate(0) light aggregate fleck; rare
    // ink(3) pit fleck.
    case "asphalt": {
      const [x2, y2] = warp(wx, wy, 3, seed + 5);
      const w = worley(x2, y2, 0.5, seed);         // fine aggregate
      const cluster = worldNoise(wx, wy, 0.06, seed + 11);
      const tone = cellTone(w.cell, seed);
      idx = tone < 0.45 ? 2 : 1;                   // plum ↔ indigo
      if (h2(ix, iy, seed + 29) > 0.94) idx = 0;   // sparse slate aggregate fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = 3; // rare ink pit fleck
      break;
    }
    // reefFloor ["teal","tealDeep","indigo","ink"] — grain. Body shades
    // tealDeep(1) ↔ indigo(2); sparse teal(0) light fleck; rare ink(3) hollow.
    case "reefFloor": {
      const [x2, y2] = warp(wx, wy, 3.5, seed + 5);
      const w = worley(x2, y2, 0.40, seed);
      const cluster = worldNoise(wx, wy, 0.06, seed + 11);
      const tone = cellTone(w.cell, seed);
      idx = ditherRamp(1 - tone, wx, wy, seed + 17, 1, 2); // dithered tealDeep ↔ indigo (soft floor)
      if (h2(ix, iy, seed + 29) > 0.955) idx = 0;  // sparse teal light fleck
      else if (cluster < 0.35 && h2(ix, iy, seed + 37) > 0.965) idx = 3; // rare ink hollow fleck
      break;
    }

    // ---- CRACKED (ridged crack network over a subtle body) ---------------
    // emberRock ["clay","rust","stoneDeep","ink"] — a low-contrast ridged
    // crack network over a warm basalt body. Body shades rust(1) ↔ stoneDeep(2);
    // creases darken locally, rarest crack cores reach ink(3); rare warm
    // clay(0) glint.
    case "emberRock": {
      const r = ridged(wx, wy, seed);
      const body = worldFbm(wx, wy, seed + 3);
      idx = body > 0.5 ? 1 : 2;                    // rust ↔ stoneDeep
      if (r > 0.88) idx = 2;                        // crease settles to stoneDeep (dark crack)
      if (r > 0.95 && h2(ix, iy, seed + 47) > 0.5) idx = 3; // rare deep ink crack core
      if (h2(ix, iy, seed + 71) > 0.975) idx = 0;  // rare warm clay glint
      break;
    }
    // lavaCrust ["hpRed","rust","stoneDeep","ink"] — cooling crust with red
    // fissures. INVERTED register (owner-tuned G1 intent): a DARK basalt body
    // stoneDeep(2) ↔ ink(3), with the ridged crack network glowing rust(1)
    // fissures (~10%) and the rarest hottest cores flaring hpRed(0) (~2.5%).
    case "lavaCrust": {
      const r = ridged(wx, wy, seed);
      const body = worldFbm(wx, wy, seed + 3);
      idx = body > 0.5 ? 2 : 3;                     // dark crust stoneDeep ↔ ink
      if (r > 0.82) idx = 1;                         // rust fissure glow along cracks
      if (r > 0.93 && h2(ix, iy, seed + 31) > 0.6) idx = 0; // rare bright hpRed hot core
      break;
    }

    // ---- SOFT DRIFT (broad gentle warp/macro, very smooth) ---------------
    // snow ["white","bone","skyBlue","slate"] — very smooth broad drift. Body
    // shades white(0) ↔ bone(1); rare soft skyBlue(2) hollow; rarest slate(3)
    // speck. Keeps a per-pixel speck so adjacent 16px blocks never coincide.
    case "snow": {
      const [x2, y2] = warp(wx, wy, 5, seed);
      const d = worldNoise(x2, y2, 0.04, seed + 3) * 0.7
              + worldNoise(x2, y2, 0.09, seed + 5) * 0.3; // broad, smooth
      idx = ditherRamp(1 - d, wx, wy, seed + 17, 0, 1);   // dithered white ↔ bone (kills choppy bands)
      if (d < 0.24 && h2(ix, iy, seed + 41) > 0.6) idx = 2; // rare soft skyBlue hollow
      if (h2(ix, iy, seed + 83) > 0.985) idx = 3;  // rarest slate speck
      break;
    }

    default: {
      const _never: never = key;
      throw new Error(`unknown terrain ${_never as string}`);
    }
  }
  return ramp[clampIdx(idx, ramp.length)];
}

export function fillField(key: TerrainKey, ox: number, oy: number, w: number, h: number): PixelGrid {
  const g = new PixelGrid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.px(x, y, fill(key, ox + x, oy + y));
  return g;
}
