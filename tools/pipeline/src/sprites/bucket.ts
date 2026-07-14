/**
 * Bucket — a plain clay/rust pail prop for the Act 1 fetch-quest (see
 * docs/CONTRACTS.md "Act 1 addition: the bucket fetch-quest + a minimal
 * inventory (v5)").
 *
 * Unlike every other sheet in this pipeline this is not a creature with an
 * idle/walk cycle — it's a static prop with exactly two discrete states and
 * no motion between them. 16×16, one row of 2 frames:
 *   0 — empty: the pail's rim opening shows an `ink` hollow interior.
 *   1 — full: pixel-identical to frame 0 except the rim opening now shows a
 *       `skyBlue`/`mint` water surface with a single `white` glint — the
 *       "it's now full" tell, obvious even at a glance.
 *
 * The shell (handle, rim, tapered trapezoid body, base) is shared by both
 * frames and drawn first; only the interior row at the rim opening differs.
 */
import { PixelGrid } from "../grid";

export const BUCKET_FRAME = 16;

/** Handle, rim and tapered body — identical opaque footprint in both
 *  frames. Interior cells (the rim opening) are left for the caller so the
 *  outline pass sees a complete silhouette before it runs. */
function drawShell(g: PixelGrid): void {
  // handle: thin ink arc above the rim
  g.rect(6, 1, 4, 1, "ink"); // top bar
  g.px(5, 2, "ink");
  g.px(10, 2, "ink");
  g.px(4, 3, "ink"); // attach points, directly above the rim
  g.px(11, 3, "ink");

  // rim front lip
  g.rect(5, 3, 6, 1, "clay");
  // rim outer edge / side walls just under the rim
  g.px(3, 4, "rust");
  g.px(4, 4, "clay");
  g.px(11, 4, "clay");
  g.px(12, 4, "rust");

  // tapered trapezoid body, narrowing toward the base
  g.rect(3, 5, 10, 2, "rust");
  g.rect(4, 7, 8, 2, "rust");
  g.rect(5, 9, 6, 2, "rust");
  g.rect(6, 11, 4, 2, "clay"); // base / foot band
}

/** The 6 interior cells at the rim opening (y=4, x=5..10). */
const INTERIOR_Y = 4;
const INTERIOR_X0 = 5;
const INTERIOR_X1 = 10;

function drawEmpty(): PixelGrid {
  const g = new PixelGrid(BUCKET_FRAME, BUCKET_FRAME);
  drawShell(g);
  for (let x = INTERIOR_X0; x <= INTERIOR_X1; x++) g.px(x, INTERIOR_Y, "ink"); // hollow
  g.outline("ink");
  return g;
}

function drawFull(): PixelGrid {
  const g = new PixelGrid(BUCKET_FRAME, BUCKET_FRAME);
  drawShell(g);
  // water surface near the rim, with one glint
  g.px(5, INTERIOR_Y, "skyBlue");
  g.px(6, INTERIOR_Y, "white"); // glint
  g.px(7, INTERIOR_Y, "mint");
  g.px(8, INTERIOR_Y, "mint");
  g.px(9, INTERIOR_Y, "skyBlue");
  g.px(10, INTERIOR_Y, "skyBlue");
  g.outline("ink");
  return g;
}

/** Frame 0: empty pail. Frame 1: same pail, now full with a water glint. */
export function bucketFrames(): PixelGrid[] {
  return [drawEmpty(), drawFull()];
}
