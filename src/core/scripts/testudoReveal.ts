import type { DialogueScript } from "../dialogue";

/**
 * The reveal — the ONE mystery that resolves in Act 7: the glacier / old-ocean
 * thread seeded since Act 1 (Rosa's frost that "isn't melting", the miners
 * smelling the sea, the Rime Warden, the flooded sun-temple). Testudo explains
 * it in full, but evocatively, not as a science lecture (per the design brief:
 * "the ice remembers... it wanted to go home").
 *
 * IMPORTANT: this reveal must NOT reference, explain, or hint at the
 * scarab/mystery-bug thread — that stays completely unresolved (CLAUDE.md).
 * The two mysteries are kept separate; only the ice/ocean one resolves here.
 * Terminal id `end`.
 */
export const testudoRevealScript: DialogueScript = {
  start: "ask",
  nodes: [
    {
      id: "ask",
      lines: [
        { speaker: "Testudo", text: "You want to know about the ice." },
        { speaker: "Testudo", text: "It's the last of the old ocean. Asleep" },
        { speaker: "Testudo", text: "under the sand, long as the sand's been." },
      ],
      next: "waking",
    },
    {
      id: "waking",
      lines: [
        { speaker: "Testudo", text: "It started waking the night he fell in." },
        { speaker: "Joseph", text: "Piggy's frost. It was never a fluke." },
        { speaker: "Testudo", text: "No. His kind were the old sea's darlings." },
      ],
      next: "home",
    },
    {
      id: "home",
      lines: [
        { speaker: "Testudo", text: "The ice remembers. It followed the boy." },
        { speaker: "Testudo", text: "It wanted to go home. That's all it is." },
        { speaker: "Slither", text: "...Home. All of thisss, to go home." },
      ],
    },
  ],
};
