/**
 * lakeShore.ts — the mask-based sand↔water autotile that replaced the old
 * 12-tile `coast*` straight-edge set (docs/CONTRACTS.md "v22"). Mirrors
 * `tests/pipeline/owMountains.test.ts`'s shape: layout/naming, determinism,
 * and the geometric edge-rounding contract itself (evaluated directly
 * against the shared `roundedMaskDist`, not inferred from pixel colours).
 */
import { describe, expect, it } from "vitest";
import { buildAssets } from "../../tools/pipeline/src/assets";
import {
  LAKE_SHORE_CURVE_RADIUS,
  LAKE_SHORE_MASK_COUNT,
  lakeShoreFrames,
  lakeShoreNames
} from "../../tools/pipeline/src/lakeShore";
import { roundedMaskDist } from "../../tools/pipeline/src/roundedMask";
import { TILE2_NAMES } from "../../tools/pipeline/src/tileset2";

describe("lakeShore layout", () => {
  it("holds 16 16x16 frames (one per mask, no variant dimension)", () => {
    expect(LAKE_SHORE_MASK_COUNT).toBe(16);
    const frames = lakeShoreFrames();
    expect(frames).toHaveLength(16);
    for (const f of frames) expect([f.width, f.height]).toEqual([16, 16]);
    expect(lakeShoreNames).toHaveLength(16);
  });

  it("names are lakeShore0..lakeShore15, mask-minor only", () => {
    for (let mask = 0; mask < 16; mask++) expect(lakeShoreNames[mask]).toBe(`lakeShore${mask}`);
  });

  it("shares owMountains' tuned curve radius (same visual language)", () => {
    expect(LAKE_SHORE_CURVE_RADIUS).toBe(16.5);
  });

  it("is spliced into tiles2.png's TILE2_NAMES in the exact same order, kept in sync", () => {
    const idx = TILE2_NAMES.indexOf("lakeShore0" as (typeof TILE2_NAMES)[number]);
    expect(idx).toBeGreaterThan(-1);
    for (let mask = 0; mask < 16; mask++) {
      expect(TILE2_NAMES[idx + mask]).toBe(lakeShoreNames[mask]);
    }
  });

  it("every pixel is an exact palette colour (never null/transparent) — full alpha-255 palette compliance for the whole sheet is covered generically by tests/pipeline/act1.test.ts's 'act1 palette compliance' suite once lakeShore is folded into tiles2.png", () => {
    for (const f of lakeShoreFrames()) {
      expect(f.countOpaque()).toBe(f.width * f.height);
      f.forEach((_x, _y, c) => {
        expect(c).not.toBeNull();
      });
    }
  });
});

describe("lakeShore geometry (shared with owMountains)", () => {
  it("a fully-surrounded tile (mask 15) is 100% deep interior", () => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(roundedMaskDist(15, x, y, LAKE_SHORE_CURVE_RADIUS)).toBe(999);
      }
    }
  });

  it("an isolated tile (mask 0) never reaches the deep-interior band", () => {
    let max = -Infinity;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        max = Math.max(max, roundedMaskDist(0, x, y, LAKE_SHORE_CURVE_RADIUS));
      }
    }
    expect(max).toBeLessThan(4);
  });
});

describe("lakeShore determinism", () => {
  it("two builds produce identical frames", () => {
    const a = lakeShoreFrames();
    const b = lakeShoreFrames();
    for (let i = 0; i < a.length; i++) expect(a[i].diff(b[i])).toBe(0);
  });

  it("tiles2.png (which now includes lakeShore) is part of the standard determinism suite", () => {
    const a = buildAssets();
    const b = buildAssets();
    expect(a.tiles2.diff(b.tiles2)).toBe(0);
  });
});
