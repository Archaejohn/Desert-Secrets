# Phase W2 — Traversable Mine Plateau — Design

**Date:** 2026-07-21
**Status:** approved (owner) — decomposes into W2a/W2b/W2c implementation plans
**Parent design of record:** `docs/superpowers/specs/2026-07-21-runtime-wall-elevation-engine-design.md`
**Builds on:** W1 wall generator (`tools/pipeline/src/walls/`, merged PR #49).

## 1. Scope (owner-decided)

Prove the runtime wall engine on **one traversable plateau in the first Cinnabar Mine
room** (`MineScene`/`mineMap.ts`, first chamber ~tiles 12–17 × 15–19, by the spawn) — a
raised ledge you walk up via a ramp.

- **Stack-levels DEFERRED.** The ledge is non-overlapping (walk up, never *under*), so it
  rides the mechanics the game already ships: a **solid wall band** + a **walkable ramp
  gap** + composite-ground regions above/below + **foot-Y depth sort** + the **overhead
  layer**. No `level` attribute yet; that arrives when a zone needs overlapping elevation.
- **New bespoke rock recipe** for the mine (not strata/granite).
- **Simple walkable ramp** (art on walkable tiles); the prototype's full 3D wedge/stairs
  ramp is a later phase.

## 2. The mine rock recipe — `minestone`

A new coursed recipe in `tools/pipeline/src/walls/wallStyles.ts`, extrapolated from the
prototype's block-course styles (granite/columnar) warmed toward strata but darker (deep,
lamp-lit), with a **cinnabar ore** accent — the mine's identity.

- **Character:** hewn/blocky dark warm-grey stone (the corridors are cut from it), with
  sparse **red cinnabar ore veins/flecks** threading the blocks.
- **Face ramp (dark→light, AAP-64 indices — starting point, tuned at the gate):**
  `[0, 31, 32, 63, 62, 61, 60]` (near-black → dark warm-grey → mid grey-brown → tan). A
  dark neutral-warm hewn stone, distinct from strata's bright tan and granite's cool blue.
- **recess/cap/talus:** `recess: [0, 0, 31]` (near-black behind cracks), `cap: [32, 63, 62,
  61, 60, 59]` (top-lit), `talus: [31, 32, 63, 62, 61]` (scree). `crest: "jagged"` (rough
  hewn skyline), `top: "chip"` (chiselled block tops).
- **Cinnabar ore accent (the new feature):** in `course`, after pushing each hewn block
  (a `shapedSlab` like granite), with low probability (`h2(...) < ~0.12`) push a small red
  **ore ellipsoid** carrying its own material `ORE = MAT([2, 3, 44, 45], lo, hi)` (dark
  vermilion → dark red-brown, muted — it is ore in rock, not lava). Optionally a thin red
  **vein** (a small `ovalZ`) across a block. Sparse (~1 in 8 blocks) so it reads as ore
  seams, not a red wall.
- Palette-locked, deterministic, muted (uses the raised `WALL_WIN`); block structure ports
  the granite `course` pattern (its seed constants), swapping the ramp + adding the ore.

**Review gate (W2a):** a review-bake (extend `bakeWallReview.mts`) renders `minestone`; I
Read it and tune ramp/ore/muted with the owner before any game wiring.

## 3. Wall-in-zone integration (W2b)

### 3.1 The mine map ledge
Carve a raised ledge into the first chamber (`mineMap.ts` `CARVES`/dressing): three bands
(south→north): **lower floor** (walkable, ~2 rows), the **wall band** (solid, ~2–3 rows —
this is the front face), the **plateau** (walkable, the back of the chamber). A **ramp
gap** (walkable tiles) cuts through the wall band on one side. Wall-band tiles use a solid
name (so collision blocks them); plateau + lower floor are ordinary walkable ground.

### 3.2 Composite ground on the mine
Opt `MineScene` into `compositeGround` (a `MINE_GROUND_TO_TERRAIN` table in
`groundTerrain.ts`: `mineFloor`→a mine terrain, `frostSand`→frostSand, etc.). The plateau
and lower floor both render as composite ground (they are just walkable surfaces; no level
distinction). The `mineWall` band tiles are hidden under the wall image (or mapped to a
neutral terrain the wall covers).

### 3.3 The game-side wall renderer (`WallView`)
New `src/game/gfx/WallView.ts`, following the `CompositeGroundView` runtime-bake pattern:
- Takes the band's **tile-rect** + a **wall recipe** (`{ style, height, crest, ... , seed }`).
- Calls the W1 `renderWall(params)` (pure pipeline fn) → `PixelGrid` → RGBA → canvas
  texture (like `CompositeGroundView`).
- **Placement / alignment** (the crux). In wall space, `projX = x·PPU` so **1 wall-unit =
  16 px = 1 tile** in screen-x → set wall `W` = band width in tiles. Screen-y is
  foreshortened (`projY ≈ -(y·ce)·PPU`, `ce=cos33°≈0.84`), so the face's on-screen height
  = `H·ce·PPU`; to cover a band `Ht` tiles tall, set `H ≈ Ht / ce`. Place the baked image
  so **wall-y=0 (the foot) lands on the band's south-edge pixel row** and the width aligns
  to the band's left tile. The crest overhangs *above* the band (onto the plateau's south
  edge); the talus overhangs *below* (onto the lower floor).
- **Depth split (face-below / crest-overhead):** split the baked image at the wall-top row
  (`wall-y = H`): the crest portion (above it) → an image at the **overhead depth (5000)**
  so it occludes a player standing at the plateau's front edge; the face + talus (below) →
  an image **below actor foot-Y** so a player on the lower floor draws over it. Two Phaser
  images from one bake. (For a first cut, the crest-overhead split may be trivially small;
  keep it but tune.)
- **Talus onto the floor:** the talus lives at the bottom of the face image and overlaps
  the lower-floor tiles; for the organic transition the design calls for, the talus pixels
  can be masked (the 47-blob mask / a scatter) so the wall foot dissolves into the floor
  rather than a straight line. W2b may start with a simple overlap and add the mask if the
  edge reads hard (owner gate).
- Self-registers SHUTDOWN/DESTROY teardown (texture + images), like the other Views.

### 3.4 Depth model (no stack-levels)
Actors sort by foot-Y (`setDepth(y)`, existing). Wall face < actors < crest-overhead.
A player on the lower floor (south, high Y) draws over the face; a player on the plateau
(north, low Y) is north of the band entirely and is occluded only by the crest at the edge.
Collision: wall-band tiles solid, ramp + plateau + lower floor walkable — name-based, as
today. No `level` coordinate.

## 4. Seed / world-position threading

W1's shared `h2` is seed-less, so `WallParams.seed` is currently inert. W2 threads it so
different zones/positions grow different rock: the recipe `course`/`buildWall` take a
`seed`, and every `h2(a, b, c)` becomes `h2(a, b, c + seed)` (or the wall's world-tile
origin is folded into `seed`). `WallView` derives the seed from the band's world position
+ zone id (`h2(bandX, bandY, zoneHash)`), so the same band reproduces build-to-build but
different bands/zones differ — the "seeded, non-repeating" engine goal.

## 5. The simple ramp (W2c)

The ramp gap is walkable tiles wearing a **sloped-path art** (a dedicated ramp ground name,
or the composite terrain dressed as a slope) cutting through the wall band from the lower
floor up to the plateau. Collision open on the ramp cells; solid on the band around it.
No 3D wedge/tread geometry yet — that's the prototype's `wedgeRock` ramp, a later phase.
Walking the ramp moves the player from the lower region to the plateau region (both
walkable; foot-Y sorting carries the visual climb).

## 6. Testing & review gates

- **W2a:** `minestone` unit tests (palette-locked incl. the red ore accent's `ORE` colours,
  deterministic, produces ore ellipsoids). Review bake → I Read it → owner muted/ore gate.
- **W2b:** `MINE_GROUND_TO_TERRAIN` table test; `WallView` placement — a `tools/smoke/shots/`
  capture of the mine chamber with the wall in-zone (I Read it; owner visual gate on the
  ledge look + alignment). `maps.test.ts` BFS still passes (the ledge + ramp keep the room
  reachable/enclosed).
- **W2c:** a capture walking up the ramp onto the plateau; owner gate on the traversal read.
- **Full bar before PR:** `tsc`, `vitest`, `build`, `smoke`, `smoke:touch` (W2b/c touch
  `src/game/`, so smoke applies). PR → `main`, regular merge commit.

## 7. Phasing

- **W2a — `minestone` recipe + review bake** (pipeline-only). Get the mine rock right first.
- **W2b — wall-in-zone integration**: mine map ledge, composite opt-in, `WallView`
  placement/alignment + depth split + talus, seed threading. The hard part.
- **W2c — simple ramp + traversal**: walkable ramp art, walk up to the plateau.

## 8. Open questions (carry into the plans)

- Exact band/plateau/lower/ramp tile layout in the chamber (chosen against the live map,
  keeping BFS reachability).
- The placement pixel-math constants (foot-row alignment, crest/talus overhang) — tuned at
  the W2b capture gate; the `H ≈ Ht/ce` foreshorten factor may need a fudge.
- Whether the talus needs the 47-blob mask transition in W2b or a simple overlap suffices.
- How much red ore reads right (W2a gate).
- Ramp art: a bespoke ramp ground fill vs dressing an existing terrain as a slope.
