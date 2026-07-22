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

describe("minestone recipe", () => {
  it("exists with a face ramp + course fn", () => {
    expect(STYLES.minestone.face.length).toBeGreaterThanOrEqual(6);
    expect(typeof STYLES.minestone.course).toBe("function");
  });
  it("course pushes hewn blocks + sparse red cinnabar ore, deterministically", () => {
    const o = { bw: 0.48, relief: 0.45, frac: 0.4, irr: 0.55, face: { R: [], lo: 0, hi: 1 }, top: "chip" as const };
    const a: any[] = [], b: any[] = [];
    for (let y = 0; y < 6; y++) {            // several courses so the ~14% ore fires
      STYLES.minestone.course(a, y * 0.4, y * 0.4 + 0.4, 10, o);
      STYLES.minestone.course(b, y * 0.4, y * 0.4 + 0.4, 10, o);
    }
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBe(b.length);         // deterministic
    // at least one solid carries the ORE material (AAP index 3 = "#73172d" dark red)
    expect(a.some((s) => s.m && Array.isArray(s.m.R) && s.m.R.includes("#73172d"))).toBe(true);
  });
});
