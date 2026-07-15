import type { DialogueScript } from "../dialogue";

/**
 * Act 5, Zone 5 entry — Sahra's Grove. The sunniest corner of the chamber,
 * just past the great tree: a tended little camp and the grove's oldest row of
 * oranges, kept for decades by the woman who found the cave-in. Grounds the
 * place and who the party is about to meet. The scene sets `sawSahraGrove`;
 * Sahra's reactive trade (and the act's end) plays here.
 */
export const sahraGroveEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "Past the tree, someone has made a home." },
        { speaker: "", text: "Drying racks, a cook-fire, oranges in neat rows." },
        { speaker: "Fluffball", text: "This is it. The oldest row. She grows them." },
        { speaker: "Joseph", text: "Someone's tended this for years. Say hello?" },
      ],
    },
  ],
};
