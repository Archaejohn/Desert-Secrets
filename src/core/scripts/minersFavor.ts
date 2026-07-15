import type { DialogueScript } from "../dialogue";

/**
 * Act 4 favor-quest hook: Mo, Edda and Gus — rescued in Act 2, now living
 * in this scrappy gallery camp — will trade Piggy's beloved ripe socks,
 * but only once a nest of midden mites is cleared out of the laundry nook.
 * The scene shows this when the player talks to a miner before the nest is
 * dealt with; the nook's own nest is the real quest gate.
 */
export const minersFavorScript: DialogueScript = {
  start: "favor",
  nodes: [
    {
      id: "favor",
      lines: [
        { speaker: "Mo", text: "Joseph! And you found our Piggy problem." },
        { speaker: "Edda", text: "He raids us blind. Wants the sock line." },
        { speaker: "Gus", text: "You can have the ripe ones. One catch." },
        { speaker: "Mo", text: "Midden mites. A nest in the laundry nook." },
        { speaker: "Edda", text: "Clear them out and the socks are yours." },
        { speaker: "Slither", text: "A nest? Sssounds like our kind of chore." },
      ],
    },
  ],
};
