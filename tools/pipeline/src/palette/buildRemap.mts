/**
 * Task 3 — remap review builder. Computes the owner-approved 25→AAP-64
 * injective remap and writes a swatch to docs/superpowers/artifacts/ so the
 * owner can judge the recolor (per-color old→new, plus every ramp old-vs-new).
 * Pure preview: does NOT mutate palette.ts. Re-run after editing OVERRIDES.
 *
 *   npx tsx tools/pipeline/src/palette/buildRemap.mts
 */
import { writeFileSync } from "node:fs";
import { PALETTE } from "../../../../src/shared/palette";
import { TERRAIN_RAMPS, ROCK, ICE, REEF, LAVA, GROVE } from "../cliffs/palette";
import { remapPalette, rampInversions } from "./remap";

/** Owner per-color overrides applied AFTER the automatic remap (name -> new #hex). */
const OVERRIDES: Record<string, string> = {
  // e.g. hpRed: "#e43b44",   // filled in at the review gate if the owner wants a nudge
};

const wallRamps: Record<string, readonly string[]> = { ROCK, ICE, REEF, LAVA, GROVE };
const rampLabels = [...Object.keys(TERRAIN_RAMPS), ...Object.keys(wallRamps)];
const allRamps = [...Object.values(TERRAIN_RAMPS), ...Object.values(wallRamps)] as readonly (readonly string[])[];

const mapping = { ...remapPalette(PALETTE as Record<string, string>), ...OVERRIDES };
const inversions = rampInversions(mapping, allRamps);

// --- swatch table: each of the 25, current hex vs assigned AAP-64 hex ---
const cell = (hex: string) =>
  `<td style="background:${hex};color:${luma(hex) > 0.5 ? "#000" : "#fff"}">${hex}</td>`;
function luma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
const rows = Object.entries(PALETTE)
  .map(([name, oldHex]) => `<tr><td class="n">${name}</td>${cell(oldHex as string)}${cell(mapping[name])}</tr>`)
  .join("");

// --- ramp strips: top = current, bottom = AAP-64 (so gradients compare) ---
const strip = (ramp: readonly string[], m: (n: string) => string) =>
  `<div class="ramp">${ramp.map((n) => `<span title="${n}" style="background:${m(n)}"></span>`).join("")}</div>`;
const rampBlock = (label: string, ramp: readonly string[]) =>
  `<div class="rb"><h4>${label}</h4>${strip(ramp, (n) => (PALETTE as any)[n])}${strip(ramp, (n) => mapping[n])}</div>`;
const terrainBlocks = Object.entries(TERRAIN_RAMPS).map(([k, r]) => rampBlock(k, r as readonly string[])).join("");
const wallBlocks = Object.entries(wallRamps).map(([k, r]) => rampBlock(k, r)).join("");

const html = `<!doctype html><meta charset=utf8><title>AAP-64 remap review</title>
<style>
 body{font:14px system-ui,sans-serif;background:#1b1b1f;color:#eee;margin:24px;max-width:1100px}
 h1{font-size:20px} h2{font-size:16px;margin-top:28px;border-bottom:1px solid #444;padding-bottom:4px}
 table{border-collapse:collapse;margin-top:8px} td{padding:6px 12px;border:1px solid #333;font-variant-numeric:tabular-nums}
 td.n{background:#26262b;color:#ddd;font-weight:600}
 th{padding:6px 12px;text-align:left;color:#aaa;font-weight:600}
 .ramps{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-top:10px}
 .rb h4{margin:0 0 4px;font-size:13px;color:#cbd} .ramp{display:flex;height:26px}
 .ramp span{flex:1} .ramp+.ramp{margin-top:2px}
 .legend{color:#999;font-size:12px;margin-top:4px}
</style>
<h1>AAP-64 remap review — "embrace" clean refresh</h1>
<p class="legend">Injective 25→64 nearest-match (redmean ΔE) with per-ramp luminance-monotonicity repair.
For each ramp: <b>top strip = current</b>, <b>bottom strip = AAP-64</b>. Hover a swatch for its name.</p>
<h2>Per-color mapping (current → AAP-64)</h2>
<table><tr><th>name</th><th>current</th><th>AAP-64</th></tr>${rows}</table>
<h2>Terrain ground ramps</h2><div class="ramps">${terrainBlocks}</div>
<h2>Cliff wall-face ramps</h2><div class="ramps">${wallBlocks}</div>
<h2>Residual ramp inversions ${inversions.length ? `(${inversions.length})` : "— none"}</h2>
<p class="legend">Spots where a ramp gets slightly lighter going toward its dark end (cosmetic near-ties, all &le; 0.12 luminance; some exist in the shipped palette too). Nothing pushed to fix them — flag any you dislike for an override.</p>
${inversions.length ? `<table><tr><th>ramp</th><th>slot</th><th>lighter→darker</th><th>Δlum</th></tr>${
  inversions.map((v) => `<tr><td class="n">${rampLabels[v.rampIndex]}</td><td>${v.slot}</td><td>${v.from} → ${v.to}</td><td>${v.drop.toFixed(3)}</td></tr>`).join("")
}</table>` : ""}`;

const out = "docs/superpowers/artifacts/palette-remap-review.html";
writeFileSync(out, html);
console.log("wrote " + out);
console.log(JSON.stringify(mapping, null, 2));
