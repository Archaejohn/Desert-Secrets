import type { DialogueScript } from "../dialogue";

/**
 * Act 3 arrival + the comic chase: Piggy is spotted playing tag with a
 * small gray shape far across the water, and the near-catch fails because
 * penguins are simply faster in the sea than Joseph is on a floe. Linear;
 * the scene sets `sawChase` on close.
 */
export const piggyChaseScript: DialogueScript = {
  start: "chase",
  nodes: [
    {
      id: "chase",
      lines: [
        { speaker: "Slither", text: "There. Sssee him? Out on the ice." },
        { speaker: "Joseph", text: "Piggy! And... something small and gray." },
        { speaker: "Slither", text: "Playing tag. On the water. Ssshow-offs." },
        { speaker: "Joseph", text: "Wait up! I'm coming—" },
        { speaker: "", text: "The two penguins bolt across the floes," },
        { speaker: "", text: "faster than any raft. Gone before you're near." },
        { speaker: "Slither", text: "Told you. Fassster in water than you." }
      ]
    }
  ]
};
