/**
 * Miner — one of the lost miners of Act 2.
 *
 * Same 16×24 / 4-direction / 6-frame layout as the hero and Rosa, sharing
 * the pose table in poses.ts (and the same mirror trick for the left row).
 * Colourway: rust hard hat with an amber lantern-glow pixel, clay skin,
 * bone beard, bone work shirt under slate bib overalls, plum boots.
 */
import { PixelGrid } from "../grid";
import { FRAME_POSES, CHAR_FRAME_W, CHAR_FRAME_H, type Pose } from "./poses";
import { rimTopLeft, selOut } from "./polish";

function newFrame(): PixelGrid {
  return new PixelGrid(CHAR_FRAME_W, CHAR_FRAME_H);
}

/** Hard hat + face (or the back of the hat for `up`). */
function headDown(g: PixelGrid, dy: number, withFace: boolean): void {
  // helmet dome
  g.rect(5, 1 + dy, 6, 1, "rust");
  g.rect(4, 2 + dy, 8, 2, "rust");
  g.px(5, 1 + dy, "clay"); // worn lit crown
  g.px(4, 2 + dy, "clay");
  // brim sticking out past the dome
  g.rect(3, 4 + dy, 10, 1, "rust");
  g.px(3, 4 + dy, "clay");
  if (withFace) {
    // the lantern, glowing amber on the helmet front
    g.px(7, 2 + dy, "amber");
    g.px(8, 2 + dy, "amber");
    g.px(7, 1 + dy, "sandLight"); // glow catching the dome
    // face
    g.rect(5, 5 + dy, 6, 4, "clay");
    g.px(6, 6 + dy, "ink"); // eyes
    g.px(9, 6 + dy, "ink");
    // bone beard wrapping the jaw
    g.px(5, 7 + dy, "bone");
    g.px(10, 7 + dy, "bone");
    g.rect(5, 8 + dy, 6, 1, "bone");
  } else {
    // back of the helmet shell
    g.rect(4, 5 + dy, 8, 1, "rust");
    g.rect(4, 6 + dy, 8, 1, "plum"); // rim shadow
    g.rect(6, 7 + dy, 4, 2, "clay"); // neck
    g.px(11, 5 + dy, "clay"); // scuffed edge
  }
}

/** Bone shirt under slate bib overalls, front/back view. */
function torsoDownUp(g: PixelGrid, dy: number, front: boolean): void {
  g.rect(4, 9 + dy, 8, 7, "bone"); // shirt, y9..15
  if (front) {
    g.rect(6, 10 + dy, 4, 5, "slate"); // bib
    g.px(6, 9 + dy, "slate"); // straps over the shoulders
    g.px(9, 9 + dy, "slate");
    g.px(7, 12 + dy, "indigo"); // bib pocket
    g.px(8, 12 + dy, "indigo");
    g.px(6, 10 + dy, "skyBlue"); // lit bib edge
  } else {
    g.rect(5, 9 + dy, 6, 6, "slate"); // full back panel
    g.px(6, 10 + dy, "bone"); // crossed straps
    g.px(9, 10 + dy, "bone");
    g.px(7, 11 + dy, "bone");
    g.px(8, 11 + dy, "bone");
    g.rect(10, 12 + dy, 1, 3, "indigo"); // shaded seam
  }
  g.rect(4, 15 + dy, 8, 1, "plum"); // belt
}

/** Bone shirt sleeves at the sprite edges, counter-swinging with the legs. */
function armsDownUp(g: PixelGrid, dy: number, swing: number): void {
  g.rect(3, 10 + dy, 1, 4 + swing, "bone");
  g.px(3, 14 + swing + dy, "clay");
  g.rect(12, 10 + dy, 1, 4 - swing, "bone");
  g.px(12, 14 - swing + dy, "clay");
}

/** Slate overall trousers with plum boots. */
function legsDownUp(g: PixelGrid, stride: number): void {
  if (stride >= 0) {
    g.rect(5, 16, 2, 5, "slate");
    g.rect(5, 21, 2, 1, "plum");
  } else {
    g.rect(5, 16, 2, 4, "slate");
    g.rect(5, 20, 2, 1, "plum");
  }
  if (stride <= 0) {
    g.rect(9, 16, 2, 5, "slate");
    g.rect(9, 21, 2, 1, "plum");
  } else {
    g.rect(9, 16, 2, 4, "slate");
    g.rect(9, 20, 2, 1, "plum");
  }
}

function minerDown(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, p.stride);
  torsoDownUp(g, dy, true);
  armsDownUp(g, dy, p.swing);
  headDown(g, dy, true);
  rimTopLeft(g, { x: 2, y: 0, w: 11, h: 5 }); // helmet dome + brim highlight
  selOut(g);
  return g;
}

function minerUp(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, -p.stride);
  torsoDownUp(g, dy, false);
  armsDownUp(g, dy, -p.swing);
  headDown(g, dy, false);
  rimTopLeft(g, { x: 2, y: 0, w: 11, h: 5 });
  selOut(g);
  return g;
}

/** Profile view, facing right. The left row is this, mirrored. */
function minerSide(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  const s = p.stride;
  const sw = p.swing;

  // legs first so the shirt hem drapes over the hips
  if (s === 0) {
    g.rect(7, 16, 3, 5, "slate");
    g.rect(7, 21, 3, 1, "plum");
  } else {
    const fwd: "slate" | "indigo" = s === 1 ? "slate" : "indigo";
    const back: "slate" | "indigo" = s === 1 ? "indigo" : "slate";
    g.rect(8, 16, 2, 3, fwd); // leading leg strides ahead...
    g.rect(10, 19, 2, 2, fwd);
    g.rect(10, 21, 2, 1, "plum");
    g.rect(6, 16, 2, 3, back); // ...trailing leg pushes off behind
    g.rect(4, 19, 2, 2, back);
    g.rect(4, 21, 2, 1, "plum");
  }

  // torso: bone shirt, slate bib wrapping the near side
  g.rect(5, 9 + dy, 6, 7, "bone");
  g.rect(6, 10 + dy, 5, 5, "slate");
  g.px(7, 9 + dy, "slate"); // strap over the shoulder
  g.px(6, 10 + dy, "skyBlue"); // lit bib edge
  g.px(10, 13 + dy, "indigo"); // shade at the trailing edge
  g.px(10, 14 + dy, "indigo");
  g.rect(5, 15 + dy, 6, 1, "plum"); // belt

  // near arm swings across the torso (bone sleeve, clay hand)
  if (sw === 0) {
    g.rect(7, 10 + dy, 2, 4, "bone");
    g.px(8, 14 + dy, "clay");
  } else if (sw === 1) {
    g.px(7, 10 + dy, "bone");
    g.px(8, 10 + dy, "bone");
    g.px(8, 11 + dy, "bone");
    g.px(9, 11 + dy, "bone");
    g.px(9, 12 + dy, "bone");
    g.px(10, 12 + dy, "bone");
    g.px(10, 13 + dy, "clay");
  } else {
    g.px(7, 10 + dy, "bone");
    g.px(8, 10 + dy, "bone");
    g.px(7, 11 + dy, "bone");
    g.px(6, 11 + dy, "bone");
    g.px(6, 12 + dy, "bone");
    g.px(5, 12 + dy, "bone");
    g.px(4, 13 + dy, "clay");
  }

  // head: helmet profile with the brim and lantern to the front (right)
  g.rect(6, 1 + dy, 5, 1, "rust");
  g.rect(5, 2 + dy, 7, 2, "rust");
  g.px(6, 1 + dy, "clay");
  g.px(5, 2 + dy, "clay");
  g.rect(9, 4 + dy, 3, 1, "rust"); // brim jutting forward
  g.rect(5, 4 + dy, 3, 1, "rust"); // brim behind
  g.px(10, 2 + dy, "amber"); // lantern at the helmet front
  g.px(10, 1 + dy, "sandLight"); // its glow
  // face
  g.rect(7, 5 + dy, 4, 3, "clay");
  g.px(11, 5 + dy, "clay"); // nose
  g.px(9, 5 + dy, "ink"); // eye
  // bone beard hanging at the jaw
  g.px(10, 7 + dy, "bone");
  g.rect(7, 8 + dy, 4, 1, "bone");
  g.px(9, 9 + dy, "bone"); // beard tip over the collar
  g.px(10, 8 + dy, "sandLight"); // beard shade

  return g;
}

/** Rim + sel-out for a profile frame — applied AFTER the mirror for the left
 *  row so the key light stays NNW in both directions. */
function polishSide(g: PixelGrid): PixelGrid {
  rimTopLeft(g, { x: 3, y: 0, w: 10, h: 5 });
  selOut(g);
  return g;
}

/** All 24 frames, row-major: down(0–5), left(6–11), right(12–17), up(18–23). */
export function minerFrames(): PixelGrid[] {
  const down = FRAME_POSES.map(minerDown);
  const sides = FRAME_POSES.map(minerSide);
  const left = sides.map((f) => polishSide(f.mirrorX()));
  const right = sides.map(polishSide);
  const up = FRAME_POSES.map(minerUp);
  return [...down, ...left, ...right, ...up];
}
