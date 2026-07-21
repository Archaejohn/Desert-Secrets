# G2 — Shared Masks + Composite Bake (Design / Decision of Record)

**Date:** 2026-07-21
**Status:** design approved; decomposes into an implementation plan.
**Parent:** `docs/superpowers/specs/2026-07-20-ground-compositing-architecture-design.md` (Phase G2). Builds on **G1** (`tools/pipeline/src/ground/fills.ts` `fill(terrain, wx, wy)`).

## 1. Why

G1 gave us world-position, non-repeating ground fills. G2 turns a **tilemap of terrain
assignments** into a composited ground texture — `base fill + over·mask + outline` — so
transitions come from **one shared mask over the world-position fills**, not pre-baked
per-pair tiles. Result: any-to-any + cross-biome transitions for free, junctions resolved
by priority, and the non-repeating fills flowing through every seam.

## 2. Reuse (already in the repo)

`tools/pipeline/src/cliffs/blob47.ts` already provides the shared, terrain-independent mask
machinery — G2 reuses it rather than reinventing:
- **`overlayMask(mask, inset, irreg, round, seed, pocketRound)`** → 16×16 `Uint8Array` 0/1
  stencil for an 8-neighbor config. Terrain-independent (the "one shared mask").
- **`CANONICAL_MASKS` (47) / `canonical(m)` / `BLOB_INDEX`** — the autotile config↔mask lookup.
- **`blobTiles(over, base, opts)`** — the per-pixel over/base pick + outline (edge darken,
  lit lip) + drop shadow, in ramp-index space. G2 keeps this exact `(over, base)` convention
  and its `on()` seam-agreement logic; it only changes the *source* of the fills (world-
  position `fill()` sampled per pixel) and the *driver* (a map + priority, not a fixed pair).

## 3. The compositor (per-cell, priority-resolved)

`tools/pipeline/src/ground/composite.ts`:
- Input: a `TerrainKey[][]` tilemap, a world origin `(ox, oy)`, and a global **priority**
  order (§4). Output: a composited `PixelGrid` of the map region.
- **Per cell** at `(cx, cy)` with terrain `T`:
  1. Find the highest-priority neighbor terrain `U` (over the 8 neighbors) that outranks `T`.
     If none, the cell is pure `fill(T, wx, wy)` (world-position — no self-seam needed; the
     texture variety is already in the fill).
  2. Build the 8-neighbor config bitmask of "neighbor is `U`-or-higher" and `canonical()` it,
     then `overlayMask(config, …)`. Composite exactly as `blobTiles` does — `over` = the
     cell's field terrain, `base` = the carved-in higher terrain `U` — but sampling
     `fill(over, wx, wy)` / `fill(U, wx, wy)` at absolute world coords per pixel.
  3. Apply the outline/edge + shadow pass (§5) along the mask boundary.
- **3+ way junctions:** each cell seams only to its single highest-priority intruding
  neighbor `U`; the lower competing seam is dropped for that one cell (graceful degradation,
  no wrong-color bleed — the documented blob-autotiler behavior). Map-authoring keeps a
  1-cell buffer where three grounds would meet at a point.

## 4. Priority

A single global order over all `TerrainKey`s, seeded from the per-biome orders already in
`presets.ts` (reefFloor < reefSilt < reefWater < glowMoss; ice < snow < frozenLake <
rimeMoss; emberRock < ash < lava < lavaCrust; groveGrass < groveMoss < groveWater <
groveSoil; desert sand/asphalt/frostSand). Cross-biome ties broken by a fixed biome order.
Higher priority = "owns the seam" (carves into the lower). Exported as `GROUND_PRIORITY:
Record<TerrainKey, number>`, editable per map later if needed.

## 5. Outline / edge shading

Reuse `blobTiles`' treatment as the G2 default: **darkened over-edge**, **lit inner lip**,
**drop shadow** on the base side — all as `shade()` ramp-index shifts (palette-locked). This
is the **highest-fidelity area (§5 of the parent spec)** and the owner-review focus: the
edge look is iterated on the review render (like the G1 textures). A liquid **foam/molten
fringe** (bone inside water edges, `atbGold` inside lava) is a fast-follow once the base
edge reads right — in scope for G2 if the base edge lands quickly, else a G2 polish item.

## 6. Testing

- **Parity pin:** compose a simple 2-terrain A/B map region and assert its seam matches the
  existing `blobTiles(A,B)` output for the same config (this pins the over/base direction by
  construction). Sha256 golden-crop of a fixed composited region per representative case.
- **Palette-conformance:** every composited pixel ∈ (`GROUND_RAMPS[T]` ∪ over/base ramps
  used) — no off-palette.
- **Determinism:** pure (`h2`/`fill`/`overlayMask` only); same map+origin → same bytes.
- **Junction sanity:** a 3-terrain junction composites without throwing and with no
  off-palette bleed.

## 7. Deliverable + review gate

- `composite.ts` (+ `GROUND_PRIORITY`) + tests.
- A **review scene** (`buildCompositeReview.mts`): a hand-built test map with a same-biome
  4-ground junction AND a cross-biome transition, rendered large, so the owner confirms the
  seams read right and iterates the outline/edge look. **Owner gate.**

## 8. Scope / non-goals

- **Static composite only.** Animated masks (shoreline waves, creeping lava) = **G3**.
- **No game/runtime wiring** (bake into `ScaledGroundView`) = **G3**.
- **No authored art floors** (megalith) = **G4**.
- Leaves `floorFill`, the baked cliff sheets, and the 40 determinism pins untouched (G2 is a
  new module + review render).

## 9. Verification

`tsc --noEmit`, `vitest run` (parity + conformance + determinism green), `npm run build`.
Owner review gate at the composite render (§7).

## Addendum (2026-07-21) — what actually shipped

Two changes from the §3/§5 design, both from the owner's review of the first render:

- **Priority-LAYERING replaced single-carve (§3).** The first implementation seamed each
  cell to only its *single highest-priority* neighbor, which dropped the other transitions
  at 3–4-way junctions and left hard, straight, untransitioned edges (owner-diagnosed as
  "wrong overlap of interior tiles at the 4-way junction"). `compositeCell` now layers
  **every** higher-priority neighbor as its own `overlayMask` layer, processed ascending so
  higher terrains overpaint lower ones. All transitions overlap correctly; patches read as
  organic blobs. (This is what the parent spec §4 meant by "priority-layered junctions" — the
  single-carve shortcut was the bug.)
- **Soft grey seam shadow replaced the `blobTiles` ink outline (§5).** The ported outline
  darkened toward each ramp's near-black end, reading as a hard ink line on flat ground.
  Replaced with a palette-locked `SOFT_SHADOW` lookup: each CORE colour blended ~52% toward a
  dark grey-violet and snapped to nearest CORE, applied to the **lower side** of each seam —
  a soft darkened border, owner-tuned. Palette-lock is therefore at the **CORE (AAP-64)**
  level (the shadow may be any CORE colour), not per-terrain ramp. No lit-lip; the `SEAM`
  inset/irregularity were widened (inset 5, irreg 30) for a wavier boundary.

The parity-pin idea (§6) was dropped: the composite samples world-position fills (not the
pre-baked `floorFill`), so it cannot be byte-compared to `blobTiles`; tests instead assert
CORE palette-lock, determinism, and a junction-layering regression (a cell flanked by two
different higher terrains must show BOTH). Warp/animation stay out (G3).
