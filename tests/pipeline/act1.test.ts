/**
 * Act 1 pipeline guarantees (docs/CONTRACTS.md §4): the seven new sheets
 * (rosa, piggy, jackrabbit, buzzard, gila, foreman, queen) and tiles2 get
 * the same guarantees as the originals — palette compliance, exact grids,
 * real motion, non-emptiness, and a complete manifest.
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE_HEX } from "../../src/shared/palette";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { buildManifest } from "../../tools/pipeline/src/manifest";
import { encodePng } from "../../tools/pipeline/src/png";
import { rosaFrames } from "../../tools/pipeline/src/sprites/rosa";
import { piggyFrames } from "../../tools/pipeline/src/sprites/piggy";
import { jackrabbitFrames } from "../../tools/pipeline/src/sprites/jackrabbit";
import { buzzardFrames } from "../../tools/pipeline/src/sprites/buzzard";
import { gilaFrames } from "../../tools/pipeline/src/sprites/gila";
import { foremanFrames } from "../../tools/pipeline/src/sprites/foreman";
import { queenFrames } from "../../tools/pipeline/src/sprites/queen";
import { tile2Frames, TILE2_NAMES } from "../../tools/pipeline/src/tileset2";
import type { PixelGrid } from "../../tools/pipeline/src/grid";

const assets = buildAssets();
const manifest = buildManifest();

const newSheets: Array<[string, PixelGrid, number, number]> = [
  ["rosa", assets.rosa, 96, 96],
  ["piggy", assets.piggy, 96, 16],
  ["jackrabbit", assets.jackrabbit, 96, 16],
  ["buzzard", assets.buzzard, 144, 24],
  ["gila", assets.gila, 144, 24],
  ["foreman", assets.foreman, 144, 24],
  ["queen", assets.queen, 192, 32],
  ["tiles2", assets.tiles2, 128, 64]
];

/** [name, frames, frameSize, min adjacent-motion diff, min opaque px] */
const creatures: Array<[string, PixelGrid[], number, number, number]> = [
  ["piggy", piggyFrames(), 16, 6, 60],
  ["jackrabbit", jackrabbitFrames(), 16, 6, 60],
  ["buzzard", buzzardFrames(), 24, 8, 100],
  ["gila", gilaFrames(), 24, 8, 100],
  ["foreman", foremanFrames(), 24, 8, 100],
  ["queen", queenFrames(), 32, 8, 300]
];

describe("act1 sheet layout (contract §4)", () => {
  it.each(newSheets)("%s sheet is %ix%i", (_name, grid, w, h) => {
    expect(grid.width).toBe(w);
    expect(grid.height).toBe(h);
    const png = PNG.sync.read(encodePng(grid));
    expect(png.width).toBe(w);
    expect(png.height).toBe(h);
  });

  it("rosa holds 24 16x24 frames; creatures 6 square frames each; tiles2 32 tiles", () => {
    expect(rosaFrames()).toHaveLength(24);
    for (const f of rosaFrames()) expect([f.width, f.height]).toEqual([16, 24]);
    for (const [, frames, size] of creatures) {
      expect(frames).toHaveLength(6);
      for (const f of frames) expect([f.width, f.height]).toEqual([size, size]);
    }
    expect(tile2Frames()).toHaveLength(32);
    for (const t of tile2Frames()) expect([t.width, t.height]).toEqual([16, 16]);
  });
});

describe("act1 palette compliance", () => {
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

describe("act1 motion", () => {
  it("rosa: idle frames breathe and walk frames stride in every direction", () => {
    const frames = rosaFrames();
    for (let row = 0; row < 4; row++) {
      const base = row * 6;
      expect(frames[base].diff(frames[base + 1])).toBeGreaterThan(0);
      expect(frames[base + 2].diff(frames[base + 3])).toBeGreaterThanOrEqual(8);
      expect(frames[base + 3].diff(frames[base + 4])).toBeGreaterThanOrEqual(8);
      expect(frames[base + 2].diff(frames[base + 4])).toBeGreaterThan(0);
    }
  });

  it.each(creatures)("%s: idle twitches and motion frames alternate", (_n, frames, _s, min) => {
    expect(frames[0].diff(frames[1])).toBeGreaterThan(0);
    expect(frames[2].diff(frames[3])).toBeGreaterThanOrEqual(min);
    expect(frames[3].diff(frames[4])).toBeGreaterThanOrEqual(min);
    expect(frames[4].diff(frames[5])).toBeGreaterThanOrEqual(min);
    // the two "contact" poses of the cycle are distinct
    expect(frames[2].diff(frames[4])).toBeGreaterThan(0);
  });

  it("piggy carries a single mint frost glint that moves between frames", () => {
    const frames = piggyFrames();
    const glints = frames.map((f) => {
      const spots: Array<[number, number]> = [];
      f.forEach((x, y, c) => {
        if (c === "mint") spots.push([x, y]);
      });
      return spots;
    });
    for (const spots of glints) expect(spots).toHaveLength(1);
    for (let i = 1; i < frames.length; i++) {
      expect(glints[i]).not.toEqual(glints[i - 1]); // it alternates every frame
    }
  });
});

describe("act1 non-emptiness", () => {
  it("every rosa and creature frame has a solid silhouette", () => {
    for (const f of rosaFrames()) expect(f.countOpaque()).toBeGreaterThan(60);
    for (const [, frames, , , minOpaque] of creatures) {
      for (const f of frames) expect(f.countOpaque()).toBeGreaterThan(minOpaque);
    }
  });

  it("every tiles2 tile is fully opaque (no holes in maps)", () => {
    for (const t of tile2Frames()) expect(t.countOpaque()).toBe(16 * 16);
  });
});

describe("act1 tile design constraints", () => {
  const tiles = tile2Frames();
  const idx = (name: string) => TILE2_NAMES.indexOf(name as (typeof TILE2_NAMES)[number]);

  it("mineWall contrasts strongly with the walkable mineFloor", () => {
    expect(tiles[idx("mineWall")].diff(tiles[idx("mineFloor")])).toBeGreaterThan(150);
  });

  it("iceWallCrack visibly differs from iceWall and exposes an indigo fissure", () => {
    const wall = tiles[idx("iceWall")];
    const crack = tiles[idx("iceWallCrack")];
    expect(wall.diff(crack)).toBeGreaterThan(15);
    let wallIndigo = 0;
    let crackIndigo = 0;
    wall.forEach((_x, _y, c) => {
      if (c === "indigo") wallIndigo++;
    });
    crack.forEach((_x, _y, c) => {
      if (c === "indigo") crackIndigo++;
    });
    expect(wallIndigo).toBe(0);
    expect(crackIndigo).toBeGreaterThan(8);
  });

  it("rail tiles horizontally: rail lines run unbroken edge to edge", () => {
    const rail = tiles[idx("rail")];
    for (const y of [5, 10]) {
      for (let x = 0; x < 16; x++) expect(rail.get(x, y)).toBe("slate");
    }
    // and the two edges match so adjacent tiles join seamlessly
    for (let y = 0; y < 16; y++) expect(rail.get(0, y)).toBe(rail.get(15, y));
  });

  it("lever and leverOn are clearly different states", () => {
    expect(tiles[idx("lever")].diff(tiles[idx("leverOn")])).toBeGreaterThan(10);
  });

  it("frostSand is a rimed variant of sand (contains mint), iceChip has a shard", () => {
    let mint = 0;
    tiles[idx("frostSand")].forEach((_x, _y, c) => {
      if (c === "mint") mint++;
    });
    expect(mint).toBeGreaterThan(5);
    let shard = 0;
    tiles[idx("iceChip")].forEach((_x, _y, c) => {
      if (c === "mint" || c === "skyBlue" || c === "white") shard++;
    });
    expect(shard).toBeGreaterThan(5);
  });
});

describe("act1 manifest", () => {
  const dirs = ["down", "left", "right", "up"] as const;

  it("rosa: geometry and exactly 8 animation keys (hero pattern)", () => {
    const sheet = manifest.sheets.rosa;
    expect(sheet.file).toBe("rosa.png");
    expect(sheet.frameWidth).toBe(16);
    expect(sheet.frameHeight).toBe(24);
    expect(sheet.columns).toBe(6);
    expect(sheet.rows).toBe(4);
    const expectedKeys = dirs.flatMap((d) => [`rosa-idle-${d}`, `rosa-walk-${d}`]);
    expect(Object.keys(sheet.animations).sort()).toEqual([...expectedKeys].sort());
    dirs.forEach((dir, row) => {
      const base = row * 6;
      expect(sheet.animations[`rosa-idle-${dir}`]).toEqual({
        frames: [base, base + 1],
        frameRate: 2,
        repeat: -1
      });
      expect(sheet.animations[`rosa-walk-${dir}`]).toEqual({
        frames: [base + 2, base + 3, base + 4, base + 5],
        frameRate: 10,
        repeat: -1
      });
    });
  });

  const creatureSpecs: Array<[keyof typeof manifest.sheets, number, string, number, number]> = [
    ["piggy", 16, "walk", 3, 8],
    ["jackrabbit", 16, "move", 3, 12],
    ["buzzard", 24, "move", 3, 8],
    ["gila", 24, "move", 3, 8],
    ["foreman", 24, "move", 3, 10],
    ["queen", 32, "move", 2, 8]
  ];

  it.each(creatureSpecs)(
    "%s: 6x1 grid of %ipx frames with idle + %s animations",
    (name, frame, moveKey, idleRate, moveRate) => {
      const s = manifest.sheets[name];
      expect(s.file).toBe(`${name}.png`);
      expect(s.frameWidth).toBe(frame);
      expect(s.frameHeight).toBe(frame);
      expect(s.columns).toBe(6);
      expect(s.rows).toBe(1);
      expect(s.animations).toEqual({
        [`${name}-idle`]: { frames: [0, 1], frameRate: idleRate, repeat: -1 },
        [`${name}-${moveKey}`]: { frames: [2, 3, 4, 5], frameRate: moveRate, repeat: -1 }
      });
    }
  );

  it("tiles2 has the complete contract name→index map", () => {
    expect(manifest.tiles2.file).toBe("tiles2.png");
    expect(manifest.tiles2.tileSize).toBe(16);
    expect(manifest.tiles2.columns).toBe(8);
    expect(manifest.tiles2.names).toEqual({
      asphalt: 0,
      asphaltLine: 1,
      truckCab: 2,
      truckBox: 3,
      crateBroken: 4,
      joshuaTrunk: 5,
      joshuaTop: 6,
      creosote: 7,
      stationWall: 8,
      stationWindow: 9,
      stationSign: 10,
      gasPump: 11,
      mineWall: 12,
      mineFloor: 13,
      mineTimber: 14,
      rail: 15,
      cart: 16,
      lever: 17,
      leverOn: 18,
      iceWall: 19,
      iceWallCrack: 20,
      frostSand: 21,
      iceChip: 22,
      eggCluster: 23,
      mountain: 24,
      mountain2: 25,
      mountain3: 26,
      mountain4: 27,
      mountain5: 28,
      mountain6: 29,
      mountain7: 30,
      mountain8: 31
    });
  });

  it("unchanged v1 entries are still present alongside tiles2", () => {
    expect(Object.keys(manifest.sheets)).toEqual(
      expect.arrayContaining([
        "hero",
        "npc",
        "scarab",
        "rosa",
        "piggy",
        "jackrabbit",
        "buzzard",
        "gila",
        "foreman",
        "queen"
      ])
    );
    expect(manifest.tiles.names.sand).toBe(0);
    expect(manifest.tiles.names.sandSparkle).toBe(15);
  });
});
