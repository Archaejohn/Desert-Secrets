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
  sand: "829db35993979a81e90d41079e7183f3005ae0d4098570ae1d74bbece9c8057d",
  frostSand: "8d4be8ae87e183215af785ff4addd4d51a8122e39d01fd68d42507ec7ac2118c",
  asphalt: "32dd54b2e1c90000e5f1c5d6e6e50ca8d238f7b533ed277ac540df8e9b1bbc14",
  reefFloor: "bd26b90318ae1003b5a963392e2094063f4c26ba5e8c84a19dd66d6da251c7d8",
  reefSilt: "00948a860f794b4055f48e4505b3f2ed7091105f87a3f1257fdfdbeb6c9673de",
  reefWater: "478e82b9239f12bcc18e1d14efea320ee6a2e796d82b3a5142b04661981b9fdb",
  glowMoss: "83b3d70a0ed30d6fa8dd6eb986bee9a54d7c0d98c8c7d31d5a7a2e9b80116ead",
  ice: "d9456b964a51eb56d4256eb0a228e79f83119ee9e1d799d7c7a123d1ca784d83",
  snow: "dd1191234c67ae1ee69304f40c8338a8abdd3c21cc16582f4506dc0c95b0cd06",
  frozenLake: "c3db571ec8645b409eb1b1aabe8f23a8919c09b4f659ec5fcd717ebd00bf7d07",
  rimeMoss: "a61724a2fb6491a1d1897c7944bb85fed66898d7bf21fd6b3a3495502901e65a",
  emberRock: "6fb9c72ac9950df499d6e318e03834dc2e617d3cfc605e222bc963bc637ac9a6",
  ash: "ac2c895415c489ed5ef8a3d762ec094dbde4286a3fbd453d9ec98e00dbe4f561",
  lava: "c693daacf1fb1b56ce813933e2e62123a602ef8d7426447dbd6b3c00de8b70c6",
  lavaCrust: "c476f6e795a7e311b1f8513705331c6f864ef8c94f6a7ac7c36d822878bb8931",
  groveGrass: "05b17a6b26be298918a6a51c3ba87c7849d9336abebeb6309ec69a1066fc611f",
  groveMoss: "f50011c59407b42c58a816dce8150a9e7efe3989b3c7a570b0d2bce5746cc979",
  groveWater: "7a8b4b8bb100e38f1dbc5981540fa2c9334b8e23ccc755aae4548718f5e6f136",
  groveSoil: "aa09a4af5cce6240eb3022ba6179f116f3869f89640fc6966c3c365c688f45a6",
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
