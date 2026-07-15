import { describe, expect, it } from "vitest";
import { newGame, type Act1State, type ZoneId } from "../../src/core/gameState";
import { objectiveFor } from "../../src/core/objective";

/** Flags for a finished Act 1 + Act 2 + Act 3. */
const done3 = {
  actComplete: true,
  act2Started: true,
  wardenDefeated: true,
  act2Complete: true,
  act3Started: true,
  silverfinCaught: true,
  act3Complete: true,
};

function state(zone: ZoneId, flags: Record<string, boolean> = {}): Act1State {
  const s = newGame();
  return { ...s, zone, flags: { ...s.flags, ...done3, ...flags } };
}

describe("objectiveFor — Act 4 chain", () => {
  it("keeps 'Act 3 complete!' until the tunnels are climbed", () => {
    expect(objectiveFor(state("sunlessSea"))).toBe("Act 3 complete!");
  });

  it("sends the party up to the camp once act4Started, from an Act 3 zone", () => {
    expect(objectiveFor(state("sunlessSea", { act4Started: true }))).toBe("Head up to the miners' camp");
  });

  it("orients the party in the outskirts on first arrival", () => {
    expect(objectiveFor(state("minersCamp", { act4Started: true }))).toBe("Head into the miners' camp");
  });

  it("gives each new zone its own grounded objective line", () => {
    expect(objectiveFor(state("laundryNook", { act4Started: true }))).toBe("Clear the midden-mite nest");
    expect(objectiveFor(state("campGallery", { act4Started: true }))).toBe("Climb the gallery to the ledge");
    expect(objectiveFor(state("campLedge", { act4Started: true }))).toBe("Corner the chick on the ledge");
  });

  it("asks the player to clear the nook before the socks are earned (in the hub)", () => {
    expect(objectiveFor(state("campProper", { act4Started: true }))).toBe(
      "Clear the mites from the laundry nook",
    );
  });

  it("points at the sock line once the nook is cleared", () => {
    const s = state("campProper", { act4Started: true, middenCleared: true });
    expect(objectiveFor(s)).toBe("Take the ripe socks off the line");
  });

  it("celebrates once the stinky socks are in hand", () => {
    const s = state("campProper", { act4Started: true, middenCleared: true, gotSocks: true });
    expect(objectiveFor(s)).toBe("You have the stinky socks!");
  });

  it("marks Act 4 complete from anywhere once act4Complete", () => {
    for (const zone of ["campProper", "minersCamp", "campLedge", "sunlessSea", "crash"] as ZoneId[]) {
      expect(objectiveFor(state(zone, { act4Started: true, act4Complete: true }))).toBe("Act 4 complete!");
    }
  });

  it("keeps every Act 4 objective within 40 characters", () => {
    const flagSets: Array<Record<string, boolean>> = [
      { act4Started: true },
      { act4Started: true, middenCleared: true },
      { act4Started: true, middenCleared: true, gotSocks: true },
      { act4Started: true, act4Complete: true },
    ];
    const zones: ZoneId[] = [
      "sunlessSea",
      "minersCamp",
      "campProper",
      "laundryNook",
      "campGallery",
      "campLedge",
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
