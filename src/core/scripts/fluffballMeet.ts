import type { DialogueScript } from "../dialogue";

/**
 * Fluffball, glimpsed: cornered once in a dead-end kelp bed, the gray chick
 * blurts exactly ONE line — the silverfin clue — then bolts. He does not
 * join here (that's Act 5). The scene sets `metFluffball` on close so it
 * never repeats.
 */
export const fluffballMeetScript: DialogueScript = {
  start: "meet",
  nodes: [
    {
      id: "meet",
      lines: [
        { speaker: "", text: "In a dead-end kelp bed, a gray chick freezes." },
        { speaker: "Fluffball", text: "...Silverfin. Piggy only comes for silverfin." },
        { speaker: "", text: "Deepest beds. Past where the light gives out." },
        { speaker: "", text: "Then he bolts — a gray blur into the dark." },
        { speaker: "Slither", text: "Sssilverfin. Noted. Shy as a shadow, that one." }
      ]
    }
  ]
};
