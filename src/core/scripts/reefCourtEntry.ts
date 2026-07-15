import type { DialogueScript } from "../dialogue";

/**
 * Act 6, Zone 5 entry — The Crawler Court. The heart of the garden, where the
 * crawler elders keep the oldest mint-kelp row. This is the diplomacy zone:
 * getting the seaweed is a TRADE, not a fight (see reefParley). Grounds the
 * place and the stakes — a good approach trades peacefully, a bad one calls a
 * predator down. The scene sets `sawReefCourt`.
 */
export const reefCourtEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "The court: crawlers ringed round the oldest row." },
        { speaker: "Fluffball", text: "This is it. Their elders. Their best mint kelp." },
        { speaker: "Slither", text: "Manners now. One wrong word and this goesss bad." },
        { speaker: "Joseph", text: "Then we do it right. Fluffball — speak for us." },
      ],
    },
  ],
};
