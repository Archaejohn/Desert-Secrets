/**
 * Act 4 pipeline guarantees (docs/CONTRACTS.md §13): the midden-mite swarm
 * enemy and the fifth (miners' camp) tileset get the same guarantees as the
 * earlier sets — palette compliance, exact grids, real motion, non-emptiness,
 * a complete manifest — plus the tiles5 legibility contracts (warm floor vs
 * dark wall, solid props, the two overhead camp-decor tiles).
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE, PALETTE_HEX, hexToRgb, type PaletteName } from "../../src/shared/palette";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { buildManifest } from "../../tools/pipeline/src/manifest";
import { encodePng } from "../../tools/pipeline/src/png";
import { middenmiteFrames } from "../../tools/pipeline/src/sprites/middenmite";
import { tile5Frames, TILE5_NAMES } from "../../tools/pipeline/src/tileset5";
import type { PixelGrid } from "../../tools/pipeline/src/grid";

const assets = buildAssets();
const manifest = buildManifest();

/** Tiles drawn above the actors — transparent background, never solid. */
const OVERHEAD = ["stringLights", "laundryLine"] as const;

function count(g: PixelGrid, names: PaletteName[]): number {
  let n = 0;
  g.forEach((_x, _y, c) => {
    if (c !== null && names.includes(c)) n++;
  });
  return n;
}

/** Mean perceived luminance of a tile's opaque pixels (0–255). */
function luminance(g: PixelGrid): number {
  let sum = 0;
  let n = 0;
  g.forEach((_x, _y, c) => {
    if (c === null) return;
    const [r, gr, b] = hexToRgb(PALETTE[c]);
    sum += 0.2126 * r + 0.7152 * gr + 0.0722 * b;
    n++;
  });
  return sum / n;
}

describe("act4 sheet layout (contract §13)", () => {
  const sheets: Array<[string, PixelGrid, number, number]> = [
    ["middenmite", assets.middenmite, 96, 16],
    // tiles5 grew one appended row in the Phase Z 2.5D art pass (dressing
    // tiles 16..23) — contract indices 0..15 are unchanged.
    ["tiles5", assets.tiles5, 128, 48]
  ];

  it.each(sheets)("%s sheet is %ix%i", (_name, grid, w, h) => {
    expect(grid.width).toBe(w);
    expect(grid.height).toBe(h);
    const png = PNG.sync.read(encodePng(grid));
    expect(png.width).toBe(w);
    expect(png.height).toBe(h);
  });

  it("middenmite is 6 square frames; tiles5 is 24 tiles", () => {
    expect(middenmiteFrames()).toHaveLength(6);
    for (const f of middenmiteFrames()) expect([f.width, f.height]).toEqual([16, 16]);
    // 16 contract tiles + the 8 Phase Z dressing tiles (appended only).
    expect(tile5Frames()).toHaveLength(24);
    for (const t of tile5Frames()) expect([t.width, t.height]).toEqual([16, 16]);
  });
});

describe("act4 palette compliance", () => {
  it.each([
    ["middenmite", assets.middenmite],
    ["tiles5", assets.tiles5]
  ] as Array<[string, PixelGrid]>)("%s.png pixels are alpha-0 or exact palette colours", (_n, grid) => {
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

describe("act4 middenmite (small, numerous swarm pest)", () => {
  const frames = middenmiteFrames();

  it("idle twitches and scuttle frames alternate legs", () => {
    expect(frames[0].diff(frames[1])).toBeGreaterThan(0);
    expect(frames[2].diff(frames[3])).toBeGreaterThan(0);
    expect(frames[3].diff(frames[4])).toBeGreaterThan(0);
    expect(frames[4].diff(frames[5])).toBeGreaterThan(0);
  });

  it("has a small silhouette — a tiny pest, not a big beetle", () => {
    for (const f of frames) {
      expect(f.countOpaque()).toBeGreaterThan(20); // it's a real bug
      expect(f.countOpaque()).toBeLessThan(120); // ...but a little one
    }
  });

  it("carries a single amber eye-glint", () => {
    for (const f of frames) expect(count(f, ["amber"])).toBeGreaterThan(0);
  });
});

describe("act4 tiles5 legibility (contract §13)", () => {
  const tiles = tile5Frames();
  const idx = (name: string) => TILE5_NAMES.indexOf(name as (typeof TILE5_NAMES)[number]);
  const tileOf = (name: string) => tiles[idx(name)];

  // The object-props now carry a transparent background so they composite over
  // the ground layer (docs/CONTRACTS.md "v27"); OVERHEAD stays transparent too.
  // Only ground/wall/terrain tiles must be hole-free.
  const TRANSPARENT_PROPS = [
    "crate", "crateStack", "barrel", "washtub", "bedroll", "stove", "campPost", "sockBasket", "crateOpen"
  ];
  it("every ground tile is fully opaque (no holes in maps)", () => {
    for (const name of TILE5_NAMES) {
      if ((OVERHEAD as readonly string[]).includes(name) || TRANSPARENT_PROPS.includes(name)) continue;
      expect(tileOf(name).countOpaque(), `${name} has holes`).toBe(16 * 16);
    }
  });

  it("props carry a transparent background (composite over the ground layer)", () => {
    for (const name of TRANSPARENT_PROPS) {
      expect(tileOf(name).countOpaque(), `${name} not transparent`).toBeLessThan(16 * 16);
    }
  });

  it("the two overhead tiles have transparent backgrounds (drawn over actors)", () => {
    for (const name of OVERHEAD) {
      const t = tileOf(name);
      expect(t.countOpaque()).toBeLessThan(16 * 16);
      expect(t.countOpaque()).toBeGreaterThan(10);
    }
  });

  it("campFloor is clearly brighter (warmer) than the solid campWall", () => {
    const floor = tileOf("campFloor");
    const wall = tileOf("campWall");
    expect(luminance(floor)).toBeGreaterThan(luminance(wall) + 25);
    expect(floor.diff(wall)).toBeGreaterThan(60);
  });

  it("campFloor2 is a distinct grain of the same warm floor", () => {
    const a = tileOf("campFloor");
    const b = tileOf("campFloor2");
    expect(a.diff(b)).toBeGreaterThan(0);
    expect(a.diff(b)).toBeLessThan(64); // same boards, different speckle
  });

  it("the stove glows with fire (hpRed/amber embers)", () => {
    expect(count(tileOf("stove"), ["hpRed", "amber", "atbGold"])).toBeGreaterThan(4);
  });

  it("the washtub holds sky-blue wash water", () => {
    expect(count(tileOf("washtub"), ["skyBlue"])).toBeGreaterThan(10);
  });

  it("the sock basket spills bone/sand socks (the sock-line landmark)", () => {
    expect(count(tileOf("sockBasket"), ["bone", "sandLight"])).toBeGreaterThan(6);
  });

  it("frost prints rime the floor in skyBlue/white (Piggy's night tracks)", () => {
    expect(count(tileOf("frostPrint"), ["skyBlue", "white", "mint"])).toBeGreaterThan(6);
  });

  it("string lights hang warm amber bulbs", () => {
    expect(count(tileOf("stringLights"), ["amber", "atbGold"])).toBeGreaterThan(4);
  });
});

describe("act4 manifest", () => {
  it("middenmite: 6x1 grid of 16px frames with idle + move animations", () => {
    const s = manifest.sheets.middenmite;
    expect(s.file).toBe("middenmite.png");
    expect(s.frameWidth).toBe(16);
    expect(s.frameHeight).toBe(16);
    expect(s.columns).toBe(6);
    expect(s.rows).toBe(1);
    expect(s.animations).toEqual({
      "middenmite-idle": { frames: [0, 1], frameRate: 3, repeat: -1 },
      "middenmite-move": { frames: [2, 3, 4, 5], frameRate: 12, repeat: -1 }
    });
  });

  it("tiles5 keeps the contract name→index map (dressing tiles appended after)", () => {
    expect(manifest.tiles5.file).toBe("tiles5.png");
    expect(manifest.tiles5.tileSize).toBe(16);
    expect(manifest.tiles5.columns).toBe(8);
    // The original 16 contract indices are frozen; the Phase Z dressing
    // tiles append after them (additive only, ART_DIRECTION §7).
    expect(Object.keys(manifest.tiles5.names)).toHaveLength(24);
    expect(manifest.tiles5.names).toMatchObject({
      campFloor: 0,
      campFloor2: 1,
      campRug: 2,
      campWall: 3,
      crate: 4,
      crateStack: 5,
      barrel: 6,
      washtub: 7,
      bedroll: 8,
      stove: 9,
      campPost: 10,
      sockBasket: 11,
      frostPrint: 12,
      crateOpen: 13,
      stringLights: 14,
      laundryLine: 15
    });
  });
});
