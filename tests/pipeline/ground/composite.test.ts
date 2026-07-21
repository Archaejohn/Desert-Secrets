import { describe, it, expect } from "vitest";
import { GROUND_PRIORITY, neighborConfig, compositeCell, compositeMap } from "../../../tools/pipeline/src/ground/composite";
import { TERRAIN_RAMPS, TERRAIN_RAMPS as R } from "../../../tools/pipeline/src/cliffs/palette";
import { GROUND_RAMPS } from "../../../tools/pipeline/src/ground/groundRamps";

describe("GROUND_PRIORITY", () => {
  it("ranks every terrain and preserves the per-biome orders", () => {
    const P = GROUND_PRIORITY;
    for (const k of Object.keys(TERRAIN_RAMPS)) expect(typeof P[k as keyof typeof P]).toBe("number");
    expect(P.reefFloor).toBeLessThan(P.reefSilt);
    expect(P.reefSilt).toBeLessThan(P.reefWater);
    expect(P.reefWater).toBeLessThan(P.glowMoss);
    expect(P.ice).toBeLessThan(P.snow);
    expect(P.emberRock).toBeLessThan(P.lava);
    expect(P.groveGrass).toBeLessThan(P.groveSoil);
    expect(new Set(Object.values(P)).size).toBe(Object.keys(TERRAIN_RAMPS).length); // all distinct
  });
});

describe("neighborConfig", () => {
  it("sets a bit where the neighbor is on the over side, clears where it carves in", () => {
    // E neighbor carves in (returns false), all others over-side (true)
    const cfg = neighborConfig((dx, dy) => !(dx === 1 && dy === 0));
    expect(cfg & 4).toBe(0);            // E bit cleared
    expect(cfg & 1).toBe(1);            // N bit set
    expect(neighborConfig(() => true)).toBe(255);  // fully surrounded by over
    expect(neighborConfig(() => false)).toBe(0);   // fully carved
  });
});

describe("compositeCell", () => {
  // 3×3 map: center reefFloor (low), east neighbor glowMoss (high) → moss carves in from east
  const map = [
    ["reefFloor", "reefFloor", "reefFloor"],
    ["reefFloor", "reefFloor", "glowMoss"],
    ["reefFloor", "reefFloor", "reefFloor"],
  ] as any;
  it("is palette-locked to the two involved ramps and deterministic", () => {
    const allowed = new Set([...R.reefFloor, ...R.glowMoss]);
    const g = compositeCell(map, 1, 1, 1000, 1000);
    g.forEach((_x, _y, c) => { if (c) expect(allowed.has(c as any), `off-ramp ${c}`).toBe(true); });
    const h = compositeCell(map, 1, 1, 1000, 1000);
    g.forEach((x, y, c) => expect(h.get(x, y)).toBe(c)); // pure
  });
  it("carves the higher terrain in from the higher-neighbor side", () => {
    const g = compositeCell(map, 1, 1, 0, 0);
    // east column should contain glowMoss (base) pixels; west edge should be reefFloor (over)
    const eastHasMoss = [...Array(16).keys()].some((y) => R.glowMoss.includes(g.get(15, y) as any));
    const westIsFloor = [...Array(16).keys()].every((y) => R.reefFloor.includes(g.get(0, y) as any));
    expect(eastHasMoss).toBe(true);
    expect(westIsFloor).toBe(true);
  });
  it("a cell with no higher neighbor is pure fill(T)", () => {
    const g = compositeCell(map, 0, 0, 0, 0); // corner reefFloor, no higher neighbor
    g.forEach((_x, _y, c) => { if (c) expect(R.reefFloor.includes(c as any)).toBe(true); });
  });
});

describe("compositeMap", () => {
  const map = [
    ["reefFloor", "reefSilt", "reefWater"],
    ["reefSilt", "glowMoss", "reefWater"],
    ["reefFloor", "reefFloor", "glowMoss"],
  ] as any;
  it("assembles a w*16 x h*16 texture, palette-locked and deterministic", () => {
    const g = compositeMap(map);
    expect(g.width).toBe(48); expect(g.height).toBe(48);
    // fill() draws from each terrain's ENRICHED ramp (GROUND_RAMPS), not the bare
    // 4-identity TERRAIN_RAMPS — see fills.ts header. That's the true palette-lock
    // invariant for ground fills (compositeCell's existing tests use TERRAIN_RAMPS
    // only because reefFloor/glowMoss happen not to reach their enriched gaps).
    const allowed = new Set(["reefFloor","reefSilt","reefWater","glowMoss"].flatMap((k) => (GROUND_RAMPS as any)[k]));
    g.forEach((_x, _y, c) => { if (c) expect(allowed.has(c as any)).toBe(true); });
    const h = compositeMap(map);
    g.forEach((x, y, c) => expect(h.get(x, y)).toBe(c));
  });
  it("does not throw on a 3-terrain junction cell", () => {
    // center touches reefSilt, glowMoss, reefWater, reefFloor — composites, no off-palette
    expect(() => compositeMap(map)).not.toThrow();
  });
});
