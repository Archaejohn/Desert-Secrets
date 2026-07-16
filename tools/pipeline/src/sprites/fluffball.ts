/**
 * Fluffball — the second chick penguin, a round GRAY puff.
 *
 * 16×16, one row of 6 frames, built on the same waddle machinery as Piggy
 * (sway / lean / hop / stepping feet) but with an even rounder silhouette:
 * head and body are one downy mass with no neck at all. Frames 0–1 idle are
 * a fluff-shake — the down ruffles outward while the body trembles a pixel.
 * Frames 2–5 waddle with alternating lean and foot steps.
 *
 * Colourway: mauve down with plum shading (gray against the desert palette),
 * bone face patch, amber beak and feet, ink outline.
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const FLUFFBALL_FRAME = 16;

interface FluffPose {
  /** Whole-sprite lateral shift (idle tremble / waddle sway), in px. */
  sway: -1 | 0 | 1;
  /** Which way the puff leans while waddling: shifts the face patch. */
  lean: -1 | 0 | 1;
  /** 1 = body bounced up one pixel (waddle passing frame). */
  hop: 0 | 1;
  /** Feet: both planted, or left/right foot stepping (lifted + forward). */
  feet: "both" | "L" | "R";
  /** 1 = down ruffled outward (the fluff-shake). */
  ruffle: 0 | 1;
}

const FLUFF_POSES: readonly FluffPose[] = [
  { sway: 0, lean: 0, hop: 0, feet: "both", ruffle: 0 }, // 0 idle A
  { sway: 1, lean: 0, hop: 0, feet: "both", ruffle: 1 }, // 1 idle B: fluff-shake
  { sway: 0, lean: -1, hop: 0, feet: "L", ruffle: 0 }, // 2 waddle: lean left
  { sway: 0, lean: 0, hop: 1, feet: "both", ruffle: 1 }, // 3 passing hop, down bounces
  { sway: 0, lean: 1, hop: 0, feet: "R", ruffle: 0 }, // 4 waddle: lean right
  { sway: 0, lean: 0, hop: 1, feet: "both", ruffle: 0 } // 5 passing hop
];

function drawFluffball(p: FluffPose): PixelGrid {
  const g = new PixelGrid(FLUFFBALL_FRAME, FLUFFBALL_FRAME);
  const dx = p.sway;
  const hx = dx + p.lean; // the face patch follows the lean
  const dy = -p.hop;

  // --- one round downy mass: no neck, no separate head ---
  g.rect(5 + dx, 3 + dy, 6, 1, "mauve"); // crown
  g.rect(4 + dx, 4 + dy, 8, 9, "mauve"); // core
  for (let y = 6; y <= 11; y++) {
    g.px(3 + dx, y + dy, "mauve"); // round sides
    g.px(12 + dx, y + dy, "mauve");
  }
  g.rect(5 + dx, 13 + dy, 6, 1, "mauve"); // round bottom
  // plum shading: the puff is lit top-left
  g.px(11 + dx, 5 + dy, "plum");
  g.px(12 + dx, 8 + dy, "plum");
  g.px(12 + dx, 10 + dy, "plum");
  g.px(11 + dx, 12 + dy, "plum");
  g.px(10 + dx, 13 + dy, "plum");
  g.px(9 + dx, 13 + dy, "plum");
  // bone light on the crown
  g.px(5 + dx, 3 + dy, "plum");
  g.px(4 + dx, 4 + dy, "plum");

  // --- tiny flipper stubs, lifting on the hop ---
  const flap = p.hop;
  g.px(2 + dx, 9 + dy - flap, "mauve");
  g.px(13 + dx, 9 + dy - flap, "mauve");

  // --- bone face patch set straight into the fluff ---
  g.rect(5 + hx, 6 + dy, 6, 4, "bone");
  g.px(5 + hx, 6 + dy, "mauve"); // rounded patch corners
  g.px(10 + hx, 6 + dy, "mauve");
  g.px(6 + hx, 7 + dy, "ink"); // eyes
  g.px(9 + hx, 7 + dy, "ink");
  // amber beak
  g.px(7 + hx, 8 + dy, "amber");
  g.px(8 + hx, 8 + dy, "amber");
  g.px(7 + hx, 9 + dy, "amber");
  g.px(8 + hx, 9 + dy, "clay"); // underside shade

  // --- ruffled down sticking out on the shake frames ---
  if (p.ruffle === 1) {
    g.px(4 + dx, 2 + dy, "mauve");
    g.px(9 + dx, 2 + dy, "mauve");
    g.px(2 + dx, 5 + dy, "mauve");
    g.px(13 + dx, 6 + dy, "mauve");
    g.px(2 + dx, 11 + dy, "mauve");
    g.px(13 + dx, 11 + dy, "mauve");
    g.px(6 + dx, 14 + dy, "mauve");
  }

  rimTopLeft(g, { x: 3 + dx, y: 2 + dy, w: 8, h: 4 }); // dusk light on the down
  selOut(g);

  // --- feet: amber, drawn after the outline so they stay dainty ---
  const footY = 14 + dy;
  if (p.feet === "both" || p.feet === "R") {
    g.px(5 + dx, footY, "amber");
    g.px(6 + dx, footY, "amber");
  }
  if (p.feet === "both" || p.feet === "L") {
    g.px(9 + dx, footY, "amber");
    g.px(10 + dx, footY, "amber");
  }
  if (p.feet === "L") {
    g.px(3 + dx, footY - 1, "amber");
    g.px(4 + dx, footY - 1, "amber");
  }
  if (p.feet === "R") {
    g.px(11 + dx, footY - 1, "amber");
    g.px(12 + dx, footY - 1, "amber");
  }

  return g;
}

/** All 6 frames: 0–1 fluff-shake idle, 2–5 waddle. */
export function fluffballFrames(): PixelGrid[] {
  return FLUFF_POSES.map(drawFluffball);
}
