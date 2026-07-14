import { describe, expect, it } from "vitest";
import {
  ACT1_FLAGS,
  ACT2_FLAGS,
  applyBattleResult,
  awardXp,
  choosePerk,
  heroStats,
  newGame,
  respawn,
  type Act1State,
} from "../../src/core/gameState";
import { levelForXp, statsForBuild } from "../../src/core/progression";

function snapshot(s: Act1State): string {
  return JSON.stringify(s);
}

describe("newGame", () => {
  it("starts at the crash with level-1 stats and empty pockets", () => {
    const s = newGame();
    expect(s.zone).toBe("crash");
    expect(s.hero).toEqual({ xp: 0, perks: [] });
    expect(s.hp).toBe(32); // level 1 maxHp
    expect(s.pendingPerks).toBe(0);
    expect(s.items).toEqual({ coldPack: false, shinies: 0 });
  });

  it("initialises every scene flag to false", () => {
    const s = newGame();
    expect(ACT1_FLAGS.length).toBe(16);
    for (const flag of [...ACT1_FLAGS, ...ACT2_FLAGS]) {
      expect(s.flags[flag]).toBe(false);
    }
    expect(Object.keys(s.flags).sort()).toEqual(
      [...ACT1_FLAGS, ...ACT2_FLAGS].sort(),
    );
  });
});

describe("heroStats", () => {
  it("returns full build stats with hp clamped to state hp", () => {
    const s = { ...newGame(), hp: 10 };
    expect(heroStats(s)).toEqual({
      maxHp: 32,
      hp: 10,
      attack: 9,
      defense: 3,
      speed: 12,
    });
  });

  it("clamps hp down to maxHp when the state carries more", () => {
    const s = { ...newGame(), hp: 999 };
    expect(heroStats(s).hp).toBe(32);
  });

  it("reflects perks in the stats", () => {
    const s = newGame();
    s.hero.perks.push("ferocity");
    expect(heroStats(s).attack).toBe(10);
  });
});

describe("awardXp", () => {
  it("adds XP without healing when no level is gained", () => {
    const start = { ...newGame(), hp: 12 };
    const { state, levelsGained } = awardXp(start, 10);
    expect(levelsGained).toBe(0);
    expect(state.hero.xp).toBe(10);
    expect(state.hp).toBe(12);
    expect(state.pendingPerks).toBe(0);
  });

  it("fully heals and queues a perk on level-up", () => {
    const start = { ...newGame(), hp: 5 };
    const { state, levelsGained } = awardXp(start, 20);
    expect(levelsGained).toBe(1);
    expect(levelForXp(state.hero.xp)).toBe(2);
    expect(state.hp).toBe(38); // level 2 maxHp: full heal
    expect(state.pendingPerks).toBe(1);
  });

  it("queues one perk per level on a multi-level gain", () => {
    const start = { ...newGame(), hp: 1 };
    const { state, levelsGained } = awardXp(start, 50); // level 1 -> 3
    expect(levelsGained).toBe(2);
    expect(state.pendingPerks).toBe(2);
    expect(state.hp).toBe(44); // level 3 maxHp
  });

  it("full heal includes perk maxHp bonuses", () => {
    let s = newGame();
    s = awardXp(s, 20).state;
    s = choosePerk(s, "vigor");
    const { state } = awardXp(s, 25); // -> level 3
    expect(state.hp).toBe(44 + 4);
  });

  it("is pure: never mutates the input state", () => {
    const s = newGame();
    const before = snapshot(s);
    awardXp(s, 50);
    expect(snapshot(s)).toBe(before);
  });
});

describe("choosePerk", () => {
  function leveled(): Act1State {
    return awardXp(newGame(), 20).state; // level 2, 1 pending perk
  }

  it("applies the perk and decrements pendingPerks", () => {
    const s = choosePerk(leveled(), "ferocity");
    expect(s.hero.perks).toEqual(["ferocity"]);
    expect(s.pendingPerks).toBe(0);
    expect(heroStats(s).attack).toBe(11 + 1);
  });

  it("raises current hp along with a vigor maxHp gain", () => {
    const s = choosePerk(leveled(), "vigor");
    expect(heroStats(s).maxHp).toBe(42);
    expect(s.hp).toBe(42); // stayed at full
  });

  it("leaves hp alone for non-hp perks", () => {
    const wounded = { ...leveled(), hp: 20 };
    expect(choosePerk(wounded, "swiftness").hp).toBe(20);
  });

  it("supports stacking across multiple level-ups", () => {
    let s = awardXp(newGame(), 50).state; // 2 pending
    s = choosePerk(s, "vigor");
    s = choosePerk(s, "vigor");
    expect(heroStats(s).maxHp).toBe(44 + 8);
    expect(s.pendingPerks).toBe(0);
  });

  it("throws when no perk choice is pending", () => {
    expect(() => choosePerk(newGame(), "vigor")).toThrow(/no pending/i);
  });

  it("is pure: never mutates the input state", () => {
    const s = leveled();
    const before = snapshot(s);
    choosePerk(s, "bulwark");
    expect(snapshot(s)).toBe(before);
  });
});

describe("applyBattleResult", () => {
  it("records the hero's post-battle hp", () => {
    expect(applyBattleResult(newGame(), 7).hp).toBe(7);
  });

  it("clamps to 0..maxHp", () => {
    expect(applyBattleResult(newGame(), -5).hp).toBe(0);
    expect(applyBattleResult(newGame(), 500).hp).toBe(32);
  });

  it("touches nothing but hp", () => {
    const s = awardXp(newGame(), 20).state;
    s.items.shinies = 3;
    s.flags.metRosa = true;
    const after = applyBattleResult(s, 1);
    expect(after).toEqual({ ...s, hp: 1 });
    expect(snapshot(s)).not.toBe(snapshot(after));
  });
});

describe("respawn", () => {
  it("restores full hp and keeps zone, xp, perks, items and flags", () => {
    let s = awardXp(newGame(), 20).state;
    s = choosePerk(s, "vigor");
    s = { ...s, zone: "mine", hp: 0 };
    s.items.coldPack = true;
    s.items.shinies = 2;
    s.flags.foremanDefeated = true;
    const after = respawn(s);
    expect(after.hp).toBe(statsForBuild(s.hero).maxHp);
    expect(after.zone).toBe("mine");
    expect(after.hero).toEqual(s.hero);
    expect(after.items).toEqual({ coldPack: true, shinies: 2 });
    expect(after.flags.foremanDefeated).toBe(true);
    expect(after.pendingPerks).toBe(s.pendingPerks);
  });

  it("is pure: never mutates the input state", () => {
    const s = { ...newGame(), hp: 0 };
    const before = snapshot(s);
    respawn(s);
    expect(snapshot(s)).toBe(before);
  });
});

describe("battle round-trip", () => {
  it("defeat -> respawn -> victory keeps the run consistent", () => {
    let s = newGame();
    s = applyBattleResult(s, 0); // defeated
    s = respawn(s);
    expect(s.hp).toBe(32);
    const won = awardXp(applyBattleResult(s, 9), 8); // tutorial scarab
    expect(won.state.hp).toBe(9);
    expect(won.state.hero.xp).toBe(8);
    expect(won.levelsGained).toBe(0);
  });
});
