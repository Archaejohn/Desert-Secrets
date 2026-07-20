# Lava Biome (`cliffLava`) — Design

**Date:** 2026-07-20
**Status:** approved (design), pending spec review → plan

## 1. Goal

Add the **lava/volcanic** biome to the cliff/plateau generator at full desert
parity — the next biome in the build order (ice → reef → **lava** → grove → sea).
Four volcanic ground types that all autotile with each other, baked into a new
`cliffLava.png` sheet, plus a tier-3 bespoke basalt-with-molten-fissures wall
face. Same architecture as the reef M2 build (see
`2026-07-20-biome-cliff-terrain-sets-m2-reef.md` for the mechanical sheet-plumbing
detail this doc doesn't repeat).

Grounded in the in-game volcanic zone (`tileset8`: `emberFloor`, `ashFloor`,
`lavaCrust`, `lavaVent`, `basaltWall`), which appears in **Act 7** (La Pizzeria
Sotterranea, "lit by lava vents"). Lands on the CURRENT 25-color palette (the
AAP-64 migration re-colors it later); the palette already has the warm tones
(`rust`, `clay`, `amber`, `hpRed`, `atbGold`) + a full `stone→stoneDeep`/`ink`
range for basalt.

## 2. Scope

- **In scope:** new `MaterialKey` (`basaltRock`) + bespoke Worley-lava wall face;
  new `TerrainKey`s + ramps + `floorFill` recipes; `LAVA_CLIFF` preset (all-pairs);
  bake `cliffLava.png`; sheet plumbing; owner review; pin.
- **Out of scope (deferred):** wiring `cliffLava` into real zones (Act 7 keeps
  `tileset8`). Same "no runtime wiring" rule reef/ice followed.
- **Byte-identical:** desert (`cliff`), ice (`cliffIce`), reef (`cliffReef`) MUST
  NOT change — lava is purely additive (new material/terrains/preset/sheet).

## 3. Ground types & naming

Four grounds, unprefixed keys (matching ice/reef convention):

| Key | Role | Reads like (tileset8) |
|---|---|---|
| `emberRock` | base dark basalt floor w/ faint ember glow — `plateauTop` + `ground` | `emberFloor` |
| `ash` | pale grey ash drift | `ashFloor` |
| `lava` | vivid molten flow | `lavaVent` |
| `lavaCrust` | cooling black crust, red fissures | `lavaCrust` |

## 4. Palette ramps

4-slot light→dark, palette-locked (`cliffs/palette.ts` `TERRAIN_RAMPS`). Directional
starting values; final look tuned at the bake/review gate.

- `emberRock`: `["clay", "rust", "stoneDeep", "ink"]` — warm dark basalt, low-contrast background
- `ash`: `["bone", "sandShade", "stone", "stoneDark"]` — pale grey-tan drift
- `lava`: `["atbGold", "amber", "hpRed", "rust"]` — molten gold-core → orange → deep red
- `lavaCrust`: `["hpRed", "rust", "stoneDeep", "ink"]` — dark crust with red glowing fissures

Extend the `TerrainKey` union with the four new keys.

## 5. floorFill recipes (`cliffs/terrains.ts`)

Per-ground `floorFill` branch, same fleck pattern as reef/ice grounds (body = ramp
idx1, sparse light fleck = idx0, sparse dark fleck = idx2/3, via `h2`; deterministic,
palette-locked). Match each to its tileset8 look:

- `emberRock`: dark basalt body with sparse ember-glow flecks (ramp[0], warm) — the
  low-contrast background floor.
- `ash`: smooth pale grey drift, low fleck density (like `snow`).
- `lava`: fbm-mottled molten body (ramp[1]/ramp[2]) with generous bright gold glow
  highlights (ramp[0]) — the brightest, most saturated ground.
- `lavaCrust`: dark crust body (ramp[2]/ramp[3]) with sparse red fissure flecks
  (ramp[0], glowing).

## 6. Pairings — all four autotile with each other

`LAVA_CLIFF.pairings` (`cliffs/presets.ts`). Priority `emberRock < ash < lava <
lavaCrust`; `over` = lower-priority field, `base` = higher-priority ground carved in.
`emberRock`-self first; the 6 cross-pairs appended (additive):

```
{ over: "emberRock", base: "emberRock" }   // self — plateau/ledge
{ over: "emberRock", base: "ash" }
{ over: "emberRock", base: "lava" }
{ over: "emberRock", base: "lavaCrust" }
{ over: "ash",       base: "lava" }
{ over: "ash",       base: "lavaCrust" }
{ over: "lava",      base: "lavaCrust" }
```

7 pairings total (1 self + 6 cross). Flip a pair's over/base to swap seam ownership.

## 7. Seam character & tuning

Organic/flowing (higher irregularity) to suit molten lava/ash drift:
`edgeInset: 2`, `cornerRounding: 8`, `pocketRounding: 8`, `edgeIrregularity: ~18`.
Starting values; tuned live in the seam-rounding tuner at the review gate (same flow
reef/ice used). `pairingSeed` available if seams are tuned without disturbing the
seed-driven basalt wall face.

## 8. Wall face — bespoke tier-3 `basaltRock`

Dark basalt fractured by glowing molten fissures. Built on the **Worley-lava recipe**
already in the codebase (`tileset8` / `cliffs/generate.ts`) as the proven starting
point: packed dark basalt cells (`stone`/`stoneDark`/`stoneDeep`/`ink`) with molten
fissures glowing along the cell boundaries (`hpRed`/`amber`/`atbGold`), the inverse
of the reef bio-rock and ice glacier faces.

- `materials.ts`: `MaterialKey` += `"basaltRock"`; a bespoke `basaltRockWallFace`
  draw function; route `case "basaltRock"`.
- `palette.ts`: add a `LAVA` wall ramp (8-slot, dark basalt → molten glow).
- `generate.ts`: extend the `faceRamp` conditional to `p.material === "basaltRock"
  ? LAVA : …` (desert/ice/reef paths unchanged).
- Fable-authored, iterated against `.review/lava-scene.png`, owner sign-off before pin.

## 9. New sheet `cliffLava.png` + plumbing

Mirrors the reef `cliffReef` sheet exactly (M2 R2). New sheet key appended, never
reordered:

- `frames.ts`: `cliffLavaSheetFrames` / `cliffLavaTileNames` via the existing
  `(presets)` helpers.
- `assets.ts`: append `cliffLava` to `SHEET_KEYS` + composition (`composeSheet(…, 8)`).
- `manifest.ts`: `cliffLava` entry.
- `index.ts`: append `["cliffLava.png", assets.cliffLava]` to the writer array.
- `presets.ts`: `LAVA_CLIFF` + export `LAVA_PRESETS`.
- `render-cliff-review.mts`: add `{ label: "lava", params: LAVA_PRESETS[0] }` to
  VARIANTS + a lava ground-transition demo block (mirror the reef/ice blocks).

Preset otherwise mirrors `REEF_CLIFF`: `plateauTop`/`ground` = `emberRock`,
`ramps: ["sandSlope", "stoneSteps"]`, `diagonalRamps: true`, tier-2 WallParams as a
structural placeholder under the bespoke face, `seed` (new, e.g. `8888`).

**Expected tile count** (confirm on first bake): 4 fills + 15 cliff + 47 plateau +
7×47 pairings (329) + 32 ramps + 132 diagonals = **559** (same as reef). Reconcile
to the actual number.

## 10. Determinism & tests

- New `cliffLava` pin in `tests/pipeline/determinism.test.ts`.
- `tests/pipeline/cliffs.test.ts`: lava preset structure (per-pairing counts 47 each,
  4 fills, `cliffBasaltRock_` = 15, `emberRockPlateau_` = 47, total 559) + sheet
  structure (8-col, manifest-consistent).
- Desert (`cliff`), ice (`cliffIce`), reef (`cliffReef`) verified byte-identical.

## 11. Verification

`npx tsc --noEmit`, `npx vitest run` (desert/ice/reef pins unchanged; lava pinned;
count asserts), `npm run build`, `npm run smoke`. Owner review of
`.review/lava-scene.png` at the wall-face gate and the seam-tuning gate before pins.
