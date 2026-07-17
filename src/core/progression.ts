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

export const MAX_LEVEL = 8;

/** Cumulative XP required to BE level i+1. */
export const LEVEL_THRESHOLDS: readonly number[] = [
  0, 20, 45, 75, 110, 150, 195, 245,
];

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

/** Slither's per-level base stats (party member, Act 2+). */
const SLITHER_L1: Omit<Stats, "hp"> = { maxHp: 22, attack: 6, defense: 2, speed: 14 };

/**
 * Slither's stats at a level: maxHp 22+4·(level−1), attack 6+2·(level−1),
 * defense 2+⌊(level−1)/2⌋, speed 14+(level−1). hp = maxHp (he enters
 * every battle fresh). Throws on levels outside 1..MAX_LEVEL.
 */
export function slitherStatsForLevel(level: number): Stats {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new Error(
      `slitherStatsForLevel: level ${level} out of range (1..${MAX_LEVEL})`,
    );
  }
  const steps = level - 1;
  const maxHp = SLITHER_L1.maxHp + 4 * steps;
  return {
    maxHp,
    hp: maxHp,
    attack: SLITHER_L1.attack + 2 * steps,
    defense: SLITHER_L1.defense + Math.floor(steps / 2),
    speed: SLITHER_L1.speed + steps,
  };
}

/** Fluffball's per-level base stats (party member, Act 5+). A scrappy, fast
 *  striker: lighter than Slither but hits harder and moves quicker. */
const FLUFFBALL_L1: Omit<Stats, "hp"> = { maxHp: 20, attack: 7, defense: 2, speed: 16 };

/**
 * Fluffball's stats at a level: maxHp 20+4·(level−1), attack 7+2·(level−1),
 * defense 2+⌊(level−1)/2⌋, speed 16+2·(level−1) (the fast growth that makes
 * him the party's darting harasser). hp = maxHp (he enters every battle
 * fresh, like Slither). Throws on levels outside 1..MAX_LEVEL.
 */
export function fluffballStatsForLevel(level: number): Stats {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new Error(
      `fluffballStatsForLevel: level ${level} out of range (1..${MAX_LEVEL})`,
    );
  }
  const steps = level - 1;
  const maxHp = FLUFFBALL_L1.maxHp + 4 * steps;
  return {
    maxHp,
    hp: maxHp,
    attack: FLUFFBALL_L1.attack + 2 * steps,
    defense: FLUFFBALL_L1.defense + Math.floor(steps / 2),
    speed: FLUFFBALL_L1.speed + 2 * steps,
  };
}

/** Piggy's per-level base stats (party member, Act 7+). She's a baby: the
 *  smallest, lightest fighter — low hp/defense, modest speed. */
const PIGGY_L1: Omit<Stats, "hp"> = { maxHp: 16, attack: 5, defense: 1, speed: 13 };

/**
 * Piggy's stats at a level: maxHp 16+3·(level−1), attack 5+2·(level−1),
 * defense 1+⌊(level−1)/2⌋, speed 13+(level−1). The slimmest curve of any
 * member — she's a baby penguin — but her attack still climbs so she never
 * becomes dead weight late. hp = maxHp. Throws on levels outside 1..MAX_LEVEL.
 */
export function piggyStatsForLevel(level: number): Stats {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new Error(
      `piggyStatsForLevel: level ${level} out of range (1..${MAX_LEVEL})`,
    );
  }
  const steps = level - 1;
  const maxHp = PIGGY_L1.maxHp + 3 * steps;
  return {
    maxHp,
    hp: maxHp,
    attack: PIGGY_L1.attack + 2 * steps,
    defense: PIGGY_L1.defense + Math.floor(steps / 2),
    speed: PIGGY_L1.speed + steps,
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

export type CommandId =
  | "attack"
  | "guard"
  | "focus"
  | "second-wind"
  | "sandstep"
  | "venom";

/** Battle commands available at a level: attack+guard always; focus at 2+;
 *  second-wind at 4+; sandstep at 5+ (nothing new above 5). */
export function commandsForLevel(level: number): CommandId[] {
  const commands: CommandId[] = ["attack", "guard"];
  if (level >= 2) commands.push("focus");
  if (level >= 4) commands.push("second-wind");
  if (level >= 5) commands.push("sandstep");
  return commands;
}

/** Slither's battle commands (shown by the scene as Bite/Coil/Venom). */
export const SLITHER_COMMANDS: CommandId[] = ["attack", "guard", "venom"];

/** Fluffball's battle commands (shown by the scene as Peck/Fluff Up/Pounce).
 *  A scrappy striker: a basic hit, a guard, and Focus for a big pounce. */
export const FLUFFBALL_COMMANDS: CommandId[] = ["attack", "guard", "focus"];

/** Piggy's battle commands (shown by the scene as Nip/Hide/Nap). She's a baby:
 *  a basic hit, a guard, and second-wind as a little recovery nap. */
export const PIGGY_COMMANDS: CommandId[] = ["attack", "guard", "second-wind"];

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
