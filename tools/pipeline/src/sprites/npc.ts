/**
 * NPC — "Sahra the Keeper", a desert elder.
 *
 * Same 16×24 / 4-direction / 6-frame layout as the hero, but a deliberately
 * different silhouette: slightly hunched, wide teal/jade robe down to the
 * ankles, mauve sash, bone-white hair and beard, and a planted walking staff
 * (the staff stays put while she bobs — she leans on it).
 */
import { PixelGrid } from "../grid";
import { FRAME_POSES, CHAR_FRAME_W, CHAR_FRAME_H, type Pose } from "./poses";

function newFrame(): PixelGrid {
  return new PixelGrid(CHAR_FRAME_W, CHAR_FRAME_H);
}

/** Planted staff: 1px clay shaft with an amber knob. Drawn *after* the
 *  outline pass so it stays slender. */
function staff(g: PixelGrid, x: number): void {
  g.px(x, 5, "amber"); // knob
  for (let y = 6; y <= 21; y++) g.px(x, y, "clay");
  g.px(x, 12, "rust"); // worn grip
  g.px(x, 13, "rust");
}

/** Wide robe, front/back view. Top edge bobs with the breath; the hem stays
 *  planted on the ground and sways on stride frames. */
function robeDownUp(g: PixelGrid, dy: number, stride: number): void {
  g.rect(3, 9 + dy, 10, 10 - dy, "teal"); // shoulders..y18
  // top-left light
  g.px(3, 9 + dy, "jade");
  g.px(4, 9 + dy, "jade");
  g.px(5, 9 + dy, "jade");
  g.px(3, 10 + dy, "jade");
  g.px(3, 11 + dy, "jade");
  // right-side shade
  for (let y = 11; y <= 18; y++) g.px(12, y, "tealDeep");
  g.rect(3, 13, 10, 1, "mauve"); // sash
  g.rect(3, 19, 10, 1, "tealDeep"); // hem
  if (stride === 1) g.px(2, 19, "tealDeep");
  if (stride === -1) g.px(13, 19, "tealDeep");
}

function feetDownUp(g: PixelGrid, stride: number): void {
  if (stride === 0) {
    g.rect(5, 20, 2, 1, "clay");
    g.rect(9, 20, 2, 1, "clay");
  } else if (stride === 1) {
    g.rect(5, 21, 2, 1, "clay"); // left foot stepping out
    g.rect(9, 20, 2, 1, "clay");
  } else {
    g.rect(5, 20, 2, 1, "clay");
    g.rect(9, 21, 2, 1, "clay");
  }
}

function npcDown(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  robeDownUp(g, dy, p.stride);
  feetDownUp(g, p.stride);
  // free (left-edge) arm swings; the other hand grips the staff
  g.rect(2, 10 + dy, 1, 4 + p.swing, "teal");
  g.px(2, 14 + p.swing + dy, "clay");
  g.px(13, 12 + dy, "clay"); // staff hand
  // head, hunched low
  g.rect(5, 3 + dy, 6, 1, "bone");
  g.rect(4, 4 + dy, 8, 1, "bone");
  g.rect(5, 5 + dy, 6, 3, "clay");
  g.px(4, 5 + dy, "bone"); // side hair
  g.px(11, 5 + dy, "bone");
  g.px(6, 6 + dy, "ink"); // eyes
  g.px(9, 6 + dy, "ink");
  // beard over the robe collar
  g.rect(5, 8 + dy, 6, 2, "bone");
  g.rect(6, 10 + dy, 4, 1, "bone");
  g.rect(7, 11 + dy, 2, 1, "bone");
  g.outline("ink");
  staff(g, 14);
  return g;
}

function npcUp(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  robeDownUp(g, dy, -p.stride);
  feetDownUp(g, -p.stride);
  // swinging arm now on the right edge; staff hand on the left
  g.rect(13, 10 + dy, 1, 4 + p.swing, "teal");
  g.px(13, 14 + p.swing + dy, "clay");
  g.px(2, 12 + dy, "clay"); // staff hand
  // back of head: long bone hair falling over the shoulders
  g.rect(5, 3 + dy, 6, 1, "bone");
  g.rect(4, 4 + dy, 8, 4, "bone");
  g.rect(6, 8 + dy, 4, 2, "bone");
  // sash knot on the back
  g.px(7, 14, "mauve");
  g.px(8, 14, "mauve");
  g.outline("ink");
  staff(g, 1);
  return g;
}

/** Profile, facing right — head thrust forward, curved back, staff ahead. */
function npcSide(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  const s = p.stride;
  // robe with a hunched hump at the back shoulder
  g.rect(4, 9 + dy, 8, 10 - dy, "teal"); // x4..11, down to y18
  g.px(4, 8 + dy, "teal");
  g.px(5, 8 + dy, "teal");
  g.px(4, 9 + dy, "jade");
  g.px(5, 9 + dy, "jade");
  g.px(4, 10 + dy, "jade");
  for (let y = 12; y <= 18; y++) g.px(11, y, "tealDeep");
  g.rect(4, 13, 8, 1, "mauve"); // sash
  g.rect(4, 19, 8, 1, "tealDeep"); // hem
  if (s === 1) g.px(3, 19, "tealDeep");
  if (s === -1) g.px(12, 19, "tealDeep");
  // feet shuffle out from under the hem
  if (s === 0) {
    g.rect(6, 20, 4, 1, "clay");
  } else if (s === 1) {
    g.rect(9, 20, 2, 1, "clay");
    g.rect(4, 20, 2, 1, "clay");
  } else {
    g.rect(8, 21, 2, 1, "clay");
    g.rect(5, 20, 2, 1, "clay");
  }
  // hand reaching to the staff
  g.px(12, 11 + dy, "clay");
  // head pushed forward
  g.rect(7, 3 + dy, 5, 1, "bone");
  g.rect(6, 4 + dy, 6, 1, "bone");
  g.rect(7, 5 + dy, 5, 3, "clay");
  g.px(6, 5 + dy, "bone");
  g.px(12, 6 + dy, "clay"); // nose
  g.px(10, 6 + dy, "ink"); // eye
  // beard
  g.rect(8, 8 + dy, 4, 2, "bone");
  g.rect(9, 10 + dy, 2, 1, "bone");
  g.outline("ink");
  staff(g, 13);
  return g;
}

/** All 24 frames, row-major: down(0–5), left(6–11), right(12–17), up(18–23). */
export function npcFrames(): PixelGrid[] {
  const down = FRAME_POSES.map(npcDown);
  const right = FRAME_POSES.map(npcSide);
  const left = right.map((f) => f.mirrorX());
  const up = FRAME_POSES.map(npcUp);
  return [...down, ...left, ...right, ...up];
}
