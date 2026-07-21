import { describe, it, expect } from "vitest";
import { MAT, aapIndexToName, WALL_WIN } from "../../../tools/pipeline/src/walls/wallMaterials";
import { PALETTE } from "../../../src/shared/palette";

describe("wallMaterials", () => {
  it("every AAP index maps to a real PaletteName", () => {
    for (let i = 0; i < 64; i++) expect(PALETTE).toHaveProperty(aapIndexToName(i));
  });
  it("MAT carries the ramp hexes + window", () => {
    const m = MAT([31, 32, 63], 0.1, 0.5);
    expect(m.R.length).toBe(3);
    expect(m.lo).toBe(0.1); expect(m.hi).toBe(0.5);
  });
  it("the muted default window sits lower than the prototype's 0.11-0.53", () => {
    expect(WALL_WIN[0]).toBeLessThanOrEqual(0.11);
    expect(WALL_WIN[1]).toBeLessThanOrEqual(0.50);
  });
});
