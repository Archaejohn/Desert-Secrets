# Biome Cliff Terrain Sets — M2 (Reef) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Reuses the M0/M1 machinery — see `2026-07-20-biome-cliff-terrain-sets-m0-m1.md` for the mechanical detail this plan doesn't repeat.

**Goal:** Add the **reef** biome to the cliff/plateau generator at full desert parity, with **four ground types** (reefFloor, reefSilt, reefWater, glowMoss) and their autotiled transition (pairing) sets, baked into `cliffReef.png` and sha-pinned, with a bespoke coral cliff face.

**Architecture:** Same as ice (M1): new ramps + terrains + preset + per-biome sheet + `faceRamp`, then a bespoke tier-3 face. The generator, `faceRamp` fix, ground-ramp diagonal threading, and per-biome sheet plumbing all already exist and are proven by ice.

## Global Constraints
- Palette-locked to `src/shared/palette.ts`; deterministic (`h2`/`fbm` only); additive-only.
- **Desert `cliff.png` AND `cliffIce.png` shas MUST NOT change** — reef is purely additive (new material/terrains/preset/sheet). Only a new `cliffReef` pin is added.
- Per-biome sheet `cliffReef.png`; append to `SHEET_KEYS`, the `index.ts` writer array, the manifest, and `determinism.test.ts` — never reorder.
- Reef is tier-3: bespoke `reefWallFace` (coral), authored via Fable, gated by owner review of the scene.

## Reef-specific data (concrete starting values; tuned at the review gate)

**Wall ramp** (`palette.ts`, 8-slot, placeholder before bespoke coral):
`REEF = ["mint","jade","teal","teal","tealDeep","tealDeep","tealDeep","ink"]`

**Ground `TerrainKey`s + `TERRAIN_RAMPS` (4-slot light→dark):**
- `reefFloor`: `["jade","teal","tealDeep","umber"]` (deep coral-green floor; plateau top + main ground)
- `reefSilt`: `["sandLight","sandShade","umber","ink"]` (pale sediment)
- `reefWater`: `["skyBlue","teal","tealDeep","indigo"]` (reef water, shallow→deep)
- `glowMoss`: `["mint","jade","teal","tealDeep"]` (bright glowing moss)

**Preset `REEF_CLIFF` (`presets.ts`), mirror of `ICE_CLIFF`:**
- `material: "reefStone"`, `plateauTop: "reefFloor"`, `ground: "reefFloor"`
- `pairings: [{over:"reefFloor",base:"reefFloor"}, {over:"reefFloor",base:"reefSilt"}, {over:"reefFloor",base:"reefWater"}, {over:"reefFloor",base:"glowMoss"}]`
- `ramps: ["sandSlope","stoneSteps"]`, `diagonalRamps: true`, `seed: 7777`
- Cliff-assembly + floor-edge knobs: copy `ICE_CLIFF`'s. Tier-2 WallParams as a placeholder (bespoke face replaces the look): `courses:3, blockSize:3, blocksPerCourse:3, stagger:0.5, tone:0.16, mortar:0.24, orderVsRandom:0.4`.
- Export `REEF_PRESETS = [REEF_CLIFF]`.

**Material + faceRamp:** `MaterialKey` += `"reefStone"`; `wallFace` case `"reefStone"` → `blockWallFace(REEF, params, seed)` (placeholder). `generate.ts` faceRamp conditional extends to `p.material === "reefStone" ? REEF : …` (keep desert/ice paths unchanged).

**Sheet:** `cliffReef.png`. Names: `cliffReefStone_*` (capitalize("reefStone")="ReefStone"), `reefFloorPlateau_*`, `reefFloorReefFloor_*`/`reefFloorReefSilt_*`/`reefFloorReefWater_*`/`reefFloorGlowMoss_*`, `reefFloorFill`/`reefSiltFill`/`reefWaterFill`/`glowMossFill`, ramps, dramps.

**Expected tile count** (confirm on first run; 4 pairings): 4 fills + 15 cliff + 47 plateau + 4×47 pairings (188) + 2×16 ramps (32) + diagonal (16+16+28+28+22+22 = 132) = **418**. Reconcile the test to the actual number.

## Tasks

### Task R1 — Reef data + preset + placeholder material + scree faceRamp fix (TDD)
**Files:** `palette.ts` (REEF ramp; 4 ground keys + TERRAIN_RAMPS), `terrains.ts` (a `floorFill` branch per reef ground — placeholder recipes: body idx1 + sparse idx0 light fleck + sparse idx2 dark fleck via `h2`, palette-locked to that ground's ramp), `materials.ts` (`MaterialKey` += `reefStone`; placeholder case), `presets.ts` (`REEF_CLIFF` + `REEF_PRESETS`), `generate.ts` (import `REEF`; extend faceRamp conditional), `cliffFace.ts` (the scree fix), `tests/pipeline/cliffs.test.ts`.

**Scree faceRamp fix (folded in here):** `cliffFace.ts:213-214` (the scree-pebble band) hardcodes `ramp = ROCK`, so a biome cliff with `scree:true` gets ROCK-gray pebbles at its base (visible on ice, would recur on reef). Change that scree `ramp` to use the passed `faceRamp` (which already defaults to `ROCK`). Desert (faceRamp→ROCK) stays byte-identical; **ice `cliffIce.png` bytes will change** (ice-colored scree now) → re-pinned in R2's bake. Verify no OTHER hardcoded `ROCK` remains in `cliffFace.ts`'s per-biome-colored bands.
- Test: each reef ground `floorFill(key)` is palette-locked to its ramp + deterministic; `generateTerrain(REEF_PRESETS[0])` emits the expected per-group counts (`cliffReefStone_`=15, `reefFloorPlateau_`=47, each of the 4 `reefFloor<Base>_`=47, 4 fills, `drampSand2657_`=28), all names unique, total = 418 (reconcile to actual).
- Desert + ice determinism must stay green (this task doesn't bake). Commit.

### Task R2 — Bake `cliffReef.png` + pin + review scene
**Files:** `frames.ts` (`cliffReefSheetFrames`/`cliffReefTileNames` via the existing `(presets)` helpers), `assets.ts` (append `cliffReef` to `SHEET_KEYS` + composition), `manifest.ts` (`cliffReef` entry), `index.ts` (append `["cliffReef.png", assets.cliffReef]` to the writer array), `tests/pipeline/cliffs.test.ts` (cliffReef structure), then `npm run art`, then `determinism.test.ts` (add `cliffReef` pin), then `render-cliff-review.mts` (add `{label:"reef", params: REEF_PRESETS[0]}` to VARIANTS).
- Verify `cliff.png` (desert) byte-identical. **`cliffIce.png` WILL change** (the R1 scree fix) — re-pin its sha. Add the new `cliffReef` pin. `manifest.json` additive. Full suite + build green.
- Render `.review/reef-scene.png` — **owner review gate**. Commit.

### Task R3 — Bespoke coral `reefWallFace` (Fable) + reef floor tuning
**Files:** `materials.ts` (`reefWallFace` bespoke branch; route `case "reefStone"`), `terrains.ts` (enrich the reef ground recipes as the review warrants), re-`npm run art`, re-pin `cliffReef`.
- Coral-encrusted reef rock: knobbly organic growth, `mint`/`jade` lit highlights, `teal`/`tealDeep` body, `indigo`/`ink` crevices; palette-locked to the reef family, deterministic, seamless, full-tile. Fable-authored, iterated against `.review/reef-scene.png`, owner sign-off, re-pin. Desert + ice byte-identical throughout.

## Verification (every task)
`npx tsc --noEmit`, `npx vitest run` (desert + ice pins unchanged; reef pinned; count asserts), `npm run build`. Owner scene sign-off at R2 and R3 before pinning.
