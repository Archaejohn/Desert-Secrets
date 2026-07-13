/**
 * Hero — "the desert wanderer".
 *
 * 16×24 humanoid: amber/sand turban, clay skin, indigo tunic with slate
 * accents and belt, slate leggings, clay sandals, ink outline. Light reads
 * from the top-left (sandLight/sand highlights up-left, plum shade
 * down-right).
 *
 * Pure functions only — no disk I/O. `heroFrames()` returns the 24 frames in
 * sheet order (rows down / left / right / up, 6 frames per row).
 */
import { PixelGrid } from "../grid";
import { FRAME_POSES, CHAR_FRAME_W, CHAR_FRAME_H, type Pose } from "./poses";

function newFrame(): PixelGrid {
  return new PixelGrid(CHAR_FRAME_W, CHAR_FRAME_H);
}

/** Turban + face, front view. */
function headDown(g: PixelGrid, dy: number, withFace: boolean): void {
  // turban dome
  g.rect(5, 1 + dy, 6, 1, "amber");
  g.px(5, 1 + dy, "sandLight");
  g.px(6, 1 + dy, "sandLight");
  g.rect(4, 2 + dy, 8, 2, "amber");
  g.px(4, 2 + dy, "sand");
  g.px(5, 2 + dy, "sand");
  // wrap band
  g.rect(4, 4 + dy, 8, 1, "rust");
  if (withFace) {
    g.rect(5, 5 + dy, 6, 3, "clay");
    g.rect(6, 8 + dy, 4, 1, "clay"); // chin
    g.px(6, 6 + dy, "ink"); // eyes
    g.px(9, 6 + dy, "ink");
  } else {
    // back of head: turban continues, tail hangs to the right
    g.rect(5, 5 + dy, 6, 3, "amber");
    g.px(9, 5 + dy, "rust");
    g.px(10, 5 + dy, "rust");
    g.rect(9, 6 + dy, 2, 3, "amber"); // turban tail
    g.rect(6, 8 + dy, 3, 1, "clay"); // sliver of neck
  }
}

/** Tunic torso + slate belt, front/back view. */
function torsoDownUp(g: PixelGrid, dy: number, front: boolean): void {
  g.rect(4, 9 + dy, 8, 7, "indigo"); // y9..15
  if (front) g.rect(6, 9 + dy, 4, 1, "amber"); // scarf at the collar
  // top-left light
  g.px(4, 9 + dy, "slate");
  g.px(5, 9 + dy, "slate");
  g.px(4, 10 + dy, "slate");
  g.px(4, 11 + dy, "slate");
  // right-side shade
  for (let y = 10; y <= 15; y++) g.px(11, y + dy, "plum");
  g.rect(4, 13 + dy, 8, 1, "slate"); // belt
}

/** Two thin arms at the sprite edges, counter-swinging with the legs. */
function armsDownUp(g: PixelGrid, dy: number, swing: number): void {
  g.rect(3, 10 + dy, 1, 4 + swing, "indigo");
  g.px(3, 14 + swing + dy, "clay");
  g.rect(12, 10 + dy, 1, 4 - swing, "indigo");
  g.px(12, 14 - swing + dy, "clay");
}

/** Front/back legs: planted foot low, opposite foot lifted one pixel. */
function legsDownUp(g: PixelGrid, stride: number): void {
  if (stride >= 0) {
    g.rect(5, 16, 2, 5, "slate");
    g.rect(5, 21, 2, 1, "clay");
  } else {
    g.rect(5, 16, 2, 4, "slate");
    g.rect(5, 20, 2, 1, "clay");
  }
  if (stride <= 0) {
    g.rect(9, 16, 2, 5, "slate");
    g.rect(9, 21, 2, 1, "clay");
  } else {
    g.rect(9, 16, 2, 4, "slate");
    g.rect(9, 20, 2, 1, "clay");
  }
}

function heroDown(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, p.stride);
  torsoDownUp(g, dy, true);
  armsDownUp(g, dy, p.swing);
  headDown(g, dy, true);
  g.outline("ink");
  return g;
}

function heroUp(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, -p.stride);
  torsoDownUp(g, dy, false);
  armsDownUp(g, dy, -p.swing);
  headDown(g, dy, false);
  g.outline("ink");
  return g;
}

/** Profile view, facing right. The left row is this, mirrored. */
function heroSide(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  const s = p.stride;
  const sw = p.swing;

  // legs first, so the tunic drapes over the hips
  if (s === 0) {
    g.rect(7, 16, 3, 5, "slate");
    g.rect(7, 21, 3, 1, "clay");
  } else {
    const fwd: "slate" | "plum" = s === 1 ? "slate" : "plum";
    const back: "slate" | "plum" = s === 1 ? "plum" : "slate";
    g.rect(8, 16, 2, 3, fwd); // leading leg strides ahead...
    g.rect(10, 19, 2, 2, fwd);
    g.rect(10, 21, 2, 1, "clay");
    g.rect(6, 16, 2, 3, back); // ...trailing leg pushes off behind
    g.rect(4, 19, 2, 2, back);
    g.rect(4, 21, 2, 1, "clay");
  }

  // torso
  g.rect(5, 9 + dy, 6, 7, "indigo");
  g.rect(6, 9 + dy, 4, 1, "amber"); // scarf
  g.px(5, 10 + dy, "slate");
  g.px(5, 11 + dy, "slate");
  for (let y = 11; y <= 15; y++) g.px(10, y + dy, "plum");
  g.rect(5, 13 + dy, 6, 1, "slate"); // belt

  // near arm swings across the torso
  if (sw === 0) {
    g.rect(7, 10 + dy, 2, 4, "slate");
    g.px(8, 14 + dy, "clay");
  } else if (sw === 1) {
    g.px(7, 10 + dy, "slate");
    g.px(8, 10 + dy, "slate");
    g.px(8, 11 + dy, "slate");
    g.px(9, 11 + dy, "slate");
    g.px(9, 12 + dy, "slate");
    g.px(10, 12 + dy, "slate");
    g.px(10, 13 + dy, "clay");
  } else {
    g.px(7, 10 + dy, "slate");
    g.px(8, 10 + dy, "slate");
    g.px(7, 11 + dy, "slate");
    g.px(6, 11 + dy, "slate");
    g.px(6, 12 + dy, "slate");
    g.px(5, 12 + dy, "slate");
    g.px(4, 13 + dy, "clay");
  }

  // head: turban profile with a tail hanging behind
  g.rect(6, 1 + dy, 5, 1, "amber");
  g.px(6, 1 + dy, "sandLight");
  g.px(7, 1 + dy, "sandLight");
  g.rect(5, 2 + dy, 7, 2, "amber");
  g.px(5, 2 + dy, "sand");
  g.px(6, 2 + dy, "sand");
  g.rect(5, 4 + dy, 7, 1, "rust"); // band
  g.px(4, 5 + dy, "amber"); // tail
  g.px(4, 6 + dy, "amber");
  g.px(4, 7 + dy, "rust");
  // face
  g.rect(6, 5 + dy, 5, 3, "clay");
  g.px(11, 6 + dy, "clay"); // nose
  g.rect(7, 8 + dy, 3, 1, "clay"); // jaw
  g.px(9, 6 + dy, "ink"); // eye

  g.outline("ink");
  return g;
}

/** All 24 frames, row-major: down(0–5), left(6–11), right(12–17), up(18–23). */
export function heroFrames(): PixelGrid[] {
  const down = FRAME_POSES.map(heroDown);
  const right = FRAME_POSES.map(heroSide);
  const left = right.map((f) => f.mirrorX());
  const up = FRAME_POSES.map(heroUp);
  return [...down, ...left, ...right, ...up];
}
