/**
 * Icebat — 24×24 cave bat from the frozen depths.
 *
 * Frames 0–1 idle: hanging upside-down with folded wings, a 1px hang-twitch
 * with an ear flick and a mint eye glint. Frames 2–5 move: airborne flap —
 * wings sweep up / mid / down / mid while the body bobs.
 *
 * Colourway: indigo body and wing fingers, skyBlue membrane, slate folds,
 * mint eye glints, ink outline.
 */
import { PixelGrid } from "../grid";

export const ICEBAT_FRAME = 24;

type WingPose = "up" | "mid" | "down";

/** Hanging idle. `twitch` sways the body and flicks the ears/eyes. */
function drawHanging(twitch: boolean): PixelGrid {
  const g = new PixelGrid(ICEBAT_FRAME, ICEBAT_FRAME);
  const dx = twitch ? 1 : 0;

  // claws gripping the (off-screen) ceiling
  g.px(10 + dx, 3, "ink");
  g.px(13 + dx, 3, "ink");
  g.px(10 + dx, 4, "indigo");
  g.px(13 + dx, 4, "indigo");

  // body wrapped in folded wings
  g.rect(9 + dx, 5, 6, 9, "indigo");
  g.rect(9 + dx, 6, 2, 7, "slate"); // folded wing creases
  g.rect(13 + dx, 6, 2, 7, "slate");
  g.px(10 + dx, 7, "skyBlue"); // frost sheen on the folds
  g.px(14 + dx, 9, "skyBlue");
  g.px(9 + dx, 11, "skyBlue");
  g.px(13 + dx, 6, "skyBlue");

  // head at the bottom (upside-down), ears pointing down
  g.rect(10 + dx, 14, 4, 3, "indigo");
  const earDrop = twitch ? 1 : 0;
  g.px(10 + dx, 17 + earDrop, "indigo");
  g.px(13 + dx, 17 + earDrop, "indigo");
  // mint eyes, glinting white on the twitch frame
  g.px(11 + dx, 15, twitch ? "white" : "mint");
  g.px(12 + dx, 15, "mint");

  g.outline("ink");
  return g;
}

/** Airborne flap. `dy` bobs the whole bat; the wings sweep with `wing`. */
function drawFlying(wing: WingPose, dy: number): PixelGrid {
  const g = new PixelGrid(ICEBAT_FRAME, ICEBAT_FRAME);

  // head with tall ears
  g.rect(10, 6 + dy, 4, 3, "indigo");
  g.px(10, 5 + dy, "indigo"); // ears
  g.px(13, 5 + dy, "indigo");
  g.px(11, 7 + dy, "mint"); // eyes
  g.px(12, 7 + dy, "mint");

  // body
  g.rect(10, 9 + dy, 4, 7, "indigo");
  g.px(10, 11 + dy, "skyBlue"); // frosted chest
  g.px(10, 12 + dy, "skyBlue");
  g.px(13, 14 + dy, "slate"); // haunch shade
  g.px(11, 16 + dy, "indigo"); // tail notch
  g.px(12, 16 + dy, "indigo");

  // wings: indigo leading edge over a skyBlue membrane
  for (const dir of [-1, 1] as const) {
    const sx = dir < 0 ? 9 : 14;
    for (let i = 0; i < 7; i++) {
      const x = sx + dir * (i + 1);
      let y: number;
      if (wing === "up") y = 9 + dy - i;
      else if (wing === "mid") y = 10 + dy + (i > 3 ? 1 : 0);
      else y = 11 + dy + i;
      g.px(x, y, "indigo"); // leading edge
      g.px(x, y + 1, "skyBlue"); // membrane
      if (i < 5) g.px(x, y + 2, "skyBlue");
    }
  }

  g.outline("ink");
  return g;
}

/** All 6 frames: 0–1 hang-twitch idle, 2–5 flap cycle. */
export function icebatFrames(): PixelGrid[] {
  return [
    drawHanging(false),
    drawHanging(true),
    drawFlying("up", 0),
    drawFlying("mid", -1),
    drawFlying("down", 0),
    drawFlying("mid", 1)
  ];
}
