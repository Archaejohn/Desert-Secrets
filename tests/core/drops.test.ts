import { describe, expect, it } from "vitest";
import { DROP_CHANCE, DROP_LABELS, DROP_TABLE, rollDrop } from "../../src/core/drops";
import { makeRng } from "../../src/core/rng";

describe("rollDrop", () => {
  it("never drops for a boss fight", () => {
    // Try a spread of seeds — bosses are always suppressed.
    for (let seed = 1; seed <= 50; seed++) {
      expect(rollDrop(makeRng(seed), ["foreman"], true)).toBeNull();
    }
  });

  it("never drops for an empty group", () => {
    expect(rollDrop(makeRng(1), [], false)).toBeNull();
  });

  it("is deterministic for a given seed", () => {
    const a = rollDrop(makeRng(12345), ["scarab"], false);
    const b = rollDrop(makeRng(12345), ["scarab"], false);
    expect(a).toBe(b);
  });

  it("returns only table ids or null", () => {
    const ids = new Set(DROP_TABLE.map((e) => e.id));
    for (let seed = 1; seed <= 200; seed++) {
      const drop = rollDrop(makeRng(seed), ["scarab"], false);
      expect(drop === null || ids.has(drop)).toBe(true);
    }
  });

  it("drops at roughly DROP_CHANCE over many seeds", () => {
    const N = 4000;
    let hits = 0;
    for (let seed = 1; seed <= N; seed++) {
      if (rollDrop(makeRng(seed), ["scarab"], false) !== null) hits++;
    }
    const rate = hits / N;
    // Generous band around the configured chance — this only guards against a
    // wildly wrong gate (always/never dropping), not the exact distribution.
    expect(rate).toBeGreaterThan(DROP_CHANCE - 0.08);
    expect(rate).toBeLessThan(DROP_CHANCE + 0.08);
  });

  it("has a player-facing label for every drop id", () => {
    for (const entry of DROP_TABLE) {
      expect(DROP_LABELS[entry.id]).toBeTruthy();
    }
  });
});
