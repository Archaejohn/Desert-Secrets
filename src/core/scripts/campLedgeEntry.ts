import type { DialogueScript } from "../dialogue";

/**
 * Act 4, Zone 5 entry — the Overlook Ledge. Cresting the gallery onto a small
 * vantage above the camp's lights. Grounds the pocket and cues the glimpse to
 * come (the gray shape on the high side). The scene sets `sawLedge` on close.
 */
export const campLedgeEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "The ledge. String lights glow far below." },
        { speaker: "Joseph", text: "There — on the high side. A gray shape." },
        { speaker: "Slither", text: "Ssoftly. Don't ssspook the little thing." },
      ],
    },
  ],
};
