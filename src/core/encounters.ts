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
  "trail" | "mine" | "maze" | "galleries",
  EncounterTable
> = {
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
};

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
