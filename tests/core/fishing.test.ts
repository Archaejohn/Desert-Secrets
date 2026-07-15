import { describe, expect, it } from "vitest";
import {
  DEFAULT_FISHING,
  fishingProgress,
  hookFishing,
  inWindow,
  newFishing,
  tickFishing,
  type FishingConfig,
  type FishingState,
} from "../../src/core/fishing";

const CFG: FishingConfig = {
  speed: 1,
  target: 0.5,
  windowHalf: 0.1,
  requiredHits: 3,
  maxMisses: 3,
};

/** Build a state at a fixed position/direction for deterministic assertions. */
function at(position: number, direction: 1 | -1 = 1, extra: Partial<FishingState> = {}): FishingState {
  return { position, direction, hits: 0, misses: 0, done: false, landed: false, ...extra };
}

describe("newFishing", () => {
  it("starts at the bottom, rising, unresolved", () => {
    const s = newFishing(CFG);
    expect(s).toEqual({ position: 0, direction: 1, hits: 0, misses: 0, done: false, landed: false });
  });
});

describe("tickFishing", () => {
  it("advances position by speed * dt in the travel direction", () => {
    const s = tickFishing(at(0.2, 1), CFG, 0.1);
    expect(s.position).toBeCloseTo(0.3, 6);
    expect(s.direction).toBe(1);
  });

  it("reflects off the top wall and flips to falling", () => {
    const s = tickFishing(at(0.95, 1), CFG, 0.2); // 0.95 + 0.2 = 1.15 -> 0.85, dir -1
    expect(s.position).toBeCloseTo(0.85, 6);
    expect(s.direction).toBe(-1);
  });

  it("reflects off the bottom wall and flips to rising", () => {
    const s = tickFishing(at(0.05, -1), CFG, 0.2); // 0.05 - 0.2 = -0.15 -> 0.15, dir 1
    expect(s.position).toBeCloseTo(0.15, 6);
    expect(s.direction).toBe(1);
  });

  it("stays within [0,1] even when a single step spans several bounces", () => {
    let s = at(0, 1);
    for (const dt of [2.3, 1.7, 5.0, 0.9]) {
      s = tickFishing(s, CFG, dt);
      expect(s.position).toBeGreaterThanOrEqual(0);
      expect(s.position).toBeLessThanOrEqual(1);
    }
  });

  it("is a no-op once resolved or for non-positive dt", () => {
    const done = at(0.5, 1, { done: true });
    expect(tickFishing(done, CFG, 1)).toBe(done);
    const live = at(0.4, 1);
    expect(tickFishing(live, CFG, 0)).toBe(live);
  });

  it("is deterministic for a given sequence", () => {
    const run = () => {
      let s = newFishing(CFG);
      for (let i = 0; i < 50; i++) s = tickFishing(s, CFG, 0.037);
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

describe("hookFishing", () => {
  it("counts a hit inside the window", () => {
    const s = hookFishing(at(0.5), CFG);
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(0);
    expect(s.done).toBe(false);
  });

  it("counts a miss outside the window", () => {
    const s = hookFishing(at(0.1), CFG);
    expect(s.hits).toBe(0);
    expect(s.misses).toBe(1);
    expect(s.done).toBe(false);
  });

  it("lands the catch on the requiredHits-th hit", () => {
    let s = at(0.5);
    for (let i = 0; i < CFG.requiredHits; i++) s = hookFishing({ ...s, position: 0.5 }, CFG);
    expect(s.hits).toBe(3);
    expect(s.done).toBe(true);
    expect(s.landed).toBe(true);
  });

  it("snaps the line on the maxMisses-th miss (fail, not landed)", () => {
    let s = at(0.1);
    for (let i = 0; i < CFG.maxMisses; i++) s = hookFishing({ ...s, position: 0.1 }, CFG);
    expect(s.misses).toBe(3);
    expect(s.done).toBe(true);
    expect(s.landed).toBe(false);
  });

  it("is a no-op once resolved", () => {
    const done = at(0.5, 1, { done: true, landed: true, hits: 3 });
    expect(hookFishing(done, CFG)).toBe(done);
  });
});

describe("fishingProgress", () => {
  it("reports the fraction of required hits landed", () => {
    expect(fishingProgress(at(0.5, 1, { hits: 0 }), CFG)).toBe(0);
    expect(fishingProgress(at(0.5, 1, { hits: 1 }), CFG)).toBeCloseTo(1 / 3, 6);
    expect(fishingProgress(at(0.5, 1, { hits: 3 }), CFG)).toBe(1);
  });
});

describe("DEFAULT_FISHING", () => {
  it("is a sane, playable config", () => {
    expect(DEFAULT_FISHING.requiredHits).toBeGreaterThan(0);
    expect(DEFAULT_FISHING.windowHalf).toBeGreaterThan(0);
    expect(DEFAULT_FISHING.windowHalf).toBeLessThan(0.5);
    expect(DEFAULT_FISHING.target).toBeGreaterThanOrEqual(DEFAULT_FISHING.windowHalf);
    expect(DEFAULT_FISHING.target).toBeLessThanOrEqual(1 - DEFAULT_FISHING.windowHalf);
  });
});
