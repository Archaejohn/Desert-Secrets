/**
 * Thomas — Joseph's friend, the one he keeps just missing over the radio
 * (see core/scripts/thomas.ts) until they finally connect in the Part Two
 * opening. A muscle-man concept: a big, broad-shouldered strongman with bare,
 * bulging arms and a tank top, deliberately the widest human body-type in the
 * cast so he reads instantly next to Joseph (slim) and John (sturdy + hat).
 *
 * Same 16×24 / 4-direction / 6-frame layout as the hero and John, sharing the
 * pose table in poses.ts and the mirror trick for the left row. Palette: clay
 * skin with rust muscle-shade, a teal singlet with tealDeep trim, umber
 * trousers, ink boots, and short dark umber hair (no hat — his tell is the
 * shoulders, not a silhouette accessory).
 */
import { PixelGrid } from "../grid";
import { FRAME_POSES, CHAR_FRAME_W, CHAR_FRAME_H, type Pose } from "./poses";
import { rimTopLeft, selOut } from "./polish";

function newFrame(): PixelGrid {
  return new PixelGrid(CHAR_FRAME_W, CHAR_FRAME_H);
}

/** Short dark hair + a heavy-jawed face, front view (back of the head for `up`). */
function headDown(g: PixelGrid, dy: number, withFace: boolean): void {
  // short cropped hair, flat on top
  g.rect(5, 1 + dy, 6, 1, "umber");
  g.rect(4, 2 + dy, 8, 2, "umber"); // y2..3
  g.px(5, 1 + dy, "clay"); // top-left catch light in the hair
  g.px(6, 1 + dy, "clay");
  if (withFace) {
    g.rect(5, 4 + dy, 6, 4, "clay"); // face y4..7
    g.rect(6, 8 + dy, 4, 1, "clay"); // heavy chin
    g.px(4, 4 + dy, "umber"); // sideburns
    g.px(11, 4 + dy, "umber");
    g.px(6, 6 + dy, "ink"); // eyes, set under a strong brow
    g.px(9, 6 + dy, "ink");
    g.px(5, 5 + dy, "umber"); // brow line
    g.px(10, 5 + dy, "umber");
    g.px(6, 7 + dy, "rust"); // square-jaw shade
    g.px(9, 7 + dy, "rust");
  } else {
    // back of a close-cropped head
    g.rect(4, 4 + dy, 8, 3, "umber");
    g.rect(5, 7 + dy, 6, 1, "umber");
    g.rect(6, 8 + dy, 4, 1, "clay"); // thick neck below
  }
}

/**
 * The torso: a teal singlet over a huge chest, with bare shoulders and traps
 * spreading wide (that width IS the character). front/back view.
 */
function torsoDownUp(g: PixelGrid, dy: number, front: boolean): void {
  // enormous bare shoulders + traps, spread nearly edge to edge — the width IS
  // the character
  g.rect(1, 9 + dy, 14, 1, "clay");
  g.px(1, 9 + dy, "sandLight"); // NNW catch light on the near shoulder
  g.px(2, 9 + dy, "sandLight");
  g.px(13, 9 + dy, "rust"); // far shoulder in shade
  g.px(14, 9 + dy, "rust");
  // the singlet: teal, stretched across a huge chest, scooped so the
  // collarbones/upper chest stay bare
  g.rect(3, 10 + dy, 10, 6, "teal"); // y10..15, x3..12
  if (front) {
    g.rect(5, 10 + dy, 6, 1, "clay"); // scoop neckline (bare upper chest)
    for (let y = 11; y <= 13; y++) {
      g.px(7, y + dy, "tealDeep"); // sternum seam splitting the pecs
      g.px(8, y + dy, "tealDeep");
    }
    g.px(4, 10 + dy, "mint"); // singlet highlight
    for (let y = 11; y <= 15; y++) g.px(12, y + dy, "tealDeep"); // right-side shade
  } else {
    g.px(3, 10 + dy, "mint");
    for (let y = 11; y <= 13; y++) {
      g.px(7, y + dy, "tealDeep"); // spine seam
      g.px(8, y + dy, "tealDeep");
    }
    for (let y = 11; y <= 15; y++) g.px(12, y + dy, "tealDeep");
  }
  g.rect(3, 15 + dy, 10, 1, "umber"); // waistband
}

/**
 * Bare, bulging arms at the sprite edges — 2px wide (thicker than John's
 * sleeves), with a clay bicep bulge and a rust underside shade, counter-
 * swinging with the legs.
 */
function armsDownUp(g: PixelGrid, dy: number, swing: number): void {
  // left arm (viewer's left) — a thick bare bicep bulging out to the frame edge
  g.rect(0, 10 + dy, 3, 4 + swing, "clay");
  g.px(0, 11 + dy, "sandLight"); // bicep peak highlight
  g.px(1, 11 + dy, "sandLight");
  g.px(2, 13 + dy, "rust"); // bicep underside shade
  g.px(1, 14 + swing + dy, "clay"); // fist
  // right arm
  g.rect(13, 10 + dy, 3, 4 - swing, "clay");
  g.px(15, 11 + dy, "rust");
  g.px(14, 13 + dy, "rust");
  g.px(14, 14 - swing + dy, "clay"); // fist
}

/** Umber trousers with ink boots, a heavy planted stance. */
function legsDownUp(g: PixelGrid, stride: number): void {
  if (stride >= 0) {
    g.rect(4, 16, 3, 5, "umber");
    g.rect(4, 21, 3, 1, "ink");
  } else {
    g.rect(4, 16, 3, 4, "umber");
    g.rect(4, 20, 3, 1, "ink");
  }
  if (stride <= 0) {
    g.rect(9, 16, 3, 5, "umber");
    g.rect(9, 21, 3, 1, "ink");
  } else {
    g.rect(9, 16, 3, 4, "umber");
    g.rect(9, 20, 3, 1, "ink");
  }
  g.px(5, 16, "plum"); // inseam shade
  g.px(10, 16, "plum");
}

function thomasDown(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, p.stride);
  torsoDownUp(g, dy, true);
  armsDownUp(g, dy, p.swing);
  headDown(g, dy, true);
  rimTopLeft(g, { x: 2, y: 1, w: 10, h: 8 }); // hair + shoulders catch the key light
  selOut(g);
  return g;
}

function thomasUp(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  legsDownUp(g, -p.stride);
  torsoDownUp(g, dy, false);
  armsDownUp(g, dy, -p.swing);
  headDown(g, dy, false);
  rimTopLeft(g, { x: 2, y: 1, w: 10, h: 8 });
  selOut(g);
  return g;
}

/** Profile view, facing right. The left row is this, mirrored. */
function thomasSide(p: Pose): PixelGrid {
  const g = newFrame();
  const dy = p.bob;
  const s = p.stride;
  const sw = p.swing;

  // legs first, heavy stance
  if (s === 0) {
    g.rect(6, 16, 5, 5, "umber");
    g.rect(6, 21, 5, 1, "ink");
  } else {
    const fwd: "umber" | "plum" = s === 1 ? "umber" : "plum";
    const back: "umber" | "plum" = s === 1 ? "plum" : "umber";
    g.rect(9, 16, 2, 3, fwd);
    g.rect(11, 19, 2, 2, fwd);
    g.rect(11, 21, 2, 1, "ink");
    g.rect(5, 16, 2, 3, back);
    g.rect(3, 19, 2, 2, back);
    g.rect(3, 21, 2, 1, "ink");
  }

  // torso: a deep chest, teal singlet, bare upper back/shoulder
  g.rect(4, 9 + dy, 8, 1, "clay"); // trap/shoulder line, bare
  g.px(4, 9 + dy, "sandLight");
  g.rect(4, 10 + dy, 8, 6, "teal"); // singlet y10..15
  g.px(4, 10 + dy, "clay"); // bare chest at the collar
  g.px(5, 10 + dy, "clay");
  for (let y = 11; y <= 15; y++) g.px(11, y + dy, "tealDeep"); // back shade
  g.rect(4, 15 + dy, 8, 1, "umber"); // waistband

  // near arm: a thick bare bicep swinging across the chest
  if (sw === 0) {
    g.rect(7, 10 + dy, 3, 4, "clay");
    g.px(7, 11 + dy, "sandLight");
    g.px(9, 12 + dy, "rust");
    g.px(8, 14 + dy, "clay"); // fist
  } else if (sw === 1) {
    g.rect(7, 10 + dy, 2, 2, "clay");
    g.px(9, 11 + dy, "clay");
    g.px(9, 12 + dy, "clay");
    g.px(10, 12 + dy, "clay");
    g.px(10, 13 + dy, "clay"); // fist forward
    g.px(7, 10 + dy, "sandLight");
    g.px(9, 12 + dy, "rust");
  } else {
    g.rect(7, 10 + dy, 2, 2, "clay");
    g.px(6, 11 + dy, "clay");
    g.px(6, 12 + dy, "clay");
    g.px(5, 12 + dy, "clay");
    g.px(4, 13 + dy, "clay"); // fist back
    g.px(7, 10 + dy, "sandLight");
    g.px(6, 12 + dy, "rust");
  }

  // head: short hair, heavy jaw, thick neck (no hat)
  g.rect(6, 1 + dy, 5, 1, "umber");
  g.rect(5, 2 + dy, 7, 2, "umber"); // y2..3
  g.px(6, 1 + dy, "clay");
  g.rect(6, 4 + dy, 5, 4, "clay"); // face y4..7
  g.px(11, 6 + dy, "clay"); // brow/nose jut
  g.px(5, 4 + dy, "umber"); // sideburn
  g.px(9, 6 + dy, "ink"); // eye
  g.px(8, 5 + dy, "umber"); // brow
  g.rect(7, 8 + dy, 3, 1, "clay"); // heavy jaw/neck
  g.px(8, 7 + dy, "rust"); // jaw shade

  return g;
}

/** Rim + sel-out for a profile frame — applied AFTER the mirror for the left
 *  row so the key light stays NNW in both directions. */
function polishSide(g: PixelGrid): PixelGrid {
  rimTopLeft(g, { x: 3, y: 1, w: 9, h: 8 });
  selOut(g);
  return g;
}

/** All 24 frames, row-major: down(0–5), left(6–11), right(12–17), up(18–23). */
export function thomasFrames(): PixelGrid[] {
  const down = FRAME_POSES.map(thomasDown);
  const sides = FRAME_POSES.map(thomasSide);
  const left = sides.map((f) => polishSide(f.mirrorX()));
  const right = sides.map(polishSide);
  const up = FRAME_POSES.map(thomasUp);
  return [...down, ...left, ...right, ...up];
}
