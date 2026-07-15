import type { DialogueScript } from "../dialogue";

/**
 * Act 6, Zone 2 entry — The Crawlers' Garden. Rows of glowing kelp, tended on
 * purpose: trellises, cleared beds, a bright cultivated crop set against the
 * tangled wild growth. Establishes the crawlers as territorial FARMERS, not
 * monsters — and that a predator hunts these rows (the reefstalker encounters).
 * Grounds the place. The scene sets `sawReefGarden`.
 */
export const reefGardenEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "Kelp in neat, glowing rows. Trellises. Tended." },
        { speaker: "Joseph", text: "This is a FARM. The crawlers grow it on purpose." },
        { speaker: "Fluffball", text: "They're not cruel. Just guarded. Their home." },
        { speaker: "Slither", text: "Sssomething big hunts these rows. Stay sharp." },
      ],
    },
  ],
};
