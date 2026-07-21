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
