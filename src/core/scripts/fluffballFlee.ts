import type { DialogueScript } from "../dialogue";

/**
 * The four short beats of the Act 3 chase, between the first sighting and
 * the final corner in the nook (see fluffballMeet.ts for the actual
 * catch). Two are "almost got him" reaction lines; the other two are
 * Joseph/Slither planning asides — no Fluffball reaction, just the two of
 * them talking through why they're doing this, so a player following
 * along hears the plan taking shape mid-chase, not only once it's over.
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

/** Planning aside #1, right after the first flee — the how. */
export const fluffballPlanAScript: DialogueScript = {
  start: "planA",
  nodes: [
    {
      id: "planA",
      lines: [
        { speaker: "Joseph", text: "If we corner him gentle, maybe he'll talk." },
        { speaker: "Slither", text: "Then let'sss not sssspook him worse." }
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

/** Planning aside #2, right after the second flee — the why. */
export const fluffballPlanBScript: DialogueScript = {
  start: "planB",
  nodes: [
    {
      id: "planB",
      lines: [
        { speaker: "Slither", text: "Even if we catch him, that'sss not Piggy." },
        { speaker: "Joseph", text: "No. But he's the only one who'd know what" },
        { speaker: "Joseph", text: "Piggy needs. That's worth a lot right now." }
      ]
    }
  ]
};
