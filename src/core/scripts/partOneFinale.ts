import type { DialogueScript } from "../dialogue";

/**
 * The Part One finale — the deliberate cliffhanger. On the walk out, Rosa's
 * radio (the game's very first NPC, Act 1) crackles back to life: a real
 * signal, almost home. Then, mid-step, the floor gives way. This is the
 * end-of-Part-One hinge, NOT an "Act N: coming soon" placeholder — the scene
 * renders a genuine END OF PART ONE card after this cutscene closes (camera
 * shake + fade), then returns to the title (Part Two isn't built yet).
 * Terminal id `drop`.
 */
export const partOneFinaleScript: DialogueScript = {
  start: "radio",
  nodes: [
    {
      id: "radio",
      lines: [
        { speaker: "", text: "Static — then, sudden and clear:" },
        { speaker: "Rosa", text: "—Joseph? JOSEPH! I've got you again!" },
        { speaker: "Rosa", text: "You're almost up! I can see the light—" },
        { speaker: "Joseph", text: "We did it, Rosa. Bringing him home." },
        { speaker: "", text: "A seed of the old ice glints in his pack." },
      ],
      next: "drop",
    },
    {
      id: "drop",
      lines: [
        { speaker: "Fluffball", text: "Wait. Do you feel that? The floor—" },
        { speaker: "", text: "A crack. A lurch. The stone lets go." },
        { speaker: "", text: "And the whole world drops away." },
      ],
    },
  ],
};
