import type { DialogueScript } from "../dialogue";

/**
 * Act 2, the ice maze — first meeting with Slither at the too-narrow
 * crack. Shy at first, then he offers to slip through and open the
 * shortcut from the other side. The scene sets metSlither and
 * mazeShortcutOpen when the script ends at the terminal node
 * "scout-end" (contract id).
 */
export const slitherMeetScript: DialogueScript = {
  start: "peek",
  nodes: [
    {
      id: "peek",
      lines: [
        { speaker: "???", text: "Hsss. A warm one. Don't ssstomp so." },
        { speaker: "Joseph", text: "...A snake. A talking snake." },
        { speaker: "???", text: "A jade whipsssnake, thank you very much." },
        { speaker: "Slither", text: "Ssslither. Ressident. You are lossst." },
      ],
      choices: [
        { text: "I'm following a penguin", next: "penguin" },
        { text: "Can you open this crack?", next: "crack" },
      ],
    },
    {
      id: "penguin",
      lines: [
        { speaker: "Slither", text: "The little waddler? Yesss, I've ssseen" },
        { speaker: "Slither", text: "him. Fassster than he looks, that one." },
        { speaker: "Joseph", text: "Then I need a shortcut. This crack?" },
      ],
      next: "crack",
    },
    {
      id: "crack",
      lines: [
        { speaker: "Slither", text: "For me? A road. For you? A wissh." },
        { speaker: "Slither", text: "Ssstand back. I'll ssslip through and" },
        { speaker: "Slither", text: "shove the loosse ssslab from inssside." },
      ],
      next: "scout-end",
    },
    {
      id: "scout-end",
      lines: [
        { speaker: "", text: "(A scrape. A thud. The crack widens.)" },
        { speaker: "Slither", text: "There. Passsage open. Don't thank me." },
        { speaker: "Slither", text: "...You may thank me a little." },
      ],
    },
  ],
};
