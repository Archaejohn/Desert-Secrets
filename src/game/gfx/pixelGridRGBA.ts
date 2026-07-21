import type { PixelGrid } from "../../../tools/pipeline/src/grid";
import { CORE, hexToRgb, type PaletteName } from "../../shared/palette";

/** Flatten a PixelGrid (cells = PaletteName | null) to RGBA bytes; null → transparent.
 *  Plain typed array (no DOM/ImageData) so it is unit-testable in the node env. */
export function pixelGridToRGBA(grid: PixelGrid): Uint8ClampedArray {
  const data = new Uint8ClampedArray(grid.width * grid.height * 4);
  grid.forEach((x, y, c) => {
    const o = (y * grid.width + x) * 4;
    if (c === null) { data[o + 3] = 0; return; }
    const [r, g, b] = hexToRgb(CORE[c as PaletteName]);
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
  });
  return data;
}
