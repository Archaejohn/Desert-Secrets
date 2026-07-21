import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";
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
 *  neighbor that outranks `self` (`over`) carves in through the shared
 *  `overlayMask` stencil. Sampled at world position (ox+cx*16+x, oy+cy*16+y)
 *  so texture is seamless across cell boundaries. No outline (Task 4). */
export function compositeCell(map: TerrainKey[][], cx: number, cy: number, ox: number, oy: number): PixelGrid {
  const g = new PixelGrid(T, T);
  const self = map[cy][cx];
  const wx0 = ox + cx * T, wy0 = oy + cy * T;

  // highest-priority neighbor that outranks `self`
  let over: TerrainKey = self, overPri = GROUND_PRIORITY[self];
  for (const d of DIRS) {
    const n = terrainAt(map, cx + d.dx, cy + d.dy);
    if (n && GROUND_PRIORITY[n] > overPri) { over = n; overPri = GROUND_PRIORITY[n]; }
  }
  if (over === self) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.px(x, y, fill(self, wx0 + x, wy0 + y));
    return g;
  }
  // config: bit SET where the neighbor is NOT carving in (priority <= self); the
  // carved terrain `over` (higher) reaches in from cleared-bit directions.
  const cfg = neighborConfig((dx, dy) => {
    const n = terrainAt(map, cx + dx, cy + dy);
    return !n || GROUND_PRIORITY[n] <= GROUND_PRIORITY[self];
  });
  const m = overlayMask(cfg, SEAM.inset, SEAM.irreg, SEAM.round, SEAM.seed, SEAM.pocketRound);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // mask=1 -> field (self); mask=0 -> carved higher terrain (over)
    const terr = m[y * T + x] === 1 ? self : over;
    g.px(x, y, fill(terr, wx0 + x, wy0 + y));
  }
  return g;
}
