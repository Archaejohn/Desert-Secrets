import type { DialogueScript } from "../dialogue";

/**
 * Act 6, Zone 3 entry — The Coral Warren. A twisting maze of coral and dead-end
 * pockets where the party finally runs Piggy down for real. Grounds the tight,
 * closing-in feel before the tense near-catch that plays deeper in. The scene
 * sets `sawReefWarren`; the chase-and-turn beat (`reefChase`) fires within.
 */
export const reefWarrenEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "The kelp gives way to a maze of coral walls." },
        { speaker: "Fluffball", text: "There. Little tracks in the silt — it's Piggy." },
        { speaker: "Joseph", text: "Dead ends everywhere. He's got nowhere to run." },
        { speaker: "Slither", text: "Gently now. Corner him ssslow. Don't spook." },
      ],
    },
  ],
};
