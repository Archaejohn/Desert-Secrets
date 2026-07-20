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

  // Task 8 — precomputed frosted-facet field for the `ice` branch below: a
  // coarse toroidal Voronoi (5 sites, distances wrapped mod 16 so the fill
  // stays seamless) whose boundary-closeness map (d2 - d1) the per-pixel loop
  // reads to place hairline cracks between large calm facets. Deterministic
  // (`h2` only); untouched for every other terrain.
  let iceEdge: Float64Array | null = null;
  if (key === "ice") {
    const N = 5;
    const sx: number[] = [], sy: number[] = [];
    for (let k = 0; k < N; k++) {
      sx.push(h2(k, 111, seed) * T);
      sy.push(h2(k, 123, seed) * T);
    }
    const wrapD = (d: number): number => {
      const m = ((d % T) + T) % T;
      return m > T / 2 ? m - T : m;
    };
    iceEdge = new Float64Array(T * T);
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        let d1 = Infinity, d2 = Infinity;
        for (let k = 0; k < N; k++) {
          const dx = wrapD(x + 0.5 - sx[k]);
          const dy = wrapD(y + 0.5 - sy[k]);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; }
          else if (d < d2) d2 = d;
        }
        iceEdge[y * T + x] = d2 - d1;
      }
    }
  }

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
      } else if (key === "reefFloor") {
        // R3a — dark teal seabed (matches shipped tileset7 reefFloor/reefBase):
        // calm tealDeep body (ramp[1]), very sparse indigo speckle (ramp[2]),
        // and a rare tiny lighter glow bead (ramp[0], teal). Kept the darkest
        // and lowest-contrast of the four reef grounds so it reads as the
        // "background" floor the other three sit against.
        idx = 1;
        if (h2(x, y, seed + 53) > 0.97) idx = 2; // very sparse indigo speckle (~3%)
        else if (h2(x, y, seed + 31) > 0.985) idx = 0; // rare tiny glow bead (~1.5%)
      } else if (key === "reefSilt") {
        // R3a — dark indigo silt (matches shipped reefSilt): indigo body
        // (ramp[1]), sparse ink flecks (ramp[3]) reading as hollows/grit, and
        // a rarer tealDeep glint (ramp[0]).
        idx = 1;
        if (h2(x, y, seed + 53) > 0.94) idx = 3; // sparse ink flecks (~6%)
        else if (h2(x, y, seed + 31) > 0.98) idx = 0; // rare glint (~2%)
      } else if (key === "reefWater") {
        // R3a — reef water (matches shipped reefWater): fbm-mottled teal/
        // tealDeep body (ramp[1]/ramp[2]) with sparse skyBlue ripple pixels
        // (ramp[0]).
        idx = v < 0.5 ? 1 : 2;
        if (h2(x, y, seed + 31) > 0.92) idx = 0; // sparse skyBlue ripple (~8%)
      } else if (key === "glowMoss") {
        // R3a — glowing moss (matches shipped glowMoss): fbm-mottled teal/
        // jade body (ramp[2]/ramp[1]) with sparse mint highlights (ramp[0]) —
        // the brightest of the four reef grounds.
        idx = v < 0.5 ? 2 : 1;
        if (h2(x, y, seed + 31) > 0.88) idx = 0; // sparse mint highlight (~12%)
      } else if (key === "ice") {
        // Frosted floor (Task 8c retune): a bright WHITE crystalline body
        // (idx 0, swapped from the previous skyBlue-dominant pass — owner
        // wants this to read as white ice, not blue) with a scattering of
        // single-pixel skyBlue accents (hash-placed via `h2`, same style as
        // the sand branch's flecks above — coherent `fbm`/`noise()`
        // thresholding was tried and rejected in the prior pass: `fbm`'s
        // dominant cells=2 octave banded into hard stripes when
        // thresholded directly, and a smoother single-octave `noise()`
        // lattice produced a bold repeating blob/snowflake motif — both
        // read as MORE graphic/patterned than plain scattered speckle, the
        // opposite of "smooth"). Slate stays a rare dusting only on the
        // tightest Voronoi seams (the toroidal boundary field precomputed
        // above), giving a faint, calm hairline — and, since the plateau
        // top reuses this same fill and the blob outline pass only darkens
        // a boundary pixel by one ramp step (white -> skyBlue), that
        // hairline chance also helps the cap edge read against an
        // all-white body instead of relying solely on the one-step
        // outline shade. Indigo is dropped entirely — it was the dark
        // element driving the original "too dark and noisy" read.
        const e = iceEdge![y * T + x];
        idx = 0; // white body
        if (h2(x, y, seed + 31) > 0.88) idx = 1; // scattered skyBlue accent (~12%)
        else if (e < 0.1 && h2(x, y, seed + 61) > 0.85) idx = 2; // rare, faint hairline seam (~1-2%)
      } else if (key === "snow") {
        // Packed snowdrift — warm pale body (bone, ramp[1]), brighter than the
        // white ice, with sparse white highlights (ramp[0]) and a rare cool
        // skyBlue shadow speck (ramp[2]). Low fleck density reads as smooth drift.
        idx = 1;
        if (h2(x, y, seed + 31) > 0.90) idx = 0; // sparse white highlight (~10%)
        else if (h2(x, y, seed + 53) > 0.97) idx = 2; // rare skyBlue shadow (~3%)
      } else if (key === "frozenLake") {
        // Cracked lake ice — fbm-mottled slate/skyBlue surface sheen
        // (ramp[1]/ramp[0]), bluer and darker than the white ice it sits below,
        // with sparse indigo crack flecks (ramp[2]) and rare deep ink cracks (ramp[3]).
        idx = v < 0.5 ? 1 : 0;
        if (h2(x, y, seed + 53) > 0.93) idx = 2; // sparse indigo crack (~7%)
        else if (h2(x, y, seed + 61) > 0.985) idx = 3; // rare deep ink crack (~1.5%)
      } else if (key === "rimeMoss") {
        // Frozen glow-moss — fbm-mottled teal/jade body (ramp[2]/ramp[1]) with
        // generous mint glow highlights (ramp[0]); the brightest frozen ground
        // (mirrors reef glowMoss / tileset3 mossGlow).
        idx = v < 0.5 ? 2 : 1;
        if (h2(x, y, seed + 31) > 0.85) idx = 0; // generous mint glow (~15%)
      } else if (key === "emberRock") {
        // Dark basalt floor (ramp[2]/ramp[3]) with sparse warm ember-glow flecks
        // (ramp[0]) — the low-contrast background the other three sit against.
        idx = v < 0.5 ? 2 : 3;
        if (h2(x, y, seed + 31) > 0.94) idx = 0; // sparse ember glow (~6%)
        else if (h2(x, y, seed + 53) > 0.97) idx = 1; // rare warm rust speck (~3%)
      } else if (key === "ash") {
        // Pale grey ash drift — bone/sandShade body (ramp[0]/ramp[1]), smooth,
        // low fleck density, with a rare darker cinder speck (ramp[3]).
        idx = v < 0.5 ? 0 : 1;
        if (h2(x, y, seed + 53) > 0.96) idx = 3; // rare cinder speck (~4%)
      } else if (key === "lava") {
        // Molten flow — fbm-mottled amber/hpRed body (ramp[1]/ramp[2]) with
        // generous bright gold glow (ramp[0]); the most saturated ground.
        idx = v < 0.5 ? 1 : 2;
        if (h2(x, y, seed + 31) > 0.82) idx = 0; // generous gold glow (~18%)
      } else if (key === "lavaCrust") {
        // Cooling crust — dark body (ramp[2]/ramp[3]) with sparse red fissure
        // flecks (ramp[0], glowing) reading as cracks in the black crust.
        idx = v < 0.5 ? 2 : 3;
        if (h2(x, y, seed + 31) > 0.90) idx = 0; // sparse red fissure (~10%)
        else if (h2(x, y, seed + 53) > 0.96) idx = 1; // rarer rust ember (~4%)
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
