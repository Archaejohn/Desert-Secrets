import { describe, it, expect } from "vitest";
import { GROUND_PRIORITY, neighborConfig, compositeCell, compositeMap } from "../../../tools/pipeline/src/ground/composite";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";
import { GROUND_RAMPS } from "../../../tools/pipeline/src/ground/groundRamps";
import { CORE } from "../../../src/shared/palette";

const CORE_KEYS = new Set(Object.keys(CORE));

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
    const cfg = neighborConfig((dx, dy) => !(dx === 1 && dy === 0)); // only E carves in
    expect(cfg & 4).toBe(0);            // E bit cleared
    expect(cfg & 1).toBe(1);            // N bit set
    expect(neighborConfig(() => true)).toBe(255);  // fully field
    expect(neighborConfig(() => false)).toBe(0);   // fully carved
  });
});

describe("compositeCell", () => {
  // center reefFloor (low), glowMoss (higher) to the E → moss carves in from the east
  const mossE = [
    ["reefFloor", "reefFloor", "reefFloor"],
    ["reefFloor", "reefFloor", "glowMoss"],
    ["reefFloor", "reefFloor", "reefFloor"],
  ] as any;
  const MOSS_SIG = new Set(["mint", "jade"]); // in glowMoss's fill, never in reefFloor's

  it("is palette-locked to CORE (AAP-64) and deterministic", () => {
    // fills draw from the enriched GROUND_RAMPS and the seam shadow snaps to nearest CORE,
    // so the composite's true invariant is: every pixel is a valid CORE colour.
    const g = compositeCell(mossE, 1, 1, 1000, 1000);
    g.forEach((_x, _y, c) => { if (c) expect(CORE_KEYS.has(c as string), `off-palette ${c}`).toBe(true); });
    const h = compositeCell(mossE, 1, 1, 1000, 1000);
    g.forEach((x, y, c) => expect(h.get(x, y)).toBe(c)); // pure
  });

  it("carves the higher terrain in from the higher-neighbor side only", () => {
    const g = compositeCell(mossE, 1, 1, 0, 0);
    let eastMoss = false, westMoss = false;
    g.forEach((x, _y, c) => { if (c && MOSS_SIG.has(c as string)) { if (x >= 8) eastMoss = true; else westMoss = true; } });
    expect(eastMoss, "glowMoss must appear on the east (its side)").toBe(true);
    expect(westMoss, "glowMoss must NOT reach the far west").toBe(false);
  });

  it("priority-layers ALL higher neighbors at a junction, not just the highest", () => {
    // reefFloor flanked by lava (W, highest) and glowMoss (E) — disjoint warm/teal palettes.
    // The old single-highest-neighbor code carved only lava and DROPPED the moss transition.
    const twoHigher = [
      ["reefFloor", "reefFloor", "reefFloor"],
      ["lava", "reefFloor", "glowMoss"],
      ["reefFloor", "reefFloor", "reefFloor"],
    ] as any;
    const g = compositeCell(twoHigher, 1, 1, 0, 0);
    const cols = new Set<string>(); g.forEach((_x, _y, c) => { if (c) cols.add(c as string); });
    const lavaSet = new Set(GROUND_RAMPS.lava); // fully disjoint from reef greens
    const hasLava = [...cols].some((c) => lavaSet.has(c as any));
    const hasMoss = [...cols].some((c) => MOSS_SIG.has(c));
    expect(hasLava, "lava (W neighbor) carves in").toBe(true);
    expect(hasMoss, "glowMoss (E neighbor) ALSO carves in — the priority-layering fix").toBe(true);
  });

  it("a cell with no higher neighbor is pure fill(T) (no seam, no shadow)", () => {
    const g = compositeCell(mossE, 0, 0, 0, 0); // corner reefFloor, no higher neighbor
    const rampSet = new Set(GROUND_RAMPS.reefFloor);
    g.forEach((_x, _y, c) => { if (c) expect(rampSet.has(c as any), `${c} not in reefFloor ramp`).toBe(true); });
  });
});

describe("compositeMap", () => {
  const map = [
    ["reefFloor", "reefSilt", "reefWater"],
    ["reefSilt", "glowMoss", "reefWater"],
    ["reefFloor", "reefFloor", "glowMoss"],
  ] as any;
  it("assembles a w*16 x h*16 texture, palette-locked to CORE and deterministic", () => {
    const g = compositeMap(map);
    expect(g.width).toBe(48); expect(g.height).toBe(48);
    g.forEach((_x, _y, c) => { if (c) expect(CORE_KEYS.has(c as string), `off-palette ${c}`).toBe(true); });
    const h = compositeMap(map);
    g.forEach((x, y, c) => expect(h.get(x, y)).toBe(c));
  });
  it("does not throw on a 3+-terrain junction cell", () => {
    expect(() => compositeMap(map)).not.toThrow();
  });
});
