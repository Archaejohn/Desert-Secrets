import type { DialogueScript } from "../dialogue";

/**
 * Act 4 arrival + the comic chase: Piggy has been raiding the camp at
 * night, and now he's caught sniffing the supply crates. The near-catch
 * fails when he burrows into a crate stack and pops out the far side
 * before Joseph can dig him out. Linear; the scene sets `sawCrateChase`.
 */
export const crateChaseScript: DialogueScript = {
  start: "chase",
  nodes: [
    {
      id: "chase",
      lines: [
        { speaker: "Slither", text: "There. Sssniffing the ssupply crates." },
        { speaker: "Joseph", text: "Piggy! Caught you raiding the camp—" },
        { speaker: "", text: "He bolts, burrowing into a crate stack." },
        { speaker: "", text: "Crates topple. You dig — only a lost boot." },
        { speaker: "", text: "He pops out the far side and is gone." },
        { speaker: "Slither", text: "Every night, they sssay. A tiny bandit." },
      ],
    },
  ],
};
