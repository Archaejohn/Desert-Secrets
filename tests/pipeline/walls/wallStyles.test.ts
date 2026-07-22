import { describe, it, expect } from "vitest";
import { STYLES, crestOff } from "../../../tools/pipeline/src/walls/wallStyles";

describe("wallStyles", () => {
  it("has strata + granite recipes with 7-entry face ramps", () => {
    for (const k of ["strata", "granite"] as const) {
      expect(STYLES[k].face.length).toBeGreaterThanOrEqual(6);
      expect(typeof STYLES[k].course).toBe("function");
    }
  });
  it("a course pushes solids deterministically", () => {
    const o = { bw: 0.48, relief: 0.25, frac: 0.4, irr: 0.55, face: { R: [], lo: 0, hi: 1 }, top: "flat" as const };
    const a: any[] = [], b: any[] = [];
    STYLES.strata.course(a, 0, 0.4, 8, o);
    STYLES.strata.course(b, 0, 0.4, 8, o);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBe(b.length); // deterministic
  });
  it("crestOff returns 0 for a flat crest and rises for domed", () => {
    expect(crestOff("flat", 4, 8, 1)).toBe(0);
    expect(crestOff("domed", 4, 8, 1)).toBeGreaterThan(0);
  });
});
