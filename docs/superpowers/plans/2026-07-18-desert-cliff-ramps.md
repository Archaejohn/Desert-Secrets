# Desert Cliff Ramps — Implementation Plan (Phase 1b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a walkable **ramp** tile group to the phase-1 cliff generator (`tools/pipeline/src/cliffs/`) in two materials (`sandSlope`, `stoneSteps`), flexible width, auto-scaling height, mirror-symmetric (both directions), with a `landing` tile for switchbacks. Build-time only; re-pin `cliff.png` after visual approval.

**Architecture:** New `ramps.ts` exports `rampTiles(material, params)` → 16 grids (4 width-cols × 4 rows). `generateTerrain` emits them when a preset lists `ramps`. Side walls reuse `wallFace("rock", …)`; the walkable surface is the terrain fill, shaded per row to read as an incline. Spec: `docs/superpowers/specs/2026-07-18-desert-cliff-ramps-design.md`.

**Tech Stack:** TypeScript, the existing `cliffs/` toolkit (`PixelGrid`, `wallFace`, `floorFill`, `ROCK`/`TERRAIN_RAMPS`, `shade`, `h2`), `vitest`.

## Global Constraints

- **Palette-locked, deterministic.** Every pixel a `PaletteName`; `mulberry32`/`h2` only, no `Math.random`/`Date`. Reuse existing ramps (`TERRAIN_RAMPS.sand`, `ROCK`); append a palette colour only if unavoidable — and if so, update the 3 LUTs (`fx.shadowOf`, `polish.contourOf`/`highlightOf`) + `fx.test.ts` append-order test (see the phase-1 spec's later-phases note).
- **Additive-only, re-pinned.** Ramp tiles append AFTER the existing 206 tiles; no existing frame index moves. `cliff` sha256 is re-pinned in `determinism.test.ts` — only after visual approval (Task 4 → Task 5).
- **16×16 tiles.** New real-tile count 206 → **238** (+32 = 2 materials × 16). `238 ≡ 6 (mod 8)`, so the existing +2 blank-pad reaches **240 = 8×30** — padding count is unchanged, but verify the total is divisible by the 8 columns.
- **Mirror-symmetric.** `rightEdge` is `leftEdge.mirrorX()` (and any directional lean mirrors), so ramps work descending left or right for free.
- **Build-time only.** No `src/game/` wiring, no collision. Ramp tiles are **walkable** (a phase-2 solidity note: register `rampSand_*`/`rampSteps_*` non-solid) — but nothing in `src/game` changes here.
- Git: branch `claude/desert-cliff-ramps`, commit per task, never `main`.

## File Structure

```
tools/pipeline/src/cliffs/ramps.ts     (new) rampTiles(material, params) + helpers
tools/pipeline/src/cliffs/generate.ts  (mod) TerrainParams.ramps; emit rampX_{col}_{row}
tools/pipeline/src/cliffs/presets.ts   (mod) desert preset: ramps: ["sandSlope","stoneSteps"]
tools/pipeline/src/cliffs/frames.ts    (mod) count 238; verify pad→240
tools/pipeline/render-cliff-review.mts (mod) demo scene with ramps + a switchback
tests/pipeline/cliffs.test.ts          (mod) ramp structure tests
tests/pipeline/determinism.test.ts     (mod) re-pin cliff sha256 (Task 5)
```

---

## Task 1: `ramps.ts` — scaffolding + side wall + `sandSlope`

**Files:**
- Create: `tools/pipeline/src/cliffs/ramps.ts`
- Test: `tests/pipeline/cliffs.test.ts` (append)

**Interfaces:**
- Produces: `type RampMaterial = "sandSlope" | "stoneSteps"`; `type RampCol = "narrow"|"leftEdge"|"middle"|"rightEdge"`; `type RampRow = "top"|"run"|"landing"|"bottom"`; `interface RampParams { material: RampMaterial; terrain: TerrainKey; wall: MaterialKey; height: number; slope: number; steps: number; seed: number }`; `function rampTiles(p: RampParams): { col: RampCol; row: RampRow; grid: PixelGrid }[]` (16 entries).
- Consumes: `wallFace` (materials.ts), `floorFill` (terrains.ts), `TERRAIN_RAMPS`/`ROCK`/`shade` (palette.ts), `h2` (noise.ts), `PixelGrid`.

- [ ] **Step 1: Write failing test** in `tests/pipeline/cliffs.test.ts`:
```ts
import { rampTiles } from "../../tools/pipeline/src/cliffs/ramps";
const RP = { material: "sandSlope" as const, terrain: "sand" as const, wall: "rock" as const, height: 2, slope: 0.5, steps: 3, seed: 7 };
describe("ramps", () => {
  it("sandSlope returns 16 tiles: 4 cols x 4 rows, palette-locked, opaque, deterministic", () => {
    const a = rampTiles(RP), b = rampTiles(RP);
    expect(a.length).toBe(16);
    const cols = new Set(a.map(t => t.col)), rows = new Set(a.map(t => t.row));
    expect([...cols].sort()).toEqual(["leftEdge","middle","narrow","rightEdge"]);
    expect([...rows].sort()).toEqual(["bottom","landing","run","top"]);
    a.forEach((t,i) => {
      expect(t.grid.width).toBe(16); expect(t.grid.countOpaque()).toBe(256);
      expect(t.grid.diff(b[i].grid)).toBe(0);
      t.grid.forEach((_x,_y,c) => { if (c!==null) expect(PALETTE).toHaveProperty(c); });
    });
  });
  it("rightEdge is the mirror of leftEdge (both-directions)", () => {
    const byKey = (t:{col:string;row:string}) => `${t.col}_${t.row}`;
    const m = new Map(rampTiles(RP).map(t => [byKey(t), t.grid]));
    for (const row of ["top","run","landing","bottom"]) {
      const l = m.get(`leftEdge_${row}`)!, r = m.get(`rightEdge_${row}`)!;
      expect(l.mirrorX().diff(r)).toBe(0);
    }
  });
});
```
- [ ] **Step 2: Run — expect FAIL** (`rampTiles` missing).
- [ ] **Step 3: Implement `ramps.ts`.** Structure:
  - `WALL_W = 4` (px) — the retaining-wall strip width. `rampWall(side, wall, seed): PixelGrid` — build a `wallFace(wall, DEFAULT_WALL_PARAMS, seed)` tile and take a `WALL_W`-wide vertical slice for the edge (or draw a simplified vertical rock strip using `ROCK` idx1/3/6). The wall reads as the cliff's stone, so the ramp cut matches.
  - `sandSlopeSurface(row, params): (x,y) => PaletteName` — the walkable surface for a `sandSlope` row, keyed off `row`:
    - `top` — the crest lip: top ~4px lit `shade(sand, idxSandLight)` (sandLight), rest uniform sand.
    - `run` — uniform mid sand (`TERRAIN_RAMPS.sand[1]`), with sparse `h2`-scattered flecks (same recipe as `floorFill` sand: `h2(x,y,seed+31)>0.95`→lighter, `>0.96`→darker) so it isn't dead flat and tiles cleanly at any height.
    - `landing` — flat platform: uniform sand, plus a 1px lit line at the very top edge and a 1px shadow line just below it (reads as a small step up onto a flat platform); no incline shading.
    - `bottom` — the foot: bottom ~5px shaded down the sand ramp toward `sandShade`/`umber` (in-shadow at the base).
  - `rampTiles(p)` composes each `(col, row)`: fill the tile with the surface; then stamp wall strips per column — `narrow` = both sides (left+right `WALL_W`), `leftEdge` = left only, `rightEdge` = **`mirrorX` of `leftEdge`** (build leftEdge, mirror it), `middle` = no walls. Return all 16 `{col,row,grid}`.
  - Only implement `material === "sandSlope"` this task (Task 2 adds `stoneSteps`); for `stoneSteps` throw `not implemented` for now, or branch and leave a stub the test doesn't hit.
- [ ] **Step 4: Run — expect PASS.** `npx vitest run tests/pipeline/cliffs.test.ts` + `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `cliffs: ramp tiles — sandSlope material (16 tiles, mirror-symmetric)`.

---

## Task 2: `stoneSteps` ramp surface

**Files:**
- Modify: `tools/pipeline/src/cliffs/ramps.ts`
- Test: `tests/pipeline/cliffs.test.ts` (append)

**Interfaces:**
- Consumes/Produces: adds the `material === "stoneSteps"` branch to `rampTiles`.

- [ ] **Step 1: Write failing test**:
```ts
it("stoneSteps returns 16 palette-locked deterministic tiles and differs from sandSlope", () => {
  const s = rampTiles({ ...RP, material: "stoneSteps" });
  expect(s.length).toBe(16);
  s.forEach(t => { expect(t.grid.countOpaque()).toBe(256);
    t.grid.forEach((_x,_y,c)=>{ if(c!==null) expect(PALETTE).toHaveProperty(c); }); });
  // the run surface must differ between materials
  const runSand = rampTiles(RP).find(t=>t.col==="middle"&&t.row==="run")!.grid;
  const runSteps = s.find(t=>t.col==="middle"&&t.row==="run")!.grid;
  expect(runSand.diff(runSteps)).toBeGreaterThan(0);
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `stoneSteps` surface. `stepRows(row, params)`: render horizontal steps in the `ROCK` stone ramp. A step = a lit tread (top 1px of the step: `shade(ROCK, ROCK_TOP, -1)` ≈ stoneLit) + step body (`ROCK` idx3 stone) + a 1px riser shadow at the step's bottom (`shade(ROCK, …, +2)` ≈ deep). `steps` per 16px run tile ≈ `max(2, params.steps)` evenly spaced (use `partition`/even division). Rows:
    - `top` — the top step meeting the plateau (a tread flush with the crest).
    - `run` — the repeating step pattern (aligns tile-to-tile: derive step Y from `y` global-in-tile so stacked run tiles form a continuous flight).
    - `landing` — a single flat wide tread (a platform), no risers, with a lit top edge + shadow line (like sandSlope landing but stone).
    - `bottom` — the bottom step meeting the ground.
  Walls: same `rampWall`/`mirrorX` column composition as Task 1 (factor the column-stamping into a shared helper so both materials use it).
- [ ] **Step 4: Run — expect PASS** + tsc clean.
- [ ] **Step 5: Commit** `cliffs: ramp tiles — stoneSteps material`.

---

## Task 3: Integrate into `generateTerrain` + presets + sheet

**Files:**
- Modify: `tools/pipeline/src/cliffs/generate.ts` (`TerrainParams.ramps`, emit tiles), `tools/pipeline/src/cliffs/presets.ts` (add `ramps`), `tools/pipeline/src/cliffs/frames.ts` (count + pad check)
- Test: `tests/pipeline/cliffs.test.ts`

**Interfaces:**
- Consumes: `rampTiles`. Produces: names `rampSand_{col}_{row}` (sandSlope) and `rampSteps_{col}_{row}` (stoneSteps).

- [ ] **Step 1: Write failing test**:
```ts
it("desert preset emits the ramp tiles; total sheet is 238 named tiles", () => {
  const out = generateTerrain(DESERT_PRESETS[0]).map(o=>o.name);
  expect(out.filter(n=>n.startsWith("rampSand_")).length).toBe(16);
  expect(out.filter(n=>n.startsWith("rampSteps_")).length).toBe(16);
  expect(new Set(out).size).toBe(out.length);   // unique
  expect(out.length).toBe(238);                 // 206 + 32
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** In `generate.ts`: add `ramps: RampMaterial[]` to `TerrainParams`; after the existing groups, for each `m` in `p.ramps`, call `rampTiles({ material: m, terrain: p.plateauTop, wall: p.material, height: p.cliffHeight, slope: 0.5, steps: 3, seed: p.seed })` and push `{ name: \`${m === "sandSlope" ? "rampSand" : "rampSteps"}_${t.col}_${t.row}\`, grid: t.grid }`. In `presets.ts`: add `ramps: ["sandSlope", "stoneSteps"]` to the desert preset. In `frames.ts`: the real-tile count now derives to 238 automatically; verify `(238 + PADDING_FRAME_COUNT) % 8 === 0` (it is, `+2 → 240`); if `frames.ts` hardcodes a pad-to-208 target, change it to pad to the next multiple of 8 ≥ real count (derive, don't hardcode 240).
- [ ] **Step 4: Run** `npx vitest run tests/pipeline/cliffs.test.ts` (PASS) + `npm run art` (writes cliff.png at 128×480 = 8×30) + `npx tsc --noEmit` clean. Note: this will FAIL the existing `determinism.test.ts` cliff pin (sheet changed) — expected; Task 5 re-pins after visual approval. Confirm only that pin fails and nothing else.
- [ ] **Step 5: Commit** `cliffs: emit ramp tiles into the sheet (238 tiles); desert preset lists both ramps`.

---

## Task 4: Visual-review render (ramps + switchback) — STOP for approval

**Files:**
- Modify: `tools/pipeline/render-cliff-review.mts`
- Test: `tests/pipeline/cliffs.test.ts` (ramp col/row coverage assertions)

- [ ] **Step 1:** Add structure asserts: the 16 `rampSand_*` names cover all 4 cols × 4 rows; same for `rampSteps_*`.
- [ ] **Step 2:** Extend the demo scene: keep the existing plateau + opening, and add (a) a **`sandSlope` ramp** descending the south wall on the left (a 2-wide cut: `leftEdge`+`rightEdge`, `top` at the rim, `run`×cliffHeight, `bottom` at the foot), (b) a **`stoneSteps` ramp** on the right (1-wide `narrow` column), and (c) a **switchback**: `top → run → landing → run → bottom`, with the second flight mirrored/offset one tile from the first, to eyeball the landing turn. Build a small `name→grid` map from `generateTerrain` and blit by name.
- [ ] **Step 3:** `npm run art` (if stale) then `npx tsx tools/pipeline/render-cliff-review.mts`; confirm the scene PNG renders. `npx tsc --noEmit` clean.
- [ ] **Step 4: Commit** (code only; PNGs gitignored) `cliffs: visual-review render — ramps + switchback demo`.
- [ ] **Step 5: STOP.** Surface `.review/cliff-scene*.png` to the human: does the incline read (sandSlope), do the steps read (stoneSteps), does the landing/switchback turn read, do the walls/plateau/ground connect cleanly? Tune `slope`/`steps`/`WALL_W`/row shading and re-render until approved. **Do not proceed to Task 5 (the pin) until approved** — pinning locks the look.

---

## Task 5: Re-pin the sheet (after visual approval)

**Files:**
- Modify: `tests/pipeline/determinism.test.ts`

- [ ] **Step 1:** Recompute: `sha256sum src/assets/generated/cliff.png` (equals `encodePng(buildAssets().cliff)` since the file is written that way).
- [ ] **Step 2:** Replace the `cliff` FROZEN hash in the `cliff tileset byte-stability` block with the new value; update the comment to note the ramp tiles were added (206→238, +sandSlope/+stoneSteps ramps).
- [ ] **Step 3:** Full gate: `npx vitest run tests/pipeline` (determinism + cliffs pass), `npm run art` (byte-stable), `npx tsc --noEmit`, `npm run build`, and `npx vitest run` (full suite).
- [ ] **Step 4: Commit** `cliffs: re-pin cliff.png sha256 (ramp tiles added, look approved)`.
- [ ] **Step 5:** Open the PR into `main` (regular merge commit, per CLAUDE.md).

---

## Self-Review

**Spec coverage:** two ramp materials sandSlope/stoneSteps (Tasks 1–2) · flexible width narrow/left/mid/right (Task 1 columns) · 4 rows incl. landing (Tasks 1–2) · mirror-symmetric both-directions (Task 1 mirror test) · switchback pieces + demo (Task 4) · reuse rock wall + terrain fill (Task 1 side wall + surface) · palette-locked/deterministic (all tasks) · generateTerrain/presets integration (Task 3) · sheet 238 + re-pad + re-pin (Tasks 3,5) · visual review before pin (Task 4) · build-time only, walkable/non-solid note, no src/game (Global Constraints). All spec sections map to a task.

**Placeholder scan:** the row-by-row shading recipes (sandSlope crest/run/landing/foot; stoneSteps tread/riser) are concrete; `slope`/`steps`/`WALL_W` are named tuning knobs surfaced at Task 4's visual gate; the FROZEN hash is compute-and-fill (Task 5). No vague requirements.

**Type consistency:** `RampMaterial`/`RampCol`/`RampRow`/`RampParams`/`rampTiles` are used identically across Tasks 1–4; names `rampSand_`/`rampSteps_` fixed in Task 3 and asserted in Tasks 3–4; `mirrorX` reused from `PixelGrid`.

**Known risk:** the `run` tile must align tile-to-tile so stacked run rows form a continuous flight (esp. stoneSteps) — derive step/shade Y from the in-tile `y` with a period that divides 16, and the visual review (Task 4) is the gate that catches seams.
