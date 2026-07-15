import type { DialogueScript } from "../dialogue";

/**
 * Fluffball, glimpsed again: watching from a high ledge, still too shy to
 * come down. He blurts exactly ONE line — clue #2, the RIPEST socks in
 * camp, not just any socks — then vanishes. He does not join here (that's
 * Act 5). The scene sets `fluffballLedge` on close so it never repeats.
 */
export const fluffballLedgeScript: DialogueScript = {
  start: "ledge",
  nodes: [
    {
      id: "ledge",
      lines: [
        { speaker: "", text: "On a high ledge, the gray chick watches." },
        { speaker: "Fluffball", text: "The RIPEST socks. Not just any socks." },
        { speaker: "", text: "Piggy won't come for less. Then he's gone." },
        { speaker: "Slither", text: "Ssspoken and vanished. Ssshy little thing." },
      ],
    },
  ],
};
