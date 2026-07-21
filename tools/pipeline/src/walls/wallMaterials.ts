import { AAP64 } from "../palette/aap64";
import { CORE, type PaletteName } from "../../../../src/shared/palette";
import type { Material } from "./primitives";

/** AAP-64 hex (lowercased) → CORE PaletteName. CORE holds exactly the 64 AAP-64 hexes. */
const HEX_TO_NAME: Record<string, PaletteName> = (() => {
  const m: Record<string, PaletteName> = {};
  for (const name of Object.keys(CORE) as PaletteName[]) m[CORE[name].toLowerCase()] = name;
  return m;
})();
export const hexToName = (hex: string): PaletteName => HEX_TO_NAME[hex.toLowerCase()];
export const aapIndexToName = (i: number): PaletteName => hexToName(AAP64[i]);

/** Muted default lambert window (owner: prototype cliffs read too bright). A near-vertical
 *  face catches ~0.24-0.50 lambert; a lower window keeps lit faces off the ramp's brightest
 *  entries. Per-recipe overrides may narrow this further. */
export const WALL_WIN: [number, number] = [0.06, 0.44];

/** A material = its AAP-64 ramp (hex strings, light->dark) spread across a lambert window. */
export const MAT = (ix: number[], lo: number, hi: number): Material => ({
  R: ix.map((i) => AAP64[i]), lo, hi,
});
