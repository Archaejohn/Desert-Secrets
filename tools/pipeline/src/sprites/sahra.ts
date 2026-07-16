/**
 * Sahra — keeper of the underground orange grove (Act 5), a desert elder.
 *
 * Same 16×24 / 4-direction / 6-frame layout as the hero, sharing the pose
 * table in poses.ts (and the mirror trick for the left row). Distinct from
 * the generic `npc` elder she replaces: where that rig is a teal robe under
 * bone hair, Sahra inverts it — a long bone/sand robe falling to the
 * ankles, a teal head-wrap with a jade highlight coiled over her hair, a
 * warm deeply-weathered clay face (rust sun-lines), and a thin walking
 * stick that stays planted while she moves (she leans on it). The stick is
 * stamped AFTER the sel-out pass so it stays one pixel thin.
 */
import { PixelGrid } from "../grid";
import { FRAME_POSES, CHAR_FRAME_W, CHAR_FRAME_H, type Pose } from "./poses";
import { rimTopLeft, selOut } from "./polish";

function newFrame(): PixelGrid {
  return new PixelGrid(CHAR_FRAME_W, CHAR_FRAME_H);
}

/** Planted walking stick: 1px umber shaft, a worn clay grip knot. */
function stick(g: PixelGrid, x: number): void {
  g.px(x, 6, "clay"); // polished top knot
  for (let y = 7; y <= 21; y++) g.px(x, y, "umber");
  g.px(x, 11, "clay"); // worn grip
  g.px(x, 12, "clay");
}

/** Teal head-wrap + weathered face, front view (or the wrap's back knot). */
function headDown(g: PixelGrid, dy: number, withFace: boolean): void {
  // the wrap coils in two courses over the crown
  g.rect(5, 2 + dy, 6, 1, "teal");
  g.rect(4, 3 + dy, 8, 2, "teal");
  g.px(5, 2 + dy, "jade"); // lit coil, upper-left
  g.px(6, 2 + dy, "jade");
  g.px(4, 3 + dy, "jade");
  g.px(11, 4 + dy, "tealDeep"); // coil shade, low/right
  g.rect(4, 5 + dy, 8, 1, "tealDeep"); // wrap band over the brow
  if (withFace) {
    g.rect(5, 6 + dy, 6, 3, "clay");
    g.rect(6, 9 + dy, 4, 1, "clay"); // chin
    g.px(10, 7 + dy, "rust"); // deep sun-lines, low/right
    g.px(9, 9 + dy, "rust");
    g.px(5, 8 + dy, "rust"); // weathered cheek crease
    g.px(6, 7 + dy, "ink"); // eyes
    g.px(9, 7 + dy, "ink");
  } else {
    // back of the wrap: the knot, over a wisp of bone hair
    g.rect(5, 6 + dy, 6, 2, "teal");
    g.px(7, 6 + dy, "tealDeep"); // knot
    g.px(8, 6 + dy, "tealDeep");
    g.rect(6, 8 + dy, 4, 1, "bone"); // hair wisp
    g.px(7, 9 + dy, "clay"); // sliver of neck
    g.px(8, 9 + dy, "clay");
  }
}

/** Long bone robe, front/back — falls to the ankles, sways on the stride. */
function robeDownUp(g: PixelGrid, dy: number, stride: number): void {
  g.rect(4, 10 + dy, 8, 9 - dy, "bone"); // shoulders..y18
  g.rect(3, 12 + dy, 10, 7 - dy, "bone"); // widening skirt
  // sand shading low/right (shadowOf[bone] steps: sand folds)
  for (let y = 12; y <= 18; y++) g.px(12, y, "sand");
  g.px(11, 18, "sand");
  g.rect(3, 19, 10, 1, "sand"); // hem in shadow
  g.px(4, 19, "sandShade"); // hem contact shade
  g.px(11, 19, "sandShade");
  // rust waist sash
  g.rect(4, 13 + dy, 8, 1, "rust");
  if (stride === 1) g.px(2, 18, "sand"); // hem swing
  if (stride === -1) g.px(13, 18, "sand");
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

function sahraDown(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  robeDownUp(g, dy, p.stride);
  feetDownUp(g, p.stride);
  // free (left-edge) arm swings; the other hand rests on the stick
  g.rect(2, 11 + dy, 1, 4 + p.swing, "bone");
  g.px(2, 15 + p.swing + dy, "clay");
  g.px(13, 12 + dy, "clay"); // stick hand
  headDown(g, dy, true);
  rimTopLeft(g, { x: 3, y: 1, w: 10, h: 5 }); // light coiling over the wrap
  selOut(g);
  stick(g, 14);
  return g;
}

function sahraUp(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  robeDownUp(g, dy, -p.stride);
  feetDownUp(g, -p.stride);
  g.rect(13, 11 + dy, 1, 4 + p.swing, "bone");
  g.px(13, 15 + p.swing + dy, "clay");
  g.px(2, 12 + dy, "clay"); // stick hand
  headDown(g, dy, false);
  rimTopLeft(g, { x: 3, y: 1, w: 10, h: 5 });
  selOut(g);
  stick(g, 1);
  return g;
}

/** Profile, facing right — chin lifted (she surveys her rows), stick ahead. */
function sahraSide(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  const s = p.stride;

  // long robe in profile
  g.rect(5, 10 + dy, 7, 9 - dy, "bone");
  g.rect(4, 12 + dy, 9, 7 - dy, "bone");
  for (let y = 12; y <= 18; y++) g.px(12, y, "sand"); // trailing folds
  g.rect(4, 19, 9, 1, "sand"); // hem
  g.px(5, 19, "sandShade");
  g.rect(5, 13 + dy, 7, 1, "rust"); // sash
  if (s === 1) g.px(3, 18, "sand");
  if (s === -1) g.px(13, 18, "sand");
  // feet shuffle out from under the hem
  if (s === 0) {
    g.rect(7, 20, 3, 1, "clay");
  } else if (s === 1) {
    g.rect(9, 20, 2, 1, "clay");
    g.rect(5, 20, 2, 1, "clay");
  } else {
    g.rect(8, 21, 2, 1, "clay");
    g.rect(6, 20, 2, 1, "clay");
  }
  // hand reaching to the stick
  g.px(12, 12 + dy, "clay");

  // head: the wrap coiled in profile, face weathered warm
  g.rect(6, 2 + dy, 6, 1, "teal");
  g.rect(5, 3 + dy, 7, 2, "teal");
  g.px(6, 2 + dy, "jade");
  g.px(5, 3 + dy, "jade");
  g.px(11, 4 + dy, "tealDeep");
  g.rect(5, 5 + dy, 7, 1, "tealDeep"); // brow band
  g.px(4, 5 + dy, "teal"); // wrap tail at the nape
  g.px(4, 6 + dy, "teal");
  g.px(4, 7 + dy, "tealDeep");
  // face
  g.rect(6, 6 + dy, 5, 3, "clay");
  g.px(11, 7 + dy, "clay"); // nose
  g.rect(7, 9 + dy, 3, 1, "clay"); // jaw
  g.px(9, 9 + dy, "rust"); // sun-lined jaw shade
  g.px(10, 8 + dy, "rust");
  g.px(9, 7 + dy, "ink"); // eye

  return g;
}

/** Rim + sel-out for a profile frame — applied AFTER the mirror for the left
 *  row so the key light stays NNW in both directions; the stick is stamped
 *  last so it stays one pixel thin. */
function polishSide(g: PixelGrid, stickX: number): PixelGrid {
  rimTopLeft(g, { x: 4, y: 1, w: 9, h: 5 });
  selOut(g);
  stick(g, stickX);
  return g;
}

/** All 24 frames, row-major: down(0–5), left(6–11), right(12–17), up(18–23). */
export function sahraFrames(): PixelGrid[] {
  const down = FRAME_POSES.map(sahraDown);
  const sides = FRAME_POSES.map(sahraSide);
  const left = sides.map((f) => polishSide(f.mirrorX(), 2));
  const right = sides.map((f) => polishSide(f, 13));
  const up = FRAME_POSES.map(sahraUp);
  return [...down, ...left, ...right, ...up];
}
