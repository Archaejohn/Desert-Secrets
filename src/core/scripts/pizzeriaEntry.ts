import type { DialogueScript } from "../dialogue";

/**
 * Act 7, Zone 4 arrival (La Pizzeria Sotterranea). The restaurant itself:
 * tables set for guests who stopped coming three thousand years ago, lit by
 * lava vents — and Chef Testudo, an ancient tortoise, still at his oven. This
 * beat sets `metTestudo`; the actual bake is offered when the player talks to
 * Testudo (see testudoBake). Terminal id `end`.
 */
export const pizzeriaEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "A restaurant. Under everything." },
        { speaker: "", text: "Tables set for guests three thousand" },
        { speaker: "", text: "years gone. Lit by lava vents." },
        { speaker: "Testudo", text: "Customers. At last! Sit — you're late." },
        { speaker: "Joseph", text: "You're... a tortoise. Cooking pizza." },
        { speaker: "Testudo", text: "Chef Testudo. I've had time to practice." },
      ],
    },
  ],
};
