import type { DialogueScript } from "../dialogue";

/**
 * The Act 1 cliffhanger — the aftershock, the ice wall, Piggy walking
 * toward it, the elevator sealing the way back, and the end card.
 * Empty speakers render as captions.
 */
export const cliffhangerScript: DialogueScript = {
  start: "aftershock",
  nodes: [
    {
      id: "aftershock",
      lines: [
        { speaker: "", text: "(An aftershock rips through the gallery.)" },
        { speaker: "", text: "(The far wall splits... and glows blue.)" },
      ],
      next: "ice",
    },
    {
      id: "ice",
      lines: [
        { speaker: "Joseph", text: "That's ice. A wall of it. Under the Mojave." },
        { speaker: "", text: "(Something vast hangs dark inside it.)" },
        { speaker: "Joseph", text: "The feather... it's pulsing in my pocket." },
      ],
      next: "piggy",
    },
    {
      id: "piggy",
      lines: [
        { speaker: "Piggy", text: "(He squirms free. Waddles TOWARD the ice.)" },
        { speaker: "Joseph", text: "Piggy, no— wait!" },
      ],
      next: "sealed",
    },
    {
      id: "sealed",
      lines: [
        { speaker: "", text: "(Behind them, the elevator crashes down.)" },
        { speaker: "Joseph", text: "...Okay. Guess we're going deeper." },
      ],
      next: "card",
    },
    {
      id: "card",
      lines: [
        { speaker: "", text: "END OF ACT 1" },
        { speaker: "", text: "ACT 2: THE ICE BELOW" },
      ],
    },
  ],
};
