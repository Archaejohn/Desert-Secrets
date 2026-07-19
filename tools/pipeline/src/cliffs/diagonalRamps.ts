/**
 * Diagonal ramps/stairs (phase 1c) — FF6-style isometric runs at clean
 * pixel-slope angles, both materials, both directions. See
 * docs/DIAGONAL_STAIRS_AND_RAMPS.md for the locked look.
 *
 * ## Model (locked look, reworked tiling)
 *
 * Each flight is **a cascade of small SHORTENING PLATEAUS**: every step of
 * the staircase is its own one-tile plateau, built from the real plateau +
 * cliff autotile set (plateau-top surface, rim/cap with its corner
 * rounding, `cliffRock_*_face` wall, footer). Each successive step-plateau
 * is one level lower and one column over, so its support wall is one tile
 * SHORTER — and every step's footer lands on the SAME base row (one tile
 * south of the main wall's), giving the whole cascade one continuous
 * ground-contact/scree line. The cascade is stamped by the MAP from the
 * ordinary autotiles (see render-cliff-review.mts `stampDiagonalFlight`):
 * the top landing is a real plateau cell in the plateau bitmap, and steps
 * k = 1..H are rim + (H-k) faces + footer, standing in front of the main
 * wall.
 *
 * The tiles THIS module generates ride on top of that support:
 *   - the fine walking BAND (`run`/`runLower`) — 4px treads / the sand
 *     incline — surface-only (transparent elsewhere), decorating the
 *     cascade's edges into the FF6 stair read;
 *   - the terminal FOOT (`ground`/`groundLower`) — the last 16px of descent
 *     past the cascade's bottom step, which no plateau backs: the band plus
 *     its own free-standing rock wedge (`wallFace("rock",
 *     RAMP_WALL_PARAMS)`, the very texture the cliff face is built from)
 *     down to a ground-contact line collinear with the cascade footers'
 *     contact row — one unbroken base line under the whole structure.
 *
 * ## Geometry (45°, the shipped angle)
 *
 * Steps follow the locked cube model at `unit=4`: **4px run, 4px riser**
 * (doc §2 — 45° = bw=1, bh=1 → 4 right, 4 up), tread depth 12px (6-ft,
 * `bd=6`). The descending `se` band sampler (ascends to the right):
 *
 *   stone:  ty(gx) = 14 - 4*floor(gx/4)      (stepped treads)
 *   sand:   ty(gx) = 15 - gx                 (continuous incline)
 *
 * Both satisfy `ty(gx+16) = ty(gx) - 16`, so the run repeats on the
 * **1-right / 1-up tile lattice** and the whole infinite band collapses to
 * one `run` tile plus one `runLower` tile (the band is thicker than one
 * tile's 16px drop, so each lattice cell spills into the tile below).
 *
 * ## The six pieces, and where they go (se, descending left)
 *
 * For a flight whose head column is `c0` on the wall's rim row `y0`, over a
 * cliff of `H` face rows (footer at `y0+H+1`):
 *
 *   TOP LANDING — NOT a flight piece. The landing is a real PLATEAU cell:
 *   the map extends the plateau one cell south at (c0, y0+1) (a one-cell
 *   peninsula), and the ordinary plateau + rim/face/footer autotile loops
 *   draw it — plateau fill, cap roll, corner rounding, wall and footer, all
 *   with the standard shading/edge treatment. The plateau therefore flows
 *   through (c0, y0) (now interior) onto the protruding landing at plateau
 *   height, and the flight's first tread starts one column west of it.
 *
 *   run       @ (c0-k, y0+k)     — k = 1..H, the repeating diagonal band
 *                                  (k=1 sits directly beside the landing).
 *   runLower  @ (c0-k, y0+k+1)   — its spill, for k < H.
 *   foot      @ (c0-H, y0+H+1)   — the band crossing the FOOTER row: the
 *   footLower @ (c0-H, y0+H+2)     uncut spill walking over the footer's
 *                                  contact line, + the projection's rock
 *                                  body continuing beneath it.
 *   ground    @ (c0-H-1, y0+H+1) — the flight PROJECTED PAST the cliff base
 *   groundLwr @ (c0-H-1, y0+H+2)   onto the ground rows: the same band, one
 *                                  more lattice cell down-left, drawn over
 *                                  the sand as a SOLID stepped-down mass —
 *                                  lit treads over riser fronts and a full
 *                                  rock support wedge standing on the
 *                                  ground — whose last step lands at ground
 *                                  level and exits onto `sandFill` (stone: a
 *                                  final riser onto scuffed sand; sand: the
 *                                  incline eases out flat and fades into
 *                                  the ground).
 *
 * The foot/footLower/ground/groundLower quad is sliced from ONE 32x32
 * screen-space sampler (`footCell`): thanks to the band's lattice symmetry
 * `cell(gx+16, gy-16) === cell(gx, gy)`, all four tiles of that block share
 * `runCell`'s coordinates, so the projection is seam-continuous with the run
 * above/right by construction. Where the band's underside reaches the
 * footer's contact row (in-tile row 9) the wall no longer backs the flight,
 * so from that column on the body runs down to a flat ground-contact line
 * (`BODY_BASE`) instead of the wall's face rows — the free-standing foot —
 * and the flight's base line transitions cleanly from the footer/scree line
 * to the foot's own base on the sand.
 *
 * - **stoneSteps** — 4px treads (`stoneLit` + sparse `stone` grain), 1px
 *   `stoneDark` crease on each tread's UP-SLOPE edge (right, for `se`) —
 *   the step separator; no outlines (doc §3).
 * - **sandSlope** — one continuous incline: `umber` back-edge line, shade →
 *   mid → `sandLight` toward the downhill lip (doc §4), vertical thickness
 *   16px (≈ 12·√2 — constant walking width at 45°), entering at the
 *   plateau landing's west edge and easing out at the ground runout.
 *
 * `sw` is the structural mirror: every piece `mirrorX()`, stamped ascending
 * left. Palette-locked, deterministic (`h2` only).
 */
import { PixelGrid, type Cell } from "../grid";
import type { PaletteName } from "../../../../src/shared/palette";
import { h2 } from "./noise";
import { wallFace } from "./materials";
import { RAMP_WALL_PARAMS } from "./ramps";

const T = 16;

export type DiagonalMaterial = "stoneSteps" | "sandSlope";
export type DiagonalDir = "se" | "sw";
export type DiagonalPiece =
  | "run"
  | "runLower"
  | "runTop"
  | "foot"
  | "footLower"
  | "ground"
  | "groundLower"
  | "capTop";

/** Locked per-angle step cadence in px (doc §2, `unit=4`): 45° = 4 right /
 *  4 up. (26.57° = 8/4 and 63.43° = 4/8 will reuse this sampler shape when
 *  they are built; only 45° ships now.) */
const STEP = 4; // horizontal px per tread AND riser px per tread (1:1)

const TREAD = 12; // walking-surface depth = bd(6) * rise(0.5) * unit(4) — 6-ft width
const SAND_THICK = 16; // sand band vertical thickness ≈ TREAD * sqrt(1+slope²) at 45°
const FOOT_CONTACT = 9; // footer tile's contact-shadow row (rock 0..8, ground 10..)

/** Tile-LOCAL hash (16-periodic, grid-aligned) — grain/flecks sampled with it
 *  are seamless across seams AND repeat with the tile grid, so the run
 *  collapses to the fixed piece set instead of one tile per position. */
const hh = (gx: number, gy: number, s: number): number =>
  h2(((gx % T) + T) % T, ((gy % T) + T) % T, s);

/** Stone band at band-relative depth `rel`: the 12px walking surface (TOP
 *  face) over its own 4px riser FRONT face — each step therefore reads as
 *  the classic lit-tread-over-dark-riser pair, crisp against the busy
 *  boulder texture of the surrounding cliff (a bare lit ribbon camouflaged
 *  into the boulders' own lit tops). `lx` = position within the 4px tread;
 *  the up-slope (right, for `se`) edge carries the 1px `stoneDark` contact
 *  crease that separates steps — stopped short of the lip, so the bright
 *  lip runs as one continuous stepped zigzag down the whole flight. Depth
 *  shading mirrors the sand band's locked light model: contact line + shade
 *  at the uphill back edge (`backLine`), lit at the downhill lip. */
const STONE_THICK = TREAD + STEP; // tread surface + its riser front face
function stoneSurface(
  gx: number,
  gy: number,
  lx: number,
  rel: number,
  backLine: boolean
): PaletteName {
  if (rel >= TREAD) {
    // riser FRONT face under the tread lip — `slate`, the retaining-cut
    // inside-wall role (doc §6): a saturated blue the boulder texture never
    // uses, so the step fronts read as carved faces, not gaps in the rock.
    const r = rel - TREAD;
    if (r === 0 || r === STEP - 1) return "stoneDeep"; // lip contact / riser base
    return "slate";
  }
  if (rel >= TREAD - 2) return "stoneLit"; // continuous bright lip (2px)
  if (backLine && rel === 0) return "stoneDeep"; // uphill contact line vs the rock
  if (rel < 2) return "stone"; // slight uphill back-edge shade
  if (lx === STEP - 1) return "stone"; // soft crease against the next riser
  // solid lit tread body — deliberately calm/uniform (no grain): the busy
  // boulder texture around it is what makes the cut read as a cut.
  return "stoneLit";
}

/** Sand walking surface across the band depth `f = rel/thick` (0 = uphill
 *  back edge, 1 = downhill lip). Lit at the downhill cliff-top lip; the
 *  cliff below must never appear to shade the surface (doc §4). */
function sandSurface(gx: number, gy: number, rel: number, thick: number, noUphillOutline?: boolean): PaletteName {
  if (rel < 1 && !noUphillOutline) return "umber"; // back-edge outline
  const f = rel / thick;
  if (f < 0.28 && !noUphillOutline) return hh(gx, gy, 5) < 0.1 ? "umber" : "sandShade";
  if (f < 0.7) return hh(gx, gy, 9) < 0.06 ? "sandLight" : "sand";
  return "sandLight";
}

/** Global `se` RUN band sampler (descends left / ascends right), 45°.
 *  Transparent outside the walking surface — the cliff autotile owns all
 *  rock. Symmetry: cell(gx+16, gy-16) === cell(gx, gy). */
function runCell(material: DiagonalMaterial, gx: number, gy: number): Cell {
  if (material === "stoneSteps") {
    const ty = 14 - STEP * Math.floor(gx / STEP);
    const rel = gy - ty;
    if (rel < 0 || rel >= STONE_THICK) return null;
    return stoneSurface(gx, gy, ((gx % STEP) + STEP) % STEP, rel, true);
  }
  const ty = 15 - gx;
  const rel = gy - ty;
  if (rel < 0 || rel >= SAND_THICK) return null;
  return sandSurface(gx, gy, rel, SAND_THICK);
}

/** The flight's SUPPORT rock, sampled at tile-local coordinates from the
 *  `wallFace("rock", RAMP_WALL_PARAMS)` texture — the very texture the
 *  `cliffRock_*_face` autotile is built from (generate.ts passes the same
 *  params + seed; the mid-variant face applies no extra shading), so over
 *  the cliff this body is PIXEL-IDENTICAL to the wall behind and merges
 *  invisibly, while past the cliff base it continues as the projected
 *  foot's visible mass. */
const rockPx = (rock: PixelGrid, gx: number, gy: number): Cell =>
  rock.get(((gx % T) + T) % T, ((gy % T) + T) % T);

/** First row BELOW the run band's underside at column `gx` (riser base + 1
 *  for stone, incline lip + 1 for sand) — where the support body begins. */
const runBandEnd = (material: DiagonalMaterial, gx: number): number =>
  material === "stoneSteps"
    ? 14 - STEP * Math.floor(gx / STEP) + STONE_THICK
    : 15 - gx + SAND_THICK;

/** `run`/`runLower` sampler with the flight's solid body: the walking band,
 *  and the support rock everywhere below it — the flight is one continuous
 *  solid mass (tread + riser front + rock body) instead of a surface ribbon
 *  painted on the wall. Above the band stays transparent (the cliff rises
 *  over the flight there). */
function runSolidCell(material: DiagonalMaterial, rock: PixelGrid, gx: number, gy: number): Cell {
  const c = runCell(material, gx, gy);
  if (c !== null) return c;
  return gy >= runBandEnd(material, gx) ? rockPx(rock, gx, gy) : null;
}

/** Back-edge height of the sand incline through the flight base (screen
 *  frame, see `footCell`): full 45° slope down to gx=8, then eased (half
 *  slope) and levelled flat at row 9 — the footer's contact row — so the
 *  runout's uphill edge merges into the neighbouring footer's own contact
 *  line and the surface exits at ground level. */
const sandFootTy = (gx: number): number => (gx >= 8 ? 15 - gx : gx >= 6 ? 8 : 9);

/** Ground-contact line of the projected mass (screen frame): its rock body
 *  runs down to row 24, a `stoneDeep` contact line at 25 and a cast shadow
 *  on the sand at 26 — one tile below the footer's own contact row, i.e. the
 *  flat base the free-standing part of the flight stands on. */
const BODY_BASE = 25;

/**
 * The flight BASE sampler (se) — a 32x32 SCREEN-space block spanning
 * [foot | ground] columns x [footer | ground] rows:
 *
 *      gx 0..15            gx 16..31
 *   gy  0..15  `ground`     `foot`        (footer row: rock 0..8, contact 9,
 *   gy 16..31  `groundLower` `footLower`   ground 10.., then sandFill below)
 *
 * By the band's lattice symmetry, `runCell(gx, gy)` is valid across the
 * whole block, so the projected steps continue the run seamlessly. Where the
 * band drops past the cliff's contact line it is no longer backed by the
 * autotiled face, so the projection carries its OWN support: a SOLID ROCK
 * body (`wallFace("rock", RAMP_WALL_PARAMS)` — the same stone as the cliff)
 * from the walking surface down to a flat ground-contact line (`BODY_BASE`),
 * making the foot read as a stepped-down solid mass standing on the sand,
 * not floating treads. On top of that:
 *   - stone: lit tread + slate riser front + rock body per projected step;
 *     the very last tread (gx 0..3) is dropped — the walker steps off the
 *     final riser onto scuffed ground (sparse `sandLight` flecks).
 *   - sand: the incline continues over the contact line easing to flat at
 *     ground level (`sandFootTy`) — sand top over the rock body while it
 *     stands proud — and fades its back line / lit lip into plain ground at
 *     the west exit (the levelled runout rests ON the sand: no body, just a
 *     1px under-lip contact shadow).
 */
function footCell(material: DiagonalMaterial, rock: PixelGrid, gx: number, gy: number): Cell {
  if (material === "stoneSteps") {
    if (gx < STEP) {
      // walk-off: scuffed sand where the flight meets the ground
      return gy >= 26 && gy <= 29 && hh(gx, gy, 41) > 0.7 ? "sandLight" : null;
    }
    const c = runCell(material, gx, gy);
    if (c !== null) return c;
    const base = 14 - STEP * Math.floor(gx / STEP) + STONE_THICK - 1; // riser base row
    // Draw solid rock from the steps down to the flat ground contact (BODY_BASE)
    if (gy > base && gy < BODY_BASE) return rockPx(rock, gx, gy);
    if (gy === BODY_BASE) return "stoneDeep"; // ground-contact line
    if (gy === BODY_BASE + 1) return "sandShade"; // cast shadow on the sand
    return null;
  }
  const ty = sandFootTy(gx);
  const rel = gy - ty;
  if (rel >= 0 && rel < SAND_THICK) {
    const c = sandSurface(gx, gy, rel, SAND_THICK);
    if (gx >= 6) return c;
    // runout fade (gx 5..0): the levelled surface dissolves into plain
    // ground toward the west exit — the back line softens to `sandShade`
    // then breaks up, and the lit lip crumbles into flecks — so the walker
    // steps off onto bare sandFill with no hard tail edge.
    if (c === "umber") {
      if (gx >= 4) return "umber";
      if (gx >= 2) return "sandShade";
      return hh(gx, gy, 33) > 0.5 ? "sandShade" : "sand";
    }
    if (c === "sandLight") return hh(gx, gy, 33) < 0.12 + gx * 0.15 ? "sandLight" : "sand";
    if (c === "sandShade" && gx <= 1 && hh(gx, gy, 47) > 0.5) return "sand";
    return c;
  }
  const lipY = ty + SAND_THICK - 1;
  if (gx >= 6) {
    // Draw solid rock from the incline down to the flat ground contact (BODY_BASE)
    if (gy > lipY && gy < BODY_BASE) return rockPx(rock, gx, gy);
    if (gy === BODY_BASE) return "stoneDeep"; // ground-contact line
    if (gy === BODY_BASE + 1) return "sandShade"; // cast shadow on the sand
  } else if (gx >= 2 && gy === lipY + 1) {
    return "sandShade"; // levelled runout's contact shadow
  }
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

/**
 * The six overlay pieces of a 45° diagonal flight for one material and
 * direction (see file header for the stamp lattice; the top landing is a
 * real plateau cell drawn by the map's own autotiler, not a flight piece).
 * Every piece carries the walking surface plus the flight's solid rock body
 * beneath it (transparent only ABOVE the surface, where the cliff rises
 * over the flight) — one continuous supported mass from the landing to the
 * ground-contact base. Stamp them over the ordinary rim/face/footer (and
 * the ground below it): over the cliff the body merges pixel-identically
 * into the face autotile, and past the cliff base it stands on the sand as
 * a full support wedge.
 */
function runTopCell(material: DiagonalMaterial, rock: PixelGrid, gx: number, gy: number): Cell {
  if (material === "stoneSteps") {
    // Stone steps just use the normal runCell behavior (steps are good)
    return runSolidCell(material, rock, gx, gy);
  }
  // sandSlope
  let y_uphill = 15 - gx;
  if (gx >= 10) {
    const uphills = [5, 4, 3, 1, 0, 0];
    y_uphill = uphills[gx - 10];
  }

  const y_downhill = 31 - gx; // pure linear downhill edge for runTop (curves in capTop only)

  if (gy < y_uphill) return null;
  if (gy < y_downhill) {
    const thick = y_downhill - y_uphill;
    const rel = gy - y_uphill;
    const noUphillOutline = (y_uphill === 0);
    return sandSurface(gx, gy, rel, thick, noUphillOutline);
  }
  if (gy < T * 2) return rockPx(rock, gx, gy % T);
  return null;
}

function capTopCell(material: DiagonalMaterial, rock: PixelGrid, gx: number, gy: number): Cell {
  if (material === "stoneSteps") {
    if (gx >= 4) return null; // transparent on the right, letting the landing autotile show through
    const globalGx = gx + 16;
    const c = runCell(material, globalGx, gy);
    if (c !== null) return c;
    // Rock body below the Step 0 riser
    const base = 14 - STEP * Math.floor(globalGx / STEP) + STONE_THICK - 1;
    if (gy > base && gy < T) return rockPx(rock, gx, gy);
    return null;
  }
  // sandSlope
  if (gx >= 12) return null; // transparent on the right, letting landing show through
  const capTopDownhills = [15, 14, 13, 12, 11, 10, 9, 8, 8, 8, 8, 8];
  const y_downhill = capTopDownhills[gx];
  if (gy < y_downhill) {
    return sandSurface(gx, gy, gy, y_downhill, true); // capTop is flat plateau at the top, so no outline
  }
  // 4px shaded plateau cap rim
  if (gy >= y_downhill && gy < y_downhill + 4) {
    const rel = gy - y_downhill;
    if (rel === 0) return "sandLight"; // lit lip at top of overhang
    if (rel === 1) return "sand";
    if (rel === 2) return "sandShade";
    return "stoneDeep"; // dark rim edge at bottom of overhang
  }
  if (gy < T) return rockPx(rock, gx, gy);
  return null;
}

/**
 * The eight overlay pieces of a 45° diagonal flight for one material and
 * direction (see file header for the stamp lattice; the top landing is a
 * real plateau cell drawn by the map's own autotiler, but capTop overwrites
 * its left/right edge to blend the transition smoothly).
 * Every piece carries the walking surface plus the flight's solid rock body
 * beneath it (transparent only ABOVE the surface, where the cliff rises
 * over the flight) — one continuous supported mass from the landing to the
 * ground-contact base. Stamp them over the ordinary rim/face/footer (and
 * the ground below it): over the cliff the body merges pixel-identically
 * into the face autotile, and past the cliff base it stands on the sand as
 * a full support wedge.
 */
export function diagonalFlightTiles(
  material: DiagonalMaterial,
  dir: DiagonalDir,
  p: DiagonalRampParams
): { piece: DiagonalPiece; grid: PixelGrid }[] {
  // The flight's support body — the same rock the cliff face / straight
  // ramp walls use, so the whole solid mass reads as the same stone and is
  // pixel-identical to the face autotile wherever it is over the cliff.
  const rock = wallFace("rock", RAMP_WALL_PARAMS, p.seed);
  const run = (gx: number, gy: number): Cell => runSolidCell(material, rock, gx, gy);
  const runTop = (gx: number, gy: number): Cell => runTopCell(material, rock, gx, gy);
  const fc = (gx: number, gy: number): Cell => footCell(material, rock, gx, gy);
  const ct = (gx: number, gy: number): Cell => capTopCell(material, rock, gx, gy);
  const pieces: { piece: DiagonalPiece; grid: PixelGrid }[] = [
    { piece: "run", grid: sliceTile(run, 0, 0) },
    { piece: "runLower", grid: sliceTile(run, 0, T) },
    { piece: "runTop", grid: sliceTile(runTop, 0, 0) },
    { piece: "foot", grid: sliceTile(fc, T, 0) },
    { piece: "footLower", grid: sliceTile(fc, T, T) },
    { piece: "ground", grid: sliceTile(fc, 0, 0) },
    { piece: "groundLower", grid: sliceTile(fc, 0, T) },
    { piece: "capTop", grid: sliceTile(ct, 0, 0) },
  ];
  return dir === "sw" ? pieces.map(({ piece, grid }) => ({ piece, grid: grid.mirrorX() })) : pieces;
}
