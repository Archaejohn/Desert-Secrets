import type { DialogueScript } from "../dialogue";

/**
 * Act 7, Zone 3 entry beat (The Old Kitchens). The raw stone gives way to
 * something BUILT — carved steps, faded signage, the temple's old kitchens
 * repurposed. The threshold of the restaurant. Terminal id `end`.
 */
export const pizzaApproachEntryScript: DialogueScript = {
  start: "approach",
  nodes: [
    {
      id: "approach",
      lines: [
        { speaker: "", text: "The raw rock gives way to carved steps." },
        { speaker: "Joseph", text: "Someone BUILT this. A kitchen?" },
        { speaker: "Fluffball", text: "There's a sign. Too old to read." },
        { speaker: "Slither", text: "The temple's old kitchens. Ssstill warm." },
      ],
    },
  ],
};
