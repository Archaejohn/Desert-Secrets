import type { DialogueScript } from "../dialogue";

/**
 * The Act 2 ending — the lake ice cracks in a line, TWO penguin
 * silhouettes skitter across and dive into a far tunnel, and the end
 * card sends us to Act 3. Empty speakers render as captions.
 */
export const act2EndingScript: DialogueScript = {
  start: "crack",
  nodes: [
    {
      id: "crack",
      lines: [
        { speaker: "", text: "(The lake groans. A crack races across.)" },
        { speaker: "Joseph", text: "The whole lake is letting go—" },
        { speaker: "Slither", text: "Off the icsse! OFF THE ICSSE!" },
      ],
      next: "silhouettes",
    },
    {
      id: "silhouettes",
      lines: [
        { speaker: "", text: "(Two small shapes skitter over the ice.)" },
        { speaker: "Joseph", text: "Piggy! Piggy, wait— who is THAT?" },
        { speaker: "", text: "(A second penguin. Round. Gray. Fluffy.)" },
        { speaker: "Slither", text: "...Two? There are TWO?" },
      ],
      next: "dive",
    },
    {
      id: "dive",
      lines: [
        { speaker: "", text: "(They dive into a far tunnel, together.)" },
        { speaker: "Joseph", text: "He isn't lost. He's got a friend." },
        { speaker: "Slither", text: "And we have a very long sssswim." },
      ],
      next: "card",
    },
    {
      id: "card",
      lines: [
        { speaker: "", text: "END OF ACT 2" },
        { speaker: "", text: "ACT 3: THE SUNLESS SEA" },
      ],
    },
  ],
};
