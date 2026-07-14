/**
 * Chicken — a small hen from the oasis coop, seen in profile facing right.
 *
 * 16×16, one row of 6 frames: 0–1 idle (head-bob peck — the head dips 1-2px
 * and rises), 2–5 strut (a simple side-to-side walk with alternating foot
 * contact; unlike the jackrabbit's hop cycle there's no airborne phase —
 * chickens don't hop).
 *
 * Silhouette: round small body, bone/sand feathers, tiny folded wing. The
 * comb is the only "loud" colour accent — a small rust-red patch on the
 * head — against otherwise bone/sand plumage. Amber beak and feet, ink eye.
 */
import { PixelGrid } from "../grid";

export const CHICKEN_FRAME = 16;

interface ChickenPose {
  /** 1 = head dipped down into a peck (idle bob). */
  bob: 0 | 1;
  /** Whole-body lean during the strut, alternating with foot contact. */
  lean: -1 | 0 | 1;
  /** Which foot is planted forward this frame. */
  feet: "both" | "L" | "R";
}

const CHICKEN_POSES: readonly ChickenPose[] = [
  { bob: 0, lean: 0, feet: "both" }, // 0 idle A, head up
  { bob: 1, lean: 0, feet: "both" }, // 1 idle B, head dips to peck
  { bob: 0, lean: -1, feet: "L" }, // 2 strut contact: lean back, left foot forward
  { bob: 0, lean: 0, feet: "both" }, // 3 passing
  { bob: 0, lean: 1, feet: "R" }, // 4 strut contact: lean forward, right foot forward
  { bob: 0, lean: 0, feet: "both" } // 5 passing
];

function drawChicken(p: ChickenPose): PixelGrid {
  const g = new PixelGrid(CHICKEN_FRAME, CHICKEN_FRAME);
  const dx = p.lean;

  // --- body: round, bone main with sand shading ---
  g.rect(4 + dx, 7, 7, 5, "bone"); // core, x4..10, y7..11
  g.px(3 + dx, 8, "bone"); // rounded rear (tail side)
  g.px(3 + dx, 9, "bone");
  g.px(3 + dx, 10, "bone");
  g.rect(5 + dx, 12, 5, 1, "bone"); // rounded belly
  g.rect(6 + dx, 9, 3, 2, "sand"); // folded wing patch
  g.px(9 + dx, 11, "sand");
  // small tail tuft at the back
  g.px(2 + dx, 7, "sand");
  g.px(2 + dx, 8, "bone");
  g.px(3 + dx, 6, "sand");

  // --- head: bobs down 1-2px on the peck frame ---
  const hy = 2 + (p.bob ? 2 : 0);
  g.rect(10 + dx, hy, 3, 3, "bone");
  const neckH = 7 - (hy + 3);
  if (neckH > 0) g.rect(9 + dx, hy + 3, 2, neckH, "bone");
  // comb: the one loud rust-red accent
  g.px(11 + dx, hy - 1, "rust");
  g.px(10 + dx, hy - 1, "rust");
  // beak
  g.px(12 + dx, hy + 1, "amber");
  g.px(13 + dx, hy + 1, "amber");
  // eye
  g.px(11 + dx, hy + 1, "ink");

  g.outline("ink");

  // --- feet: amber, drawn after the outline so they stay dainty ---
  const footY = 13;
  if (p.feet === "both" || p.feet === "R") {
    g.px(5 + dx, footY, "amber"); // left foot planted
    g.px(6 + dx, footY, "amber");
  }
  if (p.feet === "both" || p.feet === "L") {
    g.px(8 + dx, footY, "amber"); // right foot planted
    g.px(9 + dx, footY, "amber");
  }
  if (p.feet === "L") {
    g.px(4 + dx, footY - 1, "amber"); // left foot stepping forward, lifted
    g.px(5 + dx, footY - 1, "amber");
  }
  if (p.feet === "R") {
    g.px(9 + dx, footY - 1, "amber"); // right foot stepping forward, lifted
    g.px(10 + dx, footY - 1, "amber");
  }

  return g;
}

/** All 6 frames: 0–1 idle head-bob peck, 2–5 strut. */
export function chickenFrames(): PixelGrid[] {
  return CHICKEN_POSES.map(drawChicken);
}
