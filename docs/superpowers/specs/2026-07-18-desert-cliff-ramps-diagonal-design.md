# Desert Cliff Ramps — Diagonal Multi-Angle Design (Phase 1c)

**Date:** 2026-07-18
**Status:** Approved design, pending implementation plan
**Scope:** `tools/pipeline/` only. Adds **diagonal** ramps/stairs (FF6-style terraced staircases) alongside the straight ramps from phase 1b (which are kept). Build-time generator; runtime placement/collision is phase 2. Builds on `2026-07-18-desert-cliff-ramps-design.md`.

## Problem

The phase-1b ramps are straight vertical cuts through the cliff. The owner's references (FF6-style terraced maps) want **diagonal** ramps and stairs that run at an angle to connect terraced levels, switchbacking by alternating diagonal flights — the classic JRPG mountain path. Straight ramps stay (valid for straight-ahead descents); diagonal is added.

## Goal

Add **self-contained, placeable diagonal ramp/stair runs** in **three slope angles**, **both diagonal directions**, and **both materials** (`stoneSteps`, `sandSlope`), that tile cleanly along their diagonal and support switchbacks via a flat `landing` turn tile. A map author places a run (caps + N run tiles + landings) to connect a higher and a lower area — the FF6 model, not force-fit onto the organic 47-blob cliff edge.

## The three angles (clean pixel-slope ratios)

Chosen because integer tile-ratios tile seamlessly:

| Angle | Ratio (across : down) | Tile period | Feel |
|---|---|---|---|
| **26.57°** | 2 : 1 | 2 wide × 1 tall (2 run tiles) | shallow |
| **45°** | 1 : 1 | 1 × 1 (1 run tile) | canonical |
| **63.43°** | 1 : 2 | 1 wide × 2 tall (2 run tiles) | steep |

"Across : down" is the tile advance of the run. A run descends from an **upper** end to a **lower** end. Direction `se` (descends toward lower-right, advancing +x each step) and its mirror `sw` (lower-left, `mirrorX` — free).

## Tile inventory (per material)

For each material `{stoneSteps, sandSlope}`, each direction `{se, sw}` (sw = `se.mirrorX()`), each angle:

- **45°**: `run` (1) + `capTop` + `capBottom` = 3
- **26.57°**: `runA` + `runB` (the 2-wide period) + `capTop` + `capBottom` = 4
- **63.43°**: `runU` + `runL` (the 2-tall period) + `capTop` + `capBottom` = 4
- **`landing`** (shared across angles, per direction): 1 — the flat turn platform where a switchback reverses.

Per material per direction: 3 + 4 + 4 + 1 = **12**. Both directions: 24. Both materials: **48 diagonal tiles**.

Naming: `dramp{Mat}{Angle}_{dir}_{piece}` — e.g. `drampSteps45_se_run`, `drampSand2651_sw_runA`, `drampSteps6343_se_capBottom`, `drampSand_se_landing`. (`Angle` ∈ `2651`|`45`|`6343`; `Mat` ∈ `Steps`|`Sand`; `dir` ∈ `se`|`sw`.) `landing` is angle-independent so it drops the angle: `dramp{Mat}_{dir}_landing`.

## Rendering (per material)

A diagonal run tile draws the sloped surface as a **diagonal band** crossing the tile at the angle, with the terrain/steps on the band and cliff-material retaining edges on its uphill and downhill sides (so it reads as cut into the slope). The band's centerline advances per the angle's ratio and must exit the tile so the next run tile (placed at the angle's tile-advance) continues it — periodicity guaranteed by the integer ratios.

- **`stoneSteps`** — discrete steps along the diagonal: a step is a lit tread edge + `ROCK` stone body + a riser shadow. Step size follows the angle: 45° ≈ 4×4 steps stepping down-right; 26.57° ≈ wide-shallow steps (≈8 wide × 4 tall) over the 2-tile period; 63.43° ≈ tall-steep steps over the 2-tall period. Steps derive their phase from global-in-run position so stacked/adjacent run tiles form a continuous flight (same divisor-of-16 discipline as phase-1b `stepHeight`).
- **`sandSlope`** — a smooth sand band along the diagonal, lit on the uphill edge and shaded on the downhill edge (`sandLight` → `sand` → `sandShade`), reading as an incline; sparse hash-flecks as in the sand fill.

Both use `wallFace("rock", …)` for the retaining edges (matching the cliff). Palette-locked via the phase-1 Quantization Strategy (`ROCK`/`TERRAIN_RAMPS`/`shade`).

**End caps:** `capTop` transitions the run's upper end into the upper terrace (plateau) — a short flat lip. `capBottom` transitions the lower end into the ground — the foot. **Landing:** a flat walkable platform (cliff-walled) that joins an incoming flight to an outgoing flight in the opposite diagonal direction — the switchback pivot.

## Directions & switchbacks

- **Both directions** are a `mirrorX` pair (`sw` = `se.mirrorX()`), generated as distinct sheet tiles (the runtime blits, doesn't flip).
- **Switchback** = `capTop → run(×k) → landing → run(×k, opposite dir) → … → capBottom`. The landing reverses the diagonal. Assembling a specific switchback layout is **phase-2 placement**; phase 1c generates the pieces and the visual-review demo shows one per angle.

## Sheet, pinning, testing

- **Names/count:** +48 diagonal tiles. Current sheet is 238 (206 base + 32 straight ramps); diagonal brings it to **286**. Re-pad to the next multiple of 8 = **288** (8 × 36); the `frames.ts` padding is already derived, so it just works. Append-only after existing groups.
- **Re-pin:** the `cliff` sha256 is re-pinned once, after visual approval, covering straight + diagonal ramps.
- **Structure tests:** `diagonalRampTiles` returns the full set per material (all angles × pieces × dirs); the 48 diagonal names cover the matrix; palette-locked; deterministic; `sw` = `se.mirrorX()` per piece; total sheet = 286.
- **Visual review:** extend `render-cliff-review.mts` — a demo terrace descended by a **45°**, a **26.57°**, and a **63.43°** stair, one **sand ramp**, and one **switchback**, to eyeball each angle's tiling continuity, the diagonal read, caps, and the landing turn, before re-pinning.

## Non-goals (phase 2+)

- Runtime: placement (which run tiles/landings go where to build a specific diagonal/switchback), `ZoneScene` wiring, collision/traversal.
- Angles beyond the three; curved ramps; ramps that also turn a map corner.
- Auto-tiling the diagonal onto the organic 47-blob cliff edge (the runs are self-contained/placeable).
