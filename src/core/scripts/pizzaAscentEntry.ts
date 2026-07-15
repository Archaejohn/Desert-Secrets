import type { DialogueScript } from "../dialogue";

/**
 * Act 7, Zone 5 entry beat (The Long Way Up). The walk back toward the surface,
 * mission accomplished: Piggy caught, fed, and — per the design doc — part of
 * the group's found family now, following the party up on his own. A warm,
 * quiet beat before the finale. Terminal id `end`.
 */
export const pizzaAscentEntryScript: DialogueScript = {
  start: "ascent",
  nodes: [
    {
      id: "ascent",
      lines: [
        { speaker: "", text: "One pizza lighter. One penguin heavier." },
        { speaker: "Joseph", text: "Come on. Let's get everyone up top." },
        { speaker: "Fluffball", text: "Piggy's actually FOLLOWING you now." },
        { speaker: "Slither", text: "Family. Ssstrange little family." },
      ],
    },
  ],
};
