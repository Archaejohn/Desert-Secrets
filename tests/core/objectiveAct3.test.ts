import { describe, expect, it } from "vitest";
import { newGame, type Act1State, type ZoneId } from "../../src/core/gameState";
import { objectiveFor } from "../../src/core/objective";

/** Flags for a finished Act 1 + Act 2. */
const done2 = { actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true };

function state(zone: ZoneId, flags: Record<string, boolean> = {}): Act1State {
  const s = newGame();
  return { ...s, zone, flags: { ...s.flags, ...done2, ...flags } };
}

describe("objectiveFor — Act 3 chain (six zones)", () => {
  it("keeps 'Act 2 complete!' until the crack is followed", () => {
    expect(objectiveFor(state("sanctum"))).toBe("Act 2 complete!");
  });

  it("sends the party down into the sea once act3Started, from an Act 2 zone", () => {
    expect(objectiveFor(state("sanctum", { act3Started: true }))).toBe("Descend into the Sunless Sea");
  });

  it("grounds each sea zone with its own objective line", () => {
    expect(objectiveFor(state("sunlessSea", { act3Started: true }))).toBe("Press on into the kelp forest");
    expect(objectiveFor(state("kelpForest", { act3Started: true }))).toBe("Explore the kelp forest");
    expect(objectiveFor(state("kelpForest", { act3Started: true, metFluffball: true }))).toBe(
      "Head east to the deep kelp beds"
    );
    expect(objectiveFor(state("sunTemple", { act3Started: true }))).toBe("Search the drowned sun-temple");
    expect(objectiveFor(state("fluffballBed", { act3Started: true }))).toBe("Corner the chick in the kelp bed");
    expect(objectiveFor(state("seaAscent", { act3Started: true }))).toBe("Climb the shaft to the surface");
  });

  it("walks the deep-bed fishing objective from Lurker to catch to climb", () => {
    expect(objectiveFor(state("deepBed", { act3Started: true }))).toBe("Fish the deep bed for silverfin");
    expect(objectiveFor(state("deepBed", { act3Started: true, lurkerDefeated: true }))).toBe(
      "Cast again — land the silverfin"
    );
    expect(
      objectiveFor(state("deepBed", { act3Started: true, lurkerDefeated: true, silverfinCaught: true }))
    ).toBe("Climb up, out of the sea");
  });

  it("marks Act 3 complete from anywhere once act3Complete", () => {
    for (const zone of ["deepBed", "seaAscent", "sanctum", "crash"] as ZoneId[]) {
      expect(objectiveFor(state(zone, { act3Started: true, act3Complete: true }))).toBe("Act 3 complete!");
    }
  });

  it("keeps every Act 3 objective within 40 characters", () => {
    const zones: ZoneId[] = [
      "sanctum",
      "sunlessSea",
      "kelpForest",
      "sunTemple",
      "fluffballBed",
      "deepBed",
      "seaAscent"
    ];
    const flagSets: Array<Record<string, boolean>> = [
      { act3Started: true },
      { act3Started: true, metFluffball: true },
      { act3Started: true, lurkerDefeated: true },
      { act3Started: true, lurkerDefeated: true, silverfinCaught: true },
      { act3Started: true, act3Complete: true }
    ];
    for (const zone of zones) {
      for (const flags of flagSets) {
        const text = objectiveFor(state(zone, flags));
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(40);
      }
    }
  });
});
