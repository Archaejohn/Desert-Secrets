import type { DialogueScript } from "../dialogue";

/**
 * Act 5, Zone 4 entry — The Sunlit Cave-In. The reveal: a mine chamber whose
 * ceiling caved in long ago, letting a shaft of desert sun straight down onto
 * the greenest place in the whole game. One orange tree stands at the dead
 * center, watered by the river, lit by the hole in the roof. Grounds the awe
 * and the goal (the tree, then whoever tends it). The scene sets
 * `sawGroveChamber`; Fluffball joins for real here, following the chase.
 */
export const groveChamberEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "The tunnel opens. Sunlight — real sunlight." },
        { speaker: "", text: "The roof caved in. Real desert sky, up there." },
        { speaker: "Joseph", text: "A garden. Buried in the mine. And one tree—" },
        { speaker: "", text: "One orange tree, dead center, lit by the sun." },
        { speaker: "Slither", text: "All that desert — and it hides HERE. Sss." },
      ],
    },
  ],
};
