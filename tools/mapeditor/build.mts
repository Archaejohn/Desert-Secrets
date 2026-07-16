/**
 * Builds the self-contained overworld map editor (`tools/mapeditor/mapeditor.html`).
 *
 * The editor is a LAYOUT tool for the terrain-first v23 overworld: a person
 * paints the semantic terrain (mountain / open sand / water) and drops the two
 * gates and their landmarks; the game's own autotile passes turn that into the
 * finished `owMountain*` / `scree*` / `lakeShore*` tiling. The editor previews
 * with a JS port of those exact passes (parity is asserted in the map tests).
 *
 * This build inlines everything — the three sheets the finished overworld
 * actually uses (`tiles`, `tiles2`, `owMountains`) as base64 data URIs, the
 * manifest name→index maps, the solid-tile list, and the CURRENT overworld
 * (derived to a semantic layout via `deriveAuthoredLayout`) as the editable
 * seed — so it opens straight from disk or as a hosted Artifact, no server.
 *
 * Run with `npm run mapeditor`, then open the printed path in a browser.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildOverworldMap,
  deriveAuthoredLayout,
  OVERWORLD_HEIGHT,
  OVERWORLD_NORTH_EXIT,
  OVERWORLD_NORTH_SPAWN,
  OVERWORLD_SOUTH_EXIT,
  OVERWORLD_SOUTH_SPAWN,
  OVERWORLD_WIDTH
} from "../../src/game/maps/overworldMap";
import { SOLID_TILE_NAMES } from "../../src/game/maps/types";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const genDir = join(repo, "src", "assets", "generated");
const manifest = JSON.parse(readFileSync(join(genDir, "manifest.json"), "utf8"));

// Only the sheets a finished overworld can reference: base desert + landmarks
// (tiles/tiles2), the scree/lakeShore transitions (tiles2), and the 80 mountain
// autotiles (owMountains). owBillboards is Mode-7-only and never in the grid.
const SHEET_KEYS = ["tiles", "tiles2", "owMountains"] as const;
const sheets = SHEET_KEYS.map((key) => {
  const def = manifest[key];
  const png = readFileSync(join(genDir, def.file));
  return {
    key,
    cols: def.columns as number,
    names: def.names as Record<string, number>,
    img: `data:image/png;base64,${png.toString("base64")}`
  };
});

const exitCenter = (r: { x1: number; y1: number; x2: number; y2: number }) => ({
  x: Math.round((r.x1 + r.x2) / 2),
  y: Math.round((r.y1 + r.y2) / 2)
});
const seed = deriveAuthoredLayout(buildOverworldMap(), {
  northGate: exitCenter(OVERWORLD_NORTH_EXIT),
  northSpawn: OVERWORLD_NORTH_SPAWN,
  southGate: exitCenter(OVERWORLD_SOUTH_EXIT),
  southSpawn: OVERWORLD_SOUTH_SPAWN
});

const data = {
  width: OVERWORLD_WIDTH,
  height: OVERWORLD_HEIGHT,
  seed,
  sheets,
  solid: [...SOLID_TILE_NAMES],
  solidPrefixes: ["owMountain"],
  solidSuffixes: ["Face", "Face2", "Cap", "Cap2"]
};

const template = readFileSync(join(here, "template.html"), "utf8");
const html = template.replace("__EDITOR_DATA__", JSON.stringify(data));
const out = join(here, "mapeditor.html");
writeFileSync(out, html);

console.log(`Map editor written: ${out} (${(html.length / 1024).toFixed(0)} KB, self-contained)`);
console.log(`Open it in a browser:  file://${out}`);
