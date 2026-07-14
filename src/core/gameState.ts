/**
 * Act 1 run state: zone checkpoint, hero build, hp, perk queue, items and
 * quest flags. Pure functions returning new state objects — no mutation.
 * See docs/CONTRACTS.md section 5.
 */

import {
  baseStatsForLevel,
  grantXp,
  statsForBuild,
  type HeroBuild,
  type PerkId,
} from "./progression";
import type { Stats } from "./atb";

export type ZoneId = "crash" | "oasis" | "trail" | "mine" | "depths";

/** Quest flags used by scenes, all false at newGame(). */
export const ACT1_FLAGS = [
  "metRosa",
  "gotColdPack",
  "metSahra",
  "tutorialBattleWon",
  "chip1",
  "chip2",
  "chip3",
  "rabbitResolved",
  "rabbitTradedColdPack",
  "metDusty",
  "mineOpen",
  "leverPulled",
  "foremanDefeated",
  "queenResolved",
  "parleyed",
  "actComplete",
] as const;

export interface Act1State {
  /** Current zone — also the respawn checkpoint. */
  zone: ZoneId;
  hero: HeroBuild;
  /** Current hp between battles. */
  hp: number;
  /** Level-ups not yet spent on a perk choice. */
  pendingPerks: number;
  items: { coldPack: boolean; shinies: number };
  flags: Record<string, boolean>;
}

export function newGame(): Act1State {
  const flags: Record<string, boolean> = {};
  for (const f of ACT1_FLAGS) flags[f] = false;
  return {
    zone: "crash",
    hero: { xp: 0, perks: [] },
    hp: baseStatsForLevel(1).maxHp,
    pendingPerks: 0,
    items: { coldPack: false, shinies: 0 }, // Rosa grants the cold pack in dialogue
    flags,
  };
}

function clone(s: Act1State): Act1State {
  return {
    zone: s.zone,
    hero: { xp: s.hero.xp, perks: [...s.hero.perks] },
    hp: s.hp,
    pendingPerks: s.pendingPerks,
    items: { ...s.items },
    flags: { ...s.flags },
  };
}

/** Full build stats with hp clamped to the state's current hp. */
export function heroStats(s: Act1State): Stats {
  const stats = statsForBuild(s.hero);
  return { ...stats, hp: Math.min(s.hp, stats.maxHp) };
}

/**
 * Grant XP. A level-up fully heals and queues one perk choice per level
 * gained.
 */
export function awardXp(
  s: Act1State,
  amount: number,
): { state: Act1State; levelsGained: number } {
  const { build, levelsGained } = grantXp(s.hero, amount);
  const next = clone(s);
  next.hero = build;
  if (levelsGained > 0) {
    next.hp = statsForBuild(build).maxHp; // level-ups fully heal
    next.pendingPerks = s.pendingPerks + levelsGained;
  }
  return { state: next, levelsGained };
}

/**
 * Spend one pending perk choice. Current hp rises with any maxHp the perk
 * grants (a freshly-healed hero stays at full). Throws when no perk
 * choice is pending.
 */
export function choosePerk(s: Act1State, perk: PerkId): Act1State {
  if (s.pendingPerks === 0) {
    throw new Error("choosePerk: no pending perk choices");
  }
  const next = clone(s);
  const before = statsForBuild(s.hero).maxHp;
  next.hero.perks.push(perk);
  next.pendingPerks = s.pendingPerks - 1;
  next.hp = s.hp + (statsForBuild(next.hero).maxHp - before);
  return next;
}

/** Record the hero's hp after a battle, clamped to 0..maxHp. */
export function applyBattleResult(s: Act1State, heroHpAfter: number): Act1State {
  const next = clone(s);
  const maxHp = statsForBuild(s.hero).maxHp;
  next.hp = Math.max(0, Math.min(maxHp, heroHpAfter));
  return next;
}

/** Wake at the current zone's checkpoint on full hp; keep everything else. */
export function respawn(s: Act1State): Act1State {
  const next = clone(s);
  next.hp = statsForBuild(s.hero).maxHp;
  return next;
}
