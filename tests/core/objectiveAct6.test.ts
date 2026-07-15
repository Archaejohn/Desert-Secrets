import { describe, expect, it } from "vitest";
import { newGame, type Act1State, type ZoneId } from "../../src/core/gameState";
import { objectiveFor } from "../../src/core/objective";

/** Flags for a finished Act 1–5 (Act 5 hands off to Act 6). */
const done5 = {
  actComplete: true,
  act2Started: true,
  act2Complete: true,
  act3Started: true,
  act3Complete: true,
  act4Started: true,
  act4Complete: true,
  act5Started: true,
  act5Complete: true
};

function state(zone: ZoneId, flags: Record<string, boolean> = {}): Act1State {
  const s = newGame();
  return { ...s, zone, flags: { ...s.flags, ...done5, ...flags } };
}

describe("objectiveFor — Act 6 chain", () => {
  it("sends the party down to the reef once act6Started, from an Act 5 zone", () => {
    expect(objectiveFor(state("sahraGrove", { act6Started: true }))).toBe(
      "Descend into the drowned reef"
    );
  });

  it("orients the party in the drowned stair on first arrival", () => {
    expect(objectiveFor(state("reefDescent", { act6Started: true }))).toBe(
      "Follow the flooded stair down"
    );
  });

  it("gives each new zone its own grounded objective line", () => {
    expect(objectiveFor(state("reefGarden", { act6Started: true }))).toBe("Cross the crawlers' kelp garden");
    expect(objectiveFor(state("reefWarren", { act6Started: true }))).toBe("Corner Piggy in the coral warren");
    expect(objectiveFor(state("reefHollow", { act6Started: true }))).toBe("Follow the mint kelp to its keepers");
    expect(objectiveFor(state("reefCourt", { act6Started: true }))).toBe("Broker a trade for the mint kelp");
  });

  it("advances the warren objective after the tense chase-and-turn plays", () => {
    expect(objectiveFor(state("reefWarren", { act6Started: true, sawReefChase: true }))).toBe(
      "Press on, deeper into the reef"
    );
  });

  it("points the court to a peaceful trade, or peace after an avoidable fight", () => {
    expect(objectiveFor(state("reefCourt", { act6Started: true }))).toBe("Broker a trade for the mint kelp");
    expect(objectiveFor(state("reefCourt", { act6Started: true, reefFought: true }))).toBe(
      "Make peace — take the mint kelp"
    );
  });

  it("celebrates once the reef's mint kelp is in hand", () => {
    const s = state("reefCourt", { act6Started: true, gotSeaweed: true });
    expect(objectiveFor(s)).toBe("You have the reef's mint kelp!");
  });

  it("keeps every Act 6 objective line within the 40-char HUD budget", () => {
    const zones: ZoneId[] = ["reefDescent", "reefGarden", "reefWarren", "reefHollow", "reefCourt"];
    const variants: Array<Record<string, boolean>> = [
      {},
      { sawReefChase: true },
      { reefFought: true },
      { gotSeaweed: true }
    ];
    for (const zone of zones) {
      for (const v of variants) {
        const line = objectiveFor(state(zone, { act6Started: true, ...v }));
        expect(line.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it("marks Act 6 complete from anywhere once act6Complete", () => {
    for (const zone of ["reefCourt", "reefGarden", "sahraGrove", "crash"] as ZoneId[]) {
      expect(objectiveFor(state(zone, { act6Started: true, act6Complete: true }))).toBe("Act 6 complete!");
    }
  });
});
