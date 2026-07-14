/**
 * Slither — a jade whipsnake, 16×16, one row of 6 frames, facing RIGHT
 * (world code flips the sprite for leftward movement).
 *
 * Frames 0–1 idle: coiled with the head resting on top of the loops; frame 1
 * lifts the head a pixel and flicks a forked rust tongue. Frames 2–5 move:
 * a 4-frame S-curve undulation — every body column rides a travelling wave
 * so the phase visibly rolls down the body from tail to head.
 *
 * Colourway: jade back with teal banding, mint belly, amber eye, ink outline.
 */
import { PixelGrid } from "../grid";

export const SLITHER_FRAME = 16;

/** Travelling-wave vertical offsets (period 8 half-columns, amplitude 2). */
const WAVE = [0, 1, 2, 1, 0, -1, -2, -1] as const;

/** Coiled idle. `lift` raises the head a pixel; `flick` shows the tongue. */
function drawCoil(lift: 0 | 1, flick: boolean): PixelGrid {
  const g = new PixelGrid(SLITHER_FRAME, SLITHER_FRAME);

  // outer loop of the coil
  g.rect(3, 11, 10, 2, "jade");
  g.rect(3, 13, 10, 1, "teal"); // shaded underside
  g.px(4, 13, "mint"); // belly scales peeking out
  g.px(7, 13, "mint");
  g.px(10, 13, "mint");
  // middle loop with a shaded gap under it
  g.rect(4, 8, 8, 2, "jade");
  g.rect(4, 10, 8, 1, "teal");
  // top loop rising into the neck
  g.rect(6, 6, 5, 2, "jade");
  // teal banding across the loops
  g.px(5, 11, "teal");
  g.px(8, 11, "teal");
  g.px(11, 11, "teal");
  g.px(6, 8, "teal");
  g.px(9, 8, "teal");
  g.px(7, 6, "teal");
  // tail tip escaping the coil on the left
  g.px(2, 10, "teal");
  g.px(2, 11, "jade");

  // head resting on top, facing right
  const hy = 4 - lift;
  g.rect(9, hy, 4, 2, "jade");
  g.px(12, hy, "amber"); // eye
  g.px(9, hy + 1, "teal");
  g.px(10, hy + 1, "mint"); // chin
  g.px(9, hy + 2, "jade"); // neck joining the top loop
  g.px(10, hy + 2, "jade");

  if (flick) {
    g.px(13, hy, "rust"); // forked tongue
    g.px(14, hy - 1, "rust");
    g.px(14, hy + 1, "rust");
  }

  g.outline("ink");
  return g;
}

/** S-curve undulation, phase 0–3. The wave travels one step per frame. */
function drawSlither(phase: number): PixelGrid {
  const g = new PixelGrid(SLITHER_FRAME, SLITHER_FRAME);
  const wave = (x: number): number => WAVE[(Math.floor(x / 2) + phase * 2) % 8];

  // body columns, tail (x1) to neck (x11)
  for (let x = 1; x <= 11; x++) {
    const yc = 9 + wave(x);
    if (x <= 2) {
      g.px(x, yc, "teal"); // tapering tail
    } else {
      g.px(x, yc, x % 3 === 0 ? "teal" : "jade"); // banded back
      g.px(x, yc + 1, "mint"); // belly
    }
  }

  // head, riding the wave front
  const yh = 9 + wave(12);
  g.rect(12, yh - 1, 4, 1, "jade");
  g.rect(12, yh, 4, 1, "jade");
  g.rect(12, yh + 1, 4, 1, "mint"); // jaw
  g.px(14, yh, "amber"); // eye
  g.px(12, yh + 1, "teal"); // neck shade

  g.outline("ink");
  return g;
}

/** All 6 frames: 0–1 coiled idle with tongue flick, 2–5 undulation. */
export function slitherFrames(): PixelGrid[] {
  return [drawCoil(0, false), drawCoil(1, true), drawSlither(0), drawSlither(1), drawSlither(2), drawSlither(3)];
}
