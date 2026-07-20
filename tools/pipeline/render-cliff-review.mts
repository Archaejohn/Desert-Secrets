/**
 * Task 9 — visual-review render (run: `npx tsx tools/pipeline/render-cliff-review.mts`).
 *
 * Writes two PNGs into `tools/pipeline/.review/` (gitignored) for a human to
 * eyeball before the sheet hash is pinned in Task 10:
 *
 *   1. `cliff-sheet.png`  — the whole `buildAssets().cliff` sheet, upscaled x6
 *      (nearest-neighbor) so every 16x16 tile is inspectable.
 *   2. `cliff-scene.png`  — an assembled demo scene (ported from the prototype
 *      `drawScene`, docs/prototypes/cliff-suite-v6.html:754-806), upscaled x5:
 *        - a `sandFill` ground field,
 *        - a raised plateau whose top surface uses the `sandPlateau_<mask>`
 *          tiles (8-neighbor mask per cell -> canonical -> lookup),
 *        - the plateau's south edge rendered with the directional cliff set
 *          (rim / face x cliffHeight / footer), variant chosen exactly as the
 *          prototype's south-edge loop (outerW/outerE/innerW/innerE/mid),
 *        - a deliberate opening (gateway) in the south wall, framed on its top
 *          corners by the inner-W / inner-E variants,
 *        - a separate low sand-over-sand ledge (`sandSand_<mask>`) to show the
 *          subtle walk-over elevation.
 *
 * This is a throwaway inspection script, NOT part of the deterministic build —
 * it imports the same generators the build uses, so what you see is what the
 * pinned sheet will contain.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { PixelGrid } from "./src/grid";
import { encodePng } from "./src/png";
import { buildAssets } from "./src/assets";
import { generateTerrain } from "./src/cliffs/generate";
import { DESERT_PRESETS, ICE_PRESETS, REEF_PRESETS, LAVA_PRESETS } from "./src/cliffs/presets";
import { canonical } from "./src/cliffs/blob47";
import { diagonalFlightTiles, type DiagonalMaterial, type DiagonalPiece } from "./src/cliffs/diagonalRamps";
import { TERRAIN_RAMPS } from "./src/cliffs/palette";

const T = 16; // tile size

/** Nearest-neighbor upscale by integer factor `s`. */
function upscale(src: PixelGrid, s: number): PixelGrid {
  const out = new PixelGrid(src.width * s, src.height * s);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      out.rect(x * s, y * s, s, s, c);
    }
  }
  return out;
}

// Render the shipped desert + ice presets.
const base = DESERT_PRESETS[0];
const VARIANTS: { label: string; params: typeof base }[] = [
  { label: "desert", params: DESERT_PRESETS[0] },
  { label: "ice", params: ICE_PRESETS[0] },
  { label: "reef", params: REEF_PRESETS[0] },
  { label: "lava", params: LAVA_PRESETS[0] },
];

// ---- demo scene ----------------------------------------------------------
// Widened (Task 4) to fit three ramp demonstrations cut into standalone
// plateau blocks east of the original gateway arch — see the ramp block
// comments below for exact column/row layout.
const MW = 48;
const MH = 40;

// Plateau bitmap (deterministic, hand-authored). A "gateway" mass: a crossbar
// across the top joined to two legs, leaving a 2-tile-wide OPENING (cols 10,11)
// in the middle of the south wall. The crossbar underside over the opening is
// framed by inner-W (col 10) and inner-E (col 11); the legs descend on either
// side and their bottoms are outer corners; the opening floor (ground) shows
// below the arch.
const P: boolean[][] = Array.from({ length: MH }, () => new Array<boolean>(MW).fill(false));
const fill = (x0: number, y0: number, x1: number, y1: number): void => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P[y][x] = true;
};
fill(4, 3, 17, 5); // crossbar (spans the full width, over the opening)
fill(4, 6, 9, 10); // left leg
fill(12, 6, 17, 10); // right leg

// Task 4 — ramp demonstrations. Each is a standalone plateau block whose
// ramp column(s) are EXCLUDED from P (same trick as the gateway opening
// above), so the existing south-edge loop below skips them and gives the
// flanking columns ordinary outer-corner cliff tiles for free; the ramp
// tiles themselves are stamped into the resulting gap afterward, in
// `buildScene`, once the tile-name map exists.
//
// (a) sandSlope, 2-wide (`leftEdge` col 28 / `rightEdge` col 29), cut
//     through a 10-wide x 2-deep cap (rows 4-5, rim row 5).
fill(24, 4, 33, 5);
P[4][28] = P[4][29] = false;
P[5][28] = P[5][29] = false;

// (b) stoneSteps, 1-wide (`narrow` col 40), same shape, cap rows 4-5.
fill(36, 4, 45, 5);
P[4][40] = false;
P[5][40] = false;

// (c) switchback cap — flight 1 (`leftEdge`, col 28) and flight 2
//     (`rightEdge`, col 29, one tile east) again, but at rows 11-12
//     (below block (a), no collision since the rows don't overlap). The
//     south-edge loop gives this a standard cliffHeight-deep flank wall;
//     `buildScene` extends it to match the switchback's taller drop.
fill(24, 11, 33, 12);
P[11][28] = P[11][29] = false;
P[12][28] = P[12][29] = false;

// (d) diagonal flight demo — a plateau block whose south face TWO diagonal
// flights descend (stoneSteps east, sandSlope west). NO gap cut in P: the
// south-edge loop draws the full rim/face/footer and the flight pieces are
// composited over that real autotiling in `buildScene` step 6 (their solid
// rock body ≡ face by construction over the cliff, and a full support
// wedge past the cliff base). Each flight's TOP LANDING is a real plateau
// cell: P extends one cell south at the flight's head column, so the
// ordinary plateau + rim loops draw the landing (plateau fill, cap roll,
// corner rounding, its own wall/footer) with the standard treatment —
// "the top landing is just an extension of the plateau".
fill(1, 11, 10, 13);
P[14][9] = true; // stone flight's landing (head col 9)
P[14][4] = true; // sand flight's landing (head col 4)

// (e) SHALLOW (26.57°) diagonal flight demo — same model as (d) at half
// slope: the run period is TWO tiles wide (`runB` beside the landing,
// `runA` west of it) and the support cascade shortens one tile every TWO
// tiles across. Block rows 20-22 (rim row 22, faces 23-24, footer 25);
// each flight spans 7 columns (c0-6..c0). Landings protrude at row 23,
// drawn by the ordinary plateau/rim loops exactly like (d)'s.
fill(1, 20, 18, 22);
P[23][17] = true; // stone flight's landing (head col 17)
P[23][8] = true; // sand flight's landing (head col 8)

// (f) STEEP (63.43°) diagonal flight demo — same model at double slope:
// the run period is 1 tile wide × TWO tiles TALL (cell(gx+16, gy-32) ===
// cell(gx, gy)), so each column carries FOUR band slices and the support
// cascade shortens TWO tiles per column (1-left-per-2-down). The preset's
// 2-row cliff is too shallow for a whole 2-tall period, so this block's
// wall is extended to D=5 face rows (rim row 31, faces 32-36, footer 37,
// cascade footers 38) in `buildScene` step 8, the same trick as the
// switchback (c). Landings protrude at row 32, drawn by the ordinary
// plateau/rim loops exactly like (d)'s.
fill(1, 29, 15, 31);
P[32][12] = true; // stone flight's landing (head col 12)
P[32][5] = true; // sand flight's landing (head col 5)

const p = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < MW && y < MH && P[y][x];

// Sand-over-sand ledge (low walk-over elevation) — a small blob in open
// ground, clear of the plateau and its footer, bottom-right foreground.
const L: boolean[][] = Array.from({ length: MH }, () => new Array<boolean>(MW).fill(false));
for (let y = 12; y <= 14; y++) for (let x = 18; x <= 21; x++) L[y][x] = true;
const g = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < MW && y < MH && L[y][x];

const VARIANT = ["outerW", "mid", "outerE", "innerW", "innerE"] as const;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Assemble the demo scene from one variant's generated tile set. */
function buildScene(params: typeof base): PixelGrid {
  const tiles = new Map<string, PixelGrid>();
  for (const { name, grid } of generateTerrain(params)) tiles.set(name, grid);
  const tile = (name: string): PixelGrid => {
    const t = tiles.get(name);
    if (!t) throw new Error(`missing tile: ${name}`);
    return t;
  };
  const H = params.cliffHeight;
  const scene = new PixelGrid(MW * T, MH * T);
  const blit = (name: string, x: number, y: number): void => scene.blit(tile(name), x * T, y * T);

  // Preset-derived tile-name prefixes (Task 7) — desert stays `sandFill` /
  // `sandPlateau_` / `sandSand_` / `cliffRock_`; ice becomes `iceFill` /
  // `icePlateau_` / `iceIce_` / `cliffGlacier_`.
  const groundFill = `${params.ground}Fill`;
  const plateau = (m: number): string => `${params.plateauTop}Plateau_${m}`;
  const pairSelf = (m: number): string => `${params.plateauTop}${cap(params.plateauTop)}_${m}`;
  const cliff = (v: string, band: string): string => `cliff${cap(params.material)}_${v}_${band}`;
  const groundRamp = TERRAIN_RAMPS[params.plateauTop];

  // 1) ground field everywhere.
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) blit(groundFill, x, y);

  // 2) sand-over-sand ledge (subtle low elevation) — 8-neighbor blob mask.
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      if (!g(x, y)) continue;
      let m = 0;
      if (g(x, y - 1)) m |= 1;
      if (g(x + 1, y - 1)) m |= 2;
      if (g(x + 1, y)) m |= 4;
      if (g(x + 1, y + 1)) m |= 8;
      if (g(x, y + 1)) m |= 16;
      if (g(x - 1, y + 1)) m |= 32;
      if (g(x - 1, y)) m |= 64;
      if (g(x - 1, y - 1)) m |= 128;
      blit(pairSelf(canonical(m)), x, y);
    }
  }

  // 3) plateau top surface — south side forced "matching" (cliff rim owns it).
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      if (!p(x, y)) continue;
      let m = 0;
      if (p(x, y - 1)) m |= 1;
      if (p(x + 1, y - 1)) m |= 2;
      if (p(x + 1, y)) m |= 4;
      if (p(x - 1, y)) m |= 64;
      if (p(x - 1, y - 1)) m |= 128;
      m |= 16;
      if (m & 4) m |= 8;
      if (m & 64) m |= 32;
      blit(plateau(canonical(m)), x, y);
    }
  }

  // 4) south-edge cliff set — rim / face x cliffHeight / footer, per variant.
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      if (!p(x, y) || p(x, y + 1)) continue;
      const wOpen = !p(x - 1, y);
      const eOpen = !p(x + 1, y);
      const wIn = p(x - 1, y) && p(x - 1, y + 1);
      const eIn = p(x + 1, y) && p(x + 1, y + 1);
      const v = wOpen ? 0 : eOpen ? 2 : wIn ? 3 : eIn ? 4 : 1;
      const variant = VARIANT[v];
      blit(cliff(variant, "rim"), x, y);
      for (let k = 1; k <= H; k++) if (y + k < MH) blit(cliff(variant, "face"), x, y + k);
      if (y + H + 1 < MH) blit(cliff(variant, "footer"), x, y + H + 1);
    }
  }

  // 5) ramp demonstrations (Task 4) — stamp ramp tiles into the gaps cut
  // into P above; the flanking cliff on either side was already drawn by
  // the south-edge loop above (step 4), since those columns are still in P.

  /** Straight ramp: `top` at the rim row `y0`, `run` x `H` below it, `bottom`
   *  at the footer row `y0+H+1`. Used for demos (a) and (b). */
  const stampStraightRamp = (name: string, col: number, y0: number): void => {
    blit(`${name}_top`, col, y0);
    for (let k = 1; k <= H; k++) blit(`${name}_run`, col, y0 + k);
    blit(`${name}_bottom`, col, y0 + H + 1);
  };

  // (a) sandSlope, 2-wide: leftEdge (col 28) + rightEdge (col 29), rim row 5.
  stampStraightRamp("rampSand_leftEdge", 28, 5);
  stampStraightRamp("rampSand_rightEdge", 29, 5);

  // (b) stoneSteps, 1-wide: narrow (col 40), rim row 5.
  stampStraightRamp("rampSteps_narrow", 40, 5);

  // (c) switchback (sandSlope): flight 1 descends col 28 (leftEdge) from the
  // rim (row 12) through `run` x H into the `landing`; flight 2 picks up the
  // (same-row) landing one tile east at col 29 (rightEdge), runs x H, then
  // reaches `bottom` — the offset column read as the turn, the shared
  // landing row as the flat platform bridging it.
  {
    const y0 = 12; // rim row (matches the cap's south edge, row 12)
    const colA = 28, colB = 29;
    blit("rampSand_leftEdge_top", colA, y0);
    for (let k = 1; k <= H; k++) blit("rampSand_leftEdge_run", colA, y0 + k);
    const landingY = y0 + H + 1;
    blit("rampSand_leftEdge_landing", colA, landingY);
    blit("rampSand_rightEdge_landing", colB, landingY);
    for (let k = 1; k <= H; k++) blit("rampSand_rightEdge_run", colB, landingY + k);
    blit("rampSand_rightEdge_bottom", colB, landingY + H + 1);

    // Cavity fill: at flight 1's height (y0..y0+H), col B is the *inactive*
    // lane (flight 2 hasn't started yet) — without solid rock there it reads
    // as one open 2-wide slot for the whole drop instead of a staggered
    // zigzag. Wall it off with ordinary cliff tiles (rim at the same height
    // as the flank rim, face below), mirrored below the landing at col A
    // for flight 2's height (landingY+1..landingY+H+1, footer at the foot).
    blit(cliff("mid", "rim"), colB, y0);
    for (let k = 1; k <= H; k++) blit(cliff("mid", "face"), colB, y0 + k);
    for (let k = 1; k <= H; k++) blit(cliff("mid", "face"), colA, landingY + k);
    blit(cliff("mid", "footer"), colA, landingY + H + 1);

    // The south-edge loop (step 4) already drew a standard cliffHeight-deep
    // flank wall for the cap's non-gap columns (rim @ y0, face x H, footer
    // @ y0+H+1) — the same depth as demos (a)/(b). The switchback drops
    // twice as far (2H + 3 rows total), so extend that flank wall to match:
    // replace its now-too-shallow footer with more face rows, then add a
    // new footer at the switchback's actual foot. Variants match what the
    // step-4 loop already chose for each column (recomputable from P, but
    // pinned here since this block's shape is fixed/hand-authored).
    const FLANK_VARIANT: Record<number, "outerW" | "mid" | "outerE"> = {
      24: "outerW", 25: "mid", 26: "mid", 27: "outerE",
      30: "outerW", 31: "mid", 32: "mid", 33: "outerE",
    };
    const staleFooterY = y0 + H + 1; // where step 4 put the flank footer
    for (const [xs, variant] of Object.entries(FLANK_VARIANT)) {
      const x = Number(xs);
      blit(cliff(variant, "face"), x, staleFooterY);
      for (let k = 1; k <= H; k++) blit(cliff(variant, "face"), x, landingY + k);
      blit(cliff(variant, "footer"), x, landingY + H + 1);
    }
  }

  // 6) DIAGONAL flight demos — 45° flights descending the south face of the
  // block at rows 11-13 (rim row 13, faces 14-15, footer 16). The top
  // landing is the protruding plateau cell added to P above (drawn by the
  // ordinary plateau/rim loops — steps 3 and 4); the flight pieces stamp on
  // the lattice west of it, each carrying the walking band plus the
  // flight's solid rock body (pixel-identical to the face autotile over the
  // cliff). At the base the flight PROJECTS past the footer onto the
  // ground: `foot`/`footLower` walk the band over the footer's contact
  // line, and `ground`/`groundLower` (one more lattice cell down-left) land
  // the final steps on a full support wedge standing on the sand. See
  // diagonalRamps.ts for the piece/lattice model.
  const stampDiagonalFlight = (material: DiagonalMaterial, c0: number, y0: number): void => {
    const pieces = new Map(
      diagonalFlightTiles(material, "se", { seed: params.seed }, "45", groundRamp, params.material).map((t) => [t.piece, t.grid])
    );
    const put = (piece: DiagonalPiece, x: number, y: number): void =>
      scene.blit(pieces.get(piece)!, x * T, y * T);
    scene.blit(tile(cliff("outerE", "rim")), c0 * T, (y0 + 1) * T);
    put("capTop", c0, y0 + 1);
    for (let y = y0 + 2; y <= y0 + H + 1; y++) {
      scene.blit(tile(cliff("outerE", "face")), c0 * T, y * T);
    }
    scene.blit(tile(cliff("outerE", "footer")), c0 * T, (y0 + H + 2) * T);

    for (let k = 1; k <= H; k++) {
      const runPiece = k === 1 ? "runTop" : "run";
      const runLowerPiece = k === H ? "foot" : "runLower";
      put(runPiece, c0 - k, y0 + k);
      put(runLowerPiece, c0 - k, y0 + k + 1);
      if (k < H) {
        for (let y = y0 + k + 2; y <= y0 + H + 1; y++) {
          scene.blit(tile(cliff("mid", "face")), (c0 - k) * T, y * T);
        }
        const footerName = k === H - 1 ? cliff("outerW", "footer") : cliff("mid", "footer");
        scene.blit(tile(footerName), (c0 - k) * T, (y0 + H + 2) * T);
      }
    }
    put("footLower", c0 - H, y0 + H + 2);
    put("ground", c0 - H - 1, y0 + H + 1);
    put("groundLower", c0 - H - 1, y0 + H + 2);
  };
  stampDiagonalFlight("stoneSteps", 9, 13); // stone flight: top col 9 → foot col 7
  stampDiagonalFlight("sandSlope", 4, 13); // sand flight: top col 4 → foot col 2

  // 7) SHALLOW (26.57°) diagonal flight demos — the same cascade model at
  // half slope. Two differences from step 6, both direct consequences of
  // the 2-tile-wide lattice period (cell(gx+32, gy-16) === cell(gx, gy)):
  //   - each face row k carries a PAIR of run tiles (`runB` east, `runA`
  //     west — `runTop` is the eased runB beside the landing), so the
  //     cascade's support wall shortens one tile every TWO tiles across;
  //   - the projected base is a 4-column block (footB/footA over the
  //     cascade's own footer line, then groundB/groundA standing on the
  //     sand), instead of 45°'s 2-column foot/ground pair.
  const stampDiagonalFlightShallow = (material: DiagonalMaterial, c0: number, y0: number): void => {
    const pieces = new Map(
      diagonalFlightTiles(material, "se", { seed: params.seed }, "26.57", groundRamp, params.material).map((t) => [t.piece, t.grid])
    );
    const put = (piece: DiagonalPiece, x: number, y: number): void =>
      scene.blit(pieces.get(piece)!, x * T, y * T);
    scene.blit(tile(cliff("outerE", "rim")), c0 * T, (y0 + 1) * T);
    put("capTop", c0, y0 + 1);
    for (let y = y0 + 2; y <= y0 + H + 1; y++) {
      scene.blit(tile(cliff("outerE", "face")), c0 * T, y * T);
    }
    scene.blit(tile(cliff("outerE", "footer")), c0 * T, (y0 + H + 2) * T);

    for (let k = 1; k <= H; k++) {
      const xB = c0 - 2 * k + 1; // east tile of pair k (beside the previous pair)
      const xA = c0 - 2 * k; // west tile of pair k
      put(k === 1 ? "runTop" : "runB", xB, y0 + k);
      put("runA", xA, y0 + k);
      put(k === H ? "footB" : "runBLower", xB, y0 + k + 1);
      put(k === H ? "footA" : "runALower", xA, y0 + k + 1);
      if (k < H) {
        for (const x of [xB, xA]) {
          for (let y = y0 + k + 2; y <= y0 + H + 1; y++) {
            scene.blit(tile(cliff("mid", "face")), x * T, y * T);
          }
        }
        scene.blit(tile(cliff("mid", "footer")), xB * T, (y0 + H + 2) * T);
        const footerA = k === H - 1 ? cliff("outerW", "footer") : cliff("mid", "footer");
        scene.blit(tile(footerA), xA * T, (y0 + H + 2) * T);
      }
    }
    put("footBLower", c0 - 2 * H + 1, y0 + H + 2);
    put("footALower", c0 - 2 * H, y0 + H + 2);
    put("groundB", c0 - 2 * H - 1, y0 + H + 1);
    put("groundBLower", c0 - 2 * H - 1, y0 + H + 2);
    put("groundA", c0 - 2 * H - 2, y0 + H + 1);
    put("groundALower", c0 - 2 * H - 2, y0 + H + 2);
  };
  stampDiagonalFlightShallow("stoneSteps", 17, 22); // stone: top col 17 → walk-off col 11
  stampDiagonalFlightShallow("sandSlope", 8, 22); // sand: top col 8 → runout col 2

  // 8) STEEP (63.43°) diagonal flight demos — the same cascade model at
  // double slope. Differences from step 6, all consequences of the
  // 1-wide × 2-TALL lattice period (cell(gx+16, gy-32) === cell(gx, gy)):
  //   - each column carries FOUR vertical band slices (run/runMid/
  //     runLower/runLowest — the 20px stone / 27px sand band descends 32px
  //     across a 16px column), and the cascade's support wall shortens TWO
  //     tiles per column (1-left-per-2-down);
  //   - the head blend is 2-tall too (capTop + capTopLower: the 8px step-0
  //     riser / the steep incline's cap roll spill below the landing tile);
  //   - the terminal compresses: the band crosses the footer contact AND
  //     lands its final riser on the ground line inside the ONE foot
  //     column (plus a plain `run` slice above it on the last face row);
  //     the ground column is just the walk-off (stone) / levelled runout
  //     fade (sand).
  // The preset wall (H=2) can't fit a whole 2-tall period, so the block's
  // south wall is first extended to D = 2K+1 = 5 face rows (K=2 run
  // columns), footer row 37 — the switchback-(c) trick, variants matching
  // what the step-4 loop chose from P (innerW/innerE frame the protruding
  // landings).
  {
    const y0s = 31; // block (f) rim row
    const Ds = 5; // extended face depth = 2K+1
    const Fs = y0s + Ds + 1; // main footer row (37)
    const STEEP_FLANK: Record<number, string> = {
      1: "outerW", 2: "mid", 3: "mid", 4: "innerE",
      6: "innerW", 7: "mid", 8: "mid", 9: "mid", 10: "mid", 11: "innerE",
      13: "innerW", 14: "mid", 15: "outerE",
    };
    for (const [xs, variant] of Object.entries(STEEP_FLANK)) {
      const x = Number(xs);
      // step 4 drew rim@31, faces 32-33, footer 34 — deepen to Ds faces
      for (let y = y0s + H + 1; y <= y0s + Ds; y++) {
        scene.blit(tile(cliff(variant, "face")), x * T, y * T);
      }
      scene.blit(tile(cliff(variant, "footer")), x * T, Fs * T);
    }
  }
  const stampDiagonalFlightSteep = (material: DiagonalMaterial, c0: number, y0: number): void => {
    const pieces = new Map(
      diagonalFlightTiles(material, "se", { seed: params.seed }, "63.43", groundRamp, params.material).map((t) => [t.piece, t.grid])
    );
    const put = (piece: DiagonalPiece, x: number, y: number): void =>
      scene.blit(pieces.get(piece)!, x * T, y * T);
    const K = 2; // run columns (2 face rows each)
    const D = 2 * K + 1; // face depth below the rim
    const F = y0 + D + 1; // main footer row
    // landing wall — outerE rim/faces/footer one tile south of the main
    // wall's, then the head blend over its top two tiles
    scene.blit(tile(cliff("outerE", "rim")), c0 * T, (y0 + 1) * T);
    for (let y = y0 + 2; y <= F; y++) {
      scene.blit(tile(cliff("outerE", "face")), c0 * T, y * T);
    }
    scene.blit(tile(cliff("outerE", "footer")), c0 * T, (F + 1) * T);
    put("capTop", c0, y0 + 1);
    put("capTopLower", c0, y0 + 2);

    for (let k = 1; k <= K; k++) {
      const x = c0 - k;
      // cascade support wall under the band — two tiles shorter per
      // column, every footer on the same base row (F+1)
      for (let y = y0 + 2 * k + 3; y <= F; y++) {
        scene.blit(tile(cliff("mid", "face")), x * T, y * T);
      }
      const footerName = k === K ? cliff("outerW", "footer") : cliff("mid", "footer");
      scene.blit(tile(footerName), x * T, (F + 1) * T);
      put(k === 1 ? "runTop" : "run", x, y0 + 2 * k - 1);
      put("runMid", x, y0 + 2 * k);
      put("runLower", x, y0 + 2 * k + 1);
      put("runLowest", x, y0 + 2 * k + 2);
    }
    // foot column: a plain run slice on the last face row, then the band
    // crossing the footer + landing its final riser on the ground line
    put("run", c0 - K - 1, F - 1);
    put("foot", c0 - K - 1, F);
    put("footLower", c0 - K - 1, F + 1);
    // ground column: walk-off (stone) / levelled runout fade (sand)
    put("ground", c0 - K - 2, F);
    put("groundLower", c0 - K - 2, F + 1);
  };
  stampDiagonalFlightSteep("stoneSteps", 12, 31); // stone: top col 12 → foot col 9
  stampDiagonalFlightSteep("sandSlope", 5, 31); // sand: top col 5 → runout col 1

  // 9) REEF ground-transition demo — three small organic patches of
  // reefSilt / reefWater / glowMoss sitting in the open reefFloor field
  // (cols ~24-42, rows ~20-35 — clear of every cliff/ramp/stair demo
  // above), each seam autotiled by the preset's reefFloor<Base> pairing
  // blob set (mirrors the sand-over-sand ledge / plateau-top blob code in
  // steps 2-3: patch cells get the flat `<base>Fill`, bordering reefFloor
  // cells get the blended edge tile keyed by an 8-neighbor "is this
  // neighbor reefFloor" mask). Biome-guarded: only the reef preset has
  // these grounds, so desert/ice presets skip this block entirely and
  // keep rendering their scene unchanged.
  if (params.pairings.some((pr) => pr.base === "reefSilt")) {
    type PatchBase = "reefSilt" | "reefWater" | "glowMoss";
    const patches: { base: PatchBase; cells: [number, number][] }[] = [
      // reefSilt — small diamond-ish silt bed.
      {
        base: "reefSilt",
        cells: [
          [28, 22], [29, 22],
          [27, 23], [28, 23], [29, 23], [30, 23],
          [28, 24], [29, 24],
          [28, 25],
        ],
      },
      // reefWater — a slightly larger pond, separated from the silt bed.
      {
        base: "reefWater",
        cells: [
          [36, 23], [37, 23], [38, 23],
          [35, 24], [36, 24], [37, 24], [38, 24], [39, 24],
          [36, 25], [37, 25], [38, 25],
          [37, 26],
        ],
      },
      // glowMoss — a mossy cluster below both, separated from each.
      {
        base: "glowMoss",
        cells: [
          [30, 30], [31, 30], [32, 30],
          [29, 31], [30, 31], [31, 31], [32, 31], [33, 31],
          [30, 32], [31, 32], [32, 32],
          [31, 33],
        ],
      },
    ];
    const patchAt = new Map<string, PatchBase>();
    for (const patch of patches) for (const [x, y] of patch.cells) patchAt.set(`${x},${y}`, patch.base);
    const patchOf = (x: number, y: number): PatchBase | undefined => patchAt.get(`${x},${y}`);

    // Patch interiors — flat fill, exactly like the background groundFill.
    for (const patch of patches) {
      const fillName = `${patch.base}Fill`;
      for (const [x, y] of patch.cells) blit(fillName, x, y);
    }

    // reefFloor cells bordering a patch — blended edge tile. Bounding box
    // covers every patch plus a 1-cell halo; interior reefFloor cells (no
    // patch neighbor) keep the flat groundFill already blitted in step 1.
    for (let y = 19; y <= 34; y++) {
      for (let x = 24; x <= 40; x++) {
        if (patchOf(x, y)) continue;
        const neighborBases = [
          patchOf(x, y - 1), patchOf(x + 1, y - 1), patchOf(x + 1, y), patchOf(x + 1, y + 1),
          patchOf(x, y + 1), patchOf(x - 1, y + 1), patchOf(x - 1, y), patchOf(x - 1, y - 1),
        ];
        const base = neighborBases.find((b): b is PatchBase => !!b);
        if (!base) continue; // no adjacent patch — plain reefFloor interior
        let m = 0;
        if (!patchOf(x, y - 1)) m |= 1;
        if (!patchOf(x + 1, y - 1)) m |= 2;
        if (!patchOf(x + 1, y)) m |= 4;
        if (!patchOf(x + 1, y + 1)) m |= 8;
        if (!patchOf(x, y + 1)) m |= 16;
        if (!patchOf(x - 1, y + 1)) m |= 32;
        if (!patchOf(x - 1, y)) m |= 64;
        if (!patchOf(x - 1, y - 1)) m |= 128;
        blit(`${params.plateauTop}${cap(base)}_${canonical(m)}`, x, y);
      }
    }
  }

  // 10) ICE ground-transition demo — snow / frozenLake / rimeMoss patches in
  // the open ice field, each seam autotiled by the preset's ice<Base> pairings
  // (mirrors the reef block above). Biome-guarded: only the ice preset has
  // these grounds, so desert/reef skip this block entirely.
  if (params.pairings.some((pr) => pr.base === "snow")) {
    type IcePatch = "snow" | "frozenLake" | "rimeMoss";
    const patches: { base: IcePatch; cells: [number, number][] }[] = [
      { base: "snow", cells: [[28, 22], [29, 22], [27, 23], [28, 23], [29, 23], [30, 23], [28, 24], [29, 24], [28, 25]] },
      { base: "frozenLake", cells: [[36, 23], [37, 23], [38, 23], [35, 24], [36, 24], [37, 24], [38, 24], [39, 24], [36, 25], [37, 25], [38, 25], [37, 26]] },
      { base: "rimeMoss", cells: [[30, 30], [31, 30], [32, 30], [29, 31], [30, 31], [31, 31], [32, 31], [33, 31], [30, 32], [31, 32], [32, 32], [31, 33]] },
    ];
    const patchAt = new Map<string, IcePatch>();
    for (const patch of patches) for (const [x, y] of patch.cells) patchAt.set(`${x},${y}`, patch.base);
    const patchOf = (x: number, y: number): IcePatch | undefined => patchAt.get(`${x},${y}`);
    for (const patch of patches) { const fill = `${patch.base}Fill`; for (const [x, y] of patch.cells) blit(fill, x, y); }
    for (let y = 19; y <= 34; y++) {
      for (let x = 24; x <= 40; x++) {
        if (patchOf(x, y)) continue;
        const neighborBases = [
          patchOf(x, y - 1), patchOf(x + 1, y - 1), patchOf(x + 1, y), patchOf(x + 1, y + 1),
          patchOf(x, y + 1), patchOf(x - 1, y + 1), patchOf(x - 1, y), patchOf(x - 1, y - 1),
        ];
        const base = neighborBases.find((b): b is IcePatch => !!b);
        if (!base) continue;
        let m = 0;
        if (!patchOf(x, y - 1)) m |= 1;
        if (!patchOf(x + 1, y - 1)) m |= 2;
        if (!patchOf(x + 1, y)) m |= 4;
        if (!patchOf(x + 1, y + 1)) m |= 8;
        if (!patchOf(x, y + 1)) m |= 16;
        if (!patchOf(x - 1, y + 1)) m |= 32;
        if (!patchOf(x - 1, y)) m |= 64;
        if (!patchOf(x - 1, y - 1)) m |= 128;
        blit(`ice${cap(base)}_${canonical(m)}`, x, y);
      }
    }
  }

  // 11) LAVA ground-transition demo — ash / lava / lavaCrust patches in the open
  // emberRock field, each seam autotiled by the preset's emberRock<Base> pairings
  // (mirrors the reef/ice blocks). Biome-guarded on the ash ground.
  if (params.pairings.some((pr) => pr.base === "ash")) {
    type LavaPatch = "ash" | "lava" | "lavaCrust";
    const patches: { base: LavaPatch; cells: [number, number][] }[] = [
      { base: "ash", cells: [[28, 22], [29, 22], [27, 23], [28, 23], [29, 23], [30, 23], [28, 24], [29, 24], [28, 25]] },
      { base: "lava", cells: [[36, 23], [37, 23], [38, 23], [35, 24], [36, 24], [37, 24], [38, 24], [39, 24], [36, 25], [37, 25], [38, 25], [37, 26]] },
      { base: "lavaCrust", cells: [[30, 30], [31, 30], [32, 30], [29, 31], [30, 31], [31, 31], [32, 31], [33, 31], [30, 32], [31, 32], [32, 32], [31, 33]] },
    ];
    const patchAt = new Map<string, LavaPatch>();
    for (const patch of patches) for (const [x, y] of patch.cells) patchAt.set(`${x},${y}`, patch.base);
    const patchOf = (x: number, y: number): LavaPatch | undefined => patchAt.get(`${x},${y}`);
    for (const patch of patches) { const fill = `${patch.base}Fill`; for (const [x, y] of patch.cells) blit(fill, x, y); }
    for (let y = 19; y <= 34; y++) {
      for (let x = 24; x <= 40; x++) {
        if (patchOf(x, y)) continue;
        const neighborBases = [
          patchOf(x, y - 1), patchOf(x + 1, y - 1), patchOf(x + 1, y), patchOf(x + 1, y + 1),
          patchOf(x, y + 1), patchOf(x - 1, y + 1), patchOf(x - 1, y), patchOf(x - 1, y - 1),
        ];
        const base = neighborBases.find((b): b is LavaPatch => !!b);
        if (!base) continue;
        let m = 0;
        if (!patchOf(x, y - 1)) m |= 1;
        if (!patchOf(x + 1, y - 1)) m |= 2;
        if (!patchOf(x + 1, y)) m |= 4;
        if (!patchOf(x + 1, y + 1)) m |= 8;
        if (!patchOf(x, y + 1)) m |= 16;
        if (!patchOf(x - 1, y + 1)) m |= 32;
        if (!patchOf(x - 1, y)) m |= 64;
        if (!patchOf(x - 1, y - 1)) m |= 128;
        blit(`emberRock${cap(base)}_${canonical(m)}`, x, y);
      }
    }
  }

  return scene;
}

// ---- write outputs -------------------------------------------------------
const outDir = fileURLToPath(new URL("./.review/", import.meta.url));
mkdirSync(outDir, { recursive: true });

const SHEET_SCALE = 6;
const SCENE_SCALE = 5;

const sheet = upscale(buildAssets().cliff, SHEET_SCALE);
const sheetBuf = encodePng(sheet);
const sheetPath = join(outDir, "cliff-sheet.png");
writeFileSync(sheetPath, sheetBuf);
console.log(`cliff-sheet.png -> ${sheetPath} (${sheet.width}x${sheet.height})`);

for (const { label, params } of VARIANTS) {
  const sceneRaw = buildScene(params);
  // Zoomed crop of the diagonal-flight demo block (cols 0-11, rows 10-18) at
  // x10 so the tread/step pixels are individually inspectable.
  {
    const cx0 = 0, cy0 = 10, cw = 12, ch = 9;
    const crop = new PixelGrid(cw * T, ch * T);
    for (let y = 0; y < ch * T; y++) {
      for (let x = 0; x < cw * T; x++) crop.px(x, y, sceneRaw.get(cx0 * T + x, cy0 * T + y));
    }
    const cropUp = upscale(crop, 10);
    const cropPath = join(outDir, `${label}-diag-crop.png`);
    writeFileSync(cropPath, encodePng(cropUp));
    console.log(`${label}-diag-crop.png -> ${cropPath} (${cropUp.width}x${cropUp.height})`);
  }
  // Zoomed crop of the SHALLOW (26.57°) flight demo block (cols 0-19, rows
  // 19-27) at x8.
  {
    const cx0 = 0, cy0 = 19, cw = 20, ch = 9;
    const crop = new PixelGrid(cw * T, ch * T);
    for (let y = 0; y < ch * T; y++) {
      for (let x = 0; x < cw * T; x++) crop.px(x, y, sceneRaw.get(cx0 * T + x, cy0 * T + y));
    }
    const cropUp = upscale(crop, 8);
    const cropPath = join(outDir, `${label}-diag-shallow-crop.png`);
    writeFileSync(cropPath, encodePng(cropUp));
    console.log(`${label}-diag-shallow-crop.png -> ${cropPath} (${cropUp.width}x${cropUp.height})`);
  }
  // Zoomed crop of the STEEP (63.43°) flight demo block (cols 0-16, rows
  // 28-39) at x8.
  {
    const cx0 = 0, cy0 = 28, cw = 17, ch = 12;
    const crop = new PixelGrid(cw * T, ch * T);
    for (let y = 0; y < ch * T; y++) {
      for (let x = 0; x < cw * T; x++) crop.px(x, y, sceneRaw.get(cx0 * T + x, cy0 * T + y));
    }
    const cropUp = upscale(crop, 8);
    const cropPath = join(outDir, `${label}-diag-steep-crop.png`);
    writeFileSync(cropPath, encodePng(cropUp));
    console.log(`${label}-diag-steep-crop.png -> ${cropPath} (${cropUp.width}x${cropUp.height})`);
  }
  // Zoomed crop of the REEF ground-transition demo (cols 23-41, rows
  // 18-35) at x8 — reef preset only, so the seams between reefFloor and
  // the silt/water/moss patches are individually inspectable.
  if (label === "reef") {
    const cx0 = 23, cy0 = 18, cw = 18, ch = 18;
    const crop = new PixelGrid(cw * T, ch * T);
    for (let y = 0; y < ch * T; y++) {
      for (let x = 0; x < cw * T; x++) crop.px(x, y, sceneRaw.get(cx0 * T + x, cy0 * T + y));
    }
    const cropUp = upscale(crop, 8);
    const cropPath = join(outDir, "reef-transitions-crop.png");
    writeFileSync(cropPath, encodePng(cropUp));
    console.log(`reef-transitions-crop.png -> ${cropPath} (${cropUp.width}x${cropUp.height})`);
  }
  const sceneUp = upscale(sceneRaw, SCENE_SCALE);
  // TEMP tile-grid overlay (atbGold at every 16px tile boundary) so placement
  // offsets can be counted by eye.
  const step = T * SCENE_SCALE;
  for (let gy = 0; gy <= MH; gy++) for (let x = 0; x < sceneUp.width; x++) sceneUp.px(x, Math.min(gy * step, sceneUp.height - 1), "atbGold");
  for (let gx = 0; gx <= MW; gx++) for (let y = 0; y < sceneUp.height; y++) sceneUp.px(Math.min(gx * step, sceneUp.width - 1), y, "atbGold");
  const buf = encodePng(sceneUp);
  const path = join(outDir, `${label}-scene.png`);
  writeFileSync(path, buf);
  console.log(`${label}-scene.png -> ${path} (${sceneUp.width}x${sceneUp.height})`);
}
