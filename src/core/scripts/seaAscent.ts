import type { DialogueScript } from "../dialogue";

/**
 * The ascent out of the Sunless Sea: an old miners' service ladder answers
 * the "how do I get off the ice?" question the shipped act never did. Plays
 * on the midway ledge; the zone's top gate hands off to the miners' camp
 * (Act 4). Linear; the scene sets `sawAscent` on close.
 */
export const seaAscentScript: DialogueScript = {
  start: "climb",
  nodes: [
    {
      id: "climb",
      lines: [
        { speaker: "", text: "An old miners' service ladder, rimed with ice." },
        { speaker: "Joseph", text: "So THAT'S how we get off the ice. Up we go." },
        { speaker: "Slither", text: "Sssurface air. Almost missssed it." },
        { speaker: "", text: "Somewhere above, the miners' camp waits." }
      ]
    }
  ]
};
