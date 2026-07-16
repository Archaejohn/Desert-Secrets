/**
 * Visual-gate preview renderer (Phase O): upscales the regenerated sheets
 * 8x nearest-neighbour and composites the actual overworld map (ground +
 * decor via the manifest name→index maps) at 4x.
 *
 * Run from the worktree root:  npx tsx preview/render.mts preview
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { buildOverworldMap } from "../src/game/maps/overworldMap";

const outDir = process.argv[2] ?? ".";
mkdirSync(outDir, { recursive: true });
const gen = "src/assets/generated";
const manifest = JSON.parse(readFileSync(join(gen, "manifest.json"), "utf8"));

function loadPng(p: string): PNG {
  return PNG.sync.read(readFileSync(p));
}

function scaleNN(src: PNG, k: number): PNG {
  const out = new PNG({ width: src.width * k, height: src.height * k });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const si = ((y / k | 0) * src.width + (x / k | 0)) * 4;
      const di = (y * out.width + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

/** Blit a 16x16 tile (frame `idx` of an 8-column sheet) onto `dst`. */
function blitTile(dst: PNG, sheet: PNG, idx: number, dx: number, dy: number, cols: number, tw: number, th: number): void {
  const sx = (idx % cols) * tw;
  const sy = Math.floor(idx / cols) * th;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = ((sy + y) * sheet.width + sx + x) * 4;
      if (sheet.data[si + 3] === 0) continue;
      const di = ((dy + y) * dst.width + dx + x) * 4;
      dst.data[di] = sheet.data[si];
      dst.data[di + 1] = sheet.data[si + 1];
      dst.data[di + 2] = sheet.data[si + 2];
      dst.data[di + 3] = 255;
    }
  }
}

// --- sheet previews, 8x NN ---
for (const [name, out] of [
  ["tiles.png", "ow_tiles_preview.png"],
  ["tiles2.png", "ow_tiles2_preview.png"],
  ["owBillboards.png", "ow_billboards_preview.png"]
] as const) {
  writeFileSync(join(outDir, out), PNG.sync.write(scaleNN(loadPng(join(gen, name)), 8)));
  console.log("wrote", out);
}

// --- full map composite ---
const map = buildOverworldMap();
const tiles = loadPng(join(gen, "tiles.png"));
const tiles2 = loadPng(join(gen, "tiles2.png"));
const bb = loadPng(join(gen, "owBillboards.png"));
const rows = map.ground.length;
const cols = map.ground[0].length;

function tileFrame(name: string): { sheet: PNG; idx: number } {
  if (manifest.tiles.names[name] !== undefined) return { sheet: tiles, idx: manifest.tiles.names[name] };
  if (manifest.tiles2.names[name] !== undefined) return { sheet: tiles2, idx: manifest.tiles2.names[name] };
  throw new Error(`unknown tile ${name}`);
}

// two variants: flat tile view (fallback look) and billboard-ground view
for (const [file, skipBillboards] of [
  ["ow_map_preview.png", false],
  ["ow_map_ground_preview.png", true]
] as const) {
  const BILLBOARD_SKIP = new Set([
    "mountain", "mountain2", "mountain3", "mountain4", "mountain5",
    "mountain6", "mountain7", "mountain8", "joshuaTrunk", "mineTimber",
    "truckCab", "truckBox"
  ]);
  const img = new PNG({ width: cols * 16, height: rows * 16 });
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const g = tileFrame(map.ground[y][x]);
      blitTile(img, g.sheet, g.idx, x * 16, y * 16, 8, 16, 16);
      const d = map.decor[y][x];
      if (d !== null && !(skipBillboards && BILLBOARD_SKIP.has(d))) {
        const df = tileFrame(d);
        blitTile(img, df.sheet, df.idx, x * 16, y * 16, 8, 16, 16);
      }
    }
  }
  writeFileSync(join(outDir, file), PNG.sync.write(scaleNN(img, 4)));
  console.log("wrote", file);
}
console.log("done");
