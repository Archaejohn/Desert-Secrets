import type { DialogueScript } from "../dialogue";

/**
 * The cast prompt at the silverfin fishing spot (after the Lurker is beaten
 * off). A choice hub: "Cast the line" opens the timing minigame (terminal
 * id `cast-end`), "Not yet" backs off (terminal id `leave-end`). The scene
 * branches on the terminal node id.
 */
export const fishingCastScript: DialogueScript = {
  start: "cast",
  nodes: [
    {
      id: "cast",
      lines: [{ speaker: "Joseph", text: "The deepest bed. Silverfin water. Cast?" }],
      choices: [
        { text: "Cast the line", next: "cast-end" },
        { text: "Not yet", next: "leave-end" }
      ]
    },
    {
      id: "cast-end",
      lines: [{ speaker: "", text: "You bait the hook and cast into the dark." }]
    },
    {
      id: "leave-end",
      lines: [{ speaker: "", text: "You reel the line back in." }]
    }
  ]
};
