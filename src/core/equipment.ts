/**
 * Equipment catalog and stat-buff application. Engine-agnostic, pure — no
 * Phaser imports. See docs/CONTRACTS.md section 5 / v35.
 *
 * Gear is worn in `Act1State.items.equipped` — a FIVE-SLOT record
 * (`EquipSlots`: hat · weapon · torso · legs · shoes), each holding a stable
 * `EquipId` (or null). Each equippable declares which `slot` it fills. Every
 * worn slot's stat-delta profile (`buffs`) is SUMMED and layered on top of the
 * hero's build stats by `applyEquipmentBuffs`, which `heroStats()` calls — so
 * battle, the Party status tab, and the Equipment tab all read one consistent
 * buffed block. Joseph starts dressed: a t-shirt, jeans, and flip-flops fill
 * the torso/legs/shoes slots from newGame (plain clothes, zero buffs); the hat
 * and weapon slots start empty and are filled by found/bought gear.
 *
 * BUCKET-AS-TOOL vs BUCKET-AS-ARMOR (the reconciliation). The bucket is BOTH
 * the chicken-chore fetch item (`items.bucket`: none/empty/filled) AND wearable
 * headgear (the hat slot). The two axes are kept ORTHOGONAL: the hat slot
 * (`items.equipped.hat`) is independent of the fill-state (`items.bucket`).
 * Equipping grants the +2 DEF / -1 SPD buff regardless of whether the pail is
 * empty or full; the chore reads the fill-state and works fine while the bucket
 * is worn (filling at the spigot / delivering at the coop both require it worn
 * in the hat slot today). The bucket is NEVER destroyed by the chore — delivery
 * just empties the pail (filled -> empty) and Joseph keeps wearing it, so the
 * headgear buff persists after the chore is done.
 *
 * Buffs deliberately cover only the combat stats (attack/defense/speed), NOT
 * maxHp: the hp pool and its heal accounting live on the build
 * (`statsForBuild`), and threading an equip-driven maxHp delta through every
 * heal path (awardXp/choosePerk/respawn) would be a separate change. Keeping
 * equipment out of maxHp means `heroStats` is the single, safe splice point.
 */

import type { Stats } from "./atb";

/** Stable ids for equippable gear. Equipment logic keys off THIS, never the
 *  display name — the display name is presentation and may change freely. */
export type EquipId =
  | "bucket"
  | "stick"
  | "minersHat"
  | "pickaxe"
  | "tshirt"
  | "jeans"
  | "flipFlops";

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
 * Normalize any persisted `equipped` shape into a full `EquipSlots`. Handles:
 *  - the current object shape (validates each slot's id belongs to that slot);
 *  - the LEGACY single-slot string shape (`"bucket"` | null) from pre-two-slot
 *    saves, mapping the string into the hat slot.
 * Missing slots default to the starting outfit, so an old save gets dressed on
 * load. A slot present-but-null stays null (respecting an explicit unequip).
 */
export function normalizeEquipSlots(raw: unknown): EquipSlots {
  const out = defaultEquipSlots();
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
