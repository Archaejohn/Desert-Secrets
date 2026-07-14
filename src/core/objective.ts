/**
 * Current quest objective, derived from run state. Shown in the HUD so
 * the player always knows where to go next.
 */
import type { Act1State } from "./gameState";

export function objectiveFor(s: Act1State): string {
  const f = s.flags;
  if (f.actComplete) return "Act 1 complete!";
  if (!f.metRosa) return "Talk to Rosa by the truck";
  if (s.zone === "crash") return "Follow the frost trail east";
  if (!f.metSahra) return "Find the keeper of the oasis";
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
