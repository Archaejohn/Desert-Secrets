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
// Locked proportions: riser = drop = clean divisor of 16 (8 or 16). Period is
// the number of 16px tiles over which the run climbs a whole tile.
const ANGLES: Record<"2651" | "45" | "6343", AngleSpec> = {
  "2651": { stepW: 16, drop: 8 }, // 1:2 shallow — climbs 1 tile per 2 wide (runA/runB)
  "45": { stepW: 8, drop: 8 }, // 1:1 — climbs 1 tile per 1 (run)
  "6343": { stepW: 8, drop: 16 }, // 2:1 steep — climbs 2 tiles per 1 (runU/runL)
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

/** Tile-LOCAL hash (16-periodic, grid-aligned) — grain/flecks sampled with it
 *  are seamless across seams AND repeat with the tile grid, so the run collapses
 *  to a few distinct tiles instead of one-per-position. */
const hh = (gx: number, gy: number, s: number): number =>
  h2(((gx % T) + T) % T, ((gy % T) + T) % T, s);

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
    return hh(gx, gy, 9) < 0.1 ? "stone" : "stoneLit"; // lit walking surface + grain
  }
  if (rel < TREAD + ROCKB) return rockAt(rock, gx, gy); // rock front
  return null;
}

/** Global band sampler for the `se` sand RAMP at `angle` — the smooth version
 *  of the same wedge: one continuous sand incline (the walking surface) over
 *  the same continuous rock body. This is the constant-slope RUN; the eased
 *  foot/top belong to the caps. */
function sandCell(angle: AngleSpec, rock: PixelGrid, gx: number, gy: number): Cell {
  const slope = angle.drop / angle.stepW;
  // Walking width held constant perpendicular to travel (do NOT let it narrow
  // as the slope steepens): vertical band thickness = width * sqrt(1+slope²),
  // where TREAD is the 6-ft width at flat.
  const thick = TREAD * Math.sqrt(1 + slope * slope);
  const ty = OFF - slope * gx; // continuous incline top = uphill/back edge
  const rel = gy - ty;
  if (rel < 0) return null; // sky above the incline
  if (rel < thick) {
    if (rel < 1) return "umber"; // outline on the far/uphill edge
    const f = rel / thick; // 0 = back/uphill .. 1 = downhill cliff-top lip
    // Shade at the uphill/back edge, LIT at the downhill cliff-top lip (light
    // from above; the cliff below must never appear to shade the surface).
    if (f < 0.28) return hh(gx, gy, 5) < 0.1 ? "umber" : "sandShade"; // shade + sparse umber flecks
    if (f < 0.7) return hh(gx, gy, 9) < 0.06 ? "sandLight" : "sand"; // mid sand + sparse light flecks
    return "sandLight"; // lit downhill leading edge
  }
  if (rel < thick + ROCKB) return rockAt(rock, gx, gy); // same rock body as the stairs
  return null;
}

/** Dispatch the run's band sampler by material. */
function bandCell(material: DiagonalMaterial, angle: AngleSpec, rock: PixelGrid, gx: number, gy: number): Cell {
  return material === "sandSlope" ? sandCell(angle, rock, gx, gy) : stoneCell(angle, rock, gx, gy);
}

/** Bound a reusable `se` band sampler (for cap-design scratches + reviews). */
export function _sampler(
  material: DiagonalMaterial,
  angle: AngleSpec,
  seed: number
): (gx: number, gy: number) => Cell {
  const rock = makeRock(seed);
  return (gx, gy) => bandCell(material, angle, rock, gx, gy);
}

/**
 * A complete, self-contained `se` diagonal staircase as one opaque PixelGrid:
 * a vertical RISER at the foot (starts vertical, not flat), `steps` treads
 * ascending up-right, and the rock body carried down to the block's base so
 * it seats against the cliff footer. Sky (above each tread) is transparent so
 * it overlays the map's terrain. This is the run + caps assembled; the tile
 * slices are derived from it. Foot at bottom-left, top tread at top-right.
 */
export function diagonalStaircase(
  material: DiagonalMaterial,
  angleKey: "2651" | "45",
  seed: number,
  steps: number
): PixelGrid {
  const angle = ANGLES[angleKey];
  const sample = _sampler(material, angle, seed);
  const W = steps * angle.stepW; // run ends exactly on the top tread (no rock lead-out)
  const climb = steps * angle.drop;
  const H = climb + TREAD + ROCKB;
  const g = new PixelGrid(W, H);
  // anchor so the top tread sits near the top and the run descends to the base
  const anchorY = climb + OFF;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) g.px(x, y, sample(x, y - anchorY));
  }
  return g;
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

/** The `se` run tiles for one material+angle. (Tile-slice seams for the full
 *  matrix are still WIP; 26.57° two-tile period shown here.) */
export function diagonalRunTiles(
  material: DiagonalMaterial,
  angleKey: "2651" | "45" | "6343",
  p: DiagonalRampParams
): { piece: string; grid: PixelGrid }[] {
  const angle = ANGLES[angleKey];
  const rock = makeRock(p.seed);
  const sample = (gx: number, gy: number) => bandCell(material, angle, rock, gx, gy);
  if (angleKey === "45") {
    // 45° period = 1 tile, placed on the (16,-16) lattice.
    return [{ piece: "run", grid: sliceTile(sample, 0, 0) }];
  }
  if (angleKey === "2651") {
    // 26.57° period = 2 tiles wide (runA, runB), placed on the (32,-16) lattice.
    return [
      { piece: "runA", grid: sliceTile(sample, 0, 0) },
      { piece: "runB", grid: sliceTile(sample, T, 0) },
    ];
  }
  throw new Error("diagonalRunTiles: 63.43° period slice still WIP");
}

/** Exposed for the visual-review scratch: paint the continuous `se` band and
 *  the lattice-reconstruction into one grid to eyeball seam continuity. */
export function _debugRun(
  seed: number,
  periods: number,
  angle: AngleSpec = { stepW: 8, drop: 8 },
  material: DiagonalMaterial = "stoneSteps"
): { continuous: PixelGrid; tiled: PixelGrid } {
  const rock = makeRock(seed);
  const sample = (gx: number, gy: number) => bandCell(material, angle, rock, gx, gy);
  const cols = periods * 2 + 2;
  const rows = periods + 3;
  const W = cols * T, H = rows * T;
  // continuous: paint the sampler directly, anchored so the run climbs across the frame
  const continuous = new PixelGrid(W, H);
  const anchorY = (periods + 1) * T; // lower-left start
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    continuous.px(X, Y, sample(X, Y - anchorY));
  }
  // tiled: place runA/runB on the (2 right, 1 up) lattice from the same tiles
  const tiles = diagonalRunTiles(material, "2651", { seed });
  const runA = tiles[0].grid, runB = tiles[1].grid;
  const tiled = new PixelGrid(W, H);
  for (let p = 0; p < cols; p++) {
    const tileRow = (periods + 1) - Math.floor(p / 2); // step up 1 tile every 2 columns
    const tile = p % 2 === 0 ? runA : runB;
    tiled.blit(tile, p * T, tileRow * T);
  }
  return { continuous, tiled };
}
