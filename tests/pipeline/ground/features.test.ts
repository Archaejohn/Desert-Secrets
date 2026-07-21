import { describe, it, expect } from "vitest";
import { PixelGrid } from "../../../tools/pipeline/src/grid";
import { paintFeatures, type GroundFeature } from "../../../tools/pipeline/src/ground/features";

function blank(wTiles: number, hTiles: number) {
  const W = wTiles * 16, H = hTiles * 16;
  const grid = new PixelGrid(W, H);
  grid.forEach((x, y) => grid.px(x, y, "plum"));
  return { grid, terrainId: new Uint8Array(W * H), shadow: new Uint8Array(W * H), W, H };
}

describe("paintFeatures", () => {
  it("sunEmblem paints an amber disc and marks it crisp", () => {
    const { grid, terrainId, shadow, W } = blank(3, 3);
    const feats: GroundFeature[] = [{ kind: "sunEmblem", tx: 1, ty: 1 }];
    paintFeatures(grid, terrainId, shadow, feats, W);
    const cx = 1 * 16 + 8, cy = 1 * 16 + 8;
    // check a disc pixel offset from center (center itself is the sandLight highlight).
    expect(grid.get(cx + 3, cy)).toBe("amber");
    expect(shadow[cy * W + (cx + 3)]).toBe(1);
    expect(grid.get(cx, cy)).toBe("sandLight"); // center highlight
  });
  it("shatter paints ink fissures", () => {
    const { grid, terrainId, shadow, W } = blank(3, 3);
    paintFeatures(grid, terrainId, shadow, [{ kind: "shatter", tx: 1, ty: 1, seed: 3 }], W);
    let inks = 0;
    grid.forEach((_x, _y, c) => { if (c === "ink") inks++; });
    expect(inks).toBeGreaterThan(0);
  });
  it("leaves pixels outside features untouched", () => {
    const { grid, terrainId, shadow, W } = blank(3, 3);
    paintFeatures(grid, terrainId, shadow, [{ kind: "sunEmblem", tx: 1, ty: 1 }], W);
    expect(grid.get(0, 0)).toBe("plum");
    expect(shadow[0]).toBe(0);
  });
  it("is deterministic", () => {
    const a = blank(3, 3), b = blank(3, 3);
    const f: GroundFeature[] = [{ kind: "shatter", tx: 1, ty: 1, seed: 9 }];
    paintFeatures(a.grid, a.terrainId, a.shadow, f, a.W);
    paintFeatures(b.grid, b.terrainId, b.shadow, f, b.W);
    expect(a.grid.diff(b.grid)).toBe(0);
  });
});
