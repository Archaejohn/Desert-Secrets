/** manifest.json schema — must match docs/CONTRACTS.md §1 exactly. */
import { describe, expect, it } from "vitest";
import { PALETTE } from "../../src/shared/palette";
import { buildManifest } from "../../tools/pipeline/src/manifest";

const manifest = buildManifest();

describe("manifest palette", () => {
  it("is copied verbatim from palette.ts", () => {
    expect(manifest.palette).toEqual({ ...PALETTE });
  });
});

describe("manifest character sheets", () => {
  const dirs = ["down", "left", "right", "up"] as const;

  for (const prefix of ["hero", "npc"] as const) {
    it(`${prefix}: geometry and exactly 8 animation keys`, () => {
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

      // every frame index within the 6x4 sheet
      for (const anim of Object.values(sheet.animations)) {
        for (const f of anim.frames) {
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThan(24);
        }
      }
    });
  }
});

describe("manifest scarab sheet", () => {
  it("matches the contract", () => {
    const s = manifest.sheets.scarab;
    expect(s.file).toBe("scarab.png");
    expect(s.frameWidth).toBe(24);
    expect(s.frameHeight).toBe(24);
    expect(s.columns).toBe(6);
    expect(s.rows).toBe(1);
    expect(s.animations).toEqual({
      "scarab-idle": { frames: [0, 1], frameRate: 3, repeat: -1 },
      "scarab-move": { frames: [2, 3, 4, 5], frameRate: 10, repeat: -1 }
    });
  });
});

describe("manifest tiles", () => {
  it("has the complete contract name→index map", () => {
    expect(manifest.tiles.file).toBe("tiles.png");
    expect(manifest.tiles.tileSize).toBe(16);
    expect(manifest.tiles.columns).toBe(8);
    expect(manifest.tiles.names).toEqual({
      sand: 0,
      sand2: 1,
      sand3: 2,
      duneEdge: 3,
      rock: 4,
      cactus: 5,
      brick: 6,
      brickCracked: 7,
      water: 8,
      water2: 9,
      palmTrunk: 10,
      palmTop: 11,
      pot: 12,
      bones: 13,
      ruinPillar: 14,
      sandSparkle: 15
    });
  });
});
