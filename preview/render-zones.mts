/** Phase Z visual gate: upscale tiles3-8 8x and composite 3 dressed maps at 2x. */
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { buildMazeMap } from "../src/game/maps/mazeMap";
import { buildGroveChamberMap } from "../src/game/maps/groveChamberMap";
import { buildPizzeriaMap } from "../src/game/maps/pizzeriaMap";
import { buildCampProperMap } from "../src/game/maps/campProperMap";
import { buildReefGardenMap } from "../src/game/maps/reefGardenMap";
import { buildSunlessSeaMap } from "../src/game/maps/sunlessSeaMap";

const ROOT = new URL("..", import.meta.url).pathname;
const GEN = `${ROOT}/src/assets/generated`;
const OUT = `${ROOT}/preview`;
const manifest = JSON.parse(readFileSync(`${GEN}/manifest.json`, "utf8"));

const sheets: Record<string, PNG> = {};
for (const key of ["tiles", "tiles2", "tiles3", "tiles4", "tiles5", "tiles6", "tiles7", "tiles8"]) {
  sheets[key] = PNG.sync.read(readFileSync(`${GEN}/${manifest[key].file}`));
}

function frameOf(name: string): { png: PNG; sx: number; sy: number } {
  for (const key of Object.keys(sheets)) {
    const idx = manifest[key].names[name];
    if (idx !== undefined) {
      return { png: sheets[key], sx: (idx % 8) * 16, sy: Math.floor(idx / 8) * 16 };
    }
  }
  throw new Error(`unknown tile ${name}`);
}

function blitTile(dst: PNG, name: string, dx: number, dy: number, scale: number): void {
  const { png, sx, sy } = frameOf(name);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const si = ((sy + y) * png.width + sx + x) * 4;
      if (png.data[si + 3] === 0) continue;
      for (let oy = 0; oy < scale; oy++) {
        for (let ox = 0; ox < scale; ox++) {
          const di = ((dy + y * scale + oy) * dst.width + dx + x * scale + ox) * 4;
          dst.data[di] = png.data[si];
          dst.data[di + 1] = png.data[si + 1];
          dst.data[di + 2] = png.data[si + 2];
          dst.data[di + 3] = 255;
        }
      }
    }
  }
}

function renderMap(name: string, map: { ground: string[][]; decor: (string | null)[][]; overhead?: (string | null)[][] }): void {
  const S = 2;
  const h = map.ground.length;
  const w = map.ground[0].length;
  const out = new PNG({ width: w * 16 * S, height: h * 16 * S });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      blitTile(out, map.ground[y][x], x * 16 * S, y * 16 * S, S);
      const d = map.decor[y][x];
      if (d) blitTile(out, d, x * 16 * S, y * 16 * S, S);
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = map.overhead?.[y]?.[x];
      if (o) blitTile(out, o, x * 16 * S, y * 16 * S, S);
    }
  writeFileSync(`${OUT}/${name}.png`, PNG.sync.write(out));
  console.log(`wrote ${name}.png (${out.width}x${out.height})`);
}

// (a) 8x sheet upscales
for (const key of ["tiles3", "tiles4", "tiles5", "tiles6", "tiles7", "tiles8"]) {
  const src = sheets[key];
  const S = 8;
  const out = new PNG({ width: src.width * S, height: src.height * S });
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + x) * 4;
      for (let oy = 0; oy < S; oy++)
        for (let ox = 0; ox < S; ox++) {
          const di = ((y * S + oy) * out.width + x * S + ox) * 4;
          out.data[di] = src.data[si];
          out.data[di + 1] = src.data[si + 1];
          out.data[di + 2] = src.data[si + 2];
          out.data[di + 3] = src.data[si + 3];
        }
    }
  writeFileSync(`${OUT}/${key}-8x.png`, PNG.sync.write(out));
  console.log(`wrote ${key}-8x.png`);
}

// (b) three representative dressed maps
renderMap("map-maze", buildMazeMap());
renderMap("map-groveChamber", buildGroveChamberMap());
renderMap("map-pizzeria", buildPizzeriaMap());
renderMap("map-campProper", buildCampProperMap());
renderMap("map-reefGarden", buildReefGardenMap());
renderMap("map-sunlessSea", buildSunlessSeaMap());
