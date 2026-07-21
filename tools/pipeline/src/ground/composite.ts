import { TERRAIN_RAMPS, shade, type TerrainKey } from "../cliffs/palette";
import { nameToRampIndex } from "../cliffs/terrains";
import { PixelGrid } from "../grid";
import { overlayMask } from "../cliffs/blob47";
import { fill } from "./fills";

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
export const SEAM = { inset: 3, irreg: 20, round: 8, pocketRound: 8, seed: 7439 };

const terrainAt = (map: TerrainKey[][], cx: number, cy: number): TerrainKey | null =>
  (cy >= 0 && cy < map.length && cx >= 0 && cx < map[cy].length) ? map[cy][cx] : null;

/** Composite one 16x16 map cell (cx,cy) from G1's world-position fills. The
 *  cell's own terrain (`self`) is the field; the single highest-priority
 *  neighbor that outranks `self` (`carve`) carves in through the shared
 *  `overlayMask` stencil. Sampled at world position (ox+cx*16+x, oy+cy*16+y)
 *  so texture is seamless across cell boundaries. Task 4 adds an outline/
 *  drop-shadow pass ported from `blobTiles` (cliffs/blob47.ts): the darkened
 *  field-edge / lit inner lip / drop-shadow ramp-index shifts, using the same
 *  `on(x,y)` 8-neighbor boundary test built from the mask + config bits.
 *  NOTE on naming: `carve` here is the OPPOSITE of blob47's local `over` (there,
 *  `over` is the mask=1 painted field; here, mask=1 is `self` and `carve` is the
 *  mask=0 higher-priority terrain reaching in) — kept distinct on purpose to
 *  avoid a cross-file naming trap. */
export function compositeCell(map: TerrainKey[][], cx: number, cy: number, ox: number, oy: number): PixelGrid {
  const g = new PixelGrid(T, T);
  const self = map[cy][cx];
  const wx0 = ox + cx * T, wy0 = oy + cy * T;

  // highest-priority neighbor that outranks `self`
  let carve: TerrainKey = self, carvePri = GROUND_PRIORITY[self];
  for (const d of DIRS) {
    const n = terrainAt(map, cx + d.dx, cy + d.dy);
    if (n && GROUND_PRIORITY[n] > carvePri) { carve = n; carvePri = GROUND_PRIORITY[n]; }
  }
  if (carve === self) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.px(x, y, fill(self, wx0 + x, wy0 + y));
    return g;
  }
  // config: bit SET where the neighbor is NOT carving in (priority <= self); the
  // carved terrain `carve` (higher) reaches in from cleared-bit directions.
  const cfg = neighborConfig((dx, dy) => {
    const n = terrainAt(map, cx + dx, cy + dy);
    return !n || GROUND_PRIORITY[n] <= GROUND_PRIORITY[self];
  });
  const m = overlayMask(cfg, SEAM.inset, SEAM.irreg, SEAM.round, SEAM.seed, SEAM.pocketRound);

  // Outline/shadow pass: same 8-neighbor boundary test as blobTiles, built from
  // `m` plus the config bits (so it agrees with neighboring cells at the seam).
  const N = !!(cfg & 1), NE = !!(cfg & 2), E = !!(cfg & 4), SE = !!(cfg & 8),
        S = !!(cfg & 16), SW = !!(cfg & 32), W = !!(cfg & 64), NW = !!(cfg & 128);
  const on = (x: number, y: number): number => {
    const ox2 = x < 0 ? -1 : x >= T ? 1 : 0, oy2 = y < 0 ? -1 : y >= T ? 1 : 0;
    if (ox2 === 0 && oy2 === 0) return m[y * T + x];
    let bit: boolean;
    if (ox2 === 0) bit = oy2 < 0 ? N : S; else if (oy2 === 0) bit = ox2 < 0 ? W : E;
    else bit = ox2 < 0 ? (oy2 < 0 ? NW : SW) : (oy2 < 0 ? NE : SE);
    if (!bit) return 0;
    const cxp = Math.max(0, Math.min(T - 1, x)), cyp = Math.max(0, Math.min(T - 1, y));
    return m[cyp * T + cxp];
  };
  const fieldRamp = TERRAIN_RAMPS[self], carveRamp = TERRAIN_RAMPS[carve];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // mask=1 -> field (self); mask=0 -> carved higher terrain (carve)
    const isField = m[y * T + x] === 1;
    const terr = isField ? self : carve;
    let name = fill(terr, wx0 + x, wy0 + y);
    if (isField) {
      if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) {
        const idx = nameToRampIndex(self, name);
        // G1 fills draw from the enriched GROUND_RAMPS, which include intermediate
        // tones not present in the bare 4-color TERRAIN_RAMPS; nameToRampIndex
        // returns -1 for those, so skip the shade and keep the flat fill.
        if (idx !== -1) name = shade(fieldRamp, idx, 1);       // darkened field-edge
      } else if (on(x, y - 1) && !on(x, y - 2)) {
        const idx = nameToRampIndex(self, name);
        if (idx !== -1) name = shade(fieldRamp, idx, -1);      // lit inner lip
      }
    } else if (on(x, y - 1) || on(x - 1, y - 1)) {
      const idx = nameToRampIndex(carve, name);
      if (idx !== -1) name = shade(carveRamp, idx, 2);         // drop shadow on carve side
    }
    g.px(x, y, name);
  }
  return g;
}

/** Composite an entire map region into one seamless `(w*16)×(h*16)` texture by
 *  blitting `compositeCell` for every grid cell. `ox`/`oy` shift the world
 *  sampling origin (kept in sync with `compositeCell`'s own world-position
 *  fills) so a sub-region composited on its own still tiles seamlessly with
 *  the rest of the map. Graceful degradation for 3+-terrain junctions is
 *  inherited from `compositeCell`: each cell only ever seams to its single
 *  highest-priority neighbor, so composition never throws. */
export function compositeMap(map: TerrainKey[][], ox = 0, oy = 0): PixelGrid {
  const h = map.length, w = map[0].length;
  const out = new PixelGrid(w * T, h * T);
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    out.blit(compositeCell(map, cx, cy, ox, oy), cx * T, cy * T);
  }
  return out;
}
