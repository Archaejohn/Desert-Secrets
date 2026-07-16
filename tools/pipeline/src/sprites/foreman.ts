/**
 * Foreman — 24×24 armored scarab elite, seen from above.
 *
 * The scarab's silhouette and gait (poses + leg helper are imported from
 * scarab.ts), but the rust shell is riveted over with slate/indigo armor
 * plates: a slate pronotum visor, indigo band plates across the elytra with
 * slate rivets, and a single baleful amber eye slit instead of the gem.
 * Frames: 0–1 idle (antenna twitch + eye flare), 2–5 armored skitter.
 */
import { PixelGrid } from "../grid";
import { BUG_POSES, leg, type BugPose } from "./scarab";
import { rimTopLeft, selOut } from "./polish";

export const FOREMAN_FRAME = 24;

function drawForeman(p: BugPose): PixelGrid {
  const g = new PixelGrid(FOREMAN_FRAME, FOREMAN_FRAME);
  const dy = -p.hop;

  // head under a slate visor
  g.rect(9, 5 + dy, 6, 3, "plum");
  g.rect(9, 5 + dy, 6, 1, "slate"); // visor brow
  // single wide amber eye slit (flares white-hot on the idle glint frame)
  g.rect(10, 6 + dy, 4, 1, "amber");
  if (p.glint) {
    g.px(11, 6 + dy, "white");
    g.px(12, 6 + dy, "white");
    g.px(10, 7 + dy, "amber"); // glow bleeding under the visor
    g.px(13, 7 + dy, "amber");
  }

  // pronotum: full slate plate with a lit edge
  g.rect(8, 8 + dy, 8, 2, "slate");
  g.rect(8, 8 + dy, 3, 1, "skyBlue");

  // elytra (rounded shell) — rust base like the scarab...
  g.rect(7, 10 + dy, 10, 1, "rust");
  g.rect(6, 11 + dy, 12, 7, "rust");
  g.rect(7, 18 + dy, 10, 1, "rust");
  g.rect(8, 19 + dy, 8, 1, "rust");
  g.rect(9, 20 + dy, 6, 1, "rust");
  // ...bolted over with indigo band plates
  g.rect(7, 11 + dy, 10, 2, "indigo");
  g.rect(6, 14 + dy, 12, 2, "indigo");
  g.rect(7, 17 + dy, 10, 1, "indigo");
  g.rect(8, 18 + dy, 8, 1, "indigo");
  // slate rivets along each plate
  g.px(8, 11 + dy, "slate");
  g.px(15, 11 + dy, "slate");
  g.px(7, 14 + dy, "slate");
  g.px(16, 14 + dy, "slate");
  g.px(9, 17 + dy, "slate");
  g.px(14, 17 + dy, "slate");
  // top-left light catching the first plate
  g.px(7, 11 + dy, "skyBlue");
  g.px(6, 14 + dy, "skyBlue");
  // armored keel down the middle instead of the wing-case split
  for (let y = 10; y <= 20; y++) g.px(12, y + dy, "ink");
  g.px(12, 13 + dy, "slate"); // keel rivet
  g.px(12, 16 + dy, "slate");
  // umber depth along the unplated right flank + skirt (G1 shade low/right)
  for (let y = 12; y <= 16; y++) g.px(17, y + dy, "umber");
  g.rect(10, 20 + dy, 5, 1, "umber");

  rimTopLeft(g, { x: 5, y: 7 + dy, w: 9, h: 6 }); // armor crown highlight
  selOut(g);

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

  // antennae — armored stubs, shorter than the scarab's
  g.px(9, 4 + dy, "ink");
  g.px(14, 4 + dy, "ink");
  if (p.antenna === 0) {
    g.px(8, 3 + dy, "slate");
    g.px(15, 3 + dy, "slate");
  } else {
    g.px(7, 3 + dy, "slate");
    g.px(16, 3 + dy, "slate");
  }

  return g;
}

/** All 6 frames: 0–1 idle, 2–5 armored skitter. */
export function foremanFrames(): PixelGrid[] {
  return BUG_POSES.map(drawForeman);
}
