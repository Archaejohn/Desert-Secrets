/**
 * Act 1 retcon pipeline guarantees (docs/CONTRACTS.md "Act 1 retcon: John &
 * Pamela replace Sahra (v4)"): the three new sheets (john, pamela, chicken)
 * get the same guarantees as every earlier batch — palette compliance,
 * exact grids, real motion, non-emptiness, a complete manifest — plus a
 * handful of design-specific checks (John's wide-brim hat and ink boots,
 * Pamela's jade/teal apron, the chicken's single rust comb accent).
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE_HEX, type PaletteName } from "../../src/shared/palette";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { buildManifest } from "../../tools/pipeline/src/manifest";
import { encodePng } from "../../tools/pipeline/src/png";
import { johnFrames } from "../../tools/pipeline/src/sprites/john";
import { pamelaFrames } from "../../tools/pipeline/src/sprites/pamela";
import { chickenFrames } from "../../tools/pipeline/src/sprites/chicken";
import type { PixelGrid } from "../../tools/pipeline/src/grid";

const assets = buildAssets();
const manifest = buildManifest();

function count(g: PixelGrid, names: PaletteName[]): number {
  let n = 0;
  g.forEach((_x, _y, c) => {
    if (c !== null && names.includes(c)) n++;
  });
  return n;
}

const newSheets: Array<[string, PixelGrid, number, number]> = [
  ["john", assets.john, 96, 96],
  ["pamela", assets.pamela, 96, 96],
  ["chicken", assets.chicken, 96, 16]
];

describe("act1-retcon sheet layout", () => {
  it.each(newSheets)("%s sheet is %ix%i", (_name, grid, w, h) => {
    expect(grid.width).toBe(w);
    expect(grid.height).toBe(h);
    const png = PNG.sync.read(encodePng(grid));
    expect(png.width).toBe(w);
    expect(png.height).toBe(h);
  });

  it("john/pamela hold 24 16x24 frames; chicken holds 6 16x16 frames", () => {
    expect(johnFrames()).toHaveLength(24);
    expect(pamelaFrames()).toHaveLength(24);
    for (const f of [...johnFrames(), ...pamelaFrames()]) {
      expect([f.width, f.height]).toEqual([16, 24]);
    }
    expect(chickenFrames()).toHaveLength(6);
    for (const f of chickenFrames()) expect([f.width, f.height]).toEqual([16, 16]);
  });
});

describe("act1-retcon palette compliance", () => {
  it.each(newSheets)("%s.png pixels are alpha-0 or exact palette colours", (_name, grid) => {
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

describe("act1-retcon motion", () => {
  it.each([
    ["john", johnFrames()],
    ["pamela", pamelaFrames()]
  ] as const)("%s: idle frames breathe and walk frames stride in every direction", (_name, frames) => {
    for (let row = 0; row < 4; row++) {
      const base = row * 6;
      // idle bob
      expect(frames[base].diff(frames[base + 1])).toBeGreaterThan(0);
      // real limb motion between contact and passing poses
      expect(frames[base + 2].diff(frames[base + 3])).toBeGreaterThanOrEqual(8);
      expect(frames[base + 3].diff(frames[base + 4])).toBeGreaterThanOrEqual(8);
      // the two contact poses mirror the stride
      expect(frames[base + 2].diff(frames[base + 4])).toBeGreaterThan(0);
    }
  });

  it("chicken: idle head-bob differs, strut frames alternate by at least 6px (16px creature threshold)", () => {
    const f = chickenFrames();
    expect(f[0].diff(f[1])).toBeGreaterThan(0);
    expect(f[2].diff(f[3])).toBeGreaterThanOrEqual(6);
    expect(f[3].diff(f[4])).toBeGreaterThanOrEqual(6);
    expect(f[4].diff(f[5])).toBeGreaterThanOrEqual(6);
    // the two strut-contact poses are distinct (left vs right foot forward)
    expect(f[2].diff(f[4])).toBeGreaterThan(0);
  });

  it("chicken: idle head dips 1-2px between frame 0 and frame 1 (peck)", () => {
    const f = chickenFrames();
    // the head/comb/beak/eye block occupies rows 1-6 on frame 0 and shifts
    // down by 2px on frame 1; probe the comb pixel that must move.
    expect(f[0].get(11, 1)).toBe("rust");
    expect(f[1].get(11, 1)).toBeNull();
    expect(f[1].get(11, 3)).toBe("rust");
  });
});

describe("act1-retcon colourways", () => {
  it("john: rust/clay work shirt, slate trousers, sand hat, ink boots dominate", () => {
    for (const f of johnFrames()) {
      expect(count(f, ["rust"])).toBeGreaterThan(30); // shirt
      expect(count(f, ["sand", "sandLight"])).toBeGreaterThan(10); // hat
      expect(count(f, ["slate"])).toBeGreaterThan(5); // trousers
    }
    // ink boots: probe the planted feet on the down idle frame
    const down = johnFrames()[0];
    expect(down.get(4, 21)).toBe("ink");
    expect(down.get(10, 21)).toBe("ink");
  });

  it("john's hat brim is wider than his shoulders (signature silhouette)", () => {
    const down = johnFrames()[0];
    // brim row (y=4) spans wider than the collar row (y=9, before the arms
    // extend the silhouette further out at y=10+)
    let brimWidth = 0;
    for (let x = 0; x < 16; x++) if (down.get(x, 4) !== null) brimWidth++;
    let shoulderWidth = 0;
    for (let x = 0; x < 16; x++) if (down.get(x, 9) !== null) shoulderWidth++;
    expect(brimWidth).toBeGreaterThan(shoulderWidth);
  });

  it("pamela: jade/teal apron reads strongest on the front-facing rows", () => {
    const frames = pamelaFrames();
    for (let i = 0; i < 6; i++) {
      expect(count(frames[i], ["jade", "teal"])).toBeGreaterThan(15);
    }
    for (const f of frames) {
      expect(count(f, ["bone"])).toBeGreaterThan(5); // blouse
    }
  });

  it("pamela's bun is marked with a rust ribbon on the back-facing rows", () => {
    const up = pamelaFrames()[18]; // up row, frame 0
    expect(count(up, ["rust"])).toBeGreaterThan(0);
  });

  it("chicken: bone/sand feathers dominate with a small rust comb accent and amber beak/feet", () => {
    for (const f of chickenFrames()) {
      expect(count(f, ["bone", "sand"])).toBeGreaterThan(40);
      expect(count(f, ["amber"])).toBeGreaterThan(2);
      const comb = count(f, ["rust"]);
      expect(comb).toBeGreaterThan(0);
      expect(comb).toBeLessThanOrEqual(4); // "small" accent, not a dominant colour
    }
  });
});

describe("act1-retcon non-emptiness", () => {
  it("every john/pamela frame has a solid silhouette (> 60 opaque px)", () => {
    for (const f of [...johnFrames(), ...pamelaFrames()]) {
      expect(f.countOpaque()).toBeGreaterThan(60);
    }
  });

  it("every chicken frame has a solid silhouette (> 60 opaque px)", () => {
    for (const f of chickenFrames()) {
      expect(f.countOpaque()).toBeGreaterThan(60);
    }
  });
});

describe("act1-retcon manifest", () => {
  const dirs = ["down", "left", "right", "up"] as const;

  it.each(["john", "pamela"] as const)(
    "%s: geometry and exactly 8 animation keys (hero pattern)",
    (prefix) => {
      const sheet = manifest.sheets[prefix];
      expect(sheet.file).toBe(`${prefix}.png`);
      expect(sheet.frameWidth).toBe(16);
      expect(sheet.frameHeight).toBe(24);
      expect(sheet.columns).toBe(6);
      expect(sheet.rows).toBe(4);
      const expectedKeys = dirs.flatMap((d) => [`${prefix}-idle-${d}`, `${prefix}-walk-${d}`]);
      expect(Object.keys(sheet.animations).sort()).toEqual([...expectedKeys].sort());
      dirs.forEach((dir, row) => {
        const base = row * 6;
        expect(sheet.animations[`${prefix}-idle-${dir}`]).toEqual({
          frames: [base, base + 1],
          frameRate: 2,
          repeat: -1
        });
        expect(sheet.animations[`${prefix}-walk-${dir}`]).toEqual({
          frames: [base + 2, base + 3, base + 4, base + 5],
          frameRate: 10,
          repeat: -1
        });
      });
    }
  );

  it("chicken: 6x1 grid of 16px frames with chicken-idle [0,1] fr3 and chicken-move [2..5] fr10", () => {
    const s = manifest.sheets.chicken;
    expect(s.file).toBe("chicken.png");
    expect(s.frameWidth).toBe(16);
    expect(s.frameHeight).toBe(16);
    expect(s.columns).toBe(6);
    expect(s.rows).toBe(1);
    expect(s.animations).toEqual({
      "chicken-idle": { frames: [0, 1], frameRate: 3, repeat: -1 },
      "chicken-move": { frames: [2, 3, 4, 5], frameRate: 10, repeat: -1 }
    });
  });

  it("all twenty sheets are present, prior entries untouched", () => {
    expect(Object.keys(manifest.sheets).sort()).toEqual(
      [
        "hero",
        "npc",
        "scarab",
        "rosa",
        "john",
        "pamela",
        "chicken",
        "piggy",
        "jackrabbit",
        "buzzard",
        "gila",
        "foreman",
        "queen",
        "slither",
        "miner",
        "fluffball",
        "icebat",
        "crystalcrawler",
        "frostscarab",
        "warden"
      ].sort()
    );
    // spot-check a couple of pre-existing entries are unaffected
    expect(manifest.sheets.rosa.file).toBe("rosa.png");
    expect(manifest.sheets.miner.file).toBe("miner.png");
    expect(manifest.tiles.names.sand).toBe(0);
    expect(manifest.tiles3.names.mossGlow).toBe(15);
  });
});
