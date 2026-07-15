import type { DialogueScript } from "../dialogue";

/**
 * Act 3 ending: the silverfin is caught — one of the four things Piggy
 * loves. Ends on the Act 4 title card. Linear; the last two lines are the
 * end card the scene renders. Terminal id `end`.
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
        { speaker: "", text: "Somewhere above, the miners' camp waits." },
        { speaker: "", text: "END OF ACT 3" },
        { speaker: "", text: "ACT 4: THE MINERS' CAMP" }
      ]
    }
  ]
};
