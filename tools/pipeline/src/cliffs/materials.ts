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
 * `ROCK` ramp (`palette.ts`, cool navy stone, light->dark: stoneLit, stone,
 * stoneDark, stoneDark, stoneDeep, stoneDeep, stoneDeep, ink) via the numeric
 * index constants below — so retinting the cliff is a ramp edit, not a code
 * edit. (Slots 4-6 intentionally alias `stoneDeep`; the index arithmetic is
 * preserved from the prototype even though the dark end has fewer distinct
 * steps.)
 *
 * - `ROCK.top`   -> ramp idx 1 (`stone`)
 * - `ROCK.right` -> ramp idx 3 (`stoneDark`)
 * - `ROCK.left`  -> ramp idx 5 (`stoneDeep`)
 * - `ROCK.gap`   -> ramp idx 6 (`stoneDeep`), the background/mortar fill
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
import { clamp, fbm, h2, n1, partition } from "./noise";
import { ROCK, LAVA, shade, type Ramp } from "./palette";
import type { PaletteName } from "../../../../src/shared/palette";

const T = 16;

export type MaterialKey = "rock" | "glacier" | "coralRock" | "basaltRock";

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

export function blockWallFace(ramp: Ramp, params: WallParams, seed: number): PixelGrid {
  const grid = new PixelGrid(T, T);
  const { courses: C, blockSize: bsize, blocksPerCourse: per, stagger: stag, tone, mortar } = params;
  const chaos = params.orderVsRandom;
  const rowH = T / C;

  // Background / mortar fill: darkens toward `ink` as `mortar` rises
  // (palette-space analogue of the prototype's `scale(gapBase, 1-mortar*0.5)`).
  grid.rect(0, 0, T, T, shade(ramp, ROCK_GAP, Math.round(mortar * 2)));

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
      shade(ramp, ROCK_TOP, shift)
    );
    fillPolyScanline(
      grid,
      [[cx, cy - h + p * 2], [cx + sz, cy - h + p], [cx + sz, cy + sz], [cx, cy + sz + p]],
      shade(ramp, ROCK_RIGHT, shift)
    );
    fillPolyScanline(
      grid,
      [[cx, cy - h + p * 2], [cx - sz, cy - h + p], [cx - sz, cy + sz], [cx, cy + sz + p]],
      shade(ramp, ROCK_LEFT, shift)
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

/**
 * Bespoke crystalline glacier face (Task 8) — replaces the `blockWallFace`
 * ICE-recolor placeholder, which read as flat stacked bricks rather than ice.
 *
 * Model: a **toroidal Voronoi facet field**. N deterministic feature points
 * are scattered on the 16x16 torus (all distances wrap mod 16, so the tile is
 * seamless in both axes); each pixel belongs to its nearest point's facet.
 * Where the nearest and second-nearest distances nearly tie, the pixel sits
 * on a facet boundary — those pixels become the dark fracture lines (`indigo`,
 * dropping to `ink` at the deepest, most equidistant pixels). Facet interiors
 * take a per-facet base tone (`skyBlue` for most, `slate` / one `indigo` for
 * shadowed panes). North light: the first interior row *below* a fracture is
 * the facet's lit crest (one ramp step lighter — `white` on skyBlue facets);
 * the row *above* a fracture is the shadowed under-edge (one step darker).
 * Sparse `white` glints sparkle on bright facet interiors.
 *
 * Palette-locked to the ice family only: white / skyBlue / slate / indigo /
 * ink. Fully opaque, deterministic (`h2` only), and a drop-in for
 * `blockWallFace`'s call shape — the block-wall `params` don't map onto facet
 * geometry and are deliberately ignored.
 */
const GLACIER_RAMP: readonly PaletteName[] = ["white", "skyBlue", "slate", "indigo", "ink"];

export function glacierWallFace(params: WallParams, seed: number): PixelGrid {
  void params; // facet geometry has no use for the block-wall knobs
  const grid = new PixelGrid(T, T);

  // Deterministic facet seeds on the torus: a jittered 3x2 lattice (rather
  // than fully random points) so sites keep a minimum separation — pure
  // random placement produced skinny sliver facets and a dominant "X"
  // crossing motif.
  const GX = 3, GY = 2;
  const N = GX * GY;
  const sx: number[] = [], sy: number[] = [], tone: number[] = [];
  for (let gy = 0; gy < GY; gy++) {
    for (let gx = 0; gx < GX; gx++) {
      sx.push(((gx + 0.2 + 0.6 * h2(gx, gy * 7 + 11, seed)) * T) / GX);
      sy.push(((gy + 0.2 + 0.6 * h2(gx, gy * 7 + 23, seed)) * T) / GY);
      tone.push(h2(gx, gy * 7 + 37, seed));
    }
  }
  const wrapD = (d: number): number => {
    const m = ((d % T) + T) % T;
    return m > T / 2 ? m - T : m;
  };

  // Per-pixel: owning facet + boundary closeness (d2 - d1; small = on a
  // crack) + junction closeness (d3 - d1; small = a triple point where
  // three facets meet — the crack web's deepest pits).
  const id = new Int32Array(T * T);
  const edge = new Float64Array(T * T);
  const junction = new Float64Array(T * T);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let i1 = 0, d1 = Infinity, d2 = Infinity, d3 = Infinity;
      for (let k = 0; k < N; k++) {
        const dx = wrapD(x + 0.5 - sx[k]);
        const dy = wrapD(y + 0.5 - sy[k]);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d3 = d2; d2 = d1; d1 = d; i1 = k; }
        else if (d < d2) { d3 = d2; d2 = d; }
        else if (d < d3) d3 = d;
      }
      id[y * T + x] = i1;
      edge[y * T + x] = d2 - d1;
      junction[y * T + x] = d3 - d1;
    }
  }
  const CRACK = 0.75;
  const crackAt = (x: number, y: number): boolean =>
    edge[(((y % T) + T) % T) * T + (((x % T) + T) % T)] < CRACK;

  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const i = y * T + x;
      let idx: number;
      if (edge[i] < CRACK) {
        // Fracture line between facets: solid indigo, dropping to ink only
        // at triple points (junction pits) so the lines stay crisp instead
        // of dithering ink/indigo pixel-by-pixel along diagonals.
        idx = junction[i] < 0.8 ? 4 : 3;
      } else {
        const t = tone[id[i]];
        const base = t < 0.55 ? 1 : t < 0.93 ? 2 : 3; // skyBlue / slate / rare indigo pane
        idx = base;
        if (crackAt(x, y - 1)) idx = base - 1; // north-lit crest under a fracture
        else if (crackAt(x, y + 1)) idx = base + 1; // shadowed under-edge
        else if (base === 1 && h2(x, y, seed + 91) > 0.96) idx = 0; // glint
      }
      grid.px(x, y, GLACIER_RAMP[clamp(idx, 0, 4)]);
    }
  }
  return grid;
}

/**
 * Bespoke reef BIO-ROCK face (Task R3b) — replaces the `blockWallFace`
 * REEF-recolor placeholder, which read as generic stacked bricks rather
 * than the shipped reef zone's drowned bio-rock.
 *
 * Model: one **course of bio-rock strata per tile**, the same anatomy as
 * tileset7's `reefWall` so the cliff reads as the very same material:
 *
 *   - a dark **plum** body with sparse **mauve** rises at the tiling
 *     `fbm`'s high extreme (organic rock grain, not brickwork);
 *   - a lightly broken **slate** lit crest along the top of the course
 *     (the analogue of `reefWall`'s slate top line);
 *   - `reefWall`'s four crisp **slate** block plates at their shipped
 *     spots (x jittered ±1 per seed), each with a single **skyBlue** lit
 *     top-left corner;
 *   - a **mauve** mineral vein (`reefWall`'s rust vein, transposed into
 *     the cool face-ramp family — warm coral colours are decor, not wall);
 *   - an **ink** shadowed lower band whose upper edge wobbles per column
 *     (tiling 1D noise) behind an indigo/ink dither — the deep
 *     under-shadow of each stratum;
 *   - sparse **mint** and **skyBlue** bio-luminescent beads crusting the
 *     shadow line and the body cracks.
 *
 * Palette-locked to the REEF face-ramp family ONLY — mint / skyBlue /
 * slate / mauve / plum / indigo / ink — because `cliffFace` re-quantizes
 * every face pixel through `REEF.indexOf(...)`, and the diagonal flight
 * bodies reuse this exact grid; any colour outside the ramp would flatten
 * in the round-trip. Deterministic (`h2`/`fbm`/`n1` only), fully opaque,
 * and seamless: all geometry wraps mod 16 in BOTH axes (cliff faces tile
 * side by side, and the flight bodies sample this tile toroidally).
 */
export function coralRockWallFace(params: WallParams, seed: number): PixelGrid {
  void params; // organic strata have no use for the block-wall knobs
  const grid = new PixelGrid(T, T);
  const w = (v: number): number => ((v % T) + T) % T;
  const wpx = (x: number, y: number, c: PaletteName): void => grid.px(w(x), w(y), c);

  // 1) Shadow-band profile: per-column top of the ink under-shadow, 10..12,
  //    from tiling 1D noise so the left/right edges agree.
  const bandTop: number[] = [];
  for (let x = 0; x < T; x++) bandTop.push(10 + Math.round(n1(x, seed + 7) * 2));

  // 2) Body: plum mottled to mauve/indigo by tiling fbm, then the band.
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      // Mostly-plum body (reefWall's is near-flat plum): mauve rises only
      // at the fbm's high extreme, so the mottle reads as sparse organic
      // grain instead of a loud repeating blob motif. No indigo mottle —
      // the low-frequency octave pools it into a fake stratum.
      const b = fbm(x, y, seed);
      let c: PaletteName = b > 0.72 ? "mauve" : "plum";
      if (y >= bandTop[x]) {
        // Dissolve into the ink under-shadow: the first band row is an
        // indigo/ink dither so the edge reads eaten, not ruled, then ink.
        c = y === bandTop[x] ? (h2(x, 1, seed + 13) > 0.55 ? "indigo" : "ink") : "ink";
      } else if (y === 0 && h2(x, 3, seed + 29) > 0.15) {
        c = "slate"; // lit crest along the course top (reefWall's slate line)
      }
      grid.px(x, y, c);
    }
  }

  // 3) Slate block plates — reefWall's facet recipe verbatim: the same four
  //    crisp rects at the same spots, each with a single skyBlue lit
  //    top-left corner. Only the x position jitters (±1, per seed) so
  //    variant seeds shift the facet rhythm without ever merging plates.
  const PLATES = [
    { x: 2, y: 2, w: 4, h: 3 },
    { x: 9, y: 2, w: 4, h: 4 },
    { x: 3, y: 7, w: 5, h: 3 },
    { x: 10, y: 8, w: 4, h: 3 },
  ] as const;
  PLATES.forEach((pl, i) => {
    const jx = Math.round((h2(i, 51, seed) - 0.5) * 2); // -1..1
    for (let dy = 0; dy < pl.h; dy++) {
      for (let dx = 0; dx < pl.w; dx++) wpx(pl.x + jx + dx, pl.y + dy, "slate");
    }
    wpx(pl.x + jx, pl.y, "skyBlue"); // lit corner
  });

  // 4) Mauve mineral vein — reefWall's rust vein, transposed into the cool
  //    face-ramp family (warm coral colours are decor, not wall).
  for (const [vx, vy] of [[7, 3], [8, 4], [12, 6], [5, 10]] as const) {
    wpx(vx + Math.round((h2(vx, 97, seed) - 0.5) * 2), vy, "mauve");
  }

  // 5) Bio-luminescent beads crusting the cracks: a few mint/skyBlue points,
  //    biased into the shadowed lower half where the glow pops.
  for (let i = 0; i < 4; i++) {
    const bx = Math.floor(h2(i, 61, seed) * T);
    const by = i < 2 ? 5 + Math.floor(h2(i, 67, seed) * 5) : 11 + Math.floor(h2(i, 67, seed) * 4);
    wpx(bx, by, i % 2 === 0 ? "mint" : "skyBlue");
  }
  // one 2px glow pair on the shadow line (tileset7's glint motif)
  {
    const gx = Math.floor(h2(9, 71, seed) * T);
    wpx(gx, 12, "skyBlue");
    wpx(gx + 1, 12, "mint");
  }

  return grid;
}

/** A fully opaque, palette-locked 16x16 wall-face tile for `material`. */
export function wallFace(material: MaterialKey, params: WallParams, seed: number): PixelGrid {
  switch (material) {
    case "rock":
      return blockWallFace(ROCK, params, seed);
    case "glacier":
      return glacierWallFace(params, seed);
    case "coralRock":
      return coralRockWallFace(params, seed);
    case "basaltRock":
      // Placeholder (tier-2) until the bespoke Worley-lava face (lava biome T7).
      return blockWallFace(LAVA, params, seed);
  }
}
