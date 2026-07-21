# G3 — Runtime Integration (Design / Decision of Record)

**Date:** 2026-07-21
**Status:** design approved; decomposes into an implementation plan.
**Parent:** `docs/superpowers/specs/2026-07-20-ground-compositing-architecture-design.md` (Phase G3). Builds on **G1** (`ground/fills.ts`) + **G2** (`ground/composite.ts` `compositeMap`).

## 1. Why

G1 (world-position fills) and G2 (mask-composite) exist but render only in the offline
pipeline + review artifacts. G3 makes the composited ground render **in the live game** for
one real zone — the payoff of the whole pivot: a zone's ground drawn by `compositeMap` from
its terrain instead of the authored `tileset2-8` + `dressMap` tiles. **Static only** — the
animated shoreline is dropped (owner: a bonus for certain scenes, not worth the per-frame cost).

## 2. Feasibility (from recon)

- **Runtime is feasible.** The entire compositor tree (`compositeMap`, `fills`, `worldNoise`,
  `texture`, `groundRamps`, `cliffs/blob47`/`noise`/`terrains`, `palette/remap`/`aap64`,
  `grid.PixelGrid`) is **pure and browser-safe** — no Node APIs, no pngjs/Buffer. The single
  root `tsconfig.json` includes `src` + `tools`; a relative import from `src/game` into
  `tools/pipeline/src/ground/composite` compiles and tree-shakes. (First `src/`→`tools/`
  edge; relocating the pure core under `src/shared/` is cleaner long-term — a deferred
  follow-up, not G3.)
- **Bake pattern exists.** `LightMask.bakeGradient` (`textures.createCanvas` + `ImageData`
  per pixel → `refresh()` → `setFilter(LINEAR)`) is the template for turning a `PixelGrid`
  into a Phaser texture. `ScaledGroundView`'s constructor is the "seam of abstraction" the
  architecture flagged for a drop-in.

## 3. Approach

Target zone: the **reef garden** (`ReefGardenScene` / `reefGardenMap`) — its ground names
(`reefFloor`, `reefSilt`, `reefWater`, `glowMoss`) already match `TerrainKey`s, minimizing
mapping gaps.

1. **`src/game/gfx/CompositeGroundView.ts`** — the integration:
   - Input: the zone's **base terrain grid** as `TerrainKey[][]` + the scene + ground depth.
   - `compositeMap(grid)` → `PixelGrid`; convert to a Phaser **canvas texture**
     (`createCanvas(key, w*16, h*16)`, `createImageData`, per cell `hexToRgb(CORE[name])`,
     `null`→alpha 0, `putImageData`, `refresh`, `setFilter(LINEAR)`).
   - Display as a scene `Image`/`RenderTexture` at `GROUND_DEPTH`, rendered through
     `cameras.main` only (UI-camera ignore, like `LightMask`).
   - **Ground only:** hide the tileset **ground** layer; leave decor/wall/overhead layers
     and all collision LIVE (the compositor knows terrain, not props).
   - Managed texture lifecycle + `destroy()` (remove the owned texture key on scene shutdown).
   - **Blur toggle (default OFF):** an optional light box/gaussian blur on the baked texture
     to soften the discrete ramp steps into gradients ("expand the palette to the ramp gaps"
     — auto-generated intermediates as a render effect; source stays palette-locked). Off by
     default; a flag flips it on for on-screen comparison.
2. **`groundNameToTerrainKey(name): TerrainKey | null`** — maps the reef zone's ground tile
   names to `TerrainKey`, after `baseName()` strips any `dressMap` transition/edge variant
   (so the compositor owns the seams — no double-transition). Direct matches for
   reefFloor/reefSilt/reefWater/glowMoss; zone-specific ground names (e.g. `mintKelp`,
   `kelpBed`, `mossGlow`) map to their nearest key; non-ground (walls/decor) → `null` (not
   part of the ground grid). A cell that maps to `null` falls back to a chosen default key.
3. **Base terrain grid extraction** — normalize the zone's `ground: string[][]` per cell via
   `baseName()` → `groundNameToTerrainKey` → `TerrainKey[][]`.
4. **Wire-in (opt-in per zone):** a `ZoneConfig`/scene flag (e.g. `compositeGround: true`) on
   the reef garden zone only; `ZoneScene` builds a `CompositeGroundView` when set and skips
   the normal ground-layer render for that zone. Every other zone is byte-unchanged.

## 4. Scope / non-goals

- **Static only.** No animation (dropped).
- **One reef zone.** Other zones' name mappings (desert/mine/temple names with no `TerrainKey`)
  = future work.
- **No relocation** of the compositor to `src/shared/` (deferred cleanup); import from
  `tools/pipeline/src` directly.
- Ramp richening + the blur are tuning knobs (blur ships as an off-by-default toggle).
- Leaves the pipeline, baked sheets, and determinism pins untouched.

## 5. Testing / verification

- **Unit-testable (pure):** `groundNameToTerrainKey` mapping (incl. `baseName` stripping and
  null fallback); the base-grid extraction from a sample zone grid; the `PixelGrid`→RGBA
  conversion helper (a cell → correct `CORE` hex bytes; `null` → transparent).
- **Not unit-testable:** the Phaser render itself. Verified by `npm run smoke` (the reef zone
  loads without error) + **OWNER VISUAL REVIEW: run the app on the reef zone and look at it**
  (the real gate — screenshots via `/run` or Playwright).
- Bar: `tsc`, `vitest`, `build`, `smoke`, `smoke:touch`. Nothing rebakes.

## 6. Risks (from recon)

- **Name-mapping gaps** — the core new work; a null-mapped ground name must fall back cleanly
  (default key) so nothing renders blank. Reef minimizes this.
- **Double-transition** — must composite from the `baseName`-normalized (un-dressed) grid, or
  the compositor's seams stack on the authored ones.
- **Decor/collision** — bake ground ONLY; keep decor/wall/overhead layers + collision live.
- **Texture size** — `w*16 × h*16` must stay under the GPU cap (~4096px mobile); reef zone is
  well within.
- **Two-camera correctness** — the composite ground image must render through `cameras.main`
  only and be ignored by the UI camera (follow `LightMask`'s pattern).
