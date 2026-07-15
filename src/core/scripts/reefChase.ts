import type { DialogueScript } from "../dialogue";

/**
 * Act 6 — the chase, and the TURN. The last near-catch before the finale, and
 * it has to land harder than every one before it. They corner Piggy for real,
 * in a dead end — and for the first time he's frightened, not playful. He
 * shrieks, bolts, and slips through a gap too small for Joseph. He's gone.
 *
 * The load-bearing beat: it is **Fluffball, not Joseph**, who calls after him —
 * his voice cracking — which is what raises the stakes going into Act 7. This
 * is NOT another comic miss; nobody laughs. Then, shaken, Fluffball gives clue
 * #4: the exact seaweed — the MINT kelp the crawlers cultivate on purpose (not
 * the wild growth). The scene sets `sawReefChase` on close. Terminal id `chase`.
 */
export const reefChaseScript: DialogueScript = {
  start: "chase",
  nodes: [
    {
      id: "chase",
      lines: [
        { speaker: "", text: "There — Piggy, wedged in a dead-end of coral." },
        { speaker: "", text: "No windfall, no game now. Cornered. Shaking." },
        { speaker: "Joseph", text: "Piggy— it's me. It's okay. You're okay—" },
        { speaker: "", text: "He shrieks. Bolts. A gap in the rock, thin—" },
        { speaker: "", text: "—too thin for Joseph. Piggy's through. Gone." },
        { speaker: "Fluffball", text: "PIGGY! ...come back. Please. We're friends—" },
        { speaker: "", text: "Fluffball's voice cracks. Nobody laughs now." },
        { speaker: "Slither", text: "...He'sss truly frightened. This isn't a game." },
        { speaker: "Fluffball", text: "Then we finish it. The seaweed. The MINT kelp." },
        { speaker: "Fluffball", text: "They grow that one on purpose. That row." },
        { speaker: "Joseph", text: "Last thing on the list. Let's go get it." },
      ],
    },
  ],
};
