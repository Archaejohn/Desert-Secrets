/**
 * Active Time Battle core. Engine-agnostic, no Phaser imports.
 * See docs/CONTRACTS.md section 2.
 */

export interface Stats {
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export type Side = "party" | "enemy";

export interface Combatant {
  id: string;
  name: string;
  side: Side;
  stats: Stats;
  gauge: number; // 0..1
  guarding: boolean;
}

export type BattleEvent =
  | { type: "ready"; id: string }
  | {
      type: "action";
      actorId: string;
      targetId: string;
      action: "attack" | "guard";
      damage: number;
      targetHp: number;
    }
  | { type: "defeated"; id: string }
  | { type: "victory"; winner: Side };

export interface AtbOptions {
  rng?: () => number;
  /** Gauge per second at speed 10. Default 0.35. */
  fillRate?: number;
}

const DEFAULT_FILL_RATE = 0.35;

export class AtbBattle {
  private combatants: Combatant[];
  private byId: Map<string, Combatant>;
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
   * Consume the actor's full gauge to attack or guard.
   * attack requires targetId naming a living opponent; guard needs no target.
   */
  act(
    actorId: string,
    action: "attack" | "guard",
    targetId?: string,
  ): BattleEvent[] {
    if (this.winnerSide !== null) {
      throw new Error("AtbBattle: cannot act, the battle is over");
    }
    const actor = this.getCombatant(actorId);
    if (actor.stats.hp <= 0) {
      throw new Error(`AtbBattle: actor "${actorId}" is dead and cannot act`);
    }
    if (actor.gauge < 1) {
      throw new Error(`AtbBattle: actor "${actorId}" is not ready`);
    }

    // Acting starts fresh: any previous guard on the actor ends now.
    actor.guarding = false;
    const events: BattleEvent[] = [];

    if (action === "guard") {
      actor.guarding = true;
      actor.gauge = 0;
      events.push({
        type: "action",
        actorId,
        targetId: actorId,
        action: "guard",
        damage: 0,
        targetHp: actor.stats.hp,
      });
      return events;
    }

    // attack
    if (targetId === undefined) {
      throw new Error("AtbBattle: attack requires a targetId");
    }
    const target = this.getCombatant(targetId);
    if (target.stats.hp <= 0) {
      throw new Error(
        `AtbBattle: target "${targetId}" is already defeated`,
      );
    }
    if (target.side === actor.side) {
      throw new Error(
        `AtbBattle: cannot attack "${targetId}" on the same side`,
      );
    }

    let damage = Math.max(
      1,
      Math.round(
        (actor.stats.attack * 2 - target.stats.defense) *
          (0.9 + this.rng() * 0.2),
      ),
    );
    if (target.guarding) {
      damage = Math.max(1, Math.floor(damage / 2));
    }

    target.stats.hp = Math.max(0, target.stats.hp - damage);
    actor.gauge = 0;

    events.push({
      type: "action",
      actorId,
      targetId,
      action: "attack",
      damage,
      targetHp: target.stats.hp,
    });

    if (target.stats.hp === 0) {
      events.push({ type: "defeated", id: target.id });
      if (this.livingOn(target.side).length === 0) {
        this.winnerSide = actor.side;
        events.push({ type: "victory", winner: actor.side });
      }
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
