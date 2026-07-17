/**
 * Act 1 run state: zone checkpoint, hero build, hp, perk queue, items and
 * quest flags. Pure functions returning new state objects — no mutation.
 * See docs/CONTRACTS.md section 5.
 */

import {
  baseStatsForLevel,
  grantXp,
  statsForBuild,
  type CommandId,
  type HeroBuild,
  type PerkId,
} from "./progression";
import {
  applyEquipmentBuffs,
  coerceSlots,
  defaultEquipSlots,
  emptyEquipSlots,
  equipmentById,
  itemAllowsTags,
  EQUIPMENT,
  EQUIP_SLOTS,
  type EquipId,
  type EquipSlot,
  type EquipSlots,
} from "./equipment";
import { ROSTER, activeParty, rosterById, type RosterId } from "./roster";
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
    /**
     * SHARED item pool (FF6-style availability): how many of each equippable
     * the player owns TOTAL, keyed by `EquipId`. The bucket is EXCLUDED here —
     * its ownership is its fill-state (`bucket !== "none"` = owns one), kept as
     * the single source of truth so the chore/headgear axes stay orthogonal;
     * `ownedCount("bucket")` derives from the fill-state. Availability for any
     * id is `owned − (copies equipped across every member's slots)`.
     */
    owned: Partial<Record<EquipId, number>>;
    /**
     * PER-CHARACTER worn gear: roster id -> a five-slot record
     * (hat/weapon/torso/legs/shoes). A member absent from the map wears nothing.
     * A benched member keeps their loadout (it still counts against the pool).
     */
    equipped: Partial<Record<RosterId, EquipSlots>>;
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
  /**
   * Optional explicit combat-party selection (ordered roster ids) — the
   * Part-Two swap UI's output. Unset through Part One, where the party is
   * flag-derived (see `roster.ts` `activeParty`). When present it overrides
   * the flag-derived default: `activeParty` filters it to available members
   * and caps it at four.
   */
  selectedParty?: RosterId[];
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
      // Starter gear is Joseph's alone: he owns one each of the outfit pieces
      // and wears them; other members start with nothing. The pool grows as
      // gear is found/bought (stick in the shed, hat/pick at the camp, the
      // frost feather at the crash).
      owned: { tshirt: 1, jeans: 1, flipFlops: 1 },
      equipped: { hero: defaultEquipSlots() },
      silverfin: false,
      stinkySocks: false,
      oranges: false,
      seaweed: false,
    },
    flags,
  };
}

/** Deep-copy a per-character loadout map (each member's slots cloned). */
function cloneEquipped(
  e: Partial<Record<RosterId, EquipSlots>>,
): Partial<Record<RosterId, EquipSlots>> {
  const out: Partial<Record<RosterId, EquipSlots>> = {};
  for (const id of Object.keys(e) as RosterId[]) {
    const slots = e[id];
    if (slots) out[id] = { ...slots };
  }
  return out;
}

function clone(s: Act1State): Act1State {
  return {
    zone: s.zone,
    hero: { xp: s.hero.xp, perks: [...s.hero.perks] },
    hp: s.hp,
    pendingPerks: s.pendingPerks,
    items: {
      ...s.items,
      owned: { ...s.items.owned },
      equipped: cloneEquipped(s.items.equipped),
    },
    flags: { ...s.flags },
    ...(s.selectedParty ? { selectedParty: [...s.selectedParty] } : {}),
  };
}

/**
 * Full build stats — with the HERO's own equipped gear buffs layered on
 * (`items.equipped.hero`) — and hp clamped to the state's current hp. This is
 * the single splice point where the hero's equipment reaches battle: `partyFor`
 * and the status screen both read the hero through here. (Each other member
 * layers their own loadout in `roster.ts`'s `statsFor`.) Equipment only touches
 * combat stats, not maxHp, so the hp/heal accounting on `statsForBuild` stays
 * authoritative — see equipment.ts.
 */
export function heroStats(s: Act1State): Stats {
  const stats = applyEquipmentBuffs(statsForBuild(s.hero), equippedSlotsFor(s, "hero"));
  return { ...stats, hp: Math.min(s.hp, stats.maxHp) };
}

/**
 * A party-side combatant seed plus its command list, for BattleScene. `id` is
 * a roster id (see roster.ts) — the stable key the Phase-2 equipment system
 * will attach per-character loadouts to.
 */
export interface PartyMember {
  id: RosterId;
  name: string;
  stats: Stats;
  commands: CommandId[];
  cactusGuard: boolean;
}

/**
 * The battle party for the current state — now roster-driven. This delegates to
 * `activeParty` (roster.ts), which fills up to four slots from the ROSTER by
 * availability (hero always; Slither on slitherJoined; Fluffball on
 * fluffballJoined; Piggy on piggyCaught) and honours an explicit
 * `state.selectedParty` when the Part-Two swap sets one. Kept as a thin alias
 * so BattleScene and existing call sites are unchanged in shape.
 */
export function partyFor(s: Act1State): PartyMember[] {
  return activeParty(s);
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

/** Spend `n` shinies at once, clamped at zero (never goes negative). Pure. */
export function spendShinies(s: Act1State, n: number): Act1State {
  const next = clone(s);
  next.items.shinies = Math.max(0, s.items.shinies - Math.max(0, n));
  return next;
}

// ---------------------------------------------------------------------------
// Equipment pool + per-character loadout helpers (FF6 availability). Pure.
// ---------------------------------------------------------------------------

/** This member's worn gear (empty slots if they've never been dressed). */
export function equippedSlotsFor(s: Act1State, charId: RosterId): EquipSlots {
  return s.items.equipped[charId] ?? emptyEquipSlots();
}

/**
 * How many of an equippable the player owns TOTAL. The bucket is special-cased
 * to its fill-state (owns one while `bucket !== "none"`); everything else reads
 * the shared `owned` count pool.
 */
export function ownedCount(s: Act1State, id: EquipId): number {
  if (id === "bucket") return s.items.bucket !== "none" ? 1 : 0;
  return s.items.owned[id] ?? 0;
}

/** How many copies of an id are currently worn across ALL members' slots. */
export function equippedCount(s: Act1State, id: EquipId): number {
  let n = 0;
  for (const charId of Object.keys(s.items.equipped) as RosterId[]) {
    const slots = s.items.equipped[charId];
    if (!slots) continue;
    for (const slot of EQUIP_SLOTS) if (slots[slot] === id) n++;
  }
  return n;
}

/** Free-to-equip copies: owned minus copies already worn somewhere. */
export function availableCount(s: Act1State, id: EquipId): number {
  return Math.max(0, ownedCount(s, id) - equippedCount(s, id));
}

/**
 * Whether `charId` may equip `id` right now: the item exists, the character's
 * roster tags satisfy any `allowedTags` restriction, and at least one copy is
 * free in the pool. (A slot is always free to swap — equipping displaces
 * whatever's there back to the pool — so there's no separate slot check.)
 */
export function canEquip(s: Act1State, charId: RosterId, id: EquipId): boolean {
  const item = equipmentById(id);
  if (!item) return false;
  if (!itemAllowsTags(item, rosterById(charId).tags)) return false;
  return availableCount(s, id) >= 1;
}

/**
 * Equip `id` on `charId`, immutably. Consumes one copy from the pool and drops
 * whatever was in that member's target slot back to the pool (availability is
 * implicit — nothing tracks "in the pool" explicitly). No-op (returns the input
 * state) if the item can't be equipped: unknown id, tag-restricted, none
 * available, or already worn in that slot by this member.
 */
export function equipItem(s: Act1State, charId: RosterId, id: EquipId): Act1State {
  const item = equipmentById(id);
  if (!item) return s;
  if (equippedSlotsFor(s, charId)[item.slot] === id) return s; // already worn
  if (!canEquip(s, charId, id)) return s;
  const next = clone(s);
  const slots = { ...(next.items.equipped[charId] ?? emptyEquipSlots()) };
  slots[item.slot] = id;
  next.items.equipped = { ...next.items.equipped, [charId]: slots };
  return next;
}

/**
 * Take whatever `charId` wears in `slot` off, immutably (the copy returns to
 * the pool implicitly). No-op if the slot is already empty.
 */
export function unequipSlot(s: Act1State, charId: RosterId, slot: EquipSlot): Act1State {
  const current = s.items.equipped[charId];
  if (!current || current[slot] === null) return s;
  const next = clone(s);
  const slots = { ...(next.items.equipped[charId] ?? emptyEquipSlots()) };
  slots[slot] = null;
  next.items.equipped = { ...next.items.equipped, [charId]: slots };
  return next;
}

/**
 * Add `n` copies of an equippable to the shared pool (default 1). Pure. Used by
 * found/bought gear (shed stick, camp hat/pick, crash frost feather). NOT for
 * the bucket, whose ownership rides its fill-state.
 */
export function grantEquipment(s: Act1State, id: EquipId, n = 1): Act1State {
  const next = clone(s);
  next.items.owned = { ...next.items.owned, [id]: (next.items.owned[id] ?? 0) + n };
  return next;
}

/**
 * Whether a shop purchase is offerable: the player doesn't already own the
 * item AND holds enough shinies. Shops gate the "Buy" choice on this and, on
 * confirm, `spendShinies` + `grantEquipment`.
 */
export function canBuyEquip(s: Act1State, price: number, id: EquipId): boolean {
  return ownedCount(s, id) === 0 && s.items.shinies >= price;
}

/**
 * Migration/normalizer for the persisted `items` blob — coerces BOTH the old
 * single-loadout model (boolean ownership flags + one `equipped` slot record)
 * and the current per-character pool model into the pool shape, so a save from
 * either era loads without crashing. Pure; consumed by the load path in
 * `src/game/state.ts`.
 */
export function normalizeItemEquipment(raw: unknown): {
  owned: Partial<Record<EquipId, number>>;
  equipped: Partial<Record<RosterId, EquipSlots>>;
} {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { owned: coerceOwned(r), equipped: coercePerChar(r.equipped) };
}

/** Owned-pool half of the migration: new count map, else old boolean flags. */
function coerceOwned(r: Record<string, unknown>): Partial<Record<EquipId, number>> {
  const out: Partial<Record<EquipId, number>> = {};
  const rawOwned = r.owned;
  if (rawOwned && typeof rawOwned === "object") {
    const o = rawOwned as Record<string, unknown>;
    for (const item of EQUIPMENT) {
      if (item.id === "bucket") continue; // bucket ownership = fill-state
      const n = o[item.id];
      if (typeof n === "number" && n > 0) out[item.id] = Math.floor(n);
    }
    return out;
  }
  // Legacy boolean ownership -> one owned copy per truthy flag.
  for (const id of ["tshirt", "jeans", "flipFlops", "stick", "minersHat", "pickaxe"] as const) {
    if (r[id] === true) out[id] = 1;
  }
  return out;
}

/** Loadout half of the migration: old single record -> hero; else per-char. */
function coercePerChar(raw: unknown): Partial<Record<RosterId, EquipSlots>> {
  const out: Partial<Record<RosterId, EquipSlots>> = {};
  if (typeof raw === "string") {
    out.hero = coerceSlots(raw, true); // legacy single-slot string
    return out;
  }
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  // A bare slot record (an equip-slot key at top level) is the old single
  // loadout — Joseph's.
  if (EQUIP_SLOTS.some((slot) => slot in r)) {
    out.hero = coerceSlots(r, true);
    return out;
  }
  // Per-character shape keyed by roster id. Only the hero gets outfit defaults
  // for absent slots; everyone else fills empty.
  for (const entry of ROSTER) {
    if (entry.id in r) out[entry.id] = coerceSlots(r[entry.id], entry.id === "hero");
  }
  return out;
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
