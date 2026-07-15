import type { DialogueScript } from "../dialogue";

/**
 * Act 6 ending: the mint kelp is secured — the FOURTH and last of the things
 * Piggy loves. With fish, socks, oranges and now seaweed all in hand, the
 * party can finally cook the thing that draws him in. Points the party ON,
 * down toward Act 7 (La Pizzeria Sotterranea, the Act 2 tomato-pie seed paid
 * off) — a real zone hand-off now, not an end card (de-carded like
 * act3/4/5Ending when their placeholders became real hand-offs). Terminal id
 * `end`.
 */
export const act6EndingScript: DialogueScript = {
  start: "end",
  nodes: [
    {
      id: "end",
      lines: [
        { speaker: "Joseph", text: "Silverfin, socks, oranges, seaweed. All four." },
        { speaker: "Slither", text: "Four thingsss he loves. Now we can cook." },
        { speaker: "Fluffball", text: "A pizza. For Piggy. It might actually work." },
        { speaker: "", text: "Four ingredients. One penguin left to catch." },
        { speaker: "", text: "The miners swore they smelled tomato pie, once." },
        { speaker: "Joseph", text: "One tunnel left. Follow the smell down." },
      ],
    },
  ],
};
