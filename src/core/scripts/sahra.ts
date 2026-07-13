import type { DialogueScript } from "../dialogue";

/**
 * Sahra the Keeper — the elder waiting at the oasis.
 * Lines are kept short (~48 chars) to fit a 3-line text box.
 */
export const sahraScript: DialogueScript = {
  start: "greet",
  nodes: [
    {
      id: "greet",
      lines: [
        { speaker: "Sahra", text: "Ah... a wanderer. The wind spoke of you." },
        { speaker: "Sahra", text: "I am Sahra, keeper of this quiet water." },
        { speaker: "Sahra", text: "The dunes hide more than bones, child." },
      ],
      next: "hint",
    },
    {
      id: "hint",
      lines: [
        { speaker: "Sahra", text: "Beneath the third dune sleeps a sun-temple," },
        { speaker: "Sahra", text: "sealed since the sky itself was young." },
        { speaker: "Sahra", text: "Scarabs of living bronze guard its seal." },
      ],
      next: "hub",
    },
    {
      id: "hub",
      lines: [
        { speaker: "Sahra", text: "What would you know, wanderer?" },
      ],
      choices: [
        { text: "Ask about the temple", next: "temple" },
        { text: "Ask about the scarabs", next: "scarabs" },
        { text: "Say farewell", next: "farewell" },
      ],
    },
    {
      id: "temple",
      lines: [
        { speaker: "Sahra", text: "The temple drank the light of a dead sun." },
        { speaker: "Sahra", text: "Its door opens only to a patient heart." },
        { speaker: "Sahra", text: "Follow the sparkling sand at dusk." },
      ],
      next: "hub",
    },
    {
      id: "scarabs",
      lines: [
        { speaker: "Sahra", text: "The scarabs are older than my order." },
        { speaker: "Sahra", text: "Steel bites them; patience bites deeper." },
        { speaker: "Sahra", text: "Guard well when their wings hum." },
      ],
      next: "hub",
    },
    {
      id: "farewell",
      lines: [
        { speaker: "Sahra", text: "Go, then. Walk soft on the old sand." },
        { speaker: "Sahra", text: "The desert keeps its secrets... mostly." },
      ],
    },
  ],
};
