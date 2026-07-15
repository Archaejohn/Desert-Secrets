import type { DialogueScript } from "../dialogue";

/**
 * Act 5 ending: the grove oranges are secured — the third of the four things
 * Piggy loves — and Fluffball now travels with the party. Ends on the Act 6
 * title card. Linear; the last two lines are the end card the scene renders.
 * Terminal id `end`.
 */
export const act5EndingScript: DialogueScript = {
  start: "end",
  nodes: [
    {
      id: "end",
      lines: [
        { speaker: "Joseph", text: "Oranges, socks, silverfin. Three of four." },
        { speaker: "Slither", text: "Jussst the seaweed left. The reef runs deep." },
        { speaker: "Fluffball", text: "I'll show you. I can talk to reef-folk." },
        { speaker: "", text: "Three things Piggy loves. One chase to go." },
        { speaker: "", text: "Fluffball rides in the pack now, pointing on." },
        { speaker: "", text: "END OF ACT 5" },
        { speaker: "", text: "ACT 6: THE REEF" },
      ],
    },
  ],
};
