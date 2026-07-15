import type { DialogueScript } from "../dialogue";

/**
 * Act 4, Zone 4 entry — the Back Gallery. A disused drift climbing out of the
 * camp, where Piggy's night-raid frost tracks lead up toward a high ledge.
 * Grounds the climb and states where it goes (up, after the gray watcher). The
 * scene sets `sawGallery` on close.
 */
export const campGalleryEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "An old drift climbs up out of the camp." },
        { speaker: "Slither", text: "The frosst tracks go up. Ssomeone watches." },
        { speaker: "Joseph", text: "The gray one again? Let's climb and see." },
      ],
    },
  ],
};
