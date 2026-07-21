/**
 * Authored ground FEATURES: art placed at exact tile positions on top of a
 * composited ground grid (the megalith temple's sun emblem, a shattered slab).
 * Mutates the grid in the PixelGrid/palette-name domain and marks every painted
 * pixel in `shadow` (=1) so the runtime `maskedBlur` leaves features crisp
 * (blur passes shadow pixels through and never averages across them).
 * Deterministic (`h2` only).
 */
import { PixelGrid } from "../grid";
import { h2 } from "../cliffs/noise";
import type { PaletteName } from "../../../../src/shared/palette";

export type GroundFeature =
  | { kind: "sunEmblem"; tx: number; ty: number; seed?: number }
  | { kind: "shatter"; tx: number; ty: number; seed?: number };

const T = 16;

export function paintFeatures(
  grid: PixelGrid,
  terrainId: Uint8Array,
  shadow: Uint8Array,
  features: readonly GroundFeature[],
  gridWidth: number,
): void {
  // `name === null` paints a TRANSPARENT gap (the dark void behind the floor shows
  // through) — used for shatter cracks. `crisp` (default true) marks the pixel
  // shadow=1 so the runtime blur leaves it sharp; pass false to let the blur SOFTEN
  // it (the submerged sun-emblem wants that under-water refraction blur).
  const mark = (px: number, py: number, name: PaletteName | null, crisp = true): void => {
    if (px < 0 || py < 0 || px >= grid.width || py >= grid.height) return;
    grid.px(px, py, name);
    shadow[py * gridWidth + px] = crisp ? 1 : 0;
  };
  for (const f of features) {
    const ox = f.tx * T, oy = f.ty * T;
    if (f.kind === "sunEmblem") drawSunEmblem(mark, ox, oy);
    else drawShatter(mark, ox, oy, f.seed ?? 0);
  }
}

type Mark = (px: number, py: number, name: PaletteName | null, crisp?: boolean) => void;

/** A large carved SUN MEDALLION lying UNDER WATER: a disc + radiating lines in a
 *  dark blue-cast palette (gray stone seen through deep water), with faint skyBlue
 *  caustic glints. Kept crisp here (marked shadow=1 so the floor's global blur skips
 *  it); CompositeGroundView gives the emblem its OWN gentler 3-box refraction blur.
 *  ~34px across (rays reach into the neighbouring tiles). */
function drawSunEmblem(mark: Mark, ox: number, oy: number): void {
  const cx = ox + 8, cy = oy + 8;
  const R = 9;       // stone disc radius (large)
  const painted: Array<[number, number]> = [];
  const put = (px: number, py: number, c: PaletteName): void => { mark(px, py, c); painted.push([px, py]); };
  // Dim radiating rays (indigo) — drawn first; the disc overpaints their inner ends.
  for (let s = 0; s < 12; s++) {
    const ang = (s / 12) * Math.PI * 2;
    for (let r = R; r <= 17; r++) put(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), "indigo");
  }
  // Blue-cast stone disc: ink rim, teal water-lit top-left, indigo shade.
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const d = dx * dx + dy * dy;
      if (d > R * R) continue;
      let c: PaletteName = "slate";                   // blue-gray body
      if (d > (R - 1) * (R - 1)) c = "ink";           // dark carved rim
      else if (dx + dy <= -5) c = "teal";             // water-lit top-left
      else if (dx + dy >= 6) c = "indigo";            // shaded bottom-right
      put(cx + dx, cy + dy, c);
    }
  }
  // Inner carved groove ring + center boss.
  for (let s = 0; s < 20; s++) {
    const ang = (s / 20) * Math.PI * 2;
    put(Math.round(cx + Math.cos(ang) * 4), Math.round(cy + Math.sin(ang) * 4), "ink");
  }
  put(cx, cy, "teal");                               // center boss
  // Faint underwater caustics: sparse skyBlue crest glints on the medallion.
  for (const [px, py] of painted) {
    const dx = px - cx, dy = py - cy;
    const wave = Math.sin(dx * 0.7 + dy * 0.35) + Math.sin(dy * 0.5 - dx * 0.2);
    if (wave > 1.45) mark(px, py, "skyBlue");
  }
}

/** A shattered slab: thin fracture cracks carved across the (intact) slab. Each
 *  crack pixel is TRANSPARENT (null) so the dark void behind the floor shows
 *  through the gap — masked cracks, not a painted-in dark block. */
function drawShatter(mark: Mark, ox: number, oy: number, seed: number): void {
  const cx = ox + 8 + Math.floor(h2(ox, oy, seed) * 4) - 2;      // jittered focus
  const cy = oy + 8 + Math.floor(h2(ox + 1, oy + 1, seed) * 4) - 2;
  // A few wandering fracture lines from the focus; the crack itself is a see-through gap.
  for (let s = 0; s < 3; s++) {
    const base = h2(ox + s, oy, seed + 7) * Math.PI * 2;
    const len = 6 + Math.floor(h2(ox, oy + s, seed + 3) * 5);    // 6..10
    let x = cx, y = cy;
    for (let r = 0; r <= len; r++) {
      const a = base + (h2(ox + r, oy + s, seed + 11) - 0.5) * 0.9; // wander
      x += Math.cos(a); y += Math.sin(a);
      mark(Math.round(x), Math.round(y), null);                 // transparent gap
    }
  }
  mark(cx, cy, null);
}
