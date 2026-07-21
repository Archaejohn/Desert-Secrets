import { describe, it, expect } from "vitest";
import { worldNoise, worldFbm, worldMacro } from "../../../tools/pipeline/src/ground/worldNoise";

describe("worldNoise", () => {
  it("is deterministic and in [0,1)", () => {
    for (const [x, y] of [[0, 0], [1000.5, -37.2], [1e5, 1e5]]) {
      const a = worldFbm(x, y, 3), b = worldFbm(x, y, 3);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });
  it("does NOT repeat with period 16 (world-position, not tile-local)", () => {
    // a tile-local noise would give worldFbm(x)==worldFbm(x+16); world noise must not.
    let differ = 0;
    for (let i = 0; i < 32; i++) if (worldFbm(i, 0, 5) !== worldFbm(i + 16, 0, 5)) differ++;
    expect(differ).toBeGreaterThan(24); // essentially all differ
  });
  it("varies continuously (neighbors are close)", () => {
    const a = worldNoise(100, 100, 0.125, 1), b = worldNoise(100.1, 100, 0.125, 1);
    expect(Math.abs(a - b)).toBeLessThan(0.2);
  });
  it("worldMacro is deterministic and in [0,1)", () => {
    const a = worldMacro(42, -13, 7), b = worldMacro(42, -13, 7);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
});
