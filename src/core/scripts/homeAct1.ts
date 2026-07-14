import type { DialogueScript } from "../dialogue";

/**
 * Beat 2 — the family homestead by the spring, Act 1 version. John and
 * Pamela (Joseph's parents) replace Sahra in this beat entirely — the
 * frost mystery is carried by Rosa's crash-site dialogue instead, and
 * the sun-temple/old-ocean lore is seeded fresh later (Act 2's miners,
 * and — if it's ever built — Act 5). Choice hub: Thomas / chickens /
 * goodbye. Functionally preserves what the old Sahra beat set up: Piggy
 * headed east, the scarabs are stirring, and there's unmelted ice out on
 * the flats (the trail's three-ice-chip quest).
 */
export const homeAct1Script: DialogueScript = {
  start: "greet",
  nodes: [
    {
      id: "greet",
      lines: [
        { speaker: "Pamela", text: "Joseph! Thank goodness you're all right." },
        { speaker: "John", text: "Radio's been quiet all morning. Had us worried." },
      ],
      next: "piggy",
    },
    {
      id: "piggy",
      lines: [
        { speaker: "Joseph", text: "Sorry — a penguin got loose from Rosa's rig." },
        { speaker: "Pamela", text: "A penguin? Out here?" },
        { speaker: "John", text: "Saw a little thing waddle past at dawn." },
        { speaker: "John", text: "Headed east, out past the wash." },
        { speaker: "Pamela", text: "Ground's been humming since the crash, too." },
        { speaker: "Pamela", text: "Scarabs, probably. Mind yourself out there." },
      ],
      next: "hub",
    },
    {
      id: "hub",
      lines: [{ speaker: "Pamela", text: "Go on, ask, before you run off again." }],
      choices: [
        { text: "Ask about Thomas", next: "thomas" },
        { text: "Ask about the chickens", next: "chickens" },
        { text: "Say goodbye", next: "farewell" },
      ],
    },
    {
      id: "thomas",
      lines: [
        { speaker: "Joseph", text: "Have you seen Thomas today?" },
        { speaker: "John", text: "Not since sunup. Said he had somewhere to be." },
        { speaker: "Pamela", text: "That boy and his secrets. Find your bird first." },
      ],
      next: "hub",
    },
    {
      id: "chickens",
      lines: [
        { speaker: "Pamela", text: "Did you feed and water the chickens yet?" },
        { speaker: "Joseph", text: "...I was just heading out, if I'm honest." },
        { speaker: "John", text: "Bucket's out in the shed, south of here." },
        { speaker: "John", text: "Fill it at the spring, then the trough's west." },
        { speaker: "Pamela", text: "Do it before you go. They get dramatic." },
      ],
      next: "hub",
    },
    {
      id: "farewell",
      lines: [
        { speaker: "John", text: "We found some ice out on the flats last week." },
        { speaker: "John", text: "Never melted. Didn't think much of it till now." },
        { speaker: "Pamela", text: "Go find your bird, Joseph. We'll be here." },
      ],
    },
  ],
};
