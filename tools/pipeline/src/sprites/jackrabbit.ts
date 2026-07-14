/**
 * Jackrabbit — 16×16 desert hare, seen in profile facing right.
 *
 * Sand coat with clay shading, bone belly and tail, huge ears. Frames:
 * 0–1 idle (sitting up; ears twitch and the chest rises), 2–5 hop cycle
 * (crouch → launch stretched out → airborne tuck → landing).
 */
import { PixelGrid } from "../grid";

export const JACKRABBIT_FRAME = 16;

function drawEars(g: PixelGrid, x: number, y: number, tilt: number): void {
  // two tall ears; `tilt` leans them back (negative x is back)
  for (let i = 0; i < 4; i++) {
    const lean = Math.floor((i * tilt) / 2);
    g.px(x - 2 + lean, y - i, "sand"); // back ear
    g.px(x + lean, y - i, "sand"); // front ear
  }
  // clay inner ear at the base of the front ear
  g.px(x, y, "clay");
  g.px(x - 2, y, "amber");
}

/** Sitting upright (idle). `breath` bobs the chest, `twitch` flops one ear. */
function sitting(breath: 0 | 1, twitch: boolean): PixelGrid {
  const g = new PixelGrid(JACKRABBIT_FRAME, JACKRABBIT_FRAME);
  // haunch: big round hindquarters
  g.rect(4, 9, 7, 5, "sand");
  g.px(3, 10, "sand");
  g.px(3, 11, "sand");
  g.px(3, 12, "sand");
  g.rect(5, 10, 3, 3, "clay"); // haunch muscle shading
  // upright chest + head (bob with breath)
  g.rect(8, 7 - breath, 4, 3, "sand"); // chest
  g.px(9, 8 - breath, "bone"); // chest fluff
  g.px(9, 9 - breath, "bone");
  g.rect(9, 4 - breath, 4, 3, "sand"); // head
  g.px(13, 5 - breath, "sand"); // nose bridge
  g.px(11, 5 - breath, "ink"); // eye
  g.px(13, 6 - breath, "clay"); // muzzle
  // ears: one twitches back on the B frame
  drawEars(g, 10, 3 - breath, twitch ? -1 : 0);
  // tail
  g.px(3, 9, "bone");
  g.outline("ink");
  // paws after the outline so they stay slim
  g.px(9, 14, "clay"); // front paws
  g.px(10, 14, "clay");
  g.rect(4, 14, 4, 1, "clay"); // big hind foot
  return g;
}

/** Hop cycle poses. */
function hopping(phase: "crouch" | "launch" | "air" | "land"): PixelGrid {
  const g = new PixelGrid(JACKRABBIT_FRAME, JACKRABBIT_FRAME);
  if (phase === "crouch") {
    // compressed low, ears flat back, ready to spring
    g.rect(3, 10, 8, 4, "sand"); // body low
    g.rect(4, 11, 3, 2, "clay"); // haunch
    g.rect(9, 9, 4, 3, "sand"); // head down front
    g.px(11, 10, "ink"); // eye
    g.px(13, 11, "clay"); // muzzle
    drawEars(g, 10, 8, -2);
    g.px(2, 10, "bone"); // tail
    g.outline("ink");
    g.rect(3, 14, 4, 1, "clay"); // hind foot coiled
    g.px(10, 13, "clay"); // front paws
    g.px(11, 13, "clay");
  } else if (phase === "launch") {
    // fully stretched: hind legs kicking back, forepaws reaching
    g.rect(4, 8, 8, 3, "sand"); // long body
    g.rect(5, 9, 3, 2, "clay"); // haunch
    g.rect(10, 6, 4, 3, "sand"); // head thrust forward
    g.px(12, 7, "ink"); // eye
    g.px(14, 8, "clay"); // muzzle
    drawEars(g, 11, 5, -2);
    g.px(3, 8, "bone"); // tail
    g.px(9, 10, "bone"); // belly
    g.outline("ink");
    g.rect(1, 12, 3, 1, "clay"); // hind legs trailing
    g.px(1, 13, "clay");
    g.px(13, 10, "clay"); // forepaws reaching
    g.px(14, 11, "clay");
  } else if (phase === "air") {
    // airborne tuck, high in the frame
    g.rect(5, 4, 7, 4, "sand"); // rounded body
    g.rect(6, 5, 3, 2, "clay");
    g.rect(10, 3, 4, 3, "sand"); // head
    g.px(12, 4, "ink"); // eye
    g.px(9, 7, "bone"); // belly
    g.px(10, 7, "bone");
    drawEars(g, 11, 2, -1);
    g.px(4, 4, "bone"); // tail
    g.outline("ink");
    g.rect(5, 9, 3, 1, "clay"); // legs tucked under
    g.px(11, 8, "clay");
  } else {
    // landing: forepaws down, hindquarters still up
    g.rect(4, 7, 7, 4, "sand"); // body angled down
    g.rect(5, 7, 3, 2, "clay"); // haunch high
    g.rect(9, 9, 4, 3, "sand"); // head low
    g.px(11, 10, "ink"); // eye
    g.px(13, 11, "clay"); // muzzle
    drawEars(g, 10, 8, 1); // ears thrown forward by the landing
    g.px(3, 7, "bone"); // tail up
    g.outline("ink");
    g.px(10, 13, "clay"); // front paws planted
    g.px(11, 13, "clay");
    g.rect(4, 12, 3, 1, "clay"); // hind feet swinging down
  }
  return g;
}

/** All 6 frames: 0–1 idle sit, 2–5 hop cycle. */
export function jackrabbitFrames(): PixelGrid[] {
  return [
    sitting(0, false),
    sitting(1, true),
    hopping("crouch"),
    hopping("launch"),
    hopping("air"),
    hopping("land")
  ];
}
