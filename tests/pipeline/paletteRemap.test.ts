import { describe, it, expect } from "vitest";
import { redmean, assignInjective, remapPalette, rampInversions } from "../../tools/pipeline/src/palette/remap";
import { PALETTE } from "../../src/shared/palette";
import { TERRAIN_RAMPS, ROCK, ICE, REEF, LAVA, GROVE } from "../../tools/pipeline/src/cliffs/palette";

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
  const allRamps = [...Object.values(TERRAIN_RAMPS), ROCK, ICE, REEF, LAVA, GROVE] as readonly (readonly string[])[];
  const mapping = remapPalette(PALETTE as Record<string, string>);

  it("remaps all 25 names to distinct AAP-64 hexes (injective)", () => {
    const names = Object.keys(PALETTE);
    expect(Object.keys(mapping).sort()).toEqual(names.sort());
    expect(new Set(Object.values(mapping)).size).toBe(names.length);
  });

  it("keeps every color faithful — no color pushed far from the original (ΔE <= 80)", () => {
    const toRgb = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    for (const [name, oldHex] of Object.entries(PALETTE)) {
      expect(redmean(toRgb(oldHex as string), toRgb(mapping[name])), `${name} pushed too far`).toBeLessThanOrEqual(80);
    }
  });

  it("introduces no large ramp inversion (all inversions <= 0.12 luminance)", () => {
    for (const inv of rampInversions(mapping, allRamps)) {
      expect(inv.drop, `ramp ${inv.rampIndex} slot ${inv.slot} ${inv.from}->${inv.to}`).toBeLessThanOrEqual(0.12);
    }
  });
});
