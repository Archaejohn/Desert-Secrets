import { describe, it, expect } from "vitest";
import { pixelGridToRGBA } from "../../src/game/gfx/pixelGridRGBA";
import { PixelGrid } from "../../tools/pipeline/src/grid";
import { CORE, hexToRgb } from "../../src/shared/palette";

describe("pixelGridToRGBA", () => {
  it("writes CORE hex bytes per opaque cell and alpha 0 for null", () => {
    const g = new PixelGrid(2, 1);
    g.px(0, 0, "sand"); // (1,0) left null
    const data = pixelGridToRGBA(g);
    expect(data.length).toBe(2 * 1 * 4);
    const [r, gr, b] = hexToRgb(CORE.sand);
    expect([data[0], data[1], data[2], data[3]]).toEqual([r, gr, b, 255]);
    expect(data[7]).toBe(0); // (1,0) alpha
  });
});
