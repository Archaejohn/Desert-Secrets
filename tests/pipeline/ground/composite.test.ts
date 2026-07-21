import { describe, it, expect } from "vitest";
import { GROUND_PRIORITY, neighborConfig } from "../../../tools/pipeline/src/ground/composite";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";

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
