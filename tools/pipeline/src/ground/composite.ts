import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";

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
