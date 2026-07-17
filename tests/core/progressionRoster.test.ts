import { describe, expect, it } from "vitest";
import {
  FLUFFBALL_COMMANDS,
  MAX_LEVEL,
  PIGGY_COMMANDS,
  fluffballStatsForLevel,
  piggyStatsForLevel,
} from "../../src/core/progression";

describe("fluffballStatsForLevel", () => {
  it("matches the contract formula at every level (scrappy, fast striker)", () => {
    const rows: Array<[number, number, number, number, number]> = [
      // level, maxHp, attack, defense, speed
      [1, 20, 7, 2, 16],
      [2, 24, 9, 2, 18],
      [3, 28, 11, 3, 20],
      [4, 32, 13, 3, 22],
      [5, 36, 15, 4, 24],
      [6, 40, 17, 4, 26],
      [7, 44, 19, 5, 28],
      [8, 48, 21, 5, 30],
    ];
    for (const [level, maxHp, attack, defense, speed] of rows) {
      expect(fluffballStatsForLevel(level)).toEqual({
        maxHp,
        hp: maxHp,
        attack,
        defense,
        speed,
      });
    }
  });

  it("out-speeds Slither at every level (his defining trait)", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(fluffballStatsForLevel(level).speed).toBeGreaterThan(14 + (level - 1));
    }
  });

  it("always enters battle at full hp", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const s = fluffballStatsForLevel(level);
      expect(s.hp).toBe(s.maxHp);
    }
  });

  it("throws on levels outside 1..MAX_LEVEL and returns fresh objects", () => {
    expect(() => fluffballStatsForLevel(0)).toThrow(/out of range/);
    expect(() => fluffballStatsForLevel(9)).toThrow(/out of range/);
    expect(() => fluffballStatsForLevel(2.5)).toThrow(/out of range/);
    expect(fluffballStatsForLevel(3)).not.toBe(fluffballStatsForLevel(3));
  });
});

describe("piggyStatsForLevel", () => {
  it("matches the contract formula at every level (a baby: the slimmest curve)", () => {
    const rows: Array<[number, number, number, number, number]> = [
      // level, maxHp, attack, defense, speed
      [1, 16, 5, 1, 13],
      [2, 19, 7, 1, 14],
      [3, 22, 9, 2, 15],
      [4, 25, 11, 2, 16],
      [5, 28, 13, 3, 17],
      [6, 31, 15, 3, 18],
      [7, 34, 17, 4, 19],
      [8, 37, 19, 4, 20],
    ];
    for (const [level, maxHp, attack, defense, speed] of rows) {
      expect(piggyStatsForLevel(level)).toEqual({
        maxHp,
        hp: maxHp,
        attack,
        defense,
        speed,
      });
    }
  });

  it("is the frailest member: less maxHp than Fluffball at every level", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(piggyStatsForLevel(level).maxHp).toBeLessThan(
        fluffballStatsForLevel(level).maxHp,
      );
    }
  });

  it("always enters battle at full hp", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const s = piggyStatsForLevel(level);
      expect(s.hp).toBe(s.maxHp);
    }
  });

  it("throws on levels outside 1..MAX_LEVEL and returns fresh objects", () => {
    expect(() => piggyStatsForLevel(0)).toThrow(/out of range/);
    expect(() => piggyStatsForLevel(9)).toThrow(/out of range/);
    expect(() => piggyStatsForLevel(1.1)).toThrow(/out of range/);
    expect(piggyStatsForLevel(4)).not.toBe(piggyStatsForLevel(4));
  });
});

describe("creature command sets", () => {
  it("Fluffball: attack/guard/focus (Peck/Fluff Up/Pounce in the UI)", () => {
    expect(FLUFFBALL_COMMANDS).toEqual(["attack", "guard", "focus"]);
  });

  it("Piggy: attack/guard/second-wind (Nip/Hide/Nap in the UI)", () => {
    expect(PIGGY_COMMANDS).toEqual(["attack", "guard", "second-wind"]);
  });
});
