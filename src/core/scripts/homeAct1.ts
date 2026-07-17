import type { DialogueScript } from "../dialogue";

/**
 * Beat 2 — the family homestead by the spring, Act 1 version. John and
 * Pamela (Joseph's parents) are now TWO separate NPCs you walk up to and
 * talk to individually, each with its own coherent voice (they used to
 * share one tangled script). The dialogue lanes are split per CLAUDE.md:
 *
 * - **John** (`johnAct1Script`) owns the scarabs/mystery-bug thread and
 *   outdoor sightings (he spotted Piggy heading east at dawn), and he's
 *   the one who hands Joseph the hand radio and points him at Thomas — as
 *   he hands it over, a garbled fragment cuts in ("Jos... *crackle pop*").
 *   His farewell keeps the frost-on-the-flats hint that motivates the trail.
 * - **Pamela** (`pamelaAct1Script`) owns the chickens/chores thread (the
 *   optional bucket fetch-quest: shed → spigot → trough).
 *
 * "Scarab" is the family's own name for the bugs, not a real species ID —
 * John says so outright, but the alien angle stays unconfirmed here (that's
 * a Part 3 reveal; see CLAUDE.md). Both NPCs share the same onClose in
 * OasisScene: it sets `metParents` and, the first time, starts the tutorial
 * scarab battle — so whichever parent you close first kicks it off.
 */
export const johnAct1Script: DialogueScript = {
  start: "greet",
  nodes: [
    {
      id: "greet",
      lines: [
        { speaker: "John", text: "Joseph! There you are, son." },
        { speaker: "John", text: "Saw a little thing waddle past at dawn." },
        { speaker: "John", text: "Headed east, past the wash. Your penguin?" },
      ],
      next: "radio",
    },
    {
      id: "radio",
      lines: [
        { speaker: "John", text: "Here. My hand radio — Thomas has its twin." },
        { speaker: "John", text: "If he's out there, that's how you'll reach him." },
        { speaker: "", text: "It spits static: \"Jos... *crackle pop*\"" },
        { speaker: "John", text: "...Then quiet. Keep trying him, son." },
      ],
      next: "hub",
    },
    {
      id: "hub",
      lines: [{ speaker: "John", text: "Anything else before you run off?" }],
      choices: [
        { text: "Ask about the scarabs", next: "scarabs" },
        { text: "Ask about Thomas", next: "thomas" },
        { text: "Say goodbye", next: "farewell" },
      ],
    },
    {
      id: "scarabs",
      lines: [
        { speaker: "Joseph", text: "What's the deal with the scarabs?" },
        { speaker: "John", text: "They've been out early, since the crash." },
        { speaker: "John", text: "\"Scarab\" is just what we call 'em." },
        { speaker: "John", text: "Cracked a dead one open by the fence line." },
        { speaker: "John", text: "Wrong number of legs. Shell's all wrong too." },
        { speaker: "John", text: "Not like any bug I've ever known." },
        { speaker: "John", text: "Didn't sleep right for a week after." },
        { speaker: "John", text: "Don't know where they came from." },
        { speaker: "John", text: "Just don't go poking at a live one." },
      ],
      next: "hub",
    },
    {
      id: "thomas",
      lines: [
        { speaker: "Joseph", text: "You really think Thomas is out there?" },
        { speaker: "John", text: "Not seen him since sunup. Had somewhere to be." },
        { speaker: "John", text: "He never goes far without that radio." },
        { speaker: "John", text: "Keep the channel open. He'll turn up." },
      ],
      next: "hub",
    },
    {
      id: "farewell",
      lines: [
        { speaker: "John", text: "We found ice out on the flats last week." },
        { speaker: "John", text: "Never melted. Didn't think much of it." },
        { speaker: "John", text: "Go find your bird, Joseph. And find Thomas." },
      ],
    },
  ],
};

export const pamelaAct1Script: DialogueScript = {
  start: "greet",
  nodes: [
    {
      id: "greet",
      lines: [
        { speaker: "Pamela", text: "Joseph! Thank goodness you're all right." },
        { speaker: "Pamela", text: "You had us both worried sick." },
      ],
      next: "hub",
    },
    {
      id: "hub",
      lines: [{ speaker: "Pamela", text: "Now — before you run off again." }],
      choices: [
        { text: "Ask about the chickens", next: "chickens" },
        { text: "Say goodbye", next: "farewell" },
      ],
    },
    {
      id: "chickens",
      lines: [
        { speaker: "Pamela", text: "Did you feed and water the chickens yet?" },
        { speaker: "Joseph", text: "...I was just heading out, if I'm honest." },
        { speaker: "Pamela", text: "The bucket's in the shed, south of here." },
        { speaker: "Pamela", text: "Fill it at the spigot, then the trough west." },
        { speaker: "Pamela", text: "Equip it from your bag first, or it won't fill." },
        { speaker: "Pamela", text: "Do it before you go. They get dramatic." },
      ],
      next: "hub",
    },
    {
      id: "farewell",
      lines: [
        { speaker: "Pamela", text: "Off you go. We'll hold the homestead." },
        { speaker: "Pamela", text: "Bring that little bird home safe." },
      ],
    },
  ],
};
