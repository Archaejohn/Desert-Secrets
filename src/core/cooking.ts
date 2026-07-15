/**
 * Cooking minigame — a pure, deterministic timing-window mechanic for Act 7's
 * bake at La Pizzeria Sotterranea (the finale). Engine-agnostic, mirroring
 * `src/core/fishing.ts`: no Phaser, no Date.now, no Math.random. The scene
 * drives it by feeding elapsed time (`tickCooking`) and player taps
 * (`addTopping`); all rules live here so they can be unit-tested like
 * `atb.ts` / `fishing.ts`.
 *
 * A heat indicator slides back and forth across a 0..1 gauge, bouncing off both
 * ends (the browning band sweeping the pizza). The player taps to set each of
 * the four toppings Piggy loves — silverfin, socks, oranges, seaweed — as the
 * indicator crosses the glowing "just right" window. A tap inside the window
 * places a topping cleanly; a tap outside it is a fumble (a scorch). Land all
 * `requiredAdds` toppings before `maxFumbles` scorches and the pizza is
 * PERFECT; too many scorches and the bake is ruined (Testudo helps you start
 * over).
 *
 * The shape is intentionally the same as fishing's (proven, testable), with
 * cooking semantics: the "hits" become toppings placed, tracked so the UI can
 * name which of the four is next.
 */

export interface CookingConfig {
  /** Gauge units the heat indicator travels per second (reflects at 0..1). */
  speed: number;
  /** Centre of the "just right" browning window, 0..1. */
  target: number;
  /** Half-width of the window (a tap counts if |pos-target| <= this). */
  windowHalf: number;
  /** Toppings that must be placed to finish the pizza (the four ingredients). */
  requiredAdds: number;
  /** Fumbled (scorched) taps that ruin the bake (fail). */
  maxFumbles: number;
}

export interface CookingState {
  /** Heat-indicator position, 0..1. */
  position: number;
  /** Travel direction: +1 rising, -1 falling. */
  direction: 1 | -1;
  /** Toppings placed cleanly so far (0..requiredAdds). */
  added: number;
  /** Scorched (mistimed) taps so far. */
  fumbles: number;
  /** True once the bake has resolved (perfect or ruined). */
  done: boolean;
  /** True only on a perfect bake (all toppings placed). */
  perfect: boolean;
}

/**
 * A fair default, distinct from fishing: a brisker indicator and a tighter
 * window (the bake is more frantic than a lazy fishing line), four toppings to
 * place, four scorches to ruin it.
 */
export const DEFAULT_COOKING: CookingConfig = {
  speed: 1.15,
  target: 0.5,
  windowHalf: 0.12,
  requiredAdds: 4,
  maxFumbles: 4,
};

/** Fresh bake: indicator at the bottom, rising, nothing placed yet. */
export function newCooking(_cfg: CookingConfig = DEFAULT_COOKING): CookingState {
  return { position: 0, direction: 1, added: 0, fumbles: 0, done: false, perfect: false };
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

/** Advance the heat indicator by `dt` seconds (no-op once resolved). */
export function tickCooking(
  state: CookingState,
  cfg: CookingConfig,
  dt: number,
): CookingState {
  if (state.done || dt <= 0) return state;
  const moved = reflect(state.position, state.direction, cfg.speed * dt);
  return { ...state, position: moved.position, direction: moved.direction };
}

/** Whether the indicator is currently inside the "just right" window. */
export function inWindow(state: CookingState, cfg: CookingConfig): boolean {
  return Math.abs(state.position - cfg.target) <= cfg.windowHalf;
}

/**
 * Register a tap. Inside the window places a topping cleanly (a perfect bake
 * once `requiredAdds` are placed); outside it is a scorch (a ruined bake once
 * `maxFumbles` is reached). No-op once resolved.
 */
export function addTopping(state: CookingState, cfg: CookingConfig): CookingState {
  if (state.done) return state;
  if (inWindow(state, cfg)) {
    const added = state.added + 1;
    const perfect = added >= cfg.requiredAdds;
    return { ...state, added, done: perfect, perfect };
  }
  const fumbles = state.fumbles + 1;
  const ruined = fumbles >= cfg.maxFumbles;
  return { ...state, fumbles, done: ruined, perfect: false };
}

/** Fraction of required toppings placed so far, 0..1 (for a progress readout). */
export function cookingProgress(state: CookingState, cfg: CookingConfig): number {
  if (cfg.requiredAdds <= 0) return 1;
  return Math.min(1, state.added / cfg.requiredAdds);
}
