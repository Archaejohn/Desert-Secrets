import type { DialogueScript } from "../dialogue";

/**
 * The FIRST cast at the silverfin fishing spot — the pacing fix. The player
 * casts before anything happens: the line drifts, then snaps taut on
 * something far too heavy to be a silverfin. This is what sets up the Lurker
 * stealing the lure (the `lurkerIntro` beat + the mini-boss fight run right
 * after this closes). Linear; terminal id `taut`.
 */
export const seaFirstCastScript: DialogueScript = {
  start: "cast",
  nodes: [
    {
      id: "cast",
      lines: [
        { speaker: "Joseph", text: "Silverfin water. Let's try a cast." },
        { speaker: "", text: "You bait the hook and cast into the dark." },
        { speaker: "", text: "The line drifts. Nothing... then it snaps taut." },
        { speaker: "Joseph", text: "A bite! No — too heavy. Way too heavy—" }
      ]
    }
  ]
};
