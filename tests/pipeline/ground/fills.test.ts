import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { fill, fillField } from "../../../tools/pipeline/src/ground/fills";
import { encodePng } from "../../../tools/pipeline/src/png";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";

const DESERT = ["sand", "frostSand", "asphalt"] as const;
const REEF_ICE = ["reefFloor", "reefSilt", "reefWater", "glowMoss", "ice", "snow", "frozenLake", "rimeMoss"] as const;
// golden-crop pins — re-pin ONLY on an intentional recipe change (Step 4 fills these).
const FROZEN: Record<string, string> = {
  sand: "7e4e7c3da9cfc8865dead80993184503a218aff5cd0c769e32dd1e2d24e5b525",
  frostSand: "46ee50153e05b83567aac92830bd26d4345cfc81da6fc70c0ac215f59c6f132f",
  asphalt: "be15b81a8c93235d42fde1585889ece206e6af23f11ae5a7b6518dfb93a917c1",
  reefFloor: "c846478440f78766e7520d43671e283d5efc639caeb744cdcf1abe374281a982",
  reefSilt: "8d44276065615a305941ee4eaf5bff50440e4feee10c2ffcaf7a65ad5f9327a2",
  reefWater: "fd3cbe622685661b41ac0eada6fd04d2d7b3bb7f9d4fb6e375d256c247415e5c",
  glowMoss: "8015e25307d020a11c03d8424a53feccf7cc762c319b7caba092d1ff64df1ef7",
  ice: "3cd6918d9fa7eeffc2ed87612eb37608952717f568fe111a9683cb75c85e5a10",
  snow: "f7386d5799c3af168db7b3893857fc28e9b284163d8ef51b7f495aaa005b826f",
  frozenLake: "7d9dc16b81bf2a89af75e6654bcc0ef4f93adc8265a3c6caa17d0c4b53e2bbe4",
  rimeMoss: "0f904224bae9e30d440284e2f32cd46283454a3b8319f54f5667276ba7cfd866",
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

describe("fill — reef + ice", () => {
  it("is deterministic and palette-locked to each terrain's ramp", () => {
    for (const k of REEF_ICE) {
      const ramp = new Set(TERRAIN_RAMPS[k]);
      const g = fillField(k, 500, 500, 48, 48);
      g.forEach((_x, _y, c) => { if (c !== null) expect(ramp.has(c as any), `${k} pixel ${c} off-ramp`).toBe(true); });
      expect(fill(k, 500, 500)).toBe(fill(k, 500, 500)); // pure
    }
  });
  it("does NOT tile with period 16 (world-position)", () => {
    for (const k of REEF_ICE) {
      const a = fillField(k, 0, 0, 16, 16), b = fillField(k, 16, 0, 16, 16);
      expect(a.diff(b), `${k} repeats every 16px`).toBeGreaterThan(0);
    }
  });
  it("matches its golden-crop pin (64x64 @ world 1000,1000)", () => {
    for (const k of REEF_ICE) {
      const hash = createHash("sha256").update(encodePng(fillField(k, 1000, 1000, 64, 64))).digest("hex");
      expect(hash, `${k} crop changed`).toBe(FROZEN[k]);
    }
  });
});
