import type { DialogueScript } from "../dialogue";

/**
 * Act 6, Zone 1 entry — The Drowned Stair. From Sahra's warm grove the party
 * pushes deeper than Act 2's galleries ever went, down a flooded stair into
 * cold water again — the crystal-crawlers' actual home, only ever glimpsed
 * before. Grounds the return underwater and points on into their garden. The
 * scene sets `sawReefDescent`. No random encounters here.
 */
export const reefDescentEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "The stair floods out below. Cold water again." },
        { speaker: "Joseph", text: "Deeper than the galleries. Nobody's been here." },
        { speaker: "Slither", text: "The crawlersss' home. We're guests now. Sss." },
        { speaker: "Fluffball", text: "Careful. This is THEIRS. Let me do the talking." },
      ],
    },
  ],
};
