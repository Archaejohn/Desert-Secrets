import { baseName } from "./dressing";
import type { TerrainKey } from "../../../tools/pipeline/src/cliffs/palette";

/** Reef-garden ground tile-names → TerrainKey (after baseName strips dressing). */
export const REEF_GARDEN_GROUND_TO_TERRAIN: Readonly<Record<string, TerrainKey>> = {
  reefFloor: "reefFloor",
  reefFloor2: "reefFloor", // hash-variant sprite of the same terrain
  glowMoss: "glowMoss",
  mintKelp: "glowMoss",    // no dedicated key; same bioluminescent reef-green family
};
export const REEF_GARDEN_DEFAULT_TERRAIN: TerrainKey = "reefFloor";

/** ReefHollow non-water ground → TerrainKey (reefStone banks → the firmer reefFloor). */
const REEF_HOLLOW_LAND: Readonly<Record<string, TerrainKey>> = {
  reefSilt: "reefSilt", glowMoss: "glowMoss", reefStone: "reefFloor", mintKelp: "glowMoss",
};
/** Floor pass: water maps to seabed (reefSilt) so the composite shows continuous seabed
 *  under the water. Both animation-phase names mapped (baseName doesn't strip the `...2`). */
export const REEF_HOLLOW_SEABED: Readonly<Record<string, TerrainKey>> = { ...REEF_HOLLOW_LAND, reefWater: "reefSilt", reefWater2: "reefSilt" };
/** Mask pass: water KEPT as reefWater so `compositeMapLayers().terrainId===reefWater` gives
 *  the organic water footprint for the surface overlay. */
export const REEF_HOLLOW_WATER: Readonly<Record<string, TerrainKey>> = { ...REEF_HOLLOW_LAND, reefWater: "reefWater", reefWater2: "reefWater" };
export const REEF_HOLLOW_DEFAULT: TerrainKey = "reefSilt";

/** Sun-temple ground tile-names → TerrainKey. Floor + glyph become the authored
 *  templeSlab; the flooded surround composites as dark reefSilt seabed (both water
 *  animation phases). `baseName` folds the dressed `…Shade` variants in. */
export const SUNTEMPLE_GROUND_TO_TERRAIN: Readonly<Record<string, TerrainKey>> = {
  templeFloor: "templeSlab",
  templeGlyph: "templeSlab",
  seaWater: "reefSilt",
  seaWater2: "reefSilt",
};
export const SUNTEMPLE_DEFAULT_TERRAIN: TerrainKey = "reefSilt";

/** Cinnabar Mine ground tile-names → TerrainKey. Dark stone floor becomes the warm
 *  emberRock (clay/rust/stoneDeep/ink) to suit the cinnabar mine; the frost patches
 *  keep their own frostSand key so the composite blends warm stone with frost via
 *  the shared mask. */
export const MINE_GROUND_TO_TERRAIN: Readonly<Record<string, TerrainKey>> = {
  mineFloor: "emberRock",
  frostSand: "frostSand",
};
export const MINE_DEFAULT_TERRAIN: TerrainKey = "emberRock";

/** One (possibly dressed) ground tile-name → TerrainKey via its base name, or null if unmapped. */
export function groundNameToTerrainKey(name: string | null, table: Readonly<Record<string, TerrainKey>>): TerrainKey | null {
  const b = baseName(name);
  return b !== null && b in table ? table[b] : null;
}

/** A zone's (dressed) ground grid → TerrainKey[][]; unmapped cells fall back to `fallback`. */
export function terrainGrid(
  ground: readonly (readonly string[])[],
  table: Readonly<Record<string, TerrainKey>>,
  fallback: TerrainKey,
): TerrainKey[][] {
  return ground.map((row) => row.map((name) => groundNameToTerrainKey(name, table) ?? fallback));
}
