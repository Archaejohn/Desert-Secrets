import { describe, expect, it } from "vitest";
import {
  AtbBattle,
  type BattleEvent,
  type Combatant,
} from "../../src/core/atb";

type Seed = Omit<Combatant, "gauge" | "guarding">;

function slither(
  overrides: Partial<Seed["stats"]> = {},
  extra: Partial<Seed> = {},
): Seed {
  return {
    id: "slither",
    name: "Slither",
    side: "party",
    stats: { maxHp: 22, hp: 22, attack: 8, defense: 2, speed: 14, ...overrides },
    ...extra,
  };
}

function scarab(id = "scarab", overrides: Partial<Seed["stats"]> = {}): Seed {
  return {
    id,
    name: "Frost Scarab",
    side: "enemy",
    stats: { maxHp: 20, hp: 20, attack: 8, defense: 4, speed: 10, ...overrides },
  };
}

/** Battle where speed-10 combatants become ready after tick(1). */
function fastBattle(seeds: Seed[], rng: () => number = () => 0.5) {
  return new AtbBattle(seeds, { rng, fillRate: 1 });
}

function types(events: BattleEvent[]): string[] {
  return events.map((e) => e.type);
}

function readyAll(b: AtbBattle, seconds = 2) {
  b.tick(seconds);
}

describe("baseSpeed capture", () => {
  it("captures every combatant's entry speed at construction", () => {
    const b = fastBattle([slither({ speed: 14 }), scarab("s", { speed: 7 })]);
    expect(b.getCombatant("slither").baseSpeed).toBe(14);
    expect(b.getCombatant("s").baseSpeed).toBe(7);
  });

  it("keeps baseSpeed at the entry value while current speed drops", () => {
    const b = fastBattle([slither(), scarab()]);
    readyAll(b);
    b.act("slither", "venom", "scarab");
    const c = b.getCombatant("scarab");
    expect(c.stats.speed).toBe(7.5);
    expect(c.baseSpeed).toBe(10);
  });
});

describe("venom damage", () => {
  it("deals 0.75x the varied base damage (rng=0.5: base 12 -> 9)", () => {
    const b = fastBattle([slither(), scarab()], () => 0.5);
    readyAll(b);
    const [action] = b.act("slither", "venom", "scarab");
    expect(action).toEqual({
      type: "action",
      actorId: "slither",
      targetId: "scarab",
      action: "venom",
      damage: 9,
      targetHp: 11,
    });
    expect(b.getCombatant("scarab").stats.hp).toBe(11);
  });

  it("rounds after the multiplier (rng=0: base 11 -> 8.25 -> 8)", () => {
    const b = fastBattle([slither(), scarab()], () => 0);
    readyAll(b);
    const [action] = b.act("slither", "venom", "scarab");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(8);
  });

  it("rounds half up (attack 7, def 4, rng=0: base 9 -> 6.75 -> 7)", () => {
    const b = fastBattle([slither({ attack: 7 }), scarab()], () => 0);
    readyAll(b);
    const [action] = b.act("slither", "venom", "scarab");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(7);
  });

  it("never deals less than 1", () => {
    const b = fastBattle(
      [slither({ attack: 1 }), scarab("tank", { defense: 50 })],
      () => 0,
    );
    readyAll(b);
    const [action] = b.act("slither", "venom", "tank");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(1);
  });

  it("applies guard halving after the venom multiplier (9 -> 4)", () => {
    const b = fastBattle([slither(), scarab()], () => 0.5);
    readyAll(b);
    b.act("scarab", "guard");
    const [action] = b.act("slither", "venom", "scarab");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(4);
    expect(b.getCombatant("scarab").stats.hp).toBe(16);
  });

  it("guarded venom still deals at least 1", () => {
    const b = fastBattle(
      [slither({ attack: 1 }), scarab("tank", { defense: 50 })],
      () => 0,
    );
    readyAll(b);
    b.act("tank", "guard");
    const [action] = b.act("slither", "venom", "tank");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(1);
  });

  it("does not trigger cactus-guard thorns (venom is not an attack)", () => {
    const b = fastBattle(
      [
        { ...scarab("biter"), side: "enemy" as const },
        slither({}, { cactusGuard: true }),
      ],
      () => 0.5,
    );
    readyAll(b);
    b.act("slither", "guard");
    // An enemy "venom" against a guarding cactus-guard party member:
    const events = b.act("biter", "venom", "slither");
    expect(types(events)).toEqual(["action", "debuff"]);
  });
});

describe("venom speed debuff", () => {
  it("multiplies the target's current speed by 0.75", () => {
    const b = fastBattle([slither(), scarab()]);
    readyAll(b);
    b.act("slither", "venom", "scarab");
    expect(b.getCombatant("scarab").stats.speed).toBe(7.5);
  });

  it("emits the debuff event right after the action event", () => {
    const b = fastBattle([slither(), scarab()], () => 0.5);
    readyAll(b);
    const events = b.act("slither", "venom", "scarab");
    expect(types(events)).toEqual(["action", "debuff"]);
    expect(events[1]).toEqual({
      type: "debuff",
      targetId: "scarab",
      stat: "speed",
      speed: 7.5,
    });
  });

  it("stacks multiplicatively down to the floor: 10 -> 7.5 -> 5.625 -> 5", () => {
    const b = fastBattle([slither(), scarab("scarab", { maxHp: 500, hp: 500 })]);
    const speeds: number[] = [];
    for (let i = 0; i < 4; i++) {
      readyAll(b, 3);
      const events = b.act("slither", "venom", "scarab");
      const debuff = events[1] as Extract<BattleEvent, { type: "debuff" }>;
      speeds.push(debuff.speed);
    }
    expect(speeds).toEqual([7.5, 5.625, 5, 5]);
    expect(b.getCombatant("scarab").stats.speed).toBe(5);
  });

  it("floors at exactly 50% of the entry speed", () => {
    const b = fastBattle([
      slither(),
      scarab("s", { maxHp: 500, hp: 500, speed: 16 }),
    ]);
    for (let i = 0; i < 10; i++) {
      readyAll(b, 3);
      b.act("slither", "venom", "s");
    }
    expect(b.getCombatant("s").stats.speed).toBe(8);
    expect(b.getCombatant("s").baseSpeed).toBe(16);
  });

  it("a slowed combatant fills its gauge proportionally slower", () => {
    const b = fastBattle([slither(), scarab()]);
    readyAll(b);
    b.act("slither", "venom", "scarab"); // scarab now 7.5 speed
    b.act("scarab", "attack", "slither"); // spend scarab's gauge
    b.tick(1);
    expect(b.getCombatant("scarab").gauge).toBeCloseTo(0.75, 10);
    expect(b.isReady("scarab")).toBe(false);
  });
});

describe("venom kill ordering and bookkeeping", () => {
  it("emits action, debuff, defeated, victory when it wipes the side", () => {
    const b = fastBattle([slither(), scarab("s", { hp: 5 })], () => 0.5);
    readyAll(b);
    const events = b.act("slither", "venom", "s");
    expect(types(events)).toEqual(["action", "debuff", "defeated", "victory"]);
    expect(events[0]).toMatchObject({ action: "venom", damage: 9, targetHp: 0 });
    expect(events[2]).toEqual({ type: "defeated", id: "s" });
    expect(events[3]).toEqual({ type: "victory", winner: "party" });
    expect(b.over).toBe(true);
    expect(b.winner).toBe("party");
  });

  it("emits only action, debuff, defeated when the side survives", () => {
    const b = fastBattle(
      [slither(), scarab("s1", { hp: 5 }), scarab("s2")],
      () => 0.5,
    );
    readyAll(b);
    const events = b.act("slither", "venom", "s1");
    expect(types(events)).toEqual(["action", "debuff", "defeated"]);
    expect(b.over).toBe(false);
    expect(b.livingOn("enemy").map((c) => c.id)).toEqual(["s2"]);
  });

  it("consumes the full gauge", () => {
    const b = fastBattle([slither(), scarab()]);
    readyAll(b);
    b.act("slither", "venom", "scarab");
    expect(b.getCombatant("slither").gauge).toBe(0);
    expect(b.isReady("slither")).toBe(false);
  });

  it("is reusable (not once per battle)", () => {
    const b = fastBattle([slither(), scarab()]);
    readyAll(b);
    b.act("slither", "venom", "scarab");
    readyAll(b, 3);
    expect(() => b.act("slither", "venom", "scarab")).not.toThrow();
  });

  it("ends any guard the actor was holding", () => {
    const b = fastBattle([slither(), scarab("s", { speed: 5 })]);
    readyAll(b, 2);
    b.act("slither", "guard");
    b.tick(1); // slither re-readies (guard drops on own ready anyway)
    b.act("slither", "venom", "s");
    expect(b.getCombatant("slither").guarding).toBe(false);
  });
});

describe("venom target validation", () => {
  it("throws without a targetId", () => {
    const b = fastBattle([slither(), scarab()]);
    readyAll(b);
    expect(() => b.act("slither", "venom")).toThrow(/venom requires a targetId/);
  });

  it("throws on a dead target", () => {
    const b = fastBattle([slither(), scarab("s", { hp: 5 }), scarab("s2")]);
    readyAll(b);
    b.act("slither", "venom", "s"); // kills s (damage 9)
    readyAll(b, 3);
    expect(() => b.act("slither", "venom", "s")).toThrow(/already defeated/);
  });

  it("throws on a same-side target", () => {
    const b = fastBattle([
      slither(),
      { ...slither({}, {}), id: "hero", name: "Joseph" },
      scarab(),
    ]);
    readyAll(b);
    expect(() => b.act("slither", "venom", "hero")).toThrow(/same side/);
  });

  it("throws when the actor is not ready", () => {
    const b = fastBattle([slither(), scarab()]);
    b.tick(0.1);
    expect(() => b.act("slither", "venom", "scarab")).toThrow(/not ready/);
  });
});

describe("backwards compatibility around venom", () => {
  it("plain attacks do not change the target's speed", () => {
    const b = fastBattle([slither(), scarab()]);
    readyAll(b);
    b.act("slither", "attack", "scarab");
    expect(b.getCombatant("scarab").stats.speed).toBe(10);
  });

  it("a venom-slowed enemy can still act and hit back", () => {
    const b = fastBattle([slither(), scarab()], () => 0.5);
    readyAll(b);
    b.act("slither", "venom", "scarab");
    const events = b.act("scarab", "attack", "slither");
    expect(types(events)).toEqual(["action"]);
    expect(b.getCombatant("slither").stats.hp).toBe(22 - 14); // 8*2-2 = 14
  });
});
