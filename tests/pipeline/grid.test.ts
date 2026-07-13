import { describe, expect, it } from "vitest";
import { PixelGrid } from "../../tools/pipeline/src/grid";
import { composeSheet } from "../../tools/pipeline/src/sheet";
import { mulberry32 } from "../../tools/pipeline/src/rng";

describe("PixelGrid", () => {
  it("sets and reads pixels; out-of-bounds writes are ignored", () => {
    const g = new PixelGrid(4, 4);
    g.px(1, 2, "sand");
    expect(g.get(1, 2)).toBe("sand");
    expect(g.get(0, 0)).toBeNull();
    g.px(-1, 0, "sand");
    g.px(4, 4, "sand");
    expect(g.countOpaque()).toBe(1);
  });

  it("rect fills and clips", () => {
    const g = new PixelGrid(4, 4);
    g.rect(2, 2, 5, 5, "clay");
    expect(g.countOpaque()).toBe(4); // only the in-bounds 2x2 corner
  });

  it("outline inks transparent cells 4-adjacent to opaque ones", () => {
    const g = new PixelGrid(5, 5);
    g.px(2, 2, "clay");
    g.outline("ink");
    expect(g.get(1, 2)).toBe("ink");
    expect(g.get(3, 2)).toBe("ink");
    expect(g.get(2, 1)).toBe("ink");
    expect(g.get(2, 3)).toBe("ink");
    expect(g.get(1, 1)).toBeNull(); // diagonals stay clear
    expect(g.get(2, 2)).toBe("clay"); // opaque cells untouched
  });

  it("mirrorX flips horizontally", () => {
    const g = new PixelGrid(4, 2);
    g.px(0, 0, "rust");
    const m = g.mirrorX();
    expect(m.get(3, 0)).toBe("rust");
    expect(m.get(0, 0)).toBeNull();
  });

  it("blit copies only opaque cells", () => {
    const src = new PixelGrid(2, 2);
    src.px(0, 0, "jade");
    const dst = new PixelGrid(4, 4);
    dst.rect(0, 0, 4, 4, "sand");
    dst.blit(src, 1, 1);
    expect(dst.get(1, 1)).toBe("jade");
    expect(dst.get(2, 2)).toBe("sand"); // transparent src cell left dst alone
  });

  it("diff counts differing cells", () => {
    const a = new PixelGrid(3, 3);
    const b = new PixelGrid(3, 3);
    b.px(0, 0, "ink");
    b.px(2, 2, "ink");
    expect(a.diff(b)).toBe(2);
  });
});

describe("composeSheet", () => {
  it("lays frames row-major", () => {
    const frames = Array.from({ length: 4 }, (_, i) => {
      const f = new PixelGrid(2, 2);
      f.px(0, 0, i % 2 === 0 ? "sand" : "clay");
      return f;
    });
    const sheet = composeSheet(frames, 2);
    expect(sheet.width).toBe(4);
    expect(sheet.height).toBe(4);
    expect(sheet.get(0, 0)).toBe("sand"); // frame 0
    expect(sheet.get(2, 0)).toBe("clay"); // frame 1
    expect(sheet.get(0, 2)).toBe("sand"); // frame 2
  });

  it("rejects ragged input", () => {
    const a = new PixelGrid(2, 2);
    const b = new PixelGrid(3, 2);
    expect(() => composeSheet([a, b], 2)).toThrow();
    expect(() => composeSheet([a, a, a], 2)).toThrow(); // does not fill the grid
  });
});

describe("mulberry32", () => {
  it("is deterministic per seed and in [0, 1)", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const c = mulberry32(8);
    const seqA = Array.from({ length: 10 }, a);
    const seqB = Array.from({ length: 10 }, b);
    const seqC = Array.from({ length: 10 }, c);
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
