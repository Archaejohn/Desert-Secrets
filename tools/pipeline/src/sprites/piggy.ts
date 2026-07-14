/**
 * Piggy — a baby emperor penguin, hopelessly far from home.
 *
 * 16×16, one row of 6 frames: 0–1 idle (a cold shiver — 1px lateral tremble
 * with the head tucking down into the body), 2–5 waddle (side-to-side lean
 * with alternating foot steps and a tiny hop on the passing frames).
 *
 * Silhouette: round bottom-heavy body, oversized head, tiny flippers that
 * can't lift anything. Ink down on the back and head, bone belly and cheeks,
 * amber beak and feet. A single mint "frost glint" pixel — the cold that
 * follows Piggy everywhere — alternates position every frame.
 */
import { PixelGrid } from "../grid";

export const PIGGY_FRAME = 16;

interface PiggyPose {
  /** Whole-sprite lateral shift (the idle tremble / waddle sway), in px. */
  sway: -1 | 0 | 1;
  /** Which way the body leans while waddling: shifts head + shoulders. */
  lean: -1 | 0 | 1;
  /** 1 = head tucked one pixel down into the shoulders (cold!). */
  tuck: 0 | 1;
  /** 1 = body bounced up one pixel (waddle passing frame). */
  hop: 0 | 1;
  /** Feet: both planted, or left/right foot stepping (lifted + forward). */
  feet: "both" | "L" | "R";
  /** Which of the two frost-glint spots is lit this frame. */
  glint: 0 | 1;
}

const PIGGY_POSES: readonly PiggyPose[] = [
  { sway: 0, lean: 0, tuck: 0, hop: 0, feet: "both", glint: 0 }, // 0 idle A
  { sway: 1, lean: 0, tuck: 1, hop: 0, feet: "both", glint: 1 }, // 1 idle B (shiver + tuck)
  { sway: 0, lean: -1, tuck: 0, hop: 0, feet: "L", glint: 0 }, // 2 waddle: lean left, left foot out
  { sway: 0, lean: 0, tuck: 0, hop: 1, feet: "both", glint: 1 }, // 3 passing hop
  { sway: 0, lean: 1, tuck: 0, hop: 0, feet: "R", glint: 0 }, // 4 waddle: lean right, right foot out
  { sway: 0, lean: 0, tuck: 1, hop: 1, feet: "both", glint: 1 } // 5 passing hop, chin dips
];

function drawPiggy(p: PiggyPose): PixelGrid {
  const g = new PixelGrid(PIGGY_FRAME, PIGGY_FRAME);
  const dx = p.sway;
  const hx = dx + p.lean; // head + shoulders follow the lean
  const dy = -p.hop;
  const ty = p.tuck; // head tuck (down into the body)

  // --- body: round, bottom-heavy, ink back over a bone belly ---
  g.rect(4 + dx, 7 + dy, 8, 6, "ink"); // core
  g.px(3 + dx, 8 + dy, "ink"); // rounded hips
  g.px(3 + dx, 9 + dy, "ink");
  g.px(3 + dx, 10 + dy, "ink");
  g.px(12 + dx, 8 + dy, "ink");
  g.px(12 + dx, 9 + dy, "ink");
  g.px(12 + dx, 10 + dy, "ink");
  g.rect(5 + dx, 13 + dy, 6, 1, "ink"); // round bottom
  // bone belly, widest at the bottom (baby tummy)
  g.rect(6 + dx, 8 + dy, 4, 1, "bone");
  g.rect(5 + dx, 9 + dy, 6, 4, "bone");
  g.px(6 + dx, 13 + dy, "bone");
  g.px(9 + dx, 13 + dy, "bone");
  // plum sheen where light grazes the downy back
  g.px(4 + dx, 7 + dy, "plum");
  g.px(4 + dx, 8 + dy, "plum");
  g.px(11 + dx, 12 + dy, "plum");

  // --- tiny flippers: two-pixel stubs, flare out on the passing hop ---
  const flap = p.hop; // flippers lift slightly when hopping
  g.px(3 + dx, 9 + dy - flap, "ink");
  g.px(2 + dx, 10 + dy - flap, "ink");
  g.px(12 + dx, 9 + dy - flap, "ink");
  g.px(13 + dx, 10 + dy - flap, "ink");

  // --- head: big, sits into the shoulders; tucks lower when cold ---
  const hy = 2 + dy + ty;
  g.rect(6 + hx, hy, 4, 1, "ink"); // crown
  g.rect(5 + hx, hy + 1, 6, 3, "ink"); // head mass
  g.px(5 + hx, hy + 1, "plum"); // crown sheen
  // bone cheek patches (emperor-chick face mask)
  g.px(5 + hx, hy + 3, "bone");
  g.px(6 + hx, hy + 3, "bone");
  g.px(9 + hx, hy + 3, "bone");
  g.px(10 + hx, hy + 3, "bone");
  g.px(6 + hx, hy + 4, "bone");
  g.px(9 + hx, hy + 4, "bone");
  // eyes: two ink pixels set in the cheek bone (drawn after cheeks)
  g.px(6 + hx, hy + 2, "sandLight"); // eye shine above
  g.px(9 + hx, hy + 2, "sandLight");
  // beak: small amber wedge
  g.px(7 + hx, hy + 3, "amber");
  g.px(8 + hx, hy + 3, "amber");
  g.px(7 + hx, hy + 4, "amber");
  g.px(8 + hx, hy + 4, "amber");
  g.px(8 + hx, hy + 4, "clay"); // underside shade

  // neck fills the gap between head and shoulders when not tucked
  if (ty === 0) g.rect(5 + hx, hy + 4, 6, 1, "ink");

  g.outline("ink");

  // --- feet: amber, drawn after the outline so they stay dainty ---
  const footY = 14 + dy;
  if (p.feet === "both" || p.feet === "R") {
    // left foot planted
    g.px(5 + dx, footY, "amber");
    g.px(6 + dx, footY, "amber");
  }
  if (p.feet === "both" || p.feet === "L") {
    // right foot planted
    g.px(9 + dx, footY, "amber");
    g.px(10 + dx, footY, "amber");
  }
  if (p.feet === "L") {
    // left foot stepping: lifted and swung outward
    g.px(3 + dx, footY - 1, "amber");
    g.px(4 + dx, footY - 1, "amber");
  }
  if (p.feet === "R") {
    // right foot stepping
    g.px(11 + dx, footY - 1, "amber");
    g.px(12 + dx, footY - 1, "amber");
  }

  // --- the frost glint: one mint pixel, alternating spots every frame ---
  if (p.glint === 0) {
    g.px(6 + hx, hy, "mint"); // on the crown
  } else {
    g.px(11 + dx, 9 + dy, "mint"); // on the shoulder down
  }

  return g;
}

/** All 6 frames: 0–1 idle shiver, 2–5 waddle. */
export function piggyFrames(): PixelGrid[] {
  return PIGGY_POSES.map(drawPiggy);
}
