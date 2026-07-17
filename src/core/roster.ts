/**
 * The playable-character ROSTER and the derived combat party. Engine-agnostic,
 * pure — no Phaser imports. See docs/CONTRACTS.md section 5.
 *
 * This is the single source of truth for "who can fight". Every playable
 * character — Joseph (`hero`), Slither, Fluffball, Piggy — is ONE `RosterEntry`
 * here, carrying its display name, battle sprite, level-driven stat function,
 * battle commands, an availability predicate (the flag that unlocks it), and
 * equip-eligibility `tags` for the Phase-2 gear system. Adding a new member
 * (e.g. Thomas in Part Two) is a single appended entry — nothing else in the
 * codebase enumerates the members. (One caveat: growing the party BEYOND four
 * also needs `MAX_PARTY` raised and a matching `PARTY_COLS` layout row added in
 * `BattleScene`; a 5th roster entry alone would clamp into the 4-slot layout.)
 *
 * `activeParty(state)` derives the current combat party (capped at
 * `MAX_PARTY` = 4) from the roster. TODAY it returns everyone whose
 * availability predicate passes, in roster order. The Part-Two swap UI will set
 * `state.selectedParty` (an explicit ordered id list); `activeParty` already
 * honours it when present — filtering it down to members that are actually
 * available and capping at four — and falls back to "everyone available" when
 * it is absent. So the swap feature is a UI that writes `selectedParty`, not a
 * rewrite of party derivation.
 */

import type { Stats } from "./atb";
import {
  FLUFFBALL_COMMANDS,
  PIGGY_COMMANDS,
  SLITHER_COMMANDS,
  commandsForLevel,
  fluffballStatsForLevel,
  levelForXp,
  piggyStatsForLevel,
  slitherStatsForLevel,
  type CommandId,
} from "./progression";
// heroStats is a hoisted function export; the roster/gameState import cycle is
// type-only + lazy (predicates and stat fns are only CALLED at battle time, never
// at module load), so it resolves cleanly.
import {
  equippedSlotsFor,
  heroStats,
  type Act1State,
  type PartyMember,
} from "./gameState";
import { applyEquipmentBuffs } from "./equipment";

/** Stable ids for every playable character. Extend by appending. */
export type RosterId = "hero" | "slither" | "fluffball" | "piggy";

/**
 * Trait tags used for later equip-eligibility (Phase 2 gear keys off THESE,
 * never the id — a "penguin sweater" can list `penguin` and fit both Fluffball
 * and Piggy without naming either). Extend by appending.
 */
export type CharacterTag = "human" | "reptile" | "penguin";

/** The largest combat party the battle system lays out. */
export const MAX_PARTY = 4;

export interface RosterEntry {
  id: RosterId;
  /** In-battle display name. */
  name: string;
  /** Battle sprite sheet key. */
  sprite: string;
  /** The sheet frame to construct the sprite on (its idle base frame). */
  baseFrame: number;
  /** Level/build-derived combat stats for this member, given run state. */
  statsFor: (state: Act1State) => Stats;
  /** Battle command ids for this member (a fresh array per call). */
  commandsFor: (state: Act1State) => CommandId[];
  /** Whether this member is currently unlocked for the party. */
  available: (state: Act1State) => boolean;
  /** Equip-eligibility / trait tags. */
  tags: readonly CharacterTag[];
  /** Passive cactus-guard, state-derived (hero gains it at level 3). */
  cactusGuard: (state: Act1State) => boolean;
}

/**
 * The playable roster, in default party order. Order matters: `activeParty`
 * fills its (up-to-four) slots in this order when no explicit `selectedParty`
 * is set, so the hero always leads. Nothing keys off array INDEX — lookups go
 * through `rosterById` — so this stays safe to reorder or extend.
 */
export const ROSTER: readonly RosterEntry[] = [
  {
    id: "hero",
    name: "Joseph",
    sprite: "hero",
    baseFrame: 0,
    statsFor: (s) => heroStats(s),
    commandsFor: (s) => commandsForLevel(levelForXp(s.hero.xp)),
    available: () => true,
    tags: ["human"],
    cactusGuard: (s) => levelForXp(s.hero.xp) >= 3,
  },
  {
    id: "slither",
    name: "Slither",
    sprite: "slither",
    baseFrame: 0,
    statsFor: (s) =>
      applyEquipmentBuffs(slitherStatsForLevel(levelForXp(s.hero.xp)), equippedSlotsFor(s, "slither")),
    commandsFor: () => [...SLITHER_COMMANDS],
    available: (s) => !!s.flags.slitherJoined,
    tags: ["reptile"],
    cactusGuard: () => false,
  },
  {
    id: "fluffball",
    name: "Fluffball",
    sprite: "fluffball",
    baseFrame: 0,
    statsFor: (s) =>
      applyEquipmentBuffs(fluffballStatsForLevel(levelForXp(s.hero.xp)), equippedSlotsFor(s, "fluffball")),
    commandsFor: () => [...FLUFFBALL_COMMANDS],
    available: (s) => !!s.flags.fluffballJoined,
    tags: ["penguin"],
    cactusGuard: () => false,
  },
  {
    id: "piggy",
    name: "Piggy",
    sprite: "piggy",
    baseFrame: 0,
    statsFor: (s) =>
      applyEquipmentBuffs(piggyStatsForLevel(levelForXp(s.hero.xp)), equippedSlotsFor(s, "piggy")),
    commandsFor: () => [...PIGGY_COMMANDS],
    available: (s) => !!s.flags.piggyCaught,
    tags: ["penguin"],
    cactusGuard: () => false,
  },
];

/** Look up a roster entry by id (throws on an unknown id). */
export function rosterById(id: RosterId): RosterEntry {
  const entry = ROSTER.find((e) => e.id === id);
  if (!entry) throw new Error(`rosterById: unknown roster id "${id}"`);
  return entry;
}

/** Build the `PartyMember` seed for one roster entry against the run state. */
function memberFor(entry: RosterEntry, state: Act1State): PartyMember {
  return {
    id: entry.id,
    name: entry.name,
    stats: entry.statsFor(state),
    commands: entry.commandsFor(state),
    cactusGuard: entry.cactusGuard(state),
  };
}

/**
 * The ordered ids of every currently-available member, in roster order.
 * (Availability is the flag each entry declares — hero always, Slither on
 * `slitherJoined`, Fluffball on `fluffballJoined`, Piggy on `piggyCaught`.)
 */
export function availablePartyIds(state: Act1State): RosterId[] {
  return ROSTER.filter((e) => e.available(state)).map((e) => e.id);
}

/**
 * The current combat party (max `MAX_PARTY`), derived from the roster.
 *
 * If `state.selectedParty` is set (the Part-Two swap UI's explicit choice),
 * it wins: the party is that ordered list, filtered to members that are
 * actually available (a stale/locked pick is dropped, never a crash) and
 * capped at four. Otherwise the party is every available member in roster
 * order, capped at four. Either way the hero, being always-available and first
 * in the roster, leads any default party.
 */
export function activeParty(state: Act1State): PartyMember[] {
  const available = new Set(availablePartyIds(state));
  const selected = state.selectedParty;
  const ids = (selected ?? ROSTER.map((e) => e.id)).filter((id) =>
    available.has(id),
  );
  return ids.slice(0, MAX_PARTY).map((id) => memberFor(rosterById(id), state));
}
