import type { DialogueScript } from "../dialogue";

/**
 * Beat 1 — the crash site. Rosa Delgado, the transport driver, sets the
 * stakes and hands over the radio and cold pack (the scene sets the
 * gotColdPack flag when this script finishes).
 * Lines are kept short (~48 chars) to fit a 3-line text box.
 */
export const rosaCrashScript: DialogueScript = {
  start: "greet",
  nodes: [
    {
      id: "greet",
      lines: [
        { speaker: "Rosa", text: "Hey! Careful, the trailer's still settling." },
        { speaker: "Rosa", text: "Rosa Delgado. Aquarium transport. Was." },
        { speaker: "Joseph", text: "Huh. Haven't heard from Thomas all day." },
        { speaker: "Rosa", text: "One crate broke open. The small one." },
      ],
      next: "piggy",
    },
    {
      id: "piggy",
      lines: [
        { speaker: "Rosa", text: "Baby emperor penguin. We call him Piggy." },
        { speaker: "Rosa", text: "He waddled off before I got my belt off." },
        { speaker: "Joseph", text: "A penguin. In the Mojave. At dusk." },
        { speaker: "Rosa", text: "I know how it sounds. Look at the crate." },
      ],
      choices: [
        { text: "Inspect the crate", next: "feather" },
        { text: "I'll start looking", next: "coldpack" },
      ],
    },
    {
      id: "feather",
      lines: [
        { speaker: "Joseph", text: "There's a feather here. It's iced over." },
        { speaker: "Rosa", text: "Yeah. And it isn't melting. Explain that." },
        { speaker: "Joseph", text: "I can't. Not yet." },
      ],
      next: "coldpack",
    },
    {
      id: "coldpack",
      lines: [
        { speaker: "Rosa", text: "Take my radio. And this cold pack." },
        { speaker: "Rosa", text: "He's a baby. He has hours, not days." },
        { speaker: "Joseph", text: "I know these flats. I'll bring him home." },
      ],
      next: "go",
    },
    {
      id: "go",
      lines: [
        { speaker: "Rosa", text: "Frost doesn't lie. Follow it. Go!" },
      ],
    },
  ],
};
