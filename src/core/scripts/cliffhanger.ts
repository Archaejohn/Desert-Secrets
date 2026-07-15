import type { DialogueScript } from "../dialogue";

/**
 * The Act 1 cliffhanger, split into four beats so DepthsScene can trigger
 * the actual visual reveal (the wall cracking to reveal glowing ice) and
 * Piggy's walk tween at the moments the dialogue describes them, instead
 * of both already having happened off-screen before the text opens. A
 * real playtester report: "it shows the ice the entire time [the dialogue
 * plays], but the description says the wall falls away exposing it."
 * Empty speakers render as captions.
 */

/** Beat 1 — just the rumble; the wall hasn't visibly changed yet. */
export const cliffhangerAftershockScript: DialogueScript = {
  start: "aftershock",
  nodes: [
    {
      id: "aftershock",
      lines: [{ speaker: "", text: "(An aftershock rips through the gallery.)" }],
    },
  ],
};

/**
 * Beat 2 — opened right after DepthsScene actually cracks the wall tile,
 * so "the far wall splits and glows blue" lands on what's on screen.
 */
export const cliffhangerIceRevealScript: DialogueScript = {
  start: "reveal",
  nodes: [
    {
      id: "reveal",
      lines: [
        { speaker: "", text: "(The far wall splits... and glows blue.)" },
        { speaker: "Joseph", text: "That's ice. A wall of it. Under the Mojave." },
        { speaker: "", text: "(Something vast hangs dark inside it.)" },
        { speaker: "Joseph", text: "The feather... it's pulsing in my pocket." },
      ],
    },
  ],
};

/** Beat 3 — opened right before Piggy's walk-to-the-ice tween starts. */
export const cliffhangerPiggyScript: DialogueScript = {
  start: "piggy",
  nodes: [
    {
      id: "piggy",
      lines: [
        { speaker: "Piggy", text: "(He squirms free. Waddles TOWARD the ice.)" },
        { speaker: "Joseph", text: "Piggy, no— wait!" },
      ],
    },
  ],
};

/** Beat 4 — the elevator seals the way back, then the end card. */
export const cliffhangerSealedScript: DialogueScript = {
  start: "sealed",
  nodes: [
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
