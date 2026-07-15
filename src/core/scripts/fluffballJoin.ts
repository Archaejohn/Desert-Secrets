import type { DialogueScript } from "../dialogue";

/**
 * Act 5 — Fluffball JOINS. Shaken by Piggy's fright, the gray chick finally
 * comes all the way in instead of the glimpse-and-flee of Acts 3–4: he
 * decides Joseph is trying to HELP Piggy, not just catch him, and sticks
 * around from here on as a non-combat companion. This is his first real
 * dialogue — several lines, not a single shouted clue — and it carries clue
 * #3, given properly: the oranges, specifically Sahra's OLDEST row. The
 * scene sets `fluffballJoined` and spawns his follower sprite on close.
 * Terminal id `join`.
 */
export const fluffballJoinScript: DialogueScript = {
  start: "join",
  nodes: [
    {
      id: "join",
      lines: [
        { speaker: "", text: "The gray chick edges out from the ferns." },
        { speaker: "Fluffball", text: "You weren't chasing him to hurt him." },
        { speaker: "Fluffball", text: "You want to HELP Piggy. I see it now." },
        { speaker: "Joseph", text: "I do. Come with us — we'll bring him home." },
        { speaker: "Fluffball", text: "Then I'm in. All the way, this time." },
        { speaker: "Fluffball", text: "Oranges. Sahra's oldest row. He loves them." },
        { speaker: "Slither", text: "Welcome, little fluff. Try to keep up. Sss." },
        { speaker: "", text: "Fluffball tucks in behind you. Three now." },
      ],
    },
  ],
};
