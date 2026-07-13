import { describe, expect, it } from "vitest";
import {
  AtbBattle,
  chooseEnemyAction,
  type BattleEvent,
  type Combatant,
  type Side,
} from "../../src/core/atb";
import { makeRng } from "../../src/core/rng";

type Seed = Omit<Combatant, "gauge" | "guarding">;

function hero(overrides: Partial<Seed["stats"]> = {}): Seed {
  return {
    id: "hero",
    name: "Joseph",
    side: "party",
    stats: { maxHp: 30, hp: 30, attack: 8, defense: 4, speed: 10, ...overrides },
  };
}

function scarab(id = "scarab", overrides: Partial<Seed["stats"]> = {}): Seed {
  return {
    id,
    name: "Scarab",
    side: "enemy",
    stats: { maxHp: 20, hp: 20, attack: 8, defense: 4, speed: 10, ...overrides },
  };
}

/** Battle where everyone becomes ready after tick(1): fillRate 1, speed 10. */
function fastBattle(seeds: Seed[], rng: () => number = () => 0.5) {
  return new AtbBattle(seeds, { rng, fillRate: 1 });
}

function types(events: BattleEvent[]): string[] {
  return events.map((e) => e.type);
}

describe("AtbBattle gauge filling", () => {
  it("fills gauge by (speed/10) * fillRate * dt with the default rate", () => {
    const b = new AtbBattle([hero()]); // default fillRate 0.35
    b.tick(1);
    expect(b.getCombatant("hero").gauge).toBeCloseTo(0.35, 10);
  });

  it("fills proportionally to speed", () => {
    const b = new AtbBattle(
      [hero({ speed: 10 }), scarab("fast", { speed: 20 })],
      { fillRate: 0.35 },
    );
    b.tick(1);
    expect(b.getCombatant("fast").gauge).toBeCloseTo(
      b.getCombatant("hero").gauge * 2,
      10,
    );
  });

  it("honours a custom fillRate", () => {
    const b = new AtbBattle([hero()], { fillRate: 0.5 });
    b.tick(1);
    expect(b.getCombatant("hero").gauge).toBeCloseTo(0.5, 10);
  });

  it("clamps the gauge at 1 and emits ready exactly once per fill", () => {
    const b = fastBattle([hero()]);
    const events = b.tick(2.5); // would overshoot to 2.5
    expect(events).toEqual([{ type: "ready", id: "hero" }]);
    expect(b.getCombatant("hero").gauge).toBe(1);
    expect(b.isReady("hero")).toBe(true);
  });

  it("keeps a ready combatant ready without re-emitting or refilling", () => {
    const b = fastBattle([hero()]);
    b.tick(1);
    expect(b.tick(1)).toEqual([]);
    expect(b.tick(5)).toEqual([]);
    expect(b.getCombatant("hero").gauge).toBe(1);
    expect(b.isReady("hero")).toBe(true);
  });

  it("emits ready for several combatants filling in the same tick", () => {
    const b = fastBattle([hero(), scarab()]);
    const events = b.tick(1);
    expect(events).toEqual([
      { type: "ready", id: "hero" },
      { type: "ready", id: "scarab" },
    ]);
  });

  it("accumulates across partial ticks and emits ready when crossing 1", () => {
    const b = fastBattle([hero()]);
    expect(b.tick(0.4)).toEqual([]);
    expect(b.tick(0.4)).toEqual([]);
    expect(b.tick(0.4)).toEqual([{ type: "ready", id: "hero" }]);
  });
});

describe("AtbBattle acting", () => {
  it("act resets the gauge to 0 and the combatant refills and re-readies", () => {
    const b = fastBattle([hero(), scarab()]);
    b.tick(1);
    b.act("hero", "attack", "scarab");
    expect(b.getCombatant("hero").gauge).toBe(0);
    expect(b.isReady("hero")).toBe(false);
    const events = b.tick(1);
    expect(events).toContainEqual({ type: "ready", id: "hero" });
  });

  it("computes damage exactly: rng()=0 gives the 0.9 multiplier", () => {
    // (8*2 - 4) * 0.9 = 10.8 -> round -> 11
    const b = fastBattle([hero(), scarab()], () => 0);
    b.tick(1);
    const [action] = b.act("hero", "attack", "scarab");
    expect(action).toEqual({
      type: "action",
      actorId: "hero",
      targetId: "scarab",
      action: "attack",
      damage: 11,
      targetHp: 9,
    });
    expect(b.getCombatant("scarab").stats.hp).toBe(9);
  });

  it("computes damage exactly: rng()=0.5 gives the 1.0 multiplier", () => {
    // (8*2 - 4) * 1.0 = 12
    const b = fastBattle([hero(), scarab()], () => 0.5);
    b.tick(1);
    const [action] = b.act("hero", "attack", "scarab");
    expect(action.type).toBe("action");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(12);
  });

  it("never deals less than 1 damage", () => {
    const b = fastBattle(
      [hero({ attack: 1 }), scarab("tank", { defense: 50 })],
      () => 0,
    );
    b.tick(1);
    const [action] = b.act("hero", "attack", "tank");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(1);
  });

  it("guard sets guarding, resets gauge and emits a self-targeted 0-damage action", () => {
    const b = fastBattle([hero(), scarab()]);
    b.tick(1);
    const events = b.act("hero", "guard");
    expect(events).toEqual([
      {
        type: "action",
        actorId: "hero",
        targetId: "hero",
        action: "guard",
        damage: 0,
        targetHp: 30,
      },
    ]);
    expect(b.getCombatant("hero").guarding).toBe(true);
    expect(b.getCombatant("hero").gauge).toBe(0);
  });

  it("halves damage (floored, min 1) while the target is guarding", () => {
    const b = fastBattle([hero(), scarab()], () => 0); // raw damage 11
    b.tick(1);
    b.act("hero", "guard");
    const [action] = b.act("scarab", "attack", "hero");
    // floor(11 / 2) = 5
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(5);
    expect(b.getCombatant("hero").stats.hp).toBe(25);
  });

  it("guard halving never drops below 1 damage", () => {
    const b = fastBattle(
      [hero({ defense: 50 }), scarab("weak", { attack: 1 })],
      () => 0,
    );
    b.tick(1);
    b.act("hero", "guard");
    const [action] = b.act("weak", "attack", "hero");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(1);
  });

  it("guard expires when the guard's own next ready fires", () => {
    const b = fastBattle([hero(), scarab()], () => 0);
    b.tick(1);
    b.act("hero", "guard");
    expect(b.getCombatant("hero").guarding).toBe(true);
    const events = b.tick(1); // hero refills and becomes ready again
    expect(events).toContainEqual({ type: "ready", id: "hero" });
    expect(b.getCombatant("hero").guarding).toBe(false);
    // and a fresh attack now does full damage
    const [action] = b.act("scarab", "attack", "hero");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(11);
  });

  it("guard still protects while the guard waits below ready", () => {
    const b = fastBattle([hero(), scarab()], () => 0);
    b.tick(1);
    b.act("hero", "guard");
    b.tick(0.5); // hero at 0.5 gauge: still guarding, scarab still ready
    expect(b.getCombatant("hero").guarding).toBe(true);
    const [action] = b.act("scarab", "attack", "hero");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(5);
  });
});

describe("AtbBattle act() error cases", () => {
  function readyPair() {
    const b = fastBattle([hero(), scarab()]);
    b.tick(1);
    return b;
  }

  it("throws on an unknown actor id", () => {
    expect(() => readyPair().act("ghost", "attack", "scarab")).toThrow(/ghost/);
  });

  it("throws on an unknown target id", () => {
    expect(() => readyPair().act("hero", "attack", "ghost")).toThrow(/ghost/);
  });

  it("throws when the actor is not ready", () => {
    const b = fastBattle([hero(), scarab()]);
    b.tick(0.5);
    expect(() => b.act("hero", "attack", "scarab")).toThrow(/not ready/);
  });

  it("throws when the actor is dead", () => {
    const b = fastBattle(
      [hero(), scarab("s1"), scarab("s2", { hp: 1, maxHp: 1 })],
      () => 0.5,
    );
    b.tick(1);
    b.act("hero", "attack", "s2"); // kills s2 (ready but now dead)
    expect(() => b.act("s2", "attack", "hero")).toThrow(/dead/);
  });

  it("throws when attacking without a targetId", () => {
    expect(() => readyPair().act("hero", "attack")).toThrow(/targetId/);
  });

  it("throws when attacking a dead target", () => {
    const b = fastBattle(
      [hero(), scarab("s1", { hp: 1, maxHp: 1 }), scarab("s2")],
      () => 0.5,
    );
    b.tick(1);
    b.act("hero", "attack", "s1"); // s1 dies, s2 keeps battle alive
    b.tick(1);
    expect(() => b.act("hero", "attack", "s1")).toThrow(/defeated/);
  });

  it("throws when attacking a same-side target", () => {
    const b = fastBattle([hero(), { ...hero(), id: "ally", name: "Ally" }, scarab()]);
    b.tick(1);
    expect(() => b.act("hero", "attack", "ally")).toThrow(/same side/);
  });

  it("getCombatant throws on unknown ids", () => {
    expect(() => fastBattle([hero()]).getCombatant("nope")).toThrow(/nope/);
  });
});

describe("AtbBattle defeat and victory", () => {
  it("emits defeated when hp hits 0 and freezes the dead combatant's gauge", () => {
    const b = fastBattle([hero(), scarab("s", { hp: 5, maxHp: 5 }), scarab("s2")], () => 0.5);
    b.tick(1);
    const events = b.act("hero", "attack", "s"); // 12 damage kills s
    expect(types(events)).toEqual(["action", "defeated"]);
    expect(b.getCombatant("s").stats.hp).toBe(0);
    expect(b.livingOn("enemy").map((c) => c.id)).toEqual(["s2"]);
    const before = b.getCombatant("s").gauge;
    b.tick(1);
    expect(b.getCombatant("s").gauge).toBe(before); // no gauge for the dead
  });

  it("hp is clamped at 0 in the action event", () => {
    const b = fastBattle([hero(), scarab("s", { hp: 3, maxHp: 3 })], () => 0.5);
    b.tick(1);
    const [action] = b.act("hero", "attack", "s");
    expect((action as Extract<BattleEvent, { type: "action" }>).targetHp).toBe(0);
  });

  it("emits victory exactly once when a side is wiped, in order action/defeated/victory", () => {
    const b = fastBattle([hero(), scarab("s", { hp: 5, maxHp: 5 })], () => 0.5);
    b.tick(1);
    const events = b.act("hero", "attack", "s");
    expect(types(events)).toEqual(["action", "defeated", "victory"]);
    expect(events[2]).toEqual({ type: "victory", winner: "party" });
    expect(b.over).toBe(true);
    expect(b.winner).toBe<Side>("party");
  });

  it("does not fire victory while the wiped side still has living members", () => {
    const b = fastBattle([hero(), scarab("s1", { hp: 5, maxHp: 5 }), scarab("s2")], () => 0.5);
    b.tick(1);
    const events = b.act("hero", "attack", "s1");
    expect(types(events)).toEqual(["action", "defeated"]);
    expect(b.over).toBe(false);
    expect(b.winner).toBeNull();
  });

  it("tick is inert after victory: returns [] and fills no gauges", () => {
    const b = fastBattle([hero(), scarab("s", { hp: 1, maxHp: 1 })], () => 0.5);
    b.tick(1);
    b.act("hero", "attack", "s");
    expect(b.over).toBe(true);
    expect(b.tick(10)).toEqual([]);
    expect(b.getCombatant("hero").gauge).toBe(0);
  });

  it("act throws after victory", () => {
    const b = fastBattle([hero(), scarab("s", { hp: 1, maxHp: 1 })], () => 0.5);
    b.tick(1);
    b.act("hero", "attack", "s");
    expect(() => b.act("hero", "attack", "s")).toThrow(/over/);
  });
});

describe("AtbBattle constructor", () => {
  it("deep-copies stats so callers' objects are never mutated", () => {
    const mine = hero();
    const b = fastBattle([mine, scarab()], () => 0.5);
    b.tick(1);
    b.act("scarab", "attack", "hero");
    expect(mine.stats.hp).toBe(30); // caller's object untouched
    expect(b.getCombatant("hero").stats.hp).toBe(18);
    // and mutations to the caller's object don't leak in
    mine.stats.hp = 1;
    expect(b.getCombatant("hero").stats.hp).toBe(18);
  });

  it("initialises gauge to 0 and guarding to false", () => {
    const b = new AtbBattle([hero()]);
    const c = b.getCombatant("hero");
    expect(c.gauge).toBe(0);
    expect(c.guarding).toBe(false);
  });
});

describe("chooseEnemyAction", () => {
  function threeParty() {
    return fastBattle([
      hero(),
      { ...hero(), id: "p2", name: "P2" },
      { ...hero(), id: "p3", name: "P3" },
      scarab(),
    ]);
  }

  it("targets only living party members", () => {
    const b = fastBattle(
      [hero({ hp: 1, maxHp: 1 }), { ...hero(), id: "p2" }, scarab()],
      () => 0.5,
    );
    b.tick(1);
    b.act("scarab", "attack", "hero"); // hero dies
    b.tick(1);
    for (const r of [0, 0.3, 0.6, 0.99]) {
      expect(chooseEnemyAction(b, "scarab", () => r)).toEqual({
        action: "attack",
        targetId: "p2",
      });
    }
  });

  it("maps rng values across the living party deterministically", () => {
    const b = threeParty();
    expect(chooseEnemyAction(b, "scarab", () => 0)).toEqual({
      action: "attack",
      targetId: "hero",
    });
    expect(chooseEnemyAction(b, "scarab", () => 0.5)).toEqual({
      action: "attack",
      targetId: "p2",
    });
    expect(chooseEnemyAction(b, "scarab", () => 0.99)).toEqual({
      action: "attack",
      targetId: "p3",
    });
  });

  it("is deterministic with a seeded rng", () => {
    const pick = () => chooseEnemyAction(threeParty(), "scarab", makeRng(42));
    expect(pick()).toEqual(pick());
  });
});

describe("makeRng", () => {
  it("is deterministic per seed and stays in [0, 1)", () => {
    const a = makeRng(123);
    const b = makeRng(123);
    const c = makeRng(456);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    const seqC = Array.from({ length: 20 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of [...seqA, ...seqC]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
