# Desert Cliff + Floor + Cap Tileset — Generator Design (Phase 1)

**Date:** 2026-07-18
**Status:** Approved design, pending implementation plan
**Scope:** `tools/pipeline/` only — the procedural art generator. No runtime/scene wiring, no map-editor, no extra materials (those are later phases).

## Problem

The desert Act-1 zones (US-95 / the overworld road, the homestead = oasis + shed,
and Piggy's trail) enclose their play areas with a single flat, stamped
**`rock`** boulder tile (`tools/pipeline/src/tileset.ts`, listed solid in
`src/game/maps/types.ts` `SOLID_TILE_NAMES`) and mark sand transitions with a
single hand-made **`duneEdge`** tile. These read as flat props, not terrain —
no vertical wall face, no organic rounded edges, no cohesive cliff/plateau
language.

A self-contained HTML prototype (the "Cliff + Floor + Entrance Suite") shows a
much better approach: an **auto-tiling cliff** with a vertical-shaded face,
rolled cap, and rounded organic corners, plus a **47-tile blob** floor
autotiler for clean plateau/ground edges. The shading gives walls a vertical
appearance while the ground stays flat, and convex/concave corner handling
makes rounded natural cliffs and plateaus.

## Goal

Port that cliff + floor + cap + blob system into the existing palette-locked,
deterministic, sha256-pinned art pipeline as a **new tileset**, producing the
desert enclosure set these three zones need: **`sand` plateau · `rock` cliff
face · `sand` base**, with organic `sand` floor edges (and `frostSand` /
`asphalt` transition partners). This replaces flat `rock` boulders with
auto-tiling vertical bluffs and supersedes `duneEdge`.

**Design priority: flexibility and variation over a fixed set.** The blob and
cliff machinery is data-driven over a `(over, base, material)` table so terrain
pairings and materials extend by data, not code — including a terrain over
itself for subtle ground variation. The three zones set the *initial* table, not
the system's ceiling.

Phase 1 ends at a **generated, pinned, visually-reviewed sheet**. Runtime
placement (an autotile assignment pass + `ZoneScene`/solidity wiring), the map
editor, and the other materials (ice / mossy / lava, ice floor, lava vents) are
explicitly out of scope and follow as later phases.

## Key enablers (already in the pipeline)

- `tools/pipeline/src/grid.ts` — `PixelGrid` (cells are `PaletteName | null`).
- `src/shared/palette.ts` — the locked palette. The warm ramp
  (`sandLight, sand, amber, clay, rust, umber, plum, ink`) is exactly what
  `owMountains.ts` already uses to render a rock cliff — so **no new palette
  colors are needed**.
- `tools/pipeline/src/rng.ts` — `mulberry32(seed)`, the only allowed randomness.
- `owMountains.ts` / `lakeShore.ts` — precedents for a pinned, autotiled rock
  terrain wired through `assets.ts` → `SHEET_KEYS` → `manifest.ts` (`TileSetDef`)
  → `index.ts`, with a per-sheet `describe` block in
  `tests/pipeline/determinism.test.ts`.
- `tools/pipeline/src/sheet.ts` — `composeSheet(frames, columns)` (row-major,
  `index = row*columns + col`; `columns` must divide the frame count).

The prototype's continuous free-RGB shading (`scale(color, k)`) is **not**
usable directly — every emitted pixel must be a `PaletteName`. The port
quantizes each computed shade onto a discrete named ramp (see Palette below).
The prototype's `Math.random`/`h2` randomness is replaced with `mulberry32` at a
fixed seed so builds are byte-identical.

## Architecture

New sheet-builder family under `tools/pipeline/src/cliffs/`:

```
cliffs/
  palette.ts     Named ramps: ROCK ramp + terrain fill ramps (sand/frostSand/asphalt).
                 Ordered PaletteName[] light→dark; a quantize(step01) → PaletteName helper.
  terrains.ts    floorFill(terrainKey, seed): PixelGrid  — palette-locked floor tiles
                 (ports the prototype's floorTile()).
  blob47.ts      The 47-tile canonical blob reduction + diagonal-aware mask→geometry.
                 blobTiles(baseFill, overFill, opts): { mask:number, grid:PixelGrid }[]
                 (ports canonical()/overlayMask()/buildBlobTile()). Self-contained —
                 does NOT modify the shared roundedMask.ts.
  cliffFace.ts   wallFace(seed): PixelGrid (rock stacked-stone course texture, ports
                 faceTile() rock mode) + cliffTiles(A): the 5×3 directional cliff set
                 (ports buildCliffTile()): variants outerW/mid/outerE/innerW/innerE ×
                 bands rim(cap)/face/footer, with vertical shading, cap roll-off,
                 convex-cut / concave-fillet rounded corners, footer contact + cast
                 shadow + scree.
  frames.ts      Assembles all of the above into ordered, named PixelGrid[] with an
                 append-only frame contract; exports cliffSheetFrames() and cliffTileNames().
```

Wired exactly like `owMountains`: `assets.ts` imports `cliffSheetFrames()`,
`composeSheet`s it, adds the key to `BuiltAssets` + `SHEET_KEYS`; `manifest.ts`
`buildManifest()` gets a `TileSetDef` (`{ file, tileSize, columns, names:
tileNames(cliffTileNames()) }`); `index.ts` adds `["cliff.png", assets.cliff]`
to its `sheets` array.

## The 47-blob floor autotiler (`blob47.ts`)

Ported from the prototype, which uses a **full 8-neighbor** bitmask:
N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128, set bit = "same terrain that
side". This is **self-contained in `blob47.ts` and deliberately distinct from**
the pipeline's existing 4-bit `roundedMask` numbering (N=1, E=2, S=4, W=8) —
the two do not share code or bit values, and that is fine: `blob47` computes and
consumes only its own masks, and `roundedMask` keeps serving owMountains/
lakeShore untouched. `canonical(m)` drops a diagonal bit whenever either
adjacent cardinal is absent (a diagonal only matters when both its cardinals are
present), reducing 256 masks to the canonical **47** set. Emitted in a stable
order (255/fully-interior first, then ascending) so frame indices are fixed. The
8-bit convention is documented in `blob47.ts` and is the contract any future
runtime assignment pass must reproduce.

Per-tile geometry (`overlayMask` + `buildBlobTile`):
- **Edge band**: the `over` terrain retreats from each open edge by `inset` px
  with `irreg`-scaled wobble that **tapers to zero at tile corners** (so the
  three/four tiles meeting at a corner agree on the band width — no seam
  spikes). This is the same corner-agreement discipline the prototype documents
  and `roundedMask` relies on.
- **Convex (outer) corner**: a quarter-circle arc (radius `round`), not a 45°
  chamfer — the organic rounded look.
- **Concave (inner) corner**: a pocket of `base` terrain whose depth at the seam
  is exactly `inset` (never noised — that would leave a spike); `round` only
  controls how square-vs-round the pocket is.
- **Outline / drop-shadow** options: a darkened edge pixel and a 1px shadow of
  `over` onto `base` on the north/northwest, quantized to palette (darken =
  step down the ramp, not multiply).

The blob machinery is a **general, data-driven `(over, base)` terrain-pair
generator** — flexibility over a fixed transition list is a deliberate design
goal. Any over-terrain can blob over any base-terrain (including a terrain over
**itself**), and adding a pairing is a one-line data entry, not new code. Two
edge *treatments* exist:

1. **Floor blob** (flat) — `over` terrain over `base` terrain with an outlined,
   lit-lip edge. **`sand` over `sand` is a first-class, wanted pairing**: it
   gives the subtle *walk-over elevation ledges and ground variation* seen on
   the left of the reference screenshot (a low step you can walk onto, not a
   cliff drop) — and it supersedes the single flat `duneEdge`. `sand`↔`asphalt`
   and `sand`↔`frostSand` are the same treatment across different terrains.
2. **Plateau-edge set** (cliff-topped) — same blob geometry, but the corner
   radius tracks the **cliff** rounding (`linkCorners`) and the south side is
   forced "matching" (the cliff rim owns that edge; no terrain bleed over the
   drop). This is the top surface of a full vertical cliff (right of the
   screenshot), as opposed to the flat floor ledge.

## The cliff set (`cliffFace.ts`)

`wallFace()` renders the rock course texture (stacked-stone cubes across
`courses` rows, palette-locked; ports `faceTile()` rock mode with
`ROCK.top/right/left/gap` → ramp steps). `cliffTiles(A)` then composes the
directional set (ports `buildCliffTile()`):

- **Columns / variants (5):** `outerW`, `mid`, `outerE`, `innerW`, `innerE` —
  the corner treatments. Outer (convex) corners cut the rim back and shade the
  outer edge; inner (concave) corners fillet the rim forward and deepen the
  inner edge. **The inner variants are what frame plain openings** (a gap left in
  the enclosure wall for a path/exit).
- **Rows / bands (3):** `rim` (the cap band — plateau rolls over the top with
  `caproll` roll-off and an optional lit lip), `face` (the wall face, repeats
  vertically for taller cliffs at placement time), `footer` (face → ground
  contact with a 1px dark contact line, `foot`-px cast shadow onto the ground,
  and optional `scree`).
- **Vertical-wall shading** comes entirely from ramp assignment: rim/cap lit =
  `sandLight`/`sand`; face top plane = `amber`; right plane = `clay`; left/shadow
  plane = `umber`; gap/mortar = `plum`; footer contact = `ink`. `cshade`/`ishade`
  quantize onto adjacent ramp steps at the outer/inner edges.

## Palette (`cliffs/palette.ts`)

No additions to `src/shared/palette.ts`. Ramps composed from existing names:

- **ROCK** (cliff face): `[sandLight, sand, amber, clay, rust, umber, plum, ink]`.
- **sand** fill: `[sandLight, sand, amber, sandShade]`.
- **frostSand** fill: `[bone, sandLight, skyBlue, sandShade]` (frost-touched).
- **asphalt** fill: `[slate, plum, indigo, ink]` (the US-95 road).

`quantize(step01, ramp)` maps a 0..1 shade to `ramp[round(step01*(n-1))]`. All
prototype `scale(color,k)` calls become ramp-index math.

## Output sheet, naming, manifest

- **One new sheet `cliff.png`**, `TILE_SIZE=16`, containing (in a fixed,
  documented, append-only order):
  1. cliff set — 15 tiles (`5 variants × 3 bands`);
  2. plateau-edge set — the raised `sand` top, corners matched to the cliff — 47 tiles;
  3. `sand`-over-`sand` floor blob — the walk-over elevation ledges / ground
     variation — 47 tiles;
  4. `sand`↔`asphalt` floor blob (sand encroaching on the US-95 road) — 47 tiles;
  5. `sand`↔`frostSand` floor blob (frost bleeding over sand) — 47 tiles;
  6. plain fills — `sand`, `frostSand`, `asphalt` (3).
  The `(over, base)` pairing list driving items 3–5 is a data table; new
  pairings are added there without touching the blob code. `columns` chosen to
  divide the total (exact count settled in the plan).
- **Naming** (fixed now; runtime solidity wiring is a later phase but the names
  must anticipate it):
  - cliff pieces: `cliffRock_<variant>_<band>` (e.g. `cliffRock_innerW_face`).
    A new `"cliffRock"` entry in `SOLID_PREFIXES` (later phase) makes them solid.
  - blob/plateau: `sandBlob_<mask>`, `sandPlateau_<mask>`,
    `sandFrostSand_<mask>`, `sandAsphalt_<mask>` (mask = canonical value).
  - fills: `sandFill`, `frostSandFill`, `asphaltFill` (names avoid colliding
    with the existing `sand`/`frostSand` tiles in `tiles.png`).
- **Manifest**: a `cliff` `TileSetDef` added to `buildManifest()`, mirroring the
  `owMountains` entry.

## Determinism, pinning, testing

- **Deterministic**: all generation via `mulberry32` at a fixed module seed;
  no `Math.random`/`Date`. Two `buildAssets()` runs are byte-identical.
- **Pinning**: a new `describe("cliff tileset byte-stability")` block in
  `tests/pipeline/determinism.test.ts` with a `FROZEN` sha256 for `cliff`,
  computed from `encodePng(assets.cliff)`.
- **Palette compliance**: existing pipeline tests assert every emitted pixel is
  a `PaletteName`; the cliff sheet must pass unchanged (guaranteed by using only
  ramp names).
- **Structure tests** (`tests/pipeline/`): frame count matches
  `cliffTileNames().length`; every name maps to a valid frame index; the 47-blob
  reduction yields exactly 47 canonical masks; the cliff set is exactly 15.
- **Visual review**: a small script (or a determinism-test artifact) renders
  `cliff.png` and an **assembled demo scene** (a boulder-edge zone re-skinned
  with the cliff set + an opening) to a PNG under a gitignored dir, sent for
  human eyeball before the sheet hash is locked. Mirrors the prototype's
  "assembled scene" so we confirm the enclosure + opening read correctly.

## Non-goals (later phases)

- Runtime: the autotile **assignment pass** (compute masks from a plateau/edge
  bitmap and place `cliffRock_*` / `sandBlob_*` tiles), `ZoneScene` 10th-tileset
  wiring, `isSolidName` registration, and actually re-skinning US-95 / homestead
  / trail in-game.
- Map-editor authoring of plateaus/cliffs.
- Other materials (ice wall, mossy rock wall, lava vents) and floors (ice floor);
  the material seam (`wallFace`) and terrain-fill data are built to accept them.
- Decorated entrances (door / mine / cave). Phase-1 openings are plain gaps
  framed by the inner-corner cliff variants.
