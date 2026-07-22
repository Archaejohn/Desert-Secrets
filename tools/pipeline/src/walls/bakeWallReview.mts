/** Review bake: render the W1 rock recipes to PNGs for visual review. Run:
 *    npx tsx tools/pipeline/src/walls/bakeWallReview.mts <outDir>
 *  Not a test — an authoring aid. */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderWall } from "./renderWall";
import { encodePng } from "../png";

const base = { W: 9, H: 5, ch: 0.34, bw: 0.48, relief: 0.45, frac: 0.4, irr: 0.55,
  batter: 0.15, talus: 0.45, crest: "auto" as const, crestAmt: 0.55, top: "auto" as const, seed: 11 };
const outDir = process.argv[2] ?? "tools/pipeline/.bake";
mkdirSync(outDir, { recursive: true });
for (const style of ["strata", "granite"] as const) {
  const g = renderWall({ ...base, style });
  writeFileSync(`${outDir}/wall-${style}.png`, encodePng(g));
  console.log(`wrote ${outDir}/wall-${style}.png (${g.width}x${g.height})`);
}
