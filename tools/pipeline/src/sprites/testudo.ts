/**
 * Chef Testudo — 24×24 Act 7 NPC: an ancient tortoise who has been perfecting
 * one pizza recipe since the Mojave had a coastline. Seen front-on (he stands
 * at his oven and greets you), placed via `addNpc` like the crystal-crawler
 * warden, so only the flat `testudo-idle` / `testudo-move` pair is used.
 *
 * A big mossy jade/teal domed shell (the bulk), a wrinkled clay/sand head with
 * wise mint eyes and a gentle smile, a puffy bone chef's toque on top, and a
 * warm amber apron across the front of the shell. Deliberately slow and
 * kindly — nothing like the game's monsters.
 *
 * Frames 0–1 idle: a slow breath (the head/hat rise a pixel). Frames 2–5:
 * a stubby-legged shuffle (he barely moves — an ancient chef).
 *
 * Colourway: jade/teal/tealDeep shell, mint/jade moss, clay/sand/rust head,
 * bone/white/sandLight toque, amber/clay apron, ink outline.
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const TESTUDO_FRAME = 24;

interface TestudoPose {
  /** Head + hat rise a pixel with the breath (0 or 1). */
  bob: 0 | 1;
  /** Foot shuffle: neutral, or the two alternating steps. */
  legs: "stand" | "A" | "B";
}

const POSES: readonly TestudoPose[] = [
  { bob: 0, legs: "stand" }, // 0 idle A
  { bob: 1, legs: "stand" }, // 1 idle B: a slow breath
  { bob: 0, legs: "A" }, // 2 shuffle
  { bob: 1, legs: "B" }, // 3
  { bob: 0, legs: "A" }, // 4
  { bob: 1, legs: "B" }, // 5
];

function drawTestudo(p: TestudoPose): PixelGrid {
  const g = new PixelGrid(TESTUDO_FRAME, TESTUDO_FRAME);
  const b = p.bob;

  // --- Chef's toque, atop the head (rises with the breath) ---
  g.rect(8, 2 + b, 8, 3, "bone"); // puffy crown
  g.rect(7, 3 + b, 10, 2, "bone"); // wider puff
  g.rect(8, 5 + b, 8, 2, "sandLight"); // hat band
  g.px(9, 2 + b, "white");
  g.px(12, 2 + b, "white");
  g.px(14, 3 + b, "white");

  // --- Head: wrinkled, wise, front-on ---
  g.rect(9, 7 + b, 6, 5, "clay");
  g.px(9, 7 + b, "sand"); // lit temples
  g.px(14, 7 + b, "sand");
  g.rect(9, 11 + b, 6, 1, "rust"); // jaw shade
  // eyes + a bright brow glint
  g.px(10, 9 + b, "ink");
  g.px(13, 9 + b, "ink");
  g.px(10, 8 + b, "mint");
  g.px(13, 8 + b, "mint");
  // a gentle smile
  g.px(11, 11 + b, "ink");
  g.px(12, 11 + b, "ink");

  // --- The big mossy shell (the body; does not bob) ---
  g.rect(3, 13, 18, 8, "teal");
  g.rect(4, 12, 16, 3, "jade"); // lit crown
  g.rect(3, 19, 18, 2, "tealDeep"); // shaded rim
  // scute divisions
  g.rect(7, 13, 1, 7, "tealDeep");
  g.rect(12, 13, 1, 7, "tealDeep");
  g.rect(16, 13, 1, 7, "tealDeep");
  g.rect(3, 16, 18, 1, "tealDeep");
  // moss on the old shell
  g.px(5, 14, "mint");
  g.px(9, 15, "mint");
  g.px(14, 14, "mint");
  g.px(18, 16, "mint");
  g.px(6, 18, "jade");
  g.px(15, 18, "jade");

  // --- Warm amber apron across the front of the shell (a chef) ---
  g.rect(9, 17, 6, 4, "amber");
  g.px(9, 17, "sand"); // lit fold
  g.px(14, 17, "clay"); // shaded fold
  g.rect(11, 18, 2, 3, "clay"); // apron pocket/tie

  rimTopLeft(g, { x: 2, y: 11, w: 10, h: 4 }); // mossy shell crown highlight
  selOut(g);

  // --- Stubby feet, shuffling (drawn after the outline) ---
  let ll = 0;
  let rl = 0;
  if (p.legs === "A") ll = 1;
  else if (p.legs === "B") rl = 1;
  g.rect(4, 20 - ll, 3, 3, "clay"); // left foot
  g.rect(17, 20 - rl, 3, 3, "clay"); // right foot
  g.px(5, 22 - ll, "ink"); // toe shadow
  g.px(18, 22 - rl, "ink");

  return g;
}

/** All 6 frames: 0–1 idle (slow breath), 2–5 stubby-legged shuffle. */
export function testudoFrames(): PixelGrid[] {
  return POSES.map(drawTestudo);
}
