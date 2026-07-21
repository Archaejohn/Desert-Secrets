# Water Surface Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Render ReefHollow's water as a translucent surface over a composited seabed (depth) + an additive caustic shimmer + gentle back-and-forth motion.

**Architecture:** Two `compositeMapLayers` passes over ReefHollow's ground grid — a **seabed** grid (water→`reefSilt`) for `CompositeGroundView` (the visible floor), and a **water-kept** grid (water→`reefWater`) whose per-pixel `terrainId===GROUND_PRIORITY.reefWater` yields the organic water footprint. A new `WaterSurfaceView` bakes that footprint into a water-alpha texture and draws a `NORMAL`-blend depth tint + an `ADD`-blend caustic layer over it, at depths between the seabed (−100) and actors, animated from `onUpdate(dt)`.

**Tech Stack:** TypeScript, Phaser 3, Vitest.

## Global Constraints

- **NORMAL tint, ADD caustics.** Depth tint = `Phaser.BlendModes.NORMAL` (see the floor through it); caustics = `Phaser.BlendModes.ADD`. Never `reveal`/subtractive.
- **Depth band:** seabed −100 < tint (−90) < caustics (−80) < actors (`setDepth(y)`). Water must NOT paint over characters.
- **Bake once, animate cheap.** Water-alpha + caustic textures baked once; per frame only `tilePosition`/alpha/scale — never re-fill a canvas per frame.
- **Handle the gotchas:** map BOTH `reefWater` + `reefWater2`; hide the DECOR-layer water tiles (not just the ground layer); ordinary scene children (UI-camera ignore via `syncUiCameraIgnore`); self-register SHUTDOWN/DESTROY cleanup.
- **Opt-in per zone;** only ReefHollow changes. Leaves the pipeline/determinism pins untouched.
- **Bar:** `tsc`, `vitest`, `build`, `smoke`, `smoke:touch`. **Owner visual review on the running zone is the real gate.**

## File Structure

- **Modify** `src/game/maps/groundTerrain.ts` — reef-hollow seabed + water tables.
- **Create** `src/game/gfx/waterMask.ts` (pure) — `waterAlphaFromLayers`.
- **Create** `src/game/gfx/WaterSurfaceView.ts` — the overlay.
- **Modify** `src/game/ZoneScene.ts` — opt-in wiring + `onUpdate` animation + decor-water hide.
- **Modify** `src/game/scenes/ReefHollowScene.ts` — opt in.
- **Create** `tests/game/waterMask.test.ts`; extend `tests/game/groundTerrain.test.ts`.

---

## Task 1: ReefHollow ground tables (pure)

**Files:** Modify `src/game/maps/groundTerrain.ts`; extend `tests/game/groundTerrain.test.ts`.

**Interfaces:** Produces `REEF_HOLLOW_SEABED`, `REEF_HOLLOW_WATER`, `REEF_HOLLOW_DEFAULT` (`= "reefSilt"`).

- [ ] **Step 1: Failing test** — assert both tables map the full vocab, water differs:

```ts
// add to tests/game/groundTerrain.test.ts
import { REEF_HOLLOW_SEABED, REEF_HOLLOW_WATER, REEF_HOLLOW_DEFAULT, groundNameToTerrainKey } from "../../src/game/maps/groundTerrain";
describe("reef hollow tables", () => {
  it("seabed maps water (both phases) to reefSilt seabed", () => {
    expect(groundNameToTerrainKey("reefWater", REEF_HOLLOW_SEABED)).toBe("reefSilt");
    expect(groundNameToTerrainKey("reefWater2", REEF_HOLLOW_SEABED)).toBe("reefSilt"); // ...2 handled explicitly
    expect(groundNameToTerrainKey("reefStone", REEF_HOLLOW_SEABED)).toBe("reefFloor");
    expect(groundNameToTerrainKey("mintKelp", REEF_HOLLOW_SEABED)).toBe("glowMoss");
    expect(REEF_HOLLOW_DEFAULT).toBe("reefSilt");
  });
  it("water-kept table keeps water as reefWater (for the footprint mask)", () => {
    expect(groundNameToTerrainKey("reefWater", REEF_HOLLOW_WATER)).toBe("reefWater");
    expect(groundNameToTerrainKey("reefWater2", REEF_HOLLOW_WATER)).toBe("reefWater");
    expect(groundNameToTerrainKey("reefSilt", REEF_HOLLOW_WATER)).toBe("reefSilt");
  });
});
```

- [ ] **Step 2: Run → fail.** `npx vitest run tests/game/groundTerrain.test.ts`

- [ ] **Step 3: Implement** — add to `groundTerrain.ts`:

```ts
const REEF_HOLLOW_LAND: Readonly<Record<string, TerrainKey>> = {
  reefSilt: "reefSilt", glowMoss: "glowMoss", reefStone: "reefFloor", mintKelp: "glowMoss",
};
export const REEF_HOLLOW_SEABED: Readonly<Record<string, TerrainKey>> = { ...REEF_HOLLOW_LAND, reefWater: "reefSilt", reefWater2: "reefSilt" };
export const REEF_HOLLOW_WATER: Readonly<Record<string, TerrainKey>> = { ...REEF_HOLLOW_LAND, reefWater: "reefWater", reefWater2: "reefWater" };
export const REEF_HOLLOW_DEFAULT: TerrainKey = "reefSilt";
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit** `feat(water): reef hollow seabed + water ground tables`.

---

## Task 2: water-alpha mask helper (pure)

**Files:** Create `src/game/gfx/waterMask.ts`; Test `tests/game/waterMask.test.ts`.

**Interfaces:** `waterAlphaFromLayers(terrainId: Uint8Array, waterId: number, alpha = 255): Uint8ClampedArray` — an RGBA buffer, alpha=`alpha` where `terrainId===waterId` else 0 (white RGB; the texture is used as an alpha stencil / tinted).

- [ ] **Step 1: Failing test**

```ts
// tests/game/waterMask.test.ts
import { describe, it, expect } from "vitest";
import { waterAlphaFromLayers } from "../../src/game/gfx/waterMask";
describe("waterAlphaFromLayers", () => {
  it("is opaque where terrainId===waterId, transparent elsewhere", () => {
    const id = new Uint8Array([5, 3, 5]); // waterId=5 at 0,2
    const a = waterAlphaFromLayers(id, 5);
    expect(a[3]).toBe(255); expect(a[7]).toBe(0); expect(a[11]).toBe(255);
    expect([a[0], a[1], a[2]]).toEqual([255, 255, 255]); // white RGB stencil
  });
});
```

- [ ] **Step 2: Run → fail. Step 3: Implement**

```ts
// src/game/gfx/waterMask.ts
/** RGBA stencil for a water overlay: white + `alpha` where terrainId===waterId, else transparent. */
export function waterAlphaFromLayers(terrainId: Uint8Array, waterId: number, alpha = 255): Uint8ClampedArray {
  const data = new Uint8ClampedArray(terrainId.length * 4);
  for (let i = 0; i < terrainId.length; i++) {
    const o = i * 4;
    if (terrainId[i] === waterId) { data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = alpha; }
  }
  return data;
}
```

- [ ] **Step 4: Run → pass. Step 5: Commit** `feat(water): pure water-alpha stencil from composite terrainId`.

---

## Task 3: WaterSurfaceView (Phaser overlay)

**Files:** Create `src/game/gfx/WaterSurfaceView.ts`.

**Interfaces:** `class WaterSurfaceView { constructor(scene, waterGrid: TerrainKey[][], depthTint: number, depthCaustic: number); update(dt: number): void; destroy(): void; }` — builds a water-alpha texture from `compositeMapLayers(waterGrid).terrainId===GROUND_PRIORITY.reefWater`; a NORMAL-blend tint `Image` (the alpha texture, `.setTint` a depth blue) + an ADD-blend caustic `TileSprite` masked to the water shape (BitmapMask from the alpha texture); animates in `update`.

- [ ] **Step 1: Implement** (no unit test — live Phaser; verified by tsc + smoke + manual). Bake the water-alpha texture (`createCanvas` + `putImageData(waterAlphaFromLayers(...))`), a caustic texture (a small tiling cyan speckle from `h2`/worldFbm or a simple noise, baked once), then:
  - `tint = scene.add.image(0,0,alphaKey).setOrigin(0,0).setDepth(depthTint).setTint(hexToInt(PALETTE.teal)).setBlendMode(Phaser.BlendModes.NORMAL).setAlpha(0.55)` — the depth film (seabed shows through).
  - `caustic = scene.add.tileSprite(0,0,W,H,causticKey).setOrigin(0,0).setDepth(depthCaustic).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25)`, then `caustic.setMask(new Phaser.Display.Masks.BitmapMask(scene, this.tint))` (confine caustics to the water shape).
  - Self-register SHUTDOWN/DESTROY; `destroy()` frees images, mask, and both texture keys (guarded).
  - `update(dt)`: `this.t += dt; caustic.tilePositionX = Math.sin(this.t * 0.6) * 12; caustic.tilePositionY += dt * 4;` (back-and-forth sway + slow drift), optional `tint.setAlpha(0.5 + 0.06*Math.sin(this.t))` breathe. Tune values on the running zone.
  - NEAREST filter (pixelArt) on the baked textures.

- [ ] **Step 2:** `npx tsc --noEmit` clean (cross-boundary imports compile). **Step 3: Commit** `feat(water): WaterSurfaceView — translucent tint + additive caustics`.

---

## Task 4: Wire into ZoneScene + ReefHollow opt-in

**Files:** Modify `src/game/ZoneScene.ts`, `src/game/scenes/ReefHollowScene.ts`.

- [ ] **Step 1:** Extend `ZoneConfig` with `water?: { seabed: Table; waterKept: Table; fallback: TerrainKey }` (or fold onto `compositeGround`). For water zones, `setupCompositeGround` builds the seabed grid from `water.seabed` for `CompositeGroundView`, and constructs `WaterSurfaceView` from the `water.waterKept` grid. Add field `waterSurfaceView`, reset in `init()`.
- [ ] **Step 2:** **Hide the decor-layer water tiles** — after building layers, for each water tile GID (`tileGid("reefWater")`/`"reefWater2"`), set matching decor tiles invisible (or `decorLayer.replaceByIndex`/`setVisible` on those tiles) so they don't draw over the overlay. Also skip `animateTilePair` for a composite water zone (the overlay owns the motion).
- [ ] **Step 3:** In `onUpdate(dt)` call `this.waterSurfaceView?.update(dt)`.
- [ ] **Step 4:** `ReefHollowScene.config()` → add `compositeGround` (seabed table) + `water` config; keep its existing `LightMask`.
- [ ] **Step 5:** `tsc` + `vitest run` (other zones unaffected). **Step 6: Commit** `feat(water): ReefHollow composite seabed + water surface`.

---

## Task 5: Full verify + owner visual review

- [ ] `tsc`, `vitest run` (all green + new pure tests), `build`, `smoke` (ReefHollow loads), `smoke:touch`.
- [ ] **OWNER VISUAL GATE:** run the app on ReefHollow (screenshot spec: `jumpTo` reefHollow, capture two frames a moment apart to show motion). Confirm: seabed visible through the water (depth), caustics shimmer, gentle back-and-forth motion, player wades ON TOP, decor/walls intact, no z-order/camera issues. Iterate tint alpha / caustic intensity / motion amplitude on the running zone.
- [ ] PR into `main` (regular merge commit).

## Self-Review Notes

- Coverage: seabed floor (spec §2) = T1+T4; water footprint mask (§2) = T2+T3; tint+caustic+motion (§2) = T3; wiring + decor-water + animation hook (§2,§3) = T4; gotchas (§3) handled in T1/T4. Visual gate (§5) = T5.
- Out of scope: other water zones, tileset water path, shader caustics.
- Risk: depth-band ordering + the decor-water hide are the fiddly bits — verified visually in T5, not by tests.
