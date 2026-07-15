import type { DialogueScript } from "../dialogue";

/**
 * Act 6, Zone 4 entry — The Glowing Hollow. A quiet, breather cavern past the
 * coral warren: dark reef silt lit only by bioluminescence, where the crawlers'
 * cultivated mint-kelp beds run down toward the elders who tend them. A beat to
 * let the tense chase settle before the diplomacy. Grounds the place and points
 * the party to the keepers of the kelp. The scene sets `sawReefHollow`. No
 * random encounters here.
 */
export const reefHollowEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "A still hollow, lit only by the kelp's own glow." },
        { speaker: "Fluffball", text: "The mint rows lead this way. To their keepers." },
        { speaker: "Slither", text: "No fighting here. We asssk. We trade. Agreed?" },
        { speaker: "Joseph", text: "Agreed. Fluffball vouches, you talk. Let's try." },
      ],
    },
  ],
};
