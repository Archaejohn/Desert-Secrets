import type { DialogueScript } from "../dialogue";

/**
 * Act 6 — the trade-not-a-fight diplomacy, the act's new mechanic. Modelled on
 * Act 1's Dust Queen branch point (queenParley/queenFight): a dialogue-driven
 * choice gates which path plays. Here Slither NEGOTIATES and Fluffball
 * TRANSLATES/VOUCHES (the first payoff of his stated knack for "getting through
 * to reef life a little") — the crawlers are territorial but NOT hostile, so a
 * good approach earns a peaceful trade for the mint kelp, and only a bad
 * approach turns it into an AVOIDABLE fight (not an instant one).
 *
 * Two decision points; ANY wrong pick routes to the terminal node `affront`
 * (the scene reads that and starts a reefstalker BattleScene). Both good picks
 * reach the terminal node `trade-end` (the scene reads that and hands over the
 * seaweed, then rolls the ending). The scene branches on the end-node id
 * exactly as DepthsScene branches on `parley-end`.
 */
export const reefParleyScript: DialogueScript = {
  start: "meet",
  nodes: [
    {
      id: "meet",
      lines: [
        { speaker: "", text: "A big crawler blocks the kelp rows. Wary." },
        { speaker: "Fluffball", text: "Easy. Let me talk to them. I can, a little." },
        { speaker: "Crawler", text: "(a rattle of claws — keep back, land-things)" },
        { speaker: "Slither", text: "Sssteady. We come to asssk, not to take." },
      ],
      choices: [
        { text: "Let Slither and Fluffball speak for us.", next: "offer" },
        { text: "Just grab a frond and go.", next: "affront" },
      ],
    },
    {
      id: "offer",
      lines: [
        { speaker: "Fluffball", text: "They FARM this. The mint rows are theirs." },
        { speaker: "Slither", text: "We'd trade fair. A bright ssstone, for kelp." },
        { speaker: "Crawler", text: "(the claws lower — it is listening now)" },
      ],
      choices: [
        { text: "Offer the shiny stone, and ask politely.", next: "trade-end" },
        { text: "Snatch a handful while it's calm.", next: "affront" },
      ],
    },
    {
      id: "affront",
      lines: [
        { speaker: "Crawler", text: "(it rears — the rows are NOT for taking)" },
        { speaker: "Fluffball", text: "No — wait — they're calling a hunter!" },
        { speaker: "", text: "A reef stalker knifes out of the dark kelp." },
      ],
    },
    {
      id: "trade-end",
      lines: [
        { speaker: "Slither", text: "Here. A ssstone from the deep ice, for you." },
        { speaker: "Crawler", text: "(it takes the stone — and cuts you a bundle)" },
        { speaker: "Fluffball", text: "They say: for the little cold one. Go well." },
        { speaker: "", text: "The crawlers press mint kelp into your arms." },
      ],
    },
  ],
};
