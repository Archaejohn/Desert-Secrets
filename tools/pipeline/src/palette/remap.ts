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
 * Injective 25→AAP-64 remap, then per-ramp monotonicity repair: if a ramp's
 * mapped luminances aren't non-increasing, re-assign the offending name to the
 * nearest still-free AAP-64 hex that restores order. Deterministic.
 */
export function remapPalette(
  current: Record<string, string>,
  ramps: readonly (readonly string[])[],
): Record<string, string> {
  const names = Object.keys(current);
  const srcHex = names.map((n) => current[n]);
  const idx = assignInjective(srcHex, AAP64 as string[]);
  const used = new Set(idx);
  const mapping: Record<string, string> = {};
  names.forEach((n, i) => (mapping[n] = AAP64[idx[i]]));

  // Monotonicity repair pass (bounded; deterministic order).
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const ramp of ramps) {
      for (let i = 1; i < ramp.length; i++) {
        const prev = luminance(mapping[ramp[i - 1]]);
        const cur = luminance(mapping[ramp[i]]);
        if (cur > prev + 1e-9) {
          // find nearest free AAP-64 hex darker than prev, closest to current target
          const want = toRgb(mapping[ramp[i]]);
          let best = -1, bestD = Infinity;
          for (let t = 0; t < AAP64.length; t++) {
            if (used.has(t)) continue;
            if (luminance(AAP64[t]) > prev + 1e-9) continue;
            const d = redmean(want, toRgb(AAP64[t]));
            if (d < bestD) { bestD = d; best = t; }
          }
          if (best >= 0) {
            used.delete(AAP64.indexOf(mapping[ramp[i]]));
            mapping[ramp[i]] = AAP64[best];
            used.add(best);
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
  return mapping;
}
