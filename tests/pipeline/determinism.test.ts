/** Generating twice must yield byte-for-byte identical output, and the v1
 *  assets (hero, npc, scarab, tiles) must never change at all. */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildAssets, SHEET_KEYS } from "../../tools/pipeline/src/assets";
import { encodePng } from "../../tools/pipeline/src/png";

describe("determinism", () => {
  it("two runs produce identical PNG bytes and manifest JSON", () => {
    const a = buildAssets();
    const b = buildAssets();
    for (const key of SHEET_KEYS) {
      const bufA = encodePng(a[key]);
      const bufB = encodePng(b[key]);
      expect(bufA.equals(bufB)).toBe(true);
    }
    expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
  });

  it("grids themselves are cell-identical across runs", () => {
    const a = buildAssets();
    const b = buildAssets();
    for (const key of SHEET_KEYS) {
      expect(a[key].diff(b[key])).toBe(0);
    }
  });
});

describe("v1 asset byte-stability", () => {
  // sha256 of the committed v1 PNGs. Act 1 work must not change these —
  // if a shared-code refactor moves a single pixel, this fails.
  const FROZEN: Record<string, string> = {
    hero: "f04261c56e07861c1cef3d377339d1bd22c9f7bd9be2cfdc459fadb7ed4d3d53",
    npc: "fb33522d654c14306d02452dcfb313dafc4ebd9cff5052f19b5b61fb108e1f68",
    scarab: "0b5a22a21161c83c75bce3d8aaffea7ae83998907b5b2a185da3fb1b2eed0842",
    tiles: "23a632351b59297b3276a0cdd55318092bfbf83f203a7abcdf84b45dbcb72ed0"
  };

  it("hero, npc, scarab and tiles still encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of ["hero", "npc", "scarab", "tiles"] as const) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});
