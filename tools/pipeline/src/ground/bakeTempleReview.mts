/** Review bake: composite a demo sun-temple floor (templeSlab island in reefSilt) with
 *  a sun emblem + shattered slabs, and write a PNG for visual review. Run:
 *    npx tsx tools/pipeline/src/ground/bakeTempleReview.mts <outPath>
 *  Not a test — an authoring aid. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { compositeMapLayers } from "./composite";
import { paintFeatures, type GroundFeature } from "./features";
import { encodePng } from "../png";
import type { TerrainKey } from "../cliffs/palette";

const W = 20, H = 14;
const map: TerrainKey[][] = [];
for (let y = 0; y < H; y++) {
  const row: TerrainKey[] = [];
  for (let x = 0; x < W; x++) {
    const inFloor = x >= 3 && x <= 16 && y >= 2 && y <= 11;
    row.push(inFloor ? "templeSlab" : "reefSilt");
  }
  map.push(row);
}
const { grid, terrainId, shadow } = compositeMapLayers(map);
const feats: GroundFeature[] = [
  { kind: "sunEmblem", tx: 9, ty: 6 },
  { kind: "shatter", tx: 5, ty: 9, seed: 3 },
  { kind: "shatter", tx: 14, ty: 4, seed: 7 },
];
paintFeatures(grid, terrainId, shadow, feats, grid.width);

const out = process.argv[2] ?? "temple-review.png";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, encodePng(grid));
console.log(`wrote ${out} (${grid.width}x${grid.height})`);
