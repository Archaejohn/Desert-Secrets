import type { DialogueScript } from "../dialogue";

/**
 * Beat 3 — Dusty the pack rat at Last Chance Fuel. Trades a shiny for
 * the truth: Piggy followed the cool air into Cinnabar Mine. The scene
 * gates the "Pay a shiny" choice on items.shinies and spends one when
 * the truth branch is taken.
 */
export const dustyTradeScript: DialogueScript = {
  start: "greet",
  nodes: [
    {
      id: "greet",
      lines: [
        { speaker: "Dusty", text: "Welcome to Last Chance Fuel. No fuel." },
        { speaker: "Dusty", text: "Dusty's the name. Trade's the game." },
        { speaker: "Dusty", text: "Everything shiny ends up here. Everything." },
      ],
      next: "tag",
    },
    {
      id: "tag",
      lines: [
        { speaker: "Joseph", text: "That tag on your shelf. It says PIGGY." },
        { speaker: "Dusty", text: "Crows brought it. Lovely bit of shine." },
        { speaker: "Joseph", text: "Where's the bird it came off of?" },
      ],
      next: "hub",
    },
    {
      id: "hub",
      lines: [
        { speaker: "Dusty", text: "Facts cost a shiny. House rule." },
      ],
      choices: [
        { text: "Pay a shiny", next: "truth" },
        { text: "Not right now", next: "later-end" },
      ],
    },
    {
      id: "truth",
      lines: [
        { speaker: "Dusty", text: "Deal. Your bird went by at noon, panting." },
        { speaker: "Dusty", text: "Then he perked right up. Sniffed the wind." },
      ],
      next: "truth-end",
    },
    {
      id: "truth-end",
      lines: [
        { speaker: "Dusty", text: "Cinnabar Mine breathes cold air. Always has." },
        { speaker: "Dusty", text: "He followed the cool. Smart little shine." },
        { speaker: "Joseph", text: "The mine. Thanks, Dusty." },
      ],
    },
    {
      id: "later-end",
      lines: [
        { speaker: "Dusty", text: "Door's always open. Bring me something pretty." },
      ],
    },
  ],
};
