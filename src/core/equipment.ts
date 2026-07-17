/**
 * Equipment catalog and stat-buff application. Engine-agnostic, pure — no
 * Phaser imports. See docs/CONTRACTS.md section 5 / v35.
 *
 * Gear is worn in `Act1State.items.equipped` — a single equip slot today,
 * holding a stable `EquipId` (or null). Each equippable carries a stat-delta
 * profile (`buffs`) that is layered on top of the hero's build stats by
 * `applyEquipmentBuffs`, which `heroStats()` calls — so battle, the Party
 * status tab, and the Equipment tab all read one consistent buffed block.
 *
 * BUCKET-AS-TOOL vs BUCKET-AS-ARMOR (the reconciliation). The bucket is BOTH
 * the chicken-chore fetch item (`items.bucket`: none/empty/filled) AND wearable
 * headgear. The two axes are kept ORTHOGONAL: the equip slot
 * (`items.equipped`) is independent of the fill-state (`items.bucket`).
 * Equipping grants the +2 DEF / -1 SPD buff regardless of whether the pail is
 * empty or full; the chore reads the fill-state and works fine while the bucket
 * is worn (filling at the spigot / delivering at the coop both require it
 * equipped today). The bucket is NEVER destroyed by the chore — delivery just
 * empties the pail (filled -> empty) and Joseph keeps wearing it, so the
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
export type EquipId = "bucket";

/** Per-item stat deltas layered onto the base build. May be negative. */
export type StatBuffs = Partial<Pick<Stats, "attack" | "defense" | "speed">>;

export interface Equipment {
  id: EquipId;
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
 * The equippable catalog. The bucket ships first, per spec: worn as headgear
 * it grants +2 DEF, -1 SPD. Extend by appending entries (add the id to
 * `EquipId` too); nothing keys off array order.
 */
export const EQUIPMENT: readonly Equipment[] = [
  {
    id: "bucket",
    name: "Bucket",
    description: "A tin pail worn upended as a helmet — clumsy, but it turns a blow.",
    buffs: { defense: 2, speed: -1 },
  },
];

/** Look up an equippable by id (null id / unknown id -> null). */
export function equipmentById(id: EquipId | null | undefined): Equipment | null {
  if (!id) return null;
  return EQUIPMENT.find((e) => e.id === id) ?? null;
}

/**
 * Layer the equipped item's stat deltas onto base build stats, clamping each
 * buffed combat stat to `STAT_FLOOR` so a debuff can never drop it below a sane
 * minimum. Pure: returns a fresh `Stats`. maxHp/hp pass through untouched (see
 * file header). A null/unknown equip returns a copy of the input unchanged.
 */
export function applyEquipmentBuffs(stats: Stats, equipped: EquipId | null): Stats {
  const item = equipmentById(equipped);
  const out: Stats = { ...stats };
  if (!item) return out;
  for (const key of BUFF_STATS) {
    const delta = item.buffs[key];
    if (delta !== undefined) {
      out[key] = Math.max(STAT_FLOOR, out[key] + delta);
    }
  }
  return out;
}
