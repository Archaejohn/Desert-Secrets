/**
 * manifest.json builder — the machine-readable description of every
 * generated sheet, matching docs/CONTRACTS.md §1 exactly.
 */
import { PALETTE } from "../../../src/shared/palette";
import { CHAR_FRAME_W, CHAR_FRAME_H } from "./sprites/poses";
import { SCARAB_FRAME } from "./sprites/scarab";
import { TILE_NAMES, TILE_SIZE } from "./tileset";

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

export interface Manifest {
  palette: Record<string, string>;
  sheets: { hero: SheetDef; npc: SheetDef; scarab: SheetDef };
  tiles: { file: string; tileSize: number; columns: number; names: Record<string, number> };
}

const DIRECTIONS = ["down", "left", "right", "up"] as const;

/** idle = frames 0–1 of the row, walk = frames 2–5; indices are absolute
 *  (row-major across the sheet), matching Phaser numbering. */
function characterSheet(prefix: "hero" | "npc"): SheetDef {
  const animations: Record<string, AnimationDef> = {};
  DIRECTIONS.forEach((dir, row) => {
    const base = row * 6;
    animations[`${prefix}-idle-${dir}`] = { frames: [base, base + 1], frameRate: 2, repeat: -1 };
    animations[`${prefix}-walk-${dir}`] = {
      frames: [base + 2, base + 3, base + 4, base + 5],
      frameRate: 10,
      repeat: -1
    };
  });
  return {
    file: `${prefix}.png`,
    frameWidth: CHAR_FRAME_W,
    frameHeight: CHAR_FRAME_H,
    columns: 6,
    rows: 4,
    animations
  };
}

export function buildManifest(): Manifest {
  const names: Record<string, number> = {};
  TILE_NAMES.forEach((name, i) => {
    names[name] = i;
  });
  return {
    palette: { ...PALETTE },
    sheets: {
      hero: characterSheet("hero"),
      npc: characterSheet("npc"),
      scarab: {
        file: "scarab.png",
        frameWidth: SCARAB_FRAME,
        frameHeight: SCARAB_FRAME,
        columns: 6,
        rows: 1,
        animations: {
          "scarab-idle": { frames: [0, 1], frameRate: 3, repeat: -1 },
          "scarab-move": { frames: [2, 3, 4, 5], frameRate: 10, repeat: -1 }
        }
      }
    },
    tiles: { file: "tiles.png", tileSize: TILE_SIZE, columns: 8, names }
  };
}
