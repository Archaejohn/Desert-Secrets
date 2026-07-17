import type { DialogueScript } from "../dialogue";

/**
 * The Part Two opening cutscene's dialogue — Joseph (with Piggy, Fluffball and
 * Slither beside him) and Thomas finally connect over the radio, two-way at
 * last after a whole Part of one-way fragments (see thomas.ts). Kept in core so
 * the exact four lines are unit-testable; PartTwoOpeningScene renders them.
 *
 * The four lines are authored verbatim to the brief (including its emphasis and
 * casing) — do not "correct" them.
 */
export const partTwoOpeningScript: DialogueScript = {
  start: "radio",
  nodes: [
    {
      id: "radio",
      lines: [
        { speaker: "Thomas", text: "Joseph can you hear me?" },
        { speaker: "Joseph", text: "I CAN!! Finally! where are you?" },
        { speaker: "Thomas", text: "You Won't believe it if I told you!" },
        { speaker: "Joseph", text: "I'm coming to find you." },
      ],
    },
  ],
};
