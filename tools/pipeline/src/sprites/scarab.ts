/**
 * Scarab — 24×24 giant beetle battle enemy, seen from above.
 *
 * Rust/clay carapace split down the middle, jade gem set in the shell,
 * plum head with bone eyes, six ink legs (tripod gait) and antennae.
 * Frames: 0–1 idle (antenna twitch + gem glint), 2–5 skitter (legs
 * alternate, 1px body bounce).
 *
 * Body fills are drawn first and outlined; legs and antennae are drawn
 * *after* the outline pass so they stay a single pixel thin.
 */
import { PixelGrid } from "../grid";

export const SCARAB_FRAME = 24;

interface BugPose {
  /** Antenna position: 0 = tucked, 1 = splayed (twitch). */
  antenna: 0 | 1;
  /** White glint on the jade gem + warm shimmer on the shell. */
  glint: boolean;
  /** Leg phase: neutral stand, or alternating tripod poses A/B. */
  legs: "stand" | "A" | "B";
  /** 1 = whole body bounced up one pixel (skitter wobble). */
  hop: 0 | 1;
}

const BUG_POSES: readonly BugPose[] = [
  { antenna: 0, glint: false, legs: "stand", hop: 0 }, // 0 idle A
  { antenna: 1, glint: true, legs: "stand", hop: 0 }, // 1 idle B
  { antenna: 0, glint: false, legs: "A", hop: 0 }, // 2 skitter
  { antenna: 1, glint: false, legs: "B", hop: 1 }, // 3
  { antenna: 0, glint: false, legs: "A", hop: 1 }, // 4
  { antenna: 1, glint: false, legs: "B", hop: 0 } // 5
];

/** One thin leg from the shell edge at (x, y). dir: -1 = left, +1 = right.
 *  phase: -1 back, 0 neutral, +1 forward. */
function leg(g: PixelGrid, x: number, y: number, dir: number, phase: number): void {
  g.px(x + dir, y, "ink");
  g.px(x + dir * 2, y + (phase === 0 ? 0 : -phase), "ink");
  g.px(x + dir * 3, y + (phase === 0 ? 1 : -phase * 2), "ink");
}

function drawScarab(p: BugPose): PixelGrid {
  const g = new PixelGrid(SCARAB_FRAME, SCARAB_FRAME);
  const dy = -p.hop;

  // head
  g.rect(9, 5 + dy, 6, 3, "plum");
  g.px(10, 6 + dy, "bone"); // eyes
  g.px(13, 6 + dy, "bone");

  // pronotum
  g.rect(8, 8 + dy, 8, 2, "rust");
  g.rect(8, 8 + dy, 3, 1, "clay");

  // elytra (rounded shell)
  g.rect(7, 10 + dy, 10, 1, "rust");
  g.rect(6, 11 + dy, 12, 7, "rust");
  g.rect(7, 18 + dy, 10, 1, "rust");
  g.rect(8, 19 + dy, 8, 1, "rust");
  g.rect(9, 20 + dy, 6, 1, "rust");
  // top-left light
  g.rect(7, 10 + dy, 3, 1, "clay");
  g.rect(6, 11 + dy, 2, 3, "clay");
  g.px(8, 11 + dy, "amber");
  g.px(7, 12 + dy, "amber");
  // wing-case split
  for (let y = 10; y <= 20; y++) g.px(12, y + dy, "ink");

  // jade gem set over the split
  g.rect(10, 13 + dy, 4, 3, "jade");
  g.px(10, 13 + dy, "mint");
  g.px(11, 13 + dy, "mint");
  if (p.glint) {
    g.px(12, 14 + dy, "white");
    g.px(15, 12 + dy, "clay"); // warm shimmer sliding across the shell
  }

  g.outline("ink");

  // six legs, tripod gait: alternate legs move on opposite phases
  const attachY = [12, 15, 18];
  attachY.forEach((y, i) => {
    let left = 0;
    let right = 0;
    if (p.legs !== "stand") {
      const a = p.legs === "A" ? 1 : -1;
      left = i % 2 === 0 ? a : -a;
      right = -left;
    }
    leg(g, 5, y + dy, -1, left); // shell edge x6 → outline x5
    leg(g, 18, y + dy, 1, right);
  });

  // antennae
  g.px(9, 4 + dy, "ink");
  g.px(14, 4 + dy, "ink");
  if (p.antenna === 0) {
    g.px(8, 3 + dy, "ink");
    g.px(15, 3 + dy, "ink");
  } else {
    g.px(7, 3 + dy, "ink");
    g.px(16, 3 + dy, "ink");
  }

  return g;
}

/** All 6 frames: 0–1 idle, 2–5 skitter. */
export function scarabFrames(): PixelGrid[] {
  return BUG_POSES.map(drawScarab);
}
