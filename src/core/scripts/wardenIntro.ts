import type { DialogueScript } from "../dialogue";

/**
 * Act 2, the sanctum — the Rime Warden wakes on the frozen lake. Two
 * lines, construct voice: not evil, just still following the last order
 * it was ever given. The scene starts the boss battle when this ends.
 */
export const wardenIntroScript: DialogueScript = {
  start: "wake",
  nodes: [
    {
      id: "wake",
      lines: [
        { speaker: "Warden", text: "DIRECTIVE: KEEP THE LAKE. KEEP THE COLD." },
        { speaker: "Warden", text: "LAST ORDER STANDS. INTRUDERS: HOLD STILL." },
      ],
    },
  ],
};
