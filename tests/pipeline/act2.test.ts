/**
 * Act 2 pipeline guarantees (docs/CONTRACTS.md §7): the seven new sheets
 * (slither, miner, fluffball, icebat, crystalcrawler, frostscarab, warden)
 * and tiles3 get the same guarantees as the earlier sets — palette
 * compliance, exact grids, real motion, non-emptiness, a complete manifest —
 * plus the tiles3 legibility contracts (floor vs wall, sealed vs open door,
 * intact vs cracked lake, chasm-as-pit, icicle-as-overhead).
 */
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { PALETTE, PALETTE_HEX, hexToRgb, type PaletteName } from "../../src/shared/palette";
import { buildAssets } from "../../tools/pipeline/src/assets";
import { buildManifest } from "../../tools/pipeline/src/manifest";
import { encodePng } from "../../tools/pipeline/src/png";
import { slitherFrames } from "../../tools/pipeline/src/sprites/slither";
import { minerFrames } from "../../tools/pipeline/src/sprites/miner";
import { fluffballFrames } from "../../tools/pipeline/src/sprites/fluffball";
import { icebatFrames } from "../../tools/pipeline/src/sprites/icebat";
import { crystalcrawlerFrames } from "../../tools/pipeline/src/sprites/crystalcrawler";
import { frostscarabFrames } from "../../tools/pipeline/src/sprites/frostscarab";
import { wardenFrames } from "../../tools/pipeline/src/sprites/warden";
import { tile3Frames, TILE3_NAMES } from "../../tools/pipeline/src/tileset3";
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
  ["slither", assets.slither, 96, 16],
  ["miner", assets.miner, 96, 96],
  ["fluffball", assets.fluffball, 96, 16],
  ["icebat", assets.icebat, 144, 24],
  ["crystalcrawler", assets.crystalcrawler, 144, 24],
  ["frostscarab", assets.frostscarab, 144, 24],
  ["warden", assets.warden, 192, 32],
  ["tiles3", assets.tiles3, 128, 32]
];

/** [name, frames, frameSize, min adjacent-motion diff, min opaque px] */
const creatures: Array<[string, PixelGrid[], number, number, number]> = [
  ["slither", slitherFrames(), 16, 6, 55],
  ["fluffball", fluffballFrames(), 16, 6, 60],
  ["icebat", icebatFrames(), 24, 8, 90],
  ["crystalcrawler", crystalcrawlerFrames(), 24, 8, 100],
  ["frostscarab", frostscarabFrames(), 24, 8, 100],
  ["warden", wardenFrames(), 32, 8, 300]
];

describe("act2 sheet layout (contract §7)", () => {
  it.each(newSheets)("%s sheet is %ix%i", (_name, grid, w, h) => {
    expect(grid.width).toBe(w);
    expect(grid.height).toBe(h);
    const png = PNG.sync.read(encodePng(grid));
    expect(png.width).toBe(w);
    expect(png.height).toBe(h);
  });

  it("miner holds 24 16x24 frames; creatures 6 square frames each; tiles3 16 tiles", () => {
    expect(minerFrames()).toHaveLength(24);
    for (const f of minerFrames()) expect([f.width, f.height]).toEqual([16, 24]);
    for (const [, frames, size] of creatures) {
      expect(frames).toHaveLength(6);
      for (const f of frames) expect([f.width, f.height]).toEqual([size, size]);
    }
    expect(tile3Frames()).toHaveLength(16);
    for (const t of tile3Frames()) expect([t.width, t.height]).toEqual([16, 16]);
  });
});

describe("act2 palette compliance", () => {
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

describe("act2 motion", () => {
  it("miner: idle frames breathe and walk frames stride in every direction", () => {
    const frames = minerFrames();
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

  it("slither faces right (amber eye in the right half of every frame)", () => {
    for (const f of slitherFrames()) {
      const amber: Array<[number, number]> = [];
      f.forEach((x, y, c) => {
        if (c === "amber") amber.push([x, y]);
      });
      expect(amber.length).toBeGreaterThan(0);
      for (const [x] of amber) expect(x).toBeGreaterThanOrEqual(10);
    }
  });

  it("slither: idle flicks a tongue on frame 1; the S-curve rolls through 4 distinct phases", () => {
    const frames = slitherFrames();
    // tongue: rust pixels appear only on idle frame 1
    expect(count(frames[0], ["rust"])).toBe(0);
    expect(count(frames[1], ["rust"])).toBeGreaterThan(0);
    // clear body-phase motion: all four undulation frames are pairwise distinct
    for (let i = 2; i <= 5; i++) {
      for (let j = i + 1; j <= 5; j++) {
        expect(frames[i].diff(frames[j]), `move frames ${i} vs ${j}`).toBeGreaterThan(0);
      }
    }
  });

  it("warden carries exactly one amber core pixel, flaring on idle frame 1", () => {
    const frames = wardenFrames();
    for (const f of frames) expect(count(f, ["amber"])).toBe(1);
    // the flare: idle frame 1 lights extra white around the core
    expect(count(frames[1], ["white"])).toBeGreaterThan(count(frames[0], ["white"]));
    expect(frames[0].diff(frames[1])).toBeGreaterThan(0);
  });

  it("crystalcrawler's crystal glint alternates position every frame", () => {
    const frames = crystalcrawlerFrames();
    const glints = frames.map((f) => {
      const spots: Array<[number, number]> = [];
      f.forEach((x, y, c) => {
        if (c === "white") spots.push([x, y]);
      });
      return spots;
    });
    for (const spots of glints) expect(spots).toHaveLength(1);
    for (let i = 1; i < frames.length; i++) {
      expect(glints[i]).not.toEqual(glints[i - 1]);
    }
  });
});

describe("act2 colourways", () => {
  it("fluffball is the gray chick: mauve/plum down dominates, amber beak present", () => {
    for (const f of fluffballFrames()) {
      expect(count(f, ["mauve", "plum"])).toBeGreaterThan(50);
      expect(count(f, ["amber"])).toBeGreaterThan(1);
      expect(count(f, ["bone"])).toBeGreaterThan(5); // the face patch
    }
  });

  it("frostscarab wears frost: skyBlue shell, mint gem, bone rime", () => {
    for (const f of frostscarabFrames()) {
      expect(count(f, ["skyBlue"])).toBeGreaterThan(30);
      expect(count(f, ["mint"])).toBeGreaterThan(5);
      expect(count(f, ["bone"])).toBeGreaterThan(5);
    }
  });

  it("icebat is indigo/skyBlue with mint eye glints", () => {
    for (const f of icebatFrames()) {
      expect(count(f, ["indigo"])).toBeGreaterThan(20);
      expect(count(f, ["skyBlue"])).toBeGreaterThan(2);
      expect(count(f, ["mint", "white"])).toBeGreaterThan(0);
    }
  });
});

describe("act2 non-emptiness", () => {
  it("every miner and creature frame has a solid silhouette", () => {
    for (const f of minerFrames()) expect(f.countOpaque()).toBeGreaterThan(60);
    for (const [, frames, , , minOpaque] of creatures) {
      for (const f of frames) expect(f.countOpaque()).toBeGreaterThan(minOpaque);
    }
  });
});

describe("act2 tiles3 legibility (contract §7)", () => {
  const tiles = tile3Frames();
  const idx = (name: string) => TILE3_NAMES.indexOf(name as (typeof TILE3_NAMES)[number]);
  const tileOf = (name: string) => tiles[idx(name)];

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

  it("every non-overhead tile is fully opaque (no holes in maps)", () => {
    for (const name of TILE3_NAMES) {
      if (name === "icicle") continue;
      expect(tileOf(name).countOpaque(), `${name} has holes`).toBe(16 * 16);
    }
  });

  it("icicle is the overhead tile: transparent background, hanging spikes", () => {
    const t = tileOf("icicle");
    expect(t.countOpaque()).toBeLessThan(16 * 16);
    expect(t.countOpaque()).toBeGreaterThan(20);
    // the lower corners stay clear so it overlays whatever is beneath
    expect(t.get(0, 15)).toBeNull();
    expect(t.get(15, 15)).toBeNull();
  });

  it("iceFloor is clearly darker than iceWallDeep (>=60% differing pixels)", () => {
    const floor = tileOf("iceFloor");
    const wall = tileOf("iceWallDeep");
    expect(floor.diff(wall)).toBeGreaterThanOrEqual(Math.ceil(16 * 16 * 0.6));
    expect(luminance(floor)).toBeLessThan(luminance(wall) - 40);
  });

  it("doorRime (sealed) clearly differs from doorOpen (walkable)", () => {
    const rime = tileOf("doorRime");
    const open = tileOf("doorOpen");
    expect(rime.diff(open)).toBeGreaterThan(60);
    // the sealed door is frost; the open door is a dark passage
    expect(count(rime, ["skyBlue", "bone"])).toBeGreaterThan(60);
    expect(count(open, ["skyBlue", "bone"])).toBe(0);
    expect(count(open, ["ink"])).toBeGreaterThan(60);
  });

  it("lakeIce vs lakeCrack clearly differ, the crack showing dark water", () => {
    const lake = tileOf("lakeIce");
    const crack = tileOf("lakeCrack");
    expect(lake.diff(crack)).toBeGreaterThan(15);
    expect(count(lake, ["ink", "indigo"])).toBe(0);
    expect(count(crack, ["ink", "indigo"])).toBeGreaterThan(15);
  });

  it("chasm reads as a pit: mostly ink / near-dark", () => {
    const pit = tileOf("chasm");
    expect(count(pit, ["ink"])).toBeGreaterThanOrEqual(Math.ceil(16 * 16 * 0.8));
    expect(count(pit, ["ink", "plum", "indigo"])).toBe(16 * 16);
  });

  it("lanternPost glows amber (the wayfinding landmark)", () => {
    expect(count(tileOf("lanternPost"), ["amber"])).toBeGreaterThan(8);
    expect(count(tileOf("lanternPost"), ["white"])).toBeGreaterThan(0);
  });

  it("shard sparkles mint, mossGlow grows mint-lit jade", () => {
    expect(count(tileOf("shard"), ["mint"])).toBeGreaterThan(5);
    expect(count(tileOf("shard"), ["white"])).toBeGreaterThan(0);
    expect(count(tileOf("mossGlow"), ["jade"])).toBeGreaterThan(10);
    expect(count(tileOf("mossGlow"), ["mint"])).toBeGreaterThan(5);
  });

  it("iceFloor2 is a distinct grain of the same ground", () => {
    const a = tileOf("iceFloor");
    const b = tileOf("iceFloor2");
    expect(a.diff(b)).toBeGreaterThan(0);
    expect(a.diff(b)).toBeLessThan(64); // same material, different speckle
  });
});

describe("act2 manifest", () => {
  const dirs = ["down", "left", "right", "up"] as const;

  it("miner: geometry and exactly 8 animation keys (hero pattern)", () => {
    const sheet = manifest.sheets.miner;
    expect(sheet.file).toBe("miner.png");
    expect(sheet.frameWidth).toBe(16);
    expect(sheet.frameHeight).toBe(24);
    expect(sheet.columns).toBe(6);
    expect(sheet.rows).toBe(4);
    const expectedKeys = dirs.flatMap((d) => [`miner-idle-${d}`, `miner-walk-${d}`]);
    expect(Object.keys(sheet.animations).sort()).toEqual([...expectedKeys].sort());
    dirs.forEach((dir, row) => {
      const base = row * 6;
      expect(sheet.animations[`miner-idle-${dir}`]).toEqual({
        frames: [base, base + 1],
        frameRate: 2,
        repeat: -1
      });
      expect(sheet.animations[`miner-walk-${dir}`]).toEqual({
        frames: [base + 2, base + 3, base + 4, base + 5],
        frameRate: 10,
        repeat: -1
      });
    });
  });

  const creatureSpecs: Array<[keyof typeof manifest.sheets, number, string, number, number]> = [
    ["slither", 16, "move", 3, 10],
    ["fluffball", 16, "walk", 3, 8],
    ["icebat", 24, "move", 3, 10],
    ["crystalcrawler", 24, "move", 3, 8],
    ["frostscarab", 24, "move", 3, 10],
    ["warden", 32, "move", 2, 8]
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

  it("tiles3 has the complete contract name→index map", () => {
    expect(manifest.tiles3.file).toBe("tiles3.png");
    expect(manifest.tiles3.tileSize).toBe(16);
    expect(manifest.tiles3.columns).toBe(8);
    expect(manifest.tiles3.names).toEqual({
      iceFloor: 0,
      iceFloor2: 1,
      iceWallDeep: 2,
      crystalSmall: 3,
      crystalBig: 4,
      icicle: 5,
      chasm: 6,
      snowdrift: 7,
      lanternPost: 8,
      lakeIce: 9,
      lakeCrack: 10,
      bridgePlank: 11,
      doorRime: 12,
      doorOpen: 13,
      shard: 14,
      mossGlow: 15
    });
  });

  it("all seventeen sheets and three tilesets are present", () => {
    expect(Object.keys(manifest.sheets).sort()).toEqual(
      [
        "hero",
        "npc",
        "scarab",
        "rosa",
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
    expect(manifest.tiles.names.sand).toBe(0);
    expect(manifest.tiles2.names.eggCluster).toBe(23);
  });
});
