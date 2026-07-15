import { describe, expect, it } from "vitest";
import { newGame, type Act1State, type ZoneId } from "../../src/core/gameState";
import { objectiveFor } from "../../src/core/objective";

/** Flags for a finished Act 1 + Act 2 + Act 3 + Act 4 (Act 4 hands off to 5). */
const done4 = {
  actComplete: true,
  act2Started: true,
  wardenDefeated: true,
  act2Complete: true,
  act3Started: true,
  silverfinCaught: true,
  act3Complete: true,
  act4Started: true,
  gotSocks: true,
  act4Complete: true
};

function state(zone: ZoneId, flags: Record<string, boolean> = {}): Act1State {
  const s = newGame();
  return { ...s, zone, flags: { ...s.flags, ...done4, ...flags } };
}

describe("objectiveFor — Act 5 chain", () => {
  it("sends the party down to the grove once act5Started, from an Act 4 zone", () => {
    expect(objectiveFor(state("campProper", { act5Started: true }))).toBe(
      "Descend toward the buried grove"
    );
  });

  it("orients the party in the warm descent on first arrival", () => {
    expect(objectiveFor(state("groveDescent", { act5Started: true }))).toBe(
      "Follow the warmth toward the light"
    );
  });

  it("gives each new zone its own grounded objective line", () => {
    expect(objectiveFor(state("groveGrotto", { act5Started: true }))).toBe("Follow the river to the grove");
    expect(objectiveFor(state("groveApproach", { act5Started: true }))).toBe("Find Piggy near the grove");
    expect(objectiveFor(state("groveChamber", { act5Started: true }))).toBe("Reach the tree at the center");
    expect(objectiveFor(state("sahraGrove", { act5Started: true }))).toBe(
      "Trade Sahra your news for oranges"
    );
  });

  it("advances the approach objective after the scared chase plays", () => {
    expect(objectiveFor(state("groveApproach", { act5Started: true, sawGroveChase: true }))).toBe(
      "Press on into the grove"
    );
  });

  it("advances the chamber objective once Fluffball has joined", () => {
    expect(objectiveFor(state("groveChamber", { act5Started: true, fluffballJoined: true }))).toBe(
      "Find Sahra, keeper of the grove"
    );
  });

  it("celebrates once the grove oranges are in hand", () => {
    const s = state("sahraGrove", { act5Started: true, fluffballJoined: true, gotOranges: true });
    expect(objectiveFor(s)).toBe("You have the grove oranges!");
  });

  it("keeps every Act 5 objective line within the 40-char HUD budget", () => {
    const zones: ZoneId[] = ["groveDescent", "groveApproach", "groveGrotto", "groveChamber", "sahraGrove"];
    const variants: Array<Record<string, boolean>> = [
      {},
      { sawGroveChase: true },
      { fluffballJoined: true },
      { gotOranges: true }
    ];
    for (const zone of zones) {
      for (const v of variants) {
        const line = objectiveFor(state(zone, { act5Started: true, ...v }));
        expect(line.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it("marks Act 5 complete from anywhere once act5Complete", () => {
    for (const zone of ["sahraGrove", "groveChamber", "campProper", "sunlessSea", "crash"] as ZoneId[]) {
      expect(objectiveFor(state(zone, { act5Started: true, act5Complete: true }))).toBe("Act 5 complete!");
    }
  });
});
