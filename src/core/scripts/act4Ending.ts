import type { DialogueScript } from "../dialogue";

/**
 * Act 4 ending: the stinky socks are secured — the second of the four
 * things Piggy loves. Ends on the Act 5 title card. Linear; the last two
 * lines are the end card the scene renders. Terminal id `end`.
 */
export const act4EndingScript: DialogueScript = {
  start: "end",
  nodes: [
    {
      id: "end",
      lines: [
        { speaker: "Joseph", text: "Socks, silverfin... two down, two to go." },
        { speaker: "Slither", text: "Ssseaweed and oranges sstill to find." },
        { speaker: "", text: "Two of four things Piggy loves. Halfway." },
        { speaker: "", text: "Sahra's grove waits, deeper in the stone." },
        { speaker: "", text: "END OF ACT 4" },
        { speaker: "", text: "ACT 5: THE SUNLIT CAVE-IN" },
      ],
    },
  ],
};
