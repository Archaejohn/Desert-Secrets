import { describe, expect, it } from "vitest";
import {
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  SLITHER_COMMANDS,
  baseStatsForLevel,
  commandsForLevel,
  grantXp,
  levelForXp,
  slitherStatsForLevel,
  xpToNext,
  type HeroBuild,
} from "../../src/core/progression";

describe("Act 2 leveling extension", () => {
  it("extends the thresholds to level 8", () => {
    expect(LEVEL_THRESHOLDS).toEqual([0, 20, 45, 75, 110, 150, 195, 245]);
    expect(MAX_LEVEL).toBe(8);
    expect(LEVEL_THRESHOLDS.length).toBe(MAX_LEVEL);
  });

  it("walks the new 5 -> 8 band at exact boundaries", () => {
    expect(levelForXp(149)).toBe(5);
    expect(levelForXp(150)).toBe(6);
    expect(levelForXp(194)).toBe(6);
    expect(levelForXp(195)).toBe(7);
    expect(levelForXp(244)).toBe(7);
    expect(levelForXp(245)).toBe(8);
    expect(levelForXp(9001)).toBe(8);
  });

  it("xpToNext keeps counting through the new band and nulls at 8", () => {
    expect(xpToNext(110)).toBe(40);
    expect(xpToNext(149)).toBe(1);
    expect(xpToNext(150)).toBe(45);
    expect(xpToNext(195)).toBe(50);
    expect(xpToNext(244)).toBe(1);
    expect(xpToNext(245)).toBeNull();
  });

  it("baseStatsForLevel accepts levels 6..8 with the same per-level gains", () => {
    for (let level = 6; level <= 8; level++) {
      const prev = baseStatsForLevel(level - 1);
      const cur = baseStatsForLevel(level);
      expect(cur.maxHp - prev.maxHp).toBe(6);
      expect(cur.attack - prev.attack).toBe(2);
      expect(cur.defense - prev.defense).toBe(1);
      expect(cur.speed - prev.speed).toBe(1);
      expect(cur.hp).toBe(cur.maxHp);
    }
    expect(() => baseStatsForLevel(9)).toThrow(/out of range/);
  });

  it("commandsForLevel adds nothing above level 5", () => {
    const atFive = commandsForLevel(5);
    for (const level of [6, 7, 8]) {
      expect(commandsForLevel(level)).toEqual(atFive);
    }
  });

  it("grantXp climbs the whole ladder from 0 to max", () => {
    const { build, levelsGained } = grantXp({ xp: 0, perks: [] }, 245);
    expect(levelsGained).toBe(7);
    expect(levelForXp(build.xp)).toBe(8);
  });

  it("Act 2's tuning carries a full Act 1 clear toward the Warden at 6-7", () => {
    // Act 1 mandatory path ends around 162 xp (level 6); the maze and
    // galleries encounters plus miner rescues push toward 7 by the boss.
    let build: HeroBuild = { xp: 162, perks: [] };
    for (const xp of [30, 14, 16, 30, 10, 20, 30]) {
      build = grantXp(build, xp).build;
    }
    expect(levelForXp(build.xp)).toBeGreaterThanOrEqual(6);
    build = grantXp(build, 80).build; // the Rime Warden
    expect(levelForXp(build.xp)).toBeGreaterThanOrEqual(7);
  });
});

describe("slitherStatsForLevel", () => {
  it("matches the contract formula at every level", () => {
    const rows: Array<[number, number, number, number, number]> = [
      // level, maxHp, attack, defense, speed
      [1, 22, 6, 2, 14],
      [2, 26, 8, 2, 15],
      [3, 30, 10, 3, 16],
      [4, 34, 12, 3, 17],
      [5, 38, 14, 4, 18],
      [6, 42, 16, 4, 19],
      [7, 46, 18, 5, 20],
      [8, 50, 20, 5, 21],
    ];
    for (const [level, maxHp, attack, defense, speed] of rows) {
      expect(slitherStatsForLevel(level)).toEqual({
        maxHp,
        hp: maxHp,
        attack,
        defense,
        speed,
      });
    }
  });

  it("always returns hp at full", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const s = slitherStatsForLevel(level);
      expect(s.hp).toBe(s.maxHp);
    }
  });

  it("gains defense only every other level", () => {
    expect(slitherStatsForLevel(2).defense).toBe(slitherStatsForLevel(1).defense);
    expect(slitherStatsForLevel(3).defense).toBe(
      slitherStatsForLevel(2).defense + 1,
    );
    expect(slitherStatsForLevel(4).defense).toBe(slitherStatsForLevel(3).defense);
  });

  it("throws on levels outside 1..MAX_LEVEL", () => {
    expect(() => slitherStatsForLevel(0)).toThrow(/out of range/);
    expect(() => slitherStatsForLevel(9)).toThrow(/out of range/);
    expect(() => slitherStatsForLevel(1.5)).toThrow(/out of range/);
  });

  it("returns a fresh object every call", () => {
    const a = slitherStatsForLevel(3);
    const b = slitherStatsForLevel(3);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe("SLITHER_COMMANDS", () => {
  it("is exactly attack/guard/venom (Bite/Coil/Venom in the UI)", () => {
    expect(SLITHER_COMMANDS).toEqual(["attack", "guard", "venom"]);
  });
});
