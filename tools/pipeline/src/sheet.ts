/**
 * Sheet composer — lays equal-sized frames into a row-major grid, matching
 * Phaser spritesheet numbering (frame index = row * columns + column).
 */
import { PixelGrid } from "./grid";

export function composeSheet(frames: PixelGrid[], columns: number): PixelGrid {
  if (frames.length === 0) throw new Error("composeSheet: no frames");
  const { width: fw, height: fh } = frames[0];
  for (const f of frames) {
    if (f.width !== fw || f.height !== fh) {
      throw new Error("composeSheet: frames must all be the same size");
    }
  }
  if (frames.length % columns !== 0) {
    throw new Error(
      `composeSheet: ${frames.length} frames do not fill a ${columns}-column grid`
    );
  }
  const rows = frames.length / columns;
  const sheet = new PixelGrid(fw * columns, fh * rows);
  frames.forEach((frame, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    sheet.blit(frame, col * fw, row * fh);
  });
  return sheet;
}
