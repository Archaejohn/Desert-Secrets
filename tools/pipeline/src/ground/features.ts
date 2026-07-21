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
  const mark = (px: number, py: number, name: PaletteName): void => {
    if (px < 0 || py < 0 || px >= grid.width || py >= grid.height) return;
    grid.px(px, py, name);
    shadow[py * gridWidth + px] = 1;
  };
  for (const f of features) {
    const ox = f.tx * T, oy = f.ty * T;
    if (f.kind === "sunEmblem") drawSunEmblem(mark, ox, oy);
    else drawShatter(mark, ox, oy, f.seed ?? 0);
  }
}

type Mark = (px: number, py: number, name: PaletteName) => void;

/** Amber sun-disc + short rays centered in the tile (reproduces the templeGlyph landmark). */
function drawSunEmblem(mark: Mark, ox: number, oy: number): void {
  const cx = ox + 8, cy = oy + 8;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d = dx * dx + dy * dy;
      if (d <= 9) mark(cx + dx, cy + dy, "amber");        // disc r≈3
    }
  }
  mark(cx, cy, "sandLight");                               // center highlight
  mark(cx - 1, cy - 1, "sandLight");
  // four short rays (N/E/S/W), 2px past the disc.
  for (const [rx, ry] of [[0, -6], [0, -5], [6, 0], [5, 0], [0, 6], [0, 5], [-6, 0], [-5, 0]] as const) {
    mark(cx + rx, cy + ry, "amber");
  }
}

/** A slab broken into shards: ink fissures splitting the tile, indigo displaced edges. */
function drawShatter(mark: Mark, ox: number, oy: number, seed: number): void {
  // Two deterministic diagonal fissures crossing near the tile center.
  const jitter = (n: number) => Math.floor(h2(ox + n, oy + n, seed) * 5) - 2; // -2..2
  const c = 8 + jitter(1);
  for (let t = 0; t < T; t++) {
    const a = c + Math.floor((t - 8) * 0.6) + jitter(t);   // main diagonal
    const b = c - Math.floor((t - 8) * 0.9) + jitter(t + 3); // cross diagonal
    mark(ox + t, oy + a, "ink");
    mark(ox + t, oy + a + 1, "indigo");                    // displaced edge
    mark(ox + b, oy + t, "ink");
  }
}
