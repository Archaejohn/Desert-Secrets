/**
 * Reef Eel — 24×24 kelp-forest predator, seen side-on and facing LEFT (the
 * battle scene flips enemies to face the party).
 *
 * A long jade/teal serpentine body threaded diagonally across the frame, a
 * snapping bone-toothed head at the lower-left, mint underbelly glow, amber
 * eye. Frames 0–1 idle (jaw + belly-glow pulse), 2–5 swim (S-curve
 * undulation shifting the body waypoints). Colourway: teal body, jade lit
 * ridge, mint belly, bone teeth, amber eye, ink outline.
 */
import { PixelGrid } from "../grid";

export const REEFEEL_FRAME = 24;

interface EelPose {
  /** Undulation phase shifts the mid-body waypoints. */
  wave: 0 | 1 | 2 | 3;
  /** Jaw open (idle snap + swim). */
  jaw: 0 | 1;
  /** Belly bioluminescence pulses. */
  glow: boolean;
}

const EEL_POSES: readonly EelPose[] = [
  { wave: 0, jaw: 0, glow: false }, // 0 idle A
  { wave: 0, jaw: 1, glow: true }, // 1 idle B: snap + glow
  { wave: 1, jaw: 1, glow: false }, // 2 swim
  { wave: 2, jaw: 0, glow: true },
  { wave: 3, jaw: 1, glow: false },
  { wave: 2, jaw: 0, glow: true }
];

/** A 2px-thick body segment centred on (x,y) with jade ridge + mint belly. */
function segment(g: PixelGrid, x: number, y: number, glow: boolean): void {
  g.px(x, y, "teal");
  g.px(x, y + 1, "teal");
  g.px(x, y - 1, "jade"); // lit dorsal ridge
  g.px(x, y + 2, glow ? "mint" : "teal"); // belly glow
}

function drawEel(p: EelPose): PixelGrid {
  const g = new PixelGrid(REEFEEL_FRAME, REEFEEL_FRAME);
  const w = p.wave;

  // Body waypoints trace an S from the head (lower-left) up to the tail
  // (upper-right); the mid waypoints ride a sine that shifts with `wave`.
  const amp = [0, 1, 0, -1][w];
  const path: Array<[number, number]> = [];
  for (let x = 6; x <= 21; x++) {
    const t = (x - 6) / 15;
    // base diagonal climb + undulation
    const y = Math.round(15 - t * 8 + Math.sin((t * Math.PI * 2) + w) * 1.4 + (x % 2 === 0 ? amp : 0));
    path.push([x, y]);
  }
  for (const [x, y] of path) segment(g, x, y, p.glow);

  // --- head at the lower-left, snapping jaw ---
  const hx = 5;
  const hy = 15;
  g.rect(hx - 3, hy - 2, 5, 4, "teal");
  g.px(hx - 3, hy - 2, "jade"); // lit crown
  g.px(hx - 2, hy - 2, "jade");
  g.px(hx - 1, hy - 1, "amber"); // eye
  // jaw
  const j = p.jaw;
  g.px(hx - 3, hy + 2 + j, "teal");
  g.px(hx - 2, hy + 2 + j, "teal");
  g.px(hx - 4, hy, "ink"); // maw depth
  g.px(hx - 4, hy + 1 + j, "ink");
  // bone fangs
  g.px(hx - 3, hy, "bone");
  g.px(hx - 3, hy + 2 + j, "bone");

  // --- tail fin, upper-right ---
  const [tx, ty] = path[path.length - 1];
  g.px(tx + 1, ty - 1, "jade");
  g.px(tx + 2, ty - 2, "jade");
  g.px(tx + 1, ty + 1, "teal");
  g.px(tx + 2, ty + 2, "teal");

  // --- a couple of dorsal frill spurs ---
  g.px(path[6][0], path[6][1] - 2, "mint");
  g.px(path[10][0], path[10][1] - 2, "mint");

  g.outline("ink");
  return g;
}

/** All 6 frames: 0–1 idle (snap + glow), 2–5 undulating swim. */
export function reefeelFrames(): PixelGrid[] {
  return EEL_POSES.map(drawEel);
}
