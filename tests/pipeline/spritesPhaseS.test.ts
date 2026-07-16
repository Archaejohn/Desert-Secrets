/**
 * Phase S (sprites) guarantees — docs/ART_DIRECTION.md §6:
 * - the two NEW sheets (dusty, sahra) get the full pipeline treatment:
 *   layout, palette compliance, real motion, non-emptiness, manifest entries;
 * - the sel-out polish pass actually landed: polished sheets carry the
 *   material-dark contour (umber on warm sprites) instead of a blanket ink
 *   outline, while ink remains at the ground-contact edge under the feet.
 * Byte-stability pins for every repainted sheet live in determinism.test.ts.
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE_HEX } from "../../src/shared/palette";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { buildManifest } from "../../tools/pipeline/src/manifest";
import { encodePng } from "../../tools/pipeline/src/png";
import { dustyFrames } from "../../tools/pipeline/src/sprites/dusty";
import { sahraFrames } from "../../tools/pipeline/src/sprites/sahra";
import { heroFrames } from "../../tools/pipeline/src/sprites/hero";
import { contourOf, highlightOf } from "../../tools/pipeline/src/sprites/polish";
import { PALETTE, type PaletteName } from "../../src/shared/palette";
import type { PixelGrid } from "../../tools/pipeline/src/grid";

const assets = buildAssets();
const manifest = buildManifest();

function count(g: PixelGrid, names: readonly string[]): number {
  let n = 0;
  g.forEach((_x, _y, c) => {
    if (c !== null && names.includes(c)) n++;
  });
  return n;
}

describe("phase S sheet layout", () => {
  const sheets: Array<[string, PixelGrid, number, number]> = [
    ["dusty", assets.dusty, 144, 24],
    ["sahra", assets.sahra, 96, 96]
  ];

  it.each(sheets)("%s sheet is %ix%i", (_name, grid, w, h) => {
    expect(grid.width).toBe(w);
    expect(grid.height).toBe(h);
    const png = PNG.sync.read(encodePng(grid));
    expect(png.width).toBe(w);
    expect(png.height).toBe(h);
  });

  it("dusty holds 6 24x24 frames; sahra 24 16x24 frames", () => {
    expect(dustyFrames()).toHaveLength(6);
    for (const f of dustyFrames()) expect([f.width, f.height]).toEqual([24, 24]);
    expect(sahraFrames()).toHaveLength(24);
    for (const f of sahraFrames()) expect([f.width, f.height]).toEqual([16, 24]);
  });

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
      if (!PALETTE_HEX.includes(hex)) throw new Error(`non-palette colour ${hex} at byte ${i}`);
    }
  });
});

describe("phase S motion", () => {
  it("dusty: idle twitches and scurry frames alternate (24px thresholds)", () => {
    const f = dustyFrames();
    expect(f[0].diff(f[1])).toBeGreaterThan(0);
    expect(f[2].diff(f[3])).toBeGreaterThanOrEqual(8);
    expect(f[3].diff(f[4])).toBeGreaterThanOrEqual(8);
    expect(f[4].diff(f[5])).toBeGreaterThanOrEqual(8);
    expect(f[2].diff(f[4])).toBeGreaterThan(0);
  });

  it("sahra: idle frames breathe and walk frames stride in every direction", () => {
    const frames = sahraFrames();
    for (let row = 0; row < 4; row++) {
      const base = row * 6;
      expect(frames[base].diff(frames[base + 1])).toBeGreaterThan(0);
      expect(frames[base + 2].diff(frames[base + 3])).toBeGreaterThanOrEqual(8);
      expect(frames[base + 3].diff(frames[base + 4])).toBeGreaterThanOrEqual(8);
      expect(frames[base + 2].diff(frames[base + 4])).toBeGreaterThan(0);
    }
  });
});

describe("phase S design reads", () => {
  it("dusty is a desert rat: clay/sand coat, big ears, a gold trinket on idle", () => {
    for (const f of dustyFrames()) {
      expect(count(f, ["clay"])).toBeGreaterThan(40); // the coat
      expect(count(f, ["sand", "sandLight"])).toBeGreaterThan(5); // belly + inner ears
      expect(count(f, ["sandShade"])).toBeGreaterThan(1); // the bald tail
    }
    // the hoard: gold trinket clutched on both idle frames, absent while scurrying
    expect(count(dustyFrames()[0], ["atbGold"])).toBeGreaterThan(2);
    expect(count(dustyFrames()[2], ["atbGold"])).toBe(0);
  });

  it("sahra wears the teal/jade head-wrap over a bone/sand robe", () => {
    for (const f of sahraFrames()) {
      expect(count(f, ["teal", "jade", "tealDeep"])).toBeGreaterThan(10); // the wrap
      expect(count(f, ["bone"])).toBeGreaterThan(25); // the long robe
      expect(count(f, ["umber"])).toBeGreaterThan(5); // walking stick + sel-out
    }
  });
});

describe("phase S non-emptiness", () => {
  it("every dusty frame > 100 opaque px; every sahra frame > 60", () => {
    for (const f of dustyFrames()) expect(f.countOpaque()).toBeGreaterThan(100);
    for (const f of sahraFrames()) expect(f.countOpaque()).toBeGreaterThan(60);
  });
});

describe("phase S sel-out polish (G8)", () => {
  it("hero carries the umber material contour and ink under the feet", () => {
    const down = heroFrames()[0];
    // sel-out: the warm head contour is umber, not ink
    expect(count(down, ["umber"])).toBeGreaterThan(5);
    // ground contact stays ink: the cell directly under each planted sole
    let inkUnderFeet = 0;
    for (let x = 0; x < down.width; x++) {
      for (let y = 1; y < down.height; y++) {
        if (down.get(x, y) === "ink" && down.get(x, y - 1) !== null && down.get(x, y - 1) !== "ink") {
          inkUnderFeet++;
        }
      }
    }
    expect(inkUnderFeet).toBeGreaterThan(0);
  });

  it("the polish LUTs are total over the palette and stay inside it", () => {
    const names = Object.keys(PALETTE) as PaletteName[];
    for (const map of [contourOf, highlightOf]) {
      for (const name of names) {
        expect(map[name], `missing LUT entry for ${name}`).toBeDefined();
        expect(names).toContain(map[name]);
      }
    }
    // rim highlights must never mint a new `white` glint (several sheets pin
    // exact white counts) — only white itself maps to white
    for (const name of names) {
      if (name !== "white") expect(highlightOf[name]).not.toBe("white");
    }
  });
});

describe("phase S manifest", () => {
  const dirs = ["down", "left", "right", "up"] as const;

  it("dusty: 6x1 grid of 24px frames with idle + move animations", () => {
    const s = manifest.sheets.dusty;
    expect(s.file).toBe("dusty.png");
    expect(s.frameWidth).toBe(24);
    expect(s.frameHeight).toBe(24);
    expect(s.columns).toBe(6);
    expect(s.rows).toBe(1);
    expect(s.animations).toEqual({
      "dusty-idle": { frames: [0, 1], frameRate: 3, repeat: -1 },
      "dusty-move": { frames: [2, 3, 4, 5], frameRate: 10, repeat: -1 }
    });
  });

  it("sahra: geometry and exactly 8 animation keys (hero pattern)", () => {
    const sheet = manifest.sheets.sahra;
    expect(sheet.file).toBe("sahra.png");
    expect(sheet.frameWidth).toBe(16);
    expect(sheet.frameHeight).toBe(24);
    expect(sheet.columns).toBe(6);
    expect(sheet.rows).toBe(4);
    const expectedKeys = dirs.flatMap((d) => [`sahra-idle-${d}`, `sahra-walk-${d}`]);
    expect(Object.keys(sheet.animations).sort()).toEqual([...expectedKeys].sort());
    dirs.forEach((dir, row) => {
      const base = row * 6;
      expect(sheet.animations[`sahra-idle-${dir}`]).toEqual({
        frames: [base, base + 1],
        frameRate: 2,
        repeat: -1
      });
      expect(sheet.animations[`sahra-walk-${dir}`]).toEqual({
        frames: [base + 2, base + 3, base + 4, base + 5],
        frameRate: 10,
        repeat: -1
      });
    });
  });
});
