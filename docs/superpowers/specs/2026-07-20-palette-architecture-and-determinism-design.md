# Palette Architecture + Determinism Relaxation (Design / Decision of Record)

**Date:** 2026-07-20
**Status:** decisions approved; decomposes into three implementation plans (A/B/C below)

## 1. Why

The whole shipped game is **25 palette colors, palette-locked, zero hardcoded
leakage** — clean but cramped, and desert-specific. The story arc demands a far
larger environmental range: bioluminescent sunless sea, mines, groves, reef, a
hidden underground overworld (Part 2), **space and ~8–10 alien planets** (Part 3),
a space junkyard (Part 4) — with palette-lock explicitly kept throughout. Two
current requirements are becoming a burden:

- **Palette too small / too mood-specific** for that range. The building/prop
  generators already defected to their own colors.
- **Determinism = sha-pin every pixel of every sheet** (38 pins). Fine for fixed
  art; it *cannot* model combinatorial generative content (towns, forests) — you
  can't pin infinite variants — and it taxes every visual iteration.

Three decisions, below. They are related but separable, so each becomes its own
implementation plan.

## 2. Decision — Palette model: AAP-64 core + per-biome accents

- **Core = AAP-64** (Adigun A. Polack's 64-color palette). Chosen for versatility
  over mood-specificity, because the game must render desert → deep ocean → space
  → open-ended alien worlds. Proven, well-rampled, no bikeshedding.
- **Per-biome accent sets, ~8–12 colors each** — only a place's *signature* hues
  beyond core. A new alien planet = core + ~6 accents, NOT a fresh 25. This is what
  makes the model scale to Part 3's open-ended planet count.
- **Rule:** if a color plausibly appears in two biomes, it belongs in **core**.
  Accents are exclusive signature hues only.
- **Structure in `src/shared/palette.ts`:** a `CORE` map (64 named AAP-64 colors)
  plus a `BIOME_ACCENTS` map keyed by biome (`reef`, `ice`, `sunlessSea`, `mine`,
  `grove`, …). A material/ramp may reference core names always, accent names only
  within its biome.

**AAP-64 hexes are imported verbatim from the canonical source (Lospec
`aap-64`), never hand-typed from memory.** Implementation task A.1 fetches and
pins the exact 64 hex list; a test asserts the core map matches it byte-for-byte.

**Near-term accent sets** (first pass; grown as biomes are built):
- `desert`: warm sand highlights beyond core neutrals.
- `ice`: frost blue-whites; the frozen-biome grounds (snow/frozenLake/rimeMoss)
  draw from here — see the frozen-biome spec.
- `reef`: teal / coral / mint-glow / deep-indigo.
- `sunlessSea`: abyssal blue-black + bioluminescent cyan/mint glow + kelp green.
  Includes the Act 3 **partially sunken sun-temple ruins** — mostly **core**
  (weathered stone, temple gold) + these `sunlessSea` accents + a small
  verdigris/gold "ruins" flavor. A worked example of a sub-location reusing
  core + a biome's accents rather than needing its own set.
- `mine`: cinnabar red + lantern amber + damp stone.
- `grove`: lush greens + sunlight gold.
- `space`/per-planet (Part 3): each planet defines its own ~4–8 accent set.

## 3. Decision — Relax determinism (stated replacement rule)

Replace "sha-pin every sheet" with, verbatim, the new contract:

> **Generators are deterministic** (integer-hash noise `h2`/`fbm` only; no
> `Math.random`/`Date`), so **same seed → same output**. Correctness is enforced
> by (a) **golden-sample pins** — a few fixed seeds per generator, sha-pinned —
> and (b) **structural invariants** — dimensions, tile counts, **palette
> conformance** (every pixel ∈ core ∪ that biome's accents), no transparent holes.
> Full every-sheet pixel pins are kept ONLY for a small "shipped-stable" set the
> owner nominates.

Rationale: keeps reproducibility and the accidental-drift detector where it
matters, drops per-iteration friction, and — critically — **models generative
content**, which exact-sha never could.

## 4. Decision — Baked vs runtime split

- **Baked + golden-pinned:** fixed, shared, seam-critical art — terrain tilesets,
  autotile transitions, character sheets. Few, must be byte-stable.
- **Runtime-generated, unpinned:** combinatorial decor — trees, props, buildings,
  towns. Ship the **deterministic generator as code**; on scene load generate a
  **cached pool of ~12–16 variants**, then scatter many Y-sorted sprites from the
  pool with flip/scale/tint. Never commit or pin a per-instance sprite. Same seed
  → same variant keeps save/load reproducible.
- Phaser already does runtime texture generation (`LightMask`, `Mode7Ground`,
  `ScaledGroundView` via `textures.createCanvas` / `RenderTexture`), so this
  extends an existing pattern, not a new capability. Generate the pool at load
  (or spread across frames) — the prop generator is a ray-caster and is too heavy
  to run per-frame mid-gameplay.

## 5. Implementation decomposition (three plans)

**Plan A — Palette migration.** Import + pin canonical AAP-64; restructure
`palette.ts` into `CORE` + `BIOME_ACCENTS`; remap each shipped color to its
nearest AAP-64 (perceptual/redmean distance), owner-reviews the remap; update
every `TERRAIN_RAMPS` / tileset / character generator to the new names;
regenerate all sheets. **Owner review gate** — the shipped look shifts.

**Plan B — Determinism relaxation.** Rewrite `tests/pipeline/determinism.test.ts`
to the §3 rule: golden-sample pins + a reusable **palette-conformance** assertion
(every pixel ∈ allowed set) + structural invariants; keep full pins only for the
nominated shipped-stable set. Depends on A (palette must exist first).

**Plan C — Runtime generative content.** Port the building/prop generators from
the standalone HTML tools into the game's TS against the new palette; add a
load-time **variant-pool + cache** helper; wire a first consumer (e.g. a forest /
a town). Independent of B; depends on A for palette.

Sequence: **A → B → (C in parallel once A lands).**

## 6. Scope / non-goals

- Not an engine change — all of this is project architecture on the current Phaser
  stack.
- The frozen-biome multi-ground work (separate spec) should land its grounds using
  the new `ice` accent set once Plan A exists; if it lands first, it re-pins under
  the old rule and gets migrated with everything else in A.
- Building/prop generator *tools* (standalone HTML) are owner-maintained; the game
  imports their recipes (Plan C), and the owner re-colors the tools to the palette.

## 7. Verification

Per plan: `tsc`, `vitest` (new invariants green; nominated pins stable), `build`,
`smoke`. Owner review gates at the palette remap (A) and first runtime forest (C).

## Addendum (2026-07-20) — Plan A execution decisions

Recorded when Plan A was picked up for implementation (owner-confirmed):

- **Ordering.** Plan A (AAP-64 palette migration) runs **before** the ground-
  compositing **G1** fill library — G1's world-position fills should be authored
  once against the final palette, not the old 25 then re-colored.
- **Remap fidelity: "embrace AAP-64" (clean refresh).** All 25 shipped colors snap
  to their **nearest AAP-64 core** color by redmean ΔE. **No preservation accents**
  are carried over from the current set; `BIOME_ACCENTS` starts effectively empty
  and grows only as new biomes need signature hues. The shipped desert look shifts
  deliberately — accepted at the remap review gate.
- **Core naming.** AAP-64 ships no canonical color names. Plan A assigns stable,
  semantic/family names consistent with the current style (`rust`, `tealDeep`, …),
  owner-tweakable at the remap review gate.
- **Collision handling.** If two shipped colors snap to the *same* AAP-64 color (a
  ramp would lose a step), the collision is surfaced at the review gate for the owner
  to nudge one to a neighboring core color.
