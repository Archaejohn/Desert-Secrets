# Desert Cliff Ramps — Generator Extension Design (Phase 1b)

**Date:** 2026-07-18
**Status:** Approved design, pending implementation plan
**Scope:** `tools/pipeline/` only — extends the phase-1 cliff generator with a walkable **ramp** tile group. No runtime placement/collision (phase 2). Builds directly on `docs/superpowers/specs/2026-07-18-desert-cliff-tileset-design.md`.

## Problem

The phase-1 cliff set makes an impassable 2.5D wall; there is no way to walk between the plateau level and the ground level. The game currently handles vertical traversal only narratively (ladders/shafts like `seaAscent`), never with a walkable slope. To use the cliffs for real level traversal we need **ramps**: a passable slot through the cliff, floored as an incline, that auto-tiles like the rest of the set.

## Goal

Add a **ramp tile group** to the parametric generator, in two selectable ramp **materials** — `sandSlope` (smooth natural incline) and `stoneSteps` (carved stairs) — that auto-tile down the cliff's south face at flexible width and auto-scaling height, reusing the existing `rock` cliff material for the cut's side walls and the terrain fills for the walkable surface.

Phase 1b ends at a **generated, re-pinned, visually-reviewed** `cliff.png` with the ramp tiles added. Runtime placement (the autotile assignment pass that detects a ramp cell and lays `rampSand_*`/`rampSteps_*` + flanking cliff tiles) and collision/traversal are phase-2 non-goals — but the tiles are designed to auto-tile now.

## Model (why a ramp is a floored opening)

In the flat-tilemap 2.5D, "levels" are a visual convention: the plateau top and the ground are the same walkable plane; the cliff face is a solid wall drawn to look like a drop. A **ramp is a passable slot through the cliff** — mechanically like the openings the inner-corner cliff variants already frame — but **floored with slope-shaded tiles** instead of flat ground, so it reads as walking down/up the height. Its side walls are the `rock` cliff material (a retaining cut); its walkable center is the terrain, shaded to imply incline.

## Architecture

New module `tools/pipeline/src/cliffs/ramps.ts`:

```ts
type RampMaterial = "sandSlope" | "stoneSteps";
interface RampParams {
  material: RampMaterial;
  terrain: TerrainKey;   // walkable surface (sand for the desert preset)
  wall: MaterialKey;     // side-wall material — "rock" (reuses wallFace/ROCK)
  height: number;        // run rows (matches cliffHeight); the run tile repeats
  slope: number;         // directional shade strength for sandSlope
  steps: number;         // step-row count for stoneSteps (derived from height if 0)
  seed: number;
}
function rampTiles(p: RampParams): { col: RampCol; row: RampRow; grid: PixelGrid }[];
```

Called by `generateTerrain` when a preset requests ramps (a new `ramps: RampMaterial[]` field on `TerrainParams`; `presets.ts` desert preset lists `["sandSlope", "stoneSteps"]`). Emits the ramp tiles into the same sheet, appended after the existing groups.

## The tile grid (per ramp material)

4 width-columns × 3 height-rows = **12 tiles**:

- **Columns** (`RampCol`): `narrow` (1-wide, both side walls), `leftEdge` (left wall + slope), `middle` (slope only, repeats for width), `rightEdge` (right wall + slope).
- **Rows** (`RampRow`): `top` (the lip where the plateau opens onto the ramp), `run` (the slope surface, repeats ×height), `bottom` (the foot where the ramp meets the ground).

Runtime placement (phase 2) picks the **column** from the ramp cell's left/right neighbors (same idea as the cliff south-edge variant selection) and the **row** from top/middle/bottom of the run. One set serves a 1-wide stair (`narrow`) through a 4-wide grand ramp (`leftEdge` + `middle`×2 + `rightEdge`).

## The two materials

Both draw the side walls with `wallFace("rock", …)` (the existing cool-navy stone) so a ramp cut matches the cliff it sits in; they differ in the walkable surface:

- **`sandSlope`** — the `terrain` fill, with the incline read carried by the **three rows**, NOT by a gradient inside the repeating `run` tile (a single repeated tile can't hold a continuous gradient without banding). So: the `top` lip is lit (`sandLight`, catching the crest light), the `run` tile is a **uniform mid** sand (repeats cleanly for any height), and the `bottom` foot is shaded (`sandShade`/`umber`, in-shadow at the base). The lit-crest + shaded-foot bracketing the neutral run is enough to read as a slope. Subtle hash-scatter flecks (as in the sand fill) keep it alive. Quantized to the sand ramp per the phase-1 Quantization Strategy. (If a stronger continuous incline is wanted later, that's a per-run-position variant — out of scope for phase 1b.)
- **`stoneSteps`** — discrete **horizontal step rows** in the stone: each step = a lit tread edge (top pixels) + a shadowed riser (bottom pixels), `steps` count derived from `height` (e.g. 2–3 steps per run tile). Uses the `ROCK`/stone ramp for the treads, quantized.

## Naming, sheet, pinning

- **Names:** `rampSand_{col}_{row}` (sandSlope) and `rampSteps_{col}_{row}` (stoneSteps) — 24 new tiles. (`ramp` + material + col + row; anticipates a `SOLID`-adjacent registration but ramps are **walkable**, so a phase-2 note: register them **non-solid**, distinct from `cliffRock_*` which is solid.)
- **Sheet:** frame count 206 → **230**; re-pad to **232** (8 columns × 29 rows, 2 blank pad frames). Append-only after the existing groups — no existing frame index moves.
- **Pinning:** the `cliff` sha256 in `tests/pipeline/determinism.test.ts` is **re-pinned** (the sheet changed). Re-pin only after visual approval, same gate as phase 1.
- **Palette:** aim to reuse existing ramps (sand `TERRAIN_RAMPS.sand`, cool `ROCK`). If the slope gradient or step treads need a shade the ramps lack, append palette colors — and pay the 3-LUT cost noted in the phase-1 spec's later-phases section.

## Testing

- **Structure tests** (`cliffs.test.ts`): `rampTiles("sandSlope", …)` and `("stoneSteps", …)` each return 12 tiles covering all 4 cols × 3 rows; palette-locked; deterministic; the total sheet name count = 230.
- **Determinism:** `mulberry32`/`h2` only; two builds byte-identical; sha256 re-pinned.
- **Visual review:** extend `render-cliff-review.mts` to render a demo scene with a **ramp cut through the cliff** (both materials) — a plateau with a `sandSlope` ramp on one side and a `stoneSteps` ramp on the other, descending to the ground — to eyeball the incline read and the wall/plateau/ground connections before re-pinning.

## Non-goals (phase 2+)

- Runtime: the autotile assignment pass that detects ramp cells (from a map annotation) and lays the ramp columns/rows + flanking cliff, `ZoneScene` wiring, and **collision/traversal** (letting the player actually walk the ramp between levels).
- Multi-direction ramps (east/west/north-facing) — tied to multi-direction cliffs, not built yet. South-facing only.
- Corners/turns in a ramp, landings/switchbacks.
