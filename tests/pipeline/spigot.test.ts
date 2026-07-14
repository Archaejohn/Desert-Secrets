/**
 * Spigot pipeline guarantees (docs/CONTRACTS.md "v6: inventory window,
 * equip, and the spigot"): a single static 16x16 prop frame — same base
 * guarantees as every other sheet (palette compliance, exact grid,
 * non-emptiness, manifest correctness, determinism).
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE_HEX } from "../../src/shared/palette";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { buildManifest } from "../../tools/pipeline/src/manifest";
import { encodePng } from "../../tools/pipeline/src/png";
import { spigotFrames, SPIGOT_FRAME } from "../../tools/pipeline/src/sprites/spigot";

const assets = buildAssets();
const manifest = buildManifest();

describe("spigot sheet layout", () => {
  it("spigot sheet is a single 16x16 frame", () => {
    expect(assets.spigot.width).toBe(16);
    expect(assets.spigot.height).toBe(16);
    const png = PNG.sync.read(encodePng(assets.spigot));
    expect(png.width).toBe(16);
    expect(png.height).toBe(16);
  });

  it("spigotFrames() returns exactly 1 frame of 16x16", () => {
    const frames = spigotFrames();
    expect(frames).toHaveLength(1);
    expect(SPIGOT_FRAME).toBe(16);
    expect([frames[0].width, frames[0].height]).toEqual([16, 16]);
  });
});

describe("spigot palette compliance", () => {
  it("spigot.png pixels are alpha-0 or exact palette colours", () => {
    const png = PNG.sync.read(encodePng(assets.spigot));
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

describe("spigot non-emptiness", () => {
  it("has a solid silhouette (> 15 opaque px)", () => {
    expect(spigotFrames()[0].countOpaque()).toBeGreaterThan(15);
  });
});

describe("spigot determinism", () => {
  it("regenerating twice yields byte-identical PNG bytes and cell-identical grids", () => {
    const a = buildAssets();
    const b = buildAssets();
    expect(encodePng(a.spigot).equals(encodePng(b.spigot))).toBe(true);
    expect(a.spigot.diff(b.spigot)).toBe(0);
  });
});

describe("spigot manifest", () => {
  it("1x1 grid of 16px frames with spigot-idle [0], repeat 0", () => {
    const s = manifest.sheets.spigot;
    expect(s.file).toBe("spigot.png");
    expect(s.frameWidth).toBe(16);
    expect(s.frameHeight).toBe(16);
    expect(s.columns).toBe(1);
    expect(s.rows).toBe(1);
    expect(s.animations).toEqual({
      "spigot-idle": { frames: [0], frameRate: 1, repeat: 0 }
    });
  });

  it("spigot is present alongside every prior sheet, none displaced", () => {
    expect(Object.keys(manifest.sheets)).toContain("spigot");
    expect(manifest.sheets.chicken.file).toBe("chicken.png");
    expect(manifest.sheets.bucket.columns).toBe(2);
  });
});
