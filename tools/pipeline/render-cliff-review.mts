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
import { DESERT_PRESETS } from "./src/cliffs/presets";
import { canonical } from "./src/cliffs/blob47";
import { diagonalRunTiles } from "./src/cliffs/diagonalRamps";

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

// Render the shipped desert preset.
const base = DESERT_PRESETS[0];
const VARIANTS: { label: string; params: typeof base }[] = [{ label: "scene", params: base }];

// ---- demo scene ----------------------------------------------------------
// Widened (Task 4) to fit three ramp demonstrations cut into standalone
// plateau blocks east of the original gateway arch — see the ramp block
// comments below for exact column/row layout.
const MW = 48;
const MH = 22;

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

// (d) diagonal ramp demo (A' checkpoint) — a plateau block whose south face a
// diagonal stair descends. NO gap cut in P: the south-edge loop draws the full
// rim/face/footer, and the diagonal ribbon overwrites it (rock ≡ face, treads
// cut in) in `buildScene` step 6.
fill(2, 11, 9, 13);

const p = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < MW && y < MH && P[y][x];

// Sand-over-sand ledge (low walk-over elevation) — a small blob in open
// ground, clear of the plateau and its footer, bottom-right foreground.
const L: boolean[][] = Array.from({ length: MH }, () => new Array<boolean>(MW).fill(false));
for (let y = 12; y <= 14; y++) for (let x = 18; x <= 21; x++) L[y][x] = true;
const g = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < MW && y < MH && L[y][x];

const VARIANT = ["outerW", "mid", "outerE", "innerW", "innerE"] as const;

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

  // 1) ground field everywhere.
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) blit("sandFill", x, y);

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
      blit(`sandSand_${canonical(m)}`, x, y);
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
      blit(`sandPlateau_${canonical(m)}`, x, y);
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
      blit(`cliffRock_${variant}_rim`, x, y);
      for (let k = 1; k <= H; k++) if (y + k < MH) blit(`cliffRock_${variant}_face`, x, y + k);
      if (y + H + 1 < MH) blit(`cliffRock_${variant}_footer`, x, y + H + 1);
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
    blit("cliffRock_mid_rim", colB, y0);
    for (let k = 1; k <= H; k++) blit("cliffRock_mid_face", colB, y0 + k);
    for (let k = 1; k <= H; k++) blit("cliffRock_mid_face", colA, landingY + k);
    blit("cliffRock_mid_footer", colA, landingY + H + 1);

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
      blit(`cliffRock_${variant}_face`, x, staleFooterY);
      for (let k = 1; k <= H; k++) blit(`cliffRock_${variant}_face`, x, landingY + k);
      blit(`cliffRock_${variant}_footer`, x, landingY + H + 1);
    }
  }

  // 6) DIAGONAL ramp demo (A' checkpoint) — stamp the 45° run tile diagonally
  // down the south face of the plateau block (rows 11-13, south edge row 13).
  // The run tile is transparent above its tread, so compositing it over the
  // already-drawn rim/face/footer lets the plateau show above the top tread
  // and the face show above each lower tread; its rock ≡ the face. `se`: top at
  // the east end of the rim (col 7), descending down-left through face→footer.
  {
    const parts = diagonalRunTiles("stoneSteps", "45", { seed: params.seed });
    const runTile = parts.find((t) => t.piece === "run")!.grid;
    const runLower = parts.find((t) => t.piece === "runLower")!.grid;
    const col0 = 7, y0 = 13; // rim cell = plateau south edge
    // Clip the ramp to the footer's ground line (within-tile row 10 of the
    // footer row) so the existing footer/scree autotile shows STRAIGHT across
    // the base underneath — no rock hanging below the cliff into the sand.
    const baseY = (y0 + H + 1) * T + 10;
    const clipBlit = (tile: PixelGrid, cX: number, cY: number): void =>
      tile.forEach((tx, ty, c) => {
        const gy = cY * T + ty;
        if (c !== null && gy < baseY) scene.px(cX * T + tx, gy, c);
      });
    // drop the one-too-high top tile (k=0); keep the rest where they are and add
    // the runLower row one tile below each (the 2-tile-thick ribbon).
    for (let k = 1; k <= H + 1; k++) {
      clipBlit(runTile, col0 - k, y0 + k);
      clipBlit(runLower, col0 - k, y0 + k + 1);
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
  const sceneUp = upscale(buildScene(params), SCENE_SCALE);
  // TEMP tile-grid overlay (atbGold at every 16px tile boundary) so placement
  // offsets can be counted by eye.
  const step = T * SCENE_SCALE;
  for (let gy = 0; gy <= MH; gy++) for (let x = 0; x < sceneUp.width; x++) sceneUp.px(x, Math.min(gy * step, sceneUp.height - 1), "atbGold");
  for (let gx = 0; gx <= MW; gx++) for (let y = 0; y < sceneUp.height; y++) sceneUp.px(Math.min(gx * step, sceneUp.width - 1), y, "atbGold");
  const buf = encodePng(sceneUp);
  const path = join(outDir, `cliff-scene-${label}.png`);
  writeFileSync(path, buf);
  console.log(`cliff-scene-${label}.png -> ${path} (${sceneUp.width}x${sceneUp.height})`);
}
