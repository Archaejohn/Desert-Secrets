import Phaser from "phaser";
import { compositeMapLayers, GROUND_PRIORITY } from "../../../tools/pipeline/src/ground/composite";
import type { TerrainKey } from "../../../tools/pipeline/src/cliffs/palette";
import { paintFeatures, type GroundFeature } from "../../../tools/pipeline/src/ground/features";
import { pixelGridToRGBA } from "./pixelGridRGBA";
import { maskedBlur } from "./maskedBlur";

let seq = 0;

/** Terrain types left CRISP (opted out of the texture blur) — liquids read better sharp
 *  and are earmarked for future back-and-forth water motion. */
const CRISP_TERRAIN_IDS: ReadonlySet<number> = new Set([
  GROUND_PRIORITY.reefWater, GROUND_PRIORITY.groveWater, GROUND_PRIORITY.lava,
]);
const BLUR_SIZE = 4;
/** The submerged sun-emblem gets its own gentler blur than the floor (owner: "3x3"). */
const EMBLEM_BLUR_SIZE = 3;
const EMBLEM_BLUR_HALF = 18; // region half-size (px) around the emblem centre (~34px medallion)

/** Plain box blur over a square region — softens the (crisp) submerged sun-emblem a
 *  touch, less than the floor's global pass. Skips transparent pixels so the shatter
 *  cracks stay see-through, and reads from a snapshot so the blur is uniform. */
function boxBlurRegion(
  rgba: Uint8ClampedArray, W: number, H: number, cx: number, cy: number, half: number, size: number,
): void {
  const lo = -Math.floor((size - 1) / 2), hi = Math.floor(size / 2);
  const x0 = Math.max(0, cx - half), x1 = Math.min(W - 1, cx + half);
  const y0 = Math.max(0, cy - half), y1 = Math.min(H - 1, cy + half);
  const src = rgba.slice();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = (y * W + x) * 4;
    if (src[o + 3] === 0) continue;                    // keep transparent gaps (cracks)
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = lo; dy <= hi; dy++) for (let dx = lo; dx <= hi; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = (ny * W + nx) * 4;
      if (src[j + 3] === 0) continue;                  // skip transparent neighbours
      r += src[j]; g += src[j + 1]; b += src[j + 2]; n++;
    }
    if (n) { rgba[o] = Math.round(r / n); rgba[o + 1] = Math.round(g / n); rgba[o + 2] = Math.round(b / n); }
  }
}

/** Renders a zone's ground by baking the runtime composite (G2 `compositeMap` over G1
 *  world-position fills) into a Phaser canvas texture, shown at `depth` as an ordinary
 *  scene child. Ground only — the caller hides the tileset ground layer and keeps decor/
 *  collision live. Default NEAREST filtering (pixelArt); `opts.blur` applies an explicit
 *  light canvas blur to soften the discrete ramp steps into gradients. */
export class CompositeGroundView {
  private readonly key: string;
  private image?: Phaser.GameObjects.Image;

  constructor(
    private scene: Phaser.Scene,
    grid: TerrainKey[][],
    depth: number,
    opts: { blur?: boolean; features?: readonly GroundFeature[] } = {},
  ) {
    const { grid: pg, terrainId, shadow } = compositeMapLayers(grid);
    if (opts.features?.length) paintFeatures(pg, terrainId, shadow, opts.features, pg.width);
    this.key = `__composite_ground_${seq++}`;
    if (scene.textures.exists(this.key)) scene.textures.remove(this.key);
    const tex = scene.textures.createCanvas(this.key, pg.width, pg.height);
    if (!tex) throw new Error("CompositeGroundView: could not create canvas texture");
    const ctx = tex.context;
    // blur softens the fill TEXTURE inside each terrain only — mask seams + shadows stay crisp.
    const rgba = pixelGridToRGBA(pg);
    const px = opts.blur ? maskedBlur(rgba, pg.width, pg.height, terrainId, shadow, BLUR_SIZE, CRISP_TERRAIN_IDS) : rgba;
    // The submerged sun-emblem is kept crisp above (so the floor's 4-box skips it); give
    // it its own gentler 3-box refraction blur here.
    if (opts.blur && opts.features?.length) {
      for (const f of opts.features) {
        if (f.kind !== "sunEmblem") continue;
        boxBlurRegion(px, pg.width, pg.height, f.tx * 16 + 8, f.ty * 16 + 8, EMBLEM_BLUR_HALF, EMBLEM_BLUR_SIZE);
      }
    }
    const img = ctx.createImageData(pg.width, pg.height);
    img.data.set(px);
    ctx.putImageData(img, 0, 0);
    tex.refresh();                    // NOTE: deliberately NOT setFilter(LINEAR) — pixelArt/NEAREST
    this.image = scene.add.image(0, 0, this.key).setOrigin(0, 0).setDepth(depth);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  destroy(): void {
    this.image?.destroy();
    this.image = undefined;
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
