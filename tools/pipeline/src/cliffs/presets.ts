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
  // Enable diagonal ramps (phase 1c)
  diagonalRamps: true,
};

export const DESERT_PRESETS: TerrainParams[] = [DESERT_ROCK_CLIFF];

// Ice cliff — mirrors DESERT_ROCK_CLIFF's cliff assembly/floor-edge defaults
// with ice material/terrain and tier-2 wall params (bigger, lower-mortar
// blocks read as glacial masonry). The `glacier` wall face is a placeholder
// recolor of `blockWallFace` (materials.ts) until Task 8's bespoke
// crystalline face.
const ICE_CLIFF: TerrainParams = {
  material: "glacier",

  // Wall structure — tier-2: larger low-mortar blocks.
  courses: 3,
  blockSize: 4,
  blocksPerCourse: 2,
  stagger: 0.5,
  tone: 0.12,
  mortar: 0.15,
  orderVsRandom: 0.3,

  // Cliff assembly — desert defaults.
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

  // Floor blob edges — desert defaults.
  edgeInset: 2,
  edgeIrregularity: 14,
  cornerRounding: 2,
  edgeOutline: true,
  dropShadow: true,
  linkPlateauCorners: true,

  // Terrain pairings — ice over ice.
  pairings: [{ over: "ice", base: "ice" }],
  plateauTop: "ice",
  ground: "ice",

  seed: 2026,

  ramps: ["sandSlope", "stoneSteps"],
  diagonalRamps: true,
};

export const ICE_PRESETS: TerrainParams[] = [ICE_CLIFF];

// Reef cliff — mirrors ICE_CLIFF's cliff-assembly/floor-edge defaults with
// the reef material/terrains and four ground pairings (reefFloor, reefSilt,
// reefWater, glowMoss). The `coralRock` wall face is a placeholder recolor
// of `blockWallFace` (materials.ts) until the next task's bespoke coral
// face (renamed from `reefStone` in R3a to avoid clashing with tileset7's
// own unrelated `reefStone` tile).
const REEF_CLIFF: TerrainParams = {
  material: "coralRock",

  // Wall structure — tier-2 placeholder (bespoke face replaces the look).
  courses: 3,
  blockSize: 3,
  blocksPerCourse: 3,
  stagger: 0.5,
  tone: 0.16,
  mortar: 0.24,
  orderVsRandom: 0.4,

  // Cliff assembly — mirrors ICE_CLIFF (== desert defaults).
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

  // Floor blob edges — reef ground-to-ground seams, tuned live by the owner
  // in the seam-rounding tuner. Wider band than desert/ice (edgeInset 3) with
  // heavy organic wobble (edgeIrregularity 20). Corner rounding is DECOUPLED
  // into two knobs (see overlayMask): `cornerRounding` rounds the patches'
  // INNER (concave) corners via a quarter-disc scoop; `pocketRounding` rounds
  // their OUTER (convex) corners via the concave-pocket exponent (>=5 ==
  // circular). Both maxed at 8 here: at this irregularity the edge wobble
  // dominates the corner geometry, so the seams read as organic reef fingers
  // rather than the over-scooped hard steps a high cornerRounding produces on
  // a clean straight edge. `pairingSeed` reseeds ONLY the ground-transition
  // blobs (7439, owner-tuned wobble) — the base `seed` (7777) still drives the
  // approved coral wall face / ramps, so those stay byte-identical.
  edgeInset: 3,
  edgeIrregularity: 20,
  cornerRounding: 8,
  pocketRounding: 8,
  pairingSeed: 7439,
  edgeOutline: true,
  dropShadow: true,
  linkPlateauCorners: true,

  // Terrain pairings — reef floor plateau/ground, with reefFloor transitioning
  // into reefSilt, reefWater, and glowMoss blob edges.
  pairings: [
    { over: "reefFloor", base: "reefFloor" },
    { over: "reefFloor", base: "reefSilt" },
    { over: "reefFloor", base: "reefWater" },
    { over: "reefFloor", base: "glowMoss" },
    // All four grounds autotile with each OTHER, not just against reefFloor
    // (owner requirement). Priority order reefFloor < reefSilt < reefWater <
    // glowMoss: `over` = the lower-priority "field", `base` = the higher-
    // priority ground carved into it at the seam. Appended AFTER the reefFloor
    // pairings so the existing tile order/indices are unchanged (additive).
    // Flip a pair's over/base to swap which ground owns that seam.
    { over: "reefSilt", base: "reefWater" },
    { over: "reefSilt", base: "glowMoss" },
    { over: "reefWater", base: "glowMoss" },
  ],
  plateauTop: "reefFloor",
  ground: "reefFloor",

  seed: 7777,

  ramps: ["sandSlope", "stoneSteps"],
  diagonalRamps: true,
};

export const REEF_PRESETS: TerrainParams[] = [REEF_CLIFF];
