/**
 * Pamela — Joseph's mother, warm and practical, keeper of the homestead.
 *
 * Same 16×24 / 4-direction / 6-frame layout as the hero, sharing the pose
 * table in poses.ts (and the mirror trick for the left row) — see
 * rosa.ts / miner.ts for the pattern this follows.
 *
 * Colourway: sand hair tied back in a bun (a small rust ribbon accent marks
 * the tie so it reads clearly at 16px), bone blouse, jade apron with teal
 * straps/pocket — the apron is the strongest colour read, per the game's
 * existing "oasis life" palette associations — sand skirt, clay shoes.
 */
import { PixelGrid } from "../grid";
import { FRAME_POSES, CHAR_FRAME_W, CHAR_FRAME_H, type Pose } from "./poses";

function newFrame(): PixelGrid {
  return new PixelGrid(CHAR_FRAME_W, CHAR_FRAME_H);
}

/** Sand hair tied back + face, front view (or the back-of-head bun for `up`). */
function headDown(g: PixelGrid, dy: number, withFace: boolean): void {
  g.rect(5, 1 + dy, 6, 1, "sand");
  g.rect(4, 2 + dy, 8, 2, "sand");
  g.px(5, 1 + dy, "sandLight");
  g.px(6, 1 + dy, "sandLight");
  g.px(4, 2 + dy, "sandLight");
  if (withFace) {
    g.px(4, 4 + dy, "sand"); // hair swept back at the temples
    g.px(11, 4 + dy, "sand");
    g.rect(5, 4 + dy, 6, 4, "clay");
    g.rect(6, 8 + dy, 4, 1, "clay"); // chin
    g.px(6, 5 + dy, "ink"); // eyes
    g.px(9, 5 + dy, "ink");
  } else {
    // back of the head: hair gathered into a bun, tied with a rust ribbon
    g.rect(4, 4 + dy, 8, 3, "sand");
    g.rect(5, 7 + dy, 6, 1, "sand");
    g.px(5, 4 + dy, "sandLight");
    g.rect(6, 8 + dy, 4, 1, "clay"); // sliver of neck
    g.px(7, 7 + dy, "rust"); // bun ribbon
    g.px(8, 7 + dy, "rust");
  }
}

/** Bone blouse with the jade apron over it, front/back view. The apron is
 *  a bib+skirt panel (open at the back) with teal shoulder straps and a
 *  pocket band; on the back the straps cross instead. */
function torsoDownUp(g: PixelGrid, dy: number, front: boolean): void {
  g.rect(4, 9 + dy, 8, 7, "bone"); // blouse, y9..15
  if (front) {
    g.rect(4, 10 + dy, 8, 5, "jade"); // apron bib+skirt
    g.px(5, 10 + dy, "teal"); // shoulder strap tabs
    g.px(10, 10 + dy, "teal");
    g.rect(6, 12 + dy, 4, 1, "teal"); // pocket band
    g.px(4, 10 + dy, "jade"); // lit apron edge
  } else {
    g.px(6, 10 + dy, "teal"); // ties crossing at the back
    g.px(9, 10 + dy, "teal");
    g.px(7, 11 + dy, "teal");
    g.px(8, 11 + dy, "teal");
  }
  g.rect(4, 15 + dy, 8, 1, "plum"); // belt/waist tie
}

/** Bone blouse sleeves at the sprite edges, counter-swinging with the legs. */
function armsDownUp(g: PixelGrid, dy: number, swing: number): void {
  g.rect(3, 10 + dy, 1, 4 + swing, "bone");
  g.px(3, 14 + swing + dy, "clay");
  g.rect(12, 10 + dy, 1, 4 - swing, "bone");
  g.px(12, 14 - swing + dy, "clay");
}

/** Sand skirt with clay shoes. */
function legsDownUp(g: PixelGrid, stride: number): void {
  if (stride >= 0) {
    g.rect(5, 16, 2, 5, "sand");
    g.rect(5, 21, 2, 1, "clay");
  } else {
    g.rect(5, 16, 2, 4, "sand");
    g.rect(5, 20, 2, 1, "clay");
  }
  if (stride <= 0) {
    g.rect(9, 16, 2, 5, "sand");
    g.rect(9, 21, 2, 1, "clay");
  } else {
    g.rect(9, 16, 2, 4, "sand");
    g.rect(9, 20, 2, 1, "clay");
  }
}

function pamelaDown(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, p.stride);
  torsoDownUp(g, dy, true);
  armsDownUp(g, dy, p.swing);
  headDown(g, dy, true);
  g.outline("ink");
  return g;
}

function pamelaUp(p: Pose): PixelGrid {
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
function pamelaSide(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  const s = p.stride;
  const sw = p.swing;

  // legs first so the skirt hem drapes over the hips
  if (s === 0) {
    g.rect(7, 16, 3, 5, "sand");
    g.rect(7, 21, 3, 1, "clay");
  } else {
    const fwd: "sand" | "amber" = s === 1 ? "sand" : "amber";
    const back: "sand" | "amber" = s === 1 ? "amber" : "sand";
    g.rect(8, 16, 2, 3, fwd); // leading leg strides ahead...
    g.rect(10, 19, 2, 2, fwd);
    g.rect(10, 21, 2, 1, "clay");
    g.rect(6, 16, 2, 3, back); // ...trailing leg pushes off behind
    g.rect(4, 19, 2, 2, back);
    g.rect(4, 21, 2, 1, "clay");
  }

  // torso: bone blouse, jade apron wrapping the near side
  g.rect(5, 9 + dy, 6, 7, "bone");
  g.rect(6, 10 + dy, 5, 5, "jade");
  g.px(7, 9 + dy, "teal"); // strap, over the shoulder (drawn above the arm)
  g.px(6, 10 + dy, "jade"); // lit apron edge
  g.px(10, 13 + dy, "tealDeep"); // shade at the apron's trailing edge
  g.px(10, 14 + dy, "tealDeep");
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

  // head: sand hair profile, gathered into a bun with a rust ribbon
  g.rect(6, 1 + dy, 5, 1, "sand");
  g.rect(5, 2 + dy, 7, 2, "sand");
  g.px(6, 1 + dy, "sandLight");
  g.px(5, 2 + dy, "sandLight");
  g.rect(5, 4 + dy, 2, 4, "sand"); // hair gathered behind the ear
  g.px(5, 8 + dy, "sand");
  g.px(4, 3 + dy, "sand"); // the bun bump behind the head
  g.px(3, 3 + dy, "rust"); // ribbon tie poking out
  // face
  g.rect(7, 4 + dy, 4, 4, "clay");
  g.px(11, 5 + dy, "clay"); // nose
  g.rect(7, 8 + dy, 3, 1, "clay"); // jaw
  g.px(9, 5 + dy, "ink"); // eye

  g.outline("ink");
  return g;
}

/** All 24 frames, row-major: down(0–5), left(6–11), right(12–17), up(18–23). */
export function pamelaFrames(): PixelGrid[] {
  const down = FRAME_POSES.map(pamelaDown);
  const right = FRAME_POSES.map(pamelaSide);
  const left = right.map((f) => f.mirrorX());
  const up = FRAME_POSES.map(pamelaUp);
  return [...down, ...left, ...right, ...up];
}
