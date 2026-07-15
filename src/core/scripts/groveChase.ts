import type { DialogueScript } from "../dialogue";

/**
 * Act 5 chase — and, for the first time, the near-catch isn't funny. Piggy
 * beat the party to Sahra's grove and is snacking; he bolts the instant he
 * sees Joseph and waddle-sprints into a patch of needle-cactus too dense to
 * follow. He isn't playing keep-away this time — he's scared. A quiet beat
 * of concern from Joseph and Slither lands the tone shift. The scene sets
 * `sawGroveChase` on close, then rolls straight into Fluffball's join.
 * Terminal id `chase`.
 */
export const groveChaseScript: DialogueScript = {
  start: "chase",
  nodes: [
    {
      id: "chase",
      lines: [
        { speaker: "", text: "Piggy's here — nose-deep in fallen oranges." },
        { speaker: "", text: "He bolts the moment he sees you. Fast. Scared." },
        { speaker: "", text: "He crashes into a wall of needle-cactus—" },
        { speaker: "", text: "—too dense to follow. He trembles inside it." },
        { speaker: "Joseph", text: "Hey. Easy. I'm not going to hurt you." },
        { speaker: "Slither", text: "Sssomething's wrong. He's not playing now." },
        { speaker: "", text: "For once, nobody laughs. Then he's gone." },
      ],
    },
  ],
};
