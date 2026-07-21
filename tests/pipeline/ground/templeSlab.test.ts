import { describe, it, expect } from "vitest";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";
import { GROUND_PRIORITY } from "../../../tools/pipeline/src/ground/composite";
import { GROUND_RAMPS } from "../../../tools/pipeline/src/ground/groundRamps";
import { fill } from "../../../tools/pipeline/src/ground/fills";
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
