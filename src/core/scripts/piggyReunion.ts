import type { DialogueScript } from "../dialogue";

/**
 * The catch — deliberately NOT a chase. Once the pizza exists, the smell
 * travels the tunnels and Piggy arrives at a waddling sprint on his own.
 * Fluffball vouches for Joseph; Piggy is gently caught, mid-bite. This is the
 * warm reunion payoff of every near-catch that came before it — a homecoming,
 * not a capture or a contest. Terminal id `end`.
 */
export const piggyReunionScript: DialogueScript = {
  start: "smell",
  nodes: [
    {
      id: "smell",
      lines: [
        { speaker: "", text: "The smell rolls out through the tunnels." },
        { speaker: "", text: "Small feet. A waddling sprint, closer..." },
        { speaker: "Piggy", text: "(He bursts in, nose-first. Straight to it.)" },
      ],
      next: "vouch",
    },
    {
      id: "vouch",
      lines: [
        { speaker: "Fluffball", text: "It's okay! Joseph's a friend. He HELPED." },
        { speaker: "", text: "Piggy pauses. Sniffs Joseph. Decides." },
        { speaker: "", text: "He climbs up, mid-bite, into your arms." },
      ],
      next: "held",
    },
    {
      id: "held",
      lines: [
        { speaker: "Joseph", text: "...Got you. I've got you, little guy." },
        { speaker: "Slither", text: "All that chasing. He jussst... came." },
      ],
    },
  ],
};
