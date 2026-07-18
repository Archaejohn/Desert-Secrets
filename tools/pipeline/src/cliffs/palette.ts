/**
 * Palette-locked colour ramps + quantization helpers for the desert cliff
 * tileset generator. See docs/superpowers/plans/2026-07-18-desert-cliff-tileset.md
 * "Quantization Strategy": every builder works in ramp-index space (an
 * ordered light→dark PaletteName[]) instead of free RGB, since the art
 * pipeline may only emit colours from src/shared/palette.ts.
 */
import type { PaletteName } from "../../../../src/shared/palette";

/** An ordered light→dark palette ramp. */
export type Ramp = readonly PaletteName[];

/** Rock face ramp: lightest (lit top) to darkest (deep shadow/outline). */
export const ROCK: Ramp = ["sandLight", "sand", "amber", "clay", "rust", "umber", "plum", "ink"];

export type TerrainKey = "sand" | "frostSand" | "asphalt";

export const TERRAIN_RAMPS: Record<TerrainKey, Ramp> = {
  sand: ["sandLight", "sand", "amber", "sandShade"],
  frostSand: ["bone", "sandLight", "skyBlue", "sandShade"],
  asphalt: ["slate", "indigo", "plum", "ink"],
};

const clampI = (i: number, n: number): number => Math.max(0, Math.min(n - 1, Math.round(i)));

/** Look up a ramp entry at `index + delta`, clamped to the ramp's ends. */
export const shade = (r: Ramp, i: number, d = 0): PaletteName => r[clampI(i + d, r.length)];

/** Map a 0..1 brightness level (1 = lightest) to the nearest ramp entry. */
export const quantize = (level: number, r: Ramp): PaletteName =>
  r[clampI((1 - level) * (r.length - 1), r.length)];
