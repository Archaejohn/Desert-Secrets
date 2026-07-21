import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { fill, fillField } from "../../../tools/pipeline/src/ground/fills";
import { encodePng } from "../../../tools/pipeline/src/png";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";

const DESERT = ["sand", "frostSand", "asphalt"] as const;
// golden-crop pins — re-pin ONLY on an intentional recipe change (Step 4 fills these).
const FROZEN: Record<string, string> = {
  sand: "7e4e7c3da9cfc8865dead80993184503a218aff5cd0c769e32dd1e2d24e5b525",
  frostSand: "46ee50153e05b83567aac92830bd26d4345cfc81da6fc70c0ac215f59c6f132f",
  asphalt: "be15b81a8c93235d42fde1585889ece206e6af23f11ae5a7b6518dfb93a917c1",
};

describe("fill — desert", () => {
  it("is deterministic and palette-locked to each terrain's ramp", () => {
    for (const k of DESERT) {
      const ramp = new Set(TERRAIN_RAMPS[k]);
      const g = fillField(k, 500, 500, 48, 48);
      g.forEach((_x, _y, c) => { if (c !== null) expect(ramp.has(c as any), `${k} pixel ${c} off-ramp`).toBe(true); });
      expect(fill(k, 500, 500)).toBe(fill(k, 500, 500)); // pure
    }
  });
  it("does NOT tile with period 16 (world-position)", () => {
    for (const k of DESERT) {
      const a = fillField(k, 0, 0, 16, 16), b = fillField(k, 16, 0, 16, 16);
      expect(a.diff(b), `${k} repeats every 16px`).toBeGreaterThan(0);
    }
  });
  it("matches its golden-crop pin (64x64 @ world 1000,1000)", () => {
    for (const k of DESERT) {
      const hash = createHash("sha256").update(encodePng(fillField(k, 1000, 1000, 64, 64))).digest("hex");
      expect(hash, `${k} crop changed`).toBe(FROZEN[k]);
    }
  });
});
