/**
 * owBillboards.png — the Mode-7 overworld billboard sheet (Phase O,
 * docs/ART_DIRECTION.md §4b): layout, palette compliance, non-emptiness,
 * bottom anchoring and the manifest contract. Determinism is covered by
 * tests/pipeline/determinism.test.ts via SHEET_KEYS.
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE_HEX } from "../../src/shared/palette";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { encodePng } from "../../tools/pipeline/src/png";
import { buildManifest } from "../../tools/pipeline/src/manifest";
import {
  OW_BILLBOARD_H,
  OW_BILLBOARD_NAMES,
  OW_BILLBOARD_W,
  owBillboardFrames
} from "../../tools/pipeline/src/sprites/owBillboards";

const frames = owBillboardFrames();

describe("owBillboards layout", () => {
  it("holds six 48x40 frames in one row (288x40 sheet)", () => {
    expect(frames).toHaveLength(6);
    for (const f of frames) expect([f.width, f.height]).toEqual([OW_BILLBOARD_W, OW_BILLBOARD_H]);
    const sheet = buildAssets().owBillboards;
    expect(sheet.width).toBe(OW_BILLBOARD_W * 6);
    expect(sheet.height).toBe(OW_BILLBOARD_H);
    const png = PNG.sync.read(encodePng(sheet));
    expect(png.width).toBe(288);
    expect(png.height).toBe(40);
  });
});

describe("owBillboards palette compliance", () => {
  it("pixels are alpha-0 or exact palette colours", () => {
    const png = PNG.sync.read(encodePng(buildAssets().owBillboards));
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

describe("owBillboards frame design", () => {
  it("every frame has a solid standing silhouette on transparent ground", () => {
    for (const f of frames) {
      const opaque = f.countOpaque();
      expect(opaque).toBeGreaterThan(200); // a real mass, not a sliver
      expect(opaque).toBeLessThan(OW_BILLBOARD_W * OW_BILLBOARD_H); // not a full card
    }
  });

  it("frames are bottom-anchored: feet on the last row, ink at the contact edge", () => {
    for (const f of frames) {
      let bottomOpaque = 0;
      let bottomInk = 0;
      for (let x = 0; x < f.width; x++) {
        const c = f.get(x, f.height - 1);
        if (c !== null) bottomOpaque++;
        if (c === "ink") bottomInk++;
      }
      expect(bottomOpaque).toBeGreaterThan(8);
      expect(bottomInk).toBe(bottomOpaque); // G8: ink only along ground contact
    }
  });

  it("the three mountain masses are genuinely distinct variants", () => {
    expect(frames[0].diff(frames[1])).toBeGreaterThan(150);
    expect(frames[1].diff(frames[2])).toBeGreaterThan(150);
    expect(frames[0].diff(frames[2])).toBeGreaterThan(150);
  });

  it("mountain masses are lit NW / shaded SE (left half brighter than right)", () => {
    const litNames = ["sandLight", "sand", "clay", "amber"];
    for (const f of [frames[0], frames[1], frames[2]]) {
      let leftLit = 0;
      let rightLit = 0;
      f.forEach((x, _y, c) => {
        if (c !== null && litNames.includes(c)) {
          if (x < f.width / 2) leftLit++;
          else rightLit++;
        }
      });
      expect(leftLit).toBeGreaterThan(rightLit);
    }
  });

  it("the joshua tree carries vegetation-ramp foliage; the mine mouth a dark opening", () => {
    let veg = 0;
    frames[3].forEach((_x, _y, c) => {
      if (c === "jade" || c === "teal" || c === "mint") veg++;
    });
    expect(veg).toBeGreaterThan(20);
    let mouth = 0;
    frames[4].forEach((_x, y, c) => {
      if (c === "ink" && y < frames[4].height - 1) mouth++;
    });
    expect(mouth).toBeGreaterThan(40);
  });
});

describe("owBillboards manifest contract", () => {
  it("exposes the sheet with the frozen name→frame map", () => {
    const m = buildManifest();
    expect(m.owBillboards.file).toBe("owBillboards.png");
    expect(m.owBillboards.frameWidth).toBe(48);
    expect(m.owBillboards.frameHeight).toBe(40);
    expect(m.owBillboards.columns).toBe(6);
    expect(m.owBillboards.names).toEqual({
      mountainMassA: 0,
      mountainMassB: 1,
      mountainMassC: 2,
      joshuaTree: 3,
      mineMouth: 4,
      truckWreck: 5
    });
    expect(OW_BILLBOARD_NAMES).toHaveLength(6);
  });
});
