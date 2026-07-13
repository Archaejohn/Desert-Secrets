/**
 * PixelGrid — the pipeline's drawing surface.
 *
 * A grid of cells where every cell is either `null` (fully transparent) or a
 * *palette name* from `src/shared/palette.ts`. Working in palette names (not
 * raw colours) makes palette compliance structural: nothing outside the
 * palette can even be expressed, and the PNG encoder is the single place
 * where names become RGB values.
 */
import type { PaletteName } from "../../../src/shared/palette";

export type Cell = PaletteName | null;

export class PixelGrid {
  readonly width: number;
  readonly height: number;
  private readonly cells: Cell[];

  constructor(width: number, height: number) {
    if (width <= 0 || height <= 0 || !Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error(`Invalid grid size ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    this.cells = new Array<Cell>(width * height).fill(null);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Set a single pixel. Out-of-bounds writes are silently ignored so
   *  procedural strokes can run off the edge without bookkeeping. */
  px(x: number, y: number, c: Cell): void {
    if (this.inBounds(x, y)) this.cells[y * this.width + x] = c;
  }

  get(x: number, y: number): Cell {
    return this.inBounds(x, y) ? this.cells[y * this.width + x] : null;
  }

  /** Filled axis-aligned rectangle (clipped to the grid). */
  rect(x: number, y: number, w: number, h: number, c: Cell): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
    }
  }

  /**
   * Draw a 1px outline of colour `c` into every *transparent* cell that is
   * 4-adjacent to an opaque cell. This is how characters and props get their
   * ink contour without hand-placing it.
   */
  outline(c: PaletteName = "ink"): void {
    const edge: Array<[number, number]> = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y) !== null) continue;
        if (
          (x > 0 && this.get(x - 1, y) !== null) ||
          (x < this.width - 1 && this.get(x + 1, y) !== null) ||
          (y > 0 && this.get(x, y - 1) !== null) ||
          (y < this.height - 1 && this.get(x, y + 1) !== null)
        ) {
          edge.push([x, y]);
        }
      }
    }
    for (const [x, y] of edge) this.px(x, y, c);
  }

  /** New grid, flipped horizontally (used to derive left-facing rows). */
  mirrorX(): PixelGrid {
    const out = new PixelGrid(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        out.px(this.width - 1 - x, y, this.get(x, y));
      }
    }
    return out;
  }

  /** Copy `src`'s opaque cells onto this grid at (dx, dy). */
  blit(src: PixelGrid, dx: number, dy: number): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const c = src.get(x, y);
        if (c !== null) this.px(x + dx, y + dy, c);
      }
    }
  }

  clone(): PixelGrid {
    const out = new PixelGrid(this.width, this.height);
    out.blit(this, 0, 0);
    return out;
  }

  countOpaque(): number {
    let n = 0;
    for (const c of this.cells) if (c !== null) n++;
    return n;
  }

  /** Number of cells that differ between two same-sized grids. */
  diff(other: PixelGrid): number {
    if (other.width !== this.width || other.height !== this.height) {
      throw new Error("diff requires equal-sized grids");
    }
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== other.cells[i]) n++;
    }
    return n;
  }

  /** Iterate cells (for encoders / tests). */
  forEach(fn: (x: number, y: number, c: Cell) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) fn(x, y, this.get(x, y));
    }
  }
}
