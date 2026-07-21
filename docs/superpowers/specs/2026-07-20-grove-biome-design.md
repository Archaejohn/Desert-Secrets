# Grove/Cave Biome (`cliffGrove`) — Design

**Date:** 2026-07-20
**Status:** approved (design), pending plan

## 1. Goal

Add the **grove/cave** biome to the cliff generator at desert parity — the next
biome in the build order (ice → reef → lava → **grove** → sea). Four grounds that
all autotile, a new `cliffGrove.png` sheet, and a **bespoke tier-3** damp-cave-stone
wall face (dripping water + sparse moss). Same architecture as the lava M-lava build
(commit `3009419`); this doc doesn't repeat the mechanical sheet-plumbing detail
(see the lava plan `2026-07-20-lava-biome.md`).

Grounded in the in-game grove (`tileset6`: `groveGrass`, `groveMoss`, `groveWater`,
`sunbeam`; `dressing.ts` grove transitions) and Act 5 (the Sunlit Cave-In — a lush
mine chamber with an underground spring/river, cave-in sunlight, one orange tree).
Lands on the CURRENT palette (greens `jade/mint/teal/tealDeep`, water
`skyBlue/teal/indigo`, earth `clay/umber/stone*`).

## 2. Scope

- **In scope:** new `MaterialKey` (`groveStone`) + bespoke damp-cave wall face; new
  `TerrainKey`s + ramps + `floorFill` recipes; `GROVE_CLIFF` preset (all-pairs); bake
  `cliffGrove.png`; sheet plumbing; owner review gates; pin.
- **Out of scope (deferred):** wiring `cliffGrove` into real zones (Act 5 keeps
  `tileset6`). Same "no runtime wiring" rule the other biomes followed.
- **Byte-identical:** desert (`cliff`), ice (`cliffIce`), reef (`cliffReef`), lava
  (`cliffLava`) MUST NOT change — grove is purely additive.

## 3. Ground types & naming

| Key | Role | Reads like |
|---|---|---|
| `groveGrass` | base lush grass — `plateauTop` + `ground` | `tileset6 groveGrass` |
| `groveMoss` | denser, darker, spotted moss on darkened soil | `groveMoss` |
| `groveWater` | spring / underground river | `groveWater` |
| `groveSoil` | bare earth / path | (Act 5 grove floor) |

## 4. Palette ramps (current palette; directional — tuned at gate)

- `groveGrass`: `["mint", "jade", "teal", "tealDeep"]` — bright, lush; body `jade`
- `groveMoss`: `["jade", "teal", "umber", "ink"]` — **darker body (`teal`) than grass,
  with `umber` (darkened `groveSoil`) as the dark showing between moss clumps**
- `groveWater`: `["skyBlue", "teal", "tealDeep", "indigo"]` — spring water
- `groveSoil`: `["clay", "umber", "stoneDeep", "ink"]` — warm dark earth

Extend the `TerrainKey` union with the four new keys.

## 5. floorFill recipes (`cliffs/terrains.ts`) — owner direction

- `groveGrass`: mottled `jade`/`teal` body (ramp[1]/ramp[2]) with sparse bright `mint`
  highlights (ramp[0]); smooth and lush, LOW fleck density.
- `groveMoss`: **darker and MORE spotted than grass** — a dark `umber` soil base
  (ramp[2]) showing between generous mottled green moss clumps (`teal` ramp[1] /
  `jade` ramp[0]), plus rare `ink` deep shadow (ramp[3]). Reads as moss growing on
  darkened earth (per owner: "moss spots with darkened groveSoil under it").
- `groveWater`: fbm-mottled `teal`/`tealDeep` body with sparse `skyBlue` ripples (ramp[0]).
- `groveSoil`: mottled `umber`/`stoneDeep` earth body with sparse `clay` light grit
  (ramp[0]) and rare `ink` specks (ramp[3]).

## 6. Pairings — all four autotile

`GROVE_CLIFF.pairings`. Priority `groveGrass < groveMoss < groveWater < groveSoil`;
`over` = lower-priority field. `groveGrass`-self first, 6 cross-pairs appended (additive):

```
{ over: "groveGrass", base: "groveGrass" }
{ over: "groveGrass", base: "groveMoss" }
{ over: "groveGrass", base: "groveWater" }
{ over: "groveGrass", base: "groveSoil" }
{ over: "groveMoss",  base: "groveWater" }
{ over: "groveMoss",  base: "groveSoil" }
{ over: "groveWater", base: "groveSoil" }
```

## 7. Seam character & tuning

Organic/flowing to suit the lush grove: `edgeInset: 2`, `cornerRounding: 8`,
`pocketRounding: 8`, `edgeIrregularity: 18`. Tuned live at the review gate.

## 8. Wall face — bespoke tier-3 `groveStone`

Owner direction: **dripping water + sparse moss** — more than a plain block wall, so
a bespoke draw like the lava basalt face:

- Dark damp **cave stone** body (`stoneDark`/`stoneDeep`/`ink`).
- **Vertical water-drip streaks** running down the face (`skyBlue` core → `mint`
  glint), a few per tile, per-column via tiling 1D noise so they seam side-to-side.
- **Sparse moss patches** (`jade`/`teal`) crusting ledges/streak edges.
- `materials.ts`: `MaterialKey` += `"groveStone"`; bespoke `groveStoneWallFace` draw
  fn; route `case "groveStone"`.
- `palette.ts`: `GROVE` wall ramp (8-slot, light water/moss → dark stone), e.g.
  `["mint", "skyBlue", "jade", "teal", "stoneDark", "stoneDeep", "tealDeep", "ink"]`.
- `generate.ts`: extend the `faceRamp` conditional to `... : p.material ===
  "groveStone" ? GROVE : undefined`.
- Palette-locked to `GROVE`, deterministic, seamless, full-tile. Owner review gate.

## 9. New sheet `cliffGrove.png` + plumbing

Mirrors `cliffLava` exactly (frames/assets/manifest/index writer/determinism pin +
`GROVE_CLIFF`/`GROVE_PRESETS`, and a grove transition demo in `render-cliff-review.mts`).
Preset mirrors `LAVA_CLIFF`: `plateauTop`/`ground` = `groveGrass`,
`ramps: ["sandSlope", "stoneSteps"]`, `diagonalRamps: true`, tier-2 WallParams as a
structural placeholder under the bespoke face, `seed` (new, e.g. `9090`).

**Expected tile count** (confirm on bake): 4 fills + 15 cliff + 47 plateau + 7×47
pairings + 32 ramps + 132 diagonals = **559** (same as reef/ice/lava).

## 10. Determinism & tests

- New `cliffGrove` pin. `cliffs.test.ts`: grove preset structure (per-pairing counts
  47, 4 fills, `cliffGroveStone_`=15, `groveGrassPlateau_`=47, total 559) + sheet
  structure + `groveStone` face-ramp membership test.
- Desert/ice/reef/lava verified byte-identical.

## 11. Verification

`tsc`, `vitest` (all four prior pins unchanged; grove pinned; counts), `build`,
`smoke`. Owner review of `.review/grove-scene.png` at the wall-face gate and the
seam-tuning gate before pins.
