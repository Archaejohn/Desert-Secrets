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
