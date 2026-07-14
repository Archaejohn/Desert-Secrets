/**
 * Pure assembly of every generated asset — frames composed into sheets plus
 * the manifest. No disk I/O here; index.ts writes, tests import.
 */
import type { PixelGrid } from "./grid";
import { composeSheet } from "./sheet";
import { heroFrames } from "./sprites/hero";
import { npcFrames } from "./sprites/npc";
import { scarabFrames } from "./sprites/scarab";
import { rosaFrames } from "./sprites/rosa";
import { piggyFrames } from "./sprites/piggy";
import { jackrabbitFrames } from "./sprites/jackrabbit";
import { buzzardFrames } from "./sprites/buzzard";
import { gilaFrames } from "./sprites/gila";
import { foremanFrames } from "./sprites/foreman";
import { queenFrames } from "./sprites/queen";
import { tileFrames } from "./tileset";
import { tile2Frames } from "./tileset2";
import { buildManifest, type Manifest } from "./manifest";

export interface BuiltAssets {
  hero: PixelGrid;
  npc: PixelGrid;
  scarab: PixelGrid;
  rosa: PixelGrid;
  piggy: PixelGrid;
  jackrabbit: PixelGrid;
  buzzard: PixelGrid;
  gila: PixelGrid;
  foreman: PixelGrid;
  queen: PixelGrid;
  tiles: PixelGrid;
  tiles2: PixelGrid;
  manifest: Manifest;
}

/** Every sheet key that becomes a PNG (manifest excluded). */
export const SHEET_KEYS = [
  "hero",
  "npc",
  "scarab",
  "rosa",
  "piggy",
  "jackrabbit",
  "buzzard",
  "gila",
  "foreman",
  "queen",
  "tiles",
  "tiles2"
] as const;

export function buildAssets(): BuiltAssets {
  return {
    hero: composeSheet(heroFrames(), 6),
    npc: composeSheet(npcFrames(), 6),
    scarab: composeSheet(scarabFrames(), 6),
    rosa: composeSheet(rosaFrames(), 6),
    piggy: composeSheet(piggyFrames(), 6),
    jackrabbit: composeSheet(jackrabbitFrames(), 6),
    buzzard: composeSheet(buzzardFrames(), 6),
    gila: composeSheet(gilaFrames(), 6),
    foreman: composeSheet(foremanFrames(), 6),
    queen: composeSheet(queenFrames(), 6),
    tiles: composeSheet(tileFrames(), 8),
    tiles2: composeSheet(tile2Frames(), 8),
    manifest: buildManifest()
  };
}
