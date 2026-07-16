/**
 * Midden Mite — 16×16 camp pest, seen from above. Small and numerous:
 * they nest in the miners' laundry nook by the dozen, so the silhouette is
 * deliberately tiny (a rounded mauve/rust body barely half the tile) with a
 * scatter of thin ink legs and a single amber eye-glint.
 *
 * Frames: 0–1 idle (antenna twitch + shell glint), 2–5 scuttle (legs
 * alternate in a fast tripod with a 1px body bounce). Drawn body-first and
 * ink-outlined; legs/antennae are stamped AFTER the outline so they stay a
 * single pixel thin (same discipline as scarab.ts).
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const MIDDENMITE_FRAME = 16;

interface MitePose {
  /** Antenna splay: 0 tucked, 1 flared. */
  antenna: 0 | 1;
  /** White glint on the shell. */
  glint: boolean;
  /** Leg phase: neutral, or alternating A/B tripod. */
  legs: "stand" | "A" | "B";
  /** 1 = body bounced up a pixel. */
  hop: 0 | 1;
}

const POSES: readonly MitePose[] = [
  { antenna: 0, glint: false, legs: "stand", hop: 0 }, // 0 idle A
  { antenna: 1, glint: true, legs: "stand", hop: 0 }, // 1 idle B
  { antenna: 0, glint: false, legs: "A", hop: 0 }, // 2 scuttle
  { antenna: 1, glint: false, legs: "B", hop: 1 }, // 3
  { antenna: 0, glint: false, legs: "A", hop: 1 }, // 4
  { antenna: 1, glint: false, legs: "B", hop: 0 }, // 5
];

/** One thin leg from (x, y). dir: -1 left, +1 right. phase: -1 back / 0 / +1. */
function leg(g: PixelGrid, x: number, y: number, dir: number, phase: number): void {
  g.px(x + dir, y, "ink");
  g.px(x + dir * 2, y + (phase === 0 ? 1 : -phase), "ink");
}

function drawMite(p: MitePose): PixelGrid {
  const g = new PixelGrid(MIDDENMITE_FRAME, MIDDENMITE_FRAME);
  const dy = -p.hop;

  // little rounded abdomen (mauve) with a rust saddle
  g.rect(6, 7 + dy, 5, 4, "mauve");
  g.rect(5, 8 + dy, 7, 2, "mauve");
  g.rect(7, 6 + dy, 3, 1, "mauve");
  g.rect(7, 8 + dy, 3, 2, "rust"); // dorsal saddle
  g.px(6, 8 + dy, "plum"); // shade
  g.px(11, 10 + dy, "plum");

  // head nub (plum) with a single amber eye
  g.rect(7, 5 + dy, 3, 2, "plum");
  g.px(8, 6 + dy, "amber"); // eye

  // shell glint on idle B
  if (p.glint) {
    g.px(9, 7 + dy, "white");
    g.px(10, 8 + dy, "sand");
  }

  rimTopLeft(g, { x: 4, y: 5 + dy, w: 8, h: 4 }); // light on the little shell
  selOut(g);

  // six thin legs, tripod gait
  const attachY = [8, 10];
  attachY.forEach((y, i) => {
    let left = 0;
    let right = 0;
    if (p.legs !== "stand") {
      const a = p.legs === "A" ? 1 : -1;
      left = i % 2 === 0 ? a : -a;
      right = -left;
    }
    leg(g, 5, y + dy, -1, left); // shell edge x6 → outline x5
    leg(g, 10, y + dy, 1, right);
  });
  // rear pair
  {
    const a = p.legs === "A" ? -1 : p.legs === "B" ? 1 : 0;
    leg(g, 6, 11 + dy, -1, a);
    leg(g, 9, 11 + dy, 1, -a);
  }

  // antennae
  g.px(7, 4 + dy, "ink");
  g.px(9, 4 + dy, "ink");
  if (p.antenna === 0) {
    g.px(6, 3 + dy, "ink");
    g.px(10, 3 + dy, "ink");
  } else {
    g.px(5, 3 + dy, "ink");
    g.px(11, 3 + dy, "ink");
  }

  return g;
}

/** All 6 frames: 0–1 idle, 2–5 scuttle. */
export function middenmiteFrames(): PixelGrid[] {
  return POSES.map(drawMite);
}
