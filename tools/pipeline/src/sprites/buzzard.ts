/**
 * Buzzard — 24×24 carrion bird, facing the player.
 *
 * Plum body with ink flight feathers, bald rust head on a bone ruff, amber
 * eyes, clay hooked beak. Frames: 0–1 idle (hunched perch; frame 1 shrugs
 * the shoulders up and cocks the head), 2–5 flight flap (wings up / level /
 * down / level with the body bobbing against the beat).
 */
import { PixelGrid } from "../grid";

export const BUZZARD_FRAME = 24;

type WingPose = "folded" | "shrug" | "up" | "level" | "down";

function head(g: PixelGrid, cx: number, y: number, cock: number): void {
  // bald rust head over a scruffy bone ruff
  g.rect(cx - 2 + cock, y, 4, 3, "rust");
  g.px(cx - 2 + cock, y, "clay"); // lit brow
  g.px(cx - 1 + cock, y + 1, "amber"); // eyes
  g.px(cx + cock, y + 1, "amber");
  // hooked beak
  g.px(cx - 1 + cock, y + 3, "clay");
  g.px(cx + cock, y + 3, "clay");
  g.px(cx + cock, y + 4, "ink"); // hook tip
  // ruff collar
  g.rect(cx - 3 + cock, y + 3, 6, 2, "bone");
}

function body(g: PixelGrid, cx: number, y: number): void {
  // hunched plum body, ink tail below
  g.rect(cx - 3, y, 6, 6, "plum");
  g.rect(cx - 4, y + 1, 8, 4, "plum");
  g.px(cx - 4, y + 1, "mauve"); // lit shoulder
  g.px(cx - 3, y, "mauve");
  g.rect(cx - 2, y + 6, 4, 2, "ink"); // tail feathers
  g.px(cx - 2, y + 8, "ink");
  g.px(cx + 1, y + 8, "ink");
}

function wing(g: PixelGrid, cx: number, y: number, dir: -1 | 1, pose: WingPose): void {
  // wings drawn from the shoulder outward; ink primaries, plum coverts
  const s = (dx: number, dy: number, c: "plum" | "ink" | "mauve") =>
    g.px(cx + dir * dx, y + dy, c);
  if (pose === "folded") {
    // folded along the body like a cloak
    s(3, 0, "ink");
    s(4, 1, "ink");
    s(4, 2, "ink");
    s(4, 3, "ink");
    s(4, 4, "ink");
    s(3, 5, "ink");
  } else if (pose === "shrug") {
    // shoulders hitched up in a vulture shrug
    s(3, -1, "ink");
    s(4, -1, "ink");
    s(4, 0, "ink");
    s(5, 1, "ink");
    s(4, 2, "ink");
    s(4, 3, "ink");
    s(3, 4, "ink");
  } else if (pose === "up") {
    for (let i = 0; i < 7; i++) {
      s(3 + i, -1 - Math.floor(i / 2), "plum");
      s(3 + i, -Math.floor(i / 2), i < 3 ? "plum" : "ink");
    }
    s(9, -5, "ink"); // wingtip fingers
    s(10, -5, "ink");
  } else if (pose === "level") {
    for (let i = 0; i < 8; i++) {
      s(3 + i, 0, i < 4 ? "plum" : "ink");
      s(3 + i, 1, i < 3 ? "mauve" : "ink");
    }
    s(10, 0, "ink"); // spread tips
    s(10, -1, "ink");
  } else {
    // down
    for (let i = 0; i < 7; i++) {
      s(3 + i, 1 + Math.floor(i / 2), "plum");
      s(3 + i, 2 + Math.floor(i / 2), i < 3 ? "plum" : "ink");
    }
    s(9, 6, "ink");
    s(10, 6, "ink");
  }
}

function drawBuzzard(wings: WingPose, bodyDy: number, cock: number): PixelGrid {
  const g = new PixelGrid(BUZZARD_FRAME, BUZZARD_FRAME);
  const cx = 12;
  const by = 10 + bodyDy;
  body(g, cx, by);
  head(g, cx, by - 5, cock);
  wing(g, cx, by + 1, -1, wings);
  wing(g, cx, by + 1, 1, wings);
  g.outline("ink");
  // talons after the outline so they stay wiry
  if (wings === "folded" || wings === "shrug") {
    g.px(cx - 2, by + 9, "amber");
    g.px(cx - 1, by + 9, "amber");
    g.px(cx + 1, by + 9, "amber");
    g.px(cx + 2, by + 9, "amber");
  } else {
    // tucked up in flight
    g.px(cx - 1, by + 8, "amber");
    g.px(cx + 1, by + 8, "amber");
  }
  return g;
}

/** All 6 frames: 0–1 perched idle (shrug), 2–5 flap cycle. */
export function buzzardFrames(): PixelGrid[] {
  return [
    drawBuzzard("folded", 2, 0), // 0 idle A: hunched perch
    drawBuzzard("shrug", 1, 1), // 1 idle B: shoulders up, head cocks
    drawBuzzard("up", 1, 0), // 2 wings high, body dropped
    drawBuzzard("level", 0, 0), // 3 mid-beat
    drawBuzzard("down", -1, 0), // 4 power stroke, body lifted
    drawBuzzard("level", 0, 1) // 5 mid-beat, head checks the prey
  ];
}
