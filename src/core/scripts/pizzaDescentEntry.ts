import type { DialogueScript } from "../dialogue";

/**
 * Act 7, Zone 1 entry beat (The Warm Deep). The party pushes below even the
 * reef, following the miners' old rumor of smelled tomato pie (the Act 2 seed).
 * The cold water gives way to a warm, bread-scented draft and a faint glow.
 * Terminal id `end`.
 */
export const pizzaDescentEntryScript: DialogueScript = {
  start: "descent",
  nodes: [
    {
      id: "descent",
      lines: [
        { speaker: "Joseph", text: "The air's warm. And that smell..." },
        { speaker: "Slither", text: "Tomato. Bread. Sssomething baking." },
        { speaker: "Fluffball", text: "The miners weren't lying. Down HERE?" },
        { speaker: "", text: "A faint orange glow flickers below." },
      ],
    },
  ],
};
