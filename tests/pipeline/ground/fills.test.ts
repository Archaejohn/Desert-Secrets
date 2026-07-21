import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { fill, fillField } from "../../../tools/pipeline/src/ground/fills";
import { encodePng } from "../../../tools/pipeline/src/png";
import { GROUND_RAMPS } from "../../../tools/pipeline/src/ground/groundRamps";

const DESERT = ["sand", "frostSand", "asphalt"] as const;
const REEF_ICE = ["reefFloor", "reefSilt", "reefWater", "glowMoss", "ice", "snow", "frozenLake", "rimeMoss"] as const;
const LAVA_GROVE = ["emberRock", "ash", "lava", "lavaCrust", "groveGrass", "groveMoss", "groveWater", "groveSoil"] as const;
// golden-crop pins — re-pin ONLY on an intentional recipe change (Step 4 fills these).
const FROZEN: Record<string, string> = {
  sand: "05a4353d6bc843ca200edac75de8c5df0b715f86f0d5501a3074791d6d7ed0f9",
  frostSand: "dd7fdbbb01dab273e2b73cba22b2a7aec349e14d131ba37a302ad10abd24d1d0",
  asphalt: "c17f856a762d76df7c58af896cf3915ab1b4c762091275c19cfd3e8eebf9b622",
  reefFloor: "0fd4f6878324722c76971d7ec680aa3d11c9853c56b4319d649d26735e4b05ff",
  reefSilt: "d9c01f70c18bb7529d06abbc00a5fe1fae389d55378953243406522a516ed950",
  reefWater: "285a4f59377a3dd19fc02f340f0cc8af5d70d2fe8b5f581122905de6d8516dfa",
  glowMoss: "99edc23a05d4e22f0eb21e556da8431620f894aa8c2d1f1400a629140e7ee0f9",
  ice: "626f78443ba91e2fd5c2cae472e91c8fe69d933323cc00e551f83c945492a3ff",
  snow: "728313a2e92893ea6487eabf6722835ea639add920d6ce4d0e60de8ecf61ddc8",
  frozenLake: "6cf5be247e9b81e5bd6b9683161dfb2fdc2a69b4deeb8e90b1b087c6d98d8c7d",
  rimeMoss: "af410df5d7d46844458aeec361a4ef4c657dcd6efaaa9b0f94eb4b5b086b6871",
  emberRock: "d9dfbabc48f5477d739b2bfeae40de8bf92c5fbe78ab22dd79f761275cd30003",
  ash: "b2811425ba69b64d90355c9aaab6002cc989dae706e50e1d5a11a81967b1bd39",
  lava: "285384ecaa076b1e786d53ff335f6eafe06104db5622d0341330d1feb351e90a",
  lavaCrust: "ad3839feee43beac1c6d495d985b81d5b72440af8d71e69c742f9d905fc7dfba",
  groveGrass: "efbe300f5da5e0dd5bc61dc714d70b1ab2286f5c390e4b830a4feefdca891dcc",
  groveMoss: "23d4981f6eddc304017e5fff35173ca939114ee60336b9cfd3383631fbac965e",
  groveWater: "f53c4907a8c0b806923a853b51fd31417ad92fe495b09389bbd6bfcb61f78e8d",
  groveSoil: "44e4098a7304ca0d8a03d3010558a69b878077fe1129f2da2ce9eb0729166678",
};

describe("fill — desert", () => {
  it("is deterministic and palette-locked to each terrain's ramp", () => {
    for (const k of DESERT) {
      const ramp = new Set(GROUND_RAMPS[k]);
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
      const ramp = new Set(GROUND_RAMPS[k]);
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
      const ramp = new Set(GROUND_RAMPS[k]);
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
