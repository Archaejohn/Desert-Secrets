/**
 * Active Time Battle core. Engine-agnostic, no Phaser imports.
 * See docs/CONTRACTS.md sections 2 and 5.
 */

export interface Stats {
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export type Side = "party" | "enemy";

export type ActionId =
  | "attack"
  | "guard"
  | "focus"
  | "second-wind"
  | "sandstep"
  | "venom";

export interface Combatant {
  id: string;
  name: string;
  side: Side;
  stats: Stats;
  gauge: number; // 0..1
  guarding: boolean;
  /**
   * The three fields below are optional in the constructor seed for
   * backwards compatibility, but the battle always initializes them —
   * combatants read back from a battle always carry booleans.
   */
  focused?: boolean; // next attack ×1.5 (set by "focus")
  secondWindUsed?: boolean; // once per battle
  sandstepUsed?: boolean; // once per battle
  /** Passive: attackers hitting this combatant while it guards take 2 damage. */
  cactusGuard?: boolean;
  /**
   * The speed this combatant entered battle with, captured at
   * construction. Venom debuffs floor current speed at 50% of this.
   */
  baseSpeed?: number;
}

export type BattleEvent =
  | { type: "ready"; id: string }
  | {
      type: "action";
      actorId: string;
      targetId: string;
      action: ActionId;
      damage: number;
      targetHp: number;
    }
  | { type: "heal"; id: string; amount: number; hp: number }
  | { type: "debuff"; targetId: string; stat: "speed"; speed: number }
  | { type: "thorns"; targetId: string /* the attacker */; damage: 2; targetHp: number }
  | { type: "defeated"; id: string }
  | { type: "victory"; winner: Side };

export interface AtbOptions {
  rng?: () => number;
  /** Gauge per second at speed 10. Default 0.35. */
  fillRate?: number;
}

const DEFAULT_FILL_RATE = 0.35;
const THORNS_DAMAGE = 2;

/** A Combatant with every optional battle field resolved. */
type LiveCombatant = Required<Combatant>;

export class AtbBattle {
  private combatants: LiveCombatant[];
  private byId: Map<string, LiveCombatant>;
  private rng: () => number;
  private fillRate: number;
  private winnerSide: Side | null = null;

  constructor(
    combatants: Array<Omit<Combatant, "gauge" | "guarding">>,
    opts?: AtbOptions,
  ) {
    this.rng = opts?.rng ?? Math.random;
    this.fillRate = opts?.fillRate ?? DEFAULT_FILL_RATE;
    this.combatants = combatants.map((c) => ({
      id: c.id,
      name: c.name,
      side: c.side,
      stats: { ...c.stats }, // deep copy: never mutate the caller's objects
      gauge: 0,
      guarding: false,
      focused: false,
      secondWindUsed: false,
      sandstepUsed: false,
      cactusGuard: c.cactusGuard ?? false,
      baseSpeed: c.stats.speed, // entry speed: venom's slow floors at half this
    }));
    this.byId = new Map();
    for (const c of this.combatants) {
      if (this.byId.has(c.id)) {
        throw new Error(`AtbBattle: duplicate combatant id "${c.id}"`);
      }
      this.byId.set(c.id, c);
    }
  }

  get over(): boolean {
    return this.winnerSide !== null;
  }

  get winner(): Side | null {
    return this.winnerSide;
  }

  getCombatant(id: string): Combatant {
    const c = this.byId.get(id);
    if (!c) throw new Error(`AtbBattle: unknown combatant id "${id}"`);
    return c;
  }

  private getLive(id: string): LiveCombatant {
    return this.getCombatant(id) as LiveCombatant;
  }

  livingOn(side: Side): Combatant[] {
    return this.combatants.filter((c) => c.side === side && c.stats.hp > 0);
  }

  isReady(id: string): boolean {
    const c = this.getCombatant(id);
    return c.stats.hp > 0 && c.gauge >= 1;
  }

  /**
   * Advance time by dtSeconds. Fills each living, non-ready combatant's
   * gauge by (speed / 10) * fillRate * dt, clamped at 1. Emits "ready"
   * exactly once per fill; ready combatants stay ready (no refill,
   * no re-emit) until they act. Inert once the battle is over.
   */
  tick(dtSeconds: number): BattleEvent[] {
    if (this.winnerSide !== null) return [];
    const events: BattleEvent[] = [];
    for (const c of this.combatants) {
      if (c.stats.hp <= 0) continue; // the dead gain no gauge
      if (c.gauge >= 1) continue; // already ready: no refill / re-emit
      c.gauge += (c.stats.speed / 10) * this.fillRate * dtSeconds;
      if (c.gauge >= 1) {
        c.gauge = 1;
        c.guarding = false; // guard lasts until the guard's own next ready
        events.push({ type: "ready", id: c.id });
      }
    }
    return events;
  }

  /**
   * Consume the actor's full gauge to perform an action.
   * attack requires targetId naming a living opponent; the other actions
   * need no target. second-wind and sandstep are once per battle and
   * throw on reuse.
   */
  act(actorId: string, action: ActionId, targetId?: string): BattleEvent[] {
    if (this.winnerSide !== null) {
      throw new Error("AtbBattle: cannot act, the battle is over");
    }
    const actor = this.getLive(actorId);
    if (actor.stats.hp <= 0) {
      throw new Error(`AtbBattle: actor "${actorId}" is dead and cannot act`);
    }
    if (actor.gauge < 1) {
      throw new Error(`AtbBattle: actor "${actorId}" is not ready`);
    }

    // Acting starts fresh: any previous guard on the actor ends now.
    actor.guarding = false;

    switch (action) {
      case "guard":
        return this.actGuard(actor);
      case "focus":
        return this.actFocus(actor);
      case "second-wind":
        return this.actSecondWind(actor);
      case "sandstep":
        return this.actSandstep(actor);
      case "attack":
        return this.actAttack(actor, targetId);
      case "venom":
        return this.actVenom(actor, targetId);
    }
  }

  private selfAction(
    actor: LiveCombatant,
    action: ActionId,
  ): Extract<BattleEvent, { type: "action" }> {
    return {
      type: "action",
      actorId: actor.id,
      targetId: actor.id,
      action,
      damage: 0,
      targetHp: actor.stats.hp,
    };
  }

  private actGuard(actor: LiveCombatant): BattleEvent[] {
    actor.guarding = true;
    actor.gauge = 0;
    return [this.selfAction(actor, "guard")];
  }

  private actFocus(actor: LiveCombatant): BattleEvent[] {
    actor.focused = true;
    actor.gauge = 0;
    return [this.selfAction(actor, "focus")];
  }

  private actSecondWind(actor: LiveCombatant): BattleEvent[] {
    if (actor.secondWindUsed) {
      throw new Error(
        `AtbBattle: "${actor.id}" has already used second-wind this battle`,
      );
    }
    actor.secondWindUsed = true;
    const before = actor.stats.hp;
    actor.stats.hp = Math.min(
      actor.stats.maxHp,
      before + Math.round(actor.stats.maxHp * 0.3),
    );
    actor.gauge = 0;
    return [
      this.selfAction(actor, "second-wind"),
      {
        type: "heal",
        id: actor.id,
        amount: actor.stats.hp - before,
        hp: actor.stats.hp,
      },
    ];
  }

  private actSandstep(actor: LiveCombatant): BattleEvent[] {
    if (actor.sandstepUsed) {
      throw new Error(
        `AtbBattle: "${actor.id}" has already used sandstep this battle`,
      );
    }
    actor.sandstepUsed = true;
    const event = this.selfAction(actor, "sandstep");
    actor.gauge = 0.5; // refills from half instead of empty
    return [event];
  }

  /** Validate and resolve a targeted offensive action's target. */
  private resolveOpposingTarget(
    actor: LiveCombatant,
    targetId: string | undefined,
    action: ActionId,
  ): LiveCombatant {
    if (targetId === undefined) {
      throw new Error(`AtbBattle: ${action} requires a targetId`);
    }
    const target = this.getLive(targetId);
    if (target.stats.hp <= 0) {
      throw new Error(`AtbBattle: target "${targetId}" is already defeated`);
    }
    if (target.side === actor.side) {
      throw new Error(
        `AtbBattle: cannot ${action} "${targetId}" on the same side`,
      );
    }
    return target;
  }

  private actAttack(actor: LiveCombatant, targetId?: string): BattleEvent[] {
    const target = this.resolveOpposingTarget(actor, targetId, "attack");
    targetId = target.id;

    const events: BattleEvent[] = [];
    let damage = Math.max(
      1,
      Math.round(
        (actor.stats.attack * 2 - target.stats.defense) *
          (0.9 + this.rng() * 0.2),
      ),
    );
    if (actor.focused) {
      // Focus multiplies after formula+variance, before guard halving.
      damage = Math.max(1, Math.round(damage * 1.5));
      actor.focused = false;
    }
    const targetWasGuarding = target.guarding;
    if (targetWasGuarding) {
      damage = Math.max(1, Math.floor(damage / 2));
    }

    target.stats.hp = Math.max(0, target.stats.hp - damage);
    actor.gauge = 0;

    events.push({
      type: "action",
      actorId: actor.id,
      targetId,
      action: "attack",
      damage,
      targetHp: target.stats.hp,
    });
    events.push(...this.deathEvents(target));

    // Cactus-guard thorns: prick the attacker after the hit resolves.
    if (targetWasGuarding && target.cactusGuard && this.winnerSide === null) {
      actor.stats.hp = Math.max(0, actor.stats.hp - THORNS_DAMAGE);
      events.push({
        type: "thorns",
        targetId: actor.id,
        damage: THORNS_DAMAGE,
        targetHp: actor.stats.hp,
      });
      events.push(...this.deathEvents(actor));
    }

    return events;
  }

  /**
   * Venom (Slither): a weaker strike that slows the target. Damage is the
   * base attack formula with variance, ×0.75 (round, min 1), with guard
   * halving applied after. The target's CURRENT speed is then multiplied
   * by 0.75, floored at 50% of the speed it entered battle with
   * (baseSpeed). Emits the action event, then the speed debuff, then any
   * defeated/victory events.
   */
  private actVenom(actor: LiveCombatant, targetId?: string): BattleEvent[] {
    const target = this.resolveOpposingTarget(actor, targetId, "venom");

    let damage = Math.max(
      1,
      Math.round(
        (actor.stats.attack * 2 - target.stats.defense) *
          (0.9 + this.rng() * 0.2),
      ),
    );
    damage = Math.max(1, Math.round(damage * 0.75));
    if (target.guarding) {
      damage = Math.max(1, Math.floor(damage / 2));
    }

    target.stats.hp = Math.max(0, target.stats.hp - damage);
    target.stats.speed = Math.max(
      target.baseSpeed * 0.5,
      target.stats.speed * 0.75,
    );
    actor.gauge = 0;

    const events: BattleEvent[] = [
      {
        type: "action",
        actorId: actor.id,
        targetId: target.id,
        action: "venom",
        damage,
        targetHp: target.stats.hp,
      },
      {
        type: "debuff",
        targetId: target.id,
        stat: "speed",
        speed: target.stats.speed,
      },
    ];
    events.push(...this.deathEvents(target));
    return events;
  }

  /** defeated (and victory, if that wiped the side) for a combatant at 0 hp. */
  private deathEvents(c: LiveCombatant): BattleEvent[] {
    if (c.stats.hp > 0) return [];
    const events: BattleEvent[] = [{ type: "defeated", id: c.id }];
    if (this.livingOn(c.side).length === 0) {
      this.winnerSide = c.side === "party" ? "enemy" : "party";
      events.push({ type: "victory", winner: this.winnerSide });
    }
    return events;
  }
}

/** Simple enemy brain: attack a random living member of the opposing side. */
export function chooseEnemyAction(
  battle: AtbBattle,
  actorId: string,
  rng: () => number,
): { action: "attack"; targetId: string } {
  const actor = battle.getCombatant(actorId);
  const targetSide: Side = actor.side === "enemy" ? "party" : "enemy";
  const targets = battle.livingOn(targetSide);
  if (targets.length === 0) {
    throw new Error(
      `chooseEnemyAction: no living targets on side "${targetSide}"`,
    );
  }
  const index = Math.min(
    targets.length - 1,
    Math.floor(rng() * targets.length),
  );
  return { action: "attack", targetId: targets[index].id };
}
