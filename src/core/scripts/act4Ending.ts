import type { DialogueScript } from "../dialogue";

/**
 * Act 4 ending: the stinky socks are secured — the second of the four things
 * Piggy loves. Unlike the shipped single-zone act, this no longer prints an
 * end card; the party then descends deeper into the stone (the Act 4 → Act 5
 * hand-off, `campProper` → `groveDescent`), toward Sahra's buried grove.
 * Linear; terminal id `end`.
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
        { speaker: "Slither", text: "There's warm air from below. Down we go. Sss." }
      ]
    }
  ]
};
