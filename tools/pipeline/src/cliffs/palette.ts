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

/** Rock face ramp: lightest (lit block top) to darkest (deep gap/shadow).
 *  Cool blue-grey navy stone (matches the reference cliff): light course
 *  streaks over a dark navy body. NOTE: 8 slots, 5 distinct colours — slots
 *  4-6 intentionally alias `stoneDeep` (the index arithmetic is carried over
 *  from the prototype; the dark end just has fewer distinct steps).
 *  Index roles (materials.ts): 1=block top,
 *  3=right plane, 5=left plane, 6=gap/mortar. */
export const ROCK: Ramp = ["stoneLit", "stone", "stoneDark", "stoneDark", "stoneDeep", "stoneDeep", "stoneDeep", "ink"];

/** Glacial ice cliff ramp: white lit facets → deep indigo shadow. */
export const ICE: Ramp = ["white", "skyBlue", "slate", "slate", "indigo", "indigo", "indigo", "ink"];

export type TerrainKey = "sand" | "frostSand" | "asphalt" | "ice";

export const TERRAIN_RAMPS: Record<TerrainKey, Ramp> = {
  // Calm, low-contrast warm sand — no `amber` (its orange read as busy noise).
  // Distinct entries (idx3 `umber` is the darker outline/edge step).
  sand: ["sandLight", "sand", "sandShade", "umber"],
  frostSand: ["bone", "sandLight", "skyBlue", "sandShade"],
  asphalt: ["slate", "indigo", "plum", "ink"],
  ice: ["white", "skyBlue", "slate", "indigo"],
};

const clampI = (i: number, n: number): number => Math.max(0, Math.min(n - 1, Math.round(i)));

/** Look up a ramp entry at `index + delta`, clamped to the ramp's ends. */
export const shade = (r: Ramp, i: number, d = 0): PaletteName => r[clampI(i + d, r.length)];

/** Map a 0..1 brightness level (1 = lightest) to the nearest ramp entry. */
export const quantize = (level: number, r: Ramp): PaletteName =>
  r[clampI((1 - level) * (r.length - 1), r.length)];
