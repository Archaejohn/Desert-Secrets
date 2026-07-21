import { describe, it, expect } from "vitest";
import { waterAlphaFromLayers } from "../../src/game/gfx/waterMask";

describe("waterAlphaFromLayers", () => {
  it("is opaque where terrainId===waterId, transparent elsewhere", () => {
    const id = new Uint8Array([5, 3, 5]); // waterId=5 at indices 0 and 2
    const a = waterAlphaFromLayers(id, 5);
    expect(a[3]).toBe(255);  // pixel 0 alpha
    expect(a[7]).toBe(0);    // pixel 1 alpha (non-water)
    expect(a[11]).toBe(255); // pixel 2 alpha
    expect([a[0], a[1], a[2]]).toEqual([255, 255, 255]); // white RGB stencil
  });
  it("honors a custom alpha", () => {
    const a = waterAlphaFromLayers(new Uint8Array([5]), 5, 140);
    expect(a[3]).toBe(140);
  });
});
