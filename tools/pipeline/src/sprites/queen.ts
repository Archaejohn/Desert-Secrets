/**
 * Queen — the Dust Queen, a 32×32 monarch scarab seen from above.
 *
 * She should feel massive: a carapace spanning nearly the whole frame,
 * mauve over rust with plum depth, a crown of jade gems across the head,
 * bone mandibles reaching forward, and eight heavy legs. Frames: 0–1 idle
 * (slow breathing — the whole carapace swells one pixel and the crown
 * gems glint), 2–5 leg churn (two diagonal leg sets alternate while the
 * mandibles work; the bulk barely bobs — mass, not skitter).
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const QUEEN_FRAME = 32;

interface QueenPose {
  /** 1 = carapace swollen a pixel wider/taller (slow breath). */
  breath: 0 | 1;
  /** Crown gems glint. */
  glint: boolean;
  /** Leg phase: planted, or the two alternating diagonal sets. */
  legs: "stand" | "A" | "B";
  /** Mandibles: 0 closed, 1 spread open. */
  mandible: 0 | 1;
}

const QUEEN_POSES: readonly QueenPose[] = [
  { breath: 0, glint: false, legs: "stand", mandible: 0 }, // 0 idle A: exhale
  { breath: 1, glint: true, legs: "stand", mandible: 0 }, // 1 idle B: inhale, crown glints
  { breath: 0, glint: false, legs: "A", mandible: 1 }, // 2 churn
  { breath: 0, glint: true, legs: "B", mandible: 0 }, // 3
  { breath: 1, glint: false, legs: "A", mandible: 1 }, // 4
  { breath: 0, glint: false, legs: "B", mandible: 0 } // 5
];

/** One heavy leg: two pixels thick at the haunch, clawed. */
function heavyLeg(g: PixelGrid, x: number, y: number, dir: number, phase: number): void {
  g.px(x + dir, y, "ink");
  g.px(x + dir, y + 1, "ink"); // thick haunch
  g.px(x + dir * 2, y - phase, "ink");
  g.px(x + dir * 3, y - phase, "ink");
  g.px(x + dir * 4, y + 1 - phase * 2, "ink"); // claw
}

function drawQueen(p: QueenPose): PixelGrid {
  const g = new PixelGrid(QUEEN_FRAME, QUEEN_FRAME);
  const b = p.breath;

  // --- head: broad, crowned ---
  g.rect(11, 5, 10, 4, "plum");
  g.rect(12, 4, 8, 1, "plum");
  g.px(13, 6, "bone"); // eyes wide apart
  g.px(18, 6, "bone");
  // jade gem crown across the brow
  g.rect(12, 3, 8, 1, "jade");
  g.px(13, 2, "jade"); // crown points
  g.px(15, 2, "jade");
  g.px(17, 2, "jade");
  g.px(15, 1, "jade"); // central spire
  if (p.glint) {
    g.px(13, 2, "mint");
    g.px(15, 1, "white");
    g.px(17, 2, "mint");
    g.px(14, 3, "mint");
  }

  // --- bone mandibles reaching forward ---
  const m = p.mandible;
  g.px(12 - m, 4, "bone");
  g.px(11 - m, 3, "bone");
  g.px(11 - m * 2, 2, "bone");
  g.px(10 - m * 2, 1, "bone");
  g.px(19 + m, 4, "bone");
  g.px(20 + m, 3, "bone");
  g.px(20 + m * 2, 2, "bone");
  g.px(21 + m * 2, 1, "bone");

  // --- pronotum collar ---
  g.rect(9 - b, 9, 14 + 2 * b, 3, "mauve");
  g.rect(9 - b, 9, 5, 1, "sand"); // lit rim
  g.px(22 + b, 11, "plum");

  // --- carapace: vast, rounded, swells with the breath ---
  g.rect(7 - b, 12, 18 + 2 * b, 1, "mauve");
  g.rect(6 - b, 13, 20 + 2 * b, 12 + b, "mauve"); // main bulk, y13..24(+b)
  g.rect(7 - b, 25 + b, 18 + 2 * b, 2, "mauve");
  g.rect(9 - b, 27 + b, 14 + 2 * b, 1, "mauve");
  g.rect(11, 28 + b, 10, 1, "mauve");
  // rust underplate showing at the skirts
  g.rect(6 - b, 22, 3, 3, "rust");
  g.rect(23 + b, 22, 3, 3, "rust");
  g.rect(9 - b, 26 + b, 4, 1, "rust");
  g.rect(19, 26 + b, 4 + b, 1, "rust");
  // top-left light across the dome
  g.rect(7 - b, 13, 4, 1, "clay");
  g.rect(6 - b, 14, 2, 4, "clay");
  g.px(8 - b, 14, "sand");
  g.px(7 - b, 15, "sand");
  // plum depth down the right flank and skirt
  for (let y = 14; y <= 24; y++) g.px(25 + b, y, "plum");
  g.rect(20, 27 + b, 3, 1, "plum");
  // carapace split with royal chevrons
  for (let y = 12; y <= 28 + b; y++) g.px(15, y, "ink");
  for (let y = 12; y <= 28 + b; y++) g.px(16, y, "ink");
  g.px(14, 16, "plum"); // chevron ticks
  g.px(17, 16, "plum");
  g.px(13, 20, "plum");
  g.px(18, 20, "plum");
  g.px(14, 24, "plum");
  g.px(17, 24, "plum");
  // a dorsal jade gem — the queen's hoard set into her own shell
  g.rect(14, 17, 4, 3, "jade");
  g.px(14, 17, "mint");
  if (p.glint) g.px(16, 18, "white");
  // umber depth pooling under the skirt (G1 shade low/right)
  g.rect(12, 28 + b, 8, 1, "umber");
  g.px(24 + b, 25, "plum");
  g.px(23 + b, 26 + b, "plum");

  rimTopLeft(g, { x: 8 - b, y: 0, w: 14, h: 6 }); // crown + brow catch the light
  selOut(g);

  // --- eight heavy legs, alternating diagonal sets ---
  const attachY = [13, 17, 21, 25];
  attachY.forEach((y, i) => {
    let left = 0;
    let right = 0;
    if (p.legs !== "stand") {
      const a = p.legs === "A" ? 1 : -1;
      left = i % 2 === 0 ? a : -a;
      right = -left;
    }
    leftRight(g, y + (i === 3 ? b : 0), b, left, right);
  });

  return g;
}

function leftRight(g: PixelGrid, y: number, b: 0 | 1, left: number, right: number): void {
  heavyLeg(g, 5 - b, y, -1, left);
  heavyLeg(g, 26 + b, y, 1, right);
}

/** All 6 frames: 0–1 slow breathing idle, 2–5 leg churn. */
export function queenFrames(): PixelGrid[] {
  return QUEEN_POSES.map(drawQueen);
}
