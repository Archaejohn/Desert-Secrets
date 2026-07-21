# Phase G4 — Authored Art Floors (Sun-Temple) — Design

**Date:** 2026-07-21
**Status:** approved (owner) — decomposes into an implementation plan
**Parent design of record:** `docs/superpowers/specs/2026-07-20-ground-compositing-architecture-design.md` §8 (Phase G4), §3 (authored fills), §10 (open questions)

## 1. Why

G1–G3 delivered **natural** world-position fills (noise structures) composited
and rendered live (reef garden, reef hollow). The architecture always intended a
second kind of fill — **authored art floors**: a *structured* function of world
coords (slab lattice, grout, per-slab shading, cracks) plus **features placed at
exact world positions** (an emblem, a shattered slab). G4 builds that capability
and proves it on its canonical target: the **Act 3 Sun-Temple Ruin**
(`SunTempleScene`, "The Ancient Ruins") — the flooded ruins of a sun-god's
temple, lit only by the party's lamp. Today its floor is a single tiled
`templeFloor` flagstone (mauve, skyBlue water sheen) plus a separate `templeGlyph`
tile (amber sun-disc) at the hall center; both read as a stamped 16px repeat.

## 2. Scope (owner-decided)

- **Author + wire live** — build the authored fill + feature placement in the
  pipeline AND wire the sun-temple onto the runtime composite (like G3), so it
  renders in the actual zone.
- **Full feature set** — procedural slab field PLUS hand-placed features: a
  **sun-disc emblem** at the hall center and **shattered slab(s)** at authored
  positions, with crack/wear woven into the field.

Non-goals: no water-surface renderer in the temple (the surround composites as a
dark seabed; the drowned-dark read comes from the existing lamp `LightMask`). No
new zones beyond the sun-temple. Cliff vertical structure, other zones' grounds,
and all baked sheets are untouched.

## 3. `templeSlab` — the first authored fill

A new `TerrainKey` `"templeSlab"`, added to `TERRAIN_RAMPS`, `TerrainKey`, the
`ORDER`/`GROUND_PRIORITY` list, and the `fill()` switch — the same slots every
ground already occupies (so `GROUND_RAMPS`/`GROUND_ID_POS`, `floorFill`, and the
composite all pick it up automatically).

- **Ramp (4 IDs, light→dark):** `["mauve", "plum", "indigo", "ink"]` — submerged
  temple stone. `mauve` = lit slab face, `plum` = slab body, `indigo` = grout /
  shaded edge, `ink` = crack core. Enriched with AAP-64 intermediates by the
  existing `groundRamps` builder. `P[i] = GROUND_ID_POS.templeSlab[i]`.
- **Slab lattice (structured, world-aligned):** blocks of **3×2 tiles = 48×32 px**
  laid on the *absolute* world grid, so slabs line up across the whole floor
  regardless of where the zone sits. Block index `(bx,by) = (floor(wx/48),
  floor(wy/32))`; local offset `(lx,ly)` within the block.
- **Per-slab body tone (flat-ish):** each block gets one deterministic body tone
  (a small `h2(bx,by,seed)` step around `plum`, i.e. between `P[1]` and a step
  toward `P[0]`/`P[2]`), so adjacent slabs differ slightly — reads as separately
  carved stones, not one flat field. Very low contrast (matches the "shaded"
  register the owner chose in G1).
- **Per-slab shading off one consistent light (top-left):** within each block, a
  **lit lip** (1–2 px, `P[0]` `mauve`) along the top and left edges and a
  **shadowed edge** (1–2 px, toward `P[2]` `indigo`) along the bottom and right —
  so every slab reads as raised with the same light direction → depth.
- **Grout lines:** the 1–2 px gap at block boundaries is the darker joint
  (`P[2]` `indigo`, deepening to `P[3]` `ink` at 4-corner junctions).
- **Cracks & wear:** a sparse `ridged(wx,wy,seed)` network crossing slabs settles
  its creases to `indigo`, rarest cores to `ink` (like `emberRock`); plus a very
  sparse `h2` wear speckle toward `P[0]`/`P[2]`. Woven into the field, not a
  separate pass.
- **Water sheen accent:** a faint, sparse near-horizontal `skyBlue` glint (a low-
  amplitude `striate` gate at very high threshold) — keeps the drowned-ruin read
  without a full water overlay. Palette-locked; `skyBlue` is the one off-ramp
  accent (allowed set for conformance = `GROUND_RAMPS.templeSlab ∪ {skyBlue}`).

Deterministic (`h2`/`ridged`/`striate` only), world-position, palette-locked. Like
every fill it composites and transitions through the shared mask for free.

## 4. Feature placement

Keeps `fill()` pure/positional; features are a **composite-time overlay pass** in a
new module `tools/pipeline/src/ground/features.ts`.

```
export type GroundFeature =
  | { kind: "sunEmblem"; tx: number; ty: number; seed?: number }
  | { kind: "shatter";   tx: number; ty: number; seed?: number };

export function paintFeatures(
  grid: PixelGrid, terrainId: Uint8Array, shadow: Uint8Array,
  features: readonly GroundFeature[], gridWidth: number,
): void;
```

- Operates in the **PixelGrid / palette-name domain** (easy `g.rect`/`g.px`
  drawing), mutating the composited grid in place at tile positions
  (`tx*16, ty*16`).
- **Crisp through the blur:** every pixel a feature paints also gets
  `shadow[i] = 1`. `maskedBlur` passes shadow pixels through untouched and never
  averages neighbors across them (verified: `maskedBlur.ts:24,31`), so emblems
  stay sharp while the slab field still softens. No new skip plumbing.
- **`sunEmblem`** — an amber sun-disc + rays centered on its tile (reproducing the
  old `templeGlyph`: `amber` disc, `sandLight` center highlight, short rays), so
  the lore-inspect landmark still reads. Placed at the hall center (tile 7,7).
- **`shatter`** — a slab broken into shards: `ink` fissures splitting the block
  into 3–4 pieces with `indigo` displaced edges, deterministic from `seed`. Placed
  at 1–2 authored spots (e.g. near a pillar / a cave-in).

## 5. Live wiring (Sun-Temple)

- **`groundTerrain.ts`** — add `SUNTEMPLE_GROUND_TO_TERRAIN` and
  `SUNTEMPLE_DEFAULT_TERRAIN`:
  ```
  templeFloor → templeSlab,  templeGlyph → templeSlab,
  seaWater → reefSilt,        seaWater2 → reefSilt      // dark seabed base
  DEFAULT = reefSilt
  ```
  (`baseName` already strips the `Shade` dressing variants, so
  `templeFloorShade`/`templeGlyphShade` fold in.)
- **`GROUND_PRIORITY`** — insert `templeSlab` in `ORDER` **after `glowMoss`** (end
  of the reef group), giving it higher priority than `reefSilt`/`reefFloor`/
  `reefWater`. The stone floor is the "over" terrain: the shared mask carves an
  organic silty edge where the ruin sinks into the seabed. (Distinct-priority +
  count invariants in `composite.test.ts` stay satisfied — one key added to both
  `ORDER` and `TERRAIN_RAMPS`.)
- **`ZoneConfig.compositeGround`** gains an optional `features`:
  `{ table; fallback; features?: readonly GroundFeature[] }`.
  `setupCompositeGround` passes it to `CompositeGroundView`.
- **`CompositeGroundView`** takes `opts.features`; after `compositeMapLayers` and
  before `pixelGridToRGBA`, calls `paintFeatures(pg, terrainId, shadow, features,
  pg.width)`. Feature pixels are thus crisp through the (default-on) blur.
- **`SunTempleScene`** — set `compositeGround: { table: SUNTEMPLE_GROUND_TO_TERRAIN,
  fallback: SUNTEMPLE_DEFAULT_TERRAIN, features: SUNTEMPLE_FEATURES }` where
  `SUNTEMPLE_FEATURES = [{kind:"sunEmblem", tx:7, ty:7}, {kind:"shatter", …}]`.
  The existing lamp `LightMask`, the glyph `InteractPoint` (lore beat), pillars,
  coral, bubbles, and the `seaWater`/`seaWater2` tile animation are all unchanged
  (composite is ground-visual only; collision/decor/overhead untouched). The
  `seaSparkle` prop over the glyph may stay.

## 6. Testing & review gate

- **Unit (pipeline):**
  - `templeSlab` fill — palette-locked to `GROUND_RAMPS.templeSlab ∪ {skyBlue}`,
    fully opaque, deterministic, and **non-tiling** (a crop at world origin ≠ a
    crop one block over — proves world-position, not a 16px stamp). The existing
    "every terrain fill is palette-locked" loop (`cliffs.test.ts:53`) and the
    4-entry-ramp / distinct-priority invariants pick `templeSlab` up automatically.
  - `paintFeatures` — a `sunEmblem` paints `amber` at its center and sets
    `shadow=1` on painted pixels; a `shatter` paints `ink` fissures; both leave
    non-feature pixels untouched; deterministic.
  - `groundTerrain` — `SUNTEMPLE_GROUND_TO_TERRAIN` maps floor/glyph→templeSlab,
    water phases→reefSilt, and `baseName` strips the `Shade` variants.
- **Review bake (visual proof):** a standalone bake (a demo temple map: a slab
  island with emblem + shatter, surrounded by `reefSilt`) → PNG, showing the
  lattice, per-slab light, grout, cracks, emblem, and the masked silty edge. I
  Read it myself before proceeding.
- **Live capture:** a `tools/smoke/shots/g4-temple.spec.ts` that `jumpTo`s the
  sun-temple and screenshots the composited floor in-game (lamp lighting on). I
  Read it myself, then present to the owner for the visual gate.
- **Full bar before PR:** `tsc --noEmit`, `vitest run`, `npm run build`,
  `npm run smoke`, `npm run smoke:touch`. No sheet re-pin (composite is not a
  pinned sheet). Then an independent whole-branch review, then PR → `main` with a
  regular merge commit.

## 7. Open items / deferred

- **Emblem fidelity** vs the old `templeGlyph` — tune at the visual gate; the
  feature must remain recognizable as the lore landmark.
- **Shatter placement/count** — final positions chosen at authoring time against
  the live map (near a pillar / a plausible cave-in), reviewed visually.
- Additional authored floors (Act 7 pizzeria tile, mosaic, brick) are **out of
  scope** — this phase establishes the capability; later zones reuse it by adding
  a `TerrainKey` + a `fill()` case + (optionally) features, no new architecture.
