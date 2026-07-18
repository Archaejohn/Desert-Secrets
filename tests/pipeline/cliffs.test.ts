import { describe, it, expect } from "vitest";
import { PALETTE } from "../../src/shared/palette";
import { h2, partition } from "../../tools/pipeline/src/cliffs/noise";
import { ROCK, TERRAIN_RAMPS, shade, quantize } from "../../tools/pipeline/src/cliffs/palette";
import { floorFill, nameToRampIndex } from "../../tools/pipeline/src/cliffs/terrains";

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

describe("terrain floor fills", () => {
  it("floorFill returns a 16x16 palette-locked deterministic tile", () => {
    const a = floorFill("sand", 1337), b = floorFill("sand", 1337);
    expect(a.width).toBe(16); expect(a.height).toBe(16);
    expect(a.diff(b)).toBe(0);
    a.forEach((_x,_y,c) => { if (c !== null) expect(PALETTE).toHaveProperty(c); });
    expect(a.countOpaque()).toBe(256); // fully opaque floor
  });
  it("different terrains differ", () => {
    expect(floorFill("sand",1).diff(floorFill("asphalt",1))).toBeGreaterThan(0);
  });
  it("different seeds differ", () => {
    expect(floorFill("frostSand",1).diff(floorFill("frostSand",2))).toBeGreaterThan(0);
  });
  it("every terrain fill is palette-locked and fully opaque", () => {
    for (const key of Object.keys(TERRAIN_RAMPS) as Array<keyof typeof TERRAIN_RAMPS>) {
      const g = floorFill(key, 42);
      expect(g.countOpaque()).toBe(256);
      g.forEach((_x,_y,c) => { if (c !== null) expect(PALETTE).toHaveProperty(c); });
    }
  });
  it("nameToRampIndex finds a ramp name's position for its terrain", () => {
    expect(nameToRampIndex("sand", TERRAIN_RAMPS.sand[0])).toBe(0);
    expect(nameToRampIndex("sand", TERRAIN_RAMPS.sand[TERRAIN_RAMPS.sand.length-1])).toBe(TERRAIN_RAMPS.sand.length-1);
  });
});
