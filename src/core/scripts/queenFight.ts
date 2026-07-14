import type { DialogueScript } from "../dialogue";

/**
 * Beat 5, fight route — the Dust Queen stands over her clutch. She is
 * not a villain: Piggy's frost is keeping her eggs alive. The boss
 * battle starts when this script ends.
 */
export const queenFightScript: DialogueScript = {
  start: "gallery",
  nodes: [
    {
      id: "gallery",
      lines: [
        { speaker: "Joseph", text: "Piggy! There, by the spring— he's okay." },
        { speaker: "Joseph", text: "Eggs. Hundreds. Packed around his frost." },
      ],
      next: "queen",
    },
    {
      id: "queen",
      lines: [
        { speaker: "Dust Queen", text: "COLD ONE STAYS. BROOD LIVES." },
        { speaker: "Joseph", text: "He's a baby. He doesn't belong down here." },
        { speaker: "Dust Queen", text: "BROOD IS BABIES TOO. HEAT KILLS EGGS." },
        { speaker: "Joseph", text: "...I'm taking him home. I'm sorry." },
      ],
      next: "end",
    },
    {
      id: "end",
      lines: [
        { speaker: "Dust Queen", text: "THEN THE QUEEN IS SORRY ALSO." },
      ],
    },
  ],
};
