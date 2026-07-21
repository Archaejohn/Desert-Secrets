# Frozen Biome — Multi-Ground Expansion (Design)

**Date:** 2026-07-20
**Status:** approved (design), pending spec review → plan

## 1. Goal

Give the **frozen (ice) cliff biome** the same multi-ground treatment reef just
got: expand it from a single `ice` ground to **four frozen ground types that all
autotile with each other**, so Act 2's snow/glacier zones read with real surface
texture instead of one flat ice floor. Purely additive to the `cliffIce` biome
sheet — same pattern as the reef M2 all-pairs work (commit `05f4b1c`).

Act 2 is the glacier act (ice tunnels, the frozen mine Galleries, the frozen-lake
Sanctum). The in-game frozen tileset (`tileset3`) already establishes the surfaces
this biome should mirror: `iceFloor`, `snowdrift`, `lakeIce`/`lakeCrack`, `mossGlow`.

## 2. Scope

- **In scope:** generator-only. New `TerrainKey`s + ramps + `floorFill` recipes +
  `ICE_CLIFF` pairings; bake `cliffIce.png`; re-pin; add the new grounds to the
  ice review scene.
- **Out of scope (deferred):** wiring these cliff-generator frozen grounds into
  the actual Act 2 zones (which still render via `tileset3` + `dressing.ts`). Same
  "no runtime wiring" rule reef followed. Separate future pass.
- **Untouched:** the bespoke crystalline **glacier wall face** (grounds don't
  affect the wall). No new material/`MaterialKey`, no new sheet key.

## 3. Ground types & naming

Four grounds, unprefixed keys (matching the existing `ice` key convention):

| Key | Role | Reads like (tileset3) |
|---|---|---|
| `ice` | base glacial floor *(exists)* — `plateauTop` + `ground` | `iceFloor` |
| `snow` | packed snowdrift | `snowdrift` |
| `frozenLake` | cracked blue lake ice | `lakeIce` / `lakeCrack` |
| `rimeMoss` | frozen glow accent | `mossGlow` |

## 4. Palette ramps

4-slot light→dark, palette-locked to the frozen family (`cliffs/palette.ts`
`TERRAIN_RAMPS`). Available frozen palette: `white #ffffff`, `bone #fdf3da`,
`skyBlue #7fa8c9`, `slate #4f6d8f`, `indigo #3b3a63`, `mint #a8e0b0`,
`jade #55b087`, `teal #2f7f74`, `tealDeep #1f4e5a`, `ink #241827`.

- `ice`: `["white", "skyBlue", "slate", "indigo"]` — *exists, unchanged*
- `snow`: `["white", "bone", "skyBlue", "slate"]` — pale, warmer/brighter than ice
- `frozenLake`: `["skyBlue", "slate", "indigo", "ink"]` — deep blue, reads "below" the ice
- `rimeMoss`: `["mint", "jade", "teal", "tealDeep"]` — green glow (matches `mossGlow`)

Extend the `TerrainKey` union with the three new keys.

## 5. floorFill recipes (`cliffs/terrains.ts`)

Per-ground `floorFill` branch, same fleck pattern as the reef grounds (body =
ramp idx1, sparse light fleck = idx0, sparse dark fleck = idx2, via `h2`,
palette-locked to that ramp; deterministic). Match each to its tileset3 look:

- `snow`: smooth pale drift — low fleck density, bone/white body, minimal texture.
- `frozenLake`: skyBlue body with sparse darker (indigo/ink) short **crack** marks
  (evokes `lakeCrack`), not uniform speckle.
- `rimeMoss`: mint/jade body with brighter mint glow specks (mirrors reef `glowMoss`).

## 6. Pairings — all four autotile with each other

`ICE_CLIFF.pairings` (`cliffs/presets.ts`). Priority `ice < snow < frozenLake <
rimeMoss`; `over` = the lower-priority "field", `base` = the higher-priority ground
carved in at the seam. Existing `ice`-self stays first; the 6 cross-pairs are
**appended** so no existing tile index shifts (additive):

```
{ over: "ice",        base: "ice" }         // self (exists) — plateau/ledge
{ over: "ice",        base: "snow" }
{ over: "ice",        base: "frozenLake" }
{ over: "ice",        base: "rimeMoss" }
{ over: "snow",       base: "frozenLake" }
{ over: "snow",       base: "rimeMoss" }
{ over: "frozenLake", base: "rimeMoss" }
```

7 pairings total (1 self + 6 cross). Flip a pair's over/base to swap which ground
owns that seam.

**Junction caveat** (documented, not solved here): the 47-blob autotiler is binary
(one over + one base per tile), so a point where 3+ frozen grounds meet can't be
fully represented — handle by map-authoring convention (a 1-cell `ice` buffer)
when these are eventually wired in, not by adding tiles.

## 7. Seam character & tuning

Seam rounding is **preset-wide** (one setting for all frozen pairs). Default to
**crisp/faceted** to fit glacial ice, distinct from reef's soft organic fingers:

- `edgeInset: 2`, `cornerRounding: 2`, `edgeIrregularity: ~6` (low), `pocketRounding`
  low/omitted (tracks `cornerRounding`).
- These are **starting values**, tuned live in the seam-rounding tuner at a review
  gate before the final pin (same flow reef used).
- `pairingSeed` is available if the owner wants to reseed the seam wobble without
  disturbing the seed-driven glacier wall face.

## 8. Sheet & determinism impact

- `cliffIce.png` grows: +6 pairings × 47 = 282 tiles, +3 fills → **274 → 559**
  named tiles (8-col sheet, taller). Same total as reef's post-all-pairs sheet.
- Re-pin `cliffIce` in `tests/pipeline/determinism.test.ts` (comment block).
- **Desert (`cliff`) and reef (`cliffReef`) stay byte-identical** — the change is
  scoped to `ICE_CLIFF` + new frozen `TerrainKey`s/recipes; verify unchanged.
- Update `tests/pipeline/cliffs.test.ts` ice assertions: per-pairing counts (47
  each for the 6 new `ice*`/`snow*`/`frozenLake*` name prefixes), 4 fills, total 559.

## 9. Files to touch

- `cliffs/palette.ts` — `TerrainKey` += snow/frozenLake/rimeMoss; 3 `TERRAIN_RAMPS`.
- `cliffs/terrains.ts` — 3 `floorFill` recipes.
- `cliffs/presets.ts` — `ICE_CLIFF.pairings` (append 6) + crisp seam knobs.
- `tests/pipeline/cliffs.test.ts` — ice count assertions.
- `tests/pipeline/determinism.test.ts` — re-pin `cliffIce`.
- `tools/pipeline/render-cliff-review.mts` — add snow/frozenLake/rimeMoss patches
  to the ICE variant's transition demo (mirror the reef demo block), for the
  review-gate scene.
- (No `materials.ts`/`generate.ts`/`frames.ts`/`assets.ts`/`manifest.ts`/`index.ts`
  changes — the `cliffIce` sheet plumbing, glacier wall face, and generator all
  already exist; this is data + recipes only.)

## 10. Verification

`npx tsc --noEmit`, `npx vitest run` (desert + reef pins unchanged; cliffIce
re-pinned; ice count asserts), `npm run build`, `npm run smoke`. Owner review of
`.review/ice-scene.png` at the tuning gate before the final re-pin.
