import { describe, it, expect } from "vitest";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";
import { GROUND_PRIORITY } from "../../../tools/pipeline/src/ground/composite";
import { GROUND_RAMPS } from "../../../tools/pipeline/src/ground/groundRamps";
import { fill, fillField } from "../../../tools/pipeline/src/ground/fills";
import { PALETTE } from "../../../src/shared/palette";

describe("templeSlab registration", () => {
  it("has a 4-entry ramp of mauve→plum→indigo→ink", () => {
    expect(TERRAIN_RAMPS.templeSlab).toEqual(["mauve", "plum", "indigo", "ink"]);
  });
  it("outranks reefSilt so the stone floor owns the seam", () => {
    expect(GROUND_PRIORITY.templeSlab).toBeGreaterThan(GROUND_PRIORITY.reefSilt);
  });
  it("fills palette-locked to its ramp ∪ {skyBlue}, deterministic", () => {
    const allowed = new Set<string>([...GROUND_RAMPS.templeSlab, "skyBlue"]);
    for (let wy = 0; wy < 40; wy++) for (let wx = 0; wx < 60; wx++) {
      const c = fill("templeSlab", wx, wy);
      expect(PALETTE).toHaveProperty(c);
      expect(allowed.has(c)).toBe(true);
      expect(fill("templeSlab", wx, wy)).toBe(c); // deterministic
    }
  });
});

describe("templeSlab authored structure", () => {
  it("is not a 16px stamp: two tiles within one 48px block differ", () => {
    const a = fillField("templeSlab", 0, 0, 16, 16);
    const b = fillField("templeSlab", 16, 0, 16, 16);
    expect(a.diff(b)).toBeGreaterThan(0);
  });
  it("varies block to block (per-slab tone / cracks): adjacent blocks differ", () => {
    const a = fillField("templeSlab", 0, 0, 48, 32);
    const b = fillField("templeSlab", 48, 0, 48, 32);
    expect(a.diff(b)).toBeGreaterThan(0);
  });
  it("block boundaries are darker (grout) than slab interiors on average", () => {
    // Robust to sparse cracks/sheen: compare the fraction of dark (indigo/ink)
    // pixels along block-boundary columns vs interior columns.
    const darkFrac = (xs: number[], ys: number[]) => {
      let d = 0, n = 0;
      for (const wy of ys) for (const wx of xs) { const c = fill("templeSlab", wx, wy); n++; if (c === "indigo" || c === "ink") d++; }
      return d / n;
    };
    const ys = Array.from({ length: 24 }, (_, k) => 4 + k);
    const boundary = darkFrac([0, 48, 96], ys);   // block-left grout columns
    const interior = darkFrac([20, 24, 28, 68], ys); // slab interiors
    expect(boundary).toBeGreaterThan(interior);
  });
});
