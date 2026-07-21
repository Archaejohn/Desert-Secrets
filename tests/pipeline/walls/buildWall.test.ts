import { describe, it, expect } from "vitest";
import { buildWall } from "../../../tools/pipeline/src/walls/buildWall";

const P0 = { style: "strata" as const, W: 8, H: 5, ch: 0.34, bw: 0.48, relief: 0.45,
  frac: 0.4, irr: 0.55, batter: 0.15, talus: 0.45, crest: "flat" as const, crestAmt: 0.55, top: "auto" as const, seed: 11 };

describe("buildWall", () => {
  it("returns a non-empty primitive list including the recess plane", () => {
    const { P } = buildWall(P0);
    expect(P.length).toBeGreaterThan(5);
    expect(P[0].t).toBe("box"); // recess plane pushed first
  });
  it("is deterministic for the same params/seed", () => {
    expect(buildWall(P0).P.length).toBe(buildWall(P0).P.length);
  });
  it("more talus => more solids", () => {
    expect(buildWall({ ...P0, talus: 0.9 }).P.length).toBeGreaterThan(buildWall({ ...P0, talus: 0 }).P.length);
  });
});
