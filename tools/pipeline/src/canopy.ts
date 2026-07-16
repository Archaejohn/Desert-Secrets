/**
 * Generic multi-tile tree canopy generator (ART_DIRECTION.md §5 organic
 * school; G1/G2/G5). Grows ONE continuous, organically-lobed leaf mass
 * across an arbitrary footprint of tile cells — not a single 16x16 tile
 * repeated at every position it's placed. An optional fruit-overlay pass
 * scatters fruit sparsely across the finished mass, so the same generator
 * serves a plain tree (omit `fruit`) or a fruit tree (the orange tree)
 * without duplicating the leaf-growing logic.
 *
 * This replaces the original `orangeTreeCanopy` approach in `tileset6.ts`:
 * one small 16x16 tile — its own little lobe cluster, its own six fixed
 * orange positions, its own full ink outline — placed at all twelve
 * overhead cells of the grove chamber's tree. Stamping one small,
 * self-outlined tile twelve times is exactly the "series of circles"
 * failure mode (each copy reads as its own separate blob because each one
 * *is* a separate, identically-outlined blob) rather than one large tree.
 * `orangeTreeCanopy` itself is untouched and stays in the sheet
 * (additive-only) — nothing references it anymore.
 */
import { PixelGrid } from "./grid";
import { mulberry32 } from "./rng";
import { ellipse, scatterMotifs } from "./fx";
import type { PaletteName } from "../../../src/shared/palette";

const TILE = 16;

export interface CanopyFruitOptions {
  /** Roughly how many fruit to scatter across the WHOLE canopy (not per
   *  tile) — keep this sparse; a large tree reads as elegant with a
   *  handful of visible fruit, not one on every leaf. */
  count: number;
  fruit: PaletteName;
  fruitShade: PaletteName;
  fruitGlint: PaletteName;
}

export interface CanopyOptions {
  base?: PaletteName;
  highlight?: PaletteName;
  crevice?: PaletteName;
  /** Every true cell always gets one guaranteed "anchor" lobe and every
   *  pair of adjacent true cells always gets one guaranteed "bridge" lobe
   *  on their shared edge (connectivity is structural, not statistical —
   *  see the connectivity-bug note in `generateCanopyPieces`). This knob
   *  only controls EXTRA decorative lobes on top of that guaranteed base:
   *  `round(cells * (lobesPerCell - 2))`, so values at or below 2 add none
   *  (default 1.6 — i.e. no extras; anchors+bridges alone read as a full
   *  mass) and values above 2 scatter that many more for texture variety. */
  lobesPerCell?: number;
  fruit?: CanopyFruitOptions;
}

/** true = this cell (row, col) grows canopy; false = left transparent (not
 *  part of the crown's silhouette, and not returned as a piece). */
export type CanopyFootprint = ReadonlyArray<ReadonlyArray<boolean>>;

function footprintTrueCells(footprint: CanopyFootprint): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < footprint.length; r++) {
    for (let c = 0; c < footprint[r].length; c++) if (footprint[r][c]) cells.push([r, c]);
  }
  return cells;
}

/**
 * Grows one lobed leaf mass across `footprint` on a single big canvas
 * (footprint cols/rows * 16px), then slices it into one PixelGrid per true
 * cell. Returns a Map keyed `"r{row}c{col}"` (footprint-relative, 0-based)
 * so a caller can place each piece at its own map position. Deterministic
 * given `seed`.
 */
export function generateCanopyPieces(
  footprint: CanopyFootprint,
  seed: number,
  options: CanopyOptions = {}
): Map<string, PixelGrid> {
  const { base = "jade", highlight = "mint", crevice = "tealDeep", lobesPerCell = 1.6, fruit } =
    options;
  const rows = footprint.length;
  const cols = rows > 0 ? footprint[0].length : 0;
  const canvas = new PixelGrid(cols * TILE, rows * TILE);
  const rng = mulberry32(seed);
  const trueCells = footprintTrueCells(footprint);
  if (trueCells.length === 0) return new Map();

  // 1. Lobe placement. Two passes, not one — this is the fix for a real bug
  //    found in review: with only randomly-jittered per-cell lobes at a
  //    modest radius, two adjacent true cells' lobes often did NOT overlap
  //    (16px cell spacing vs ~7px average radius rarely reaches that far),
  //    leaving a genuine transparent gap exactly on the shared tile
  //    boundary. `outline()` (step 4) then correctly rings that real gap —
  //    but once sliced into separate tiles, that internal outline reads as
  //    a seam between two pieces that were supposed to read as one mass.
  //    Fix: an "anchor" lobe at every true cell's own center (its own
  //    coverage) PLUS a "bridge" lobe deterministically placed on the
  //    shared edge midpoint of every pair of orthogonally-adjacent true
  //    cells, sized to guarantee it overlaps both neighbours' anchors —
  //    every internal seam is welded shut by construction, not by hoping
  //    random jitter happens to reach that far.
  const lobes: Array<{ cx: number; cy: number; rx: number; ry: number }> = [];
  const cellCenter = (r: number, c: number): { x: number; y: number } => ({
    x: c * TILE + TILE / 2,
    y: r * TILE + TILE / 2
  });
  for (const [r, c] of trueCells) {
    const { x, y } = cellCenter(r, c);
    const rad = 8 + rng() * 3; // anchor: big enough alone to cover most of its own cell
    lobes.push({
      cx: x + (rng() * 6 - 3),
      cy: y + (rng() * 6 - 3),
      rx: rad,
      ry: rad * 0.85
    });
  }
  const isTrue = (r: number, c: number): boolean =>
    r >= 0 && r < rows && c >= 0 && c < cols && footprint[r][c];
  for (const [r, c] of trueCells) {
    // Only test E and S neighbours per cell so each shared edge is bridged
    // exactly once (the N/W edge of one cell is the S/E edge of another).
    for (const [nr, nc] of [
      [r, c + 1],
      [r + 1, c]
    ] as const) {
      if (!isTrue(nr, nc)) continue;
      const a = cellCenter(r, c);
      const b = cellCenter(nr, nc);
      const rad = 8 + rng() * 3;
      lobes.push({
        cx: (a.x + b.x) / 2 + (rng() * 4 - 2),
        cy: (a.y + b.y) / 2 + (rng() * 4 - 2),
        rx: rad,
        ry: rad * 0.85
      });
    }
  }
  // 1b. A few extra freely-jittered lobes purely for silhouette variety —
  //     these are decoration on top of the now-guaranteed-connected base,
  //     never load-bearing for connectivity.
  const extra = Math.max(0, Math.round(trueCells.length * (lobesPerCell - 2)));
  for (let i = 0; i < extra; i++) {
    const [r, c] = trueCells[Math.floor(rng() * trueCells.length)];
    const { x, y } = cellCenter(r, c);
    const rad = 5 + rng() * 3;
    lobes.push({ cx: x + (rng() * 12 - 6), cy: y + (rng() * 12 - 6), rx: rad, ry: rad * 0.85 });
  }
  for (const l of lobes) ellipse(canvas, l.cx, l.cy, l.rx, l.ry, base);

  // 2. Dark crevices where neighbouring lobes press together (G6 — 2px
  //    clusters at each consecutive pair's midpoint).
  for (let i = 1; i < lobes.length; i++) {
    const a = lobes[i - 1];
    const b = lobes[i];
    const mx = Math.round((a.cx + b.cx) / 2);
    const my = Math.round((a.cy + b.cy) / 2);
    for (const [x, y] of [
      [mx, my],
      [mx + 1, my]
    ] as const) {
      if (canvas.get(x, y) === base) canvas.px(x, y, crevice);
    }
  }

  // 3. Upper-left highlight arc per lobe (G1 — light from the top, biased
  //    left).
  for (const l of lobes) {
    for (let a = Math.PI * 1.05; a <= Math.PI * 1.55; a += 0.18) {
      const x = Math.round(l.cx + Math.cos(a) * Math.max(1, l.rx - 1));
      const y = Math.round(l.cy + Math.sin(a) * Math.max(1, l.ry - 1));
      if (canvas.get(x, y) === base) canvas.px(x, y, highlight);
    }
  }

  // 4. ONE outline pass over the whole crown's silhouette — the key
  //    difference from stamping twelve separately-outlined small tiles:
  //    outline() only rings the outer edge of the merged mass, not each
  //    piece's own boundary, since pieces aren't outlined individually.
  canvas.outline("ink");

  // 5. Optional sparse fruit overlay, gated to only land on leaf pixels
  //    (base/highlight/crevice), never in the transparent background or
  //    riding the outline.
  if (fruit) {
    const leafColors = new Set<PaletteName | null>([base, highlight, crevice]);
    scatterMotifs(
      canvas,
      seed + 97,
      [
        (g, x, y) => {
          g.px(x, y, fruit.fruit);
          if (g.get(x + 1, y) !== null) g.px(x + 1, y, fruit.fruitShade);
          if (g.get(x, y - 1) !== null) g.px(x, y - 1, fruit.fruitGlint);
        }
      ],
      fruit.count,
      {
        margin: 1,
        minSpacing: 5,
        isValid: (x, y) => leafColors.has(canvas.get(x, y))
      }
    );
  }

  // 6. Slice into per-cell pieces.
  const pieces = new Map<string, PixelGrid>();
  for (const [r, c] of trueCells) {
    const piece = new PixelGrid(TILE, TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const cell = canvas.get(c * TILE + x, r * TILE + y);
        if (cell !== null) piece.px(x, y, cell);
      }
    }
    pieces.set(`r${r}c${c}`, piece);
  }
  return pieces;
}
