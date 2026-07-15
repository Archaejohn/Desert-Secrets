import type { DialogueScript } from "../dialogue";

/**
 * Act 5, Zone 2 entry — The Grove Approach. Green begins here: moss on the
 * stone, ferns, a bright thicket of needle-cactus. Piggy beat them down and is
 * somewhere close, snacking. Grounds the place and the search. The scene sets
 * `sawGroveApproach`; the scared near-catch chase plays deeper in.
 */
export const groveApproachEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "Green. Moss on the stone, ferns, real leaves." },
        { speaker: "Slither", text: "Green, growing. Down here? Sss. Fed by what?" },
        { speaker: "Joseph", text: "Nibbled peel. Piggy's been through already." },
        { speaker: "Joseph", text: "Mind the needle-cactus. Let's find him." },
      ],
    },
  ],
};
