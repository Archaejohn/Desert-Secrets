/**
 * Enriched per-ground colour ramps for AAP-64.
 *
 * Each terrain keeps its 4 IDENTITY colours (the `TERRAIN_RAMPS[key]` ramp,
 * light→dark) unchanged. Between each ADJACENT ID pair we insert ~2 intermediate
 * AAP-64 tones — RGB-lerp the two ID hexes at 1/3 and 2/3, snap each to its
 * NEAREST AAP-64 colour (redmean), and resolve back to its CORE `PaletteName`.
 * The result is a richer light→dark ramp so `fill()` can BLEND across a body
 * transition through the intermediate tones (a smooth multi-step gradient)
 * instead of stepping hard between two ID colours.
 *
 * Palette-lock is preserved: every emitted name is a real `PaletteName` (all 64
 * AAP-64 colours are named in `CORE`). Deterministic + pure — no randomness.
 *
 * Cliff sheets are NOT affected; this is ground-fill only.
 */
import { AAP64 } from "../palette/aap64";
import { redmean } from "../palette/remap";
import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";
import { CORE, hexToRgb, type PaletteName } from "../../../../src/shared/palette";

type RGB = [number, number, number];

/** hex → CORE PaletteName. Bijective: CORE holds exactly the 64 AAP-64 hexes. */
const HEX_TO_NAME: Record<string, PaletteName> = (() => {
  const m: Record<string, PaletteName> = {};
  for (const name of Object.keys(CORE) as PaletteName[]) m[CORE[name].toLowerCase()] = name;
  return m;
})();

const AAP_RGB: RGB[] = AAP64.map((h) => hexToRgb(h));

/** Nearest AAP-64 colour name to an arbitrary RGB (redmean perceptual distance). */
function nearestAapName(rgb: RGB): PaletteName {
  let best = 0, bd = Infinity;
  for (let i = 0; i < AAP_RGB.length; i++) {
    const d = redmean(rgb, AAP_RGB[i]);
    if (d < bd) { bd = d; best = i; }
  }
  return HEX_TO_NAME[AAP64[best].toLowerCase()];
}

const lerp = (a: number, b: number, f: number): number => Math.round(a + (b - a) * f);

/** Build one enriched ramp + the positions of the 4 original IDs within it. */
function buildRamp(ids: readonly PaletteName[]): { ramp: PaletteName[]; pos: number[] } {
  const ramp: PaletteName[] = [];
  const pos: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (ramp.length === 0 || ramp[ramp.length - 1] !== id) ramp.push(id);
    pos.push(ramp.length - 1);
    if (i < ids.length - 1) {
      const a = hexToRgb(CORE[id]), b = hexToRgb(CORE[ids[i + 1]]);
      for (const f of [1 / 3, 2 / 3]) {
        const name = nearestAapName([lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]);
        // Skip an intermediate that resolves to either adjacent ID, or that
        // repeats the previous entry (keeps the ramp a clean monotone stepping).
        if (name === ids[i] || name === ids[i + 1]) continue;
        if (ramp[ramp.length - 1] === name) continue;
        ramp.push(name);
      }
    }
  }
  return { ramp, pos };
}

/** Enriched light→dark ramp per terrain (4 IDs + inserted AAP-64 intermediates). */
export const GROUND_RAMPS: Record<TerrainKey, PaletteName[]> = {} as Record<TerrainKey, PaletteName[]>;
/** Index within `GROUND_RAMPS[key]` of each of the 4 original ID colours. */
export const GROUND_ID_POS: Record<TerrainKey, number[]> = {} as Record<TerrainKey, number[]>;

for (const key of Object.keys(TERRAIN_RAMPS) as TerrainKey[]) {
  const { ramp, pos } = buildRamp(TERRAIN_RAMPS[key]);
  GROUND_RAMPS[key] = ramp;
  GROUND_ID_POS[key] = pos;
}
