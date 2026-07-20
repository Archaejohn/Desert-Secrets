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
 * ## Geometry — the three built angles
 *
 * Steps follow the locked cube model at `unit=4` (doc §2), captured per
 * angle in an `AngleSpec { run, riser, periodTiles, latTilesY, sandThick }`
 * whose band repeats on the tile-lattice vector
 * `(16·periodTiles, −16·latTilesY)`:
 *
 *   45°    — 4px run / 4px riser (bw=1, bh=1). The descending `se` band:
 *              stone:  ty(gx) = 14 - 4*floor(gx/4)   (stepped treads)
 *              sand:   ty(gx) = 15 - gx              (continuous incline)
 *            Both satisfy `ty(gx+16) = ty(gx) - 16`, so the run repeats on
 *            the **1-right / 1-up tile lattice** — ONE `run` column.
 *   26.57° — 8px run / 4px riser (bw=2, bh=1), slope 1:2. The band:
 *              stone:  ty(gx) = 14 - 4*floor(gx/8)
 *              sand:   ty(gx) = 15 - floor(gx/2)
 *            Both satisfy `ty(gx+32) = ty(gx) - 16`, so the lattice is
 *            **2-right / 1-up** and the period is TWO run columns —
 *            `runA` (west half, gx 0..15) + `runB` (east half, gx 16..31).
 *   63.43° — 4px run / 8px riser (bw=1, bh=2), slope 2:1. The band:
 *              stone:  ty(gx) = 30 - 8*floor(gx/4)
 *              sand:   ty(gx) = 31 - 2*gx
 *            Both satisfy `ty(gx+16) = ty(gx) - 32`, so the lattice is
 *            **1-right / 2-up** — one column of FOUR vertical slices
 *            (`run`/`runMid`/`runLower`/`runLowest`: the 20px stone / 27px
 *            sand band descends 32px across a 16px column, spanning rows
 *            6..49 / 1..57 of the column frame).
 *
 * The head pin is shared: the step-0 tread enters the landing tile at
 * band-top −2 (stone) / −1 (sand), i.e. `ty(16·periodTiles) = −2 / −1`,
 * which fixes each angle's phase constant at 14/15 plus the lattice's
 * extra vertical drop (30/31 at 63.43°) — and lands the last riser base
 * exactly on `BODY_BASE` at the foot. The free-standing foot bottoms out
 * on `BODY_BASE` and the same capTop/runTop framing applies (63.43° adds
 * `capTopLower`: its 8px step-0 riser / steep cap roll spill one tile
 * below the landing). Tread depth stays 12px (6-ft, `bd=6`); the sand
 * band's vertical thickness is TREAD·sqrt(1+slope²): 16px at 45°, 13px at
 * 26.57°, 27px at 63.43°.
 *
 * ## The pieces, and where they go (se, descending left)
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
 * 45° (one column per face row):
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
 * 26.57° (TWO columns per face row — the 2-wide period; `runTop` is the
 * eased runB beside the landing):
 *   runB/runA         @ (c0-2k+1, y0+k) / (c0-2k, y0+k)   — k = 1..H
 *   runBLower/runALwr @ same cols, y0+k+1                  — for k < H
 *   footB/footA       @ (c0-2H+1, y0+H+1) / (c0-2H, y0+H+1)
 *   footBLower/-ALwr  @ same cols, y0+H+2
 *   groundB/groundA   @ (c0-2H-1, y0+H+1) / (c0-2H-2, y0+H+1)
 *   groundBLwr/-ALwr  @ same cols, y0+H+2
 *
 * 63.43° (one column per TWO face rows — the 2-tall period; over K run
 * columns with D = 2K+1 face rows, footer row F = y0+D+1; see
 * render-cliff-review.mts `stampDiagonalFlightSteep`):
 *   capTop/capTopLower       @ (c0, y0+1) / (c0, y0+2)
 *   runTop|run,runMid,
 *   runLower,runLowest       @ (c0-k, y0+2k-1 .. y0+2k+2)  — k = 1..K
 *   run,foot,footLower       @ (c0-K-1, F-1 / F / F+1) — the terminal
 *                              compresses into the ONE foot column: the
 *                              band crosses the footer contact AND lands
 *                              its final riser on the ground line there
 *                              (the dropped walk-off tread is the foot
 *                              column's west tread-width)
 *   ground/groundLower       @ (c0-K-2, F / F+1) — walk-off scuff (stone)
 *                              / the levelled runout fade (sand) only
 *
 * The foot/ground quad(s) are sliced from ONE screen-space sampler
 * (`footCell`, 32px wide per period column-pair): thanks to the band's
 * lattice symmetry (`cell(gx+16, gy-16) === cell(gx, gy)` at 45°,
 * `cell(gx+32, gy-16)` at 26.57°), the sampler shares `runCell`'s
 * coordinates, so the projection is seam-continuous with the run
 * above/right by construction. Where the band's underside reaches the
 * footer's contact row (in-tile row 9) the wall no longer backs the flight,
 * so from that column on the body runs down to a flat ground-contact line
 * (`BODY_BASE`) instead of the wall's face rows — the free-standing foot —
 * and the flight's base line transitions cleanly from the footer/scree line
 * to the foot's own base on the sand.
 *
 * - **stoneSteps** — lit treads (`stoneLit`), 45°: deliberately calm 4px
 *   treads with a single soft `stone` crease (see doc §3's 45° tuning note);
 *   26.57°: the original doc-§3 recipe — 8px treads with sparse `stone`
 *   grain, 1px `stoneDark` contact crease + 1px `stone` on each tread's
 *   UP-SLOPE edge (right, for `se`) — the step separator; no outlines.
 * - **sandSlope** — one continuous incline: `umber` back-edge line, shade →
 *   mid → `sandLight` toward the downhill lip (doc §4), vertical thickness
 *   TREAD·sqrt(1+slope²) (16px at 45°, 13px at 26.57°), entering at the
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
export type DiagonalAngle = "45" | "26.57" | "63.43";
export type DiagonalPiece =
  // 45° (single-column period)
  | "run"
  | "runLower"
  | "runTop"
  | "foot"
  | "footLower"
  | "ground"
  | "groundLower"
  | "capTop"
  // 63.43° extras (single-column, 2-tile-TALL period: four vertical band
  // slices per column, and the head riser/cap blend spills one tile down)
  | "runMid"
  | "runLowest"
  | "capTopLower"
  // 26.57° (two-column period; capTop/runTop names are shared)
  | "runA"
  | "runB"
  | "runALower"
  | "runBLower"
  | "footA"
  | "footB"
  | "footALower"
  | "footBLower"
  | "groundA"
  | "groundB"
  | "groundALower"
  | "groundBLower";

/** Locked per-angle step cadence (doc §2, `unit=4`), plus the hand-tuned
 *  bits that don't derive from run/riser alone. The band repeats on the
 *  tile-lattice vector `(16·periodTiles, −16·latTilesY)`:
 *  45° = (16,−16), 26.57° = (32,−16), 63.43° = (16,−32). */
interface AngleSpec {
  run: number; // horizontal px per tread
  riser: number; // riser px per tread
  periodTiles: number; // horizontal lattice component in tiles (1 = 45°)
  latTilesY: number; // vertical lattice component in tiles (1 = 45°/26.57°)
  sandThick: number; // sand band vertical thickness ≈ TREAD*sqrt(1+slope²)
  /** runTop uphill-edge easing into the landing: from global gx
   *  `easeFrom`, use `easeYs` instead of the linear back edge. */
  easeFrom: number;
  easeYs: number[];
}

const ANGLES: Record<DiagonalAngle, AngleSpec> = {
  // 45° = bw=1, bh=1 → 4 right, 4 up; 1-tile period. sandThick 16 ≈ 12·√2.
  "45": { run: 4, riser: 4, periodTiles: 1, latTilesY: 1, sandThick: 16, easeFrom: 10, easeYs: [5, 4, 3, 1, 0, 0] },
  // 26.57° = bw=2, bh=1 → 8 right, 4 up; 2-tile period (runA|runB).
  // sandThick 13 ≈ 12·√(1+0.5²). runTop frame is gx 16..31 (the B column),
  // so the ease covers its last six columns (global gx 26..31), pulling the
  // back edge to the landing two columns early — the 45° ease scaled ×2.
  "26.57": { run: 8, riser: 4, periodTiles: 2, latTilesY: 1, sandThick: 13, easeFrom: 26, easeYs: [1, 1, 0, 0, 0, 0] },
  // 63.43° = bw=1, bh=2 → 4 right, 8 up; 1-tile-wide × 2-tile-TALL period
  // (cell(gx+16, gy−32) === cell(gx, gy)): four run slices per column.
  // sandThick 27 ≈ 12·√(1+2²). The ease covers the last four columns
  // before the landing (natural back edge [7,5,3,1] → [5,3,1,0]), pulling
  // the incline flat onto the landing one column early — the 45° ease at
  // double slope.
  "63.43": { run: 4, riser: 8, periodTiles: 1, latTilesY: 2, sandThick: 27, easeFrom: 12, easeYs: [5, 3, 1, 0] },
};

const TREAD = 12; // walking-surface depth = bd(6) * rise(0.5) * unit(4) — 6-ft width

/** Stone band-top row at column `gx` (descending `se`, ascends right). The
 *  phase constant is pinned by the HEAD: the step-0 tread must sit at
 *  band-top −2 in the landing tile (the "first riser is 6px" absorption,
 *  doc §5), and the landing tile's frame is one lattice step east — i.e.
 *  `stoneTy(16·periodTiles) = −2` — so the constant is 14 plus the
 *  lattice's extra vertical drop: 14 for the 16px-drop angles (riser 4),
 *  30 for 63.43° (32px drop, riser 8). Satisfies the angle's lattice
 *  symmetry `ty(gx + 16*periodTiles) = ty(gx) - 16*latTilesY`. */
const stoneTy = (a: AngleSpec, gx: number): number =>
  14 + T * (a.latTilesY - 1) - a.riser * Math.floor(gx / a.run);

/** Sand incline back-edge row at column `gx` — slope riser/run per px.
 *  45°: 15 - gx; 26.57°: 15 - floor(gx/2); 63.43°: 31 - 2*gx (same head
 *  pin, band-top −1 in the landing tile). Same lattice symmetry. */
const sandTy = (a: AngleSpec, gx: number): number =>
  15 + T * (a.latTilesY - 1) - Math.floor((gx * a.riser) / a.run);

/** Stone band thickness: tread surface + its riser front face. */
const stoneThick = (a: AngleSpec): number => TREAD + a.riser;

/** Tile-LOCAL hash (16-periodic, grid-aligned) — grain/flecks sampled with it
 *  are seamless across seams AND repeat with the tile grid, so the run
 *  collapses to the fixed piece set instead of one tile per position. */
const hh = (gx: number, gy: number, s: number): number =>
  h2(((gx % T) + T) % T, ((gy % T) + T) % T, s);

/** Stone band at band-relative depth `rel`: the 12px walking surface (TOP
 *  face) over its own riser FRONT face — each step therefore reads as
 *  the classic lit-tread-over-dark-riser pair, crisp against the busy
 *  boulder texture of the surrounding cliff (a bare lit ribbon camouflaged
 *  into the boulders' own lit tops). `lx` = position within the tread;
 *  the up-slope (right, for `se`) edge carries the contact crease that
 *  separates steps — stopped short of the lip, so the bright lip runs as
 *  one continuous stepped zigzag down the whole flight. Depth shading
 *  mirrors the sand band's locked light model: contact line + shade at the
 *  uphill back edge (`backLine`), lit at the downhill lip.
 *
 *  45° (4px treads) ships the deliberately CALM surface (doc §3's tuning
 *  note): solid `stoneLit`, one soft `stone` crease. 26.57° (8px treads)
 *  has room for the original §3 recipe: sparse `stone` grain plus a 1px
 *  `stoneDark` contact crease + 1px `stone` at the up-slope edge. */
function stoneSurface(
  a: AngleSpec,
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
    if (r === 0 || r === a.riser - 1) return "stoneDeep"; // lip contact / riser base
    return "slate";
  }
  if (rel >= TREAD - 2) return "stoneLit"; // continuous bright lip (2px)
  if (backLine && rel === 0) return "stoneDeep"; // uphill contact line vs the rock
  if (rel < 2) return "stone"; // slight uphill back-edge shade
  if (a.run <= 4) {
    if (lx === a.run - 1) return "stone"; // soft crease against the next riser
    // solid lit tread body — deliberately calm/uniform (no grain): the busy
    // boulder texture around it is what makes the cut read as a cut.
    return "stoneLit";
  }
  // Wide treads (26.57°): the full doc-§3 recipe.
  if (lx === a.run - 1) return "stoneDark"; // up-slope contact crease
  if (lx === a.run - 2) return "stone";
  return hh(gx, gy, 7) < 0.1 ? "stone" : "stoneLit"; // sparse grain
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

/** Global `se` RUN band sampler (descends left / ascends right).
 *  Transparent outside the walking surface — the cliff autotile owns all
 *  rock. Symmetry: cell(gx + 16*periodTiles, gy-16) === cell(gx, gy). */
function runCell(a: AngleSpec, material: DiagonalMaterial, gx: number, gy: number): Cell {
  if (material === "stoneSteps") {
    const ty = stoneTy(a, gx);
    const rel = gy - ty;
    if (rel < 0 || rel >= stoneThick(a)) return null;
    return stoneSurface(a, gx, gy, ((gx % a.run) + a.run) % a.run, rel, true);
  }
  const ty = sandTy(a, gx);
  const rel = gy - ty;
  if (rel < 0 || rel >= a.sandThick) return null;
  return sandSurface(gx, gy, rel, a.sandThick);
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
const runBandEnd = (a: AngleSpec, material: DiagonalMaterial, gx: number): number =>
  material === "stoneSteps" ? stoneTy(a, gx) + stoneThick(a) : sandTy(a, gx) + a.sandThick;

/** `run`/`runLower` sampler with the flight's solid body: the walking band,
 *  and the support rock everywhere below it — the flight is one continuous
 *  solid mass (tread + riser front + rock body) instead of a surface ribbon
 *  painted on the wall. Above the band stays transparent (the cliff rises
 *  over the flight there). */
function runSolidCell(
  a: AngleSpec,
  material: DiagonalMaterial,
  rock: PixelGrid,
  gx: number,
  gy: number
): Cell {
  const c = runCell(a, material, gx, gy);
  if (c !== null) return c;
  return gy >= runBandEnd(a, material, gx) ? rockPx(rock, gx, gy) : null;
}

/** Back-edge height of the sand incline through the flight base (screen
 *  frame, see `footCell`): full slope down to back-edge row 7, then eased
 *  (rows that would be 8/9 clamp to 8) and levelled flat at row 9 — the
 *  footer's contact row — so the runout's uphill edge merges into the
 *  neighbouring footer's own contact line and the surface exits at ground
 *  level. (At 45° this is exactly the shipped `gx>=8 ? 15-gx : gx>=6 ? 8
 *  : 9` table.) */
const sandFootTy = (a: AngleSpec, gx: number): number => {
  const t = sandTy(a, gx) + footShift(a);
  return t <= 7 ? t : t <= 9 ? 8 : 9;
};

/** Vertical offset of the band inside the FOOT frame. The fc frame's top
 *  row is always the main footer row, but the run lattice meets it one
 *  tile lower per extra latTilesY: at the 16px-drop angles the foot
 *  column's band is the global formula as-is (shift 0); at 63.43° the
 *  foot column's slice sits one lattice-half further down, so the band is
 *  16px lower in the frame. (Derived: foot piece = column K+1's second
 *  slice; in-tile ty = stoneTy + 32K − 16(2K+1) + 16·(latTilesY−1)·0…
 *  collapses to stoneTy + 16·(latTilesY−1).) */
const footShift = (a: AngleSpec): number => T * (a.latTilesY - 1);

/** Ground-contact line of the projected mass (screen frame): its rock body
 *  runs down to row 24, a `stoneDeep` contact line at 25 and a cast shadow
 *  on the sand at 26 — one tile below the footer's own contact row, i.e. the
 *  flat base the free-standing part of the flight stands on. */
const BODY_BASE = 25;

/**
 * The flight BASE sampler (se) — a SCREEN-space block spanning the
 * [ground | foot] columns x [footer | ground] rows. At 45° it is 32x32:
 *
 *      gx 0..15            gx 16..31
 *   gy  0..15  `ground`     `foot`        (footer row: rock 0..8, contact 9,
 *   gy 16..31  `groundLower` `footLower`   ground 10.., then sandFill below)
 *
 * At 26.57° the same frame is 64x32 — two ground columns (`groundA` gx
 * 0..15, `groundB` 16..31) and two foot columns (`footA` 32..47, `footB`
 * 48..63) — every hand-tuned horizontal threshold of the 45° runout scaled
 * ×periodTiles.
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
 *     the very last tread (one tread width) is dropped — the walker steps
 *     off the final riser onto scuffed ground (sparse `sandLight` flecks).
 *   - sand: the incline continues over the contact line easing to flat at
 *     ground level (`sandFootTy`) — sand top over the rock body while it
 *     stands proud — and fades its back line / lit lip into plain ground at
 *     the west exit (the levelled runout rests ON the sand: no body, just a
 *     1px under-lip contact shadow).
 */
function footCell(
  a: AngleSpec,
  material: DiagonalMaterial,
  rock: PixelGrid,
  gx: number,
  gy: number
): Cell {
  // Horizontal scale of the 45°-tuned runout thresholds (×2 at 26.57°).
  const sc = a.periodTiles;
  const fShift = footShift(a); // band sits 16px lower in the fc frame at 63.43°
  if (material === "stoneSteps") {
    // The walker steps off where the next tread's riser base would sink
    // past the flat ground contact: drop everything west of the first
    // tread whose base lands on (or above) BODY_BASE. At the 16px-drop
    // angles that is exactly one tread width (gx < run, the shipped
    // look); at 63.43° the landing tread is at gx 20..23, so the dropped
    // region spans the whole ground column + one tread of the foot column.
    const landGx =
      a.run * Math.ceil((stoneTy(a, 0) + fShift + stoneThick(a) - 1 - BODY_BASE) / a.riser);
    if (gx < landGx) {
      // walk-off: scuffed sand where the flight meets the ground (one
      // tread width west of the last riser — the dropped tread)
      return gx >= landGx - a.run && gy >= 26 && gy <= 29 && hh(gx, gy, 41) > 0.7
        ? "sandLight"
        : null;
    }
    const c = runCell(a, material, gx, gy - fShift);
    if (c !== null) return c;
    const base = stoneTy(a, gx) + fShift + stoneThick(a) - 1; // riser base row
    // Draw solid rock from the steps down to the flat ground contact (BODY_BASE)
    if (gy > base && gy < BODY_BASE) return rockPx(rock, gx, gy);
    if (gy === BODY_BASE) return "stoneDeep"; // ground-contact line
    if (gy === BODY_BASE + 1) return "sandShade"; // cast shadow on the sand
    return null;
  }
  const ty = sandFootTy(a, gx);
  // Band thickness through the runout. 45° ships a FIXED 16px band (its
  // downhill lip lands on BODY_BASE-1 on its own — byte-locked, keep it).
  // The other angles' bands would level out proud of (26.57°) or sink
  // past (63.43°) the base line, so their thickness eases toward the flat
  // 16 as the surface levels: the lip keeps descending at the true slope
  // (sandTy + sandThick) until it lands on the same BODY_BASE-1.
  const thick =
    a.periodTiles === 1 && a.latTilesY === 1
      ? a.sandThick
      : Math.min(BODY_BASE - 1, sandTy(a, gx) + fShift + a.sandThick - 1) - ty + 1;
  const rel = gy - ty;
  if (rel >= 0 && rel < thick) {
    const c = sandSurface(gx, gy, rel, thick);
    if (gx >= 6 * sc) return c;
    // runout fade (west of 6·sc): the levelled surface dissolves into plain
    // ground toward the west exit — the back line softens to `sandShade`
    // then breaks up, and the lit lip crumbles into flecks — so the walker
    // steps off onto bare sandFill with no hard tail edge.
    if (c === "umber") {
      if (gx >= 4 * sc) return "umber";
      if (gx >= 2 * sc) return "sandShade";
      return hh(gx, gy, 33) > 0.5 ? "sandShade" : "sand";
    }
    if (c === "sandLight") return hh(gx, gy, 33) < 0.12 + (gx / sc) * 0.15 ? "sandLight" : "sand";
    if (c === "sandShade" && gx <= 2 * sc - 1 && hh(gx, gy, 47) > 0.5) return "sand";
    return c;
  }
  const lipY = ty + thick - 1;
  // Where the mass still stands proud of the base line it carries the full
  // rock-body + contact treatment; the levelled runout west of it rests ON
  // the sand with just the 1px under-lip shadow. At the 16px-drop angles
  // the proud region starts at the shipped 6·sc; at 63.43° the incline
  // levels much later (its lip only meets BODY_BASE-1 at gx 24, inside the
  // foot column), so the threshold moves there.
  const rockFrom = a.latTilesY === 1 ? 6 * sc : 24;
  if (gx >= rockFrom) {
    // Draw solid rock from the incline down to the flat ground contact (BODY_BASE)
    if (gy > lipY && gy < BODY_BASE) return rockPx(rock, gx, gy);
    if (gy === BODY_BASE) return "stoneDeep"; // ground-contact line
    if (gy === BODY_BASE + 1) return "sandShade"; // cast shadow on the sand
  } else if (gx >= 2 * sc && gy === lipY + 1) {
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

/** The topmost run piece, beside the landing (45°: the single run column at
 *  k=1; 26.57°: the B column at k=1). Stone keeps the plain solid band;
 *  sand eases its uphill back edge up onto the landing (`easeFrom`/`easeYs`)
 *  and drops the back outline where the band meets the tile top. */
function runTopCell(
  a: AngleSpec,
  material: DiagonalMaterial,
  rock: PixelGrid,
  gx: number,
  gy: number
): Cell {
  if (material === "stoneSteps") {
    // Stone steps just use the normal runCell behavior (steps are good)
    return runSolidCell(a, material, rock, gx, gy);
  }
  if (a.latTilesY > 1) {
    // sandSlope, 2-tall period (63.43°): only the tile-0 slice of this
    // column differs from the plain band (the ease region is rows 0..7),
    // so anchor the eased surface to the pulled-up back edge but keep the
    // band's BOTTOM on the plain incline — the runMid/runLower/runLowest
    // slices below this piece use the plain sampler, and the band families
    // line up across the slice seam by construction.
    const plainTy = sandTy(a, gx);
    let yU = plainTy;
    if (gx >= a.easeFrom && gx - a.easeFrom < a.easeYs.length) {
      yU = Math.min(a.easeYs[gx - a.easeFrom], plainTy);
    }
    if (gy < yU) return null;
    const thick = plainTy + a.sandThick - yU;
    const rel = gy - yU;
    if (rel < thick) return sandSurface(gx, gy, rel, thick, yU === 0);
    return runSolidCell(a, material, rock, gx, gy);
  }
  // sandSlope
  let y_uphill = sandTy(a, gx);
  if (gx >= a.easeFrom) y_uphill = a.easeYs[gx - a.easeFrom];

  const y_downhill = sandTy(a, gx) + a.sandThick; // pure linear downhill edge for runTop (curves in capTop only)

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

/** The landing tile's west-edge blend: the head of the band continuing east
 *  under the landing (its global frame starts one period east of runTop —
 *  gx + 16·periodTiles). Stone shows step 0's tread/riser over rock in the
 *  first tread-width; sand curves the plateau surface's downhill lip from
 *  the incline's entry down onto the cap roll (linear continuation of the
 *  incline lip, clamped at row 8) over a 4px shaded rim. Transparent
 *  further east, letting the landing autotile show through. */
function capTopCell(
  a: AngleSpec,
  material: DiagonalMaterial,
  rock: PixelGrid,
  gx: number,
  gy: number
): Cell {
  if (material === "stoneSteps") {
    if (gx >= a.run) return null; // transparent on the right, letting the landing autotile show through
    const globalGx = gx + T * a.periodTiles;
    const c = runCell(a, material, globalGx, gy);
    if (c !== null) return c;
    // Rock body below the Step 0 riser (63.43°'s 8px riser bottoms out 2px
    // into the tile BELOW the landing — capTopLower — so the fill extends
    // through the second tile of the 2-tall period)
    const base = stoneTy(a, globalGx) + stoneThick(a) - 1;
    if (gy > base && gy < T * a.latTilesY) return rockPx(rock, gx, gy);
    return null;
  }
  // sandSlope
  if (gx >= 12) return null; // transparent on the right, letting landing show through
  // The incline lip's linear continuation into the landing tile, clamped at
  // the cap-roll row 8. (At 45° this is the shipped
  // [15,14,13,12,11,10,9,8,8,8,8,8] table.)
  const y_downhill = Math.max(8, sandTy(a, gx + T * a.periodTiles) + a.sandThick);
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
  // 63.43°: the twice-as-steep incline's lip enters the landing tile up to
  // 10px below its top, so the curved cap surface + rim spill into the
  // tile below (capTopLower) — extend the rock fill through the period.
  if (gy < T * a.latTilesY) return rockPx(rock, gx, gy);
  return null;
}

/**
 * The overlay pieces of a diagonal flight for one material, direction and
 * angle (see file header for the stamp lattice; the top landing is a real
 * plateau cell drawn by the map's own autotiler, but capTop overwrites its
 * left/right edge to blend the transition smoothly). 45° emits its shipped
 * eight pieces; 26.57° emits fourteen — the two-column period (runA/runB +
 * lowers), runTop/capTop, and the four-column base block (footA/footB +
 * groundA/groundB + lowers); 63.43° emits eleven — the four vertical run
 * slices + runTop, the two-column base block, and the 2-tall head blend
 * (capTop + capTopLower).
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
  p: DiagonalRampParams,
  angle: DiagonalAngle = "45"
): { piece: DiagonalPiece; grid: PixelGrid }[] {
  const a = ANGLES[angle];
  // The flight's support body — the same rock the cliff face / straight
  // ramp walls use, so the whole solid mass reads as the same stone and is
  // pixel-identical to the face autotile wherever it is over the cliff.
  const rock = wallFace("rock", RAMP_WALL_PARAMS, p.seed);
  const run = (gx: number, gy: number): Cell => runSolidCell(a, material, rock, gx, gy);
  const runTop = (gx: number, gy: number): Cell => runTopCell(a, material, rock, gx, gy);
  const fc = (gx: number, gy: number): Cell => footCell(a, material, rock, gx, gy);
  const ct = (gx: number, gy: number): Cell => capTopCell(a, material, rock, gx, gy);
  const pieces: { piece: DiagonalPiece; grid: PixelGrid }[] =
    a.latTilesY > 1
      ? [
          // 63.43° — the 2-tall period's four vertical band slices per
          // column (the 20px stone / 27px sand band descends 32px per
          // 16px column, spanning rows 6..49 / 1..57 of the column
          // frame), the eased top slice, the 2-column [ground|foot] base
          // block, and the 2-tall head blend (capTop + capTopLower).
          { piece: "run", grid: sliceTile(run, 0, 0) },
          { piece: "runMid", grid: sliceTile(run, 0, T) },
          { piece: "runLower", grid: sliceTile(run, 0, 2 * T) },
          { piece: "runLowest", grid: sliceTile(run, 0, 3 * T) },
          { piece: "runTop", grid: sliceTile(runTop, 0, 0) },
          { piece: "foot", grid: sliceTile(fc, T, 0) },
          { piece: "footLower", grid: sliceTile(fc, T, T) },
          { piece: "ground", grid: sliceTile(fc, 0, 0) },
          { piece: "groundLower", grid: sliceTile(fc, 0, T) },
          { piece: "capTop", grid: sliceTile(ct, 0, 0) },
          { piece: "capTopLower", grid: sliceTile(ct, 0, T) },
        ]
      : a.periodTiles === 1
      ? [
          { piece: "run", grid: sliceTile(run, 0, 0) },
          { piece: "runLower", grid: sliceTile(run, 0, T) },
          { piece: "runTop", grid: sliceTile(runTop, 0, 0) },
          { piece: "foot", grid: sliceTile(fc, T, 0) },
          { piece: "footLower", grid: sliceTile(fc, T, T) },
          { piece: "ground", grid: sliceTile(fc, 0, 0) },
          { piece: "groundLower", grid: sliceTile(fc, 0, T) },
          { piece: "capTop", grid: sliceTile(ct, 0, 0) },
        ]
      : [
          { piece: "runA", grid: sliceTile(run, 0, 0) },
          { piece: "runB", grid: sliceTile(run, T, 0) },
          { piece: "runALower", grid: sliceTile(run, 0, T) },
          { piece: "runBLower", grid: sliceTile(run, T, T) },
          { piece: "runTop", grid: sliceTile(runTop, T, 0) },
          { piece: "footA", grid: sliceTile(fc, 2 * T, 0) },
          { piece: "footB", grid: sliceTile(fc, 3 * T, 0) },
          { piece: "footALower", grid: sliceTile(fc, 2 * T, T) },
          { piece: "footBLower", grid: sliceTile(fc, 3 * T, T) },
          { piece: "groundA", grid: sliceTile(fc, 0, 0) },
          { piece: "groundB", grid: sliceTile(fc, T, 0) },
          { piece: "groundALower", grid: sliceTile(fc, 0, T) },
          { piece: "groundBLower", grid: sliceTile(fc, T, T) },
          { piece: "capTop", grid: sliceTile(ct, 0, 0) },
        ];
  return dir === "sw" ? pieces.map(({ piece, grid }) => ({ piece, grid: grid.mirrorX() })) : pieces;
}
