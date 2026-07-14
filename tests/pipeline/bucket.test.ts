/**
 * Bucket pipeline guarantees (docs/CONTRACTS.md "Act 1 addition: the bucket
 * fetch-quest + a minimal inventory (v5)"): a static two-frame prop, not a
 * creature — no idle/move cycle. Same base guarantees as every other sheet
 * (palette compliance, exact grid, non-emptiness, manifest correctness,
 * determinism) plus the one thing that matters for a static prop: frame 0
 * (empty) and frame 1 (full) must visibly differ, concentrated in the
 * interior/rim-opening region.
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE_HEX } from "../../src/shared/palette";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { buildManifest } from "../../tools/pipeline/src/manifest";
import { encodePng } from "../../tools/pipeline/src/png";
import { bucketFrames, BUCKET_FRAME } from "../../tools/pipeline/src/sprites/bucket";

const assets = buildAssets();
const manifest = buildManifest();

describe("bucket sheet layout", () => {
  it("bucket sheet is 32x16 (2x1 grid of 16x16 frames)", () => {
    expect(assets.bucket.width).toBe(32);
    expect(assets.bucket.height).toBe(16);
    const png = PNG.sync.read(encodePng(assets.bucket));
    expect(png.width).toBe(32);
    expect(png.height).toBe(16);
  });

  it("bucketFrames() returns exactly 2 frames of 16x16", () => {
    const frames = bucketFrames();
    expect(frames).toHaveLength(2);
    expect(BUCKET_FRAME).toBe(16);
    for (const f of frames) expect([f.width, f.height]).toEqual([16, 16]);
  });
});

describe("bucket palette compliance", () => {
  it("bucket.png pixels are alpha-0 or exact palette colours", () => {
    const png = PNG.sync.read(encodePng(assets.bucket));
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

describe("bucket is a static prop, not a creature", () => {
  it("frame 0 (empty) and frame 1 (full) differ meaningfully, concentrated in the interior", () => {
    const [empty, full] = bucketFrames();
    const diffCount = empty.diff(full);
    expect(diffCount).toBeGreaterThanOrEqual(6);

    // every differing pixel must sit in the interior/rim-opening region
    // (a single row just under the rim lip) — the shell itself is
    // pixel-identical between the two frames.
    let diffsOutsideInterior = 0;
    empty.forEach((x, y, c) => {
      if (c !== full.get(x, y)) {
        const inInterior = y === 4 && x >= 5 && x <= 10;
        if (!inInterior) diffsOutsideInterior++;
      }
    });
    expect(diffsOutsideInterior).toBe(0);
  });

  it("empty frame's interior reads as an ink hollow", () => {
    const [empty] = bucketFrames();
    for (let x = 5; x <= 10; x++) expect(empty.get(x, 4)).toBe("ink");
  });

  it("full frame's interior shows skyBlue/mint water with exactly one white glint", () => {
    const [, full] = bucketFrames();
    let waterCount = 0;
    let glintCount = 0;
    for (let x = 5; x <= 10; x++) {
      const c = full.get(x, 4);
      if (c === "skyBlue" || c === "mint") waterCount++;
      if (c === "white") glintCount++;
    }
    expect(waterCount).toBeGreaterThan(0);
    expect(glintCount).toBe(1);
  });
});

describe("bucket non-emptiness", () => {
  it("both frames have a solid silhouette (> 15 opaque px)", () => {
    for (const f of bucketFrames()) {
      expect(f.countOpaque()).toBeGreaterThan(15);
    }
  });
});

describe("bucket determinism", () => {
  it("regenerating twice yields byte-identical PNG bytes and cell-identical grids", () => {
    const a = buildAssets();
    const b = buildAssets();
    expect(encodePng(a.bucket).equals(encodePng(b.bucket))).toBe(true);
    expect(a.bucket.diff(b.bucket)).toBe(0);
  });
});

describe("bucket manifest", () => {
  it("2x1 grid of 16px frames with bucket-empty [0] and bucket-full [1], both repeat 0", () => {
    const s = manifest.sheets.bucket;
    expect(s.file).toBe("bucket.png");
    expect(s.frameWidth).toBe(16);
    expect(s.frameHeight).toBe(16);
    expect(s.columns).toBe(2);
    expect(s.rows).toBe(1);
    expect(s.animations).toEqual({
      "bucket-empty": { frames: [0], frameRate: 1, repeat: 0 },
      "bucket-full": { frames: [1], frameRate: 1, repeat: 0 }
    });
  });

  it("bucket is present alongside every prior sheet, none displaced", () => {
    expect(Object.keys(manifest.sheets).sort()).toEqual(
      [
        "hero",
        "npc",
        "scarab",
        "rosa",
        "john",
        "pamela",
        "chicken",
        "bucket",
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
    expect(manifest.sheets.chicken.file).toBe("chicken.png");
    expect(manifest.sheets.piggy.columns).toBe(6);
  });
});
