/**
 * Fishing minigame — a pure, deterministic timing-window mechanic for the
 * Sunless Sea's silverfin catch (Act 3). Engine-agnostic: no Phaser, no
 * Date.now, no Math.random. The scene drives it by feeding elapsed time
 * (`tickFishing`) and player taps (`hookFishing`); all rules live here so
 * they can be unit-tested like `atb.ts`.
 *
 * A single indicator slides back and forth across a 0..1 gauge, bouncing off
 * both ends. The player taps to hook; a tap inside the target window counts
 * as a hit, a tap outside it as a miss. Land `requiredHits` before the line
 * snaps at `maxMisses` and the silverfin is caught.
 */

export interface FishingConfig {
  /** Gauge units the indicator travels per second (it wraps 0..1 by reflecting). */
  speed: number;
  /** Centre of the success window, 0..1. */
  target: number;
  /** Half-width of the success window (a tap counts if |pos-target| <= this). */
  windowHalf: number;
  /** Successful hooks needed to land the catch. */
  requiredHits: number;
  /** Missed hooks that snap the line (fail). */
  maxMisses: number;
}

export interface FishingState {
  /** Indicator position, 0..1. */
  position: number;
  /** Travel direction: +1 rising, -1 falling. */
  direction: 1 | -1;
  hits: number;
  misses: number;
  /** True once the minigame has resolved (landed or line snapped). */
  done: boolean;
  /** True only on a successful catch. */
  landed: boolean;
}

/** A fair default: a brisk indicator, a modest centre window, 3 hits to land. */
export const DEFAULT_FISHING: FishingConfig = {
  speed: 0.9,
  target: 0.5,
  windowHalf: 0.14,
  requiredHits: 3,
  maxMisses: 5,
};

/** Fresh minigame: indicator at the bottom, rising. */
export function newFishing(_cfg: FishingConfig = DEFAULT_FISHING): FishingState {
  return { position: 0, direction: 1, hits: 0, misses: 0, done: false, landed: false };
}

/** Reflect a linear move within [0, 1], flipping direction at each wall. */
function reflect(position: number, direction: 1 | -1, distance: number): {
  position: number;
  direction: 1 | -1;
} {
  let p = position + direction * distance;
  let d: 1 | -1 = direction;
  // Distances can exceed the [0,1] span (large dt / high speed): loop until
  // the reflected point lands back inside the gauge.
  let guard = 0;
  while ((p < 0 || p > 1) && guard++ < 1000) {
    if (p < 0) {
      p = -p;
      d = 1;
    } else {
      p = 2 - p;
      d = -1;
    }
  }
  // Clamp against floating-point drift at the exact walls.
  if (p < 0) p = 0;
  if (p > 1) p = 1;
  return { position: p, direction: d };
}

/** Advance the indicator by `dt` seconds (no-op once resolved). */
export function tickFishing(
  state: FishingState,
  cfg: FishingConfig,
  dt: number,
): FishingState {
  if (state.done || dt <= 0) return state;
  const moved = reflect(state.position, state.direction, cfg.speed * dt);
  return { ...state, position: moved.position, direction: moved.direction };
}

/** Whether the indicator is currently inside the success window. */
export function inWindow(state: FishingState, cfg: FishingConfig): boolean {
  return Math.abs(state.position - cfg.target) <= cfg.windowHalf;
}

/**
 * Register a tap. A tap inside the window is a hit (landing the catch once
 * `requiredHits` is reached); outside it is a miss (snapping the line once
 * `maxMisses` is reached). No-op once resolved.
 */
export function hookFishing(state: FishingState, cfg: FishingConfig): FishingState {
  if (state.done) return state;
  if (inWindow(state, cfg)) {
    const hits = state.hits + 1;
    const landed = hits >= cfg.requiredHits;
    return { ...state, hits, done: landed, landed };
  }
  const misses = state.misses + 1;
  const snapped = misses >= cfg.maxMisses;
  return { ...state, misses, done: snapped, landed: false };
}

/** Fraction of required hits landed so far, 0..1 (for a progress readout). */
export function fishingProgress(state: FishingState, cfg: FishingConfig): number {
  if (cfg.requiredHits <= 0) return 1;
  return Math.min(1, state.hits / cfg.requiredHits);
}
