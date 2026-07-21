/**
 * The raycast renderer, ported VERBATIM from `renderWall()` in
 * docs/prototypes/cliff-wall-raycast.html:1047-1118 — projected-bounds pass,
 * per-pixel raycast, depth-discontinuity occlusion (AO), and banded/dithered
 * Lambert shading. Every formula and constant matches the prototype.
 *
 * ADAPTATIONS (the render target, not the math):
 *   - Output is a `PixelGrid` (`../grid`) of `PaletteName` cells rather than
 *     an RGBA `Uint8ClampedArray` written to a `<canvas>`. The prototype's
 *     `R` was already the material ramp; here `R` is a ramp of AAP-64 hex
 *     strings (from `MAT`), so the chosen ramp entry `c = R[idx]` is snapped
 *     to a PaletteName via `hexToName(c)` and written with `grid.px(x,y,name)`.
 *   - Where no solid was hit (`mid[i] < 0`), the cell is left `null`
 *     (transparent) instead of alpha 0.
 *   - `bands`/`dith`/`ao` come from `opts` (defaults `6 / 0.30 / 0.50` — the
 *     prototype's slider defaults) instead of DOM sliders. `aoAmt` is the
 *     `ao` opt.
 *   - The silhouette-outline block (1101-1112) and all canvas/DOM plumbing
 *     (1113-1117) are dropped; the function returns the `PixelGrid` directly.
 *
 * `BAYER` is the prototype's inline 4x4 ordered-dither matrix (line 260).
 *
 * Pure and deterministic: only `h2` (integer-hash noise) and `Math.*` — no
 * DOM, no `Math.random`, no `Date`.
 */

import { h2 } from "../cliffs/noise";
import { PixelGrid } from "../grid";
import { buildWall, type WallParams } from "./buildWall";
import { aabb, trace } from "./primitives";
import { projX, projY, RX, UY, PPU, L, LM, dt, type Vec3 } from "./raymath";
import { hexToName } from "./wallMaterials";

/** Prototype's inline 4x4 ordered-dither matrix (cliff-wall-raycast.html:260). */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function renderWall(
  params: WallParams,
  opts: { bands?: number; dith?: number; ao?: number } = {},
): PixelGrid {
  const { P } = buildWall(params);
  const bands = opts.bands ?? 6;
  const dith = opts.dith ?? 0.3;
  const aoAmt = opts.ao ?? 0.5;

  // ---- projected-bounds pass (1052-1061) ----
  const bb = P.map((p) => {
    const [lo, hi] = aabb(p);
    let ax = 1e9,
      bx = -1e9,
      ay = 1e9,
      by = -1e9;
    for (const X of [lo[0], hi[0]])
      for (const Y of [lo[1], hi[1]])
        for (const Z of [lo[2], hi[2]]) {
          const q: Vec3 = [X, Y, Z];
          const qx = projX(q),
            qy = projY(q);
          ax = Math.min(ax, qx);
          bx = Math.max(bx, qx);
          ay = Math.min(ay, qy);
          by = Math.max(by, qy);
        }
    return [ax, bx, ay, by];
  });
  let mnx = 1e9,
    mxx = -1e9,
    mny = 1e9,
    mxy = -1e9;
  bb.forEach((b) => {
    mnx = Math.min(mnx, b[0]);
    mxx = Math.max(mxx, b[1]);
    mny = Math.min(mny, b[2]);
    mxy = Math.max(mxy, b[3]);
  });
  const x0 = Math.floor(mnx) - 2,
    y0 = Math.floor(mny) - 2;
  const CW = Math.ceil(mxx - mnx) + 4,
    CH = Math.ceil(mxy - mny) + 4;

  const mid = new Int32Array(CW * CH).fill(-1);
  const dep = new Float32Array(CW * CH);
  const lam = new Float32Array(CW * CH);

  // ---- per-pixel raycast (1063-1076) ----
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const px = x0 + x + 0.5,
        py = y0 + y + 0.5;
      const a = px / PPU,
        b = -py / PPU;
      const O: Vec3 = [
        RX[0] * a + UY[0] * b,
        RX[1] * a + UY[1] * b,
        RX[2] * a + UY[2] * b,
      ];
      let best: { t: number; n: Vec3 } | null = null,
        bi = -1;
      for (let k = 0; k < P.length; k++) {
        const bk = bb[k];
        if (px < bk[0] - 1 || px > bk[1] + 1 || py < bk[2] - 1 || py > bk[3] + 1) continue;
        const h = trace(P[k], O);
        if (h && (!best || h.t > best.t)) {
          best = h;
          bi = k;
        }
      }
      if (!best) continue;
      const i = y * CW + x;
      mid[i] = bi;
      dep[i] = best.t;
      lam[i] = Math.max(0, dt(best.n, L) / LM);
    }

  // ---- occlusion from depth discontinuity (1078-1088) ----
  // this is what makes the cracks read as depth
  const ao = new Float32Array(CW * CH);
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      if (mid[i] < 0) continue;
      let occ = 0,
        tot = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const X = x + dx,
            Y = y + dy;
          if (X < 0 || Y < 0 || X >= CW || Y >= CH) continue;
          const j = Y * CW + X;
          if (mid[j] < 0) continue;
          tot++;
          if (dep[j] > dep[i] + 0.06) occ++;
        }
      ao[i] = tot ? occ / tot : 0;
    }

  // ---- shading (1089-1100) ----
  const grid = new PixelGrid(CW, CH);
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x,
        bi = mid[i];
      if (bi < 0) continue;
      const p = P[bi],
        M = p.m,
        R = M.R,
        steps = R.length - 1;
      const nz = (h2(x0 + x, y0 + y, 101) - 0.5) * p.ro * 1.15;
      const bay = (BAYER[(y0 + y) & 3][(x0 + x) & 3] / 16 - 0.5) * dith * 1.7;
      const t = (lam[i] - M.lo) / Math.max(1e-6, M.hi - M.lo);
      const v = Math.max(0, Math.min(1, t)) * steps + nz + bay - ao[i] * aoAmt * 1.7;
      const q = Math.max(0, Math.min(bands - 1, Math.round((v / steps) * (bands - 1))));
      const c = R[Math.round((q / (bands - 1)) * steps)];
      grid.px(x, y, hexToName(c));
    }

  return grid;
}
