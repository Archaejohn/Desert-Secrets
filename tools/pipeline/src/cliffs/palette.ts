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

/** Reef bio-rock FACE ramp (R3b). This is purely the shading round-trip
 *  ramp for the bespoke `coralRockWallFace` (materials.ts): `cliffFace`
 *  re-quantizes every wall pixel through `REEF.indexOf(name)` and shifts
 *  along it, so it must (a) contain every colour the bespoke face emits
 *  and (b) run light→dark in true brightness order so darken/lighten
 *  shifts stay physical. mint (biolight, brightest) → skyBlue (lit
 *  corners) → slate (plates) → mauve (mid-tone) → plum (body) → indigo
 *  (x2, shadow buffer) → ink (deep shadow), matching tileset7's shipped
 *  `reefWall` material family. */
export const REEF: Ramp = ["mint", "skyBlue", "slate", "mauve", "plum", "indigo", "indigo", "ink"];

export type TerrainKey =
  | "sand"
  | "frostSand"
  | "asphalt"
  | "ice"
  | "reefFloor"
  | "reefSilt"
  | "reefWater"
  | "glowMoss"
  | "snow"
  | "frozenLake"
  | "rimeMoss";

export const TERRAIN_RAMPS: Record<TerrainKey, Ramp> = {
  // Calm, low-contrast warm sand — no `amber` (its orange read as busy noise).
  // Distinct entries (idx3 `umber` is the darker outline/edge step).
  sand: ["sandLight", "sand", "sandShade", "umber"],
  frostSand: ["bone", "sandLight", "skyBlue", "sandShade"],
  asphalt: ["slate", "indigo", "plum", "ink"],
  ice: ["white", "skyBlue", "slate", "indigo"],
  // Dark teal floor (R3a: matches shipped `reefFloor`/reefBase): plateau
  // top + main reef ground.
  reefFloor: ["teal", "tealDeep", "indigo", "ink"],
  // Dark indigo silt (R3a: matches shipped `reefSilt`).
  reefSilt: ["tealDeep", "indigo", "plum", "ink"],
  // Reef water, shallow -> deep (R3a: matches shipped `reefWater`).
  reefWater: ["skyBlue", "teal", "tealDeep", "indigo"],
  // Bright glowing moss (R3a: matches shipped `glowMoss`).
  glowMoss: ["mint", "jade", "teal", "tealDeep"],
  // Frozen biome grounds (light -> dark). Pale packed snow, deep cracked lake
  // ice, and a frozen glow-moss accent — all in the existing frost family.
  snow: ["white", "bone", "skyBlue", "slate"],
  frozenLake: ["skyBlue", "slate", "indigo", "ink"],
  rimeMoss: ["mint", "jade", "teal", "tealDeep"],
};

const clampI = (i: number, n: number): number => Math.max(0, Math.min(n - 1, Math.round(i)));

/** Look up a ramp entry at `index + delta`, clamped to the ramp's ends. */
export const shade = (r: Ramp, i: number, d = 0): PaletteName => r[clampI(i + d, r.length)];

/** Map a 0..1 brightness level (1 = lightest) to the nearest ramp entry. */
export const quantize = (level: number, r: Ramp): PaletteName =>
  r[clampI((1 - level) * (r.length - 1), r.length)];
