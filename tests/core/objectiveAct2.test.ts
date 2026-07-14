import { describe, expect, it } from "vitest";
import { newGame, type Act1State, type ZoneId } from "../../src/core/gameState";
import { objectiveFor } from "../../src/core/objective";

function state(zone: ZoneId, flags: Record<string, boolean> = {}): Act1State {
  const s = newGame();
  return { ...s, zone, flags: { ...s.flags, ...flags } };
}

/** Flags for a finished Act 1. */
const done1 = { actComplete: true };

describe("objectiveFor — Act 2 chain", () => {
  it("points down through the ice once Act 1 completes", () => {
    expect(objectiveFor(state("depths", done1))).toBe("Descend through the ice");
  });

  it("keeps pointing down from any pre-descent zone", () => {
    for (const zone of ["crash", "oasis", "trail", "mine", "depths"] as ZoneId[]) {
      expect(objectiveFor(state(zone, done1))).toBe("Descend through the ice");
    }
  });

  it("asks for a way through the maze from the crevasse", () => {
    const s = state("crevasse", { ...done1, act2Started: true });
    expect(objectiveFor(s)).toBe("Find a way through the ice maze");
  });

  it("keeps the maze objective inside the maze until the shortcut opens", () => {
    const s = state("maze", { ...done1, act2Started: true });
    expect(objectiveFor(s)).toBe("Find a way through the ice maze");
  });

  it("pushes on to the galleries once the shortcut is open", () => {
    const s = state("maze", {
      ...done1,
      act2Started: true,
      metSlither: true,
      mazeShortcutOpen: true,
    });
    expect(objectiveFor(s)).toBe("Push on to the galleries");
  });

  it("targets the rime door in the galleries", () => {
    const s = state("galleries", { ...done1, act2Started: true });
    expect(objectiveFor(s)).toBe("Open the rime door");
  });

  it("sends the party into the sanctum once the door is open", () => {
    const s = state("galleries", {
      ...done1,
      act2Started: true,
      rimeDoorOpen: true,
      slitherJoined: true,
    });
    expect(objectiveFor(s)).toBe("Enter the sanctum");
  });

  it("points across the frozen lake at the Warden", () => {
    const s = state("sanctum", { ...done1, act2Started: true });
    expect(objectiveFor(s)).toBe("Cross the frozen lake");
  });

  it("follows the penguins after the Warden falls", () => {
    const s = state("sanctum", {
      ...done1,
      act2Started: true,
      wardenDefeated: true,
    });
    expect(objectiveFor(s)).toBe("Follow the penguins!");
  });

  it("celebrates when Act 2 is complete, from anywhere", () => {
    for (const zone of ["sanctum", "crash", "maze"] as ZoneId[]) {
      const s = state(zone, {
        ...done1,
        act2Started: true,
        wardenDefeated: true,
        act2Complete: true,
      });
      expect(objectiveFor(s)).toBe("Act 2 complete!");
    }
  });

  it("keeps every Act 2 objective within 40 characters", () => {
    const zones: ZoneId[] = ["crash", "depths", "crevasse", "maze", "galleries", "sanctum"];
    const flagSets: Array<Record<string, boolean>> = [
      {},
      { act2Started: true },
      { act2Started: true, mazeShortcutOpen: true },
      { act2Started: true, rimeDoorOpen: true },
      { act2Started: true, wardenDefeated: true },
      { act2Started: true, wardenDefeated: true, act2Complete: true },
    ];
    for (const zone of zones) {
      for (const flags of flagSets) {
        const text = objectiveFor(state(zone, { ...done1, ...flags }));
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it("leaves the Act 1 chain untouched while actComplete is false", () => {
    expect(objectiveFor(state("crash"))).toBe("Talk to Rosa by the truck");
    expect(objectiveFor(state("depths", { metRosa: true, metParents: true, tutorialBattleWon: true, metDusty: true, mineOpen: true, leverPulled: true, foremanDefeated: true }))).toBe(
      "Find Piggy in the cold below",
    );
  });
});
