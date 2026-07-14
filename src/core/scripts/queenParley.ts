import type { DialogueScript } from "../dialogue";

/**
 * Beat 5, parley route — offered only while the cold pack is held.
 * The mine trembles mid-negotiation; the scene starts the shorter
 * queenWeakened skirmish when the runner ends at "parley-end".
 */
export const queenParleyScript: DialogueScript = {
  start: "open",
  nodes: [
    {
      id: "open",
      lines: [
        { speaker: "Joseph", text: "Wait. Nobody has to get hurt today." },
        { speaker: "Joseph", text: "Your eggs need cold. I brought cold." },
      ],
      next: "offer",
    },
    {
      id: "offer",
      lines: [
        { speaker: "Joseph", text: "A cold pack. It holds till they hatch." },
        { speaker: "Dust Queen", text: "SMALL COLD. FOR ALL EGGS?" },
        { speaker: "Joseph", text: "Better than a fight. For both broods." },
      ],
      next: "tremble",
    },
    {
      id: "tremble",
      lines: [
        { speaker: "Dust Queen", text: "QUEEN CONSIDERS—" },
        { speaker: "", text: "(The mine shudders. Dust rains down.)" },
        { speaker: "Dust Queen", text: "TREMBLE WAKES BROOD. QUEEN CANNOT STOP—" },
      ],
      next: "parley-end",
    },
    {
      id: "parley-end",
      lines: [
        { speaker: "Joseph", text: "We'll shake on it after. Heads up!" },
      ],
    },
  ],
};
