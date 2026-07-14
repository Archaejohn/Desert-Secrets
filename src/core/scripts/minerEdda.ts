import type { DialogueScript } from "../dialogue";

/**
 * Act 2, the ice maze — Edda, second lost miner, walled into a false
 * lead. Relief, a maze hint (two true routes; mark the loops), and the
 * distant-waves seed for Act 3. The scene sets the minerEdda flag and
 * awards XP when this script finishes.
 */
export const minerEddaScript: DialogueScript = {
  start: "found",
  nodes: [
    {
      id: "found",
      lines: [
        { speaker: "Edda", text: "Steps? Real steps? I'm over here!" },
        { speaker: "Edda", text: "Edda. Blasting lead, Cinnabar crew." },
        { speaker: "Edda", text: "This dead end nearly kept me. Thanks." },
        { speaker: "Joseph", text: "Mo made it out. He's at the camp." },
        { speaker: "Edda", text: "Ha! Knew that old goat would outlast me." },
      ],
      next: "hint",
    },
    {
      id: "hint",
      lines: [
        { speaker: "Joseph", text: "Is there a way through this maze?" },
        { speaker: "Edda", text: "Two true roads cross this ice. Two." },
        { speaker: "Edda", text: "If a hall loops back on itself, mark it" },
        { speaker: "Edda", text: "and move on. The ice loves a rerun." },
      ],
      next: "seed",
    },
    {
      id: "seed",
      lines: [
        { speaker: "Edda", text: "Put your ear to the far wall sometime." },
        { speaker: "Edda", text: "Waves. I hear distant waves down there." },
        { speaker: "Joseph", text: "There's no sea under the Mojave." },
        { speaker: "Edda", text: "Mm. Keep telling the ice that." },
        { speaker: "Edda", text: "I'll make for the camp. Watch your feet." },
      ],
    },
  ],
};
