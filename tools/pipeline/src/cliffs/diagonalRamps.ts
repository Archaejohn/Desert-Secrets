/**
 * Diagonal ramps/stairs (phase 1c) — FF6-style isometric runs at clean
 * pixel-slope angles, both materials, both directions. See the design spec
 * and the owner-approved locked recipe.
 *
 * ## Model (locked)
 *
 * Each run is an isometric wedge seen as two faces: a horizontal TOP (the
 * walking surface) over a vertical FRONT (rock). We define one *global band
 * sampler* `cell(gx, gy)` for the infinite run and slice 16×16 tiles from it.
 * The band has translational symmetry by **(2 tiles right, 1 tile up)** for
 * 26.57° — `cell(gx+32, gy-16) === cell(gx, gy)` — so tiles placed on that
 * lattice are seamless *by construction* (proven visually before coding).
 *
 * - **stoneSteps** — discrete stone treads (stoneLit walking surface, shaded
 *   back lip) stepping up-right over a continuous `wallFace("rock")` front;
 *   only the top tread is outlined (stoneDeep).
 * - **sandSlope** — the smooth version: one eased sand incline (lit at the
 *   downhill cliff-top lip → shade uphill) over the same rock front.
 *
 * Angle = rise:run of the step. 26.57° = 1:2 (STEPW 8, DROP 4 → 2-tile
 * period, runA/runB). `se` ascends right; `sw = se.mirrorX()`.
 */
import { PixelGrid, type Cell } from "../grid";
import { wallFace, type WallParams } from "./materials";
import { h2 } from "./noise";
import type { PaletteName } from "../../../../src/shared/palette";

const T = 16;

/** Retaining-wall rock tuning — matches the desert cliff + straight ramps. */
const RAMP_WALL_PARAMS: WallParams = {
  courses: 3, blockSize: 3, blocksPerCourse: 3, stagger: 0.5,
  tone: 0.16, mortar: 0.28, orderVsRandom: 0.45,
};

export type DiagonalMaterial = "stoneSteps" | "sandSlope";

/** Per-angle step cadence (px). 26.57° prototyped first (the locked default). */
interface AngleSpec {
  stepW: number; // horizontal px per step
  drop: number; // vertical px climbed per step
}
const ANGLES: Record<"2651" | "45" | "6343", AngleSpec> = {
  "2651": { stepW: 8, drop: 4 }, // 2:1 shallow — 2-tile period
  "45": { stepW: 4, drop: 4 }, // 1:1 — 1-tile period
  "6343": { stepW: 4, drop: 8 }, // 1:2 steep — 2-tall period
};

const TREAD = 12; // walking-surface depth = bd(6) * rise(0.5) * unit(4) — the 6-ft stair width
const ROCKB = 20; // rock front band depth carried under the surface (px)
const OFF = 4; // vertical anchor so the tread sits near a tile's top edge

/** One baked rock face, sampled by absolute position so the front is a single
 *  continuous wall across every tile seam. */
function makeRock(seed: number): PixelGrid {
  return wallFace("rock", RAMP_WALL_PARAMS, seed);
}
const rockAt = (rock: PixelGrid, gx: number, gy: number): PaletteName =>
  (rock.get(((gx % T) + T) % T, ((gy % T) + T) % T) as PaletteName) ?? "stoneDark";

/** Global band sampler for the `se` stone staircase at `angle`. */
function stoneCell(angle: AngleSpec, rock: PixelGrid, gx: number, gy: number): Cell {
  const ty = OFF - Math.floor(gx / angle.stepW) * angle.drop; // tread top steps up-right
  const rel = gy - ty;
  if (rel < 0) return null; // sky above the tread
  if (rel < TREAD) {
    // Walking surface. No per-tread outline (they'd stack into a mess of lines
    // across the run). Instead a slight shade along the UP-SLOPE edge — the
    // right edge for `se` — which is the edge that butts against the NEXT
    // step's riser (verified against the 3D cube model; the tread's top/back
    // edge is the high-z side against the INSIDE WALL and must NOT be shaded).
    // That cast-shadow crease is what separates one step from the next.
    const lx = ((gx % angle.stepW) + angle.stepW) % angle.stepW; // 0 = downhill .. stepW-1 = up-slope
    if (lx === angle.stepW - 1) return "stoneDark"; // 1px contact crease against next riser
    if (lx === angle.stepW - 2) return "stone"; // slight shade fading out
    return h2(gx, gy, 9) < 0.1 ? "stone" : "stoneLit"; // lit walking surface + grain
  }
  if (rel < TREAD + ROCKB) return rockAt(rock, gx, gy); // rock front
  return null;
}

/** Cut a 16×16 tile out of a global sampler at (gx0, gy0). */
function sliceTile(sample: (gx: number, gy: number) => Cell, gx0: number, gy0: number): PixelGrid {
  const g = new PixelGrid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.px(x, y, sample(gx0 + x, gy0 + y));
  return g;
}

export interface DiagonalRampParams {
  seed: number;
}

/** The `se` run tiles for one material+angle (prototype: stoneSteps 26.57°). */
export function diagonalRunTiles(
  material: DiagonalMaterial,
  angleKey: "2651" | "45" | "6343",
  p: DiagonalRampParams
): { piece: string; grid: PixelGrid }[] {
  if (material !== "stoneSteps" || angleKey !== "2651") {
    throw new Error("diagonalRunTiles: only stoneSteps 26.57° prototyped so far");
  }
  const angle = ANGLES[angleKey];
  const rock = makeRock(p.seed);
  const sample = (gx: number, gy: number) => stoneCell(angle, rock, gx, gy);
  // 26.57° period = 2 tiles wide (runA, runB), placed on the (32,-16) lattice.
  return [
    { piece: "runA", grid: sliceTile(sample, 0, 0) },
    { piece: "runB", grid: sliceTile(sample, T, 0) },
  ];
}

/** Exposed for the visual-review scratch: paint the continuous `se` band and
 *  the lattice-reconstruction into one grid to eyeball seam continuity. */
export function _debugStoneRun(seed: number, periods: number): { continuous: PixelGrid; tiled: PixelGrid } {
  const angle: AngleSpec = { stepW: 8, drop: 8 }; // confirmed proportions: 8px run + 8px riser
  const rock = makeRock(seed);
  const sample = (gx: number, gy: number) => stoneCell(angle, rock, gx, gy);
  const cols = periods * 2 + 2;
  const rows = periods + 3;
  const W = cols * T, H = rows * T;
  // continuous: paint the sampler directly, anchored so the run climbs across the frame
  const continuous = new PixelGrid(W, H);
  const baseGy = (n: number, m: number) => ({ gx: n, gy: m });
  void baseGy;
  const anchorY = (periods + 1) * T; // lower-left start
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    continuous.px(X, Y, sample(X, Y - anchorY));
  }
  // tiled: place runA/runB on the (2 right, 1 up) lattice from the same tiles
  const tiles = diagonalRunTiles("stoneSteps", "2651", { seed });
  const runA = tiles[0].grid, runB = tiles[1].grid;
  const tiled = new PixelGrid(W, H);
  for (let p = 0; p < cols; p++) {
    const tileRow = (periods + 1) - Math.floor(p / 2); // step up 1 tile every 2 columns
    const tile = p % 2 === 0 ? runA : runB;
    tiled.blit(tile, p * T, tileRow * T);
  }
  return { continuous, tiled };
}
