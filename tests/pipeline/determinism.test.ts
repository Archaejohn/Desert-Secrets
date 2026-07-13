/** Generating twice must yield byte-for-byte identical output. */
import { describe, expect, it } from "vitest";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { encodePng } from "../../tools/pipeline/src/png";

describe("determinism", () => {
  it("two runs produce identical PNG bytes and manifest JSON", () => {
    const a = buildAssets();
    const b = buildAssets();
    for (const key of ["hero", "npc", "scarab", "tiles"] as const) {
      const bufA = encodePng(a[key]);
      const bufB = encodePng(b[key]);
      expect(bufA.equals(bufB)).toBe(true);
    }
    expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
  });

  it("grids themselves are cell-identical across runs", () => {
    const a = buildAssets();
    const b = buildAssets();
    for (const key of ["hero", "npc", "scarab", "tiles"] as const) {
      expect(a[key].diff(b[key])).toBe(0);
    }
  });
});
