/**
 * Post-victory item drops. Pure and deterministic: the caller passes the
 * battle's own seeded RNG (src/core/rng.ts's makeRng) — never Math.random,
 * which is banned and breaks reproducibility.
 *
 * The table is intentionally small and weighted so the common drop is a
 * shiny (the tradeable currency that feeds the Dusty economy). It's shaped
 * as a weighted list so a rarer entry (e.g. a heal item) can be added later
 * without touching the roll logic. Bosses never drop here — their rewards
 * are scripted (victory flags, story beats), not random loot. Key/quest
 * items are never in the table by design.
 */

export type DropId = "shiny";

interface DropTableEntry {
  id: DropId;
  weight: number;
}

/** Chance that a (non-boss) victory drops anything at all. */
export const DROP_CHANCE = 0.3;

/** Weighted drop table. Add entries here; the roll logic stays untouched. */
export const DROP_TABLE: readonly DropTableEntry[] = [{ id: "shiny", weight: 1 }];

/** Player-facing "Found a ..." labels for the toast on a drop. */
export const DROP_LABELS: Record<DropId, string> = {
  shiny: "a shiny",
};

/**
 * Roll a post-victory drop, or null for nothing. `group` is the defeated
 * enemy-id list (reserved for future per-enemy tables); `boss` suppresses
 * drops entirely. Consumes at most two RNG values (the gate, then the
 * weighted pick) so callers can reason about determinism.
 */
export function rollDrop(
  rng: () => number,
  group: string[],
  boss = false,
): DropId | null {
  if (boss || group.length === 0) return null;
  if (rng() >= DROP_CHANCE) return null;
  const total = DROP_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const entry of DROP_TABLE) {
    roll -= entry.weight;
    if (roll < 0) return entry.id;
  }
  return DROP_TABLE[DROP_TABLE.length - 1].id;
}
