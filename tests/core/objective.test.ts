import { describe, expect, it } from "vitest";
import { newGame, type Act1State, type ZoneId } from "../../src/core/gameState";
import { objectiveFor } from "../../src/core/objective";

function state(zone: ZoneId, flags: Record<string, boolean> = {}): Act1State {
  const s = newGame();
  return { ...s, zone, flags: { ...s.flags, ...flags } };
}

describe("objectiveFor", () => {
  it("starts with Rosa", () => {
    expect(objectiveFor(state("crash"))).toMatch(/Rosa/);
  });

  it("points east after meeting Rosa", () => {
    expect(objectiveFor(state("crash", { metRosa: true }))).toMatch(/east/);
  });

  it("walks the quest chain in order", () => {
    const chain: Array<[Act1State, RegExp]> = [
      [state("oasis", { metRosa: true }), /keeper|oasis/i],
      [state("oasis", { metRosa: true, metSahra: true }), /scarab/i],
      [
        state("oasis", { metRosa: true, metSahra: true, tutorialBattleWon: true }),
        /trail|east/i
      ],
      [
        state("trail", { metRosa: true, metSahra: true, tutorialBattleWon: true }),
        /Last Chance|Fuel/i
      ],
      [
        state("trail", {
          metRosa: true,
          metSahra: true,
          tutorialBattleWon: true,
          metDusty: true,
          mineOpen: true
        }),
        /mine/i
      ],
      [
        state("mine", {
          metRosa: true,
          metSahra: true,
          tutorialBattleWon: true,
          metDusty: true,
          mineOpen: true
        }),
        /lever/i
      ],
      [
        state("mine", {
          metRosa: true,
          metSahra: true,
          tutorialBattleWon: true,
          metDusty: true,
          mineOpen: true,
          leverPulled: true
        }),
        /guardian|elevator/i
      ],
      [
        state("depths", {
          metRosa: true,
          metSahra: true,
          tutorialBattleWon: true,
          metDusty: true,
          mineOpen: true,
          leverPulled: true,
          foremanDefeated: true
        }),
        /Piggy/i
      ]
    ];
    for (const [s, pattern] of chain) {
      expect(objectiveFor(s)).toMatch(pattern);
    }
  });

  it("celebrates when the act is complete", () => {
    expect(objectiveFor(state("depths", { actComplete: true }))).toMatch(/complete/i);
  });

  it("always returns a short, non-empty string", () => {
    const zones: ZoneId[] = ["crash", "oasis", "trail", "mine", "depths"];
    for (const z of zones) {
      const text = objectiveFor(state(z));
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(40);
    }
  });
});
