import { describe, it, expect } from "vitest";
import { redmean, luminance, assignInjective, remapPalette } from "../../tools/pipeline/src/palette/remap";
import { PALETTE } from "../../src/shared/palette";
import { TERRAIN_RAMPS } from "../../tools/pipeline/src/cliffs/palette";

describe("redmean", () => {
  it("is zero for identical colors and positive otherwise", () => {
    expect(redmean([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(redmean([0, 0, 0], [255, 255, 255])).toBeGreaterThan(0);
  });
});

describe("assignInjective", () => {
  it("maps every source to a DISTINCT target", () => {
    const src = ["#000000", "#010101", "#ff0000"];
    const tgt = ["#000000", "#020202", "#fe0000", "#00ff00"];
    const idx = assignInjective(src, tgt);
    expect(idx).toHaveLength(3);
    expect(new Set(idx).size).toBe(3); // no collisions
  });
});

describe("remapPalette (real palette)", () => {
  const ramps = Object.values(TERRAIN_RAMPS).map((r) => r as readonly string[]);
  const mapping = remapPalette(PALETTE as Record<string, string>, ramps);

  it("remaps all 25 names to distinct AAP-64 hexes", () => {
    const names = Object.keys(PALETTE);
    expect(Object.keys(mapping).sort()).toEqual(names.sort());
    expect(new Set(Object.values(mapping)).size).toBe(names.length);
  });

  it("keeps every terrain ramp luminance-monotonic (light→dark)", () => {
    for (const [key, ramp] of Object.entries(TERRAIN_RAMPS)) {
      const lums = (ramp as readonly string[]).map((n) => luminance(mapping[n]));
      for (let i = 1; i < lums.length; i++) {
        expect(lums[i], `${key} ramp not monotonic at ${i}`).toBeLessThanOrEqual(lums[i - 1] + 1e-9);
      }
    }
  });
});
