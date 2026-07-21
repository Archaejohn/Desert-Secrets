import Phaser from "phaser";
import { compositeMapLayers, GROUND_PRIORITY } from "../../../tools/pipeline/src/ground/composite";
import type { TerrainKey } from "../../../tools/pipeline/src/cliffs/palette";
import { PALETTE, hexToInt } from "../../shared/palette";
import { waterAlphaFromLayers } from "./waterMask";

let seq = 0;

/** Renders water as a translucent SURFACE over the composited seabed. A NORMAL-blend tint
 *  image (the water footprint, tinted a depth blue) is the film you see the seabed through;
 *  an ADD-blend caustic TileSprite masked to the water shape shimmers on top; `update(dt)`
 *  sways the caustics back-and-forth. The water footprint comes from a composite pass whose
 *  `terrainId===reefWater` gives the exact organic water edge. Baked once, animated cheap. */
export class WaterSurfaceView {
  private readonly alphaKey: string;
  private readonly causticKey: string;
  private tint?: Phaser.GameObjects.Image;
  private caustic?: Phaser.GameObjects.TileSprite;
  private caustic2?: Phaser.GameObjects.TileSprite;
  private mask?: Phaser.Display.Masks.BitmapMask;
  private t = 0;

  constructor(private scene: Phaser.Scene, waterGrid: TerrainKey[][], depthTint: number, depthCaustic: number) {
    const { terrainId } = compositeMapLayers(waterGrid);
    const W = waterGrid[0].length * 16, H = waterGrid.length * 16;
    const n = seq++;
    this.alphaKey = `__water_alpha_${n}`;
    this.causticKey = `__water_caustic_${n}`;

    // Water-footprint stencil (opaque white where water, else transparent).
    if (scene.textures.exists(this.alphaKey)) scene.textures.remove(this.alphaKey);
    const at = scene.textures.createCanvas(this.alphaKey, W, H);
    if (!at) throw new Error("WaterSurfaceView: could not create alpha texture");
    const aimg = at.context.createImageData(W, H);
    aimg.data.set(waterAlphaFromLayers(terrainId, GROUND_PRIORITY.reefWater, 255));
    at.context.putImageData(aimg, 0, 0);
    at.refresh();

    // A small tiling caustic web (baked once; scrolled for shimmer).
    this.bakeCaustic(64);

    // Depth film: the stencil tinted a cool blue (distinct from the green seabed),
    // alpha-blended so the seabed still shows through.
    this.tint = scene.add.image(0, 0, this.alphaKey).setOrigin(0, 0).setDepth(depthTint)
      .setTint(hexToInt(PALETTE.skyBlue)).setBlendMode(Phaser.BlendModes.NORMAL).setAlpha(0.45);

    // Caustics: additive shimmer, confined to the water shape by a BitmapMask of the film.
    this.mask = new Phaser.Display.Masks.BitmapMask(scene, this.tint);
    this.caustic = scene.add.tileSprite(0, 0, W, H, this.causticKey).setOrigin(0, 0).setDepth(depthCaustic)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    this.caustic.setMask(this.mask);
    // Deeper caustic layer — same ripples, slower + dimmer + larger scale → parallax = depth.
    this.caustic2 = scene.add.tileSprite(0, 0, W, H, this.causticKey).setOrigin(0, 0).setDepth(depthCaustic - 5)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.28);
    this.caustic2.setTileScale(1.5, 1.5);
    this.caustic2.setMask(this.mask);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  /** Tileable water caustics: thin bright ridges running as ONE family of wavy bands
   *  (crests of a wave undulating along its length), broken into segments — reads as
   *  light rippling on water, NOT a two-directional crosshatch / diamond plate. Periods
   *  divide `s` so it tiles seamlessly. */
  private bakeCaustic(s: number): void {
    if (this.scene.textures.exists(this.causticKey)) this.scene.textures.remove(this.causticKey);
    const t = this.scene.textures.createCanvas(this.causticKey, s, s);
    if (!t) throw new Error("WaterSurfaceView: could not create caustic texture");
    const img = t.context.createImageData(s, s);
    const d = img.data;
    const [cr, cg, cb] = [0xa6, 0xfc, 0xdb]; // bright mint-cyan highlight (green6)
    const f = (k: number) => (2 * Math.PI * k) / s;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      // Bands run roughly horizontally; their crest wanders along x (one dominant direction).
      const wander = Math.sin(x * f(1)) * 2.4 + Math.sin(x * f(2) + 1.3) * 1.1;
      const band = Math.sin(y * f(5) + wander);              // 5 finer undulating bands down the tile
      let b = Math.max(0, (band - 0.62) / 0.38);             // thin bright crests only
      b *= 0.35 + 0.65 * Math.max(0, Math.sin(x * f(1) + 0.7)); // break crests into segments
      const o = (y * s + x) * 4;
      d[o] = cr; d[o + 1] = cg; d[o + 2] = cb; d[o + 3] = Math.round(Math.min(1, b) * 255);
    }
    t.context.putImageData(img, 0, 0);
    t.refresh();
  }

  update(dt: number): void {
    this.t += dt;
    if (this.caustic) {
      this.caustic.tilePositionX = Math.sin(this.t * 0.55) * 14; // gentle back-and-forth sway
      this.caustic.tilePositionY = this.t * 5;                    // slow drift
    }
    if (this.tint) this.tint.setAlpha(0.5 + 0.05 * Math.sin(this.t * 0.9)); // subtle breathe
  }

  destroy(): void {
    this.caustic?.clearMask(true);
    this.mask?.destroy();
    this.caustic?.destroy();
    this.tint?.destroy();
    this.caustic = undefined; this.tint = undefined; this.mask = undefined;
    for (const k of [this.alphaKey, this.causticKey]) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
  }
}
