import { describe, expect, it } from "vitest";
import {
  ACT1_FLAGS,
  ACT2_FLAGS,
  heroStats,
  newGame,
  partyFor,
  respawn,
  type Act1State,
  type ZoneId,
} from "../../src/core/gameState";
import {
  SLITHER_COMMANDS,
  commandsForLevel,
  levelForXp,
  slitherStatsForLevel,
} from "../../src/core/progression";

describe("ACT2_FLAGS", () => {
  it("lists exactly the contract flags", () => {
    expect([...ACT2_FLAGS]).toEqual([
      "act2Started",
      "minerMo",
      "minerEdda",
      "minerGus",
      "minersBonusGiven",
      "metSlither",
      "mazeShortcutOpen",
      "rimeDoorOpen",
      "slitherJoined",
      "wardenDefeated",
      "act2Complete",
      "shard1",
      "shard2",
    ]);
  });

  it("does not overlap the Act 1 flags", () => {
    const act1 = new Set<string>(ACT1_FLAGS);
    for (const f of ACT2_FLAGS) expect(act1.has(f)).toBe(false);
  });

  it("newGame initialises every Act 2 flag to false", () => {
    const s = newGame();
    for (const f of ACT2_FLAGS) expect(s.flags[f]).toBe(false);
  });
});

describe("Act 2 zones", () => {
  it("accepts the four new zones as checkpoints", () => {
    const zones: ZoneId[] = ["crevasse", "maze", "galleries", "sanctum"];
    for (const zone of zones) {
      const s: Act1State = { ...newGame(), zone, hp: 1 };
      const after = respawn(s);
      expect(after.zone).toBe(zone);
      expect(after.hp).toBe(heroStats(after).maxHp);
    }
  });
});

describe("partyFor", () => {
  it("is hero-only before Slither joins", () => {
    const party = partyFor(newGame());
    expect(party.map((m) => m.id)).toEqual(["hero"]);
  });

  it("hero entry matches what BattleScene builds today", () => {
    const s = { ...newGame(), hp: 10 };
    const [heroMember] = partyFor(s);
    expect(heroMember).toEqual({
      id: "hero",
      name: "Joseph",
      stats: heroStats(s), // hp clamped to current hp
      commands: commandsForLevel(1),
      cactusGuard: false, // level < 3
    });
    expect(heroMember.stats.hp).toBe(10);
  });

  it("hero gains cactusGuard from level 3", () => {
    const at2 = { ...newGame(), hero: { xp: 20, perks: [] } };
    expect(partyFor(at2)[0].cactusGuard).toBe(false);
    const at3 = { ...newGame(), hero: { xp: 45, perks: [] }, hp: 44 };
    expect(partyFor(at3)[0].cactusGuard).toBe(true);
  });

  it("hero commands follow the level", () => {
    const at5 = { ...newGame(), hero: { xp: 110, perks: [] }, hp: 56 };
    expect(partyFor(at5)[0].commands).toEqual([
      "attack",
      "guard",
      "focus",
      "second-wind",
      "sandstep",
    ]);
  });

  it("adds Slither once flags.slitherJoined is set", () => {
    const s = newGame();
    s.flags.slitherJoined = true;
    const party = partyFor(s);
    expect(party.map((m) => m.id)).toEqual(["hero", "slither"]);
  });

  it("Slither's entry matches the contract exactly", () => {
    const s = { ...newGame(), hero: { xp: 150, perks: [] }, hp: 62 };
    s.flags.slitherJoined = true;
    const [, slitherMember] = partyFor(s);
    expect(slitherMember).toEqual({
      id: "slither",
      name: "Slither",
      stats: slitherStatsForLevel(6),
      commands: ["attack", "guard", "venom"],
      cactusGuard: false,
    });
  });

  it("Slither enters every battle at full hp even when the hero is hurt", () => {
    const s = { ...newGame(), hero: { xp: 245, perks: [] }, hp: 1 };
    s.flags.slitherJoined = true;
    const [heroMember, slitherMember] = partyFor(s);
    expect(heroMember.stats.hp).toBe(1);
    expect(slitherMember.stats.hp).toBe(slitherMember.stats.maxHp);
    expect(slitherMember.stats).toEqual(slitherStatsForLevel(8));
  });

  it("Slither's level tracks the hero's xp", () => {
    for (const xp of [0, 20, 110, 195]) {
      const s = { ...newGame(), hero: { xp, perks: [] }, hp: 999 };
      s.flags.slitherJoined = true;
      const [, slitherMember] = partyFor(s);
      expect(slitherMember.stats).toEqual(
        slitherStatsForLevel(levelForXp(xp)),
      );
    }
  });

  it("hands out fresh command arrays (no shared mutation)", () => {
    const s = newGame();
    s.flags.slitherJoined = true;
    const [, slitherMember] = partyFor(s);
    slitherMember.commands.push("focus");
    expect(SLITHER_COMMANDS).toEqual(["attack", "guard", "venom"]);
    const [, again] = partyFor(s);
    expect(again.commands).toEqual(["attack", "guard", "venom"]);
  });

  it("hero perks show up in the party stats", () => {
    const s = { ...newGame(), hero: { xp: 20, perks: ["ferocity" as const] }, hp: 999 };
    expect(partyFor(s)[0].stats.attack).toBe(12); // 11 at level 2, +1 perk
  });
});
