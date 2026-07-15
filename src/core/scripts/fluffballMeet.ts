import type { DialogueScript } from "../dialogue";

/**
 * Fluffball, cornered for real in the nook — the end of the three-stage
 * chase (see fluffballFlee.ts for the two earlier "almost got him" beats).
 * He still speaks exactly ONE line himself — the silverfin clue — keeping
 * his shy, single-utterance characterization; the surrounding context (that
 * Piggy has several favorite things, not just this one, and that finding
 * them all is the actual plan) comes from Joseph and Slither instead, so
 * the player can't fly past the chase without registering why any of this
 * matters for the rest of the ingredient chase. He does not join here
 * (that's Act 5). The scene sets `metFluffball` on close so it never
 * repeats.
 */
export const fluffballMeetScript: DialogueScript = {
  start: "meet",
  nodes: [
    {
      id: "meet",
      lines: [
        { speaker: "", text: "Cornered in the nook, the gray chick freezes." },
        { speaker: "", text: "Nowhere left to run — caught, for a moment." },
        { speaker: "Joseph", text: "Easy. We're not here to hurt you, or him." },
        { speaker: "Slither", text: "We jussst want Piggy home ssssafe." },
        { speaker: "", text: "The chick studies them both, still trembling." },
        { speaker: "Fluffball", text: "...Silverfin. Piggy only comes for silverfin." },
        { speaker: "", text: "Deepest beds. Past where the light gives out." },
        { speaker: "Joseph", text: "Silverfin. Got it. Is that all he's after?" },
        { speaker: "", text: "The chick doesn't answer — just watches, wary." },
        { speaker: "Slither", text: "Doubt it. Piggy's parents raised a picky eater." },
        { speaker: "Joseph", text: "Then we find whatever else he loves. All of it." },
        { speaker: "", text: "Then he bolts — a gray blur into the dark." },
        { speaker: "Slither", text: "Sssilverfin. Noted. Shy as a shadow, that one." }
      ]
    }
  ]
};
