/**
 * Anglerfish — 24×24 deep-sea predator of the Sunless Sea, seen side-on and
 * facing LEFT (the battle scene flips enemies to face the party).
 *
 * A bulbous indigo/tealDeep body, a gaping bone-toothed jaw, and the
 * signature lure: an amber esca on a stalk arcing over the head, glowing
 * mint→white. Frames 0–1 idle (lure pulse + gill breath), 2–5 swim (tail
 * sweep + body undulation). Colourway: indigo body, slate belly-shade,
 * skyBlue lit flank, bone teeth, amber/mint lure, ink outline.
 */
import { PixelGrid } from "../grid";

export const ANGLERFISH_FRAME = 24;

interface AnglerPose {
  breath: 0 | 1;
  tail: -1 | 0 | 1;
  /** Lure glow: false amber core, true white flare. */
  flare: boolean;
}

const ANGLER_POSES: readonly AnglerPose[] = [
  { breath: 0, tail: 0, flare: false }, // 0 idle A
  { breath: 1, tail: 0, flare: true }, // 1 idle B: gill breath, lure flares
  { breath: 0, tail: -1, flare: false }, // 2 swim
  { breath: 1, tail: 1, flare: true },
  { breath: 0, tail: -1, flare: false },
  { breath: 1, tail: 1, flare: false }
];

function drawAngler(p: AnglerPose): PixelGrid {
  const g = new PixelGrid(ANGLERFISH_FRAME, ANGLERFISH_FRAME);
  const b = p.breath;

  // --- bulbous body (facing left: jaw at the left) ---
  g.rect(7, 9, 12, 8 + b, "indigo");
  g.rect(8, 8, 9, 1, "indigo"); // rounded top
  g.rect(8, 17 + b, 9, 1, "indigo"); // rounded belly
  // skyBlue light along the upper flank
  g.rect(9, 9, 7, 1, "skyBlue");
  g.px(10, 10, "skyBlue");
  // slate belly shade
  g.rect(9, 16 + b, 7, 1, "slate");

  // --- gaping jaw at the left, bone fangs ---
  g.rect(3, 11, 5, 5, "indigo"); // lower jaw block
  g.px(3, 12, "ink"); // maw depth
  g.px(4, 13, "ink");
  g.px(5, 14, "ink");
  // upper + lower fangs
  g.px(4, 11, "bone");
  g.px(6, 11, "bone");
  g.px(5, 15, "bone");
  g.px(7, 15, "bone");
  // eye
  g.px(9, 11, "mint");
  g.px(9, 12, "ink");

  // --- the lure: stalk arcing over the head to a glowing esca ---
  g.px(11, 7, "slate");
  g.px(9, 6, "slate");
  g.px(7, 5, "slate");
  g.px(5, 5, "slate");
  const escaX = 4;
  const escaY = 5;
  g.px(escaX, escaY, p.flare ? "white" : "amber");
  g.px(escaX - 1, escaY, "amber");
  g.px(escaX, escaY - 1, "amber");
  g.px(escaX + 1, escaY, "mint");
  if (p.flare) {
    g.px(escaX, escaY + 1, "mint");
    g.px(escaX - 1, escaY - 1, "mint");
  }

  // --- dorsal + pectoral fins (teal) ---
  g.px(14, 7, "teal");
  g.px(16, 7, "teal");
  g.px(15, 6, "teal");
  g.px(12, 15 + b, "teal"); // pectoral
  g.px(13, 16 + b, "teal");

  // --- tail at the right, sweeps with the swim ---
  const t = p.tail;
  g.rect(19, 10 + t, 2, 6, "indigo");
  g.px(21, 9 + t, "teal");
  g.px(22, 8 + t, "teal");
  g.px(21, 16 + t, "teal");
  g.px(22, 17 + t, "teal");
  g.px(20, 12 + t, "skyBlue");

  g.outline("ink");
  return g;
}

/** All 6 frames: 0–1 idle (lure pulse), 2–5 swim. */
export function anglerfishFrames(): PixelGrid[] {
  return ANGLER_POSES.map(drawAngler);
}
