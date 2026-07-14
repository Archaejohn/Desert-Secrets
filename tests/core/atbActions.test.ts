import { describe, expect, it } from "vitest";
import {
  AtbBattle,
  type BattleEvent,
  type Combatant,
} from "../../src/core/atb";

type Seed = Omit<Combatant, "gauge" | "guarding">;

function hero(overrides: Partial<Seed["stats"]> = {}, extra: Partial<Seed> = {}): Seed {
  return {
    id: "hero",
    name: "Joseph",
    side: "party",
    stats: { maxHp: 30, hp: 30, attack: 8, defense: 4, speed: 10, ...overrides },
    ...extra,
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

describe("constructor defaults for the new fields", () => {
  it("initialises focused/secondWindUsed/sandstepUsed/cactusGuard to false", () => {
    const b = fastBattle([hero(), scarab()]);
    const c = b.getCombatant("hero");
    expect(c.focused).toBe(false);
    expect(c.secondWindUsed).toBe(false);
    expect(c.sandstepUsed).toBe(false);
    expect(c.cactusGuard).toBe(false);
  });

  it("honours cactusGuard: true from the seed", () => {
    const b = fastBattle([hero({}, { cactusGuard: true }), scarab()]);
    expect(b.getCombatant("hero").cactusGuard).toBe(true);
  });
});

describe("focus", () => {
  it("emits a self-targeted 0-damage action and sets focused", () => {
    const b = fastBattle([hero(), scarab()]);
    b.tick(1);
    const events = b.act("hero", "focus");
    expect(events).toEqual([
      {
        type: "action",
        actorId: "hero",
        targetId: "hero",
        action: "focus",
        damage: 0,
        targetHp: 30,
      },
    ]);
    expect(b.getCombatant("hero").focused).toBe(true);
    expect(b.getCombatant("hero").gauge).toBe(0);
  });

  it("multiplies the next attack by 1.5 after variance (rng=0.5: 12 -> 18)", () => {
    const b = fastBattle([hero(), scarab()], () => 0.5);
    b.tick(1);
    b.act("hero", "focus");
    b.tick(1);
    const [action] = b.act("hero", "attack", "scarab");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(18);
    expect(b.getCombatant("scarab").stats.hp).toBe(2);
  });

  it("rounds after the multiplier (rng=0: base 11 -> 16.5 -> 17)", () => {
    const b = fastBattle([hero(), scarab()], () => 0);
    b.tick(1);
    b.act("hero", "focus");
    b.tick(1);
    const [action] = b.act("hero", "attack", "scarab");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(17);
  });

  it("applies before guard halving: focused 18 -> guarded floor(18/2)=9", () => {
    const b = fastBattle([hero(), scarab("scarab", { speed: 5 })], () => 0.5);
    b.tick(2); // both ready
    b.act("hero", "focus");
    b.act("scarab", "guard");
    b.tick(1); // hero re-readies; scarab at 0.5, still guarding
    expect(b.getCombatant("scarab").guarding).toBe(true);
    const [action] = b.act("hero", "attack", "scarab");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(9);
  });

  it("is cleared by the attack it boosted", () => {
    const b = fastBattle([hero(), scarab()], () => 0.5);
    b.tick(1);
    b.act("hero", "focus");
    b.tick(1);
    b.act("hero", "attack", "scarab");
    expect(b.getCombatant("hero").focused).toBe(false);
    b.tick(1);
    const [action] = b.act("hero", "attack", "scarab");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(12);
  });

  it("survives taking a hit before the boosted attack", () => {
    const b = fastBattle([hero(), scarab()], () => 0.5);
    b.tick(1);
    b.act("hero", "focus");
    b.act("scarab", "attack", "hero");
    expect(b.getCombatant("hero").focused).toBe(true);
  });

  it("is reusable within a battle (not once-per-battle)", () => {
    const b = fastBattle([hero(), scarab()]);
    b.tick(1);
    b.act("hero", "focus");
    b.tick(1);
    expect(() => b.act("hero", "focus")).not.toThrow();
  });

  it("throws when the actor is not ready", () => {
    const b = fastBattle([hero(), scarab()]);
    b.tick(0.5);
    expect(() => b.act("hero", "focus")).toThrow(/not ready/);
  });
});

describe("second-wind", () => {
  function woundedHero(hp: number) {
    const b = fastBattle([hero({ hp }), scarab()]);
    b.tick(1);
    return b;
  }

  it("heals round(maxHp * 0.3) and emits action then heal", () => {
    const b = woundedHero(10); // maxHp 30 -> heal 9
    const events = b.act("hero", "second-wind");
    expect(events).toEqual([
      {
        type: "action",
        actorId: "hero",
        targetId: "hero",
        action: "second-wind",
        damage: 0,
        targetHp: 19,
      },
      { type: "heal", id: "hero", amount: 9, hp: 19 },
    ]);
    expect(b.getCombatant("hero").stats.hp).toBe(19);
    expect(b.getCombatant("hero").gauge).toBe(0);
  });

  it("caps the heal at maxHp and reports the clamped amount", () => {
    const b = woundedHero(28);
    const events = b.act("hero", "second-wind");
    expect(events[1]).toEqual({ type: "heal", id: "hero", amount: 2, hp: 30 });
    expect(b.getCombatant("hero").stats.hp).toBe(30);
  });

  it("marks secondWindUsed and throws on reuse", () => {
    const b = woundedHero(10);
    b.act("hero", "second-wind");
    expect(b.getCombatant("hero").secondWindUsed).toBe(true);
    b.tick(1);
    expect(() => b.act("hero", "second-wind")).toThrow(/second-wind/);
    expect(() => b.act("hero", "second-wind")).toThrow(/already/);
  });

  it("is tracked per combatant", () => {
    const b = fastBattle([hero({ hp: 10 }), scarab("s", { hp: 10 })]);
    b.tick(1);
    b.act("hero", "second-wind");
    expect(() => b.act("s", "second-wind")).not.toThrow();
  });
});

describe("sandstep", () => {
  it("leaves the gauge at 0.5 instead of 0, not ready", () => {
    const b = fastBattle([hero(), scarab()]);
    b.tick(1);
    const events = b.act("hero", "sandstep");
    expect(events).toEqual([
      {
        type: "action",
        actorId: "hero",
        targetId: "hero",
        action: "sandstep",
        damage: 0,
        targetHp: 30,
      },
    ]);
    expect(b.getCombatant("hero").gauge).toBe(0.5);
    expect(b.isReady("hero")).toBe(false);
  });

  it("refills from 0.5 in half the usual time", () => {
    const b = fastBattle([hero()]);
    b.tick(1);
    b.act("hero", "sandstep");
    expect(types(b.tick(0.4))).toEqual([]); // 0.9: not yet
    expect(b.tick(0.2)).toEqual([{ type: "ready", id: "hero" }]);
  });

  it("marks sandstepUsed and throws on reuse", () => {
    const b = fastBattle([hero(), scarab()]);
    b.tick(1);
    b.act("hero", "sandstep");
    expect(b.getCombatant("hero").sandstepUsed).toBe(true);
    b.tick(1);
    expect(() => b.act("hero", "sandstep")).toThrow(/sandstep/);
    expect(() => b.act("hero", "sandstep")).toThrow(/already/);
  });
});

describe("cactusGuard thorns", () => {
  function thornyPair(rng: () => number = () => 0.5, scarabHp = 20) {
    const b = fastBattle(
      [hero({}, { cactusGuard: true }), scarab("scarab", { hp: scarabHp })],
      rng,
    );
    b.tick(1);
    return b;
  }

  it("pricks the attacker for a flat 2 after the hit resolves", () => {
    const b = thornyPair(() => 0); // raw 11 -> guarded 5
    b.act("hero", "guard");
    const events = b.act("scarab", "attack", "hero");
    expect(events).toEqual([
      {
        type: "action",
        actorId: "scarab",
        targetId: "hero",
        action: "attack",
        damage: 5,
        targetHp: 25,
      },
      { type: "thorns", targetId: "scarab", damage: 2, targetHp: 18 },
    ]);
    expect(b.getCombatant("scarab").stats.hp).toBe(18);
  });

  it("does not fire when the cactus guard is not guarding", () => {
    const b = thornyPair();
    const events = b.act("scarab", "attack", "hero");
    expect(types(events)).toEqual(["action"]);
  });

  it("does not fire for a guard without the passive", () => {
    const b = fastBattle([hero(), scarab()]);
    b.tick(1);
    b.act("hero", "guard");
    const events = b.act("scarab", "attack", "hero");
    expect(types(events)).toEqual(["action"]);
  });

  it("keeps guard halving intact alongside the thorns", () => {
    const b = thornyPair(() => 0.5); // raw 12 -> guarded 6
    b.act("hero", "guard");
    const [action] = b.act("scarab", "attack", "hero");
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(6);
  });

  it("can kill: emits action, thorns, defeated, victory in order", () => {
    const b = thornyPair(() => 0.5, 2); // scarab at 2 hp dies to thorns
    b.act("hero", "guard");
    const events = b.act("scarab", "attack", "hero");
    expect(types(events)).toEqual(["action", "thorns", "defeated", "victory"]);
    expect(events[2]).toEqual({ type: "defeated", id: "scarab" });
    expect(events[3]).toEqual({ type: "victory", winner: "party" });
    expect(
      (events[1] as Extract<BattleEvent, { type: "thorns" }>).targetHp,
    ).toBe(0);
    expect(b.over).toBe(true);
    expect(b.winner).toBe("party");
  });

  it("emits only defeated (no victory) when the attacker's side survives", () => {
    const b = fastBattle(
      [
        hero({}, { cactusGuard: true }),
        scarab("s1", { hp: 2 }),
        scarab("s2"),
      ],
      () => 0.5,
    );
    b.tick(1);
    b.act("hero", "guard");
    const events = b.act("s1", "attack", "hero");
    expect(types(events)).toEqual(["action", "thorns", "defeated"]);
    expect(b.over).toBe(false);
  });

  it("still pricks when the hit kills the guard but the battle continues", () => {
    const b = fastBattle(
      [
        { ...hero({ hp: 3 }), cactusGuard: true },
        { ...hero({}), id: "ally", name: "Ally" },
        scarab(),
      ],
      () => 0.5,
    );
    b.tick(1);
    b.act("hero", "guard");
    const events = b.act("scarab", "attack", "hero"); // 6 kills the 3 hp guard
    expect(types(events)).toEqual(["action", "defeated", "thorns"]);
    expect(b.getCombatant("scarab").stats.hp).toBe(18);
    expect(b.over).toBe(false);
  });

  it("skips the thorns when the killing blow already ended the battle", () => {
    const b = fastBattle(
      [{ ...hero({ hp: 3 }), cactusGuard: true }, scarab()],
      () => 0.5,
    );
    b.tick(1);
    b.act("hero", "guard");
    const events = b.act("scarab", "attack", "hero");
    expect(types(events)).toEqual(["action", "defeated", "victory"]);
    expect(b.getCombatant("scarab").stats.hp).toBe(20); // no prick after victory
  });
});

describe("mixed-action integration", () => {
  it("focus + second-wind + sandstep chain plays out with correct gauges", () => {
    const b = fastBattle([hero({ hp: 12 }), scarab("s", { speed: 1 })], () => 0.5);
    b.tick(1);
    b.act("hero", "focus");
    b.tick(1);
    b.act("hero", "second-wind"); // 12 + 9 = 21
    expect(b.getCombatant("hero").stats.hp).toBe(21);
    b.tick(1);
    b.act("hero", "sandstep");
    expect(b.getCombatant("hero").gauge).toBe(0.5);
    b.tick(0.6);
    const [action] = b.act("hero", "attack", "s"); // focus still armed: 18
    expect((action as Extract<BattleEvent, { type: "action" }>).damage).toBe(18);
  });
});
