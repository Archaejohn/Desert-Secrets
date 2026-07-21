import { describe, it, expect } from "vitest";
import { renderWall } from "../../../tools/pipeline/src/walls/renderWall";
import { PALETTE } from "../../../src/shared/palette";

const P0 = {
  style: "strata" as const,
  W: 8,
  H: 5,
  ch: 0.34,
  bw: 0.48,
  relief: 0.45,
  frac: 0.4,
  irr: 0.55,
  batter: 0.15,
  talus: 0.45,
  crest: "flat" as const,
  crestAmt: 0.55,
  top: "auto" as const,
  seed: 11,
};

describe("renderWall", () => {
  it("renders a palette-locked, non-trivial grid", () => {
    const g = renderWall(P0);
    expect(g.width).toBeGreaterThan(40);
    let opaque = 0;
    const seen = new Set<string>();
    g.forEach((_x, _y, c) => {
      if (c !== null) {
        opaque++;
        expect(PALETTE).toHaveProperty(c);
        seen.add(c);
      }
    });
    expect(opaque).toBeGreaterThan(200); // real rock, not empty
    expect(seen.size).toBeGreaterThan(3); // shaded, multiple tones
  });
  it("is deterministic", () => {
    expect(renderWall(P0).diff(renderWall(P0))).toBe(0);
  });
  it("granite renders too", () => {
    expect(renderWall({ ...P0, style: "granite" }).width).toBeGreaterThan(40);
  });
});
