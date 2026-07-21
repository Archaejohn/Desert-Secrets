# G1 — World-Position Ground Fill Library (Design / Decision of Record)

**Date:** 2026-07-20
**Status:** design approved (owner picked "de-tile + enrich"); decomposes into an implementation plan.
**Parent:** `docs/superpowers/specs/2026-07-20-ground-compositing-architecture-design.md` (this is its Phase G1).

## 1. Why

The shipped ground fills (`tools/pipeline/src/cliffs/terrains.ts` `floorFill(key, seed)`)
are **tile-local 16×16 grids that repeat**: they sample a toroidally-wrapped noise lattice
(`cliffs/noise.ts` `noise()` wraps `mod cells`), so a tiled field reads as a stamped,
repeating textile (the owner caught this on the grove grounds). The runtime ground-
compositing architecture (parent spec) needs a **world-position** ground surface —
`fill(terrain, worldX, worldY)` — that never repeats and can be composited by mask.

## 2. Decision — the fill library

A new module `tools/pipeline/src/ground/` exposing:

- `fill(terrain: TerrainKey, wx: number, wy: number) -> PaletteName` — a deterministic,
  palette-locked ground color at absolute world coordinates. Because it reads absolute
  coords, it never tiles or repeats.
- Palette-locked: output is always a `PaletteName` drawn from that terrain's
  `TERRAIN_RAMPS` ramp (now on AAP-64). No raw hex; the composite/encoder maps to RGB.

Owner-chosen approach: **de-tile + enrich.** Beyond making the recipe world-position
(which alone kills the repeat), each fill layers:
- the **approved recipe** from `floorFill` (same ramp roles + fleck densities/thresholds),
  re-expressed at world coords — the base texture stays recognizably the shipped look;
- a low-frequency **macro tonal drift** (broad, slow index shift across a field so large
  areas aren't uniform);
- a faint **per-material grain** (grass = slight vertical bias, water = horizontal drift,
  most grounds = none) via directional scaling of the noise sample.

## 3. World-position noise (the key new primitive)

`tools/pipeline/src/ground/worldNoise.ts`:
- `worldNoise(wx, wy, freq, s)` — value noise on a **non-wrapping** continuous integer
  lattice (`x0 = floor(wx*freq)`, bilinear smoothstep interp, `h2(x0, y0, s)` with NO
  `mod cells`). Continuous across the whole world → no repeat.
- `worldFbm(wx, wy, s)` — three octaves at `freq = 0.125, 0.25, 0.5` per world pixel with
  weights `0.55/0.30/0.15`, matching the shipped `fbm`'s texture SCALE (cells 2/4/8 over a
  16px tile) so the base grain reads the same as today, only non-repeating.
- `worldMacro(wx, wy, s)` — one low-freq octave (`freq ≈ 0.015`, period ~64px) for the
  enrichment drift layer.
- Reuses `h2`/`sm`/`mix` from `cliffs/noise.ts` (do NOT fork the hash — seam math depends
  on that exact `h2`).

## 4. Fill engine + recipes

`tools/pipeline/src/ground/fills.ts`:
- One `fill()` with a per-terrain branch mirroring `floorFill`'s 19 branches, but:
  `v = worldFbm(wx*gx, wy*gy, seed)` (grain via `gx/gy` scale) `+ macroShift`, and flecks
  via `h2(floor(wx), floor(wy), seed+…)` at world coords. Same ramp indices/thresholds as
  the approved recipe; macro shift nudges the base index by ±1 step slowly across space.
- Terrain coverage: all 19 built keys (desert sand/frostSand/asphalt; reef reefFloor/
  reefSilt/reefWater/glowMoss; ice ice/snow/frozenLake/rimeMoss; lava emberRock/ash/lava/
  lavaCrust; grove groveGrass/groveMoss/groveWater/groveSoil).
- Per-material grain table (initial): `groveGrass`/`rimeMoss`/`glowMoss` slight vertical;
  `reefWater`/`groveWater`/`lava` slight horizontal; all others isotropic.

## 5. Scope / non-goals

- **Leaves `floorFill` and every baked sheet untouched** — G1 is a parallel module; the
  cliff-generator reference sheets and their 40 determinism pins stay byte-identical.
- No mask/compositing (**G2**), no game/runtime wiring (**G3**), no authored art floors
  (**G4**). `fill()` returns a per-coordinate color; consumers come later.
- Draws from the current AAP-64 `TERRAIN_RAMPS`; no ramp re-tuning.

## 6. Testing (pioneers the golden-sample style Plan B will formalize)

- **Golden-crop pin:** sha256 of a fixed world-region crop (e.g. 64×64 at a fixed offset)
  per terrain — deterministic, small, re-pin only on intentional recipe change.
- **Palette-conformance:** every pixel of a sampled field ∈ that terrain's ramp.
- **Non-tiling invariant:** two same-size windows at different world offsets are NOT
  identical (proves the 16px repeat is gone).
- **Determinism:** `fill(t, wx, wy)` is pure (`h2`/`worldFbm` only) — same inputs → same
  output, no `Math.random`/`Date`.

## 7. Deliverable + review gate

- The `ground/` module + tests (above).
- A **review render**: for each of the 19 grounds, a large field rendered two ways —
  **old `floorFill` tiled** vs **new world-position `fill`** — as an HTML/PNG artifact for
  the owner to confirm the repeat is gone and the enrichment reads well. **Owner gate.**

## 8. Verification

`tsc --noEmit`, `vitest run` (golden crops + conformance + non-tiling green), `npm run
build` (confirms nothing else broke — no sheet/pin changes expected). Owner review gate at
the render (§7).

## Addendum (2026-07-21) — what actually shipped

The build pivoted beyond the original "faithful de-tile + uniform grain/macro" plan after
the owner reviewed it: all 19 grounds read as "recolored versions of the same concept."
The delivered G1 instead gives each material a **distinct texture STRUCTURE**:

- **`tools/pipeline/src/ground/texture.ts`** — a world-position primitive kit: `worley`
  (cellular/facets), `ridged` (crack networks), `striate` (ripples / wave bands), `warp`
  (domain-warp flow / clumps), `cellTone`, and `ditherRamp` (hash-based, non-repeating
  interleave for smooth transitions). All non-wrapping, reuse the shared `h2`.
- **Family map** (owner-approved on a 6-ground prototype, then rolled to all 19): ripples →
  sand/frostSand; flowing → lava; facets → ice/frozenLake; wave bands → reefWater/groveWater;
  clumps → glowMoss/rimeMoss/groveGrass/groveMoss; grain → groveSoil/ash/reefSilt/asphalt/
  reefFloor; cracked → emberRock/lavaCrust; soft drift → snow.
- **"Shaded" low-contrast register** (owner direction): texture modulates within the
  material's body±1 tone; ramp extremes are rare sparse accents only (exception: `lavaCrust`
  inverted — dark crust, light fissures). Lava is domain-warp FLOW, not crystalline cells.
- **Enriched AAP-64 ground ramps** (`tools/pipeline/src/ground/groundRamps.ts`): keep each
  terrain's 4 identity colors, insert AAP-64 intermediate tones between adjacent IDs
  (RGB-lerp → nearest-AAP-64 → CORE name), so blending spends the fuller palette. `fill()`
  blends across these via `ditherRamp`. `GROUND_RAMPS` (5–8 entries) + `GROUND_ID_POS`.
  Palette-lock now asserts against `GROUND_RAMPS`.

**Deferred (owner: "revisit later if needed"), NOT blocking the G1 merge:**
- **sand / snow / groveGrass** gained NO intermediates — their two body IDs are already
  adjacent in AAP-64, so nothing sits between them; they remain 2-color stipple. Truly
  smoothing them needs a WIDER body-blend window (span 3 IDs) — a follow-up.
- A few auto-inserted intermediates may read muddy — `groveMoss` (green→grey→brown bridge),
  `ash` (cool blue-grey bridge), `groveSoil`/`emberRock`/`lavaCrust` (warm→cool rock) —
  hand-retune per terrain later if wanted.
- Still upstream of G2 (masks/composite), G3 (game wiring), G4 (authored floors) — `fill()`
  is not yet consumed by any scene.
