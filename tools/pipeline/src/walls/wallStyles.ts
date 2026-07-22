/**
 * Block-top shaping, crest skyline profiles, and the strata/granite coursed
 * rock recipes, ported VERBATIM from docs/prototypes/cliff-wall-raycast.html:
 * `shapedSlab` (706-740), `CRESTS`/`crestOff` (742-763), and the `strata`
 * (266-287) and `granite` (288-311) entries of the prototype's `STYLES`
 * table. Every magic constant and every `h2(...)` seed argument is
 * unchanged from the prototype.
 *
 * ADAPTATION: the prototype's `h2(x,y,s)` was a *module-local* hash (folding
 * in a mutable `let SEED=11`) defined right above `STYLES` in the same
 * <script>. This port reuses the shared, SEED-less `h2` from
 * `../cliffs/noise` instead of redefining it — same 3-arg call shape
 * (`h2(i, j, s)`), same determinism guarantee, just one hash implementation
 * shared across the whole pipeline rather than a second copy local to walls.
 * `ce`/`PPU` (the fixed az-0/el-33 camera scale `shapedSlab` needs to floor
 * its shaping amplitude in screen pixels) come from `./raymath`, which
 * already computes them for the fixed shipped view — `ce` just needed its
 * `export` keyword added, no new arithmetic. Only the two coursed styles
 * called out in the task (`strata`, `granite`) are ported; the prototype's
 * other nine (columnar/sandstone/shale/chalk/conglom/tuff/schist/prow/ice)
 * are out of scope for this task.
 */

import { h2 } from "../cliffs/noise";
import { box, ell, slab, type Solid, type Material } from "./primitives";
import { ce, PPU } from "./raymath";
import { MAT } from "./wallMaterials";
import type { Vec3 } from "./raymath";

/** Per-course shaping knobs a `course` function reads; built by Task 4's `buildWall`. */
export interface WallOpts {
  bw: number;
  relief: number;
  frac: number;
  irr: number;
  face: Material;
  top: string;
}

export interface WallStyle {
  name: string;
  face: number[];
  recess: number[];
  cap: number[];
  talus: number[];
  crest: string;
  top: string;
  course(P: Solid[], y0: number, y1: number, W: number, o: WallOpts): void;
}

/* ---------- block tops ----------
   At azimuth 0 / elevation 33 a block's top face is only a few pixels deep, so what
   actually reads is the top EDGE profile across the block's width. These shape that
   edge: the body is carved down and a cap of the chosen form is set on it. */
export function shapedSlab(
  P: Solid[],
  c: Vec3,
  r: Vec3,
  rx: number,
  ry: number,
  rz: number,
  mat: Material,
  ro: number,
  kind: string,
  sd: number,
  irr: number,
): void {
  let k = kind;
  if (k === "mixed") {
    const q = h2(sd, 7, 451);
    k = q < 0.28 ? "round" : q < 0.46 ? "flat" : q < 0.64 ? "chip" : q < 0.79 ? "slope" : q < 0.91 ? "step" : "pitch";
  }
  // Shaping a block whose top is under ~3px tall on screen buys nothing and costs a
  // solid per block — schist's foliation alone doubled the scene before this guard.
  if (k === "flat" || r[1] < Math.max(0.02, 1.5 / (ce * PPU))) {
    P.push(slab(c, r, rx, ry, rz, mat, ro));
    return;
  }
  // amp floored in pixels: below roughly a pixel and a half the shaping is invisible
  const amp = Math.min(
    r[1] * 0.8,
    Math.max(1.5 / (ce * PPU), r[1] * (0.34 + 0.34 * h2(sd, 1, 452)) * (0.45 + irr)),
  );
  const top = c[1] + r[1], hw = r[0], hd = r[2], cz = c[2];
  P.push(slab([c[0], c[1] - amp / 2, cz], [hw, r[1] - amp / 2, hd], rx, ry, rz, mat, ro));
  const base = top - amp;
  switch (k) {
    case "round":
      P.push(ell([c[0], base, cz], [hw, amp, hd], mat, ro * 0.8));
      break;
    case "pitch": {
      const a = Math.atan2(amp, hw) * 0.85;
      P.push(slab([c[0] - hw * 0.5, base + amp * 0.42, cz], [hw * 0.56, amp * 0.44, hd], 0, 0, a, mat, ro));
      P.push(slab([c[0] + hw * 0.5, base + amp * 0.42, cz], [hw * 0.56, amp * 0.44, hd], 0, 0, -a, mat, ro));
      break;
    }
    case "slope": {
      const dir = h2(sd, 2, 453) < 0.5 ? 1 : -1;
      P.push(
        slab(
          [c[0], base + amp * 0.5, cz],
          [hw * 1.02, amp * 0.52, hd],
          0,
          0,
          dir * Math.atan2(amp, hw * 1.9),
          mat,
          ro,
        ),
      );
      break;
    }
    case "chip": {
      const f = 0.42 + h2(sd, 3, 454) * 0.3, left = h2(sd, 4, 455) < 0.5;
      const a = left ? c[0] - hw : c[0] + hw - 2 * hw * f, b = left ? c[0] - hw + 2 * hw * f : c[0] + hw;
      P.push(box([a, base, cz - hd], [b, top, cz + hd], mat, ro));
      break;
    }
    case "step": {
      const left = h2(sd, 5, 456) < 0.5;
      const a = left ? c[0] - hw : c[0], b = left ? c[0] : c[0] + hw;
      P.push(box([a, base, cz - hd], [b, top, cz + hd], mat, ro));
      break;
    }
  }
}

/* ---------- crest profile ----------
   The shape of the wall's top face. Every style used to share one flat table top;
   this makes the crest part of a rock's identity, since what a cliff does at its
   skyline says as much about it as the face texture does. */
export const CRESTS: Record<string, string> = {
  flat: "Flat table",
  domed: "Domed",
  rolling: "Rolling",
  jagged: "Jagged",
  castellated: "Castellated",
  terraced: "Terraced",
  dipping: "Dipping",
};

export function crestOff(kind: string, x: number, W: number, amt: number): number {
  const u = Math.max(0, Math.min(1, x / Math.max(0.001, W)));
  switch (kind) {
    case "domed":
      return amt * (0.1 + 0.9 * Math.sin(Math.PI * u));
    case "rolling":
      return amt * (0.5 + 0.34 * Math.sin(u * 7.4 + h2(0, 1, 441) * 6.3) + 0.2 * Math.sin(u * 14.9 + h2(0, 2, 441) * 6.3));
    case "jagged": {
      const k = Math.floor(u * W * 3.4);
      return amt * (0.1 + 1.05 * Math.pow(h2(k, 2, 442), 1.8));
    }
    case "castellated": {
      const k = Math.floor(u * W * 1.5);
      return amt * (h2(k, 3, 443) < 0.45 ? 0.04 : 0.92);
    }
    case "terraced": {
      const k = Math.floor(u * 3.0);
      return amt * (0.12 + 0.88 * (k / 2));
    }
    case "dipping":
      return amt * (0.05 + 1.05 * u);
    default:
      return 0;
  }
}

/** Cinnabar ore: sparse muted-red ore bodies threading the mine's hewn rock (dark
 *  maroon -> muted red; it is ore in stone, not lava, so it stays low on the ramp). */
const ORE = MAT([2, 3, 44, 45], 0.15, 0.75);

/* ---------- rock styles ----------
   Each returns the blocks of one course. The recess behind is a separate dark plane;
   gaps between blocks expose it, so a crack is genuine occlusion rather than a drawn line. */
export const STYLES: Record<"strata" | "granite" | "minestone", WallStyle> = {
  strata: {
    name: "Stratified",
    face: [31, 32, 63, 62, 61, 60, 59],
    recess: [1, 31, 32],
    cap: [32, 63, 62, 61, 60, 59],
    talus: [31, 32, 63, 62, 61],
    crest: "terraced",
    top: "flat",
    course(P, y0, y1, W, o) {
      let x = 0, k = 0;
      const off = h2(Math.round(y0 * 97), 1, 3) * o.bw;
      while (x < W) {
        const w = o.bw * (0.55 + h2(Math.round(y0 * 97), k, 4) * 0.9 * (0.4 + o.irr));
        const d = o.relief * (0.25 + h2(Math.round(y0 * 97), k, 5) * 0.95);
        const g = o.frac * 0.09 * (0.3 + h2(Math.round(y0 * 97), k, 6));
        const x0 = Math.max(0, x - off), x1 = Math.min(W, x + w - g - off);
        if (x1 > x0 + 0.03) {
          const cy = (y0 + y1) / 2, hh = (y1 - y0) / 2;
          shapedSlab(
            P,
            [(x0 + x1) / 2, cy, d / 2],
            [(x1 - x0) / 2, hh * (0.9 + h2(Math.round(y0 * 97), k, 7) * 0.12), d / 2],
            (h2(Math.round(y0 * 97), k, 8) - 0.5) * 0.46 * o.irr,
            (h2(Math.round(y0 * 97), k, 9) - 0.5) * 0.3 * o.irr,
            (h2(Math.round(y0 * 97), k, 10) - 0.5) * 0.1 * o.irr,
            o.face,
            0.75,
            o.top,
            Math.round(y0 * 97) * 31 + k,
            o.irr,
          );
        }
        x += w;
        k++;
      }
    },
  },
  granite: {
    name: "Blocky granite",
    face: [1, 42, 41, 40, 39, 38, 37],
    recess: [0, 1, 42],
    cap: [42, 41, 40, 39, 38, 37],
    talus: [1, 42, 41, 40, 39],
    crest: "rolling",
    top: "round",
    course(P, y0, y1, W, o) {
      let x = 0, k = 0;
      const off = h2(Math.round(y0 * 97), 21, 3) * o.bw * 1.4;
      while (x < W) {
        const w = o.bw * (0.9 + h2(Math.round(y0 * 97), k, 22) * 1.5 * (0.4 + o.irr));
        const d = o.relief * (0.45 + h2(Math.round(y0 * 97), k, 23) * 1.1);
        const g = o.frac * 0.1;
        const x0 = Math.max(0, x - off), x1 = Math.min(W, x + w - g - off);
        if (x1 > x0 + 0.05) {
          const cy = (y0 + y1) / 2, hh = (y1 - y0) / 2;
          shapedSlab(
            P,
            [(x0 + x1) / 2, cy, d / 2],
            [(x1 - x0) / 2, hh * (0.88 + h2(Math.round(y0 * 97), k, 24) * 0.14), d / 2],
            (h2(Math.round(y0 * 97), k, 25) - 0.5) * 0.58 * o.irr,
            (h2(Math.round(y0 * 97), k, 26) - 0.5) * 0.4 * o.irr,
            (h2(Math.round(y0 * 97), k, 27) - 0.5) * 0.22 * o.irr,
            o.face,
            0.6,
            o.top,
            Math.round(y0 * 97) * 37 + k,
            o.irr,
          );
          if (h2(Math.round(y0 * 97), k, 28) < 0.3)
            // a rounded boss weathered proud
            P.push(
              ell(
                [(x0 + x1) / 2 + (h2((y0 * 97) | 0, k, 29) - 0.5) * 0.2, cy, d * 0.9],
                [((x1 - x0) / 2) * 0.55, hh * 0.6, d * 0.5],
                o.face,
                0.7,
              ),
            );
        }
        x += w;
        k++;
      }
    },
  },
  minestone: {
    name: "Hewn minestone",
    face: [0, 31, 32, 63, 62, 61, 60],   // near-black -> dark warm-grey -> tan (hewn stone)
    recess: [0, 0, 31], cap: [32, 63, 62, 61, 60, 59], talus: [31, 32, 63, 62, 61],
    crest: "jagged", top: "chip",
    // Blocky hewn masonry (granite's course structure, distinct seeds + warm-dark ramp),
    // threaded with sparse cinnabar ore bodies.
    course(P, y0, y1, W, o) {
      let x = 0, k = 0;
      const sd = Math.round(y0 * 97);
      const off = h2(sd, 21, 301) * o.bw * 1.4;
      while (x < W) {
        const w = o.bw * (0.9 + h2(sd, k, 302) * 1.4 * (0.4 + o.irr));
        const d = o.relief * (0.45 + h2(sd, k, 303) * 1.05);
        const g = o.frac * 0.10;
        const x0 = Math.max(0, x - off), x1 = Math.min(W, x + w - g - off);
        if (x1 > x0 + 0.05) {
          const cy = (y0 + y1) / 2, hh = (y1 - y0) / 2;
          shapedSlab(P, [(x0 + x1) / 2, cy, d / 2],
            [(x1 - x0) / 2, hh * (0.88 + h2(sd, k, 304) * 0.14), d / 2],
            (h2(sd, k, 305) - 0.5) * 0.58 * o.irr,
            (h2(sd, k, 306) - 0.5) * 0.40 * o.irr,
            (h2(sd, k, 307) - 0.5) * 0.22 * o.irr, o.face, 0.6,
            o.top, sd * 37 + k, o.irr);
          // cinnabar ore: sparse red body standing slightly proud of the block face.
          if (h2(sd, k, 308) < 0.14) {
            const ox = (x0 + x1) / 2 + (h2(sd, k, 309) - 0.5) * (x1 - x0) * 0.4;
            const oy = cy + (h2(sd, k, 310) - 0.5) * hh;
            const r = (x1 - x0) * 0.12 * (0.6 + h2(sd, k, 311) * 0.8);
            P.push(ell([ox, oy, d * 0.85], [r, r * (0.6 + h2(sd, k, 312) * 0.8), r * 0.7], ORE, 0.5));
          }
        }
        x += w; k++;
      }
    },
  },
};
