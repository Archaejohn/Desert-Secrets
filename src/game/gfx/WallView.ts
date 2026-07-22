import Phaser from "phaser";
import { renderWallWithBounds } from "../../../tools/pipeline/src/walls/renderWall";
import type { WallParams } from "../../../tools/pipeline/src/walls/buildWall";
import { pixelGridToRGBA } from "./pixelGridRGBA";

let seq = 0;
const T = 16;
/** cos(elevation) at the fixed prop view (raymath EL=33°) — the vertical foreshorten. */
const CE = Math.cos((33 * Math.PI) / 180);
const PPU = 16;
/** Face + talus draw BELOW every actor (actor foot-Y >= 0), so a player in front of the
 *  ledge — or standing on top of it — always draws over the rock. */
const FACE_DEPTH = -50;
/** The crest lip draws on/over the overhead layer (depth 5000), so it occludes a player
 *  standing at the plateau's front edge (the "edge of a drop" read). */
const CREST_DEPTH = 5001;

/** A wall recipe placed over a band of tiles (the ledge's front face). Declared per zone
 *  in `ZoneConfig.walls`. The band rect is inclusive tile coords; `rampGapX` (optional)
 *  is a tile column left OPEN through the face (the walkable ramp up). */
export interface WallSpec {
  band: { x1: number; y1: number; x2: number; y2: number };
  style: WallParams["style"];
  rampGapX?: number;
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
 *  The bake is split into a CREST image (rows above wall-top → overhead depth) and a
 *  FACE+talus image (the rest → below actors), the 2.5D depth model that lets you walk up
 *  onto the ledge. A `rampGapX` column is cut transparent (the walkable ramp opening). */
export class WallView {
  private readonly keys: string[] = [];
  private readonly images: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, spec: WallSpec) {
    const wTiles = spec.band.x2 - spec.band.x1 + 1;
    const hTiles = spec.band.y2 - spec.band.y1 + 1;
    const H = hTiles / CE;
    const params: WallParams = {
      style: spec.style,
      W: wTiles,
      H,
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
    const CW = grid.width, CH = grid.height;

    // Cut the ramp column open (transparent) so the walkable ramp gap reads as a passage.
    if (spec.rampGapX !== undefined) {
      const lx = spec.rampGapX - spec.band.x1;          // ramp column in wall-x tiles
      const c0 = Math.round(lx * PPU - x0), c1 = Math.round((lx + 1) * PPU - x0); // image cols
      for (let y = 0; y < CH; y++)
        for (let x = Math.max(0, c0); x < Math.min(CW, c1); x++) grid.px(x, y, null);
    }

    const rgba = pixelGridToRGBA(grid);
    // Split row = the image row of the wall TOP (wall-y=H → screen-y = -(H·ce)·PPU).
    const pyH = Math.max(0, Math.min(CH, Math.round(-(H * CE) * PPU - y0)));
    const px = spec.band.x1 * T + x0;
    const py = (spec.band.y2 + 1) * T + y0;

    if (pyH > 0) this.addSlice(rgba, CW, 0, pyH, px, py, CREST_DEPTH);         // crest → overhead
    if (pyH < CH) this.addSlice(rgba, CW, pyH, CH, px, py + pyH, FACE_DEPTH);  // face+talus → below actors

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  /** Bake rows [r0,r1) of the RGBA into a canvas texture placed at (px, py+... handled by caller). */
  private addSlice(rgba: Uint8ClampedArray, w: number, r0: number, r1: number, px: number, py: number, depth: number): void {
    const h = r1 - r0;
    const key = `__wall_${seq++}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const tex = this.scene.textures.createCanvas(key, w, h);
    if (!tex) throw new Error("WallView: could not create canvas texture");
    const img = tex.context.createImageData(w, h);
    img.data.set(rgba.subarray(r0 * w * 4, r1 * w * 4));
    tex.context.putImageData(img, 0, 0);
    tex.refresh(); // NEAREST (pixelArt)
    this.keys.push(key);
    this.images.push(this.scene.add.image(px, py, key).setOrigin(0, 0).setDepth(depth));
  }

  destroy(): void {
    for (const im of this.images) im.destroy();
    this.images.length = 0;
    for (const k of this.keys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.keys.length = 0;
  }
}
