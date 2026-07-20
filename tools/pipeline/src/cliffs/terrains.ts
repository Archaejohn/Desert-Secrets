/**
 * Palette-locked terrain floor fills, ported from `floorTile`
 * (docs/prototypes/cliff-suite-v6.html:256-278).
 *
 * ## The 5-role -> 4-step ramp mapping
 *
 * The prototype indexes into a 5-colour `cols` array per terrain (`P[]`),
 * with fixed roles: `P[0]`=base, `P[1]`=darker, `P[2]`=lighter,
 * `P[3]`=darkest (extreme), `P[4]`=lightest (extreme). Our `TERRAIN_RAMPS`
 * are 4-entry light->dark ramps (`ramp[0]`=lightest ... `ramp[3]`=darkest),
 * so each branch below re-derives its own `P[]` -> `ramp[]` mapping from
 * the roles it actually touches:
 *
 * - **sand / frostSand** (the `fbm` + sine speckle branch) only ever
 *   selects `P[1]`, `P[0]`, `P[2]`, `P[4]` — never `P[3]`, the darkest
 *   extreme. That's exactly 4 roles for 4 slots, so they map 1:1 by
 *   brightness: `P[4]`(lightest)->`ramp[0]`, `P[2]`->`ramp[1]`,
 *   `P[0]`->`ramp[2]`, `P[1]`(darkest of the four)->`ramp[3]`.
 * - **asphalt** (the prototype's generic/default branch) selects all 5
 *   roles. Per the brief, the two extremes collapse onto the ramp ends:
 *   `P[4]`->`ramp[0]`, `P[3]`->`ramp[3]`. The remaining middle roles
 *   `P[2]`, `P[0]`, `P[1]` must share the 2 leftover slots: `P[2]`
 *   (lighter) keeps `ramp[1]`, and the adjacent `P[0]`/`P[1]`
 *   (base/darker) collapse together onto `ramp[2]` — which also suits
 *   asphalt's "dark, low-variation" brief (only 3 distinct bands show up
 *   instead of 4, and the darkest band is the rarest).
 *
 * No `Math.random` — `fbm`/`h2` are the sole source of variation, so
 * output is deterministic for a given (key, seed).
 */
import { PixelGrid } from "../grid";
import { fbm, h2 } from "./noise";
import { TERRAIN_RAMPS, type TerrainKey } from "./palette";
import type { PaletteName } from "../../../../src/shared/palette";

const T = 16;

/** A fully opaque, palette-locked 16x16 floor fill for `key`. */
export function floorFill(key: TerrainKey, seed: number): PixelGrid {
  const grid = new PixelGrid(T, T);
  const ramp = TERRAIN_RAMPS[key];

  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let v = fbm(x, y, seed + key.length * 13);
      let idx: number;

      if (key === "sand" || key === "frostSand") {
        // Base terrain everywhere, with sparse hash-SCATTERED single-pixel
        // specks. Random placement via `h2` (no fbm/sine banding — that striped
        // the light flecks onto one side of the tile) and subtle (fleck/speck
        // sit one ramp step off the base). Two independent hashes vary by seed.
        idx = 1;
        if (h2(x, y, seed + 31) > 0.95) idx = 0; // sparse light fleck (~5%)
        else if (h2(x, y, seed + 53) > 0.96) idx = 2; // sparser dark speck (~4%)
      } else if (key === "ice") {
        // Glinting frost speckle: skyBlue body with sparse white glints and
        // sparser slate hairline cracks (own recipe — NOT the asphalt fill).
        idx = 1;                                      // skyBlue body
        if (h2(x, y, seed + 31) > 0.94) idx = 0;      // white glint
        else if (h2(x, y, seed + 53) > 0.95) idx = 2; // slate hairline crack
      } else {
        // asphalt — prototype's generic branch, collapsed per the mapping above.
        // Prototype: col=P[v<0.36?1:v<0.58?0:v<0.82?2:3]; if h2(...)>0.93 col=P[4]
        idx = v < 0.58 ? 2 : v < 0.82 ? 1 : 3;
        if (h2(x, y, seed + 77) > 0.93) idx = 0;
      }

      grid.px(x, y, ramp[idx]);
    }
  }

  return grid;
}

/**
 * Position of `name` within `key`'s ramp (or -1 if it isn't a member).
 * Lets later builders (e.g. the blob outline/shadow pass) look up a fill
 * pixel's ramp index and `shade()` it darker/lighter without hardcoding
 * ramp contents.
 */
export function nameToRampIndex(key: TerrainKey, name: PaletteName): number {
  return TERRAIN_RAMPS[key].indexOf(name);
}
