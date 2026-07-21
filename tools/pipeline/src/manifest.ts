/**
 * manifest.json builder — the machine-readable description of every
 * generated sheet, matching docs/CONTRACTS.md §1 and §4 exactly.
 */
import { PALETTE } from "../../../src/shared/palette";
import { CHAR_FRAME_W, CHAR_FRAME_H } from "./sprites/poses";
import { SCARAB_FRAME } from "./sprites/scarab";
import { PIGGY_FRAME } from "./sprites/piggy";
import { CHICKEN_FRAME } from "./sprites/chicken";
import { BUCKET_FRAME } from "./sprites/bucket";
import { JACKRABBIT_FRAME } from "./sprites/jackrabbit";
import { BUZZARD_FRAME } from "./sprites/buzzard";
import { GILA_FRAME } from "./sprites/gila";
import { FOREMAN_FRAME } from "./sprites/foreman";
import { QUEEN_FRAME } from "./sprites/queen";
import { SLITHER_FRAME } from "./sprites/slither";
import { FLUFFBALL_FRAME } from "./sprites/fluffball";
import { ICEBAT_FRAME } from "./sprites/icebat";
import { CRYSTALCRAWLER_FRAME } from "./sprites/crystalcrawler";
import { FROSTSCARAB_FRAME } from "./sprites/frostscarab";
import { WARDEN_FRAME } from "./sprites/warden";
import { SPIGOT_FRAME } from "./sprites/spigot";
import { ANGLERFISH_FRAME } from "./sprites/anglerfish";
import { REEFEEL_FRAME } from "./sprites/reefeel";
import { LURKER_FRAME } from "./sprites/lurker";
import { MIDDENMITE_FRAME } from "./sprites/middenmite";
import { SUNWASP_FRAME } from "./sprites/sunwasp";
import { REEFSTALKER_FRAME } from "./sprites/reefstalker";
import { TESTUDO_FRAME } from "./sprites/testudo";
import { DUSTY_FRAME } from "./sprites/dusty";
import { GEARICONS_FRAME } from "./sprites/gearIcons";
import { TILE_NAMES, TILE_SIZE } from "./tileset";
import { TILE2_NAMES } from "./tileset2";
import { TILE3_NAMES } from "./tileset3";
import { TILE4_NAMES } from "./tileset4";
import { TILE5_NAMES } from "./tileset5";
import { TILE6_NAMES } from "./tileset6";
import { TILE7_NAMES } from "./tileset7";
import { TILE8_NAMES } from "./tileset8";
import { OW_BILLBOARD_H, OW_BILLBOARD_NAMES, OW_BILLBOARD_W } from "./sprites/owBillboards";
import { owMountainNames } from "./owMountains";
import { cliffTileNames, cliffIceTileNames, cliffReefTileNames, cliffLavaTileNames, cliffGroveTileNames } from "./cliffs/frames";

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

export interface TileSetDef {
  file: string;
  tileSize: number;
  columns: number;
  names: Record<string, number>;
}

/** A billboard sheet: named, equal-sized, non-square standing-sprite frames
 *  (no animations — each name is one static frame). */
export interface BillboardSheetDef {
  file: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  names: Record<string, number>;
}

export interface Manifest {
  palette: Record<string, string>;
  sheets: {
    hero: SheetDef;
    npc: SheetDef;
    scarab: SheetDef;
    rosa: SheetDef;
    john: SheetDef;
    pamela: SheetDef;
    thomas: SheetDef;
    chicken: SheetDef;
    bucket: SheetDef;
    piggy: SheetDef;
    jackrabbit: SheetDef;
    buzzard: SheetDef;
    gila: SheetDef;
    foreman: SheetDef;
    queen: SheetDef;
    slither: SheetDef;
    miner: SheetDef;
    fluffball: SheetDef;
    icebat: SheetDef;
    crystalcrawler: SheetDef;
    frostscarab: SheetDef;
    warden: SheetDef;
    spigot: SheetDef;
    anglerfish: SheetDef;
    reefeel: SheetDef;
    lurker: SheetDef;
    middenmite: SheetDef;
    sunwasp: SheetDef;
    reefstalker: SheetDef;
    testudo: SheetDef;
    // Phase S (sprites) additions — appended only, never reordered.
    dusty: SheetDef;
    sahra: SheetDef;
    gearIcons: SheetDef;
  };
  tiles: TileSetDef;
  tiles2: TileSetDef;
  tiles3: TileSetDef;
  tiles4: TileSetDef;
  tiles5: TileSetDef;
  tiles6: TileSetDef;
  tiles7: TileSetDef;
  tiles8: TileSetDef;
  owBillboards: BillboardSheetDef;
  owMountains: TileSetDef;
  cliff: TileSetDef;
  cliffIce: TileSetDef;
  cliffReef: TileSetDef;
  cliffLava: TileSetDef;
  cliffGrove: TileSetDef;
}

const DIRECTIONS = ["down", "left", "right", "up"] as const;

/** idle = frames 0–1 of the row, walk = frames 2–5; indices are absolute
 *  (row-major across the sheet), matching Phaser numbering. */
function characterSheet(
  prefix: "hero" | "npc" | "rosa" | "miner" | "john" | "pamela" | "sahra" | "thomas"
): SheetDef {
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

/** Single-row creature sheet: idle [0,1] + one motion animation [2..5]. */
function creatureSheet(
  name: string,
  frame: number,
  moveKey: string,
  idleRate: number,
  moveRate: number
): SheetDef {
  return {
    file: `${name}.png`,
    frameWidth: frame,
    frameHeight: frame,
    columns: 6,
    rows: 1,
    animations: {
      [`${name}-idle`]: { frames: [0, 1], frameRate: idleRate, repeat: -1 },
      [`${name}-${moveKey}`]: { frames: [2, 3, 4, 5], frameRate: moveRate, repeat: -1 }
    }
  };
}

/** Static two-frame prop sheet: no idle/move cycle, just two named,
 *  one-frame, non-looping states (e.g. bucket empty/full). */
function propSheet(
  name: string,
  frame: number,
  states: readonly [key: string, frameIndex: number][]
): SheetDef {
  const animations: Record<string, AnimationDef> = {};
  for (const [key, frameIndex] of states) {
    animations[`${name}-${key}`] = { frames: [frameIndex], frameRate: 1, repeat: 0 };
  }
  return {
    file: `${name}.png`,
    frameWidth: frame,
    frameHeight: frame,
    columns: states.length,
    rows: 1,
    animations
  };
}

function tileNames(names: readonly string[]): Record<string, number> {
  const map: Record<string, number> = {};
  names.forEach((name, i) => {
    map[name] = i;
  });
  return map;
}

export function buildManifest(): Manifest {
  return {
    palette: { ...PALETTE },
    sheets: {
      hero: characterSheet("hero"),
      npc: characterSheet("npc"),
      scarab: creatureSheet("scarab", SCARAB_FRAME, "move", 3, 10),
      rosa: characterSheet("rosa"),
      john: characterSheet("john"),
      pamela: characterSheet("pamela"),
      thomas: characterSheet("thomas"),
      chicken: creatureSheet("chicken", CHICKEN_FRAME, "move", 3, 10),
      bucket: propSheet("bucket", BUCKET_FRAME, [
        ["empty", 0],
        ["full", 1]
      ]),
      piggy: creatureSheet("piggy", PIGGY_FRAME, "walk", 3, 8),
      jackrabbit: creatureSheet("jackrabbit", JACKRABBIT_FRAME, "move", 3, 12),
      buzzard: creatureSheet("buzzard", BUZZARD_FRAME, "move", 3, 8),
      gila: creatureSheet("gila", GILA_FRAME, "move", 3, 8),
      foreman: creatureSheet("foreman", FOREMAN_FRAME, "move", 3, 10),
      queen: creatureSheet("queen", QUEEN_FRAME, "move", 2, 8),
      slither: creatureSheet("slither", SLITHER_FRAME, "move", 3, 10),
      miner: characterSheet("miner"),
      fluffball: creatureSheet("fluffball", FLUFFBALL_FRAME, "walk", 3, 8),
      icebat: creatureSheet("icebat", ICEBAT_FRAME, "move", 3, 10),
      crystalcrawler: creatureSheet("crystalcrawler", CRYSTALCRAWLER_FRAME, "move", 3, 8),
      frostscarab: creatureSheet("frostscarab", FROSTSCARAB_FRAME, "move", 3, 10),
      warden: creatureSheet("warden", WARDEN_FRAME, "move", 2, 8),
      spigot: propSheet("spigot", SPIGOT_FRAME, [["idle", 0]]),
      anglerfish: creatureSheet("anglerfish", ANGLERFISH_FRAME, "move", 3, 8),
      reefeel: creatureSheet("reefeel", REEFEEL_FRAME, "move", 3, 10),
      lurker: creatureSheet("lurker", LURKER_FRAME, "move", 2, 8),
      middenmite: creatureSheet("middenmite", MIDDENMITE_FRAME, "move", 3, 12),
      sunwasp: creatureSheet("sunwasp", SUNWASP_FRAME, "move", 3, 12),
      reefstalker: creatureSheet("reefstalker", REEFSTALKER_FRAME, "move", 3, 10),
      testudo: creatureSheet("testudo", TESTUDO_FRAME, "move", 2, 6),
      // Phase S (sprites) additions — appended only, never reordered.
      dusty: creatureSheet("dusty", DUSTY_FRAME, "move", 3, 10),
      sahra: characterSheet("sahra"),
      // Equipment-tab icons: 5 slot placeholders + 7 item icons, one row of 12.
      gearIcons: propSheet("gearIcons", GEARICONS_FRAME, [
        ["hat", 0],
        ["weapon", 1],
        ["torso", 2],
        ["legs", 3],
        ["shoes", 4],
        ["minersHat", 5],
        ["stick", 6],
        ["pickaxe", 7],
        ["tshirt", 8],
        ["jeans", 9],
        ["flipFlops", 10],
        ["frostFeather", 11]
      ])
    },
    tiles: { file: "tiles.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(TILE_NAMES) },
    tiles2: { file: "tiles2.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(TILE2_NAMES) },
    tiles3: { file: "tiles3.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(TILE3_NAMES) },
    tiles4: { file: "tiles4.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(TILE4_NAMES) },
    tiles5: { file: "tiles5.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(TILE5_NAMES) },
    tiles6: { file: "tiles6.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(TILE6_NAMES) },
    tiles7: { file: "tiles7.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(TILE7_NAMES) },
    tiles8: { file: "tiles8.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(TILE8_NAMES) },
    owBillboards: {
      file: "owBillboards.png",
      frameWidth: OW_BILLBOARD_W,
      frameHeight: OW_BILLBOARD_H,
      columns: 6,
      names: tileNames(OW_BILLBOARD_NAMES)
    },
    owMountains: {
      file: "owMountains.png",
      tileSize: TILE_SIZE,
      columns: 8,
      names: tileNames(owMountainNames)
    },
    // cliff.png: real desert frames + blank padding to a multiple of 8
    // columns (see cliffs/frames.ts); only the real names are exposed here.
    cliff: { file: "cliff.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(cliffTileNames()) },
    // cliffIce.png: real ice frames + blank padding to a multiple of 8
    // columns (see cliffs/frames.ts); only the real names are exposed here.
    cliffIce: { file: "cliffIce.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(cliffIceTileNames()) },
    // cliffReef.png: real reef frames + blank padding to a multiple of 8
    // columns (see cliffs/frames.ts); only the real names are exposed here.
    cliffReef: { file: "cliffReef.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(cliffReefTileNames()) },
    // cliffLava.png: real lava frames + blank padding to a multiple of 8 columns.
    cliffLava: { file: "cliffLava.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(cliffLavaTileNames()) },
    // cliffGrove.png: real grove frames + blank padding to a multiple of 8 columns.
    cliffGrove: { file: "cliffGrove.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(cliffGroveTileNames()) }
  };
}
