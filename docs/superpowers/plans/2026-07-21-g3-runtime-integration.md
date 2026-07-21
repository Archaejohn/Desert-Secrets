# G3 — Runtime Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the G2 composited ground in the live game for one reef zone (reef garden), statically, opt-in per zone — the tileset ground layer replaced by a runtime-baked composite texture.

**Architecture:** A new `src/game/gfx/CompositeGroundView.ts` imports `compositeMap` (pure/browser-safe) from `tools/pipeline`, bakes its `PixelGrid` into a Phaser **canvas texture** (createCanvas + ImageData, the `LightMask.bakeGradient` pattern), and displays it at ground depth. `ZoneScene` reads a new `ZoneConfig.compositeGround` field: when set, it builds the view from the zone's `baseName`-normalized ground grid → `TerrainKey[][]` and hides the tileset ground layer (ground only; decor/wall/overhead + collision stay live). Reef garden opts in; every other zone is byte-unchanged.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest. Compositor is pure/deterministic.

## Global Constraints

- **Ground only.** Bake the terrain ground; NEVER touch decor/wall/overhead layers or collision. Hide (never destroy) the tileset `groundLayer` (`setVisible(false)` — collision is independent of render visibility). (blueprint §3)
- **No LINEAR filter.** The game boots `pixelArt: true` (NEAREST). `CompositeGroundView` leaves the canvas texture at default NEAREST — do NOT call `setFilter(LINEAR)`. The blur toggle is the ONLY, explicit, off-by-default softening. (blueprint §0)
- **Composite from the un-dressed base grid.** Run every ground cell through `baseName()` (`maps/dressing.ts`) before the `TerrainKey` lookup, so the compositor owns the seams (no double-transition). (spec §3)
- **Opt-in per zone.** Only zones with `ZoneConfig.compositeGround` set change; the ~37 others are untouched (flag defaults falsy).
- **Two-camera correctness.** The view's `Image` is an ordinary scene child (`scene.add.image`, NOT added to `uiLayer`) — `syncUiCameraIgnore()` handles the UI-camera ignore automatically. (blueprint §3d)
- **Unit tests run in the `node` env** (no DOM/canvas) — pure helpers must use plain typed arrays, not `ImageData`. (blueprint §5)
- **Verification bar:** `tsc --noEmit`, `vitest run`, `npm run build`, `npm run smoke`, `npm run smoke:touch`. Nothing rebakes. **Owner visual review** (run the app on the reef zone) is the real gate.

## File Structure

- **Create** `src/game/maps/groundTerrain.ts` — pure: `groundNameToTerrainKey`, `terrainGrid`, the reef table + default.
- **Create** `src/game/gfx/pixelGridRGBA.ts` — pure: `pixelGridToRGBA(grid) -> Uint8ClampedArray`.
- **Create** `src/game/gfx/CompositeGroundView.ts` — Phaser: bake + display + blur toggle + cleanup.
- **Create** `tests/game/groundTerrain.test.ts`, `tests/game/pixelGridRGBA.test.ts`.
- **Modify** `src/game/ZoneScene.ts` — `ZoneConfig.compositeGround`, field, depth const, `setupCompositeGround()`, call site, `init()` reset.
- **Modify** `src/game/scenes/ReefGardenScene.ts` — `config()` sets `compositeGround`.

---

## Task 1: Ground-name → TerrainKey mapping (pure)

**Files:**
- Create: `src/game/maps/groundTerrain.ts`
- Test: `tests/game/groundTerrain.test.ts`

**Interfaces:**
- Produces: `REEF_GARDEN_GROUND_TO_TERRAIN`, `REEF_GARDEN_DEFAULT_TERRAIN`, `groundNameToTerrainKey(name, table)`, `terrainGrid(ground, table, fallback): TerrainKey[][]`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/game/groundTerrain.test.ts
import { describe, it, expect } from "vitest";
import { REEF_GARDEN_GROUND_TO_TERRAIN as TBL, REEF_GARDEN_DEFAULT_TERRAIN as DEF, groundNameToTerrainKey, terrainGrid } from "../../src/game/maps/groundTerrain";

describe("groundNameToTerrainKey", () => {
  it("maps direct + variant + nearest names via baseName", () => {
    expect(groundNameToTerrainKey("reefFloor", TBL)).toBe("reefFloor");
    expect(groundNameToTerrainKey("reefFloor2", TBL)).toBe("reefFloor");     // hash variant, same terrain
    expect(groundNameToTerrainKey("glowMoss", TBL)).toBe("glowMoss");
    expect(groundNameToTerrainKey("mintKelp", TBL)).toBe("glowMoss");        // nearest key
    expect(groundNameToTerrainKey("reefFloorShade", TBL)).toBe("reefFloor"); // baseName strips the dressed shade
    expect(groundNameToTerrainKey("glowMossShade", TBL)).toBe("glowMoss");
    expect(groundNameToTerrainKey("someWall", TBL)).toBeNull();              // unmapped
    expect(groundNameToTerrainKey(null, TBL)).toBeNull();
  });
});

describe("terrainGrid", () => {
  it("converts a dressed ground grid, falling back to DEF for unmapped cells", () => {
    const g = terrainGrid([["reefFloor", "mintKelp"], ["glowMossShade", "unknownX"]], TBL, DEF);
    expect(g).toEqual([["reefFloor", "glowMoss"], ["glowMoss", "reefFloor"]]);
    expect(DEF).toBe("reefFloor");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/game/groundTerrain.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/game/maps/groundTerrain.ts
import { baseName } from "./dressing";
import type { TerrainKey } from "../../../tools/pipeline/src/cliffs/palette";

/** Reef-garden ground tile-names → TerrainKey (after baseName strips dressing). */
export const REEF_GARDEN_GROUND_TO_TERRAIN: Readonly<Record<string, TerrainKey>> = {
  reefFloor: "reefFloor",
  reefFloor2: "reefFloor", // hash-variant sprite of the same terrain
  glowMoss: "glowMoss",
  mintKelp: "glowMoss",    // no dedicated key; same bioluminescent reef-green family
};
export const REEF_GARDEN_DEFAULT_TERRAIN: TerrainKey = "reefFloor";

/** One (possibly dressed) ground tile-name → TerrainKey via its base name, or null if unmapped. */
export function groundNameToTerrainKey(name: string | null, table: Readonly<Record<string, TerrainKey>>): TerrainKey | null {
  const b = baseName(name);
  return b !== null && b in table ? table[b] : null;
}

/** A zone's (dressed) ground grid → TerrainKey[][]; unmapped cells fall back to `fallback`. */
export function terrainGrid(
  ground: readonly (readonly string[])[],
  table: Readonly<Record<string, TerrainKey>>,
  fallback: TerrainKey,
): TerrainKey[][] {
  return ground.map((row) => row.map((name) => groundNameToTerrainKey(name, table) ?? fallback));
}
```

- [ ] **Step 4: Run to pass**

Run: `npx vitest run tests/game/groundTerrain.test.ts`
Expected: PASS. (If `baseName` doesn't strip `reefFloorShade`→`reefFloor`, check `VARIANT_BASE` in `dressing.ts` — the blueprint confirms it does.)

- [ ] **Step 5: Commit**

```bash
git add src/game/maps/groundTerrain.ts tests/game/groundTerrain.test.ts
git commit -m "feat(g3): ground-name -> TerrainKey mapping for the reef zone"
```

---

## Task 2: PixelGrid → RGBA helper (pure)

**Files:**
- Create: `src/game/gfx/pixelGridRGBA.ts`
- Test: `tests/game/pixelGridRGBA.test.ts`

**Interfaces:**
- Produces: `pixelGridToRGBA(grid: PixelGrid): Uint8ClampedArray`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/pixelGridRGBA.test.ts
import { describe, it, expect } from "vitest";
import { pixelGridToRGBA } from "../../src/game/gfx/pixelGridRGBA";
import { PixelGrid } from "../../tools/pipeline/src/grid";
import { CORE, hexToRgb } from "../../src/shared/palette";

describe("pixelGridToRGBA", () => {
  it("writes CORE hex bytes per opaque cell and alpha 0 for null", () => {
    const g = new PixelGrid(2, 1);
    g.px(0, 0, "reefFloor"); // (1,0) left null
    const data = pixelGridToRGBA(g);
    expect(data.length).toBe(2 * 1 * 4);
    const [r, gr, b] = hexToRgb(CORE.reefFloor);
    expect([data[0], data[1], data[2], data[3]]).toEqual([r, gr, b, 255]);
    expect(data[7]).toBe(0); // (1,0) alpha
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/game/pixelGridRGBA.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/game/gfx/pixelGridRGBA.ts
import type { PixelGrid } from "../../../tools/pipeline/src/grid";
import { CORE, hexToRgb, type PaletteName } from "../../shared/palette";

/** Flatten a PixelGrid (cells = PaletteName | null) to RGBA bytes; null → transparent.
 *  Plain typed array (no DOM/ImageData) so it is unit-testable in the node env. */
export function pixelGridToRGBA(grid: PixelGrid): Uint8ClampedArray {
  const data = new Uint8ClampedArray(grid.width * grid.height * 4);
  grid.forEach((x, y, c) => {
    const o = (y * grid.width + x) * 4;
    if (c === null) { data[o + 3] = 0; return; }
    const [r, g, b] = hexToRgb(CORE[c as PaletteName]);
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
  });
  return data;
}
```

- [ ] **Step 4: Run to pass**

Run: `npx vitest run tests/game/pixelGridRGBA.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/gfx/pixelGridRGBA.ts tests/game/pixelGridRGBA.test.ts
git commit -m "feat(g3): PixelGrid -> RGBA helper (pure, node-testable)"
```

---

## Task 3: CompositeGroundView (Phaser bake + display + blur toggle)

**Files:**
- Create: `src/game/gfx/CompositeGroundView.ts`

**Interfaces:**
- Consumes: `compositeMap` (`tools/pipeline/src/ground/composite`), `TerrainKey` (`tools/pipeline/src/cliffs/palette`), `pixelGridToRGBA` (Task 2).
- Produces: `class CompositeGroundView` — `constructor(scene, grid: TerrainKey[][], depth: number, opts?: { blur?: boolean })`, `destroy(): void`.

- [ ] **Step 1: Implement** (no unit test — needs a live Phaser scene; verified by tsc + smoke + manual)

```ts
// src/game/gfx/CompositeGroundView.ts
import Phaser from "phaser";
import { compositeMap } from "../../../tools/pipeline/src/ground/composite";
import type { TerrainKey } from "../../../tools/pipeline/src/cliffs/palette";
import { pixelGridToRGBA } from "./pixelGridRGBA";

let seq = 0;

/** Renders a zone's ground by baking the runtime composite (G2 `compositeMap` over G1
 *  world-position fills) into a Phaser canvas texture, shown at `depth` as an ordinary
 *  scene child. Ground only — the caller hides the tileset ground layer and keeps decor/
 *  collision live. Default NEAREST filtering (pixelArt); `opts.blur` applies an explicit
 *  light canvas blur to soften the discrete ramp steps into gradients. */
export class CompositeGroundView {
  private readonly key: string;
  private image?: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, grid: TerrainKey[][], depth: number, opts: { blur?: boolean } = {}) {
    const pg = compositeMap(grid);
    this.key = `__composite_ground_${seq++}`;
    if (scene.textures.exists(this.key)) scene.textures.remove(this.key);
    const tex = scene.textures.createCanvas(this.key, pg.width, pg.height);
    if (!tex) throw new Error("CompositeGroundView: could not create canvas texture");
    const ctx = tex.context;
    const img = ctx.createImageData(pg.width, pg.height);
    img.data.set(pixelGridToRGBA(pg));
    ctx.putImageData(img, 0, 0);
    if (opts.blur) { ctx.filter = "blur(1px)"; ctx.drawImage(tex.canvas, 0, 0); ctx.filter = "none"; }
    tex.refresh();                    // NOTE: deliberately NOT setFilter(LINEAR) — pixelArt/NEAREST
    this.image = scene.add.image(0, 0, this.key).setOrigin(0, 0).setDepth(depth);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  destroy(): void {
    this.image?.destroy();
    this.image = undefined;
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
```

- [ ] **Step 2: Type-check the cross-boundary import** (the first `src/`→`tools/` edge — the design's flagged risk)

Run: `npx tsc --noEmit`
Expected: clean (single tsconfig includes `src` + `tools`, no alias needed; compositor tree is pure).

- [ ] **Step 3: Commit**

```bash
git add src/game/gfx/CompositeGroundView.ts
git commit -m "feat(g3): CompositeGroundView — bake compositeMap to a canvas texture"
```

---

## Task 4: Wire into ZoneScene + reef opt-in

**Files:**
- Modify: `src/game/ZoneScene.ts`
- Modify: `src/game/scenes/ReefGardenScene.ts`

**Interfaces:**
- Consumes: `CompositeGroundView` (Task 3); `terrainGrid`, `REEF_GARDEN_GROUND_TO_TERRAIN`, `REEF_GARDEN_DEFAULT_TERRAIN` (Task 1).

- [ ] **Step 1: Extend `ZoneConfig`** (`ZoneScene.ts:42-50`) — add:

```ts
  /** Opt-in: render this zone's ground via the runtime composite instead of the tileset.
   *  Carries the zone's own ground-name → TerrainKey table + fallback. */
  compositeGround?: { table: Readonly<Record<string, TerrainKey>>; fallback: TerrainKey };
```
Import `TerrainKey` at the top of `ZoneScene.ts`: `import type { TerrainKey } from "../../tools/pipeline/src/cliffs/palette";` and `import { CompositeGroundView } from "./gfx/CompositeGroundView";` and `import { terrainGrid } from "./maps/groundTerrain";`.

- [ ] **Step 2: Add the field, depth const, reset, setup method.**
  - Near `const TILE`/`PLAYER_SPEED` (`ZoneScene.ts:32-34`): `const COMPOSITE_GROUND_DEPTH = -100;`
  - Field: `private compositeGroundView: CompositeGroundView | null = null;`
  - In `init()` (`ZoneScene.ts:190-206`), with the other resets: `this.compositeGroundView = null;`
  - New method:
```ts
  private setupCompositeGround(): void {
    const cg = this.cfg.compositeGround;
    if (!cg) return;
    const grid = terrainGrid(this.cfg.map.ground, cg.table, cg.fallback);
    const blur = new URLSearchParams(location.search).has("groundblur"); // ?groundblur to compare
    this.compositeGroundView = new CompositeGroundView(this, grid, COMPOSITE_GROUND_DEPTH, { blur });
    this.groundLayer.setVisible(false);
  }
```

- [ ] **Step 3: Call it** right after `this.buildMap(width, height);` (`ZoneScene.ts:221`), before `this.spawnPlayer();`:

```ts
    this.buildMap(width, height);
    this.setupCompositeGround();
    this.spawnPlayer();
```

- [ ] **Step 4: Reef opt-in** — in `ReefGardenScene.config()` (`src/game/scenes/ReefGardenScene.ts:34-43`), add to the returned `ZoneConfig` object:

```ts
      compositeGround: { table: REEF_GARDEN_GROUND_TO_TERRAIN, fallback: REEF_GARDEN_DEFAULT_TERRAIN },
```
with `import { REEF_GARDEN_GROUND_TO_TERRAIN, REEF_GARDEN_DEFAULT_TERRAIN } from "../maps/groundTerrain";`.

- [ ] **Step 5: Verify types + suite unaffected for other zones**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS; the ~37 other zones unchanged (flag falsy).

- [ ] **Step 6: Commit**

```bash
git add src/game/ZoneScene.ts src/game/scenes/ReefGardenScene.ts
git commit -m "feat(g3): ZoneScene composite-ground opt-in; reef garden turns it on"
```

---

## Task 5: Full verification + owner visual review

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npx vitest run` → fully green (new pure tests + the ~1500 existing; determinism pins untouched).
- [ ] **Step 3:** `npm run build` → green.
- [ ] **Step 4:** `npm run smoke` (Act 6 loads `reefGarden` without error) + `npm run smoke:touch` → pass.
- [ ] **Step 5: OWNER VISUAL REVIEW GATE (the real one).** Run the app and open the reef garden zone; capture a screenshot (via `/run` or Playwright). Confirm the composited ground reads right in-game (organic seams, correct colors, decor/walls/collision intact, no z-order or camera issues). Then load with `?groundblur` and compare the blur on/off. Iterate on the mapping/look if needed. Do NOT call G3 done until the owner signs off on the on-screen result.
- [ ] **Step 6: PR.** Open into `main` (regular merge commit per CLAUDE.md).

---

## Self-Review Notes

- **Spec coverage:** CompositeGroundView bake (spec §3.1) = T3; name mapping + baseName (§3.2/3.3) = T1; base-grid extraction (§3.3) = T4 `setupCompositeGround`; opt-in wiring (§3.4) = T4; blur toggle (§3.1) = T3+T4 (`?groundblur`); testing split (§5) = pure T1/T2 + smoke/manual T5.
- **Out of scope (intentional):** animation (dropped), other zones' mappings, relocating the compositor to `src/shared/`, richer ramps.
- **Risks handled:** LINEAR-filter trap (skipped, per blueprint §0); double-transition (baseName base grid); decor/collision (ground-only, hide-not-destroy); two-camera (ordinary child + `syncUiCameraIgnore`); cross-boundary import (T3 Step 2 tsc gate).
- **Type consistency:** `terrainGrid(ground, table, fallback)`, `CompositeGroundView(scene, grid, depth, {blur})`, `ZoneConfig.compositeGround: {table, fallback}` used identically across T1/T3/T4.
</content>
