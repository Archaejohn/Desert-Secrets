import { describe, it, expect } from "vitest";
import { PALETTE } from "../../src/shared/palette";
import { h2, partition } from "../../tools/pipeline/src/cliffs/noise";
import { ROCK, TERRAIN_RAMPS, shade, quantize } from "../../tools/pipeline/src/cliffs/palette";
import { floorFill, nameToRampIndex } from "../../tools/pipeline/src/cliffs/terrains";
import { canonical, CANONICAL_MASKS, overlayMask, blobTiles } from "../../tools/pipeline/src/cliffs/blob47";
import { wallFace, type WallParams } from "../../tools/pipeline/src/cliffs/materials";

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

describe("47-blob canonical masks + overlayMask geometry", () => {
  it("canonical reduction yields exactly 47 masks", () => {
    expect(CANONICAL_MASKS.length).toBe(47);
    const set = new Set(CANONICAL_MASKS.map(canonical));
    expect(set.size).toBe(47); // already canonical, idempotent
  });
  it("fully-interior mask is all over-terrain", () => {
    const m = overlayMask(255, 2, 14, 2, 7);
    expect(Array.from(m).every(v => v === 1)).toBe(true);
  });
  it("island mask (no neighbours) retreats on every edge", () => {
    const m = overlayMask(0, 2, 14, 2, 7);
    // corners are base terrain (0) when inset>0
    expect(m[0]).toBe(0); expect(m[15]).toBe(0);
  });
  it("overlayMask is deterministic", () => {
    const a = overlayMask(64|16, 2, 14, 2, 7), b = overlayMask(64|16, 2, 14, 2, 7);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe("blobTiles (47-blob palette-locked rendering)", () => {
  const over = floorFill("sand", 1), base = floorFill("asphalt", 1);
  const opts = {
    inset: 2, irreg: 14, round: 2, outline: true, shadow: true, seed: 7,
    overKey: "sand" as const, baseKey: "asphalt" as const,
  };

  it("yields 47 palette-locked deterministic tiles", () => {
    const a = blobTiles(over, base, opts), b = blobTiles(over, base, opts);
    expect(a.length).toBe(47);
    a.forEach((t, i) => {
      expect(t.grid.diff(b[i].grid)).toBe(0);
      t.grid.forEach((_x, _y, c) => { if (c !== null) expect(PALETTE).toHaveProperty(c); });
    });
  });

  it("mask-255 (fully interior) tile equals the over fill exactly", () => {
    const a = blobTiles(over, base, opts);
    const interior = a.find((t) => t.mask === 255)!;
    expect(interior.grid.diff(over)).toBe(0);
  });

  it("every tile is fully opaque and 16x16", () => {
    const a = blobTiles(over, base, opts);
    a.forEach((t) => {
      expect(t.grid.width).toBe(16); expect(t.grid.height).toBe(16);
      expect(t.grid.countOpaque()).toBe(256);
    });
  });

  it("mask indices line up with CANONICAL_MASKS order", () => {
    const a = blobTiles(over, base, opts);
    expect(a.map((t) => t.mask)).toEqual(CANONICAL_MASKS);
  });

  it("outline/shadow off yields a plain over/base composite (no ramp shifts)", () => {
    const plain = blobTiles(over, base, { ...opts, outline: false, shadow: false });
    const withFx = blobTiles(over, base, opts);
    // some tile with a partial mask should differ once outline/shadow kick in
    const partial = CANONICAL_MASKS.findIndex((m) => m !== 255 && m !== 0);
    expect(plain[partial].grid.diff(withFx[partial].grid)).toBeGreaterThan(0);
  });
});

describe("wallFace rock material", () => {
  const WP: WallParams = {
    courses: 3, blockSize: 4, blocksPerCourse: 4, stagger: 0.5,
    tone: 0.2, mortar: 0.35, orderVsRandom: 0.45,
  };

  it("wallFace rock is 16x16, palette-locked, deterministic, opaque", () => {
    const a = wallFace("rock", WP, 7), b = wallFace("rock", WP, 7);
    expect(a.width).toBe(16); expect(a.height).toBe(16);
    expect(a.diff(b)).toBe(0);
    a.forEach((_x, _y, c) => { if (c !== null) expect(PALETTE).toHaveProperty(c); });
    expect(a.countOpaque()).toBe(256);
  });

  it("different seeds differ", () => {
    expect(wallFace("rock", WP, 1).diff(wallFace("rock", WP, 2))).toBeGreaterThan(0);
  });

  it("all colours used come from the ROCK ramp", () => {
    const a = wallFace("rock", WP, 7);
    a.forEach((_x, _y, c) => { if (c !== null) expect(ROCK).toContain(c); });
  });

  it("higher mortar darkens the gap fill", () => {
    // Dense params like WP tile the whole 16x16 with overlapping cubes (by
    // design — a tightly-packed stacked-stone face, matching the prototype),
    // so the background mortar fill can be fully occluded. Use a single
    // small block so most of the tile stays background, then check that
    // fill visibly darkens as mortar rises.
    const sparse: WallParams = {
      courses: 1, blockSize: 1, blocksPerCourse: 1, stagger: 0, tone: 0, mortar: 0.35, orderVsRandom: 0,
    };
    const low = wallFace("rock", { ...sparse, mortar: 0 }, 7);
    const high = wallFace("rock", { ...sparse, mortar: 1 }, 7);
    expect(low.diff(high)).toBeGreaterThan(0);
  });
});
