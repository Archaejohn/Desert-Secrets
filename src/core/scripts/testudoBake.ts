import type { DialogueScript } from "../dialogue";

/**
 * Testudo invites the bake — a choice hub, shaped like `fishingCast`. The
 * dough and tomato are Testudo's; the player brings the four things Piggy
 * loves (silverfin, socks, oranges, seaweed). "Bake the pizza." opens the
 * cooking minigame (terminal id `bake-end`); "Not yet." backs off (terminal id
 * `wait-end`). The scene branches on the terminal node id (like DepthsScene on
 * `parley-end`). Gated by the scene on all four ingredients being present.
 */
export const testudoBakeScript: DialogueScript = {
  start: "meet",
  nodes: [
    {
      id: "meet",
      lines: [
        { speaker: "Testudo", text: "You carry the four he loves. I smell them." },
        { speaker: "Testudo", text: "Fish, socks, oranges, kelp. The dough's mine." },
        { speaker: "Slither", text: "He meansss Piggy. Can you make it?" },
        { speaker: "Testudo", text: "Bring them to the oven. We bake together." },
      ],
      choices: [
        { text: "Bake the pizza.", next: "bake-end" },
        { text: "Not yet.", next: "wait-end" },
      ],
    },
    {
      id: "bake-end",
      lines: [{ speaker: "", text: "You lay the toppings by the great oven." }],
    },
    {
      id: "wait-end",
      lines: [{ speaker: "Testudo", text: "The oven keeps. Come back when ready." }],
    },
  ],
};
