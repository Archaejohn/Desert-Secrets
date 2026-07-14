/**
 * Bridge between Phaser's registry and the pure run state, plus save-game
 * persistence. All rules live in src/core/gameState.ts; scenes read/write
 * through here. Every state write is mirrored to localStorage (checkpoint
 * saves), so closing the browser mid-act keeps progress.
 */
import type Phaser from "phaser";
import { type Act1State, newGame } from "../core/gameState";

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
    return {
      ...fresh,
      ...s,
      items: { ...fresh.items, ...s.items },
      flags: { ...fresh.flags, ...s.flags },
      hero: { ...fresh.hero, ...s.hero }
    };
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
