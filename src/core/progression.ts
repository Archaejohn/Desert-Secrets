/**
 * Hero progression: XP thresholds, level stat tables, perks and command
 * unlocks. Engine-agnostic, no Phaser imports.
 * See docs/CONTRACTS.md section 5.
 */

import type { Stats } from "./atb";

export type PerkId = "vigor" | "ferocity" | "bulwark" | "swiftness";

export interface Perk {
  id: PerkId;
  label: string;
  description: string;
}

/** Per-perk stat bonuses. Perks stack: taking vigor twice = +8 maxHp. */
const PERK_BONUSES: Record<PerkId, Partial<Omit<Stats, "hp">>> = {
  vigor: { maxHp: 4 },
  ferocity: { attack: 1 },
  bulwark: { defense: 1 },
  swiftness: { speed: 1 },
};

export const PERKS: readonly Perk[] = [
  { id: "vigor", label: "Vigor", description: "+4 max HP" },
  { id: "ferocity", label: "Ferocity", description: "+1 attack" },
  { id: "bulwark", label: "Bulwark", description: "+1 defense" },
  { id: "swiftness", label: "Swiftness", description: "+1 speed" },
];

export const MAX_LEVEL = 5;

/** Cumulative XP required to BE level i+1. */
export const LEVEL_THRESHOLDS: readonly number[] = [0, 20, 45, 75, 110];

/** Level (1..MAX_LEVEL) for a cumulative XP total. */
export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

/** XP still needed to reach the next level, or null at max level. */
export function xpToNext(xp: number): number | null {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return null;
  return LEVEL_THRESHOLDS[level] - xp;
}

const BASE_L1: Omit<Stats, "hp"> = { maxHp: 32, attack: 9, defense: 3, speed: 12 };
const PER_LEVEL: Omit<Stats, "hp"> = { maxHp: 6, attack: 2, defense: 1, speed: 1 };

/**
 * Base stats at a level (no perks). hp = maxHp.
 * Throws on levels outside 1..MAX_LEVEL.
 */
export function baseStatsForLevel(level: number): Stats {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new Error(
      `baseStatsForLevel: level ${level} out of range (1..${MAX_LEVEL})`,
    );
  }
  const steps = level - 1;
  const maxHp = BASE_L1.maxHp + PER_LEVEL.maxHp * steps;
  return {
    maxHp,
    hp: maxHp,
    attack: BASE_L1.attack + PER_LEVEL.attack * steps,
    defense: BASE_L1.defense + PER_LEVEL.defense * steps,
    speed: BASE_L1.speed + PER_LEVEL.speed * steps,
  };
}

export interface HeroBuild {
  xp: number;
  perks: PerkId[];
}

/**
 * baseStatsForLevel(levelForXp(xp)) plus the sum of all perk bonuses
 * (stacking). hp = maxHp.
 */
export function statsForBuild(build: HeroBuild): Stats {
  const stats = baseStatsForLevel(levelForXp(build.xp));
  for (const perk of build.perks) {
    const bonus = PERK_BONUSES[perk];
    if (!bonus) throw new Error(`statsForBuild: unknown perk "${perk}"`);
    stats.maxHp += bonus.maxHp ?? 0;
    stats.attack += bonus.attack ?? 0;
    stats.defense += bonus.defense ?? 0;
    stats.speed += bonus.speed ?? 0;
  }
  stats.hp = stats.maxHp;
  return stats;
}

export type CommandId = "attack" | "guard" | "focus" | "second-wind" | "sandstep";

/** Battle commands available at a level: attack+guard always; focus at 2+;
 *  second-wind at 4+; sandstep at 5. */
export function commandsForLevel(level: number): CommandId[] {
  const commands: CommandId[] = ["attack", "guard"];
  if (level >= 2) commands.push("focus");
  if (level >= 4) commands.push("second-wind");
  if (level >= 5) commands.push("sandstep");
  return commands;
}

/**
 * Add XP to a build. Pure: returns a new build plus the number of levels
 * gained. Throws on negative amounts.
 */
export function grantXp(
  build: HeroBuild,
  amount: number,
): { build: HeroBuild; levelsGained: number } {
  if (amount < 0) {
    throw new Error(`grantXp: negative amount ${amount}`);
  }
  const before = levelForXp(build.xp);
  const next: HeroBuild = { xp: build.xp + amount, perks: [...build.perks] };
  return { build: next, levelsGained: levelForXp(next.xp) - before };
}
