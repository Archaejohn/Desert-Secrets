/**
 * Seam-free ground rendering for any zone shown at a *fractional* camera
 * zoom (presentation only; the live tilemap layers stay put, invisible, and
 * keep driving collision exactly as before).
 *
 * Why this exists. A zone drawn at integer zoom (1, 2, …) is seam-free for
 * free: each 16px tile quad is NEAREST-sampled 1:1, so nothing is dropped.
 * The overworld is the only zone drawn *zoomed out* (a fractional zoom, to
 * see more of the map at once), and at a fractional zoom each tile minifies
 * to a non-integer size — so the NEAREST sampler drops whole source
 * rows/columns, and *which* ones it drops shifts every sub-pixel scroll
 * step, flashing dark tile-edge pixels in and out (the "horizontal lines
 * that flash as you move" bug). See docs/CONTRACTS.md "v25".
 *
 * The fix. Composite the given below-actor tile layers (ground + decor)
 * ONCE into a single texture and draw that in their place, LINEAR-filtered.
 * Two things have to be true together: (1) one contiguous texture has no
 * packed-atlas tile boundaries, so LINEAR can't bleed one tile into its
 * neighbour the way it does on the shared tileset sheets (plain LINEAR on
 * the atlases makes a full GRID of bleed lines — worse); (2) LINEAR
 * minification then resamples that one image smoothly and, crucially,
 * *stably* as the camera scrolls, so no rows flash. Same single-texture
 * idea Mode-7 already uses (Mode7Ground.paintGroundTexture).
 *
 * Scope / scaling. Baking the whole map into one texture is O(map) and caps
 * at the GPU max texture size (~4096px on mobile, a 256×256-tile map; up to
 * 16384 on desktop) — comfortably above Part One's 64×64 (1024px) overworld
 * with room to spare. When a map eventually outgrows that, this class is the
 * seam of abstraction where a moving-window re-bake (bake only the visible
 * window + margin, re-bake as the camera crosses a threshold — O(viewport),
 * any map size) drops in with NO change to callers. Actors keep rendering
 * through the camera as their own quads either way, so they stay crisp.
 *
 * Only fractional-zoom zones need this; an integer-zoom zone is already
 * seam-free and a LINEAR bake would only soften it, so leave those alone.
 */
import Phaser from "phaser";

export class ScaledGroundView {
  private ground: Phaser.GameObjects.RenderTexture | null = null;

  /**
   * @param scene  The zone scene.
   * @param layers The below-actor tile layers to bake, in draw order
   *   (e.g. [groundLayer, decorLayer]). They must share the map's
   *   dimensions; the first layer's size sizes the texture. NOT for an
   *   overhead/above-actor layer — that must stay a live layer so it sorts
   *   over actors (and would want its own bake if it ever seams).
   * @param depth  Display depth for the baked ground (below the y-sorted
   *   actors — e.g. the same GROUND_DEPTH Mode-7 uses).
   */
  constructor(scene: Phaser.Scene, layers: Phaser.Tilemaps.TilemapLayer[], depth: number) {
    const base = layers[0];
    const rt = scene.add
      .renderTexture(0, 0, base.width, base.height)
      .setOrigin(0, 0)
      .setDepth(depth);
    for (const layer of layers) rt.draw(layer, 0, 0);
    rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    // Hidden, not destroyed: the source layers stay alive to keep driving
    // collision — only their (now redundant, seam-prone) rendering is off.
    for (const layer of layers) layer.setVisible(false);
    this.ground = rt;
  }

  /** Free the baked texture (the hidden source layers belong to the scene,
   *  which disposes them on its own shutdown). */
  destroy(): void {
    this.ground?.destroy();
    this.ground = null;
  }
}
