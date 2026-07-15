import type { DialogueScript } from "../dialogue";

/**
 * Arrival in the glimmering kelp bed where Fluffball is cornered (a dead-end
 * pocket). A short orient before the glimpse-and-clue fires deeper in.
 * Linear; the scene sets `sawFluffbed` on close so it plays once.
 */
export const fluffballBedEntryScript: DialogueScript = {
  start: "bed",
  nodes: [
    {
      id: "bed",
      lines: [
        { speaker: "", text: "A glimmering kelp bed. Something small stirs." },
        { speaker: "Slither", text: "Sssoftly now. Don't ssspook it." }
      ]
    }
  ]
};
