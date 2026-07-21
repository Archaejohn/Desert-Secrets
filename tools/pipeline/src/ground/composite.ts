import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";
import { PixelGrid } from "../grid";
import { overlayMask } from "../cliffs/blob47";
import { fill } from "./fills";
import { CORE, type PaletteName } from "../../../../src/shared/palette";
import { redmean } from "../palette/remap";

/** Global seam priority; higher = owns the seam (carves into lower). Seeded from
 *  the per-biome orders in presets.ts, biomes ordered desert<reef<ice<lava<grove. */
const ORDER: TerrainKey[] = [
  "sand", "asphalt", "frostSand",
  "reefFloor", "reefSilt", "reefWater", "glowMoss",
  "ice", "snow", "frozenLake", "rimeMoss",
  "emberRock", "ash", "lava", "lavaCrust",
  "groveGrass", "groveMoss", "groveWater", "groveSoil",
];
export const GROUND_PRIORITY: Record<TerrainKey, number> = Object.fromEntries(
  ORDER.map((k, i) => [k, i]),
) as Record<TerrainKey, number>;
// safety: ORDER must cover every terrain
for (const k of Object.keys(TERRAIN_RAMPS)) if (!(k in GROUND_PRIORITY)) throw new Error(`priority missing ${k}`);

export const DIRS = [
  { bit: 1, dx: 0, dy: -1 }, { bit: 2, dx: 1, dy: -1 }, { bit: 4, dx: 1, dy: 0 }, { bit: 8, dx: 1, dy: 1 },
  { bit: 16, dx: 0, dy: 1 }, { bit: 32, dx: -1, dy: 1 }, { bit: 64, dx: -1, dy: 0 }, { bit: 128, dx: -1, dy: -1 },
];

/** 8-bit config: bit SET where `atOverSide(dx,dy)` is true (neighbor on the field
 *  side), CLEARED where it carves in. Feeds `overlayMask` directly. */
export function neighborConfig(atOverSide: (dx: number, dy: number) => boolean): number {
  let cfg = 0;
  for (const d of DIRS) if (atOverSide(d.dx, d.dy)) cfg |= d.bit;
  return cfg;
}

const T = 16;

/** Shared 16x16 seam stencil params (owner-tuned; see MEMORY reef-cliff-tuned-seam-values). */
export const SEAM = { inset: 5, irreg: 30, round: 8, pocketRound: 8, seed: 7439 };

const terrainAt = (map: TerrainKey[][], cx: number, cy: number): TerrainKey | null =>
  (cy >= 0 && cy < map.length && cx >= 0 && cx < map[cy].length) ? map[cy][cx] : null;

// --- soft seam shadow -------------------------------------------------------
// Palette-locked "alpha-blend dark gray into the pixel": for each CORE colour,
// its softly-shadowed variant = the colour nudged ~38% toward a soft dark grey,
// snapped to the nearest CORE colour. Gives a gentle grey seam shadow instead of
// the hard near-black outline `shade()` produced at ramp ends.
const CORE_NAMES = Object.keys(CORE) as PaletteName[];
const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const nearestCore = (rgb: [number, number, number]): PaletteName => {
  let best = CORE_NAMES[0], bd = Infinity;
  for (const k of CORE_NAMES) { const d = redmean(rgb, rgbOf(CORE[k])); if (d < bd) { bd = d; best = k; } }
  return best;
};
const SHADOW_RGB: [number, number, number] = [28, 25, 36]; // dark grey-violet
const SHADOW_A = 0.52;
const SOFT_SHADOW: Record<string, PaletteName> = {};
for (const k of CORE_NAMES) {
  const c = rgbOf(CORE[k]);
  SOFT_SHADOW[k] = nearestCore([
    c[0] + (SHADOW_RGB[0] - c[0]) * SHADOW_A,
    c[1] + (SHADOW_RGB[1] - c[1]) * SHADOW_A,
    c[2] + (SHADOW_RGB[2] - c[2]) * SHADOW_A,
  ]);
}

/** Composite one 16x16 map cell (cx,cy) from G1's world-position fills, sampled at
 *  world position (ox+cx*16+x, oy+cy*16+y) so texture is seamless across cells.
 *
 *  PRIORITY-LAYERING: the cell's own terrain (`self`) is the base; EVERY neighbor
 *  terrain that outranks `self` carves in as its own `overlayMask` layer, processed
 *  in ascending priority so higher terrains overpaint lower ones. This is what makes
 *  3-4-way junctions overlap correctly — an earlier "single highest neighbor only"
 *  version dropped the other transitions and left hard, straight, untransitioned
 *  edges. Then a soft grey seam shadow (SOFT_SHADOW) is applied to the lower side of
 *  each seam — a gentle darkened border, not a hard ink line. */
export function compositeCell(map: TerrainKey[][], cx: number, cy: number, ox: number, oy: number): PixelGrid {
  const g = new PixelGrid(T, T);
  const self = map[cy][cx];
  const wx0 = ox + cx * T, wy0 = oy + cy * T;
  const selfPri = GROUND_PRIORITY[self];

  // PRIORITY-LAYERING: every neighbor terrain that OUTRANKS self, ascending by priority,
  // carves in as its own mask layer; higher layers overpaint lower. At a 3-4-way junction
  // all transitions are drawn and overlap correctly — the previous "single highest
  // neighbor only" shortcut dropped the others and left hard straight untransitioned edges.
  const higher = [...new Set<TerrainKey>(
    DIRS.map((d) => terrainAt(map, cx + d.dx, cy + d.dy))
      .filter((n): n is TerrainKey => !!n && GROUND_PRIORITY[n] > selfPri),
  )].sort((a, b) => GROUND_PRIORITY[a] - GROUND_PRIORITY[b]);

  if (higher.length === 0) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.px(x, y, fill(self, wx0 + x, wy0 + y));
    return g;
  }

  // Each higher terrain U's carve mask. U carves the cell (mask=0) from directions where a
  // neighbor of priority >= P[U] sits, and retreats (mask=1, field) toward lower/off-map
  // sides. Distinct seed per U so overlapping seams don't align identically.
  const layers = higher.map((U) => {
    const pu = GROUND_PRIORITY[U];
    const cfg = neighborConfig((dx, dy) => { const n = terrainAt(map, cx + dx, cy + dy); return !n || GROUND_PRIORITY[n] < pu; });
    return { U, m: overlayMask(cfg, SEAM.inset, SEAM.irreg, SEAM.round, SEAM.seed + pu, SEAM.pocketRound) };
  });

  // Pass 1: winning terrain per pixel (ascending layers; the highest U that carves wins).
  const win = new Array<TerrainKey>(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let terr = self;
    for (const L of layers) if (L.m[y * T + x] === 0) terr = L.U;
    win[y * T + x] = terr;
  }

  // Pass 2: fill + SOFT GREY seam shadow — a pixel on the lower side of a seam (a
  // higher-priority winner 4-neighbours it) is nudged toward grey via SOFT_SHADOW.
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const w = win[y * T + x];
    let name = fill(w, wx0 + x, wy0 + y);
    const p = GROUND_PRIORITY[w];
    const shadowed = (nx: number, ny: number): boolean =>
      nx >= 0 && nx < T && ny >= 0 && ny < T && GROUND_PRIORITY[win[ny * T + nx]] > p;
    if (shadowed(x - 1, y) || shadowed(x + 1, y) || shadowed(x, y - 1) || shadowed(x, y + 1)) name = SOFT_SHADOW[name];
    g.px(x, y, name);
  }
  return g;
}

/** Composite an entire map region into one seamless `(w*16)×(h*16)` texture by
 *  blitting `compositeCell` for every grid cell. `ox`/`oy` shift the world
 *  sampling origin (kept in sync with `compositeCell`'s own world-position
 *  fills) so a sub-region composited on its own still tiles seamlessly with
 *  the rest of the map. 3+-terrain junctions are handled by `compositeCell`'s
 *  priority-layering (every higher neighbor carves as its own layer), so
 *  composition never throws and no transition is dropped. */
export function compositeMap(map: TerrainKey[][], ox = 0, oy = 0): PixelGrid {
  const h = map.length, w = map[0].length;
  const out = new PixelGrid(w * T, h * T);
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    out.blit(compositeCell(map, cx, cy, ox, oy), cx * T, cy * T);
  }
  return out;
}
