import type { DialogueScript } from "../dialogue";

/**
 * The flooded ancient ruins: the desert wasn't hiding treasure, it was
 * hiding an ECOSYSTEM that's been down here since the Mojave was ocean.
 * Linear flavor/lore; the scene sets `sawTemple` on close.
 */
export const templeLoreScript: DialogueScript = {
  start: "temple",
  nodes: [
    {
      id: "temple",
      lines: [
        { speaker: "", text: "Drowned pillars. Ancient ruins, long flooded." },
        { speaker: "Joseph", text: "Nobody up top knew this was down here." },
        { speaker: "Slither", text: "The desert wasn't hiding treasure, Jossseph." },
        { speaker: "Slither", text: "It was hiding a whole sssea. An ecosystem." },
        { speaker: "", text: "The Mojave was ocean once. It still remembers." }
      ]
    }
  ]
};
