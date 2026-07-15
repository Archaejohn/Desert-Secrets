import type { DialogueScript } from "../dialogue";

/**
 * Arrival in the flooded ancient ruins (a dead-end pocket). A short orient
 * before the player explores in to the carved glyph. Linear; the scene
 * sets `sawTempleEntry` on close so it plays once.
 */
export const sunTempleEntryScript: DialogueScript = {
  start: "ruin",
  nodes: [
    {
      id: "ruin",
      lines: [
        { speaker: "", text: "Drowned halls open ahead. Pillars, silt, dark." },
        { speaker: "Slither", text: "Sssomething old sssank here. Look around." }
      ]
    }
  ]
};
