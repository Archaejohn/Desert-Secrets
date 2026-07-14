import type { DialogueScript } from "../dialogue";

/**
 * Act 2, the galleries — Gus, last of the lost miners, holed up down a
 * side gallery. Relief, a rime-door hint (bolted from inside; something
 * snake-sized might fit), and the singing-water seed for Act 3. The
 * scene sets the minerGus flag, awards XP, and grants the all-three
 * miners bonus perk when this script finishes.
 */
export const minerGusScript: DialogueScript = {
  start: "found",
  nodes: [
    {
      id: "found",
      lines: [
        { speaker: "Gus", text: "Lantern's dead, boots froze... company?" },
        { speaker: "Gus", text: "Gus. Cart man, Cinnabar crew. Was." },
        { speaker: "Gus", text: "Been rationing one sad tin of jerky." },
        { speaker: "Joseph", text: "Mo and Edda are safe at the camp." },
        { speaker: "Gus", text: "All three of us? Kid, you're good luck." },
      ],
      next: "hint",
    },
    {
      id: "hint",
      lines: [
        { speaker: "Joseph", text: "I need to get through the far door." },
        { speaker: "Gus", text: "The rime door? Bolted from inside the" },
        { speaker: "Gus", text: "workings. Nothing man-sized fits through." },
        { speaker: "Gus", text: "Something snake-sized might, though." },
      ],
      next: "seed",
    },
    {
      id: "seed",
      lines: [
        { speaker: "Gus", text: "One more thing. Deeper down, the water" },
        { speaker: "Gus", text: "sings. Little glowing notes, rising sweet." },
        { speaker: "Joseph", text: "Singing water. Sure, Gus." },
        { speaker: "Gus", text: "You'll hear it yourself soon enough." },
        { speaker: "Gus", text: "I'm off to camp. Give 'em my regards!" },
      ],
    },
  ],
};
