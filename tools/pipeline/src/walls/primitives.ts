/**
 * Solid primitives, AABB, and ray-trace, ported VERBATIM from
 * docs/prototypes/cliff-wall-raycast.html:177-250 (primitive constructors
 * box/ell/obb/eol/ovalY/ovalZ at 177-187, slab at 191-199, aabb at
 * 200-209, trace at 210-250).
 *
 * ADAPTATION: `trace` used the prototype's module-level `DIR`, recomputed
 * whenever the dev-tool's camera moved; here it imports the FIXED
 * (az 0 / el 33) `DIR` from `./raymath` instead, since this port has no
 * camera controls. `Material`/`Solid` are new TS types layered over the
 * plain object shapes the prototype built with `{t:'box', ...}` etc. —
 * the shapes and every arithmetic step are unchanged.
 *
 * `R` on `Material` is a ramp of AAP-64 hex strings; Task 2 supplies the
 * real ramps (`MAT(ix, lo, hi)` in the prototype). This task only needs
 * the shape, not the palette.
 */

import { DIR, nrm, crs, dt, type Vec3 } from "./raymath";

export interface Material {
  R: string[];
  lo: number;
  hi: number;
}

/** A row-of-axes rotation frame: ax[0]/ax[1]/ax[2] are the local U/V/W unit vectors. */
export type Mat3 = [Vec3, Vec3, Vec3];

export interface BoxSolid {
  t: "box";
  lo: Vec3;
  hi: Vec3;
  m: Material;
  ro: number;
}

export interface EllSolid {
  t: "ell";
  c: Vec3;
  r: Vec3;
  m: Material;
  ro: number;
}

export interface ObbSolid {
  t: "obb";
  c: Vec3;
  ax: Mat3;
  r: Vec3;
  m: Material;
  ro: number;
}

export interface EolSolid {
  t: "eol";
  c: Vec3;
  ax: Mat3;
  r: Vec3;
  m: Material;
  ro: number;
}

export type Solid = BoxSolid | EllSolid | ObbSolid | EolSolid;

/* primitives */

export const box = (lo: Vec3, hi: Vec3, m: Material, ro?: number): BoxSolid => ({
  t: "box",
  lo,
  hi,
  m,
  ro: ro || 0,
});

export const ell = (c: Vec3, rr: number | Vec3, m: Material, ro?: number): EllSolid => ({
  t: "ell",
  c,
  r: Array.isArray(rr) ? rr : [rr, rr, rr],
  m,
  ro: ro || 0,
});

export const obb = (c: Vec3, ax: Mat3, rr: Vec3, m: Material, ro?: number): ObbSolid => ({
  t: "obb",
  c,
  ax,
  r: rr,
  m,
  ro: ro || 0,
});

export const eol = (c: Vec3, ax: Mat3, rr: Vec3, m: Material, ro?: number): EolSolid => ({
  t: "eol",
  c,
  ax,
  r: rr,
  m,
  ro: ro || 0,
});

/** A flat oval lying on the ground, spun about Y by t. */
export const ovalY = (
  c: Vec3,
  rx: number,
  ry: number,
  rz: number,
  t: number,
  m: Material,
  ro?: number,
): EolSolid =>
  eol(
    c,
    [
      [Math.cos(t), 0, -Math.sin(t)],
      [0, 1, 0],
      [Math.sin(t), 0, Math.cos(t)],
    ],
    [rx, ry, rz],
    m,
    ro,
  );

/** A flat oval lying in the wall plane, spun about Z by t. */
export const ovalZ = (
  c: Vec3,
  rx: number,
  ry: number,
  rz: number,
  t: number,
  m: Material,
  ro?: number,
): EolSolid =>
  eol(
    c,
    [
      [Math.cos(t), Math.sin(t), 0],
      [-Math.sin(t), Math.cos(t), 0],
      [0, 0, 1],
    ],
    [rx, ry, rz],
    m,
    ro,
  );

/** A block rotated slightly about all three axes, so joints are never perfectly square. */
export function slab(
  c: Vec3,
  r: Vec3,
  rx: number,
  ry: number,
  rz: number,
  m: Material,
  ro?: number,
): ObbSolid {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  let U: Vec3 = [cy * cz, cy * sz, -sy];
  let V: Vec3 = [sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy];
  U = nrm(U);
  const uv = dt(U, V);
  V = nrm([V[0] - U[0] * uv, V[1] - U[1] * uv, V[2] - U[2] * uv]);
  const W = nrm(crs(U, V));
  return obb(c, [U, V, W], r, m, ro);
}

export function aabb(p: Solid): [Vec3, Vec3] {
  if (p.t === "box") return [p.lo, p.hi];
  if (p.t === "ell") {
    return [
      [p.c[0] - p.r[0], p.c[1] - p.r[1], p.c[2] - p.r[2]],
      [p.c[0] + p.r[0], p.c[1] + p.r[1], p.c[2] + p.r[2]],
    ];
  }
  if (p.t === "eol") {
    // exact ellipsoid bound: sqrt of the summed squared axis contributions
    const e: Vec3 = [0, 1, 2].map((j) =>
      Math.hypot(p.r[0] * p.ax[0][j], p.r[1] * p.ax[1][j], p.r[2] * p.ax[2][j]),
    ) as Vec3;
    return [
      [p.c[0] - e[0], p.c[1] - e[1], p.c[2] - e[2]],
      [p.c[0] + e[0], p.c[1] + e[1], p.c[2] + e[2]],
    ];
  }
  const e: Vec3 = [0, 1, 2].map((k) =>
    Math.abs(p.r[0] * p.ax[0][k]) + Math.abs(p.r[1] * p.ax[1][k]) + Math.abs(p.r[2] * p.ax[2][k]),
  ) as Vec3;
  return [
    [p.c[0] - e[0], p.c[1] - e[1], p.c[2] - e[2]],
    [p.c[0] + e[0], p.c[1] + e[1], p.c[2] + e[2]],
  ];
}

export function trace(p: Solid, O: Vec3): { t: number; n: Vec3 } | null {
  const D = DIR;
  if (p.t === "ell") {
    const oc: Vec3 = [O[0] - p.c[0], O[1] - p.c[1], O[2] - p.c[2]];
    const Ol: Vec3 = [oc[0] / p.r[0], oc[1] / p.r[1], oc[2] / p.r[2]];
    const Dl: Vec3 = [D[0] / p.r[0], D[1] / p.r[1], D[2] / p.r[2]];
    const a = dt(Dl, Dl), b = dt(Ol, Dl), c2 = dt(Ol, Ol) - 1, h = b * b - a * c2;
    if (h < 0) return null;
    const t = (-b + Math.sqrt(h)) / a;
    const P: Vec3 = [Ol[0] + t * Dl[0], Ol[1] + t * Dl[1], Ol[2] + t * Dl[2]];
    return { t, n: nrm([P[0] / p.r[0], P[1] / p.r[1], P[2] / p.r[2]]) };
  }
  if (p.t === "eol") {
    const oc: Vec3 = [O[0] - p.c[0], O[1] - p.c[1], O[2] - p.c[2]];
    const Ol: Vec3 = [
      dt(oc, p.ax[0]) / p.r[0],
      dt(oc, p.ax[1]) / p.r[1],
      dt(oc, p.ax[2]) / p.r[2],
    ];
    const Dl: Vec3 = [
      dt(D, p.ax[0]) / p.r[0],
      dt(D, p.ax[1]) / p.r[1],
      dt(D, p.ax[2]) / p.r[2],
    ];
    const a = dt(Dl, Dl), b = dt(Ol, Dl), c2 = dt(Ol, Ol) - 1, h = b * b - a * c2;
    if (h < 0) return null;
    const t = (-b + Math.sqrt(h)) / a;
    const Pl: Vec3 = [Ol[0] + t * Dl[0], Ol[1] + t * Dl[1], Ol[2] + t * Dl[2]];
    // gradient of sum (u_k/r_k)^2 gives the world normal
    let g: Vec3 = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const w = Pl[k] / p.r[k];
      g = [g[0] + w * p.ax[k][0], g[1] + w * p.ax[k][1], g[2] + w * p.ax[k][2]];
    }
    return { t, n: nrm(g) };
  }
  const AX: Mat3 = p.t === "box" ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : p.ax;
  const C: Vec3 =
    p.t === "box"
      ? [(p.lo[0] + p.hi[0]) / 2, (p.lo[1] + p.hi[1]) / 2, (p.lo[2] + p.hi[2]) / 2]
      : p.c;
  const R: Vec3 =
    p.t === "box" ? [(p.hi[0] - p.lo[0]) / 2, (p.hi[1] - p.lo[1]) / 2, (p.hi[2] - p.lo[2]) / 2] : p.r;
  const oc: Vec3 = [O[0] - C[0], O[1] - C[1], O[2] - C[2]];
  let tmin = -1e9, tmax = 1e9, ax = -1, sg = 1;
  for (let k = 0; k < 3; k++) {
    const o = dt(oc, AX[k]), d = dt(D, AX[k]);
    if (Math.abs(d) < 1e-9) {
      if (o < -R[k] || o > R[k]) return null;
      continue;
    }
    let t1 = (-R[k] - o) / d, t2 = (R[k] - o) / d, s2 = 1;
    if (t1 > t2) {
      const q = t1;
      t1 = t2;
      t2 = q;
      s2 = -1;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) {
      tmax = t2;
      ax = k;
      sg = s2;
    }
  }
  if (tmax < tmin || ax < 0) return null;
  return { t: tmax, n: [AX[ax][0] * sg, AX[ax][1] * sg, AX[ax][2] * sg] };
}
