/**
 * G1 owner review gate: renders each of the 19 grounds two ways —
 * OLD (`floorFill` stamped/tiled across an N×N area, shows the 16px repeat) vs
 * NEW (world-position `fillField`, no repeat + macro drift + per-material grain)
 * — into a side-by-side HTML for the owner to confirm.
 *
 *   npx tsx tools/pipeline/src/ground/buildFillReview.mts
 */
import { writeFileSync } from "node:fs";
import { PixelGrid } from "../grid";
import { encodePng } from "../png";
import { floorFill } from "../cliffs/terrains";
import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";
import { fillField } from "./fills";
import { GROUND_RAMPS, GROUND_ID_POS } from "./groundRamps";
import { CORE } from "../../../../src/shared/palette";

const N = 96;
const tiled = (key: TerrainKey): PixelGrid => {
  const t = floorFill(key, 1);
  const g = new PixelGrid(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.px(x, y, t.get(x % t.width, y % t.height));
  return g;
};
const uri = (g: PixelGrid): string => "data:image/png;base64," + encodePng(g).toString("base64");

/** Enriched-ramp strip: one swatch per GROUND_RAMPS entry, ID slots outlined. */
const rampStrip = (k: TerrainKey): string => {
  const ramp = GROUND_RAMPS[k], idPos = new Set(GROUND_ID_POS[k]);
  const cells = ramp.map((name, i) => {
    const id = idPos.has(i);
    return `<div class="sw${id ? " id" : ""}" style="background:${CORE[name]}" title="${name}${id ? " (ID)" : " (blend)"}"></div>`;
  }).join("");
  return `<div class="ramp"><span class="rlab">ramp (${ramp.length}): </span>${cells}</div>`;
};

const keys = Object.keys(TERRAIN_RAMPS) as TerrainKey[];
const items = keys.map((k) => `<div class="item"><div class="lab">${k}</div>
  ${rampStrip(k)}
  <div class="imgs">
  <figure><img style="width:${N * 3}px" src="${uri(tiled(k))}"><figcaption>old (tiled floorFill)</figcaption></figure>
  <figure><img style="width:${N * 3}px" src="${uri(fillField(k, 0, 0, N, N))}"><figcaption>new (world-position fill)</figcaption></figure></div></div>`).join("");

writeFileSync("docs/superpowers/artifacts/ground-fills-review.html",
  `<!doctype html><meta charset=utf8><title>G1 ground fills</title><style>
   body{font:14px system-ui,sans-serif;background:#1b1b1f;color:#eee;margin:20px;max-width:1300px}
   h1{font-size:20px}.legend{color:#999;font-size:12px}
   img{image-rendering:pixelated;border:1px solid #333;display:block;background:#2a2a30}
   .grid{display:flex;flex-wrap:wrap;gap:24px;margin-top:14px}.imgs{display:flex;gap:12px}
   .lab{font-weight:600;color:#cbd;margin-bottom:5px}figure{margin:0}
   figcaption{font-size:11px;color:#999;text-align:center;margin-top:3px}
   .ramp{display:flex;align-items:center;gap:2px;margin-bottom:6px}
   .rlab{font-size:10px;color:#889;margin-right:4px}
   .sw{width:20px;height:20px;border:1px solid #000;image-rendering:pixelated}
   .sw.id{border:2px solid #fff;outline:1px solid #000}</style>
   <h1>Ground fills — enriched AAP-64 ramps (old tiled vs new world-position)</h1>
   <p class="legend">Each ground at 96×96. Left = current recipe stamped (note the repeating 16px block). Right = the world-position fill. The <b>ramp strip</b> above each pair is <code>GROUND_RAMPS[key]</code> light→dark: white-outlined swatches are the 4 IDENTITY colours, the rest are AAP-64 intermediates auto-inserted between adjacent IDs so body transitions blend as multi-step gradients (hover a swatch for its name). Pixel-exact scaling.</p>
   <div class="grid">${items}</div>`);
console.log("wrote docs/superpowers/artifacts/ground-fills-review.html");
