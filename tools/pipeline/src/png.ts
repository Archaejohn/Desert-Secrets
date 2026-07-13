/**
 * PNG encoder — the only place palette *names* become RGB bytes.
 * Opaque cells are looked up in the master palette at alpha 255; empty cells
 * are written as fully transparent black (0,0,0,0).
 */
import { PNG } from "pngjs";
import { PALETTE, hexToRgb } from "../../../src/shared/palette";
import type { PixelGrid } from "./grid";

export function encodePng(grid: PixelGrid): Buffer {
  const png = new PNG({ width: grid.width, height: grid.height });
  grid.forEach((x, y, c) => {
    const i = (y * grid.width + x) * 4;
    if (c === null) {
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
      png.data[i + 3] = 0;
    } else {
      const [r, g, b] = hexToRgb(PALETTE[c]);
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  });
  return PNG.sync.write(png, { colorType: 6 });
}
