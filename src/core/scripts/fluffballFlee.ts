import type { DialogueScript } from "../dialogue";

/**
 * The two short "almost got him" beats of the Act 3 chase, between the
 * first sighting and the final corner in the nook (see fluffballMeet.ts
 * for the actual catch). Kept brief on purpose — the chase should feel
 * quick, with all the context landing once he's actually cornered.
 */
export const fluffballFleeStage1Script: DialogueScript = {
  start: "flee1",
  nodes: [
    {
      id: "flee1",
      lines: [
        { speaker: "", text: "A gray shape bolts deeper into the bed!" },
        { speaker: "Slither", text: "There! Don't lossse him now." }
      ]
    }
  ]
};

export const fluffballFleeStage2Script: DialogueScript = {
  start: "flee2",
  nodes: [
    {
      id: "flee2",
      lines: [
        { speaker: "", text: "He ducks into a tighter channel, still ahead." },
        { speaker: "Joseph", text: "Almost—" }
      ]
    }
  ]
};
