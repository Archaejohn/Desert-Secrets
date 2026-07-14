/**
 * Frostscarab — 24×24, the scarab silhouette re-dressed in frost.
 *
 * Reuses the scarab's pose table and leg rig (like foreman.ts does) so the
 * gait matches its desert cousin, but every surface is cold: skyBlue shell
 * with slate shading, a bone rime crust along the shell edges, a mint gem
 * where the scarab carries jade, and pale mint eyes. Frames: 0–1 idle
 * (antenna twitch + gem glint), 2–5 skitter.
 */
import { PixelGrid } from "../grid";
import { BUG_POSES, leg, type BugPose } from "./scarab";

export const FROSTSCARAB_FRAME = 24;

function drawFrostscarab(p: BugPose): PixelGrid {
  const g = new PixelGrid(FROSTSCARAB_FRAME, FROSTSCARAB_FRAME);
  const dy = -p.hop;

  // head: slate under a bone rime brow
  g.rect(9, 5 + dy, 6, 3, "slate");
  g.rect(9, 5 + dy, 6, 1, "bone"); // rime crust on the brow
  g.px(10, 6 + dy, "mint"); // cold eyes
  g.px(13, 6 + dy, "mint");

  // pronotum: skyBlue plate with a bone-lit edge
  g.rect(8, 8 + dy, 8, 2, "skyBlue");
  g.rect(8, 8 + dy, 3, 1, "bone");

  // elytra (rounded shell) — skyBlue ice over the old silhouette
  g.rect(7, 10 + dy, 10, 1, "skyBlue");
  g.rect(6, 11 + dy, 12, 7, "skyBlue");
  g.rect(7, 18 + dy, 10, 1, "skyBlue");
  g.rect(8, 19 + dy, 8, 1, "skyBlue");
  g.rect(9, 20 + dy, 6, 1, "skyBlue");
  // bone rime crusted along the shell's top and left edges
  g.rect(7, 10 + dy, 4, 1, "bone");
  g.rect(6, 11 + dy, 2, 3, "bone");
  g.px(8, 11 + dy, "bone");
  g.px(16, 10 + dy, "bone"); // stray rime flecks
  g.px(17, 12 + dy, "bone");
  // slate depth down the right flank and skirt
  for (let y = 12; y <= 17; y++) g.px(17, y + dy, "slate");
  g.rect(9, 20 + dy, 6, 1, "slate");
  g.px(8, 19 + dy, "slate");
  g.px(15, 19 + dy, "slate");
  // wing-case split
  for (let y = 10; y <= 20; y++) g.px(12, y + dy, "ink");

  // mint gem set over the split — the frost heart
  g.rect(10, 13 + dy, 4, 3, "mint");
  g.px(10, 13 + dy, "white");
  g.px(13, 15 + dy, "jade"); // cool depth in the gem
  if (p.glint) {
    g.px(12, 14 + dy, "white");
    g.px(15, 12 + dy, "white"); // cold shimmer sliding across the shell
  }

  g.outline("ink");

  // six legs, tripod gait — same rig as the scarab
  const attachY = [12, 15, 18];
  attachY.forEach((y, i) => {
    let left = 0;
    let right = 0;
    if (p.legs !== "stand") {
      const a = p.legs === "A" ? 1 : -1;
      left = i % 2 === 0 ? a : -a;
      right = -left;
    }
    leg(g, 5, y + dy, -1, left);
    leg(g, 18, y + dy, 1, right);
  });

  // antennae, rimed at the tips
  g.px(9, 4 + dy, "ink");
  g.px(14, 4 + dy, "ink");
  if (p.antenna === 0) {
    g.px(8, 3 + dy, "bone");
    g.px(15, 3 + dy, "bone");
  } else {
    g.px(7, 3 + dy, "bone");
    g.px(16, 3 + dy, "bone");
  }

  return g;
}

/** All 6 frames: 0–1 idle, 2–5 skitter. */
export function frostscarabFrames(): PixelGrid[] {
  return BUG_POSES.map(drawFrostscarab);
}
