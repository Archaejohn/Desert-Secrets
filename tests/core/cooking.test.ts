import { describe, expect, it } from "vitest";
import {
  DEFAULT_COOKING,
  addTopping,
  cookingProgress,
  inWindow,
  newCooking,
  tickCooking,
  type CookingConfig,
  type CookingState,
} from "../../src/core/cooking";

const CFG: CookingConfig = {
  speed: 1,
  target: 0.5,
  windowHalf: 0.1,
  requiredAdds: 4,
  maxFumbles: 3,
};

/** Build a state at a fixed position/direction for deterministic assertions. */
function at(position: number, direction: 1 | -1 = 1, extra: Partial<CookingState> = {}): CookingState {
  return { position, direction, added: 0, fumbles: 0, done: false, perfect: false, ...extra };
}

describe("newCooking", () => {
  it("starts at the bottom, rising, nothing placed", () => {
    const s = newCooking(CFG);
    expect(s).toEqual({ position: 0, direction: 1, added: 0, fumbles: 0, done: false, perfect: false });
  });
});

describe("tickCooking", () => {
  it("advances position by speed * dt in the travel direction", () => {
    const s = tickCooking(at(0.2, 1), CFG, 0.1);
    expect(s.position).toBeCloseTo(0.3, 6);
    expect(s.direction).toBe(1);
  });

  it("reflects off the top wall and flips to falling", () => {
    const s = tickCooking(at(0.95, 1), CFG, 0.2); // 0.95 + 0.2 = 1.15 -> 0.85, dir -1
    expect(s.position).toBeCloseTo(0.85, 6);
    expect(s.direction).toBe(-1);
  });

  it("reflects off the bottom wall and flips to rising", () => {
    const s = tickCooking(at(0.05, -1), CFG, 0.2); // 0.05 - 0.2 = -0.15 -> 0.15, dir 1
    expect(s.position).toBeCloseTo(0.15, 6);
    expect(s.direction).toBe(1);
  });

  it("stays within [0,1] even when a single step spans several bounces", () => {
    let s = at(0, 1);
    for (const dt of [2.3, 1.7, 5.0, 0.9]) {
      s = tickCooking(s, CFG, dt);
      expect(s.position).toBeGreaterThanOrEqual(0);
      expect(s.position).toBeLessThanOrEqual(1);
    }
  });

  it("is a no-op once resolved or for non-positive dt", () => {
    const done = at(0.5, 1, { done: true });
    expect(tickCooking(done, CFG, 1)).toBe(done);
    const live = at(0.4, 1);
    expect(tickCooking(live, CFG, 0)).toBe(live);
  });

  it("is deterministic for a given sequence", () => {
    const run = () => {
      let s = newCooking(CFG);
      for (let i = 0; i < 50; i++) s = tickCooking(s, CFG, 0.037);
      return s.position;
    };
    expect(run()).toBe(run());
  });
});

describe("inWindow", () => {
  it("is true inside the window and false outside it", () => {
    expect(inWindow(at(0.5), CFG)).toBe(true);
    expect(inWindow(at(0.59), CFG)).toBe(true); // edge (|0.09| <= 0.1)
    expect(inWindow(at(0.62), CFG)).toBe(false);
    expect(inWindow(at(0.2), CFG)).toBe(false);
  });
});

describe("addTopping", () => {
  it("places a topping cleanly inside the window", () => {
    const s = addTopping(at(0.5), CFG);
    expect(s.added).toBe(1);
    expect(s.fumbles).toBe(0);
    expect(s.done).toBe(false);
  });

  it("scorches (a fumble) outside the window", () => {
    const s = addTopping(at(0.1), CFG);
    expect(s.added).toBe(0);
    expect(s.fumbles).toBe(1);
    expect(s.done).toBe(false);
  });

  it("bakes the perfect pizza on the requiredAdds-th topping", () => {
    let s = at(0.5);
    for (let i = 0; i < CFG.requiredAdds; i++) s = addTopping({ ...s, position: 0.5 }, CFG);
    expect(s.added).toBe(4);
    expect(s.done).toBe(true);
    expect(s.perfect).toBe(true);
  });

  it("ruins the bake on the maxFumbles-th scorch (done, not perfect)", () => {
    let s = at(0.1);
    for (let i = 0; i < CFG.maxFumbles; i++) s = addTopping({ ...s, position: 0.1 }, CFG);
    expect(s.fumbles).toBe(3);
    expect(s.done).toBe(true);
    expect(s.perfect).toBe(false);
  });

  it("is a no-op once resolved", () => {
    const done = at(0.5, 1, { done: true, perfect: true, added: 4 });
    expect(addTopping(done, CFG)).toBe(done);
  });
});

describe("cookingProgress", () => {
  it("reports the fraction of toppings placed", () => {
    expect(cookingProgress(at(0.5, 1, { added: 0 }), CFG)).toBe(0);
    expect(cookingProgress(at(0.5, 1, { added: 2 }), CFG)).toBe(0.5);
    expect(cookingProgress(at(0.5, 1, { added: 4 }), CFG)).toBe(1);
  });
});

describe("DEFAULT_COOKING", () => {
  it("is a sane, playable config (four toppings, tighter than fishing)", () => {
    expect(DEFAULT_COOKING.requiredAdds).toBe(4); // the four ingredients Piggy loves
    expect(DEFAULT_COOKING.windowHalf).toBeGreaterThan(0);
    expect(DEFAULT_COOKING.windowHalf).toBeLessThan(0.5);
    expect(DEFAULT_COOKING.target).toBeGreaterThanOrEqual(DEFAULT_COOKING.windowHalf);
    expect(DEFAULT_COOKING.target).toBeLessThanOrEqual(1 - DEFAULT_COOKING.windowHalf);
  });
});
