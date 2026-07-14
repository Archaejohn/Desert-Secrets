/**
 * PWA / home-screen icons, generated from the same pipeline as everything
 * else: Piggy (frame 0) nearest-neighbour upscaled on an ink rounded tile.
 * Run via `npm run art` (chained after the asset pass).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PixelGrid } from "./grid";
import { encodePng } from "./png";
import { piggyFrames } from "./sprites/piggy";

const OUT_DIR = join(process.cwd(), "public");

export function buildIcon(size: number): PixelGrid {
  const icon = new PixelGrid(size, size);
  // Rounded sand tile (Piggy's ink body needs a light ground to read).
  const corner = Math.round(size * 0.09);
  icon.rect(0, 0, size, size, "sand");
  for (const [cx, cy] of [
    [0, 0],
    [size - corner, 0],
    [0, size - corner],
    [size - corner, size - corner]
  ] as const) {
    for (let y = 0; y < corner; y++) {
      for (let x = 0; x < corner; x++) {
        const dx = cx === 0 ? corner - x : x + 1;
        const dy = cy === 0 ? corner - y : y + 1;
        if (dx * dx + dy * dy > corner * corner) icon.px(cx + x, cy + y, null);
      }
    }
  }
  const border = Math.max(2, Math.round(size / 48));
  icon.rect(border, border, size - 2 * border, border, "clay");
  icon.rect(border, size - 2 * border, size - 2 * border, border, "clay");

  // Piggy, centered, integer upscale.
  const piggy = piggyFrames()[0];
  const scale = Math.floor((size * 0.8) / piggy.width);
  const w = piggy.width * scale;
  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - w) / 2);
  for (let y = 0; y < piggy.height; y++) {
    for (let x = 0; x < piggy.width; x++) {
      const c = piggy.get(x, y);
      if (c) icon.rect(ox + x * scale, oy + y * scale, scale, scale, c);
    }
  }
  return icon;
}

const sizes = [192, 512];
mkdirSync(OUT_DIR, { recursive: true });
for (const size of sizes) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), encodePng(buildIcon(size)));
}
console.log(`icons: wrote ${sizes.map((s) => `icon-${s}.png`).join(", ")} to public/`);
