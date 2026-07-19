/**
 * Ramp tiles — a walkable floored slot cut through the cliff.
 * docs/superpowers/specs/2026-07-18-desert-cliff-ramps-design.md ("The model"):
 * a ramp is mechanically an opening through the cliff wall (like the
 * inner-corner cliff variants already frame), but floored with slope-shaded
 * terrain instead of flat ground, so it reads as walking down/up the height.
 * Its side walls reuse the `rock` cliff material (`wallFace`, materials.ts —
 * a retaining cut); its walkable center is a terrain fill (terrains.ts),
 * shaded per row to imply incline.
 *
 * `rampTiles(p)` returns 16 tiles: 4 `RampCol` (`narrow`/`leftEdge`/`middle`/
 * `rightEdge`) x 4 `RampRow` (`top`/`run`/`landing`/`bottom`). Runtime
 * placement (phase 2) picks the column from the ramp cell's left/right
 * neighbours and the row from where the cell sits in the run; one set
 * serves both a 1-wide stair (`narrow`) and a wide grand ramp
 * (`leftEdge` + `middle`x N + `rightEdge`).
 *
 * Task 1 implemented `material === "sandSlope"`; Task 2 adds
 * `material === "stoneSteps"` (see "stoneSteps surface" below) — both
 * share the same wall-strip/column/mirror composition below unchanged.
 *
 * ## Wall strip
 *
 * `WALL_W = 4`px. `wallStrip()` builds a full 16x16 `wallFace("rock", …)`
 * tile (the same cool-navy stone the cliff face uses, so a ramp cut reads as
 * part of the same cliff) and slices its leftmost `WALL_W` columns as the
 * retaining-wall strip. `buildColumn` stamps that strip onto a column's
 * left/right edge(s) by `blit`; `rightEdge` is never composed
 * independently — it's `leftEdge`'s whole-tile `mirrorX()` (both-directions
 * design goal, "The model" doc, "Both directions + switchbacks"). `narrow`
 * stamps the same strip on the left and its `mirrorX()` on the right, so a
 * 1-wide stair reads as flanked by matching stone on both sides.
 *
 * ## sandSlope surface (per row)
 *
 * The incline read is carried by the *rows*, not a gradient inside a
 * repeating tile (a single repeated `run` tile can't hold a continuous
 * gradient without banding — design doc, "The two materials"):
 *   - `top`    — top ~4px lit crest (`ramp[0]`), rest uniform mid sand.
 *   - `run`    — uniform mid sand (`ramp[1]`) with sparse `h2`-scattered
 *     flecks, the *exact* recipe `terrains.ts`' `floorFill` uses for sand:
 *     `h2(x,y,seed+31)>0.95` -> `ramp[0]` (light fleck, ~5%),
 *     `h2(x,y,seed+53)>0.96` -> `ramp[2]` (dark speck, ~4%).
 *   - `landing` — flat platform: uniform mid sand, a 1px lit line at the
 *     very top edge and a 1px shadow line just below it (reads as a small
 *     step up onto a flat platform), no incline shading.
 *   - `bottom` — bottom ~5px shaded down toward `ramp[2]`/`ramp[3]`
 *     (in-shadow at the foot of the slope).
 *
 * ## stoneSteps surface (per row)
 *
 * Unlike sandSlope's incline, this material carves discrete horizontal
 * steps into the `ROCK` stone ramp (cool navy stone, same ramp
 * `cliffFace.ts`/`materials.ts` use). See `stepHeight`/`stepBandPixel`/
 * `stoneStepsPixel` below for the exact recipe and tiling proof.
 */
import { PixelGrid } from "../grid";
import { h2 } from "./noise";
import { ROCK, TERRAIN_RAMPS, shade, type TerrainKey, type Ramp } from "./palette";
import { wallFace, type WallParams, type MaterialKey } from "./materials";
import type { PaletteName } from "../../../../src/shared/palette";

const T = 16;
const WALL_W = 4;

export type RampMaterial = "sandSlope" | "stoneSteps";
export type RampCol = "narrow" | "leftEdge" | "middle" | "rightEdge";
export type RampRow = "top" | "run" | "landing" | "bottom";

export interface RampParams {
  material: RampMaterial;
  terrain: TerrainKey;
  wall: MaterialKey;
  height: number;
  slope: number;
  steps: number;
  seed: number;
}

const COLS: readonly RampCol[] = ["narrow", "leftEdge", "middle", "rightEdge"];
const ROWS: readonly RampRow[] = ["top", "run", "landing", "bottom"];

/** Wall tuning for a ramp's retaining-cut side walls — mirrors the desert
 *  preset's rock wall params (presets.ts `DESERT_ROCK_CLIFF`) so the cut
 *  reads as the same stone as the cliff it's set into. (Exported for the
 *  diagonal flights, whose projected foot uses the same rock as its body.) */
export const RAMP_WALL_PARAMS: WallParams = {
  courses: 3, blockSize: 3, blocksPerCourse: 3, stagger: 0.5,
  tone: 0.16, mortar: 0.28, orderVsRandom: 0.45,
};

/** WALL_W-wide vertical slice (leftmost columns) of a `wallFace` tile — the
 *  retaining-wall strip stamped onto a ramp column's edge(s). */
function wallStrip(wall: MaterialKey, seed: number): PixelGrid {
  const face = wallFace(wall, RAMP_WALL_PARAMS, seed);
  const strip = new PixelGrid(WALL_W, T);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < WALL_W; x++) strip.px(x, y, face.get(x, y));
  }
  return strip;
}

/** sandSlope surface colour at (x, y) for a given row (see file header). */
function sandSlopePixel(row: RampRow, x: number, y: number, p: RampParams, ramp: Ramp): PaletteName {
  const light = ramp[0], mid = ramp[1], shadeC = ramp[2], dark = ramp[3];
  switch (row) {
    case "top":
      return y < 4 ? light : mid;
    case "run":
      if (h2(x, y, p.seed + 31) > 0.95) return light; // sparse light fleck (~5%)
      if (h2(x, y, p.seed + 53) > 0.96) return shadeC; // sparser dark speck (~4%)
      return mid;
    case "landing":
      return y === 0 ? light : y === 1 ? shadeC : mid;
    case "bottom":
      return y >= T - 2 ? dark : y >= T - 5 ? shadeC : mid;
  }
}

function sandSlopeSurface(row: RampRow, p: RampParams): PixelGrid {
  const grid = new PixelGrid(T, T);
  const ramp = TERRAIN_RAMPS[p.terrain];
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) grid.px(x, y, sandSlopePixel(row, x, y, p, ramp));
  }
  return grid;
}

/**
 * Step height (px) for `steps` — a divisor of `T` (16) nearest to
 * `T / max(2, steps)`. Snapping to a divisor (rather than using the
 * requested count directly) is what makes stacked `run` tiles form a
 * continuous flight: since `stepH` divides 16 exactly, `y % stepH` at the
 * top of the next tile (global y = 16, 17, …) reduces to the same phase
 * sequence as this tile's `y = 0, 1, …` — no seam, no discontinuity, for
 * any number of stacked tiles. A non-divisor height would drift out of
 * phase tile-to-tile and show a visible seam.
 */
function stepHeight(steps: number): number {
  const target = Math.max(2, steps);
  const ideal = T / target;
  const divisors = [1, 2, 4, 8, 16];
  return divisors.reduce((best, d) => (Math.abs(d - ideal) < Math.abs(best - ideal) ? d : best));
}

/** One step band's colour at in-tile-row `y` (see file header for the
 *  tread/body/riser recipe). Colour depends only on `y` — steps are
 *  horizontal bands, uniform across `x` — so callers fill a whole row at
 *  a time. */
function stepBandPixel(y: number, stepH: number): PaletteName {
  const lit = shade(ROCK, 1, -1); // stoneLit — lit tread (top 1px of a step)
  const body = ROCK[3]; // stoneDark — step body
  const riser = shade(ROCK, 6, 1); // deepest — 1px riser shadow (bottom of a step)
  const phase = y % stepH;
  if (phase === 0) return lit;
  if (phase === stepH - 1) return riser;
  return body;
}

/** stoneSteps surface colour at in-tile row `y` for a given row (see file
 *  header). Carved horizontal steps in the cool navy `ROCK` stone ramp:
 *    - `top`     — a flush lit tread meeting the plateau (a full `stepH`-1
 *      px lit band + riser), then the ordinary step cycle continues below.
 *    - `run`     — the repeating step cycle (`stepBandPixel`), phased from
 *      the in-tile `y` alone so stacked `run` tiles tile seamlessly.
 *    - `landing` — a flat wide tread/platform: uniform stone body, a 1px
 *      lit line at the top edge and a 1px shadow line below it, no risers
 *      (mirrors sandSlope's landing, in stone).
 *    - `bottom`  — the ordinary step cycle down to a flush final tread
 *      (lit line + solid dark body) meeting the ground.
 */
function stoneStepsPixel(row: RampRow, y: number, p: RampParams): PaletteName {
  const stepH = stepHeight(p.steps);
  const lit = shade(ROCK, 1, -1);
  const body = ROCK[3];
  const riser = shade(ROCK, 6, 1);
  switch (row) {
    case "top":
      if (y < stepH - 1) return lit;
      if (y === stepH - 1) return riser;
      return stepBandPixel(y, stepH);
    case "run":
      return stepBandPixel(y, stepH);
    case "landing":
      return y === 0 ? lit : y === 1 ? riser : body;
    case "bottom": {
      const groundStart = T - stepH;
      if (y < groundStart) return stepBandPixel(y, stepH);
      return y === groundStart ? lit : body;
    }
  }
}

function stoneStepsSurface(row: RampRow, p: RampParams): PixelGrid {
  const grid = new PixelGrid(T, T);
  for (let y = 0; y < T; y++) {
    const c = stoneStepsPixel(row, y, p);
    for (let x = 0; x < T; x++) grid.px(x, y, c);
  }
  return grid;
}

/** The walkable surface for `row`, before any wall strips are stamped. */
function rampSurface(row: RampRow, p: RampParams): PixelGrid {
  switch (p.material) {
    case "sandSlope":
      return sandSlopeSurface(row, p);
    case "stoneSteps":
      return stoneStepsSurface(row, p);
  }
}

/** Compose one (col, row) tile: surface, then side wall strip(s) stamped
 *  per column. `rightEdge` is always `leftEdge`'s mirrorX(), never composed
 *  independently, so both-directions symmetry is structural. */
function buildColumn(col: RampCol, row: RampRow, p: RampParams): PixelGrid {
  switch (col) {
    case "middle":
      return rampSurface(row, p);
    case "leftEdge": {
      const tile = rampSurface(row, p);
      tile.blit(wallStrip(p.wall, p.seed), 0, 0);
      return tile;
    }
    case "rightEdge":
      return buildColumn("leftEdge", row, p).mirrorX();
    case "narrow": {
      const tile = rampSurface(row, p);
      const strip = wallStrip(p.wall, p.seed);
      tile.blit(strip, 0, 0);
      tile.blit(strip.mirrorX(), T - WALL_W, 0);
      return tile;
    }
  }
}

/** All 16 ramp tiles (4 cols x 4 rows) for `p`. Fully opaque, palette-locked,
 *  deterministic — see file header for the rendering recipe. */
export function rampTiles(p: RampParams): { col: RampCol; row: RampRow; grid: PixelGrid }[] {
  const out: { col: RampCol; row: RampRow; grid: PixelGrid }[] = [];
  for (const col of COLS) {
    for (const row of ROWS) {
      out.push({ col, row, grid: buildColumn(col, row, p) });
    }
  }
  return out;
}
