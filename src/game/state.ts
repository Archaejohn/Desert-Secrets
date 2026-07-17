/**
 * Bridge between Phaser's registry and the pure run state, plus save-game
 * persistence. All rules live in src/core/gameState.ts; scenes read/write
 * through here. Every state write is mirrored to localStorage (checkpoint
 * saves), so closing the browser mid-act keeps progress.
 */
import type Phaser from "phaser";
import { type Act1State, newGame, normalizeItemEquipment, ownedCount } from "../core/gameState";

const KEY = "act1";
const SAVE_KEY = "desert-secrets-save-v1";

function persist(s: Act1State): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, state: s }));
  } catch {
    // Storage unavailable (private mode, artifact sandbox) — play on.
  }
}

/** Load the checkpoint save, if one exists and looks sane. */
export function loadSavedState(): Act1State | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; state?: Act1State };
    const s = parsed?.state;
    if (parsed?.v !== 1 || !s || typeof s.zone !== "string" || !s.hero || !s.flags) {
      return null;
    }
    // Merge over a fresh state so saves survive newly added flags/fields.
    const fresh = newGame();
    // Coerce the equipment blob: a save from EITHER the old single-loadout model
    // (boolean ownership + one `equipped` record) or the current per-character
    // pool model resolves to the pool shape, so a mid-refactor reload can't
    // crash. `normalizeItemEquipment` sees the raw (possibly legacy) items.
    // If a malformed save is missing `items` entirely, keep fresh.items (its
    // default starter outfit) rather than blanking Joseph's gear.
    let items = { ...fresh.items };
    if (s.items && typeof s.items === "object") {
      const { owned, equipped } = normalizeItemEquipment(s.items as unknown);
      items = { ...fresh.items, ...s.items, owned, equipped };
      // Drop any stale legacy boolean-ownership keys so they aren't re-persisted.
      for (const k of ["stick", "minersHat", "pickaxe", "tshirt", "jeans", "flipFlops"]) {
        delete (items as Record<string, unknown>)[k];
      }
    }
    const merged: Act1State = {
      ...fresh,
      ...s,
      items,
      flags: { ...fresh.flags, ...s.flags },
      hero: { ...fresh.hero, ...s.hero }
    };
    // Back-fill the frost feather for a legacy save that already picked it up
    // (the crashFeather flag) before the item existed in the pool.
    if (merged.flags.crashFeather && ownedCount(merged, "frostFeather") === 0) {
      merged.items.owned = { ...merged.items.owned, frostFeather: 1 };
    }
    return merged;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function getState(scene: Phaser.Scene): Act1State {
  let s = scene.registry.get(KEY) as Act1State | undefined;
  if (!s) {
    s = newGame();
    scene.registry.set(KEY, s);
  }
  return s;
}

export function setState(scene: Phaser.Scene, s: Act1State): void {
  scene.registry.set(KEY, s);
  persist(s);
}

export function resetGame(scene: Phaser.Scene): Act1State {
  clearSave();
  const s = newGame();
  scene.registry.set(KEY, s);
  return s;
}
