import type { DialogueScript } from "../dialogue";

/**
 * Act 4, Zone 3 entry — the Laundry Nook. The damp corner where the washing
 * hangs and the midden mites have nested. Grounds the pocket and names the
 * task (clear the nest for the socks). The scene sets `sawNook` on close.
 */
export const laundryNookEntryScript: DialogueScript = {
  start: "arrive",
  nodes: [
    {
      id: "arrive",
      lines: [
        { speaker: "", text: "The laundry nook. Damp, and it seethes." },
        { speaker: "Slither", text: "Midden mites. A whole nesst of them." },
        { speaker: "Joseph", text: "Clear these out and the socks are ours." },
      ],
    },
  ],
};
