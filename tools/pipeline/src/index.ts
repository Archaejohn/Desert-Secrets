/**
 * Art pipeline entry point — `npm run art` / `npx tsx tools/pipeline/src/index.ts`.
 *
 * Builds every asset in memory (see assets.ts) and writes the PNGs and
 * manifest.json into src/assets/generated/. Output is byte-for-byte
 * deterministic.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildAssets } from "./assets";
import { encodePng } from "./png";

const outDir = fileURLToPath(new URL("../../../src/assets/generated/", import.meta.url));
mkdirSync(outDir, { recursive: true });

const assets = buildAssets();

const sheets = [
  ["hero.png", assets.hero],
  ["npc.png", assets.npc],
  ["scarab.png", assets.scarab],
  ["rosa.png", assets.rosa],
  ["john.png", assets.john],
  ["pamela.png", assets.pamela],
  ["chicken.png", assets.chicken],
  ["bucket.png", assets.bucket],
  ["piggy.png", assets.piggy],
  ["jackrabbit.png", assets.jackrabbit],
  ["buzzard.png", assets.buzzard],
  ["gila.png", assets.gila],
  ["foreman.png", assets.foreman],
  ["queen.png", assets.queen],
  ["slither.png", assets.slither],
  ["miner.png", assets.miner],
  ["fluffball.png", assets.fluffball],
  ["icebat.png", assets.icebat],
  ["crystalcrawler.png", assets.crystalcrawler],
  ["frostscarab.png", assets.frostscarab],
  ["warden.png", assets.warden],
  ["spigot.png", assets.spigot],
  ["anglerfish.png", assets.anglerfish],
  ["reefeel.png", assets.reefeel],
  ["lurker.png", assets.lurker],
  ["middenmite.png", assets.middenmite],
  ["sunwasp.png", assets.sunwasp],
  ["reefstalker.png", assets.reefstalker],
  ["tiles.png", assets.tiles],
  ["tiles2.png", assets.tiles2],
  ["tiles3.png", assets.tiles3],
  ["tiles4.png", assets.tiles4],
  ["tiles5.png", assets.tiles5],
  ["tiles6.png", assets.tiles6],
  ["tiles7.png", assets.tiles7]
] as const;

for (const [name, grid] of sheets) {
  const buf = encodePng(grid);
  writeFileSync(join(outDir, name), buf);
  console.log(`wrote ${name} (${grid.width}x${grid.height}, ${buf.length} bytes)`);
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify(assets.manifest, null, 2) + "\n");
console.log("wrote manifest.json");
