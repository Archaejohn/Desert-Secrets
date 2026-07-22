import Phaser from "phaser";
import { renderWallWithBounds } from "../../../tools/pipeline/src/walls/renderWall";
import type { WallParams } from "../../../tools/pipeline/src/walls/buildWall";
import { pixelGridToRGBA } from "./pixelGridRGBA";

let seq = 0;
const T = 16;
/** cos(elevation) at the fixed prop view (raymath EL=33°) — the vertical foreshorten. */
const CE = Math.cos((33 * Math.PI) / 180);

/** A wall recipe placed over a band of tiles (the ledge's front face). Declared per zone
 *  in `ZoneConfig.walls`. The band rect is inclusive tile coords. Recipe params default to
 *  sensible mine values; override for tuning. */
export interface WallSpec {
  band: { x1: number; y1: number; x2: number; y2: number };
  style: WallParams["style"];
  crest?: string;
  seed?: number;
  ch?: number; bw?: number; relief?: number; frac?: number; irr?: number;
  batter?: number; talus?: number; crestAmt?: number; top?: string;
}

/** Bakes a raycast wall (`renderWall`) and places it aligned over its band — the runtime-
 *  bake pattern of `CompositeGroundView`. Placement: the wall foot (wall-space (x,0,0))
 *  projects to screen (x·16, 0); the baked grid's pixel (0,0) is at screen (x0,y0); so the
 *  image sits at zone ( bandLeft·16 + x0 , bandSouthEdge·16 + y0 ). 1 wall-unit = 1 tile in
 *  x; `H = bandTiles / cos33°` makes the face cover the band height.
 *
 *  W2b scope: ONE image, depth-sorted at the band foot (below a player standing in front).
 *  The crest→overhead split and the ramp opening are W2c. */
export class WallView {
  private readonly key: string;
  private image?: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, spec: WallSpec) {
    const wTiles = spec.band.x2 - spec.band.x1 + 1;
    const hTiles = spec.band.y2 - spec.band.y1 + 1;
    const params: WallParams = {
      style: spec.style,
      W: wTiles,
      H: hTiles / CE,
      ch: spec.ch ?? 0.5,
      bw: spec.bw ?? 0.5,
      relief: spec.relief ?? 0.45,
      frac: spec.frac ?? 0.4,
      irr: spec.irr ?? 0.6,
      batter: spec.batter ?? 0.1,
      talus: spec.talus ?? 0.4,
      crest: spec.crest ?? "auto",
      crestAmt: spec.crestAmt ?? 0.5,
      top: spec.top ?? "auto",
      seed: spec.seed ?? 0,
    };
    const { grid, x0, y0 } = renderWallWithBounds(params);

    this.key = `__wall_${seq++}`;
    if (scene.textures.exists(this.key)) scene.textures.remove(this.key);
    const tex = scene.textures.createCanvas(this.key, grid.width, grid.height);
    if (!tex) throw new Error("WallView: could not create canvas texture");
    const img = tex.context.createImageData(grid.width, grid.height);
    img.data.set(pixelGridToRGBA(grid));
    tex.context.putImageData(img, 0, 0);
    tex.refresh(); // NEAREST (pixelArt); no LINEAR

    const px = spec.band.x1 * T + x0;
    const py = (spec.band.y2 + 1) * T + y0;
    // Depth = the band's foot zone-y, so it sorts like an object standing there: a player
    // in front (larger foot-Y) draws over it.
    const depth = (spec.band.y2 + 1) * T;
    this.image = scene.add.image(px, py, this.key).setOrigin(0, 0).setDepth(depth);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  destroy(): void {
    this.image?.destroy();
    this.image = undefined;
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
