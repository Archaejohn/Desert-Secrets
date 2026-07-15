import type { DialogueScript } from "../dialogue";

/**
 * Arrival in the kelp forest — the main floe-hopping through-route. Orients
 * the player: stick to the bright floes, push east toward deep water. Linear;
 * the scene sets `sawKelpForest` on close so it plays once.
 */
export const kelpForestEntryScript: DialogueScript = {
  start: "kelp",
  nodes: [
    {
      id: "kelp",
      lines: [
        { speaker: "Slither", text: "The kelp forest. Ssstay to the bright floes." },
        { speaker: "Joseph", text: "Which way's the deep water?" },
        { speaker: "Slither", text: "Pussh east. The light givesss out that way." }
      ]
    }
  ]
};
