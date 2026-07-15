import type { DialogueScript } from "../dialogue";

/**
 * Act 4 payoff: with the nest cleared, the miners hand over the ripest,
 * reekiest socks in camp. The scene sets `gotSocks` + `items.stinkySocks`
 * on close, then rolls the ending. Linear.
 */
export const minersRewardScript: DialogueScript = {
  start: "reward",
  nodes: [
    {
      id: "reward",
      lines: [
        { speaker: "Mo", text: "Nook's clear! Never seen mites scatter so." },
        { speaker: "Gus", text: "A deal's a deal. The ripest of the ripe." },
        { speaker: "", text: "He hands you a knotted, reeking bundle." },
        { speaker: "Joseph", text: "That is... genuinely upsetting. Perfect." },
        { speaker: "Slither", text: "Keep them downwind of me. Pleassse." },
      ],
    },
  ],
};
