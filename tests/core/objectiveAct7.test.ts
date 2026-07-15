import { describe, expect, it } from "vitest";
import { newGame, type Act1State, type ZoneId } from "../../src/core/gameState";
import { objectiveFor } from "../../src/core/objective";

/** Flags for a finished Act 1–6 (Act 6 hands off to Act 7). */
const done6 = {
  actComplete: true,
  act2Started: true,
  act2Complete: true,
  act3Started: true,
  act3Complete: true,
  act4Started: true,
  act4Complete: true,
  act5Started: true,
  act5Complete: true,
  act6Started: true,
  act6Complete: true
};

/** All four ingredients in hand (as they are on entering Act 7). */
const fourItems = { silverfin: true, stinkySocks: true, oranges: true, seaweed: true };

function state(zone: ZoneId, flags: Record<string, boolean> = {}): Act1State {
  const s = newGame();
  return {
    ...s,
    zone,
    items: { ...s.items, ...fourItems },
    flags: { ...s.flags, ...done6, ...flags }
  };
}

describe("objectiveFor — Act 7 chain (the finale)", () => {
  it("sends the party down to the pizzeria once act7Started, from an Act 6 zone", () => {
    expect(objectiveFor(state("reefCourt", { act7Started: true }))).toBe(
      "Descend, following the tomato-pie smell"
    );
  });

  it("orients the party in the warm descent on first arrival", () => {
    expect(objectiveFor(state("pizzaDescent", { act7Started: true }))).toBe(
      "Follow the smell of tomato pie down"
    );
  });

  it("gives each new zone its own grounded objective line", () => {
    expect(objectiveFor(state("pizzaVent", { act7Started: true }))).toBe("Cross the lava vents toward the glow");
    expect(objectiveFor(state("pizzaApproach", { act7Started: true }))).toBe("Through the temple's old kitchens");
    expect(objectiveFor(state("pizzaAscent", { act7Started: true }))).toBe("Climb back up toward the surface");
  });

  it("walks the pizzeria beats in order: meet, bake, wait, hear, then leave", () => {
    expect(objectiveFor(state("pizzeria", { act7Started: true }))).toBe("Find who's cooking down here");
    expect(objectiveFor(state("pizzeria", { act7Started: true, metTestudo: true }))).toBe(
      "Bake the pizza with Chef Testudo"
    );
    expect(objectiveFor(state("pizzeria", { act7Started: true, metTestudo: true, pizzaBaked: true }))).toBe(
      "The smell is out — wait for Piggy"
    );
    expect(
      objectiveFor(state("pizzeria", { act7Started: true, metTestudo: true, pizzaBaked: true, piggyCaught: true }))
    ).toBe("Hear Testudo's secret");
    expect(
      objectiveFor(
        state("pizzeria", {
          act7Started: true,
          metTestudo: true,
          pizzaBaked: true,
          piggyCaught: true,
          heardReveal: true
        })
      )
    ).toBe("Carry Piggy home — head back up");
  });

  it("keeps every Act 7 objective line within the 40-char HUD budget", () => {
    const zones: ZoneId[] = ["pizzaDescent", "pizzaVent", "pizzaApproach", "pizzeria", "pizzaAscent"];
    const variants: Array<Record<string, boolean>> = [
      {},
      { metTestudo: true },
      { metTestudo: true, pizzaBaked: true },
      { metTestudo: true, pizzaBaked: true, piggyCaught: true },
      { metTestudo: true, pizzaBaked: true, piggyCaught: true, heardReveal: true }
    ];
    for (const zone of zones) {
      for (const v of variants) {
        const line = objectiveFor(state(zone, { act7Started: true, ...v }));
        expect(line.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it("marks the finale (END OF PART ONE) from anywhere once act7Complete", () => {
    for (const zone of ["pizzaAscent", "pizzeria", "reefCourt", "crash"] as ZoneId[]) {
      expect(objectiveFor(state(zone, { act7Started: true, act7Complete: true }))).toBe("END OF PART ONE");
    }
  });
});
