import type { DialogueScript } from "../dialogue";

/**
 * Act 7, Zone 2 entry beat (The Lava Vents). A volcanic gallery where the
 * stone breathes heat through glowing cracks — the "getting warmer, lava-vent
 * light ahead" beat. The tomato-pie smell is unmistakable now. Terminal id
 * `end`.
 */
export const pizzaVentEntryScript: DialogueScript = {
  start: "vent",
  nodes: [
    {
      id: "vent",
      lines: [
        { speaker: "", text: "Lava vents. The stone breathes heat." },
        { speaker: "Joseph", text: "Careful. Stay off the glowing cracks." },
        { speaker: "Slither", text: "The sssmell is ssstronger. This way." },
      ],
    },
  ],
};
