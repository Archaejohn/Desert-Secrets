# Biome Cliff/Plateau Terrain Sets — Design (Spec A)

**Date:** 2026-07-20
**Status:** design, awaiting owner review
**Follow-on:** Spec B — runtime placement / elevation autotiler (not this spec)

## 1. Goal

Bring every **natural-terrain biome** up to the desert's cliff/plateau
treatment by running each biome's material through the existing
`generateTerrain` / `blob47` pipeline, re-skinned. Each biome gets **full
parity with the desert set**: fills + shaded vertical `wallFace` + directional
cliff (rim/face/footer) + 47-tile plateau blob edges + terrain pairings +
straight ramps (slope + steps) + the three-angle diagonal stair/ramp flights
(45° / 26.57° / 63.43°, both materials, both directions).

This spec (**A**) delivers the biome tile **sets**: generalize the generator,
bake a per-biome sheet, sha-pin it, and produce an offline **review scene per
biome** for owner sign-off. It matches the owner's requirement: "I want example
scenes with each type as it is done."

**Runtime placement is explicitly out of scope here** — reading elevation from
map data, computing blob masks at runtime, wiring the sheets into
`BootScene`/`ZoneScene`, and placing tiles in real maps is one system that
lights up every biome (including the desert, which is *already* baked-but-
unplaced). It becomes **Spec B** (and is the foundation of the terrain-shaper
editor).

**Buildings are out of scope** — the man-made walls (`townWall*`,
`stationWall`, `campWall`, pizzeria interior, mine timbers, gas pumps) are a
separate later effort. This spec is only the natural terrain that plays the
same role as *cliff* and *sand* do in the desert.

## 2. Current state (facts the design rests on)

- The desert cliff generator (`tools/pipeline/src/cliffs/`) already produces
  the full rock-on-sand set — 370 named tiles baked into `cliff.png`, sha-pinned
  in `tests/pipeline/determinism.test.ts`.
- It is **bake-only**: not preloaded in `BootScene`, referenced by no map. No
  runtime autotiler places blob-mask cliff tiles from elevation data. (This is
  why runtime is a separate spec.)
- The generator is **already parametric** on `material` and the terrain
  `pairings`/`plateauTop`/`ground` (`TerrainParams` in `generate.ts`). The only
  thing hardcoded to rock/sand is *inside* `materials.ts` (the `ROCK` ramp),
  `ramps.ts`, and `diagonalRamps.ts`.
- The review renderer (`render-cliff-review.mts`) builds its demo scene directly
  from `generateTerrain(preset)` — **not** from the baked sheet — so a biome
  review scene needs only palette + material + preset; it does not wait on
  baking.

## 3. Locked decisions (with owner)

1. **Engine:** full cliff/plateau (`blob47`), not the lightweight `dressMap`
   Cap+Face.
2. **Scope:** natural-terrain biomes only; buildings later.
3. **This spec = tile sets + review scenes.** Runtime placement = Spec B.
4. **Per biome: full parity with desert** — including the three-angle diagonal
   flights.
5. **Per-biome sheets** (`cliffIce.png`, `cliffReef.png`, …), each baked +
   sha-pinned, **no runtime wiring**. Desert `cliff.png` stays byte-identical.
6. **Order:** ice → reef → lava → grove/cave → sea. Ice is built end-to-end
   first for sign-off; the rest follow the same groove.

## 4. The biome abstraction

Everything the desert preset hardcodes to rock/sand becomes biome-supplied. A
biome cliff is defined by:

- a **wall ramp** (light→dark `PaletteName[]`, the material's stone),
- one or more **ground terrain keys** + ramps (the plateau top / ground / blob
  pairings),
- a **slope-ramp material** (the biome ground poured as an eased incline) and a
  **stair material** (carved steps),
- **preset knobs** — inherited from the desert defaults unless a biome needs a
  deliberate change.

### 4.1 Geometry vs. texture — what is shared, what varies

Two things are cleanly separable:

- **Geometry** — the 15 directional cliff tiles, the 47-mask blob autotile, the
  ramp eased-incline profile, and the diagonal-flight lattice are **material-
  independent**: shapes keyed to tile position, not color. They are shared by
  every biome unchanged. The M0 refactor's acceptance test (desert output
  byte-identical, §8) proves this stays true.
- **The wall-face *texture*** — the pixels stamped into the cliff face, footer,
  and (by absolute-screen-position sampling) the diagonal-flight solid bodies —
  **is fully per-biome.** `wallFace(material)` already switches per material, so
  a material can supply its own drawing code, not just its own ramp. Change the
  face and it propagates everywhere the face is sampled, for free.

### 4.2 Texture tiers (owner decision: "bespoke where it matters")

Each biome's wall texture sits at one of three tiers:

1. **Recolor** — the shared stacked-stone algorithm with a new palette ramp.
2. **Structure-tuned** — the shared algorithm with per-biome `WallParams`
   (`courses/blockSize/blocksPerCourse/stagger/tone/mortar/orderVsRandom`): big
   low-mortar blocks → glacial masonry, tall narrow blocks → columnar rock,
   chunky high-chaos → rough cave rock. **No new code**, per-preset.
3. **Bespoke** — a new `wallFace` branch: a genuinely different material
   algorithm authored as pixel art (the way the original cliff stone was).

**Decision:** every biome defaults to **tier 2** (distinct stone character via
params). Biomes whose material is fundamentally *not* stacked stone get a
**tier-3 bespoke** face — **ice** (crystalline/faceted glacier), **lava**
(cracked basalt crust with ember glow in the fissures — the building
generator's Worley-lava recipe is a proven starting point), and **reef**
(coral-encrusted organic rock). **Grove/cave** and **sea** stay tier 2 (rough
stacked stone reads as cave rock; cooler regular ashlar reads as sunless-sea
temple masonry). Tier-3 faces are real pixel-art work and are **Fable-assisted**
(the project convention for hard visual reworks).

The **ground fill** for each biome should read like that biome's *existing*
floor tile (tiles3 `iceFloor`, tiles7 `reefFloor`, tiles8 `emberFloor`, tiles6
`groveGrass`, tiles4 `floe`), not a recolored sand — its recipe is ported/
matched into `terrains.ts` `floorFill` per biome (tier 2–3 as the floor
warrants).

## 5. Generator generalization (files touched)

- **`cliffs/palette.ts`** — add a per-biome wall `Ramp` (§7); extend the
  `TerrainKey` union and `TERRAIN_RAMPS` with each biome's ground key(s).
- **`cliffs/materials.ts`** — extend the `MaterialKey` union with the biome
  materials; refactor `rockWallFace` → **`blockWallFace(ramp, params, seed)`**
  (the `ROCK_TOP/RIGHT/LEFT/GAP` role indices stay, but read from the passed
  ramp); `wallFace(material)` dispatches each material. `rock` and the **tier-2
  biomes** (grove, sea) route to `blockWallFace(ramp, params, …)` — same
  algorithm, biome ramp + biome `WallParams`. The **tier-3 biomes** (ice, lava,
  reef) each get their own bespoke `wallFace` branch (a new draw function beside
  `rockWallFace`), authored as pixel art. `rock` → `blockWallFace(ROCK, …)`
  stays byte-identical.
- **`cliffs/terrains.ts`** — `floorFill(key, seed)` gains a per-biome ground
  recipe that reads like the biome's existing floor tile (not recolored sand);
  tier 2–3 as the floor warrants.
- **`cliffs/ramps.ts`** — generalize `RampMaterial` and `rampTiles` so the
  slope pours the **biome ground ramp** and the steps use a **stair ramp** (a
  shared stone-steps ramp by default, or a biome variant). The terrain/wall
  ramps flow through as params (they already partly do).
- **`cliffs/diagonalRamps.ts`** — generalize `DiagonalMaterial` and the flight
  rendering to take the biome's ground + wall ramps. Same color-only swap as
  `materials.ts`; the lattice/piece geometry is untouched.
- **`cliffs/presets.ts`** — add one preset per biome mirroring
  `DESERT_ROCK_CLIFF`; export a `biome → presets` registry.
- **`cliffs/generate.ts`** — structurally unchanged (already composes from
  params). Names remain `cliff<Material>_<variant>_<band>`, `<ground>Fill`,
  `<plateauTop>Plateau_<mask>`, `<over><Base>_<mask>`, `dramp…`. Confirm each
  material's capitalized name yields distinct, sheet-safe tile names.

## 6. Baking, sheets, and review

### 6.1 Per-biome sheet
- **`cliffs/frames.ts`** — generalize `cliffSheetFrames`/`cliffTileNames` to take
  `(presets, columns)`; add a per-biome builder driven by the `biome → presets`
  registry, producing `cliff<Biome>Frames()` / `cliff<Biome>Names()`. Padding
  stays *derived* (`COLUMNS - real % COLUMNS`), never hardcoded.
- **`assets.ts` (`buildAssets`)** — compose each biome sheet (`cliffIce`,
  `cliffReef`, …) alongside the existing `cliff`.
- **`manifest.ts`** — register each biome sheet's name→index map.
- **`tests/pipeline/determinism.test.ts`** — pin each biome sheet's sha256
  (additive; the desert `cliff` pin is unchanged — that is the refactor's safety
  check).
- **`tests/pipeline/cliffs.test.ts`** — per-biome count/dimension assertions
  (mirroring the desert group-count checks).

Per-biome sheets (not one giant sheet) keep desert's `cliff.png` byte-identical,
keep each biome's frame indices independent, and match the per-act
`tiles*.png` convention.

### 6.2 Review renderer → a scene crop per biome
- **`render-cliff-review.mts`** — parametrize `buildScene(preset)`: derive the
  tile-name prefixes from the preset (`${ground}Fill`,
  `${plateauTop}Plateau_`, `cliff${Cap(material)}_`, the pairing names, the ramp
  names, and the diagonal materials from `preset.ramps`) instead of the
  hardcoded `sand…`/`cliffRock_`. Loop over the biome presets, emitting
  `.review/<biome>-scene.png` plus the three diagonal crops per biome. This is
  the human sign-off gate; it is a throwaway inspection script, not part of the
  deterministic build.

## 7. Per-biome palettes (concrete candidates)

Ramps are 8-slot light→dark `PaletteName[]` in the `ROCK` shape (roles: idx1
top, idx3 right plane, idx5 left plane, idx6 gap/mortar; idx0 the cap lit lip).
Ice is built concretely first; the others are strong starting ramps, **finalized
at each biome's review gate** (a biome that reads too close to a neighbor gets
nudged there). All names verified against `src/shared/palette.ts`.

| Biome | Material key | Wall ramp | Ground key | Ground ramp | Sheet |
|---|---|---|---|---|---|
| **Ice** | `glacier` | `["white","skyBlue","slate","slate","indigo","indigo","indigo","ink"]` | `ice` | `["white","skyBlue","slate","indigo"]` | `cliffIce.png` |
| **Reef** | `reefStone` | `["mint","jade","teal","teal","tealDeep","tealDeep","tealDeep","ink"]` | `reef` | `["mint","jade","teal","tealDeep"]` | `cliffReef.png` |
| **Lava** | `basalt` | `["stone","stoneDark","stoneDeep","stoneDeep","ink","ink","ink","ink"]` | `ember` | `["amber","rust","mauve","ink"]` | `cliffLava.png` |
| **Grove/cave** | `caveStone` | `["clay","rust","umber","umber","plum","plum","plum","ink"]` | `grove` | `["jade","teal","tealDeep","umber"]` | `cliffGrove.png` |
| **Sea** | `seaStone` | `["skyBlue","slate","indigo","indigo","tealDeep","tealDeep","tealDeep","ink"]` | `brine` | `["bone","skyBlue","slate","tealDeep"]` | `cliffSea.png` |

**Texture tier per biome** (§4.2): **ice** (crystalline glacier), **lava**
(cracked basalt + ember fissures), **reef** (coral-encrusted) are **tier-3
bespoke** faces, Fable-assisted. **Grove/cave** (rough chunky high-chaos blocks)
and **sea** (larger regular low-mortar ashlar) are **tier-2** — the shared
algorithm with these `WallParams` directions, ramp above.

Legibility note carried to the review gates: reef and grove both lean green;
ice and sea both lean cool blue. Each biome's scene is eyeballed against its
neighbors before its sha is pinned.

## 8. Build order / milestones

- **M0 — generalization refactor.** `palette`/`materials`/`ramps`/
  `diagonalRamps`/`presets`/`frames` refactored to the biome abstraction, with
  `rock`/`sand` routed through the generalized path. **Acceptance: desert
  `cliff.png` sha is unchanged** (the determinism pin does not move) — this
  proves the re-skin is color-only and byte-safe. No behavior change ships.
- **M1 — Ice (tier-3).** Bespoke `glacier` `wallFace` (crystalline, Fable-
  assisted) + `ice` ground fill + `ICE_CLIFF` preset + full parity tiles +
  `cliffIce.png` baked + sha pinned + `ice-scene.png` review → **owner sign-off**
  → PR merge. As the first tier-3 biome it also proves the bespoke-face path end
  to end.
- **M2–M5 — Reef (tier-3), Lava (tier-3), Grove (tier-2), Sea (tier-2).** Same
  groove, one biome per PR. Tier-3 biomes include a bespoke `wallFace`
  authoring/review step (Fable); tier-2 biomes are a preset + `WallParams` +
  ground-fill recipe. Each ships with its review scene and sign-off before its
  sha is pinned.

Each milestone is its own branch → PR → regular merge commit into `main`
(per the project git flow).

## 9. Verification bar (every milestone)

- `tsc --noEmit`
- `vitest run` — determinism pins (desert unchanged + new biome pinned), cliffs
  count/dim asserts, plus the untouched `dressing`/`maps` suites stay green.
- `npm run build`
- `npm run smoke` (unaffected — nothing runtime-wired yet, but it must stay
  green).
- The biome's `.review/<biome>-scene.png` eyeballed and approved **before** its
  sha is pinned.

## 10. Risks & notes

- **Diagonal-flight generalization is the heaviest piece.** The flights encode a
  lattice tuned around tile geometry, not color; the re-skin must be color-only.
  M0's byte-identical-desert check is what guards against an accidental
  geometry change.
- **Tile-name namespace (Spec B concern, noted now).** The generator emits
  `<ground>Fill` etc.; reusing a semantic ground name is the desert precedent
  (`sand` → `sandFill`, distinct from tiles1's `sand`). At runtime (Spec B),
  `ZoneScene.tileGid` probes sheets in order and takes the first match, so the
  biome sheet names must stay globally unique across sheets — the `Fill`/
  `Plateau_`/`cliff<Material>_`/`dramp…` suffixes already guarantee that. No
  action in Spec A beyond keeping names consistent.
- **Ramp reuse.** Where two biomes share a slope/steps recipe, the stair
  material can be shared (generic stone steps) to cut tile count; the slope is
  always the biome's own ground.

## 11. Out of scope (this spec)

- Runtime placement, elevation data model, `BootScene`/`ZoneScene` wiring, map
  edits (Spec B).
- The terrain-shaper editor UI (Spec B / later).
- Buildings and the building generator (separate effort).
