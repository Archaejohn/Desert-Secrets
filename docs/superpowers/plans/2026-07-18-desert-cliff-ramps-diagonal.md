# Desert Cliff Diagonal Ramps — Implementation Plan (Phase 1c)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. NOTE: the diagonal-rendering tasks (1–4) are exploratory pixel art — expect controller-led visual iteration (render → eyeball → adjust) at each, not one-shot subagent output.

**Goal:** Add self-contained, placeable **diagonal** ramp/stair runs at 3 clean pixel-slope angles (26.57°/45°/63.43°), both directions (mirror), both materials (`stoneSteps`, `sandSlope`), with caps + a `landing` (switchback), on the existing `claude/desert-cliff-ramps` branch. Keep the straight ramps. Re-pin `cliff.png` once at the end (straight + diagonal) after visual approval.

**Architecture:** New `tools/pipeline/src/cliffs/diagonalRamps.ts` exports `diagonalRampTiles(material, params)` → `{ angle, dir, piece, grid }[]`. `generateTerrain` emits them (`dramp*` names) when a preset requests diagonals. Reuses `wallFace` (edges), `TERRAIN_RAMPS`/`ROCK`/`shade`/`h2`. Spec: `docs/superpowers/specs/2026-07-18-desert-cliff-ramps-diagonal-design.md`.

## Global Constraints

- Palette-locked, deterministic (`mulberry32`/`h2`, no `Math.random`/`Date`). Reuse existing ramps; append a palette colour only if unavoidable (then the 3-LUT + fx.test cost).
- **Clean tiling by integer ratio:** 45° = 1:1 (1 run tile), 26.57° = 2:1 (2-wide period), 63.43° = 1:2 (2-tall period). Run pieces MUST continue across their tile-advance seam — derive step/band phase from global-in-run position with a period dividing the tile span.
- **Both directions** = `mirrorX` pair; `sw` = `se.mirrorX()` built once and mirrored, emitted as distinct tiles.
- Additive-only; append after existing groups; **re-pin once** at the end (Task 7) after approval. Sheet 238 → **286** (+48), derived pad → **288** (8×36).
- Build-time only; ramps walkable/non-solid (phase-2 note); no `src/game/` changes.
- Git: branch `claude/desert-cliff-ramps`, commit per task.

## Naming

`dramp{Mat}{Angle}_{dir}_{piece}`; `Mat`∈`Steps|Sand`, `Angle`∈`2651|45|6343`, `dir`∈`se|sw`, `piece`∈`run|runA|runB|runU|runL|capTop|capBottom`. Landing is angle-independent: `dramp{Mat}_{dir}_landing`.

---

## Task 1: 45° `stoneSteps` diagonal — prototype the look (controller-led, visual)

**Files:** Create `tools/pipeline/src/cliffs/diagonalRamps.ts`; extend `render-cliff-review.mts` (a scratch preview of a 45° stair run + its up-diagonal tiling); test `tests/pipeline/cliffs.test.ts`.

Goal: a single 45° `se` `stoneSteps` `run` tile that, placed along the diagonal (x+1,y+1), forms a **continuous, clean** staircase, plus `capTop`/`capBottom`. This proves the diagonal approach before scaling.

- [ ] **Step 1:** Implement `diagonalRampTiles("stoneSteps", { angles:[45], dir:"se", … })` returning `run`/`capTop`/`capBottom` for 45°. Steps: ~4×4 treads stepping down-right; tread = `shade(ROCK,1,-1)`, body `ROCK[3]`, riser `shade(ROCK,6,+1)`; retaining edge (`wallFace` slice) on the downhill side. Phase derived from `(x - y)` or `(x + y)` mod a divisor of 16 so the down-diagonal neighbor continues seamlessly.
- [ ] **Step 2:** Add a scratch render (a 6-tile 45° run down a small terrace) to `render-cliff-review.mts`; `npm run art` + `npx tsx …`; **controller eyeballs** `.review/` PNG: does it read as clean continuous diagonal stairs with no tile seam? Iterate Step 1 until it does.
- [ ] **Step 3:** Write structure test: `diagonalRampTiles("stoneSteps",{angles:[45],dir:"se"})` returns `run`+`capTop`+`capBottom`, 16×16, opaque, palette-locked, deterministic. Run green; `tsc` clean.
- [ ] **Step 4:** Commit `cliffs: diagonal 45° stoneSteps run + caps (prototype)`.

---

## Task 2: 45° `sandSlope` diagonal

- [ ] **Step 1:** Add the `sandSlope` branch: a smooth diagonal sand band, lit uphill edge → shaded downhill edge, hash-flecks; same edge/seam discipline. `run`/`capTop`/`capBottom` for 45° `se`.
- [ ] **Step 2:** Render + controller eyeball (a 45° sand ramp next to the stairs); iterate until the incline reads.
- [ ] **Step 3:** Test (16 tiles-shape parity with stoneSteps for 45°); green; `tsc` clean.
- [ ] **Step 4:** Commit `cliffs: diagonal 45° sandSlope run + caps`.

---

## Task 3: shallow (26.57°) + steep (63.43°) angles, both materials

- [ ] **Step 1:** Add 26.57° (`runA`+`runB`, 2-wide period, ~8×4 shallow steps / shallow sand band) and 63.43° (`runU`+`runL`, 2-tall period, tall steps / steep band) for both materials, `se`. Seam continuity across the 2-tile period is the critical check.
- [ ] **Step 2:** Render all three angles × both materials in a row; **controller eyeball**: each tiles cleanly, the three slopes read as distinctly shallow/45/steep. Iterate.
- [ ] **Step 3:** Tests: all angle/piece names present per material for `se`; palette/opaque/deterministic. Green; `tsc` clean.
- [ ] **Step 4:** Commit `cliffs: diagonal 26.57° + 63.43° stoneSteps + sandSlope`.

---

## Task 4: landings + both directions (mirror)

- [ ] **Step 1:** Add the `landing` tile per material (flat walkable platform, cliff-walled) and make `diagonalRampTiles` emit the `sw` direction as `mirrorX` of every `se` piece (build `se`, mirror). Assert `sw_piece === se_piece.mirrorX()`.
- [ ] **Step 2:** Render a **switchback** (se run → landing → sw run) per material; controller eyeball the landing/turn reads. Iterate.
- [ ] **Step 3:** Tests: full 48-tile matrix (2 mat × 2 dir × {45:3, 2651:4, 6343:4, landing:1}); mirror parity; determinism. Green; `tsc`.
- [ ] **Step 4:** Commit `cliffs: diagonal ramp landings + both directions (mirror)`.

---

## Task 5: Integrate into `generateTerrain` + presets + sheet (subagent)

- [ ] **Step 1 (TDD):** Test — `generateTerrain(DESERT_PRESETS[0])` emits 48 `dramp*` names (matrix complete, unique); total sheet = **286**.
- [ ] **Step 2:** In `generate.ts`: add `diagonalRamps: boolean` (or reuse `ramps`) to `TerrainParams`; when set, push `diagonalRampTiles(...)` for both materials with `dramp{Mat}{Angle}_{dir}_{piece}` names. In `presets.ts`: enable for the desert preset. `frames.ts` padding is derived — verify 286→288.
- [ ] **Step 3:** `npm run art` (cliff.png 128×576 = 8×36), `npx vitest run tests/pipeline/cliffs.test.ts` green, `tsc` clean; confirm the ONLY `tests/pipeline` failure is the cliff pin (expected — Task 7 re-pins). Commit `cliffs: emit diagonal ramp tiles (286 tiles)`.

---

## Task 6: Visual-review demo (all angles + switchbacks) — STOP for approval

- [ ] **Step 1:** Extend `render-cliff-review.mts`: a terrace descended by a 45°, a 26.57°, and a 63.43° stair; a sand ramp; and a switchback — both materials represented. Blit `dramp*` by name.
- [ ] **Step 2:** `npm run art` + render; commit the render script (`cliffs: diagonal ramps visual demo`).
- [ ] **Step 3: STOP.** Controller surfaces the scene to the owner; tune until each angle/material/landing reads right and tiling is seam-free. **Do not pin until approved.**

---

## Task 7: Re-pin (straight + diagonal) + PR (after approval)

- [ ] **Step 1:** `sha256sum src/assets/generated/cliff.png`; update the `cliff` FROZEN hash in `determinism.test.ts` (note: straight + diagonal ramps added, 206→286).
- [ ] **Step 2:** Full gate: `npx vitest run` (all), `npm run build`, `tsc`. All green.
- [ ] **Step 3:** Commit `cliffs: re-pin cliff.png (straight + diagonal ramps, approved)`; push; open PR into `main` (regular merge commit).

---

## Self-Review

**Spec coverage:** 3 angles with integer-ratio tiling (Tasks 1–3, constraints) · both materials (Tasks 1–3) · both directions via mirror (Task 4) · caps (Tasks 1–3) · landing/switchback (Task 4, demo Task 6) · self-contained placeable (naming/architecture) · reuse rock edges + terrain (Tasks 1–2) · palette-locked/deterministic (all) · integrate + 286 + derived pad (Task 5) · re-pin once with straight+diagonal (Task 7) · visual gate before pin (Task 6) · build-time only, no src/game (constraints). All spec sections mapped.

**Placeholder scan:** the rendering recipes are approximate BY DESIGN — these tasks are visual-iteration (Step 2 "controller eyeball … iterate") because clean diagonal pixel art can't be one-shot specified; the tuning knobs (step size, edge width, band shading, phase divisor) are named and adjusted at each task's render. Not vague requirements — an explicit iterate-to-look loop with concrete acceptance ("tiles seamlessly, reads as the angle").

**Type consistency:** `diagonalRampTiles`, `dramp{Mat}{Angle}_{dir}_{piece}`, the piece set, and mirror parity are used consistently across tasks; integrates with the existing `TerrainParams`/`generateTerrain`/`frames.ts` derived-padding from phase 1b.

**Known risk:** seam continuity across the 2-tile periods (26.57°/63.43°) is the hardest correctness point — the phase-must-derive-from-global-position rule and the per-task render eyeball are the guards; a mis-phased run tile shows an obvious break at the seam in the demo.
