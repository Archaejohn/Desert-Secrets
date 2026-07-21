import Phaser from "phaser";
import { compositeMap } from "../../../tools/pipeline/src/ground/composite";
import type { TerrainKey } from "../../../tools/pipeline/src/cliffs/palette";
import { pixelGridToRGBA } from "./pixelGridRGBA";

let seq = 0;

/** Renders a zone's ground by baking the runtime composite (G2 `compositeMap` over G1
 *  world-position fills) into a Phaser canvas texture, shown at `depth` as an ordinary
 *  scene child. Ground only — the caller hides the tileset ground layer and keeps decor/
 *  collision live. Default NEAREST filtering (pixelArt); `opts.blur` applies an explicit
 *  light canvas blur to soften the discrete ramp steps into gradients. */
export class CompositeGroundView {
  private readonly key: string;
  private image?: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, grid: TerrainKey[][], depth: number, opts: { blur?: boolean } = {}) {
    const pg = compositeMap(grid);
    this.key = `__composite_ground_${seq++}`;
    if (scene.textures.exists(this.key)) scene.textures.remove(this.key);
    const tex = scene.textures.createCanvas(this.key, pg.width, pg.height);
    if (!tex) throw new Error("CompositeGroundView: could not create canvas texture");
    const ctx = tex.context;
    const img = ctx.createImageData(pg.width, pg.height);
    img.data.set(pixelGridToRGBA(pg));
    ctx.putImageData(img, 0, 0);
    if (opts.blur) { ctx.filter = "blur(1px)"; ctx.drawImage(tex.canvas, 0, 0); ctx.filter = "none"; }
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
