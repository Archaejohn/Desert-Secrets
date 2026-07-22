# Phase W2b — Wall-In-Zone Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. NOTE: Task 3 (WallView placement) is **controller-implemented + iterated at the capture gate** — it is exploratory alignment work, not a blind hand-off.

**Goal:** Render the `minestone` raycast wall as a raised, traversable-shaped ledge in the first Cinnabar Mine room — a solid wall band with the composite-ground floor above and below it, the wall face baked from `renderWall` and placed aligned to the band (face below actors, crest on the overhead layer), talus settling onto the lower floor.

**Architecture:** Add the ledge to `mineMap.ts`; opt `MineScene` onto composite ground; add a game-side `WallView` (runtime-bake pattern of `CompositeGroundView`) that bakes `renderWall`, places it aligned to a wall-band tile-rect, and splits it into a below-actors face image + an overhead crest image. Wired via a new `ZoneConfig.walls?` declaration. Seed threading and the walkable ramp are OUT of W2b (ramp is W2c; seed threading deferred until >1 wall exists).

**Tech Stack:** TypeScript, Phaser (`src/game/gfx/`, `ZoneScene`, `MineScene`, `mineMap`), the W1 `tools/pipeline/src/walls/` generator, Vitest, Playwright smoke.

## Global Constraints

- **Non-overlapping ledge, no stack-levels:** wall-band tiles solid, plateau + lower floor walkable; foot-Y sort + overhead layer for depth. No `level` attribute.
- **Reuse:** `renderWall` (W1), `CompositeGroundView` pattern, `terrainGrid`/`groundTerrain` tables, the overhead layer (depth 5000), name-based collision.
- **BFS reachability:** the ledge must keep the mine room reachable/enclosed (`tests/game/maps.test.ts`).
- **Palette-lock / determinism** carry from W1 (the wall render is palette-locked).
- **Verification bar:** `tsc`, `vitest`, `build`, `smoke`, `smoke:touch` (W2b touches `src/game/`).
- **Git:** branch `claude/runtime-walls-w2`; commit footers end with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Kji7iDdsHmjhHj3oMyRLk6
  ```

## File Structure

- Modify `src/game/maps/mineMap.ts` — the ledge (wall band / plateau / lower floor / ramp-gap placeholder).
- Modify `src/game/maps/groundTerrain.ts` — `MINE_GROUND_TO_TERRAIN` + default.
- Create `src/game/gfx/WallView.ts` — bake + place + depth-split the wall.
- Modify `src/game/ZoneScene.ts` — `ZoneConfig.walls?` + build WallViews in `setupCompositeGround` (or a sibling).
- Modify `src/game/scenes/MineScene.ts` — opt in (composite + the wall declaration).
- Modify `tools/pipeline/src/walls/renderWall.ts` — return the projected-bounds offset `x0`/`y0` (needed for placement).
- Tests: `tests/game/groundTerrain.test.ts`, `tests/game/maps.test.ts`; `tools/smoke/shots/w2-mine.spec.ts`.

---

### Task 1: The mine ledge in `mineMap.ts`

Add a raised ledge to the first chamber (~tiles 12–17 × 15–19): a **plateau** band (walkable, north rows), a **wall band** (solid, the middle 2–3 rows = the front face), the **lower floor** (walkable, south rows). Leave a **ramp-gap** column walkable through the wall band (the ramp art is W2c; for W2b it is just a walkable gap so the room stays traversable).

**Files:** Modify `src/game/maps/mineMap.ts`; Test: `tests/game/maps.test.ts` (already BFS-checks all zones — ensure the mine still passes).

- [ ] **Step 1:** Read `mineMap.ts` (the `CARVES` rects + `dressMap`). Choose exact tile rows for plateau / wall band / lower floor within the first chamber, and one walkable ramp-gap column through the band. Use a **solid** decor/ground name for the wall band (e.g. keep `mineWall` on those cells, which is already solid) and walkable ground for plateau + lower floor + ramp gap.
- [ ] **Step 2:** Implement the ledge (place the wall-band solid tiles + keep the ramp-gap + plateau/lower-floor walkable). Export the band's tile-rect (e.g. `MINE_LEDGE_BAND = {x1,y1,x2,y2}`) and the plateau/ramp rects for the scene + WallView to consume.
- [ ] **Step 3:** Run `npx vitest run tests/game/maps.test.ts` — the mine BFS reachability/enclosure test PASSES (room reachable, ramp gap connects plateau↔floor). Fix the layout if it fails.
- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit: `feat(w2b): carve a raised ledge (wall band + plateau + ramp gap) into the mine's first room`.

---

### Task 2: Composite ground on the mine

**Files:** Modify `src/game/maps/groundTerrain.ts`, `src/game/scenes/MineScene.ts`; Test: `tests/game/groundTerrain.test.ts`.

- [ ] **Step 1: Failing test** — extend `groundTerrain.test.ts`:
```ts
import { MINE_GROUND_TO_TERRAIN as MT, MINE_DEFAULT_TERRAIN as MDEF } from "../../src/game/maps/groundTerrain";
describe("mine table", () => {
  it("maps mine floor names to terrain keys", () => {
    expect(groundNameToTerrainKey("mineFloor", MT)).toBeTruthy();
    expect(groundNameToTerrainKey("frostSand", MT)).toBe("frostSand");
    expect(MDEF).toBeTruthy();
  });
});
```
- [ ] **Step 2:** Run → FAIL (exports missing).
- [ ] **Step 3:** Add `MINE_GROUND_TO_TERRAIN` (`mineFloor`→a suitable existing `TerrainKey` — pick one that reads as mine floor, e.g. `asphalt`/`ash`/`reefSilt`-family dark stone; `frostSand`→`frostSand`) + `MINE_DEFAULT_TERRAIN`. In `MineScene.config()`, add `compositeGround: { table: MINE_GROUND_TO_TERRAIN, fallback: MINE_DEFAULT_TERRAIN }`. (The mine has no overhead layer today; `buildMap` creates one regardless, so the crest-overhead in Task 3 has a layer — confirm.)
- [ ] **Step 4:** Run the table test → PASS. `npx vitest run` (full) + `npx tsc --noEmit` clean. Commit: `feat(w2b): opt the mine onto composite ground`.

---

### Task 3: `WallView` — bake + place + depth-split *(controller-implemented, iterated at the capture gate)*

The crux. Build a game-side view that bakes `renderWall` and places it aligned to the wall-band tile-rect, split face-below / crest-overhead, talus onto the floor. Because the pixel alignment (foot row, crest/talus overhang, the `H ≈ Ht/cos33°` foreshorten) needs visual tuning, the controller implements this directly and iterates via the Task 4 capture.

**Design (implement, then tune):**
- **Expose the offset:** `renderWall` also returns its projected-bounds offset `{ x0, y0 }` (change its return to `{ grid, x0, y0 }` or add a sibling; update W1's callers/tests accordingly — the bake script + tests just take `.grid`).
- **Params from the band:** `W` (wall units) = band width in tiles; `H` = `bandHeightTiles / Math.cos(33°)` (foreshorten); `style: "minestone"`.
- **Placement:** the wall foot (wall x,y,z = x,0,0) projects to screen `(x·16, 0)`; so the baked image (whose pixel (0,0) = wall-screen `(x0,y0)`) is placed at zone pixel `(bandLeftTile·16 + x0, bandSouthEdge·16 + y0)`. Tune the exact foot-row + a small fudge at the capture gate.
- **Depth split:** the crest is the image rows above wall-y=H (screen-y `< -(H·cos33°)·16`, i.e. pixel-rows `< -(H·cos33°)·16 - y0`); slice the baked canvas into a **crest image at overhead depth (~5000)** and a **face+talus image below actor foot-Y** (a fixed low depth, e.g. just above `COMPOSITE_GROUND_DEPTH`). Two Phaser images from one bake.
- **Talus:** the face image's talus overlaps the lower floor; if the boundary reads hard at the gate, blend/mask it (47-blob or a scatter) — start with plain overlap.
- **Wiring:** `ZoneConfig.walls?: Array<{ band: {x1,y1,x2,y2}; style; height; crest?; ... }>`; `ZoneScene` builds a `WallView` per entry in `setupCompositeGround`; self-registers teardown.
- **MineScene:** declare the ledge wall (`walls: [{ band: MINE_LEDGE_BAND, style: "minestone", height: <band tiles>, crest: "jagged" }]`).

- [ ] **Step 1:** Add the `{x0,y0}` return to `renderWall`; update its callers/tests (`.grid`). Run walls tests → green.
- [ ] **Step 2:** Implement `WallView.ts` + `ZoneConfig.walls` + `ZoneScene` wiring + `MineScene` declaration per the design.
- [ ] **Step 3:** `npx tsc --noEmit` clean; `npx vitest run` green.
- [ ] **Step 4 (controller iteration):** capture the mine in-zone (Task 4 spec), Read it, tune the placement offsets / foreshorten / depth split until the wall sits correctly on the band (owner visual gate). Commit when it reads right: `feat(w2b): WallView — bake + place the composite wall on the mine ledge`.

---

### Task 4: In-zone capture + verification

**Files:** Create `tools/smoke/shots/w2-mine.spec.ts` (model on `g4-temple.spec.ts`): jump to the mine, stand near the ledge, screenshot. Not pass/fail beyond zone loaded.

- [ ] **Step 1:** Write + run the capture; controller Reads it (drives Task 3 Step 4 iteration).
- [ ] **Step 2:** Full bar: `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm run smoke`, `npm run smoke:touch` — all pass.
- [ ] **Step 3:** Commit the capture spec: `test(w2b): mine ledge in-zone capture`.

---

## Self-Review

- **Spec coverage:** W2 spec §3.1 ledge → Task 1; §3.2 composite → Task 2; §3.3 WallView placement/depth/talus → Task 3; §6 capture + bar → Task 4. Seed threading (§4) + ramp (§5) deferred (W2c / later), noted.
- **Placeholder scan:** Tasks 1/2/4 are concrete TDD; Task 3 is deliberately controller-iterated (the placement math is given as a model to tune, not a fixed constant — that is the honest state of an alignment task, not a hand-wave).
- **Risk:** Task 3 alignment is the uncertain part; mitigated by controller implementation + the capture-gate iteration loop.
