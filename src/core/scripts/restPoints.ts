import type { DialogueScript } from "../dialogue";

/**
 * Rest-point flavor lines (one per act, Acts 3–7). Each is a single narration
 * beat shown when the player uses a zone's rest point — a free, reusable full
 * heal that closes the mid-chain "no way to restore HP between fights" gap.
 * The heal itself is the pure respawn() in gameState.ts; these scripts only
 * confirm it in zone-appropriate voice. See docs/CONTRACTS.md ("v19").
 */

/** Act 3 — the kelp forest hub: a warm mineral current under the floe. */
export const kelpRestScript: DialogueScript = {
  start: "rest",
  nodes: [
    {
      id: "rest",
      lines: [
        { speaker: "", text: "A warm mineral current wells up through the floe. You breathe deep, and steady. (Party fully rested.)" }
      ]
    }
  ]
};

/** Act 4 — the miners' camp: the stove on the rug. */
export const campRestScript: DialogueScript = {
  start: "rest",
  nodes: [
    {
      id: "rest",
      lines: [
        { speaker: "", text: "You warm your hands at the miners' stove. The ache eases out of your legs. (Party fully rested.)" }
      ]
    }
  ]
};

/** Act 5 — the river grotto: the underground river's source pool. */
export const grottoRestScript: DialogueScript = {
  start: "rest",
  nodes: [
    {
      id: "rest",
      lines: [
        { speaker: "", text: "You kneel at the river's source and drink. Cold, clean, endless — the same water that feeds the oasis. (Party fully rested.)" }
      ]
    }
  ]
};

/** Act 6 — the crawlers' garden: the glowing mint-kelp rows. */
export const reefRestScript: DialogueScript = {
  start: "rest",
  nodes: [
    {
      id: "rest",
      lines: [
        { speaker: "", text: "You settle among the glowing mint kelp. Its soft light seems to soak the tiredness right out of you. (Party fully rested.)" }
      ]
    }
  ]
};

/** Act 7 — La Pizzeria Sotterranea: a set table, a bowl of Testudo's soup. */
export const pizzaRestScript: DialogueScript = {
  start: "rest",
  nodes: [
    {
      id: "rest",
      lines: [
        { speaker: "", text: "You pull up a chair at a long-set table. Testudo slides over a bowl of soup, and the warmth returns. (Party fully rested.)" }
      ]
    }
  ]
};
