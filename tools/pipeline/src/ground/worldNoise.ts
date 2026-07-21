/**
 * World-position value noise — a NON-wrapping continuous lattice sampled at
 * absolute world coords. Unlike cliffs/noise.ts `noise()` (which wraps mod
 * cells and so tiles every 16px), this never repeats. Reuses the shared `h2`
 * hash (seam math depends on it). Safe at world magnitudes: lattice indices
 * stay well under 2^53 for any realistic map (< ~1e6 tiles).
 */
import { h2, sm, mix } from "../cliffs/noise";

export function worldNoise(wx: number, wy: number, freq: number, s: number): number {
  const fx = wx * freq, fy = wy * freq;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = sm(fx - x0), ty = sm(fy - y0);
  const v = (i: number, j: number) => h2(i, j, s);
  return mix(mix(v(x0, y0), v(x0 + 1, y0), tx), mix(v(x0, y0 + 1), v(x0 + 1, y0 + 1), tx), ty);
}

/** Three octaves at the shipped fbm's texture SCALE (2/4/8 cells over a 16px tile). */
export function worldFbm(wx: number, wy: number, s: number): number {
  return worldNoise(wx, wy, 0.125, s) * 0.55
       + worldNoise(wx, wy, 0.25, s + 1) * 0.30
       + worldNoise(wx, wy, 0.5, s + 2) * 0.15;
}

/** Low-frequency enrichment drift (period ~64px). */
export function worldMacro(wx: number, wy: number, s: number): number {
  return worldNoise(wx, wy, 0.015, s);
}
