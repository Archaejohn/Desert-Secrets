/**
 * Directional cliff set (15 tiles), ported from `buildCliffTile`
 * (docs/prototypes/cliff-suite-v6.html:361-418) and `wallTop` (`:284`).
 *
 * `cliffTiles(p)` returns **15** grids in a fixed order: the outer loop runs
 * `variant` in `[0,1,2,3,4]` = `[outerW, mid, outerE, innerW, innerE]`, the
 * inner loop runs `band` in `[0,1,2]` = `[rim/cap, face, footer]`, so
 * `index === variant*3 + band`, matching the prototype's variant x band
 * numbering.
 *
 * ## Palette (ramp-index) adaptation — the crux of this port
 *
 * The prototype samples raw RGB from three source ImageData tiles
 * (`A.top`/`A.face`/`A.gnd`) and shades them with `scale(color, k)` (an RGB
 * brightness multiply), `mixc(a, b, t)` (RGB lerp), etc. We cannot store RGB,
 * so every pixel is carried as a `(ramp, index)` pair and every shade op is a
 * ramp-index shift (see the plan's "Quantization Strategy"):
 *
 *   `scale(base, k)`  ->  `index += round((1 - k) * SHADE_SENSITIVITY)`
 *
 * captured in the `sc(k)` helper below. `k < 1` (darken) yields a positive
 * shift toward the dark end of the ramp; `k > 1` (lighten) yields a negative
 * shift. Concretely, matching the brief's per-op forms:
 *
 *   - cap roll-off `scale(base, 1 - d*roll)`      -> `+round(d*roll*SENS)`
 *   - lit lip `scale(base, 1.22)`                 -> `sc(1.22) === -1`
 *   - footer contact `scale(face, 0.45)`          -> `+round(0.55*SENS) == +2`
 *   - cast shadow `scale(gnd, 1-ss*(1-d)^2)`       -> `+round(ss*(1-d)^2*SENS)`
 *   - corner `cshade`/`ishade` face-edge shifts   -> `sc(1 -/+ ...)`
 *
 * ### Resolving the source ramp per tile
 *
 * The three source tiles sit on different ramps, so each pixel's ramp is
 * chosen by which tile the prototype sampled:
 *   - `A.face` is always a rock wall (phase 1) -> the `ROCK` ramp; its index
 *     is `ROCK.indexOf(name)`.
 *   - `A.top` (plateau) / `A.gnd` (ground) are terrain fills -> their
 *     `TERRAIN_RAMPS[key]` ramp; the index is `nameToRampIndex(key, name)`.
 * `CliffParams.topKey`/`gndKey` name those two terrains (default `"sand"`,
 * which is what the plateau top and ground use in the desert preset).
 *
 * ### `wallTop()` and the cap material
 *
 * `wallTop()` (`:284`) is `ROCK.top` in rock mode -> `ROCK` ramp index 1
 * (`WALL_TOP_IDX`). The cap material:
 *   - `"plateau"` -> `base` is the plateau pixel (terrain ramp).
 *   - `"wall"`    -> `base` is the ROCK top step (`WALL_TOP_IDX`).
 *   - `"blend"`   -> `mixc(plate, wallTop, 0.5)` becomes
 *     `round(mix(idxPlate, WALL_TOP_IDX, 0.5))` emitted on the ROCK ramp.
 *     (Since the cool `ROCK` and warm `sand` ramps no longer overlap, this
 *     path would hue-shift toward the stone ramp; the desert preset uses
 *     `capMaterial: "plateau"`, so it isn't exercised.)
 *
 * ## Geometry kept exactly
 *
 * The `tround` (rim quarter-circle corner-lift, `:375-386`) and `bround`
 * (footer quarter-circle, `:399-400`) math is pure geometry, not colour, and
 * is ported pixel-for-pixel. `tround === 0` yields hard corners (the rim of a
 * rounded vs hard tile therefore differs — asserted by the test). The scree
 * speckle uses the prototype's global seed (1337) so output is deterministic.
 *
 * `SHADE_SENSITIVITY` is the single tuning knob flagged for Task 9's visual
 * review — raise it to make the wall read as a stronger lit-top/dark-left
 * vertical face, lower it to flatten the shading.
 */
import { PixelGrid } from "../grid";
import { clamp, h2, mix } from "./noise";
import { ROCK, shade, TERRAIN_RAMPS, type Ramp, type TerrainKey } from "./palette";
import { nameToRampIndex } from "./terrains";
import type { PaletteName } from "../../../../src/shared/palette";

const T = 16;

/**
 * The one tuning knob (brief/Task 9): how many ramp steps a prototype
 * `scale(color, k)` maps to. `deltaSteps = round((1 - k) * SHADE_SENSITIVITY)`.
 */
const SHADE_SENSITIVITY = 3;

/** `wallTop()` in rock mode is `ROCK.top` — ramp index 1. */
const WALL_TOP_IDX = 1;

/** The prototype's module-level `seed` (used only by the scree speckle). */
const SCREE_SEED = 1337;

/** `scale(color, k)` factor -> ramp-index delta (see file header). */
const sc = (k: number): number => Math.round((1 - k) * SHADE_SENSITIVITY);

export interface CliffParams {
  /** Rock wall-face texture (always ROCK-ramp in phase 1). */
  face: PixelGrid;
  /** Ramp `face`'s pixels live on (default `ROCK`). Task 8: the bespoke
   *  `glacier` face is authored on the `ICE` ramp — without this, the
   *  `ROCK.indexOf` round-trip below maps every ice name to -1 -> clamps to
   *  `stoneLit`, which is exactly why the placeholder ice wall read as flat
   *  gray. Omitted for `rock`, so desert output is byte-identical. */
  faceRamp?: Ramp;
  /** Plateau top terrain fill. */
  top: PixelGrid;
  /** Ground terrain fill (below the footer). */
  gnd: PixelGrid;
  /** Terrain key backing `top` (default `"sand"`). */
  topKey?: TerrainKey;
  /** Terrain key backing `gnd` (default `"sand"`). */
  gndKey?: TerrainKey;
  cap: number;
  foot: number;
  /** Consumed by scene ASSEMBLY (how many face rows to stack), not by tile
   *  rendering — `buildCliffTile` never reads it (the face is one repeatable
   *  tile). Kept here as a forward-looking hint for eventual placement. */
  cliffHeight: number;
  baseRounding: number;
  topRounding: number;
  outerShade: number;
  innerDepth: number;
  castShadow: number;
  scree: boolean;
  litLip: boolean;
  capMaterial: "plateau" | "wall" | "blend";
  capRoll: number;
}

/**
 * Build one cliff tile for `(variant, band)`. Ported one-to-one from
 * `buildCliffTile` (`:361-418`); the only change is that each pixel is carried
 * as a `(ramp, idx)` pair and shaded in ramp-index space (see file header).
 */
function buildCliffTile(variant: number, band: number, p: CliffParams): PixelGrid {
  const grid = new PixelGrid(T, T);
  const topKey: TerrainKey = p.topKey ?? "sand";
  const gndKey: TerrainKey = p.gndKey ?? "sand";
  const topRamp = TERRAIN_RAMPS[topKey];
  const gndRamp = TERRAIN_RAMPS[gndKey];

  // Prototype: cs=cshade/100, is=ishade/100, ss=shadow/100, roll=caproll/100.
  // Our CliffParams already carry these as 0..1 fractions.
  const cs = p.outerShade, is = p.innerDepth, ss = p.castShadow, roll = p.capRoll;
  const { cap, foot, capMaterial: capMat, litLip: lip, scree } = p;
  const bround = p.baseRounding, tround = p.topRounding;
  const capStart = T - cap - 4;

  const faceRamp = p.faceRamp ?? ROCK;
  const faceIdx = (x: number, y: number): number =>
    faceRamp.indexOf(p.face.get(x, y) as PaletteName);
  const topIdx = (x: number, y: number): number =>
    nameToRampIndex(topKey, p.top.get(x, y) as PaletteName);
  const gndIdx = (x: number, y: number): number =>
    nameToRampIndex(gndKey, p.gnd.get(x, y) as PaletteName);

  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let ramp: Ramp = ROCK;
      let idx = 0;
      let region = "face";

      if (band === 0) {
        // Rim/cap. The rim line curves through the turn (same radius as the
        // base): convex (outer) corners cut back, concave (inner) fillet.
        let capS = capStart;
        if (tround > 0) {
          const R = tround;
          let dx = 99, sign = 0;
          if (variant === 0) { dx = x; sign = -1; }
          else if (variant === 2) { dx = T - 1 - x; sign = -1; }
          else if (variant === 3) { dx = x; sign = 1; }
          else if (variant === 4) { dx = T - 1 - x; sign = 1; }
          if (dx < R) {
            const lift = R - Math.sqrt(Math.max(0, R * R - (R - dx) * (R - dx)));
            capS = capStart + sign * lift;
          }
        }
        capS = clamp(Math.round(capS), 0, T - cap - 1);

        if (y < capS) {
          ramp = topRamp; idx = topIdx(x, y); region = "plateau";
        } else if (y < capS + cap) {
          const d = (y - capS) / cap;
          // base = plateau | wall-top | 50/50 blend
          let baseRamp: Ramp, baseIdx: number;
          if (capMat === "wall") {
            baseRamp = ROCK; baseIdx = WALL_TOP_IDX;
          } else if (capMat === "blend") {
            baseRamp = ROCK; baseIdx = Math.round(mix(topIdx(x, y), WALL_TOP_IDX, 0.5));
          } else {
            baseRamp = topRamp; baseIdx = topIdx(x, y);
          }
          ramp = baseRamp;
          idx = baseIdx + sc(1 - d * roll);            // cap roll-off
          if (lip && y === capS) idx = baseIdx + sc(1.22); // lit lip (overrides)
          region = "cap";
        } else {
          ramp = faceRamp; idx = faceIdx(x, y); region = "face";
        }
      } else if (band === 1) {
        ramp = faceRamp; idx = faceIdx(x, y); region = "face";
      } else {
        // Footer.
        let lift = 0;
        if (bround > 0) {
          const R = bround, dx = variant === 0 ? x : variant === 2 ? T - 1 - x : 99;
          if (dx < R) lift = R - Math.sqrt(Math.max(0, R * R - (R - dx) * (R - dx)));
        }
        const faceEnd = T - foot - lift;
        if (y < faceEnd - 1) {
          ramp = faceRamp; idx = faceIdx(x, y); region = "face";
        } else if (y < faceEnd) {
          ramp = faceRamp; idx = faceIdx(x, y) + sc(0.45); region = "contact"; // contact shadow
        } else {
          ramp = gndRamp; idx = gndIdx(x, y);
          const d = (y - faceEnd) / foot;
          const g = Math.max(0, 1 - d);
          idx += sc(1 - ss * g * g);                   // cast shadow
          if (scree && d < 0.6 && h2(x, y, SCREE_SEED + 31) > 0.80) {
            // Scree pebbles take the cliff's own face ramp (default ROCK),
            // not a hardcoded ROCK — so a biome cliff's scree reads in that
            // biome's colour instead of always gray. Desert (faceRamp
            // defaults to ROCK) stays byte-identical.
            ramp = faceRamp; idx = WALL_TOP_IDX + sc(0.7); // scree pebble = scale(wallTop,0.7)
          }
          region = "ground";
        }
      }

      // Per-variant corner face-edge shading (only on exposed rock face).
      if (region === "face") {
        if (variant === 0) {
          if (x < 3) idx += sc(1 - cs * (1 - x / 3) * 0.9);
          else if (x === 3) idx += sc(1 - cs * 0.35);
        } else if (variant === 2) {
          if (x > T - 4) idx += sc(1 + cs * 0.5 * ((x - (T - 4)) / 3));
          else if (x === T - 4) idx += sc(1 - cs * 0.3);
        } else if (variant === 3) {
          if (x < 6) idx += sc(1 - is * 1.15 * (1 - x / 6));
        } else if (variant === 4) {
          const dx = T - 1 - x;
          if (dx < 6) idx += sc(1 - is * 1.15 * (1 - dx / 6));
        }
      }

      grid.px(x, y, shade(ramp, idx));
    }
  }

  return grid;
}

/**
 * All 15 cliff tiles in fixed order: `variant` in [0..4] (outerW, mid, outerE,
 * innerW, innerE) x `band` in [0..2] (rim/cap, face, footer), so
 * `result[variant*3 + band]`.
 */
export function cliffTiles(p: CliffParams): PixelGrid[] {
  const out: PixelGrid[] = [];
  for (let variant = 0; variant < 5; variant++) {
    for (let band = 0; band < 3; band++) {
      out.push(buildCliffTile(variant, band, p));
    }
  }
  return out;
}
