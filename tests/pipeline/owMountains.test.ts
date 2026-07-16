/**
 * owMountains.png — the rounded-corner overworld mountain blob autotile
 * (docs/ART_DIRECTION.md §4a follow-up; docs/CONTRACTS.md "owMountains"):
 * layout, determinism, palette compliance, non-emptiness/full-opacity, and
 * the geometric edge-rounding contract itself (evaluated directly against
 * `mountainDistToGrass`, not inferred from generated pixel colours, since
 * some colour names are legitimately shared between the transition-band
 * and interior-peak code paths).
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE_HEX } from "../../src/shared/palette";
import { buildAssets, SHEET_KEYS } from "../../tools/pipeline/src/assets";
import { encodePng } from "../../tools/pipeline/src/png";
import {
  MOUNTAIN_CURVE_RADIUS,
  MOUNTAIN_MASK_COUNT,
  MOUNTAIN_VARIANT_COUNT,
  mountainDistToGrass,
  owMountainFrames,
  owMountainNames
} from "../../tools/pipeline/src/owMountains";

describe("owMountains layout", () => {
  it("holds 80 16x16 frames (5 variants x 16 masks) in an 8-column, 10-row sheet", () => {
    expect(MOUNTAIN_VARIANT_COUNT).toBe(5);
    expect(MOUNTAIN_MASK_COUNT).toBe(16);
    const frames = owMountainFrames();
    expect(frames).toHaveLength(80);
    for (const f of frames) expect([f.width, f.height]).toEqual([16, 16]);
    expect(owMountainNames).toHaveLength(80);

    const sheet = buildAssets().owMountains;
    expect(sheet.width).toBe(16 * 8);
    expect(sheet.height).toBe(16 * 10);
  });

  it("names are variant-major, mask-minor: owMountain{0..4}_{0..15}", () => {
    let i = 0;
    for (let variant = 0; variant < 5; variant++) {
      for (let mask = 0; mask < 16; mask++) {
        expect(owMountainNames[i]).toBe(`owMountain${variant}_${mask}`);
        i++;
      }
    }
  });

  it("uses the exact tuned curve radius", () => {
    expect(MOUNTAIN_CURVE_RADIUS).toBe(16.5);
  });
});

describe("owMountains determinism", () => {
  it("two builds produce identical frames and PNG bytes", () => {
    const a = owMountainFrames();
    const b = owMountainFrames();
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(a[i].diff(b[i])).toBe(0);

    const sheetA = buildAssets().owMountains;
    const sheetB = buildAssets().owMountains;
    expect(encodePng(sheetA).equals(encodePng(sheetB))).toBe(true);
  });

  it("is included in the pipeline's SHEET_KEYS (covered by the global determinism suite)", () => {
    expect(SHEET_KEYS).toContain("owMountains");
  });
});

describe("owMountains palette compliance and opacity", () => {
  it("every pixel is an exact palette colour (never null/transparent)", () => {
    const frames = owMountainFrames();
    for (const f of frames) {
      expect(f.countOpaque()).toBe(f.width * f.height);
      f.forEach((_x, _y, c) => {
        expect(c).not.toBeNull();
      });
    }
  });

  it("encodes to alpha-255 pixels at exact palette colours", () => {
    const png = encodePng(buildAssets().owMountains);
    const decoded = PNG.sync.read(png);
    for (let i = 0; i < decoded.data.length; i += 4) {
      expect(decoded.data[i + 3]).toBe(255);
      const hex =
        "#" +
        [decoded.data[i], decoded.data[i + 1], decoded.data[i + 2]]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
      expect(PALETTE_HEX).toContain(hex);
    }
  });
});

describe("owMountains geometric edge-rounding contract", () => {
  // mask = 15 (N+E+S+W all set, i.e. a mountain cell fully surrounded by
  // more mountain on every side) forces every quadrant of the reference
  // per-pixel formula into its "both adjacent sides blocked" branch, which
  // never assigns a real distance — it stays at the 999 sentinel for every
  // pixel, regardless of seed/RNG fuzz (+/-0.75 can't bring 999 anywhere
  // near the <4 foothill cutoff). So a fully-surrounded tile is
  // mathematically guaranteed to be 100% interior/peak texture: literally
  // zero pixels reachable in the sand (<1), dusty (<2) or foothill (<4)
  // transition bands.
  it("mask=15 (fully surrounded) never reaches a transition band — always deep interior", () => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(mountainDistToGrass(15, x, y)).toBe(999);
      }
    }
  });

  it("mask=15 tiles contain none of the transition-band-only colours (sandLight, amber)", () => {
    // sandLight only appears in the <1 sand ring, amber only in the <2 dusty
    // ring (both provably unreachable for mask 15) — this is a real,
    // colour-level check on top of the pure-geometry one above, but the
    // pure check is authoritative since "sand"/"clay" are legitimately
    // reused by the interior's lit-NW flank.
    for (let variant = 0; variant < 5; variant++) {
      const idx = variant * 16 + 15;
      const tile = owMountainFrames()[idx];
      let found = false;
      tile.forEach((_x, _y, c) => {
        if (c === "sandLight" || c === "amber") found = true;
      });
      expect(found).toBe(false);
    }
  });

  // mask = 0 (no neighbor on any side — a fully isolated single mountain
  // cell surrounded by open sand/path on all four sides). Evaluating the
  // ported formula directly (curveRadius 16.5 exceeds the tile's own
  // half-width of 8, so its rounding arc reaches well past the tile) shows
  // the OPPOSITE of what a smaller-radius intuition would suggest: the
  // extreme tile-corner pixels (0,0)/(15,0)/(0,15)/(15,15) land deep in the
  // sand transition band (fuzzyDist ~ -6.8, far below the <1 cutoff), and
  // even the single farthest-from-every-edge point (tile center, ~3.06)
  // never clears the <4 foothill cutoff into true deep-interior/peak
  // texture. In other words: at this deliberately large, untouched curve
  // radius, an isolated single-cell mountain tile reads entirely as a
  // small rounded sand/foothill mound with NO peak texture anywhere — not
  // "big peak, rounded corners". This is a direct, verified consequence of
  // porting the reference formula exactly as given (task instruction: "port
  // it exactly as given, don't fix it") rather than an assumption.
  it("mask=0 (fully isolated): extreme corners are deep in the sand band, not interior", () => {
    for (const [x, y] of [
      [0, 0],
      [15, 0],
      [0, 15],
      [15, 15]
    ] as const) {
      expect(mountainDistToGrass(0, x, y)).toBeLessThan(1);
    }
  });

  it("mask=0 (fully isolated): no pixel anywhere reaches the deep-interior/peak threshold", () => {
    let max = -Infinity;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        max = Math.max(max, mountainDistToGrass(0, x, y));
      }
    }
    expect(max).toBeLessThan(4);
  });
});

describe("owMountains variant distinctiveness", () => {
  it("the five families are visually distinct for the same mask (different crag/fleck texture)", () => {
    const frames = owMountainFrames();
    // Pick a mid-complexity mask (some edges open, some not) so both the
    // transition bands and interior are exercised.
    const mask = 6; // bits 2+4 set -> E+S blocked (mountain), N+W open (sand)
    const perVariant = [0, 1, 2, 3, 4].map((v) => frames[v * 16 + mask]);
    for (let i = 0; i < perVariant.length; i++) {
      for (let j = i + 1; j < perVariant.length; j++) {
        expect(perVariant[i].diff(perVariant[j])).toBeGreaterThan(0);
      }
    }
  });
});
