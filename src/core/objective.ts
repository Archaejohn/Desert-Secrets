/**
 * Current quest objective, derived from run state. Shown in the HUD so
 * the player always knows where to go next.
 */
import type { Act1State } from "./gameState";

export function objectiveFor(s: Act1State): string {
  const f = s.flags;
  if (f.actComplete) return act2ObjectiveFor(s);
  if (!f.metRosa) return "Talk to Rosa by the truck";
  if (s.zone === "crash") return "Follow the frost trail east";
  if (!f.metParents) return "Find your parents at the oasis";
  if (!f.tutorialBattleWon) return "Fight off the scarab!";
  if (s.zone === "oasis") return "Follow Piggy's trail east";
  if (!f.mineOpen) {
    return f.metDusty ? "Head to the mine (northeast)" : "Ask around at Last Chance Fuel";
  }
  if (s.zone === "trail") return "Enter the mine to the northeast";
  if (!f.leverPulled && s.zone === "mine") return "Find the lever that opens the gate";
  if (!f.foremanDefeated && s.zone === "mine") return "Reach the elevator, past its guardian";
  if (s.zone === "mine") return "Take the elevator down";
  if (!f.queenResolved) return "Find Piggy in the cold below";
  return "Piggy needs you";
}

/** The Act 2 chain, once actComplete is set. Every string ≤ 40 chars. */
function act2ObjectiveFor(s: Act1State): string {
  const f = s.flags;
  if (f.act2Complete) return "Act 2 complete!";
  if (!f.act2Started) return "Descend through the ice";
  if (s.zone === "crevasse") return "Find a way through the ice maze";
  if (s.zone === "maze") {
    return f.mazeShortcutOpen
      ? "Push on to the galleries"
      : "Find a way through the ice maze";
  }
  if (s.zone === "galleries") {
    return f.rimeDoorOpen ? "Enter the sanctum" : "Open the rime door";
  }
  if (s.zone === "sanctum") {
    return f.wardenDefeated ? "Follow the penguins!" : "Cross the frozen lake";
  }
  // Still in an Act 1 zone after the hand-off: get down there.
  return "Descend through the ice";
}
