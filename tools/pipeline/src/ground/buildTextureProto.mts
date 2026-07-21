/**
 * DESIGN EXPLORATION render — texture-direction prototypes.
 *
 * For each of 6 diverse grounds renders TWO 96×96 fields side by side:
 *   LEFT  = current shipped `fill(key, wx, wy)` from fills.ts
 *   RIGHT = new `protoFill(key, wx, wy)` from textureProto.ts (distinct
 *           per-material STRUCTURE — cellular / banded / faceted / clumped).
 *
 * Writes a self-contained HTML (pixelated PNG data URIs) for owner review.
 * Does NOT modify fills.ts or any baked sheet.
 *
 *   npx tsx tools/pipeline/src/ground/buildTextureProto.mts
 */
import { writeFileSync } from "node:fs";
import { PixelGrid } from "../grid";
import { encodePng } from "../png";
import { fill } from "./fills";
import { protoFill, PROTO_KEYS, type ProtoKey } from "./textureProto";
import type { TerrainKey } from "../cliffs/palette";

const N = 96;
const uri = (g: PixelGrid): string => "data:image/png;base64," + encodePng(g).toString("base64");

const fieldOf = (fn: (wx: number, wy: number) => string): PixelGrid => {
  const g = new PixelGrid(N, N);
  // sample at a non-zero world offset so we see the non-repeating character
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.px(x, y, fn(x + 512, y + 512) as never);
  return g;
};

/** one-line note on the texture STRUCTURE each prototype uses. */
const NOTE: Record<ProtoKey, string> = {
  sand: "fine near-horizontal wind-ripple bands (striate) — crests & troughs, not dots",
  reefWater: "horizontal caustic wave bands (fast × slow striate) + sparse bright crests",
  lava: "cracked molten cells (worley) — pools by cell tone, gold glow along f2−f1 seams",
  groveMoss: "warped low-freq field thresholded into irregular jade clumps over teal/umber",
  ice: "crystalline facets (worley cells) with hairline crack seams where f2−f1 is tiny",
  groveSoil: "warped higher-freq worley grains clustered into gritty clumps, not speckle",
};

const items = (PROTO_KEYS as readonly ProtoKey[]).map((k) => {
  const cur = fieldOf((wx, wy) => fill(k as TerrainKey, wx, wy));
  const nw = fieldOf((wx, wy) => protoFill(k, wx, wy));
  return `<div class="item"><div class="lab">${k}</div>
    <div class="note">${NOTE[k]}</div>
    <div class="imgs">
      <figure><img style="width:${N * 3}px" src="${uri(cur)}"><figcaption>CURRENT · fill()</figcaption></figure>
      <figure><img style="width:${N * 3}px" src="${uri(nw)}"><figcaption>NEW · protoFill()</figcaption></figure>
    </div></div>`;
}).join("");

const OUT = "C:\\Users\\cpjel\\AppData\\Local\\Temp\\claude\\C--Users-cpjel-Desktop-Desert-Secrets-Desert-Secrets\\3f256f33-0adb-4d83-92fb-7f26b2cd2a9b\\scratchpad\\texture-proto.html";

writeFileSync(OUT,
  `<!doctype html><meta charset=utf8><title>Ground texture prototypes</title><style>
   body{font:14px system-ui,sans-serif;background:#1b1b1f;color:#eee;margin:20px;max-width:960px}
   h1{font-size:20px;margin-bottom:4px}.legend{color:#9aa;font-size:13px;line-height:1.5;max-width:760px}
   img{image-rendering:pixelated;border:1px solid #333;display:block;background:#2a2a30}
   .grid{display:flex;flex-direction:column;gap:28px;margin-top:20px}
   .imgs{display:flex;gap:16px}.lab{font-weight:700;color:#cbd;font-size:16px}
   .note{color:#8a9;font-size:12px;margin:2px 0 8px}figure{margin:0}
   figcaption{font-size:11px;color:#999;text-align:center;margin-top:4px;letter-spacing:.03em}
   .item{border-top:1px solid #2c2c33;padding-top:16px}</style>
   <h1>Ground texture-direction prototypes</h1>
   <p class="legend">Exploratory only — nothing here is wired into the pipeline; the committed
   <code>fills.ts</code> is untouched. The problem: today every ground uses the same recipe (world-fbm
   mottle + single-pixel flecks), so they read as recolours of one concept. These prototypes give six
   diverse grounds a genuinely different texture <b>structure</b> — cellular, banded, faceted, clumped —
   from a small kit of world-position primitives (<code>worley</code>, <code>ridged</code>,
   <code>striate</code>, <code>warp</code>). Same ramp/colours as shipped; only the pattern changes.
   Each is 96×96 at 3× pixel-exact zoom, sampled off-origin to show the non-repeating character.
   <b>LEFT = current, RIGHT = new.</b></p>
   <div class="grid">${items}</div>`);
console.log("wrote " + OUT);
