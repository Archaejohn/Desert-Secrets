import type { DialogueScript } from "../dialogue";

/**
 * Act 2, the crevasse — Mo, first of the lost Cinnabar miners, stranded
 * down a dead-end pocket. Relief, a wayfinding hint (lantern posts mark
 * true junctions), and the tomato-pie seed for Act 5. The scene sets the
 * minerMo flag and awards XP when this script finishes.
 */
export const minerMoScript: DialogueScript = {
  start: "found",
  nodes: [
    {
      id: "found",
      lines: [
        { speaker: "Mo", text: "A face! A living face! Don't move—" },
        { speaker: "Mo", text: "no, DO move. Over here. Mind the hole." },
        { speaker: "Mo", text: "Mo. Cinnabar crew. Been down a while." },
        { speaker: "Joseph", text: "The crew that vanished? Years back?" },
        { speaker: "Mo", text: "Vanished, nothing. We got TURNED AROUND." },
      ],
      next: "hint",
    },
    {
      id: "hint",
      lines: [
        { speaker: "Joseph", text: "How do I get through this ice?" },
        { speaker: "Mo", text: "Watch the lantern posts. We lit the true" },
        { speaker: "Mo", text: "junctions before we scattered. Trust amber." },
        { speaker: "Mo", text: "A hall that feels familiar IS familiar." },
      ],
      next: "seed",
    },
    {
      id: "seed",
      lines: [
        { speaker: "Mo", text: "And I'll swear to this: some nights the" },
        { speaker: "Mo", text: "deep vents smell like hot tomato pie." },
        { speaker: "Joseph", text: "You've been down here too long, Mo." },
        { speaker: "Mo", text: "Long enough to know a pie when I smell it." },
        { speaker: "Mo", text: "I'll head for your camp. Find the others!" },
      ],
    },
  ],
};
