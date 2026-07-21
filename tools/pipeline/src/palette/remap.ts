import { AAP64 } from "./aap64";

type RGB = [number, number, number];
const toRgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Redmean perceptual distance (https://en.wikipedia.org/wiki/Color_difference#sRGB). */
export function redmean(a: RGB, b: RGB): number {
  const rbar = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + rbar / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rbar) / 256) * db * db);
}

/** Rec.601 relative luminance in [0,1]. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Greedy injective assignment: each source → a distinct target, best ΔE first. */
export function assignInjective(sourceHexes: string[], targetHexes: string[]): number[] {
  const srgb = sourceHexes.map(toRgb), trgb = targetHexes.map(toRgb);
  const pairs: { s: number; t: number; d: number }[] = [];
  for (let s = 0; s < srgb.length; s++)
    for (let t = 0; t < trgb.length; t++) pairs.push({ s, t, d: redmean(srgb[s], trgb[t]) });
  pairs.sort((p, q) => p.d - q.d || p.s - q.s || p.t - q.t);
  const out = new Array<number>(sourceHexes.length).fill(-1);
  const usedT = new Set<number>();
  let assigned = 0;
  for (const { s, t } of pairs) {
    if (assigned === sourceHexes.length) break;
    if (out[s] !== -1 || usedT.has(t)) continue;
    out[s] = t; usedT.add(t); assigned++;
  }
  return out;
}

/**
 * Injective 25→AAP-64 remap: plain greedy nearest-match, no repair pass.
 * A prior monotonicity-repair loop cascaded dark/purple colors toward
 * near-black to force strict light→dark ramps (e.g. plum -> #060608, ΔE 166
 * from its true nearest neighbor) while still leaving ramp violations. Small
 * luminance near-ties within a ramp are cosmetically fine; forcing them is
 * not worth destroying color fidelity. The `ramps` param is kept only for
 * call-site compatibility (see `rampInversions` below for reporting instead).
 */
export function remapPalette(
  current: Record<string, string>,
  ramps?: readonly (readonly string[])[],
): Record<string, string> {
  void ramps;
  const names = Object.keys(current);
  const srcHex = names.map((n) => current[n]);
  const idx = assignInjective(srcHex, AAP64 as string[]);
  const mapping: Record<string, string> = {};
  names.forEach((n, i) => {
    mapping[n] = AAP64[idx[i]];
  });
  return mapping;
}

/**
 * Reports luminance inversions within each ramp (light→dark expected) under
 * a given name→hex mapping, without altering the mapping. Walks adjacent
 * slots; an inversion is when a later (nominally darker) slot ends up
 * brighter than the slot before it.
 */
export function rampInversions(
  mapping: Record<string, string>,
  ramps: readonly (readonly string[])[],
): { rampIndex: number; slot: number; from: string; to: string; drop: number }[] {
  const out: { rampIndex: number; slot: number; from: string; to: string; drop: number }[] = [];
  ramps.forEach((ramp, rampIndex) => {
    for (let i = 1; i < ramp.length; i++) {
      const prevLum = luminance(mapping[ramp[i - 1]]);
      const curLum = luminance(mapping[ramp[i]]);
      if (curLum > prevLum) {
        out.push({ rampIndex, slot: i, from: ramp[i - 1], to: ramp[i], drop: curLum - prevLum });
      }
    }
  });
  return out;
}
