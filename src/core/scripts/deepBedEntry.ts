import type { DialogueScript } from "../dialogue";

/**
 * Arrival in the deep kelp bed — the climax zone, past where the light gives
 * out, where the silverfin runs. Orients the player toward the fishing spot.
 * Linear; the scene sets `sawDeepBed` on close so it plays once.
 */
export const deepBedEntryScript: DialogueScript = {
  start: "deep",
  nodes: [
    {
      id: "deep",
      lines: [
        { speaker: "", text: "Past where the light gives out. Silverfin water." },
        { speaker: "Slither", text: "Deep and cold. Thisss is the place." }
      ]
    }
  ]
};
