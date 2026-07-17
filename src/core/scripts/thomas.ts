import type { DialogueScript } from "../dialogue";

/**
 * The Thomas radio thread — a Part-One-long through-line that seeds Part Two.
 *
 * Thomas is the friend Joseph keeps just missing (Rosa and John both mention
 * him). He carries the twin of John's hand radio, and his voice breaks in
 * ONE-WAY across the game: garbled at first, clearing as Joseph closes the
 * distance, until Part Two opens with the two of them finally connecting.
 * Joseph calls back every time, but his replies never get through — the drama
 * is the near-miss.
 *
 * Two pieces:
 * - `thomasMineScript` — first contact, in the mine's foreman room (a one-time
 *   broken transmission; MineScene guards it with `heardThomasMine`). Joseph
 *   realizes it's Thomas, asks him to repeat, and gets only static back.
 * - `THOMAS_FRAGMENTS` + `nextThomasFragment` — the sporadic later catches. An
 *   ordered, escalating list, each gated by its own flag so it fires once;
 *   `nextThomasFragment(flags)` hands back the first unheard fragment. Scenes
 *   at key story beats call it after their own beat closes (see
 *   ZoneScene.playNextThomas). No off-world hints — that's Part 3 (CLAUDE.md).
 */
export const thomasMineScript: DialogueScript = {
  start: "call",
  nodes: [
    {
      id: "call",
      lines: [
        { speaker: "", text: "The radio crackles, then a voice breaks in:" },
        { speaker: "", text: "\"Joseph... *hiss crackle*\"" },
        { speaker: "Joseph", text: "That voice — Thomas?! Thomas, come in!" },
        { speaker: "", text: "Only static answers. But it was him." },
        { speaker: "Joseph", text: "He's alive. I'm on the right trail." },
      ],
    },
  ],
};

export interface ThomasFragment {
  /** State flag set once this fragment has played (fires only once). */
  flag: string;
  script: DialogueScript;
}

function fragment(flag: string, lines: DialogueScript["nodes"][number]["lines"]): ThomasFragment {
  return { flag, script: { start: "frag", nodes: [{ id: "frag", lines }] } };
}

/**
 * The sporadic one-way catches, in escalating order (garbled → nearly clear).
 * Consumed front-to-back as the player hits successive key beats: fragments
 * are matched to beats POSITIONALLY (nth beat reached → nth fragment), NOT
 * bound to any specific scene, so keep this list 1:1 with the hook sites that
 * call `ZoneScene.playNextThomas()` — currently three, in mandatory play
 * order: SeaAscent (Act 3) → GroveDescent (Act 5) → PizzaAscent (Act 7). Add a
 * fragment for any new hook, and mind that the copy escalates toward "he's
 * near," so a new beat belongs at the position its wording fits.
 */
export const THOMAS_FRAGMENTS: ThomasFragment[] = [
  fragment("thomasFrag1", [
    { speaker: "", text: "The radio spits to life for a moment:" },
    { speaker: "", text: "\"...seph? ...you... *crackle pop*\"" },
    { speaker: "Joseph", text: "Thomas! I hear you — where are you?" },
    { speaker: "", text: "No answer. The signal's gone again." },
  ]),
  fragment("thomasFrag2", [
    { speaker: "", text: "Static swells, then a broken voice:" },
    { speaker: "", text: "\"...found... something down... *hiss*\"" },
    { speaker: "Joseph", text: "Found what? Thomas, say again!" },
    { speaker: "", text: "Silence. He can't hear you calling back." },
  ]),
  fragment("thomasFrag3", [
    { speaker: "", text: "The radio clears — closer now, almost here:" },
    { speaker: "", text: "\"Joseph, I'm close. Keep... *pop*\"" },
    { speaker: "Joseph", text: "I'm coming, Thomas! Hold on!" },
    { speaker: "", text: "The line dies. But he's near. So near." },
  ]),
];

/** The first fragment whose flag isn't set yet, or null once all are heard. */
export function nextThomasFragment(
  flags: Record<string, boolean>,
): ThomasFragment | null {
  return THOMAS_FRAGMENTS.find((f) => !flags[f.flag]) ?? null;
}
