/**
 * Typed access to the generated-asset manifest (see docs/CONTRACTS.md §1).
 * The manifest and PNGs are produced by `npm run art`.
 */
import type Phaser from "phaser";
import manifestJson from "../assets/generated/manifest.json";

export interface AnimationDef {
  frames: number[];
  frameRate: number;
  repeat: number;
}

export interface SheetDef {
  file: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  animations: Record<string, AnimationDef>;
}

export interface TilesetDef {
  file: string;
  tileSize: number;
  columns: number;
  names: Record<string, number>;
}

/** A billboard sheet: named, equal-sized, non-square standing-sprite frames
 *  (no animations — each name is one static frame). Phase O appendix. */
export interface BillboardsDef {
  file: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  names: Record<string, number>;
}

export interface Manifest {
  palette: Record<string, string>;
  sheets: Record<string, SheetDef>;
  tiles: TilesetDef;
  tiles2: TilesetDef;
  tiles3: TilesetDef;
  tiles4: TilesetDef;
  tiles5: TilesetDef;
  tiles6: TilesetDef;
  tiles7: TilesetDef;
  tiles8: TilesetDef;
  owBillboards: BillboardsDef;
}

export const MANIFEST = manifestJson as unknown as Manifest;

/** Look up a tile index by name; throws on unknown names so map typos fail loudly. */
export function tileIndex(name: string): number {
  const idx = MANIFEST.tiles.names[name];
  if (idx === undefined) throw new Error(`Unknown tile name: ${name}`);
  return idx;
}

/** Register every animation from every sheet with a scene's animation manager. */
export function registerAnimations(scene: Phaser.Scene): void {
  for (const [key, sheet] of Object.entries(MANIFEST.sheets)) {
    for (const [animKey, def] of Object.entries(sheet.animations)) {
      if (scene.anims.exists(animKey)) continue;
      scene.anims.create({
        key: animKey,
        frames: def.frames.map((frame) => ({ key, frame })),
        frameRate: def.frameRate,
        repeat: def.repeat
      });
    }
  }
}
