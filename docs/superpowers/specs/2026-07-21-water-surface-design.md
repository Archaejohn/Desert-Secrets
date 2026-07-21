# Water Surface Renderer (Design / Decision of Record)

**Date:** 2026-07-21
**Status:** design approved (owner: full depth + caustics + motion in one pass).
**Builds on:** G3 (`CompositeGroundView`, `compositeMapLayers`) + the `LightMask` overlay pattern.

## 1. Why

Water currently renders as a flat, opaque fill (a solid channel). The owner wants it to read
as a **translucent surface over a visible seabed** — depth — using a `LightMask`-style
selective overlay, with **caustic shimmer** and gentle **back-and-forth motion**.

## 2. Approach — seabed floor + translucent surface overlay

Target zone: **`ReefHollow`** (a clean reef water channel; already runs a `LightMask` to sit
beside). It gets opted into the composite (only the reef garden is today).

- **The floor:** the base composite shows a **continuous seabed** — water cells map to a
  seabed `TerrainKey` (`reefSilt`) in `CompositeGroundView`'s grid, so under the water you see
  seabed, not a flat water color. (Depth `COMPOSITE_GROUND_DEPTH = -100`.)
- **The water footprint (organic edge):** a SECOND `compositeMapLayers` pass over the same
  ground grid but with water KEPT as `reefWater` — its per-pixel `terrainId === GROUND_PRIORITY
  .reefWater` gives the exact water shape *with the same organic seam edges the ground uses*.
  This drives the overlay's alpha mask (a baked water-alpha texture).
- **`WaterSurfaceView`** (new, mirrors `CompositeGroundView`'s lifecycle):
  1. **Tint layer** — a `NORMAL`-blend image, the water-alpha mask tinted a depth ramp
     (`skyBlue → teal → tealDeep`), moderate alpha. NORMAL is the crux: a colored film you see
     the seabed *through* (ADD only brightens; reveal is subtractive — both wrong).
  2. **Caustic layer** — an `ADD`-blend tiled cyan/mint shimmer (`teal1`/`mint`) confined to
     the water shape (BitmapMask from the water-alpha texture).
  3. **Motion** — driven from `ZoneScene.onUpdate(dt)` like `lightMask.update()`: scroll the
     caustic `tilePosition` and oscillate it **back and forth** (a slow sinusoid), plus a
     subtle tint-alpha breathe. Baked once; only cheap per-frame transforms (scroll/scale/
     tint) — never re-fill a canvas per frame (`LightMask`'s performance rule).
- **Depth ordering:** seabed (−100) < tint < caustics < **actors** (`setDepth(y)`, so the
  player visibly wades on top) < lighting (4000) < HUD (6000).

## 3. Gotchas the recon flagged (must handle)

- **`...2` water names.** `baseName("reefWater2")` does NOT strip to `reefWater` (the animation-
  phase names aren't in `VARIANT_BASE`). The reefHollow ground table + the water-mask test must
  map BOTH `reefWater` and `reefWater2` (→ seabed for the floor; → `reefWater` for the mask).
- **Decor-layer water copies.** ReefHollow writes water to BOTH `ground` and `decor`
  (`reefHollowMap.ts`). `setupCompositeGround` hides only `groundLayer`; the decor water tiles
  would draw over the overlay. The wiring must also hide/skip the decor water tiles (a targeted
  `setVisible` on those tile indices, or exclude them from the decor layer for this zone).
- **Depth band.** Tint + caustics must sit ABOVE the seabed (−100) but BELOW actors — otherwise
  water paints over characters. Distinct small depths (e.g. −90 tint, −80 caustics).
- **Blend correctness.** Tint = `Phaser.BlendModes.NORMAL`; caustics = `Phaser.BlendModes.ADD`.
- **Performance.** Bake the water-alpha + caustic textures ONCE; animate by `tilePosition`
  scroll / alpha pulse only.

## 4. Components

- `src/game/maps/groundTerrain.ts` — add `REEF_HOLLOW_*` tables: a **seabed** table (water →
  `reefSilt`; reefSilt/glowMoss/mintKelp/reefStone → their keys) and knowledge of which names
  are water (for the mask). Confirm the full reefHollow ground vocabulary from `reefHollowMap.ts`.
- `src/game/gfx/waterMask.ts` (pure) — derive the per-pixel water-alpha `Uint8ClampedArray`
  from `compositeMapLayers(waterKeptGrid).terrainId === waterId`. Unit-testable.
- `src/game/gfx/WaterSurfaceView.ts` — the tint + caustic layers, masks, `update(dt)`, cleanup.
- `ZoneScene` — build `WaterSurfaceView` in `setupCompositeGround` (behind a `ZoneConfig`
  `water?: true` flag or folded into `compositeGround`), animate in `onUpdate(dt)`, cleanup in
  shutdown + `init()`, hide decor water tiles. `ReefHollowScene` opts in.

## 5. Testing / verification

- **Pure/unit:** the reefHollow ground table (water→seabed, `...2` handling, fallback); the
  water-alpha mask derivation (a cell of water → alpha 255 at its pixels, non-water → 0).
- **Not unit-testable:** the Phaser overlay + animation. Verified by `npm run smoke` (reefHollow
  loads) + **OWNER VISUAL REVIEW: run the app on reefHollow, watch the water** (the real gate;
  capture stills, ideally two animation phases to show motion).
- Bar: `tsc`, `vitest`, `build`, `smoke`, `smoke:touch`. Leaves the pipeline/pins untouched.

## 6. Scope / non-goals

- One zone (reefHollow). Other water zones (grove/sea) = follow-up (each needs its table + opt-in).
- Static-look tuning + animation params iterated visually on the running zone.
- No change to the tileset water path (`animateTilePair`) for non-composite zones.
