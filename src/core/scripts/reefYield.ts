import type { DialogueScript } from "../dialogue";

/**
 * Act 6 — the fallback resolution AFTER the avoidable fight. If a bad approach
 * in `reefParley` called a reef stalker down and the party won the battle
 * (`reefFought`), the crawlers — territorial, never truly hostile — relent:
 * the party proved no threat to the garden, the predator's gone, and Fluffball
 * smooths it over. They give up the mint kelp anyway, a peace made late. The
 * scene reads this script's close and hands over the seaweed exactly like the
 * peaceful `trade-end` path, then rolls the ending. Terminal id `yield`.
 */
export const reefYieldScript: DialogueScript = {
  start: "yield",
  nodes: [
    {
      id: "yield",
      lines: [
        { speaker: "", text: "The hunter's driven off. The crawler stills." },
        { speaker: "Fluffball", text: "They're... impressed. And sorry they spooked." },
        { speaker: "Slither", text: "No hard feelingsss. We only wanted the kelp." },
        { speaker: "Crawler", text: "(it clips a mint bundle, offers it — a truce)" },
        { speaker: "Fluffball", text: "For the cold one, they say. Take it. Go well." },
        { speaker: "", text: "The crawlers yield the mint kelp. Peace, late." },
      ],
    },
  ],
};
