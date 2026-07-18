/**
 * Coherent noise + partition helpers, ported VERBATIM from
 * docs/prototypes/cliff-suite-v6.html:219-244 (h2, sm, mix, clamp, noise,
 * fbm, n1, w1, partition).
 *
 * These are pure integer-hash / arithmetic functions — no `Math.random`,
 * no `Date` — so they satisfy the pipeline's determinism rule directly.
 * Do NOT swap `h2` for `mulberry32`; the seam-agreement math in later
 * cliffs/ modules depends on this exact hash.
 *
 * The prototype closes over a module-level `const T = 16` (the tile size
 * in pixels). We reproduce that as a local constant here rather than
 * importing a shared `TILE_SIZE`, per the port-fidelity instructions.
 */

const T = 16;

/** 2D integer hash → float in [0, 1). Deterministic for a given (i, j, s). */
export function h2(i: number, j: number, s: number): number {
  let n = (i * 374761393 + j * 668265263 + s * 2246822519) >>> 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Smoothstep. */
export const sm = (t: number): number => t * t * (3 - 2 * t);

/** Linear interpolation. */
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Clamp v to [a, b]. */
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Tiling 2D value noise sampled at pixel (x, y) over a `cells`x`cells` lattice. */
export function noise(x: number, y: number, cells: number, s: number): number {
  const fx = (x * cells) / T, fy = (y * cells) / T, x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = sm(fx - x0), ty = sm(fy - y0), w = (n: number) => ((n % cells) + cells) % cells;
  const v = (i: number, j: number) => h2(w(i), w(j), s);
  return mix(mix(v(x0, y0), v(x0 + 1, y0), tx), mix(v(x0, y0 + 1), v(x0 + 1, y0 + 1), tx), ty);
}

/** Fractal Brownian motion: three octaves of `noise` summed with fixed weights. */
export const fbm = (x: number, y: number, s: number): number =>
  noise(x, y, 2, s) * 0.55 + noise(x, y, 4, s + 1) * 0.3 + noise(x, y, 8, s + 2) * 0.15;

/** Tiling 1D value noise (4 cells across the tile width). */
export function n1(x: number, s: number): number {
  const c = 4, fx = (x * c) / T, x0 = Math.floor(fx), tx = sm(fx - x0), w = (n: number) => ((n % c) + c) % c;
  return mix(h2(w(x0), 0, s), h2(w(x0 + 1), 0, s), tx);
}

/** Smooth non-tiling 1D noise for organic cave rims. */
export function w1(t: number, s: number): number {
  const i = Math.floor(t), f = sm(t - i);
  return mix(h2(i, 0, s), h2(i + 1, 0, s), f);
}

/**
 * Split `total` into `n` positive integer parts, each nudged by `chaos`
 * (0 = perfectly even, larger = more jitter), summing back to exactly
 * `total`. Deterministic for a given seed `s`.
 */
export function partition(total: number, n: number, chaos: number, s: number): number[] {
  const even = total / n, w: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = 1 + (h2(i, n, s) - 0.5) * 2 * chaos * 0.7;
    const v = Math.max(1, Math.round(even * j));
    w.push(v);
    sum += v;
  }
  let d = total - sum, i = 0;
  while (d !== 0) {
    const k = i % n;
    if (d > 0) { w[k]++; d--; }
    else if (w[k] > 1) { w[k]--; d++; }
    i++;
    if (i > 500) break;
  }
  return w;
}
