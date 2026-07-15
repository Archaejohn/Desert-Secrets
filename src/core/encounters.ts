/**
 * Random-encounter tables and the moving-time encounter clock.
 * Engine-agnostic. See docs/CONTRACTS.md section 5.
 */

export interface EncounterTable {
  zone: string;
  groups: string[][];
  weights: number[]; // parallel to groups
}

export const ENCOUNTERS: Record<
  | "trail"
  | "mine"
  | "maze"
  | "galleries"
  | "overworld"
  | "sunlessSea"
  | "minersCamp"
  | "grove"
  | "reef",
  EncounterTable
> = {
  overworld: {
    zone: "overworld",
    groups: [
      ["scarab"],
      ["jackrabbit"],
      ["buzzard"],
      ["scarab", "scarab"],
      ["gila"],
    ],
    weights: [3, 3, 2, 2, 1],
  },
  trail: {
    zone: "trail",
    groups: [
      ["scarab"],
      ["buzzard"],
      ["scarab", "scarab"],
      ["gila"],
      ["buzzard", "scarab"],
    ],
    weights: [3, 3, 2, 2, 1],
  },
  mine: {
    zone: "mine",
    groups: [["scarab"], ["scarab", "scarab"], ["gila"], ["scarab", "gila"]],
    weights: [3, 3, 2, 1],
  },
  maze: {
    zone: "maze",
    groups: [
      ["frostscarab"],
      ["icebat"],
      ["frostscarab", "frostscarab"],
      ["icebat", "frostscarab"],
    ],
    weights: [3, 3, 2, 2],
  },
  galleries: {
    zone: "galleries",
    groups: [
      ["icebat"],
      ["crystalcrawler"],
      ["icebat", "icebat"],
      ["crystalcrawler", "icebat"],
    ],
    weights: [3, 2, 2, 1],
  },
  sunlessSea: {
    zone: "sunlessSea",
    groups: [
      ["anglerfish"],
      ["reefeel"],
      ["anglerfish", "anglerfish"],
      ["reefeel", "anglerfish"],
    ],
    weights: [3, 3, 2, 2],
  },
  minersCamp: {
    zone: "minersCamp",
    groups: [
      ["middenmite", "middenmite", "middenmite"],
      ["frostscarab"],
      ["middenmite", "middenmite"],
      ["frostscarab", "middenmite"],
    ],
    weights: [3, 3, 2, 2],
  },
  // Act 5 — Sahra's grove. Sunwasps swarm to guard the fruit; larger swarms
  // are rarer. The tonal-breather register: a fast, low-stakes nuisance.
  grove: {
    zone: "grove",
    groups: [
      ["sunwasp"],
      ["sunwasp", "sunwasp"],
      ["sunwasp", "sunwasp"],
      ["sunwasp", "sunwasp", "sunwasp"],
    ],
    weights: [3, 3, 2, 1],
  },
  // Act 6 — The Reef. The crawlers are peaceful; the reef's real danger is the
  // ambush-predator reefstalker, usually alone, sometimes in a hunting pair.
  reef: {
    zone: "reef",
    groups: [
      ["reefstalker"],
      ["reefstalker"],
      ["reefstalker", "reefstalker"],
      ["reefstalker", "reefstalker"],
    ],
    weights: [3, 3, 2, 1],
  },
};

/**
 * Enemy ids that shy away from the reek of stinky socks. While the party
 * carries the socks (Act 4's "reeks" mechanic), any group containing one of
 * these is far less likely to appear — its weight drops to 1. Midden mites
 * are drawn TO the reek, not repelled, so they are deliberately absent here.
 */
export const REEK_AVERSE: ReadonlySet<string> = new Set(["frostscarab"]);

/**
 * Return a copy of `table` reweighted for a party that reeks of stinky
 * socks: every group holding a REEK_AVERSE enemy has its weight cut to 1
 * (reek-loving groups keep their weight). Pure; the original table is
 * untouched. A scene passes this to the EncounterClock while the socks are
 * held so the frost scarabs give the stinking party a wide berth.
 */
export function reekAdjusted(table: EncounterTable): EncounterTable {
  const weights = table.groups.map((group, i) =>
    group.some((id) => REEK_AVERSE.has(id)) ? 1 : table.weights[i],
  );
  return { zone: table.zone, groups: table.groups, weights };
}

export interface EncounterClockOptions {
  /** Seconds of moving time between encounter checks. Default 1. */
  checkInterval?: number;
  /** Probability of an encounter per check. Default 0.09. */
  chance?: number;
  /** Encounter-free moving seconds after construction, each trigger, and reset(). Default 5. */
  graceSeconds?: number;
}

/**
 * Feed it seconds of ACTIVE MOVEMENT; roughly every 1/chance checks it
 * returns an encounter group drawn from the table's weights. Fractional
 * time accumulates correctly across calls. A grace period applies after
 * construction, after each trigger, and after reset().
 */
export class EncounterClock {
  private rng: () => number;
  private checkInterval: number;
  private chance: number;
  private graceSeconds: number;
  private graceLeft: number;
  private accumulated = 0;

  constructor(rng: () => number, opts?: EncounterClockOptions) {
    this.rng = rng;
    this.checkInterval = opts?.checkInterval ?? 1;
    this.chance = opts?.chance ?? 0.09;
    this.graceSeconds = opts?.graceSeconds ?? 5;
    this.graceLeft = this.graceSeconds;
  }

  /**
   * Advance by movingDt seconds of movement. Returns a weighted-random
   * group (string[]) when an encounter triggers, else null.
   */
  advance(movingDt: number, table: EncounterTable): string[] | null {
    let dt = movingDt;
    if (this.graceLeft > 0) {
      const used = Math.min(this.graceLeft, dt);
      this.graceLeft -= used;
      dt -= used;
    }
    if (dt <= 0) return null;

    this.accumulated += dt;
    while (this.accumulated >= this.checkInterval) {
      this.accumulated -= this.checkInterval;
      if (this.rng() < this.chance) {
        // Trigger: drop leftover time and start a fresh grace period.
        this.accumulated = 0;
        this.graceLeft = this.graceSeconds;
        return this.pickGroup(table);
      }
    }
    return null;
  }

  /** Clear accumulated time and re-arm the grace period. */
  reset(): void {
    this.accumulated = 0;
    this.graceLeft = this.graceSeconds;
  }

  private pickGroup(table: EncounterTable): string[] {
    if (
      table.groups.length === 0 ||
      table.groups.length !== table.weights.length
    ) {
      throw new Error(
        `EncounterClock: malformed table for zone "${table.zone}"`,
      );
    }
    const total = table.weights.reduce((a, b) => a + b, 0);
    let roll = this.rng() * total;
    for (let i = 0; i < table.groups.length; i++) {
      roll -= table.weights[i];
      if (roll < 0) return [...table.groups[i]];
    }
    return [...table.groups[table.groups.length - 1]];
  }
}
