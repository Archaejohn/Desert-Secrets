import { describe, it, expect } from "vitest";
import { PALETTE } from "../../src/shared/palette";
import { h2, partition } from "../../tools/pipeline/src/cliffs/noise";
import { ROCK, TERRAIN_RAMPS, shade, quantize } from "../../tools/pipeline/src/cliffs/palette";

describe("cliffs palette + noise", () => {
  it("h2 is deterministic and in [0,1)", () => {
    expect(h2(3, 7, 11)).toBe(h2(3, 7, 11));
    const v = h2(3, 7, 11); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1);
  });
  it("partition sums to total", () => {
    const w = partition(16, 4, 0.5, 99); expect(w.reduce((a,b)=>a+b,0)).toBe(16);
    expect(w.every(n => n >= 1)).toBe(true);
  });
  it("every ramp entry is a real palette name", () => {
    for (const ramp of [ROCK, ...Object.values(TERRAIN_RAMPS)])
      for (const name of ramp) expect(PALETTE).toHaveProperty(name);
  });
  it("quantize maps brightness to ramp ends", () => {
    expect(quantize(1, ROCK)).toBe(ROCK[0]);            // lightest
    expect(quantize(0, ROCK)).toBe(ROCK[ROCK.length-1]); // darkest
  });
  it("shade clamps index shifts", () => {
    expect(shade(ROCK, 0, -5)).toBe(ROCK[0]);
    expect(shade(ROCK, ROCK.length-1, 5)).toBe(ROCK[ROCK.length-1]);
  });
});
