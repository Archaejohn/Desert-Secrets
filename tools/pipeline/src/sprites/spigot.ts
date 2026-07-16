/**
 * Spigot — a static prop marking exactly where to fill the bucket, next to
 * the spring (see docs/CONTRACTS.md "v6: inventory window, equip, and the
 * spigot"). A single 16×16 frame: no idle/move cycle, just a fixed
 * landmark, so the fill spot reads as obvious rather than an invisible
 * trigger tile.
 */
import { PixelGrid } from "../grid";
import { selOut } from "./polish";

export const SPIGOT_FRAME = 16;

function drawSpigot(): PixelGrid {
  const g = new PixelGrid(SPIGOT_FRAME, SPIGOT_FRAME);

  // clay mound anchoring the post to the ground
  g.rect(4, 13, 8, 2, "clay");
  g.rect(5, 12, 6, 1, "clay");

  // vertical pipe rising from the mound
  g.rect(7, 4, 2, 9, "slate");

  // valve wheel up top, with a lit centre
  g.rect(5, 2, 6, 2, "rust");
  g.px(5, 1, "rust");
  g.px(10, 1, "rust");
  g.px(7, 3, "amber");
  g.px(8, 3, "amber");

  // spout kinking out and down
  g.rect(9, 8, 3, 1, "slate");
  g.px(11, 9, "slate");
  g.px(11, 10, "slate");

  // the tell: a falling drop, unambiguously "water comes out here"
  g.px(11, 11, "skyBlue");
  g.px(11, 12, "skyBlue");
  g.px(10, 13, "mint");

  selOut(g);
  return g;
}

/** One fixed frame — the spigot never animates. */
export function spigotFrames(): PixelGrid[] {
  return [drawSpigot()];
}
