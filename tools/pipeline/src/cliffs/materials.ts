/**
 * Wall-face materials, ported from `faceTile`'s rock branch
 * (docs/prototypes/cliff-suite-v6.html:286-322), plus the shared
 * `partition`/`jitter`/`toneK`/`cube`/`poly` helpers it closes over
 * (`:295-296`, `:300-309`).
 *
 * ## Palette adaptation
 *
 * The prototype's `ROCK` colours (`:281`, `{top,right,left,gap}`) are raw
 * hex — this port maps each *role* onto a fixed step of the palette-locked
 * `ROCK` ramp (`palette.ts`, light->dark: sandLight, sand, amber, clay,
 * rust, umber, plum, ink) instead of trying to colour-match the prototype's
 * grey/blue rock hex values, per the task brief:
 *
 * - `ROCK.top`   -> ramp idx 1 (`sand`)
 * - `ROCK.right` -> ramp idx 3 (`clay`)
 * - `ROCK.left`  -> ramp idx 5 (`umber`)
 * - `ROCK.gap`   -> ramp idx 6 (`plum`), the background/mortar fill
 *
 * `toneK` (the prototype's `1+(h2(...)-0.5)*2*tone` RGB multiplier, applied
 * via `scale(hex, k)`) becomes a ramp-index shift: `shade(ROCK, baseIdx,
 * round((1-k)*4))`. `k` is computed once per block (matching the
 * prototype's single `toneK(r*17+i,5)` call per `cube(...)`) and the same
 * resulting shift is applied to all three faces (top/right/left) of that
 * block, exactly as the prototype applies one `k` to all three `poly()`
 * calls inside `cube()`.
 *
 * The mortar background fill (`:292`, `scale(gapBase, 1-mortar*0.5)`, a
 * linear RGB darken maxing out at 50% brightness when `mortar=1`) becomes
 * `shade(ROCK, 6, round(mortar*2))` — a ramp-index darken of up to 2 steps
 * toward `ink`, which is this port's palette-space analogue of "up to ~50%
 * darker" (see task-5 report for the reasoning).
 *
 * ## Polygon rasterization
 *
 * The prototype's `poly()` (`:300-303`) is a canvas `fill()`+`stroke()` of
 * a 4-point path — inherently anti-aliased, which has no palette-locked
 * equivalent. Per the brief ("a per-scanline fill is fine and keeps it
 * pixel-exact"), `fillPolyScanline` below reimplements it as a true
 * per-scanline rasterizer: for each pixel row it finds the polygon's edge
 * crossings at that row's vertical pixel-center (`y+0.5`), then fills every
 * pixel whose horizontal center falls inside an odd number of crossings
 * (standard scanline/parity fill). This reproduces the *solid interior* of
 * each polygon exactly; it does not attempt to reproduce the prototype's
 * anti-aliased edge blending, which cannot be expressed in palette space
 * (see task-5 report "Concerns").
 *
 * `cube()`'s geometry (the `p=2` vertical offset splitting the top diamond
 * from the left/right quads, and the 3x3 wrap-around tiling loop so blocks
 * that straddle an edge appear on the opposite edge too) is kept pixel-for-
 * pixel identical to the prototype (`:304-309`, `:318-319`).
 */
import { PixelGrid } from "../grid";
import { h2, partition } from "./noise";
import { ROCK, shade } from "./palette";
import type { PaletteName } from "../../../../src/shared/palette";

const T = 16;

export type MaterialKey = "rock";

export interface WallParams {
  courses: number;
  blockSize: number;
  blocksPerCourse: number;
  stagger: number;
  tone: number;
  mortar: number;
  orderVsRandom: number;
}

type Point = readonly [number, number];

/**
 * Fill a (possibly concave) polygon into `grid` using a per-scanline
 * crossing-parity rasterizer: for each row, find where the polygon's edges
 * cross that row's pixel-center scanline (`y+0.5`), then fill every pixel
 * whose center (`x+0.5`) sits inside an odd number of crossings to its
 * left. Equivalent to the even-odd fill rule; for the convex quads `cube()`
 * draws this also matches canvas's default nonzero rule.
 */
function fillPolyScanline(grid: PixelGrid, pts: readonly Point[], color: PaletteName): void {
  const xsAll = pts.map((p) => p[0]);
  const ysAll = pts.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ysAll)));
  const y1 = Math.min(grid.height - 1, Math.ceil(Math.max(...ysAll)));
  const gx0 = Math.max(0, Math.floor(Math.min(...xsAll)));
  const gx1 = Math.min(grid.width - 1, Math.ceil(Math.max(...xsAll)));
  if (y0 > y1 || gx0 > gx1) return;

  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    const xs: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi <= py && yj > py) || (yj <= py && yi > py)) {
        const t = (py - yi) / (yj - yi);
        xs.push(xi + t * (xj - xi));
      }
    }
    if (xs.length === 0) continue;
    xs.sort((a, b) => a - b);
    for (let x = gx0; x <= gx1; x++) {
      const px = x + 0.5;
      let count = 0;
      for (const v of xs) if (v <= px) count++;
      if (count % 2 === 1) grid.px(x, y, color);
    }
  }
}

/** Rock ramp role -> base ramp index (see file header for the mapping). */
const ROCK_TOP = 1, ROCK_RIGHT = 3, ROCK_LEFT = 5, ROCK_GAP = 6;

function rockWallFace(params: WallParams, seed: number): PixelGrid {
  const grid = new PixelGrid(T, T);
  const { courses: C, blockSize: bsize, blocksPerCourse: per, stagger: stag, tone, mortar } = params;
  const chaos = params.orderVsRandom;
  const rowH = T / C;

  // Background / mortar fill: darkens toward `ink` as `mortar` rises
  // (palette-space analogue of the prototype's `scale(gapBase, 1-mortar*0.5)`).
  grid.rect(0, 0, T, T, shade(ROCK, ROCK_GAP, Math.round(mortar * 2)));

  const jitter = (i: number, j: number, amt: number): number =>
    Math.round((h2(i, j, seed) - 0.5) * 2 * amt * chaos);

  // toneK: prototype's `1+(h2(i,j,seed+400)-0.5)*2*tone` RGB multiplier,
  // remapped to a ramp-index shift (see file header).
  const toneShift = (i: number, j: number): number => {
    const k = 1 + (h2(i, j, seed + 400) - 0.5) * 2 * tone;
    return Math.round((1 - k) * 4);
  };

  const cube = (x: number, y: number, sz: number, h: number, shift: number): void => {
    const cx = Math.round(x), cy = Math.round(y), p = 2;
    fillPolyScanline(
      grid,
      [[cx, cy - h], [cx + sz, cy - h + p], [cx, cy - h + p * 2], [cx - sz, cy - h + p]],
      shade(ROCK, ROCK_TOP, shift)
    );
    fillPolyScanline(
      grid,
      [[cx, cy - h + p * 2], [cx + sz, cy - h + p], [cx + sz, cy + sz], [cx, cy + sz + p]],
      shade(ROCK, ROCK_RIGHT, shift)
    );
    fillPolyScanline(
      grid,
      [[cx, cy - h + p * 2], [cx - sz, cy - h + p], [cx - sz, cy + sz], [cx, cy + sz + p]],
      shade(ROCK, ROCK_LEFT, shift)
    );
  };

  for (let r = 0; r < C; r++) {
    const widths = partition(T, per, chaos, seed + r * 31);
    const off = (r % 2) * (T / per / 2) * stag;
    let x = 0;
    widths.forEach((w, i) => {
      const bcx = x + w / 2 + off + jitter(r * 17 + i, 1, 1.2);
      const bcy = r * rowH + rowH / 2 + jitter(r * 17 + i, 2, 1.0);
      const sz = Math.max(1, bsize + jitter(r * 17 + i, 3, 1.3));
      const hh = Math.max(1, bsize + jitter(r * 17 + i, 4, 1.8));
      const shift = toneShift(r * 17 + i, 5);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          cube(bcx + dx * T, bcy + dy * T, sz, hh, shift);
        }
      }
      x += w;
    });
  }

  return grid;
}

/** A fully opaque, palette-locked 16x16 wall-face tile for `material`. */
export function wallFace(material: MaterialKey, params: WallParams, seed: number): PixelGrid {
  switch (material) {
    case "rock":
      return rockWallFace(params, seed);
  }
}
