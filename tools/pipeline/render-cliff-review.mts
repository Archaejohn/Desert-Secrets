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
const MW = 24;
const MH = 16;

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
  const buf = encodePng(sceneUp);
  const path = join(outDir, `cliff-scene-${label}.png`);
  writeFileSync(path, buf);
  console.log(`cliff-scene-${label}.png -> ${path} (${sceneUp.width}x${sceneUp.height})`);
}
