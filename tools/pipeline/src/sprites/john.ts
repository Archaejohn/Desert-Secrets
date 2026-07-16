/**
 * John — Joseph's father, a sturdy rancher who built the oasis homestead.
 *
 * Same 16×24 / 4-direction / 6-frame layout as the hero, sharing the pose
 * table in poses.ts (and the mirror trick for the left row) — see
 * rosa.ts / miner.ts for the pattern this follows.
 *
 * Deliberately broader-shouldered / wider-stanced than the hero (Joseph) so
 * the two read as distinct body types: rust work shirt with clay trim,
 * slate trousers, bone/gray hair, a wide sand-colored hat brim (his
 * signature, distinct from Joseph's plain look and Rosa's hi-vis vest), ink
 * boots.
 */
import { PixelGrid } from "../grid";
import { FRAME_POSES, CHAR_FRAME_W, CHAR_FRAME_H, type Pose } from "./poses";
import { rimTopLeft, selOut } from "./polish";

function newFrame(): PixelGrid {
  return new PixelGrid(CHAR_FRAME_W, CHAR_FRAME_H);
}

/** Wide-brim hat + face, front view (or the back of the hat for `up`). */
function headDown(g: PixelGrid, dy: number, withFace: boolean): void {
  // crown
  g.rect(5, 1 + dy, 6, 1, "sand");
  g.rect(4, 2 + dy, 8, 1, "sand");
  g.px(5, 1 + dy, "sandLight");
  g.px(6, 1 + dy, "sandLight");
  g.px(4, 2 + dy, "sandLight");
  // hatband
  g.rect(4, 3 + dy, 8, 1, "rust");
  // wide brim — pokes out past the shoulders, John's signature
  g.rect(2, 4 + dy, 12, 1, "sand");
  g.px(2, 4 + dy, "sandLight");
  g.px(13, 4 + dy, "clay");
  if (withFace) {
    // bone/gray hair at the temples, under the brim
    g.px(4, 5 + dy, "bone");
    g.px(11, 5 + dy, "bone");
    g.rect(5, 5 + dy, 6, 3, "clay");
    g.rect(6, 8 + dy, 4, 1, "clay"); // chin
    g.px(10, 7 + dy, "rust"); // sun-weathered jaw shade, low/right
    g.px(9, 8 + dy, "rust");
    g.px(6, 6 + dy, "ink"); // eyes
    g.px(9, 6 + dy, "ink");
  } else {
    // back of the hat, bone/gray hair peeking out below the brim
    g.rect(4, 5 + dy, 8, 2, "bone");
    g.rect(5, 7 + dy, 6, 1, "bone");
    g.rect(6, 8 + dy, 4, 1, "clay"); // sliver of neck
  }
}

/** Rust work shirt with clay cuffs/trim, front/back view — broadened. */
function torsoDownUp(g: PixelGrid, dy: number, front: boolean): void {
  g.rect(3, 9 + dy, 10, 7, "rust"); // shirt, y9..15, wider than the hero rig
  if (front) {
    g.px(4, 9 + dy, "sandLight"); // top-left light
    g.px(3, 10 + dy, "sandLight");
    g.px(5, 11 + dy, "clay"); // chest pocket flaps
    g.px(10, 11 + dy, "clay");
    for (let y = 10; y <= 15; y++) g.px(12, y + dy, "plum"); // right-side shade
  } else {
    g.rect(3, 9 + dy, 10, 6, "rust");
    g.px(3, 9 + dy, "sandLight");
    g.px(3, 10 + dy, "sandLight");
    for (let y = 10; y <= 15; y++) g.px(12, y + dy, "plum");
  }
  g.rect(3, 15 + dy, 10, 1, "plum"); // belt
}

/** Rust sleeves at the sprite edges, counter-swinging with the legs. */
function armsDownUp(g: PixelGrid, dy: number, swing: number): void {
  g.rect(2, 10 + dy, 1, 4 + swing, "rust");
  g.px(2, 14 + swing + dy, "clay");
  g.rect(13, 10 + dy, 1, 4 - swing, "rust");
  g.px(13, 14 - swing + dy, "clay");
}

/** Slate trousers with ink boots, wide stance. */
function legsDownUp(g: PixelGrid, stride: number): void {
  if (stride >= 0) {
    g.rect(4, 16, 2, 5, "slate");
    g.rect(4, 21, 2, 1, "ink");
  } else {
    g.rect(4, 16, 2, 4, "slate");
    g.rect(4, 20, 2, 1, "ink");
  }
  if (stride <= 0) {
    g.rect(10, 16, 2, 5, "slate");
    g.rect(10, 21, 2, 1, "ink");
  } else {
    g.rect(10, 16, 2, 4, "slate");
    g.rect(10, 20, 2, 1, "ink");
  }
}

function johnDown(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, p.stride);
  torsoDownUp(g, dy, true);
  armsDownUp(g, dy, p.swing);
  headDown(g, dy, true);
  rimTopLeft(g, { x: 1, y: 0, w: 12, h: 5 }); // hat crown + brim catch the light
  selOut(g);
  return g;
}

function johnUp(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, -p.stride);
  torsoDownUp(g, dy, false);
  armsDownUp(g, dy, -p.swing);
  headDown(g, dy, false);
  rimTopLeft(g, { x: 1, y: 0, w: 12, h: 5 });
  selOut(g);
  return g;
}

/** Profile view, facing right. The left row is this, mirrored. */
function johnSide(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  const s = p.stride;
  const sw = p.swing;

  // legs first, wide stance, so the shirt hem drapes over the hips
  if (s === 0) {
    g.rect(6, 16, 5, 5, "slate");
    g.rect(6, 21, 5, 1, "ink");
  } else {
    const fwd: "slate" | "plum" = s === 1 ? "slate" : "plum";
    const back: "slate" | "plum" = s === 1 ? "plum" : "slate";
    g.rect(9, 16, 2, 3, fwd); // leading leg strides ahead...
    g.rect(11, 19, 2, 2, fwd);
    g.rect(11, 21, 2, 1, "ink");
    g.rect(5, 16, 2, 3, back); // ...trailing leg pushes off behind
    g.rect(3, 19, 2, 2, back);
    g.rect(3, 21, 2, 1, "ink");
  }

  // torso: rust shirt, broadened
  g.rect(4, 9 + dy, 8, 7, "rust");
  g.px(4, 10 + dy, "sandLight");
  g.px(4, 11 + dy, "sandLight");
  for (let y = 11; y <= 15; y++) g.px(11, y + dy, "plum");
  g.rect(4, 15 + dy, 8, 1, "plum"); // belt

  // near arm swings across the torso (rust sleeve, clay hand)
  if (sw === 0) {
    g.rect(7, 10 + dy, 2, 4, "rust");
    g.px(8, 14 + dy, "clay");
  } else if (sw === 1) {
    g.px(7, 10 + dy, "rust");
    g.px(8, 10 + dy, "rust");
    g.px(8, 11 + dy, "rust");
    g.px(9, 11 + dy, "rust");
    g.px(9, 12 + dy, "rust");
    g.px(10, 12 + dy, "rust");
    g.px(10, 13 + dy, "clay");
  } else {
    g.px(7, 10 + dy, "rust");
    g.px(8, 10 + dy, "rust");
    g.px(7, 11 + dy, "rust");
    g.px(6, 11 + dy, "rust");
    g.px(6, 12 + dy, "rust");
    g.px(5, 12 + dy, "rust");
    g.px(4, 13 + dy, "clay");
  }

  // head: wide-brim hat profile, brim jutting fore and aft
  g.rect(6, 1 + dy, 5, 1, "sand");
  g.rect(5, 2 + dy, 7, 2, "sand");
  g.px(6, 1 + dy, "sandLight");
  g.px(5, 2 + dy, "sandLight");
  g.rect(5, 4 + dy, 7, 1, "rust"); // hatband
  g.rect(3, 5 + dy, 10, 1, "sand"); // wide brim
  g.px(3, 5 + dy, "sandLight");
  g.px(12, 5 + dy, "clay");
  // face
  g.rect(7, 6 + dy, 4, 2, "clay");
  g.px(11, 7 + dy, "clay"); // nose
  g.rect(7, 8 + dy, 3, 1, "clay"); // jaw
  g.px(9, 8 + dy, "rust"); // jaw shade
  g.px(9, 6 + dy, "ink"); // eye

  return g;
}

/** Rim + sel-out for a profile frame — applied AFTER the mirror for the left
 *  row so the key light stays NNW in both directions. */
function polishSide(g: PixelGrid): PixelGrid {
  rimTopLeft(g, { x: 2, y: 0, w: 11, h: 5 });
  selOut(g);
  return g;
}

/** All 24 frames, row-major: down(0–5), left(6–11), right(12–17), up(18–23). */
export function johnFrames(): PixelGrid[] {
  const down = FRAME_POSES.map(johnDown);
  const sides = FRAME_POSES.map(johnSide);
  const left = sides.map((f) => polishSide(f.mirrorX()));
  const right = sides.map(polishSide);
  const up = FRAME_POSES.map(johnUp);
  return [...down, ...left, ...right, ...up];
}
