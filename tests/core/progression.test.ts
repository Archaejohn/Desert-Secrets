import { describe, expect, it } from "vitest";
import {
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  PERKS,
  baseStatsForLevel,
  commandsForLevel,
  grantXp,
  levelForXp,
  statsForBuild,
  xpToNext,
  type HeroBuild,
  type PerkId,
} from "../../src/core/progression";

describe("levelForXp", () => {
  it("exposes the contract thresholds and max level", () => {
    expect(LEVEL_THRESHOLDS).toEqual([0, 20, 45, 75, 110]);
    expect(MAX_LEVEL).toBe(5);
  });

  it("maps XP to levels exactly at the boundaries", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(19)).toBe(1);
    expect(levelForXp(20)).toBe(2);
    expect(levelForXp(44)).toBe(2);
    expect(levelForXp(45)).toBe(3);
    expect(levelForXp(74)).toBe(3);
    expect(levelForXp(75)).toBe(4);
    expect(levelForXp(109)).toBe(4);
    expect(levelForXp(110)).toBe(5);
  });

  it("caps at MAX_LEVEL for any surplus XP", () => {
    expect(levelForXp(111)).toBe(5);
    expect(levelForXp(10_000)).toBe(5);
  });

  it("is monotonically non-decreasing", () => {
    let prev = 1;
    for (let xp = 0; xp <= 200; xp++) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });
});

describe("xpToNext", () => {
  it("reports the XP remaining to the next threshold", () => {
    expect(xpToNext(0)).toBe(20);
    expect(xpToNext(19)).toBe(1);
    expect(xpToNext(20)).toBe(25);
    expect(xpToNext(50)).toBe(25);
    expect(xpToNext(109)).toBe(1);
  });

  it("is null at max level", () => {
    expect(xpToNext(110)).toBeNull();
    expect(xpToNext(9999)).toBeNull();
  });
});

describe("baseStatsForLevel", () => {
  it("matches the level-1 demo stats", () => {
    expect(baseStatsForLevel(1)).toEqual({
      maxHp: 32,
      hp: 32,
      attack: 9,
      defense: 3,
      speed: 12,
    });
  });

  it("adds +6 maxHp, +2 attack, +1 defense, +1 speed per level", () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      const prev = baseStatsForLevel(level - 1);
      const cur = baseStatsForLevel(level);
      expect(cur.maxHp - prev.maxHp).toBe(6);
      expect(cur.attack - prev.attack).toBe(2);
      expect(cur.defense - prev.defense).toBe(1);
      expect(cur.speed - prev.speed).toBe(1);
    }
  });

  it("reaches 56/17/7/16 at level 5, hp always full", () => {
    expect(baseStatsForLevel(5)).toEqual({
      maxHp: 56,
      hp: 56,
      attack: 17,
      defense: 7,
      speed: 16,
    });
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const s = baseStatsForLevel(level);
      expect(s.hp).toBe(s.maxHp);
    }
  });

  it("throws on levels outside 1..MAX_LEVEL", () => {
    expect(() => baseStatsForLevel(0)).toThrow(/out of range/);
    expect(() => baseStatsForLevel(6)).toThrow(/out of range/);
    expect(() => baseStatsForLevel(2.5)).toThrow(/out of range/);
  });
});

describe("PERKS and statsForBuild", () => {
  it("lists the four perks in order", () => {
    expect(PERKS.map((p) => p.id)).toEqual([
      "vigor",
      "ferocity",
      "bulwark",
      "swiftness",
    ]);
  });

  it("equals base stats with no perks", () => {
    expect(statsForBuild({ xp: 0, perks: [] })).toEqual(baseStatsForLevel(1));
    expect(statsForBuild({ xp: 45, perks: [] })).toEqual(baseStatsForLevel(3));
  });

  it.each<[PerkId, keyof ReturnType<typeof baseStatsForLevel>, number]>([
    ["vigor", "maxHp", 4],
    ["ferocity", "attack", 1],
    ["bulwark", "defense", 1],
    ["swiftness", "speed", 1],
  ])("perk %s adds +%i %s only", (perk, stat, bonus) => {
    const base = baseStatsForLevel(1);
    const built = statsForBuild({ xp: 0, perks: [perk] });
    expect(built[stat]).toBe(base[stat] + bonus);
    for (const key of ["maxHp", "attack", "defense", "speed"] as const) {
      if (key !== stat) expect(built[key]).toBe(base[key]);
    }
  });

  it("stacks repeated perks (vigor twice = +8 maxHp)", () => {
    const s = statsForBuild({ xp: 0, perks: ["vigor", "vigor"] });
    expect(s.maxHp).toBe(32 + 8);
    expect(s.hp).toBe(s.maxHp);
  });

  it("sums a mixed perk set on top of the level stats", () => {
    const s = statsForBuild({
      xp: 110,
      perks: ["vigor", "ferocity", "bulwark", "swiftness"],
    });
    expect(s).toEqual({ maxHp: 60, hp: 60, attack: 18, defense: 8, speed: 17 });
  });
});

describe("commandsForLevel", () => {
  it("unlocks focus at 2, second-wind at 4, sandstep at 5", () => {
    expect(commandsForLevel(1)).toEqual(["attack", "guard"]);
    expect(commandsForLevel(2)).toEqual(["attack", "guard", "focus"]);
    expect(commandsForLevel(3)).toEqual(["attack", "guard", "focus"]);
    expect(commandsForLevel(4)).toEqual([
      "attack",
      "guard",
      "focus",
      "second-wind",
    ]);
    expect(commandsForLevel(5)).toEqual([
      "attack",
      "guard",
      "focus",
      "second-wind",
      "sandstep",
    ]);
  });
});

describe("grantXp", () => {
  it("adds XP without a level gain below the threshold", () => {
    const { build, levelsGained } = grantXp({ xp: 0, perks: [] }, 19);
    expect(build.xp).toBe(19);
    expect(levelsGained).toBe(0);
  });

  it("reports a single level gained when crossing one threshold", () => {
    const { build, levelsGained } = grantXp({ xp: 15, perks: [] }, 10);
    expect(build.xp).toBe(25);
    expect(levelsGained).toBe(1);
  });

  it("reports multiple levels gained across several thresholds", () => {
    const { levelsGained } = grantXp({ xp: 0, perks: [] }, 50);
    expect(levelsGained).toBe(2); // 1 -> 3
    expect(grantXp({ xp: 0, perks: [] }, 110).levelsGained).toBe(4);
  });

  it("gains no levels past max level", () => {
    expect(grantXp({ xp: 110, perks: [] }, 500).levelsGained).toBe(0);
  });

  it("is pure: returns a new build and keeps perks", () => {
    const before: HeroBuild = { xp: 10, perks: ["vigor"] };
    const { build } = grantXp(before, 5);
    expect(before).toEqual({ xp: 10, perks: ["vigor"] });
    expect(build).not.toBe(before);
    expect(build.perks).toEqual(["vigor"]);
    expect(build.perks).not.toBe(before.perks);
  });

  it("throws on negative amounts", () => {
    expect(() => grantXp({ xp: 10, perks: [] }, -1)).toThrow(/negative/);
  });

  it("the mandatory Act 1 path lands the boss fight at level 4+", () => {
    // tutorial scarab, crash quest, 3 ice chips, trail battles,
    // Dusty's trade, mine lever, foreman — everything before the Queen.
    const beforeQueen = [8, 5, 5, 5, 5, 10, 14, 10, 10, 30];
    let build: HeroBuild = { xp: 0, perks: [] };
    for (const xp of beforeQueen) build = grantXp(build, xp).build;
    expect(levelForXp(build.xp)).toBeGreaterThanOrEqual(4);
    build = grantXp(build, 60).build; // the Dust Queen
    expect(levelForXp(build.xp)).toBe(5);
  });
});
