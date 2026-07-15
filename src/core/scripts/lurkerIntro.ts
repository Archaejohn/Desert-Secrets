import type { DialogueScript } from "../dialogue";

/**
 * The Lurker steals the lure: two lines before the mini-boss battle at the
 * fishing spot. The scene fights `["lurker"]` after this closes.
 */
export const lurkerIntroScript: DialogueScript = {
  start: "lurk",
  nodes: [
    {
      id: "lurk",
      lines: [
        { speaker: "", text: "Something huge takes the lure and dives!" },
        { speaker: "Slither", text: "That's no sssilverfin. Brace yourself!" }
      ]
    }
  ]
};
