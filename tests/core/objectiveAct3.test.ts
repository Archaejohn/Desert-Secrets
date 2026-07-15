import { describe, expect, it } from "vitest";
import { newGame, type Act1State, type ZoneId } from "../../src/core/gameState";
import { objectiveFor } from "../../src/core/objective";

/** Flags for a finished Act 1 + Act 2. */
const done2 = { actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true };

function state(zone: ZoneId, flags: Record<string, boolean> = {}): Act1State {
  const s = newGame();
  return { ...s, zone, flags: { ...s.flags, ...done2, ...flags } };
}

describe("objectiveFor — Act 3 chain", () => {
  it("keeps 'Act 2 complete!' until the crack is followed", () => {
    expect(objectiveFor(state("sanctum"))).toBe("Act 2 complete!");
  });

  it("sends the party down into the sea once act3Started, from an Act 2 zone", () => {
    expect(objectiveFor(state("sanctum", { act3Started: true }))).toBe("Descend into the Sunless Sea");
  });

  it("asks the player to explore the sea before Fluffball is glimpsed", () => {
    expect(objectiveFor(state("sunlessSea", { act3Started: true }))).toBe("Explore the Sunless Sea");
  });

  it("points at the deep kelp beds once Fluffball gives the clue", () => {
    const s = state("sunlessSea", { act3Started: true, metFluffball: true });
    expect(objectiveFor(s)).toBe("Fish the deep kelp for silverfin");
  });

  it("celebrates the catch once the silverfin is landed", () => {
    const s = state("sunlessSea", { act3Started: true, metFluffball: true, silverfinCaught: true });
    expect(objectiveFor(s)).toBe("You have the silverfin!");
  });

  it("marks Act 3 complete from anywhere once act3Complete", () => {
    for (const zone of ["sunlessSea", "sanctum", "crash"] as ZoneId[]) {
      expect(objectiveFor(state(zone, { act3Started: true, act3Complete: true }))).toBe("Act 3 complete!");
    }
  });

  it("keeps every Act 3 objective within 40 characters", () => {
    const flagSets: Array<Record<string, boolean>> = [
      { act3Started: true },
      { act3Started: true, metFluffball: true },
      { act3Started: true, metFluffball: true, silverfinCaught: true },
      { act3Started: true, act3Complete: true },
    ];
    for (const zone of ["sanctum", "sunlessSea"] as ZoneId[]) {
      for (const flags of flagSets) {
        const text = objectiveFor(state(zone, flags));
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(40);
      }
    }
  });
});
