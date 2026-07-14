import type { DialogueScript } from "../dialogue";

/**
 * Act 2, the galleries — Slither unbolts the rime door from inside its
 * workings, then decides Joseph is warm and mostly harmless and JOINS
 * the party. The scene sets rimeDoorOpen and slitherJoined when the
 * script ends at the terminal node "join-end" (contract id).
 */
export const slitherDoorScript: DialogueScript = {
  start: "door",
  nodes: [
    {
      id: "door",
      lines: [
        { speaker: "Slither", text: "The rime door. Sssealed sssince the" },
        { speaker: "Slither", text: "warm days. Bolted from the inssside." },
        { speaker: "Joseph", text: "Gus said something snake-sized fits." },
        { speaker: "Slither", text: "Sssomething ssstylish-sized. Watch." },
      ],
      next: "unbolt",
    },
    {
      id: "unbolt",
      lines: [
        { speaker: "", text: "(He pours himself into the workings.)" },
        { speaker: "", text: "(Clank. CLUNK. The rime shears away.)" },
        { speaker: "Slither", text: "Ugh. Cold bolts. Cold, ssstubborn bolts." },
        { speaker: "Joseph", text: "You're amazing. You know that?" },
      ],
      next: "join",
    },
    {
      id: "join",
      lines: [
        { speaker: "Slither", text: "Yesss. And I've decssided sssomething." },
        { speaker: "Slither", text: "You are warm, and mossstly harmless," },
        { speaker: "Slither", text: "and the Warden passst thisss door is not." },
        { speaker: "Slither", text: "Sssomebody has to keep you alive." },
      ],
      next: "join-end",
    },
    {
      id: "join-end",
      lines: [
        { speaker: "", text: "(Slither joins the party!)" },
        { speaker: "Slither", text: "Bite, coil, venom. Point me at things." },
      ],
    },
  ],
};
