/**
 * Pure assembly of every generated asset — frames composed into sheets plus
 * the manifest. No disk I/O here; index.ts writes, tests import.
 */
import type { PixelGrid } from "./grid";
import { composeSheet } from "./sheet";
import { heroFrames } from "./sprites/hero";
import { npcFrames } from "./sprites/npc";
import { scarabFrames } from "./sprites/scarab";
import { tileFrames } from "./tileset";
import { buildManifest, type Manifest } from "./manifest";

export interface BuiltAssets {
  hero: PixelGrid;
  npc: PixelGrid;
  scarab: PixelGrid;
  tiles: PixelGrid;
  manifest: Manifest;
}

export function buildAssets(): BuiltAssets {
  return {
    hero: composeSheet(heroFrames(), 6),
    npc: composeSheet(npcFrames(), 6),
    scarab: composeSheet(scarabFrames(), 6),
    tiles: composeSheet(tileFrames(), 8),
    manifest: buildManifest()
  };
}
