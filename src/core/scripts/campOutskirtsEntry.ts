import type { DialogueScript } from "../dialogue";

/**
 * Act 4, Zone 1 entry — the Camp Outskirts. The ladder tops out onto the
 * frostbitten edge of the miners' camp. Grounds the player in the place and
 * spells out the environmental storytelling of Piggy's night raids (frost
 * tracks, a stolen boot) before they reach the home proper. The scene sets
 * `sawOutskirts` on close.
 */
export const campOutskirtsEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "The ladder tops out on the camp's edge." },
        { speaker: "Slither", text: "Sssstring lights. That is Mo's camp, ahead." },
        { speaker: "", text: "Frost tracks cross the dust. A stolen boot." },
        { speaker: "Joseph", text: "Piggy's been raiding them at night." },
        { speaker: "Joseph", text: "Let's head in — the camp's just south." },
      ],
    },
  ],
};
