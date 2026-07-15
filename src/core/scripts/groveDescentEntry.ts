import type { DialogueScript } from "../dialogue";

/**
 * Act 5, Zone 1 entry — The Warm Descent. The passage deeper into the stone
 * from the camp's back gallery. It gets warmer, not colder, the further down
 * they go — and there's light ahead that isn't lantern light. Grounds the
 * descent and points them on toward it. The scene sets `sawGroveDescent`.
 */
export const groveDescentEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "The drift keeps going down, past the camp." },
        { speaker: "Joseph", text: "It's getting WARMER. That's backwards." },
        { speaker: "Slither", text: "And light ahead. Not lantern light. Sss." },
        { speaker: "Joseph", text: "Piggy went this way. Toward the glow. Come on." },
      ],
    },
  ],
};
