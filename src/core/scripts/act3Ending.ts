import type { DialogueScript } from "../dialogue";

/**
 * Act 3 catch beat: the silverfin is landed — one of the four things Piggy
 * loves. Unlike the shipped single-zone act, this no longer prints an end
 * card; the party then climbs out of the sea (the ascent zone), whose top
 * gate hands off to Act 4. Linear; terminal id `end`.
 */
export const act3EndingScript: DialogueScript = {
  start: "end",
  nodes: [
    {
      id: "end",
      lines: [
        { speaker: "Joseph", text: "Got it. Real silverfin, from the deep bed." },
        { speaker: "Slither", text: "Piggy won't be able to resssist that." },
        { speaker: "", text: "One of four things Piggy loves. Three to go." },
        { speaker: "Slither", text: "Now — up, out of the sssea. Find the way." }
      ]
    }
  ]
};
