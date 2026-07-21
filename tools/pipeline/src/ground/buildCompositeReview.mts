/**
 * G2 owner review gate: composites two hand-built maps through the shared mask
 * over G1's world-position fills, and renders them large for the owner to judge
 * the seams + outline/edge look.
 *
 *   npx tsx tools/pipeline/src/ground/buildCompositeReview.mts
 */
import { writeFileSync } from "node:fs";
import { encodePng } from "../png";
import { compositeMap } from "./composite";
import type { TerrainKey } from "../cliffs/palette";

// Same-biome 4-way junction: reefFloor field with silt / water / moss patches.
const reef: TerrainKey[][] = [
  ["reefFloor", "reefFloor", "reefFloor", "reefFloor", "reefFloor", "reefFloor"],
  ["reefFloor", "reefSilt", "reefSilt", "reefFloor", "reefWater", "reefWater"],
  ["reefFloor", "reefSilt", "reefFloor", "reefFloor", "reefWater", "reefFloor"],
  ["reefFloor", "reefFloor", "reefFloor", "glowMoss", "glowMoss", "reefFloor"],
  ["reefFloor", "reefWater", "reefFloor", "glowMoss", "reefFloor", "reefFloor"],
  ["reefFloor", "reefFloor", "reefFloor", "reefFloor", "reefFloor", "reefFloor"],
];
// Cross-biome: sand field meeting a grove-grass patch (any-to-any, no per-pair tile).
const cross: TerrainKey[][] = [
  ["sand", "sand", "sand", "sand", "sand"],
  ["sand", "sand", "groveGrass", "groveGrass", "sand"],
  ["sand", "groveGrass", "groveGrass", "groveGrass", "sand"],
  ["sand", "sand", "groveGrass", "sand", "sand"],
  ["sand", "sand", "sand", "sand", "sand"],
];
// A liquids scene: reefWater pool + lava flow meeting their fields (edge treatment on liquids).
const liquids: TerrainKey[][] = [
  ["emberRock", "emberRock", "emberRock", "reefFloor", "reefFloor", "reefFloor"],
  ["emberRock", "lava", "lava", "reefFloor", "reefWater", "reefFloor"],
  ["emberRock", "lava", "emberRock", "reefFloor", "reefWater", "reefWater"],
  ["emberRock", "emberRock", "emberRock", "reefFloor", "reefFloor", "reefFloor"],
];

const uri = (m: TerrainKey[][]) => "data:image/png;base64," + encodePng(compositeMap(m)).toString("base64");
const scene = (title: string, m: TerrainKey[][], scale = 4) =>
  `<figure><figcaption>${title}</figcaption><img style="width:${m[0].length * 16 * scale}px" src="${uri(m)}"></figure>`;

writeFileSync("docs/superpowers/artifacts/ground-composite-review.html",
  `<!doctype html><meta charset=utf8><title>G2 composite</title><style>
   body{font:14px system-ui,sans-serif;background:#1b1b1f;color:#eee;margin:20px;max-width:1300px}
   h1{font-size:20px}.legend{color:#999;font-size:12px}
   img{image-rendering:pixelated;border:1px solid #333;display:block}
   figcaption{color:#cbd;margin-bottom:6px;font-weight:600}figure{margin:0 0 30px}</style>
   <h1>G2 mask-composite — world-position fills + one shared mask + outline</h1>
   <p class="legend">Each transition is composited from G1's world-position ground fills carved by the shared 47-blob <code>overlayMask</code>, with the outline/edge + drop-shadow pass — <b>no per-pair transition tiles</b>. Priority owns the seam. Pixel-exact, ×4.</p>
   ${scene("Same-biome — reef 4-way junction (floor · silt · water · moss)", reef)}
   ${scene("Cross-biome — sand ↔ grove (any-to-any, no per-pair tile)", cross)}
   ${scene("Liquids + cross-biome — lava-in-basalt beside a reef-water pool", liquids)}`);
console.log("wrote docs/superpowers/artifacts/ground-composite-review.html");
