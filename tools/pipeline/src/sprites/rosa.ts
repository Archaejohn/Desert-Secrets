/**
 * Rosa — "the transport driver".
 *
 * Same 16×24 / 4-direction / 6-frame layout as the hero, sharing the pose
 * table in poses.ts. Distinct colourway and silhouette: ink bob haircut
 * (no turban), clay skin, bone work shirt under an amber hi-vis vest with a
 * sandLight reflective stripe, slate work trousers and rust boots.
 *
 * Pure functions only — no disk I/O. `rosaFrames()` returns the 24 frames in
 * sheet order (rows down / left / right / up, 6 frames per row).
 */
import { PixelGrid } from "../grid";
import { FRAME_POSES, CHAR_FRAME_W, CHAR_FRAME_H, type Pose } from "./poses";
import { rimTopLeft, selOut } from "./polish";

function newFrame(): PixelGrid {
  return new PixelGrid(CHAR_FRAME_W, CHAR_FRAME_H);
}

/** Ink bob haircut + face, front view (or the back of the bob for `up`). */
function headDown(g: PixelGrid, dy: number, withFace: boolean): void {
  // hair dome with a plum sheen up-left
  g.rect(5, 1 + dy, 6, 1, "ink");
  g.rect(4, 2 + dy, 8, 2, "ink");
  g.px(5, 1 + dy, "plum");
  g.px(6, 1 + dy, "plum");
  g.px(4, 2 + dy, "plum");
  if (withFace) {
    // bob frames the face on both sides
    g.px(4, 4 + dy, "ink");
    g.px(4, 5 + dy, "ink");
    g.px(11, 4 + dy, "ink");
    g.px(11, 5 + dy, "ink");
    g.rect(5, 4 + dy, 6, 4, "clay");
    g.rect(6, 8 + dy, 4, 1, "clay"); // chin
    g.px(10, 7 + dy, "rust"); // jaw shade, low/right
    g.px(9, 8 + dy, "rust");
    g.px(6, 5 + dy, "ink"); // eyes
    g.px(9, 5 + dy, "ink");
  } else {
    // back of the bob, cut straight at the nape
    g.rect(4, 4 + dy, 8, 3, "ink");
    g.rect(5, 7 + dy, 6, 1, "ink");
    g.px(5, 4 + dy, "plum");
    g.rect(6, 8 + dy, 4, 1, "clay"); // sliver of neck
  }
}

/** Bone shirt with the amber hi-vis vest over it, front/back view.
 *  The vest is two side panels (open at the front) with a reflective
 *  sandLight stripe; on the back it is a full panel. */
function torsoDownUp(g: PixelGrid, dy: number, front: boolean): void {
  g.rect(4, 9 + dy, 8, 7, "bone"); // shirt, y9..15
  if (front) {
    g.rect(4, 9 + dy, 3, 6, "amber"); // left vest panel
    g.rect(9, 9 + dy, 3, 6, "amber"); // right vest panel
    g.px(5, 11 + dy, "sandLight"); // reflective stripe
    g.px(6, 11 + dy, "sandLight");
    g.px(9, 11 + dy, "sandLight");
    g.px(10, 11 + dy, "sandLight");
    // right-side shade on the vest
    g.px(11, 12 + dy, "rust");
    g.px(11, 13 + dy, "rust");
    g.px(11, 14 + dy, "rust");
  } else {
    g.rect(4, 9 + dy, 8, 6, "amber"); // full back panel
    g.rect(4, 11 + dy, 8, 1, "sandLight"); // reflective stripe
    g.px(11, 12 + dy, "rust");
    g.px(11, 13 + dy, "rust");
    g.px(4, 9 + dy, "sandLight"); // top-left light
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

/** Slate trousers with rust work boots. */
function legsDownUp(g: PixelGrid, stride: number): void {
  if (stride >= 0) {
    g.rect(5, 16, 2, 5, "slate");
    g.rect(5, 21, 2, 1, "rust");
  } else {
    g.rect(5, 16, 2, 4, "slate");
    g.rect(5, 20, 2, 1, "rust");
  }
  if (stride <= 0) {
    g.rect(9, 16, 2, 5, "slate");
    g.rect(9, 21, 2, 1, "rust");
  } else {
    g.rect(9, 16, 2, 4, "slate");
    g.rect(9, 20, 2, 1, "rust");
  }
}

function rosaDown(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, p.stride);
  torsoDownUp(g, dy, true);
  armsDownUp(g, dy, p.swing);
  headDown(g, dy, true);
  rimTopLeft(g, { x: 3, y: 0, w: 10, h: 5 }); // sheen along the bob's crown
  selOut(g);
  return g;
}

function rosaUp(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, -p.stride);
  torsoDownUp(g, dy, false);
  armsDownUp(g, dy, -p.swing);
  headDown(g, dy, false);
  rimTopLeft(g, { x: 3, y: 0, w: 10, h: 5 });
  selOut(g);
  return g;
}

/** Profile view, facing right. The left row is this, mirrored. */
function rosaSide(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  const s = p.stride;
  const sw = p.swing;

  // legs first so the shirt hem drapes over the hips
  if (s === 0) {
    g.rect(7, 16, 3, 5, "slate");
    g.rect(7, 21, 3, 1, "rust");
  } else {
    const fwd: "slate" | "plum" = s === 1 ? "slate" : "plum";
    const back: "slate" | "plum" = s === 1 ? "plum" : "slate";
    g.rect(8, 16, 2, 3, fwd); // leading leg strides ahead...
    g.rect(10, 19, 2, 2, fwd);
    g.rect(10, 21, 2, 1, "rust");
    g.rect(6, 16, 2, 3, back); // ...trailing leg pushes off behind
    g.rect(4, 19, 2, 2, back);
    g.rect(4, 21, 2, 1, "rust");
  }

  // torso: bone shirt, amber vest panel on the near side
  g.rect(5, 9 + dy, 6, 7, "bone");
  g.rect(6, 9 + dy, 5, 6, "amber"); // vest wraps the near side
  g.px(7, 11 + dy, "sandLight"); // reflective stripe
  g.px(8, 11 + dy, "sandLight");
  g.px(9, 11 + dy, "sandLight");
  g.px(10, 12 + dy, "rust"); // shade at the vest's trailing edge
  g.px(10, 13 + dy, "rust");
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

  // head: bob profile, hair hanging at the back of the neck
  g.rect(6, 1 + dy, 5, 1, "ink");
  g.rect(5, 2 + dy, 7, 2, "ink");
  g.px(6, 1 + dy, "plum");
  g.px(5, 2 + dy, "plum");
  g.rect(5, 4 + dy, 2, 4, "ink"); // hair falls behind the ear
  g.px(5, 8 + dy, "ink");
  // face
  g.rect(7, 4 + dy, 4, 4, "clay");
  g.px(11, 5 + dy, "clay"); // nose
  g.rect(7, 8 + dy, 3, 1, "clay"); // jaw
  g.px(9, 8 + dy, "rust"); // jaw shade
  g.px(9, 5 + dy, "ink"); // eye

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
export function rosaFrames(): PixelGrid[] {
  const down = FRAME_POSES.map(rosaDown);
  const sides = FRAME_POSES.map(rosaSide);
  const left = sides.map((f) => polishSide(f.mirrorX()));
  const right = sides.map(polishSide);
  const up = FRAME_POSES.map(rosaUp);
  return [...down, ...left, ...right, ...up];
}
