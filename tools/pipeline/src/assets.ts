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
import { johnFrames } from "./sprites/john";
import { pamelaFrames } from "./sprites/pamela";
import { chickenFrames } from "./sprites/chicken";
import { bucketFrames } from "./sprites/bucket";
import { piggyFrames } from "./sprites/piggy";
import { jackrabbitFrames } from "./sprites/jackrabbit";
import { buzzardFrames } from "./sprites/buzzard";
import { gilaFrames } from "./sprites/gila";
import { foremanFrames } from "./sprites/foreman";
import { queenFrames } from "./sprites/queen";
import { slitherFrames } from "./sprites/slither";
import { minerFrames } from "./sprites/miner";
import { fluffballFrames } from "./sprites/fluffball";
import { icebatFrames } from "./sprites/icebat";
import { crystalcrawlerFrames } from "./sprites/crystalcrawler";
import { frostscarabFrames } from "./sprites/frostscarab";
import { wardenFrames } from "./sprites/warden";
import { spigotFrames } from "./sprites/spigot";
import { anglerfishFrames } from "./sprites/anglerfish";
import { reefeelFrames } from "./sprites/reefeel";
import { lurkerFrames } from "./sprites/lurker";
import { tileFrames } from "./tileset";
import { tile2Frames } from "./tileset2";
import { tile3Frames } from "./tileset3";
import { tile4Frames } from "./tileset4";
import { buildManifest, type Manifest } from "./manifest";

export interface BuiltAssets {
  hero: PixelGrid;
  npc: PixelGrid;
  scarab: PixelGrid;
  rosa: PixelGrid;
  john: PixelGrid;
  pamela: PixelGrid;
  chicken: PixelGrid;
  bucket: PixelGrid;
  piggy: PixelGrid;
  jackrabbit: PixelGrid;
  buzzard: PixelGrid;
  gila: PixelGrid;
  foreman: PixelGrid;
  queen: PixelGrid;
  slither: PixelGrid;
  miner: PixelGrid;
  fluffball: PixelGrid;
  icebat: PixelGrid;
  crystalcrawler: PixelGrid;
  frostscarab: PixelGrid;
  warden: PixelGrid;
  spigot: PixelGrid;
  anglerfish: PixelGrid;
  reefeel: PixelGrid;
  lurker: PixelGrid;
  tiles: PixelGrid;
  tiles2: PixelGrid;
  tiles3: PixelGrid;
  tiles4: PixelGrid;
  manifest: Manifest;
}

/** Every sheet key that becomes a PNG (manifest excluded). */
export const SHEET_KEYS = [
  "hero",
  "npc",
  "scarab",
  "rosa",
  "john",
  "pamela",
  "chicken",
  "bucket",
  "piggy",
  "jackrabbit",
  "buzzard",
  "gila",
  "foreman",
  "queen",
  "slither",
  "miner",
  "fluffball",
  "icebat",
  "crystalcrawler",
  "frostscarab",
  "warden",
  "spigot",
  "anglerfish",
  "reefeel",
  "lurker",
  "tiles",
  "tiles2",
  "tiles3",
  "tiles4"
] as const;

export function buildAssets(): BuiltAssets {
  return {
    hero: composeSheet(heroFrames(), 6),
    npc: composeSheet(npcFrames(), 6),
    scarab: composeSheet(scarabFrames(), 6),
    rosa: composeSheet(rosaFrames(), 6),
    john: composeSheet(johnFrames(), 6),
    pamela: composeSheet(pamelaFrames(), 6),
    chicken: composeSheet(chickenFrames(), 6),
    bucket: composeSheet(bucketFrames(), 2),
    piggy: composeSheet(piggyFrames(), 6),
    jackrabbit: composeSheet(jackrabbitFrames(), 6),
    buzzard: composeSheet(buzzardFrames(), 6),
    gila: composeSheet(gilaFrames(), 6),
    foreman: composeSheet(foremanFrames(), 6),
    queen: composeSheet(queenFrames(), 6),
    slither: composeSheet(slitherFrames(), 6),
    miner: composeSheet(minerFrames(), 6),
    fluffball: composeSheet(fluffballFrames(), 6),
    icebat: composeSheet(icebatFrames(), 6),
    crystalcrawler: composeSheet(crystalcrawlerFrames(), 6),
    frostscarab: composeSheet(frostscarabFrames(), 6),
    warden: composeSheet(wardenFrames(), 6),
    spigot: composeSheet(spigotFrames(), 1),
    anglerfish: composeSheet(anglerfishFrames(), 6),
    reefeel: composeSheet(reefeelFrames(), 6),
    lurker: composeSheet(lurkerFrames(), 6),
    tiles: composeSheet(tileFrames(), 8),
    tiles2: composeSheet(tile2Frames(), 8),
    tiles3: composeSheet(tile3Frames(), 8),
    tiles4: composeSheet(tile4Frames(), 8),
    manifest: buildManifest()
  };
}
