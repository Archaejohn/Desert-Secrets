import type { DialogueScript } from "../dialogue";

/**
 * Act 4, Zone 2 entry — the Camp proper. Arriving in Mo, Edda and Gus's actual
 * living space: string lights, the laundry line, the stove and rug. Grounds
 * the hub and points at what to do here (find the miners). The scene sets
 * `sawCamp` on close.
 */
export const campProperEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "The camp proper: stove, rug, a laundry line." },
        { speaker: "Joseph", text: "Mo? Edda? It's Joseph — from the ice." },
        { speaker: "Slither", text: "They made a home down here. Cosssy." },
        { speaker: "Joseph", text: "Let's find them. They know Piggy's game." },
      ],
    },
  ],
};
