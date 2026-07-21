import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { fill, fillField } from "../../../tools/pipeline/src/ground/fills";
import { encodePng } from "../../../tools/pipeline/src/png";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";

const DESERT = ["sand", "frostSand", "asphalt"] as const;
const REEF_ICE = ["reefFloor", "reefSilt", "reefWater", "glowMoss", "ice", "snow", "frozenLake", "rimeMoss"] as const;
const LAVA_GROVE = ["emberRock", "ash", "lava", "lavaCrust", "groveGrass", "groveMoss", "groveWater", "groveSoil"] as const;
// golden-crop pins — re-pin ONLY on an intentional recipe change (Step 4 fills these).
const FROZEN: Record<string, string> = {
  sand: "05a4353d6bc843ca200edac75de8c5df0b715f86f0d5501a3074791d6d7ed0f9",
  frostSand: "e36833299f13946142e28b2771dbf48d7f5167ca0a72b41cdbc70d269a3a5d30",
  asphalt: "32dd54b2e1c90000e5f1c5d6e6e50ca8d238f7b533ed277ac540df8e9b1bbc14",
  reefFloor: "0fd4f6878324722c76971d7ec680aa3d11c9853c56b4319d649d26735e4b05ff",
  reefSilt: "d9c01f70c18bb7529d06abbc00a5fe1fae389d55378953243406522a516ed950",
  reefWater: "478e82b9239f12bcc18e1d14efea320ee6a2e796d82b3a5142b04661981b9fdb",
  glowMoss: "99edc23a05d4e22f0eb21e556da8431620f894aa8c2d1f1400a629140e7ee0f9",
  ice: "d9456b964a51eb56d4256eb0a228e79f83119ee9e1d799d7c7a123d1ca784d83",
  snow: "728313a2e92893ea6487eabf6722835ea639add920d6ce4d0e60de8ecf61ddc8",
  frozenLake: "c3db571ec8645b409eb1b1aabe8f23a8919c09b4f659ec5fcd717ebd00bf7d07",
  rimeMoss: "af410df5d7d46844458aeec361a4ef4c657dcd6efaaa9b0f94eb4b5b086b6871",
  emberRock: "6fb9c72ac9950df499d6e318e03834dc2e617d3cfc605e222bc963bc637ac9a6",
  ash: "c28c4cabcab1bf781782e3e20b730c982538923fa3c78cdbaa53b7f3f3480c07",
  lava: "c693daacf1fb1b56ce813933e2e62123a602ef8d7426447dbd6b3c00de8b70c6",
  lavaCrust: "c476f6e795a7e311b1f8513705331c6f864ef8c94f6a7ac7c36d822878bb8931",
  groveGrass: "efbe300f5da5e0dd5bc61dc714d70b1ab2286f5c390e4b830a4feefdca891dcc",
  groveMoss: "f50011c59407b42c58a816dce8150a9e7efe3989b3c7a570b0d2bce5746cc979",
  groveWater: "7a8b4b8bb100e38f1dbc5981540fa2c9334b8e23ccc755aae4548718f5e6f136",
  groveSoil: "e15a3e5bc1b326957d526730f988895c6b0b91365a66d86697229670e6e9ed38",
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

describe("fill — lava + grove", () => {
  it("is deterministic and palette-locked to each terrain's ramp", () => {
    for (const k of LAVA_GROVE) {
      const ramp = new Set(TERRAIN_RAMPS[k]);
      const g = fillField(k, 500, 500, 48, 48);
      g.forEach((_x, _y, c) => { if (c !== null) expect(ramp.has(c as any), `${k} pixel ${c} off-ramp`).toBe(true); });
      expect(fill(k, 500, 500)).toBe(fill(k, 500, 500)); // pure
    }
  });
  it("does NOT tile with period 16 (world-position)", () => {
    for (const k of LAVA_GROVE) {
      const a = fillField(k, 0, 0, 16, 16), b = fillField(k, 16, 0, 16, 16);
      expect(a.diff(b), `${k} repeats every 16px`).toBeGreaterThan(0);
    }
  });
  it("matches its golden-crop pin (64x64 @ world 1000,1000)", () => {
    for (const k of LAVA_GROVE) {
      const hash = createHash("sha256").update(encodePng(fillField(k, 1000, 1000, 64, 64))).digest("hex");
      expect(hash, `${k} crop changed`).toBe(FROZEN[k]);
    }
  });
});
