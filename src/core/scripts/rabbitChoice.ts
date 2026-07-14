import type { DialogueScript } from "../dialogue";

/**
 * Beat 3 — the jackrabbit that stole the second ice chip. The scene
 * hides the "Trade the cold pack" choice when the cold pack isn't held,
 * and branches on which terminal node the runner ended in:
 * "fight-end" starts the battle, "trade-end" spends the cold pack.
 */
export const rabbitChoiceScript: DialogueScript = {
  start: "spot",
  nodes: [
    {
      id: "spot",
      lines: [
        { speaker: "Joseph", text: "Hey— that jackrabbit has the ice chip!" },
        { speaker: "Jackrabbit", text: "(It freezes. Ears up. Chip in its teeth.)" },
      ],
      next: "decide",
    },
    {
      id: "decide",
      lines: [
        { speaker: "Joseph", text: "It's fast. And it's watching me." },
      ],
      choices: [
        { text: "Chase it down", next: "fight-end" },
        { text: "Trade the cold pack", next: "trade-end" },
      ],
    },
    {
      id: "fight-end",
      lines: [
        { speaker: "Joseph", text: "Sorry, friend. I need that more than you." },
        { speaker: "Jackrabbit", text: "(It thumps the sand. Challenge accepted.)" },
      ],
    },
    {
      id: "trade-end",
      lines: [
        { speaker: "Joseph", text: "Easy now. Cold for cold. Fair trade?" },
        { speaker: "Jackrabbit", text: "(It swaps chip for pack, and bolts.)" },
        { speaker: "Joseph", text: "...Piggy needed that. Hope you did too." },
      ],
    },
  ],
};
