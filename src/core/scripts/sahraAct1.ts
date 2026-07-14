import type { DialogueScript } from "../dialogue";

/**
 * Beat 2 — Sahra at the oasis, Act 1 version. She reads the frost
 * feather, quietly retires her old sun-temple lore, and gives the
 * three-ice-chips trail quest. Choice hub: trail / scarabs / farewell.
 * The original sahraScript stays untouched; this replaces it in Act 1.
 */
export const sahraAct1Script: DialogueScript = {
  start: "greet",
  nodes: [
    {
      id: "greet",
      lines: [
        { speaker: "Sahra", text: "The wind said you would come running." },
        { speaker: "Sahra", text: "Slow down, child. Show me your hand." },
      ],
      next: "feather",
    },
    {
      id: "feather",
      lines: [
        { speaker: "Joseph", text: "A feather. The frost on it won't melt." },
        { speaker: "Sahra", text: "..." },
        { speaker: "Joseph", text: "Sahra?" },
        { speaker: "Sahra", text: "I once said a sun-temple slept below." },
        { speaker: "Sahra", text: "A kind lie. What sleeps below is cold." },
      ],
      next: "bird",
    },
    {
      id: "bird",
      lines: [
        { speaker: "Sahra", text: "At dawn I saw a small tuxedoed bird" },
        { speaker: "Sahra", text: "chasing the shine of a mirage, eastward." },
        { speaker: "Sahra", text: "And the crash has woken the scarab brood." },
      ],
      next: "hub",
    },
    {
      id: "hub",
      lines: [
        { speaker: "Sahra", text: "Ask, then. The water can wait." },
      ],
      choices: [
        { text: "Ask about the trail", next: "trail" },
        { text: "Ask about the scarabs", next: "scarabs" },
        { text: "Say farewell", next: "farewell" },
      ],
    },
    {
      id: "trail",
      lines: [
        { speaker: "Sahra", text: "Where the little one rested, ice remains." },
        { speaker: "Sahra", text: "Three chips of it, out on the flats." },
        { speaker: "Sahra", text: "The desert collects lost things. Follow." },
      ],
      next: "hub",
    },
    {
      id: "scarabs",
      lines: [
        { speaker: "Sahra", text: "The brood digs deeper every year." },
        { speaker: "Sahra", text: "As if called. Steel bites; patience deeper." },
        { speaker: "Sahra", text: "Guard well when their wings hum." },
      ],
      next: "hub",
    },
    {
      id: "farewell",
      lines: [
        { speaker: "Sahra", text: "Go. He has hours, and you have legs." },
        { speaker: "Sahra", text: "The desert keeps its secrets... for now." },
      ],
    },
  ],
};
