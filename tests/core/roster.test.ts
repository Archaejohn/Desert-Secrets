import { describe, expect, it } from "vitest";
import {
  MAX_PARTY,
  ROSTER,
  activeParty,
  availablePartyIds,
  rosterById,
  type RosterId,
} from "../../src/core/roster";
import {
  heroStats,
  newGame,
  partyFor,
  type Act1State,
} from "../../src/core/gameState";
import {
  FLUFFBALL_COMMANDS,
  PIGGY_COMMANDS,
  SLITHER_COMMANDS,
  commandsForLevel,
  fluffballStatsForLevel,
  levelForXp,
  piggyStatsForLevel,
  slitherStatsForLevel,
} from "../../src/core/progression";

/** A run state with the given availability flags flipped on. */
function withFlags(flags: Partial<Record<string, boolean>>): Act1State {
  const s = newGame();
  for (const [k, v] of Object.entries(flags)) s.flags[k] = !!v;
  return s;
}

describe("ROSTER registry", () => {
  it("lists the four playable characters in default party order", () => {
    expect(ROSTER.map((e) => e.id)).toEqual([
      "hero",
      "slither",
      "fluffball",
      "piggy",
    ]);
  });

  it("carries battle sprite keys and equip tags per member", () => {
    expect(rosterById("hero").sprite).toBe("hero");
    expect(rosterById("slither").sprite).toBe("slither");
    expect(rosterById("fluffball").sprite).toBe("fluffball");
    expect(rosterById("piggy").sprite).toBe("piggy");
    expect(rosterById("hero").tags).toEqual(["human"]);
    expect(rosterById("slither").tags).toEqual(["reptile"]);
    // Both penguins share the tag so gear can key off it, not the id.
    expect(rosterById("fluffball").tags).toEqual(["penguin"]);
    expect(rosterById("piggy").tags).toEqual(["penguin"]);
  });

  it("rosterById throws on an unknown id", () => {
    expect(() => rosterById("thomas" as RosterId)).toThrow(/unknown roster id/);
  });
});

describe("availability", () => {
  it("hero is always available; the rest gate on their flag", () => {
    expect(availablePartyIds(newGame())).toEqual(["hero"]);
    expect(availablePartyIds(withFlags({ slitherJoined: true }))).toEqual([
      "hero",
      "slither",
    ]);
    expect(
      availablePartyIds(
        withFlags({ slitherJoined: true, fluffballJoined: true }),
      ),
    ).toEqual(["hero", "slither", "fluffball"]);
    expect(
      availablePartyIds(
        withFlags({
          slitherJoined: true,
          fluffballJoined: true,
          piggyCaught: true,
        }),
      ),
    ).toEqual(["hero", "slither", "fluffball", "piggy"]);
  });
});

describe("activeParty", () => {
  it("mirrors partyFor (the alias) exactly", () => {
    const s = withFlags({ slitherJoined: true, fluffballJoined: true });
    expect(partyFor(s)).toEqual(activeParty(s));
  });

  it("grows as availability flags unlock, in roster order", () => {
    expect(activeParty(newGame()).map((m) => m.id)).toEqual(["hero"]);
    expect(
      activeParty(withFlags({ slitherJoined: true })).map((m) => m.id),
    ).toEqual(["hero", "slither"]);
    // Act 5: the reachable Part-One party is Joseph + Slither + Fluffball.
    expect(
      activeParty(
        withFlags({ slitherJoined: true, fluffballJoined: true }),
      ).map((m) => m.id),
    ).toEqual(["hero", "slither", "fluffball"]);
    // End of Act 7: Piggy fills the fourth slot.
    expect(
      activeParty(
        withFlags({
          slitherJoined: true,
          fluffballJoined: true,
          piggyCaught: true,
        }),
      ).map((m) => m.id),
    ).toEqual(["hero", "slither", "fluffball", "piggy"]);
  });

  it("caps the party at MAX_PARTY even if more were somehow available", () => {
    expect(MAX_PARTY).toBe(4);
    const all = withFlags({
      slitherJoined: true,
      fluffballJoined: true,
      piggyCaught: true,
    });
    expect(activeParty(all).length).toBeLessThanOrEqual(MAX_PARTY);
  });

  it("builds each member's stats from the roster's level-driven functions", () => {
    const s: Act1State = {
      ...withFlags({
        slitherJoined: true,
        fluffballJoined: true,
        piggyCaught: true,
      }),
      hero: { xp: 150, perks: [] },
      hp: 1,
    };
    const level = levelForXp(s.hero.xp); // 6
    const [hero, slither, fluffball, piggy] = activeParty(s);
    expect(hero.stats).toEqual(heroStats(s));
    expect(hero.stats.hp).toBe(1); // clamped to current hp
    expect(hero.commands).toEqual(commandsForLevel(level));
    expect(slither.stats).toEqual(slitherStatsForLevel(level));
    expect(fluffball.stats).toEqual(fluffballStatsForLevel(level));
    expect(piggy.stats).toEqual(piggyStatsForLevel(level));
    // The creatures enter every battle at full hp, unlike the hero.
    for (const m of [slither, fluffball, piggy]) {
      expect(m.stats.hp).toBe(m.stats.maxHp);
    }
  });

  it("hands out the themed command sets (fresh arrays, no shared mutation)", () => {
    const s = withFlags({
      slitherJoined: true,
      fluffballJoined: true,
      piggyCaught: true,
    });
    const [, slither, fluffball, piggy] = activeParty(s);
    expect(slither.commands).toEqual(SLITHER_COMMANDS);
    expect(fluffball.commands).toEqual(FLUFFBALL_COMMANDS);
    expect(piggy.commands).toEqual(PIGGY_COMMANDS);
    fluffball.commands.push("venom");
    expect(FLUFFBALL_COMMANDS).toEqual(["attack", "guard", "focus"]);
    expect(activeParty(s)[2].commands).toEqual(["attack", "guard", "focus"]);
  });

  it("only the hero carries a level-gated cactus guard", () => {
    const s = withFlags({
      slitherJoined: true,
      fluffballJoined: true,
      piggyCaught: true,
    });
    s.hero = { xp: 45, perks: [] }; // level 3
    const [hero, slither, fluffball, piggy] = activeParty(s);
    expect(hero.cactusGuard).toBe(true);
    for (const m of [slither, fluffball, piggy]) expect(m.cactusGuard).toBe(false);
  });
});

describe("selectedParty override (the Part-Two swap extension point)", () => {
  const allAvailable = (): Act1State =>
    withFlags({
      slitherJoined: true,
      fluffballJoined: true,
      piggyCaught: true,
    });

  it("honours an explicit ordered selection", () => {
    const s: Act1State = {
      ...allAvailable(),
      selectedParty: ["hero", "piggy"],
    };
    expect(activeParty(s).map((m) => m.id)).toEqual(["hero", "piggy"]);
  });

  it("drops selected ids that are not yet available (no crash on a stale pick)", () => {
    const s: Act1State = {
      ...withFlags({ slitherJoined: true }),
      selectedParty: ["hero", "fluffball", "slither"], // fluffball locked
    };
    expect(activeParty(s).map((m) => m.id)).toEqual(["hero", "slither"]);
  });

  it("still caps an over-long selection at MAX_PARTY", () => {
    const s: Act1State = {
      ...allAvailable(),
      selectedParty: ["piggy", "fluffball", "slither", "hero", "hero"],
    };
    expect(activeParty(s).length).toBe(MAX_PARTY);
  });

  it("falls back to everyone-available when unset", () => {
    const s = allAvailable();
    expect(s.selectedParty).toBeUndefined();
    expect(activeParty(s).map((m) => m.id)).toEqual([
      "hero",
      "slither",
      "fluffball",
      "piggy",
    ]);
  });
});
