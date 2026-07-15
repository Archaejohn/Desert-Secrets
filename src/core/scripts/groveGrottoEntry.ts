import type { DialogueScript } from "../dialogue";

/**
 * Act 5, Zone 3 entry — The River Grotto. A short connecting cavern where an
 * underground river wells up out of the rock and runs on toward the light.
 * This is the same water table that feeds the oasis spring far above — the
 * thread that ties the whole underground together. Grounds the crossing and
 * points on toward the glow. The scene sets `sawGroveGrotto`. Quiet; no
 * encounters here.
 */
export const groveGrottoEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "Water. A whole river, welling up from the rock." },
        { speaker: "Joseph", text: "This is the oasis spring. It STARTS down here." },
        { speaker: "Slither", text: "It runs toward the light. So do we. Sss." },
        { speaker: "", text: "A gray shape keeps pace in the ferns behind you." },
      ],
    },
  ],
};
