/** Edge-preserving box blur for the composited ground: smooths the fill TEXTURE inside
 *  each terrain region but never averages across a terrain boundary or over a seam-shadow
 *  pixel — so the mask seams and their shadows stay crisp while the busy interior speckle
 *  softens. `terrainId`/`shadow` come from `compositeMapLayers`. Render-effect only (the
 *  averaged colours are off the strict palette, but the source stays palette-locked).
 *
 *  `size` = box side (default 4). `skip` = terrain ids left crisp (e.g. water — its
 *  caustics/ripple read better sharp and it may animate). Skipped pixels pass through. */
export function maskedBlur(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  terrainId: Uint8Array,
  shadow: Uint8Array,
  size = 4,
  skip?: ReadonlySet<number>,
): Uint8ClampedArray {
  const lo = -Math.floor((size - 1) / 2), hi = Math.floor(size / 2);
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x, o = i * 4;
      const id = terrainId[i];
      if (shadow[i] || (skip && skip.has(id))) { out[o] = rgba[o]; out[o + 1] = rgba[o + 1]; out[o + 2] = rgba[o + 2]; out[o + 3] = rgba[o + 3]; continue; }
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = lo; dy <= hi; dy++) {
        for (let dx = lo; dx <= hi; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const j = ny * width + nx;
          if (terrainId[j] !== id || shadow[j]) continue; // same terrain, non-shadow → boundaries+shadows crisp
          const jo = j * 4;
          r += rgba[jo]; g += rgba[jo + 1]; b += rgba[jo + 2]; n++;
        }
      }
      out[o] = n ? Math.round(r / n) : rgba[o];
      out[o + 1] = n ? Math.round(g / n) : rgba[o + 1];
      out[o + 2] = n ? Math.round(b / n) : rgba[o + 2];
      out[o + 3] = rgba[o + 3];
    }
  }
  return out;
}
