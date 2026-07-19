/**
 * Named `TerrainParams` configs. Phase 1 authors the desert preset(s) for
 * US-95 / the homestead / Piggy's trail: `rock` cliff face, `sand` plateau
 * top and ground, with `sand`/`asphalt`/`frostSand` blob-edge pairings.
 * Every numeric knob mirrors the prototype's default slider values
 * (docs/prototypes/cliff-suite-v6.html:40-95, :160-168) — see `generate.ts`
 * for how each maps onto `wallFace`/`cliffTiles`/`blobTiles`.
 *
 * Authoring a new scene's terrain later is "write a preset, rebuild" — add
 * an entry here, never new generator code.
 */
import type { TerrainParams } from "./generate";

const DESERT_ROCK_CLIFF: TerrainParams = {
  material: "rock",

  // Wall structure (order ↔ randomness). "Boulder" treatment: chunky rounded
  // stones with lit tops on a cool navy body — reads as natural desert
  // sandstone/boulders (the upgrade from the flat `rock` boulders it replaces).
  courses: 3,
  blockSize: 3,
  blocksPerCourse: 3,
  stagger: 0.5,
  tone: 0.16,
  mortar: 0.28,
  orderVsRandom: 0.45,

  // Cliff assembly — prototype defaults.
  capBand: 4,
  capRoll: 0.45,
  capMaterial: "plateau",
  footer: 6,
  cliffHeight: 2,
  baseRounding: 3,
  topRounding: 3,
  outerCornerShade: 0.4,
  innerCornerDepth: 0.6,
  castShadow: 0.5,
  scree: true,
  litLip: true,

  // Floor blob edges — prototype defaults.
  edgeInset: 2,
  edgeIrregularity: 14,
  cornerRounding: 2,
  edgeOutline: true,
  dropShadow: true,
  linkPlateauCorners: true,

  // Terrain pairings — sand plateau/ground, sand transitions into asphalt
  // (road) and frostSand (oasis-adjacent) blob edges.
  pairings: [
    { over: "sand", base: "sand" },
    { over: "sand", base: "asphalt" },
    { over: "sand", base: "frostSand" },
  ],
  plateauTop: "sand",
  ground: "sand",

  seed: 1337,

  // Ramp materials (phase 1b) — a sand-slope incline and a carved-stone
  // stair set, both cut through this preset's rock cliff (generate.ts).
  ramps: ["sandSlope", "stoneSteps"],
};

export const DESERT_PRESETS: TerrainParams[] = [DESERT_ROCK_CLIFF];
