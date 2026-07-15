import type { DialogueScript } from "../dialogue";

/**
 * The "reeks" comic reaction: once Joseph is carrying the stinky socks,
 * talking to a miner in camp gets a very different greeting than the calm
 * camp chatter. The scene swaps to this script whenever
 * `items.stinkySocks` is held — a concrete, held-item-dependent NPC line
 * change (Act 4's minimal "reeks" system).
 */
export const minersReekScript: DialogueScript = {
  start: "reek",
  nodes: [
    {
      id: "reek",
      lines: [
        { speaker: "Miner", text: "Gah— that SMELL. Piggy will adore it." },
        { speaker: "Miner", text: "Please. Stand downwind. Bless you. Go." },
      ],
    },
  ],
};
