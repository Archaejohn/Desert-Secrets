import type { DialogueScript } from "../dialogue";

/**
 * Act 5 ending: the grove oranges are secured — the third of the four things
 * Piggy loves — and Fluffball now travels with the party. This no longer ends
 * on a title card: the grove HANDS OFF into Act 6 (a real zone), so — like
 * `act3Ending`/`act4Ending` before it — its terminal card lines are gone and it
 * points the party on, down, back to cold water. Terminal id `end`.
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
        { speaker: "", text: "The way down leads back to cold water." },
      ],
    },
  ],
};
