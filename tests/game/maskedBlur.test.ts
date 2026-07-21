import { describe, it, expect } from "vitest";
import { maskedBlur } from "../../src/game/gfx/maskedBlur";

// A 3x1 row: [A=red] [A=black] [B=blue]. Terrain A = id 0 (cols 0,1), terrain B = id 1 (col 2).
// Blurring the middle A pixel must average only the A pixels (red+black) and NEVER pull in
// the blue B pixel across the boundary — proving the seam stays crisp.
describe("maskedBlur", () => {
  const W = 3, H = 1;
  const rgba = new Uint8ClampedArray([255, 0, 0, 255,  0, 0, 0, 255,  0, 0, 255, 255]);
  const id = new Uint8Array([0, 0, 1]);
  const noShadow = new Uint8Array([0, 0, 0]);

  it("averages only same-terrain neighbours (never across a boundary)", () => {
    const out = maskedBlur(rgba, W, H, id, noShadow, 3);
    // middle A pixel = mean(red, black) = (128,0,0); no blue leaked in
    expect([out[4], out[5], out[6]]).toEqual([128, 0, 0]);
    // B pixel (col 2) only sees itself → unchanged blue
    expect([out[8], out[9], out[10]]).toEqual([0, 0, 255]);
  });

  it("leaves shadow pixels crisp (passes them through unblurred)", () => {
    const out = maskedBlur(rgba, W, H, id, new Uint8Array([0, 1, 0]), 3); // middle is a shadow pixel
    expect([out[4], out[5], out[6]]).toEqual([0, 0, 0]); // unchanged, not averaged
  });

  it("leaves `skip` terrain types crisp", () => {
    const out = maskedBlur(rgba, W, H, id, noShadow, 3, new Set([0])); // terrain A opted out
    expect([out[4], out[5], out[6]]).toEqual([0, 0, 0]); // middle A pixel unchanged
  });
});
