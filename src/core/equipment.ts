/**
 * Equipment catalog and stat-buff application. Engine-agnostic, pure — no
 * Phaser imports. See docs/CONTRACTS.md section 5 / v35.
 *
 * Gear is worn PER CHARACTER: `Act1State.items.equipped` is a partial map of
 * roster id -> a FIVE-SLOT record (`EquipSlots`: hat · weapon · torso · legs ·
 * shoes), each slot holding a stable `EquipId` (or null). Each equippable
 * declares which `slot` it fills. Every worn slot's stat-delta profile
 * (`buffs`) is SUMMED and layered onto THAT member's base stats by
 * `applyEquipmentBuffs` — the hero through `heroStats()`, everyone else through
 * their roster `statsFor` — so battle, the Party status tab, and the Equipment
 * tab all read one consistent buffed block per member. Ownership is a SHARED
 * item pool (`items.owned`: EquipId -> count, FF6-style): `availableCount` =
 * owned − (copies equipped across ALL members), so one bought pickaxe can only
 * be worn by one member at a time. Joseph starts dressed: a t-shirt, jeans, and
 * flip-flops (owned x1 each, worn in his torso/legs/shoes); his hat and weapon
 * start empty; other members start with no gear. The pool math + restriction
 * checks (`equipItem`/`unequipSlot`/`canEquip`/`availableCount`) live in
 * gameState.ts, which has the roster tags they enforce against.
 *
 * BUCKET-AS-TOOL vs BUCKET-AS-ARMOR (the reconciliation). The bucket is BOTH
 * the chicken-chore fetch item (`items.bucket`: none/empty/filled) AND wearable
 * headgear (a hat-slot item). It also DOESN'T live in the `owned` count pool:
 * its ownership IS the fill-state (`bucket !== "none"` = owns one), the single
 * source of truth `ownedCount("bucket")` derives from. The two axes stay
 * ORTHOGONAL: the hero's hat slot (`items.equipped.hero.hat`) is independent of
 * the fill-state. Equipping grants the +2 DEF / -1 SPD buff regardless of
 * whether the pail is empty or full; the chore reads the fill-state and works
 * fine while the bucket is worn (filling at the spigot / delivering at the coop
 * both require it worn in the hero's hat slot today). The bucket is NEVER
 * destroyed by the chore — delivery just empties the pail (filled -> empty) and
 * Joseph keeps wearing it, so the headgear buff persists after the chore.
 *
 * Buffs deliberately cover only the combat stats (attack/defense/speed), NOT
 * maxHp: the hp pool and its heal accounting live on the build
 * (`statsForBuild`), and threading an equip-driven maxHp delta through every
 * heal path (awardXp/choosePerk/respawn) would be a separate change. Keeping
 * equipment out of maxHp means `heroStats` is the single, safe splice point.
 */

import type { Stats } from "./atb";
// Type-only import (erased at compile time — no runtime cycle with roster.ts,
// which imports gameState which imports this module). Equip restrictions key
// off a character's roster `tags`; see `itemAllowsTags`.
import type { CharacterTag } from "./roster";

/** Stable ids for equippable gear. Equipment logic keys off THIS, never the
 *  display name — the display name is presentation and may change freely. */
export type EquipId =
  | "bucket"
  | "stick"
  | "minersHat"
  | "pickaxe"
  | "tshirt"
  | "jeans"
  | "flipFlops"
  | "frostFeather";

/** The wearable slots. One item per slot; a slot may be empty (null). */
export type EquipSlot = "hat" | "weapon" | "torso" | "legs" | "shoes";

/** Slot iteration order — used by previews, buff-summing and the menu. */
export const EQUIP_SLOTS = ["hat", "weapon", "torso", "legs", "shoes"] as const;

/** The worn-gear record: one `EquipId` (or null) per slot. */
export type EquipSlots = Record<EquipSlot, EquipId | null>;

/** Per-item stat deltas layered onto the base build. May be negative. */
export type StatBuffs = Partial<Pick<Stats, "attack" | "defense" | "speed">>;

export interface Equipment {
  id: EquipId;
  /** Which slot this item fills. */
  slot: EquipSlot;
  /** In-menu display name. */
  name: string;
  /** One-line flavor for the detail panel. */
  description: string;
  buffs: StatBuffs;
  /**
   * Optional equip restriction. When set, a character may wear this item only
   * if its roster `tags` intersect `allowedTags`. Absent/empty = anyone can
   * wear it. Keyed off tags (never a character id) so a "penguin sweater" fits
   * every penguin without naming one. See `itemAllowsTags`.
   */
  allowedTags?: readonly CharacterTag[];
}

/** The lowest value a debuff can drag a combat stat down to. */
export const STAT_FLOOR = 1;

/** The three combat stats equipment can move (iteration order for previews). */
export const BUFF_STATS = ["attack", "defense", "speed"] as const;

/**
 * The equippable catalog. Nothing keys off array order; extend by appending
 * entries (add the id to `EquipId` too, and give it a `slot`).
 *  - bucket    (hat)    : +2 DEF / -1 SPD — the chore pail worn as a helmet.
 *  - minersHat (hat)    : +1 DEF — a lamp-helmet (bought from Mo).
 *  - stick     (weapon) : +1 ATK — a plain branch (found in the shed).
 *  - pickaxe   (weapon) : +2 ATK — heavier than the stick (bought from Gus).
 *  - tshirt/jeans/flipFlops : Joseph's default outfit; plain clothes, no buffs.
 */
export const EQUIPMENT: readonly Equipment[] = [
  {
    id: "bucket",
    slot: "hat",
    name: "Bucket",
    description: "A tin pail worn upended as a helmet — clumsy, but it turns a blow.",
    buffs: { defense: 2, speed: -1 },
  },
  {
    id: "minersHat",
    slot: "hat",
    name: "Miner's Hat",
    description: "A dented lamp-helmet. The little lamp still glows.",
    buffs: { defense: 1 },
  },
  {
    id: "stick",
    slot: "weapon",
    name: "Stick",
    description: "A stout desert branch. Not much, but it swings true.",
    buffs: { attack: 1 },
  },
  {
    id: "pickaxe",
    slot: "weapon",
    name: "Pickaxe",
    description: "A miner's pick — heavy in the hand, heavier on a scarab.",
    buffs: { attack: 2 },
  },
  {
    id: "tshirt",
    slot: "torso",
    name: "T-Shirt",
    description: "A comfy cotton tee. What Joseph set out in.",
    buffs: {},
  },
  {
    id: "jeans",
    slot: "legs",
    name: "Jeans",
    description: "Well-worn denim, dusty at the knees.",
    buffs: {},
  },
  {
    id: "flipFlops",
    slot: "shoes",
    name: "Flip-Flops",
    description: "Barely shoes, but they're his.",
    buffs: {},
  },
  {
    id: "frostFeather",
    slot: "weapon",
    name: "Frost Feather",
    description: "A single ice-blue plume, cold to the touch. It answers to a penguin's grip.",
    buffs: { attack: 1, speed: 1 },
    // Penguin-only: Joseph carries it out of the crash, but only Fluffball or
    // Piggy can actually wield it (both tagged "penguin" in the roster).
    allowedTags: ["penguin"],
  },
];

/** Look up an equippable by id (null id / unknown id -> null). */
export function equipmentById(id: EquipId | null | undefined): Equipment | null {
  if (!id) return null;
  return EQUIPMENT.find((e) => e.id === id) ?? null;
}

/** True when an item carries no stat deltas (plain clothes). */
export function hasNoBuffs(item: Equipment): boolean {
  return BUFF_STATS.every((k) => item.buffs[k] === undefined);
}

/** An all-empty five-slot record (nothing worn) — the seed for any member who
 *  has never been dressed. Distinct from `defaultEquipSlots`, which is Joseph's
 *  starter outfit. */
export function emptyEquipSlots(): EquipSlots {
  return { hat: null, weapon: null, torso: null, legs: null, shoes: null };
}

/** Joseph's default worn outfit at newGame: dressed, hat & weapon empty. */
export function defaultEquipSlots(): EquipSlots {
  return { hat: null, weapon: null, torso: "tshirt", legs: "jeans", shoes: "flipFlops" };
}

/** Place a raw id in a slot only if it exists AND actually fills that slot. */
function idForSlot(id: unknown, slot: EquipSlot): EquipId | null {
  const item = typeof id === "string" ? EQUIPMENT.find((e) => e.id === id) : null;
  return item && item.slot === slot ? item.id : null;
}

/**
 * Coerce a raw per-slot value into a full, validated `EquipSlots`. Handles the
 * object shape (each slot's id validated against that slot) and the LEGACY
 * single-slot string shape (`"bucket"` | null), which maps into the hat slot.
 * `fillDefaults` decides what a slot ABSENT from the raw value becomes: Joseph's
 * starter outfit (`true` — for the hero / an old single-loadout save) or empty
 * (`false` — for a non-hero member who was never dressed). A slot present but
 * null always stays null (respecting an explicit unequip).
 */
export function coerceSlots(raw: unknown, fillDefaults: boolean): EquipSlots {
  const out = fillDefaults ? defaultEquipSlots() : emptyEquipSlots();
  if (typeof raw === "string") {
    out.hat = idForSlot(raw, "hat");
    return out;
  }
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    for (const slot of EQUIP_SLOTS) {
      if (slot in r) out[slot] = idForSlot(r[slot], slot);
    }
  }
  return out;
}

/**
 * Normalize any persisted single-loadout `equipped` shape into a full
 * `EquipSlots`, defaulting missing slots to Joseph's starter outfit. Thin
 * wrapper over `coerceSlots(raw, true)` — the hero-flavoured coercion used by
 * the legacy migration path (see gameState's `normalizeItemEquipment`).
 */
export function normalizeEquipSlots(raw: unknown): EquipSlots {
  return coerceSlots(raw, true);
}

/**
 * Whether a character whose roster tags are `tags` may wear `item`. No
 * restriction (absent/empty `allowedTags`) => anyone. Otherwise the tag sets
 * must intersect. Pure.
 */
export function itemAllowsTags(item: Equipment, tags: readonly CharacterTag[]): boolean {
  if (!item.allowedTags || item.allowedTags.length === 0) return true;
  return item.allowedTags.some((t) => tags.includes(t));
}

/**
 * Layer every worn slot's stat deltas onto base build stats. Deltas are SUMMED
 * across all slots, then each buffed combat stat is clamped to `STAT_FLOOR` so
 * a debuff can never drop it below a sane minimum. Pure: returns a fresh
 * `Stats`. maxHp/hp pass through untouched (see file header).
 */
export function applyEquipmentBuffs(stats: Stats, equipped: EquipSlots): Stats {
  const out: Stats = { ...stats };
  const totals: Partial<Record<(typeof BUFF_STATS)[number], number>> = {};
  for (const slot of EQUIP_SLOTS) {
    const item = equipmentById(equipped[slot]);
    if (!item) continue;
    for (const key of BUFF_STATS) {
      const delta = item.buffs[key];
      if (delta !== undefined) totals[key] = (totals[key] ?? 0) + delta;
    }
  }
  for (const key of BUFF_STATS) {
    const total = totals[key];
    if (total !== undefined) out[key] = Math.max(STAT_FLOOR, out[key] + total);
  }
  return out;
}
