/**
 * Pipeline guarantees: palette compliance, sheet layout, frame motion and
 * non-emptiness. Everything runs on the pure builders — no disk access.
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE_HEX } from "../../src/shared/palette";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { encodePng } from "../../tools/pipeline/src/png";
import { heroFrames } from "../../tools/pipeline/src/sprites/hero";
import { npcFrames } from "../../tools/pipeline/src/sprites/npc";
import { scarabFrames } from "../../tools/pipeline/src/sprites/scarab";
import { tileFrames } from "../../tools/pipeline/src/tileset";
import type { PixelGrid } from "../../tools/pipeline/src/grid";

const assets = buildAssets();
const sheets: Array<[string, PixelGrid, number, number]> = [
  ["hero", assets.hero, 96, 96],
  ["npc", assets.npc, 96, 96],
  ["scarab", assets.scarab, 144, 24],
  ["tiles", assets.tiles, 128, 32]
];

describe("sheet layout (contract §1)", () => {
  it.each(sheets)("%s sheet is %ix%i", (_name, grid, w, h) => {
    expect(grid.width).toBe(w);
    expect(grid.height).toBe(h);
    const png = PNG.sync.read(encodePng(grid));
    expect(png.width).toBe(w);
    expect(png.height).toBe(h);
  });

  it("character sheets hold 24 16x24 frames; scarab 6 of 24x24; tiles 16 of 16x16", () => {
    expect(heroFrames()).toHaveLength(24);
    expect(npcFrames()).toHaveLength(24);
    expect(scarabFrames()).toHaveLength(6);
    expect(tileFrames()).toHaveLength(16);
    for (const f of [...heroFrames(), ...npcFrames()]) {
      expect([f.width, f.height]).toEqual([16, 24]);
    }
    for (const f of scarabFrames()) expect([f.width, f.height]).toEqual([24, 24]);
    for (const f of tileFrames()) expect([f.width, f.height]).toEqual([16, 16]);
  });
});

describe("palette compliance", () => {
  it.each(sheets)("%s.png pixels are alpha-0 or exact palette colours", (_name, grid) => {
    const png = PNG.sync.read(encodePng(grid));
    for (let i = 0; i < png.data.length; i += 4) {
      const a = png.data[i + 3];
      if (a === 0) continue;
      expect(a).toBe(255);
      const hex =
        "#" +
        [png.data[i], png.data[i + 1], png.data[i + 2]]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
      if (!PALETTE_HEX.includes(hex)) {
        throw new Error(`non-palette colour ${hex} at byte ${i}`);
      }
    }
  });
});

describe("motion", () => {
  const rows = ["down", "left", "right", "up"];

  for (const [name, frames] of [
    ["hero", heroFrames()],
    ["npc", npcFrames()]
  ] as const) {
    it(`${name}: idle frames breathe and walk frames stride in every direction`, () => {
      rows.forEach((_dir, r) => {
        const base = r * 6;
        // idle bob
        expect(frames[base].diff(frames[base + 1])).toBeGreaterThan(0);
        // real limb motion between contact and passing poses
        expect(frames[base + 2].diff(frames[base + 3])).toBeGreaterThanOrEqual(8);
        expect(frames[base + 3].diff(frames[base + 4])).toBeGreaterThanOrEqual(8);
        // the two contact poses mirror the stride
        expect(frames[base + 2].diff(frames[base + 4])).toBeGreaterThan(0);
      });
    });
  }

  it("scarab: idle twitches, skitter frames alternate", () => {
    const f = scarabFrames();
    expect(f[0].diff(f[1])).toBeGreaterThan(0);
    expect(f[2].diff(f[3])).toBeGreaterThanOrEqual(8);
    expect(f[3].diff(f[4])).toBeGreaterThanOrEqual(8);
  });

  it("water animates: tile 8 vs tile 9 differ", () => {
    const tiles = tileFrames();
    expect(tiles[8].diff(tiles[9])).toBeGreaterThan(0);
  });
});

describe("non-emptiness", () => {
  it("every character/enemy frame has a solid silhouette (> 60 opaque px)", () => {
    for (const f of [...heroFrames(), ...npcFrames(), ...scarabFrames()]) {
      expect(f.countOpaque()).toBeGreaterThan(60);
    }
  });

  it("every tile is fully opaque (no holes in maps)", () => {
    for (const t of tileFrames()) expect(t.countOpaque()).toBe(16 * 16);
  });
});
