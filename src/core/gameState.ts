/**
 * Act 1 run state: zone checkpoint, hero build, hp, perk queue, items and
 * quest flags. Pure functions returning new state objects — no mutation.
 * See docs/CONTRACTS.md section 5.
 */

import {
  SLITHER_COMMANDS,
  baseStatsForLevel,
  commandsForLevel,
  grantXp,
  levelForXp,
  slitherStatsForLevel,
  statsForBuild,
  type CommandId,
  type HeroBuild,
  type PerkId,
} from "./progression";
import type { Stats } from "./atb";

export type ZoneId =
  | "crash"
  | "oasis"
  | "trail"
  | "mine"
  | "depths"
  | "crevasse"
  | "maze"
  | "galleries"
  | "sanctum"
  | "shed"
  | "overworld"
  | "mineEntrance"
  | "sunlessSea"
  | "kelpForest"
  | "sunTemple"
  | "fluffballBed"
  | "deepBed"
  | "seaAscent"
  | "minersCamp"
  | "campProper"
  | "laundryNook"
  | "campGallery"
  | "campLedge"
  | "groveDescent"
  | "groveApproach"
  | "groveGrotto"
  | "groveChamber"
  | "sahraGrove"
  | "reefDescent"
  | "reefGarden"
  | "reefWarren"
  | "reefHollow"
  | "reefCourt"
  | "pizzaDescent"
  | "pizzaVent"
  | "pizzaApproach"
  | "pizzeria"
  | "pizzaAscent";

/** The chicken-chore fetch quest: none held -> empty (from the shed) -> filled (at the spring). */
export type BucketState = "none" | "empty" | "filled";

/** Quest flags used by scenes, all false at newGame(). */
export const ACT1_FLAGS = [
  "metRosa",
  "gotColdPack",
  "metParents",
  "choresDone",
  "pamelaShiny",
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

/** Act 2 quest flags, also all false at newGame(). */
export const ACT2_FLAGS = [
  "act2Started",
  "minerMo",
  "minerEdda",
  "minerGus",
  "minersBonusGiven",
  "metSlither",
  "mazeShortcutOpen",
  "rimeDoorOpen",
  "slitherJoined",
  "wardenDefeated",
  "act2Complete",
  "shard1",
  "shard2",
] as const;

/** Act 3 quest flags (The Sunless Sea, now a six-zone chain), all false at newGame(). */
export const ACT3_FLAGS = [
  "act3Started",
  "sawChase",
  "sawKelpForest",
  "sawTempleEntry",
  "sawTemple",
  "sawFluffbed",
  "metFluffball",
  "sawDeepBed",
  "lurkerDefeated",
  "silverfinCaught",
  "sawAscent",
  "act3Complete",
] as const;

/**
 * Act 4 quest flags (Dirty Laundry — the Miners' Camp, now a five-zone
 * chain), all false at newGame(). The `saw*` flags are per-zone entry beats
 * (mirrors Act 3's retrofit); `sawCrateChase`, `fluffballLedge`,
 * `middenCleared` and `gotSocks` are the story beats they gate.
 */
export const ACT4_FLAGS = [
  "act4Started",
  "sawOutskirts",
  "sawCamp",
  "sawCrateChase",
  "sawNook",
  "middenCleared",
  "sawGallery",
  "sawLedge",
  "fluffballLedge",
  "gotSocks",
  "act4Complete",
] as const;

/**
 * Act 5 quest flags (The Sunlit Cave-In — Sahra's underground orange grove,
 * a five-zone chain), all false at newGame(). The `saw*` flags are per-zone
 * entry beats (mirrors Act 3/4's retrofits); `sawGroveChase` (the scared
 * near-catch), `fluffballJoined` (Fluffball joins for real) and `gotOranges`
 * (Sahra's reactive trade) are the story beats they gate.
 */
export const ACT5_FLAGS = [
  "act5Started",
  "sawGroveDescent",
  "sawGroveApproach",
  "sawGroveGrotto",
  "sawGroveChase",
  "sawGroveChamber",
  "fluffballJoined",
  "sawSahraGrove",
  "gotOranges",
  "act5Complete",
] as const;

/**
 * Act 6 quest flags (The Reef — the crystal-crawlers' farmed-kelp home, a
 * five-zone chain), all false at newGame(). The `saw*` flags are per-zone
 * entry beats (mirrors Acts 3–5); `sawReefChase` (the tense near-catch where
 * the chase stops being cute and Fluffball, not Joseph, calls after Piggy),
 * `reefFought` (the AVOIDABLE fallback fight, set when a bad approach to the
 * crawler court turns into a battle) and `gotSeaweed` (the mint-kelp trade,
 * peaceful OR post-fight) are the story beats they gate.
 */
export const ACT6_FLAGS = [
  "act6Started",
  "sawReefDescent",
  "sawReefGarden",
  "sawReefWarren",
  "sawReefChase",
  "sawReefHollow",
  "sawReefCourt",
  "reefFought",
  "gotSeaweed",
  "act6Complete",
] as const;

/**
 * Act 7 quest flags (La Pizzeria Sotterranea — the finale, and the close of
 * Part One), all false at newGame(). The `saw*` flags are per-zone entry beats
 * (mirrors Acts 3–6). The story beats they gate: `metTestudo` (meeting the
 * ancient chef), `pizzaBaked` (the cooking minigame lands the pizza),
 * `piggyCaught` (the warm reunion — Piggy drawn in by smell, gently caught
 * mid-bite; NOT a chase), `heardReveal` (Testudo tells the glacier/old-ocean
 * secret — the ONE mystery that resolves here). `act7Complete` /
 * `partOneComplete` close out Part One on the deliberate END-OF-PART-ONE
 * cliffhanger (the floor gives way mid-step on the walk out).
 */
export const ACT7_FLAGS = [
  "act7Started",
  "sawPizzaDescent",
  "sawPizzaVent",
  "sawPizzaApproach",
  "metTestudo",
  "pizzaBaked",
  "piggyCaught",
  "heardReveal",
  "sawPizzaAscent",
  "act7Complete",
  "partOneComplete",
] as const;

/**
 * Part Two seeds, sprinkled through Part One: the Thomas radio thread and the
 * hand-off into Part Two. Thomas — the friend Joseph keeps just missing —
 * carries the twin of John's hand radio; his voice breaks in one-way at key
 * beats, garbled at first and clearing as Joseph closes the distance (see
 * `scripts/thomas.ts`). `heardThomasMine` is first contact (the mine's foreman
 * room); `thomasFrag1..3` are the sporadic later catches (Act 3 ascent, Act 5
 * descent, the final climb up); `partTwoStarted` records the crossing into the
 * Part Two opening — a persisted breadcrumb, not read yet (Part Two, once
 * built, will consume it). All false at newGame().
 */
export const PART2_FLAGS = [
  "heardThomasMine",
  "thomasFrag1",
  "thomasFrag2",
  "thomasFrag3",
  "partTwoStarted",
] as const;

export interface Act1State {
  /** Current zone — also the respawn checkpoint. */
  zone: ZoneId;
  hero: HeroBuild;
  /** Current hp between battles. */
  hp: number;
  /** Level-ups not yet spent on a perk choice. */
  pendingPerks: number;
  items: {
    coldPack: boolean;
    shinies: number;
    bucket: BucketState;
    equipped: "bucket" | null;
    /** Act 3: the silverfin caught in the Sunless Sea (Piggy's favorite). */
    silverfin: boolean;
    /** Act 4: the miners' ripest stinky socks (Piggy's favorite; "reeks"). */
    stinkySocks: boolean;
    /** Act 5: oranges from the oldest row of Sahra's grove (Piggy's favorite). */
    oranges: boolean;
    /** Act 6: the crawlers' cultivated mint kelp — the pizza's seaweed (Piggy's favorite). */
    seaweed: boolean;
  };
  flags: Record<string, boolean>;
}

export function newGame(): Act1State {
  const flags: Record<string, boolean> = {};
  for (const f of ACT1_FLAGS) flags[f] = false;
  for (const f of ACT2_FLAGS) flags[f] = false;
  for (const f of ACT3_FLAGS) flags[f] = false;
  for (const f of ACT4_FLAGS) flags[f] = false;
  for (const f of ACT5_FLAGS) flags[f] = false;
  for (const f of ACT6_FLAGS) flags[f] = false;
  for (const f of ACT7_FLAGS) flags[f] = false;
  for (const f of PART2_FLAGS) flags[f] = false;
  return {
    zone: "crash",
    hero: { xp: 0, perks: [] },
    hp: baseStatsForLevel(1).maxHp,
    pendingPerks: 0,
    // Rosa grants the cold pack in dialogue; silverfin caught in Act 3;
    // stinky socks earned in Act 4; grove oranges traded from Sahra in Act 5;
    // the crawlers' mint kelp (seaweed) traded in Act 6.
    items: {
      coldPack: false,
      shinies: 0,
      bucket: "none",
      equipped: null,
      silverfin: false,
      stinkySocks: false,
      oranges: false,
      seaweed: false,
    },
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

/** A party-side combatant seed plus its command list, for BattleScene. */
export interface PartyMember {
  id: "hero" | "slither";
  name: string;
  stats: Stats;
  commands: CommandId[];
  cactusGuard: boolean;
}

/**
 * The battle party for the current state. The hero always leads (stats
 * clamped to current hp, commands by level, cactusGuard from level 3).
 * Slither joins once flags.slitherJoined: level-matched stats at full hp
 * every battle, Bite/Coil/Venom, no cactus guard.
 */
export function partyFor(s: Act1State): PartyMember[] {
  const level = levelForXp(s.hero.xp);
  const party: PartyMember[] = [
    {
      id: "hero",
      name: "Joseph",
      stats: heroStats(s),
      commands: commandsForLevel(level),
      cactusGuard: level >= 3,
    },
  ];
  if (s.flags.slitherJoined) {
    party.push({
      id: "slither",
      name: "Slither",
      stats: slitherStatsForLevel(level),
      commands: [...SLITHER_COMMANDS],
      cactusGuard: false,
    });
  }
  return party;
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

/**
 * Grant one shiny (the tradeable trinket). Pure. Pamela hands Joseph his
 * first; battle drops add more; Dusty spends them. See spendShiny.
 */
export function grantShiny(s: Act1State): Act1State {
  const next = clone(s);
  next.items.shinies = s.items.shinies + 1;
  return next;
}

/**
 * Spend one shiny, clamped at zero (never goes negative). Pure. Dusty's
 * "Pay a shiny" branch calls this; callers gate the branch on shinies > 0.
 */
export function spendShiny(s: Act1State): Act1State {
  const next = clone(s);
  next.items.shinies = Math.max(0, s.items.shinies - 1);
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
