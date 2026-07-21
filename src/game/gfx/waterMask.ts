/** RGBA stencil for a water surface overlay: white + `alpha` where the composited
 *  `terrainId` equals the water terrain's id, else fully transparent. Feeds a canvas
 *  texture that is tinted (the depth film) and used as a BitmapMask for the caustics —
 *  so the overlay follows the exact organic water footprint the ground composite carved. */
export function waterAlphaFromLayers(terrainId: Uint8Array, waterId: number, alpha = 255): Uint8ClampedArray {
  const data = new Uint8ClampedArray(terrainId.length * 4);
  for (let i = 0; i < terrainId.length; i++) {
    if (terrainId[i] === waterId) {
      const o = i * 4;
      data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = alpha;
    }
  }
  return data;
}
