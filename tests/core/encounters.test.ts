import { describe, expect, it } from "vitest";
import {
  ENCOUNTERS,
  EncounterClock,
  REEK_AVERSE,
  reekAdjusted,
  type EncounterTable,
} from "../../src/core/encounters";
import { makeRng } from "../../src/core/rng";

/** rng that replays a fixed sequence (then repeats the last value). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const alwaysTrigger = () => 0;
const neverTrigger = () => 0.99;

describe("ENCOUNTERS tables", () => {
  it("trail matches the contract groups and weights", () => {
    expect(ENCOUNTERS.trail.zone).toBe("trail");
    expect(ENCOUNTERS.trail.groups).toEqual([
      ["scarab"],
      ["buzzard"],
      ["scarab", "scarab"],
      ["gila"],
      ["buzzard", "scarab"],
    ]);
    expect(ENCOUNTERS.trail.weights).toEqual([3, 3, 2, 2, 1]);
  });

  it("mine matches the contract groups and weights", () => {
    expect(ENCOUNTERS.mine.zone).toBe("mine");
    expect(ENCOUNTERS.mine.groups).toEqual([
      ["scarab"],
      ["scarab", "scarab"],
      ["gila"],
      ["scarab", "gila"],
    ]);
    expect(ENCOUNTERS.mine.weights).toEqual([3, 3, 2, 1]);
  });

  it("maze matches the contract groups and weights", () => {
    expect(ENCOUNTERS.maze.zone).toBe("maze");
    expect(ENCOUNTERS.maze.groups).toEqual([
      ["frostscarab"],
      ["icebat"],
      ["frostscarab", "frostscarab"],
      ["icebat", "frostscarab"],
    ]);
    expect(ENCOUNTERS.maze.weights).toEqual([3, 3, 2, 2]);
  });

  it("galleries matches the contract groups and weights", () => {
    expect(ENCOUNTERS.galleries.zone).toBe("galleries");
    expect(ENCOUNTERS.galleries.groups).toEqual([
      ["icebat"],
      ["crystalcrawler"],
      ["icebat", "icebat"],
      ["crystalcrawler", "icebat"],
    ]);
    expect(ENCOUNTERS.galleries.weights).toEqual([3, 2, 2, 1]);
  });

  it("overworld matches the contract groups and weights", () => {
    expect(ENCOUNTERS.overworld.zone).toBe("overworld");
    expect(ENCOUNTERS.overworld.groups).toEqual([
      ["scarab"],
      ["jackrabbit"],
      ["buzzard"],
      ["scarab", "scarab"],
      ["gila"],
    ]);
    expect(ENCOUNTERS.overworld.weights).toEqual([3, 3, 2, 2, 1]);
  });

  it("sunlessSea matches the contract groups and weights", () => {
    expect(ENCOUNTERS.sunlessSea.zone).toBe("sunlessSea");
    expect(ENCOUNTERS.sunlessSea.groups).toEqual([
      ["anglerfish"],
      ["reefeel"],
      ["anglerfish", "anglerfish"],
      ["reefeel", "anglerfish"],
    ]);
    expect(ENCOUNTERS.sunlessSea.weights).toEqual([3, 3, 2, 2]);
  });

  it("minersCamp matches the contract groups and weights", () => {
    expect(ENCOUNTERS.minersCamp.zone).toBe("minersCamp");
    expect(ENCOUNTERS.minersCamp.groups).toEqual([
      ["middenmite", "middenmite", "middenmite"],
      ["frostscarab"],
      ["middenmite", "middenmite"],
      ["frostscarab", "middenmite"],
    ]);
    expect(ENCOUNTERS.minersCamp.weights).toEqual([3, 3, 2, 2]);
  });

  it("exposes exactly the eight contract zones", () => {
    expect(Object.keys(ENCOUNTERS).sort()).toEqual([
      "galleries",
      "grove",
      "maze",
      "mine",
      "minersCamp",
      "overworld",
      "sunlessSea",
      "trail",
    ]);
  });

  it("guards Sahra's grove with sunwasp swarms (Act 5)", () => {
    expect(ENCOUNTERS.grove.groups.flat().every((id) => id === "sunwasp")).toBe(true);
    expect(ENCOUNTERS.grove.groups.length).toBe(ENCOUNTERS.grove.weights.length);
  });

  it("keeps groups and weights parallel", () => {
    for (const table of Object.values(ENCOUNTERS)) {
      expect(table.groups.length).toBe(table.weights.length);
    }
  });
});

describe("reekAdjusted — the Act 4 'reeks' mechanic", () => {
  it("cuts reek-averse groups' weight to 1 while the socks are held", () => {
    const adjusted = reekAdjusted(ENCOUNTERS.minersCamp);
    ENCOUNTERS.minersCamp.groups.forEach((group, i) => {
      const averse = group.some((id) => REEK_AVERSE.has(id));
      expect(adjusted.weights[i]).toBe(averse ? 1 : ENCOUNTERS.minersCamp.weights[i]);
    });
    // frost scarabs are averse; midden mites are drawn to the reek.
    expect(REEK_AVERSE.has("frostscarab")).toBe(true);
    expect(REEK_AVERSE.has("middenmite")).toBe(false);
  });

  it("leaves midden-mite-only groups at their full weight", () => {
    const adjusted = reekAdjusted(ENCOUNTERS.minersCamp);
    expect(adjusted.groups[0]).toEqual(["middenmite", "middenmite", "middenmite"]);
    expect(adjusted.weights[0]).toBe(3); // unchanged — mites love the smell
    expect(adjusted.weights[2]).toBe(2);
  });

  it("makes frost-scarab encounters strictly rarer overall", () => {
    const base = ENCOUNTERS.minersCamp;
    const adjusted = reekAdjusted(base);
    const share = (t: EncounterTable, id: string) => {
      const total = t.weights.reduce((a, b) => a + b, 0);
      const hit = t.groups.reduce((a, g, i) => a + (g.includes(id) ? t.weights[i] : 0), 0);
      return hit / total;
    };
    expect(share(adjusted, "frostscarab")).toBeLessThan(share(base, "frostscarab"));
  });

  it("is pure — the original table is untouched", () => {
    const before = JSON.stringify(ENCOUNTERS.minersCamp);
    reekAdjusted(ENCOUNTERS.minersCamp);
    expect(JSON.stringify(ENCOUNTERS.minersCamp)).toBe(before);
  });
});

describe("EncounterClock grace period", () => {
  it("never triggers during the initial 5s grace", () => {
    const clock = new EncounterClock(alwaysTrigger);
    expect(clock.advance(5, ENCOUNTERS.trail)).toBeNull();
    expect(clock.advance(0.9, ENCOUNTERS.trail)).toBeNull(); // 0.9s past grace
  });

  it("can trigger on the first check after the grace ends", () => {
    const clock = new EncounterClock(alwaysTrigger);
    expect(clock.advance(5.9, ENCOUNTERS.trail)).toBeNull();
    expect(clock.advance(0.1, ENCOUNTERS.trail)).not.toBeNull();
  });

  it("spans grace and the first check within one big advance", () => {
    const clock = new EncounterClock(alwaysTrigger);
    expect(clock.advance(20, ENCOUNTERS.trail)).not.toBeNull();
  });

  it("re-arms the grace after a trigger", () => {
    const clock = new EncounterClock(alwaysTrigger);
    expect(clock.advance(6, ENCOUNTERS.trail)).not.toBeNull();
    expect(clock.advance(5.5, ENCOUNTERS.trail)).toBeNull(); // 0.5s past new grace
    expect(clock.advance(0.5, ENCOUNTERS.trail)).not.toBeNull();
  });

  it("re-arms the grace and clears accumulated time on reset()", () => {
    const clock = new EncounterClock(alwaysTrigger);
    clock.advance(5.9, ENCOUNTERS.trail); // 0.9s accumulated past grace
    clock.reset();
    expect(clock.advance(5.9, ENCOUNTERS.trail)).toBeNull();
    expect(clock.advance(0.1, ENCOUNTERS.trail)).not.toBeNull();
  });

  it("honours a custom graceSeconds", () => {
    const clock = new EncounterClock(alwaysTrigger, { graceSeconds: 0 });
    expect(clock.advance(1, ENCOUNTERS.trail)).not.toBeNull();
  });
});

describe("EncounterClock accumulation and checks", () => {
  function graceless(rng: () => number, opts = {}) {
    return new EncounterClock(rng, { graceSeconds: 0, ...opts });
  }

  it("accumulates fractional time across calls", () => {
    const clock = graceless(alwaysTrigger);
    expect(clock.advance(0.4, ENCOUNTERS.trail)).toBeNull();
    expect(clock.advance(0.4, ENCOUNTERS.trail)).toBeNull();
    expect(clock.advance(0.4, ENCOUNTERS.trail)).not.toBeNull(); // crosses 1s
  });

  it("never triggers when every roll fails", () => {
    const clock = graceless(neverTrigger);
    for (let i = 0; i < 100; i++) {
      expect(clock.advance(1, ENCOUNTERS.trail)).toBeNull();
    }
  });

  it("rolls once per elapsed checkInterval", () => {
    let rolls = 0;
    const clock = graceless(() => {
      rolls++;
      return 0.99;
    });
    clock.advance(3.5, ENCOUNTERS.trail);
    expect(rolls).toBe(3);
    clock.advance(0.5, ENCOUNTERS.trail);
    expect(rolls).toBe(4);
  });

  it("honours custom checkInterval and chance", () => {
    const clock = graceless(() => 0.5, { checkInterval: 2, chance: 0.6 });
    expect(clock.advance(1.9, ENCOUNTERS.trail)).toBeNull();
    expect(clock.advance(0.1, ENCOUNTERS.trail)).not.toBeNull(); // 0.5 < 0.6
    const strict = graceless(() => 0.5, { checkInterval: 2, chance: 0.4 });
    expect(strict.advance(10, ENCOUNTERS.trail)).toBeNull(); // 0.5 >= 0.4
  });

  it("ignores zero and grace-swallowed advances", () => {
    const clock = new EncounterClock(alwaysTrigger);
    expect(clock.advance(0, ENCOUNTERS.trail)).toBeNull();
    expect(clock.advance(2, ENCOUNTERS.trail)).toBeNull(); // all grace
  });
});

describe("EncounterClock weighted group picks", () => {
  // After the chance roll, one more rng() picks the group: roll * total
  // walks the cumulative weights (trail totals 11: 3,3,2,2,1).
  function pick(groupRoll: number, table: EncounterTable = ENCOUNTERS.trail) {
    const clock = new EncounterClock(seq([0, groupRoll]), { graceSeconds: 0 });
    return clock.advance(1, table);
  }

  it("maps low rolls to the first group", () => {
    expect(pick(0)).toEqual(["scarab"]);
    expect(pick(0.26)).toEqual(["scarab"]); // 2.86 < 3
  });

  it("maps mid rolls across the middle groups", () => {
    expect(pick(0.3)).toEqual(["buzzard"]); // 3.3 in [3, 6)
    expect(pick(0.6)).toEqual(["scarab", "scarab"]); // 6.6 in [6, 8)
    expect(pick(0.8)).toEqual(["gila"]); // 8.8 in [8, 10)
  });

  it("maps high rolls to the last group", () => {
    expect(pick(0.95)).toEqual(["buzzard", "scarab"]); // 10.45 in [10, 11)
    expect(pick(0.999999)).toEqual(["buzzard", "scarab"]);
  });

  it("picks from the mine table too", () => {
    expect(pick(0, ENCOUNTERS.mine)).toEqual(["scarab"]);
    expect(pick(0.99, ENCOUNTERS.mine)).toEqual(["scarab", "gila"]);
  });

  it("picks across the maze table (total weight 10)", () => {
    expect(pick(0, ENCOUNTERS.maze)).toEqual(["frostscarab"]);
    expect(pick(0.35, ENCOUNTERS.maze)).toEqual(["icebat"]); // 3.5 in [3, 6)
    expect(pick(0.65, ENCOUNTERS.maze)).toEqual([
      "frostscarab",
      "frostscarab",
    ]); // 6.5 in [6, 8)
    expect(pick(0.99, ENCOUNTERS.maze)).toEqual(["icebat", "frostscarab"]);
  });

  it("picks across the galleries table (total weight 8)", () => {
    expect(pick(0, ENCOUNTERS.galleries)).toEqual(["icebat"]);
    expect(pick(0.5, ENCOUNTERS.galleries)).toEqual(["crystalcrawler"]); // 4 in [3, 5)
    expect(pick(0.75, ENCOUNTERS.galleries)).toEqual(["icebat", "icebat"]); // 6 in [5, 7)
    expect(pick(0.99, ENCOUNTERS.galleries)).toEqual([
      "crystalcrawler",
      "icebat",
    ]);
  });

  it("returns a copy — mutating the result leaves the table intact", () => {
    const group = pick(0)!;
    group.push("dragon");
    expect(ENCOUNTERS.trail.groups[0]).toEqual(["scarab"]);
  });
});

describe("EncounterClock cadence (seeded, deterministic)", () => {
  function simulate(seed: number, seconds = 600, step = 0.25): number[] {
    const clock = new EncounterClock(makeRng(seed));
    const triggerTimes: number[] = [];
    for (let t = 0; t < seconds; t += step) {
      if (clock.advance(step, ENCOUNTERS.trail) !== null) {
        triggerTimes.push(t);
      }
    }
    return triggerTimes;
  }

  it("is fully deterministic for a given seed", () => {
    expect(simulate(42)).toEqual(simulate(42));
    expect(simulate(42)).not.toEqual(simulate(43));
  });

  it("triggers at the expected cadence over 600s of movement", () => {
    // chance 0.09/s + 5s grace per trigger => one encounter every ~16s,
    // ~37 expected. Allow a generous statistical band.
    for (const seed of [1, 7, 42, 123, 999]) {
      const count = simulate(seed).length;
      expect(count).toBeGreaterThanOrEqual(25);
      expect(count).toBeLessThanOrEqual(60);
    }
  });

  it("spaces triggers at least graceSeconds + checkInterval apart", () => {
    for (const seed of [1, 7, 42]) {
      const times = simulate(seed);
      for (let i = 1; i < times.length; i++) {
        expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(6 - 0.25);
      }
    }
  });
});
