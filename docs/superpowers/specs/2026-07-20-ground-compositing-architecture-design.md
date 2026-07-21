# Runtime Ground Compositing Architecture — Design (Decision of Record)

**Date:** 2026-07-20
**Status:** design validated by two prototypes; foundational — decomposes into phased implementation plans

## 1. Why

The current ground system has three compounding weaknesses, all surfaced this session:
- **Per-pair transition tiles explode.** Every `(over, base, mask)` combo is pre-baked
  — 7 pairings × 47 = 329 tiles per biome — which is why "all types autotile" and
  "3-way junctions" were painful, and why cross-biome transitions were impossible.
- **`floorFill` is one tile per ground, recolored.** Every biome's floors share one
  `fbm`-mottle-plus-speckle recipe; grounds differ only by color, so a tiled field
  reads as a stamped, repeating pattern.
- **No home for authored floors.** The megalithic-temple-slab floor (Act 3 sunken
  ruins) doesn't fit a per-16px-tile model at all.

A single architecture fixes all three. It was validated live in two prototypes:
- Fill-variant tuner: https://claude.ai/code/artifact/b01118b6-3a00-4e0d-92a3-c8ee53f7cc99
- Mask-composite prototype: https://claude.ai/code/artifact/8de13b4a-9d28-43a1-b0e0-5a65467dbd34

## 2. The architecture — three pillars

Render a map's ground by **compositing at bake time from world position**, not by
placing pre-baked 16px tiles:

1. **World-position fills.** Each terrain's surface is a deterministic function
   `fill(terrain, worldX, worldY) -> color`. Because it reads *absolute world
   coordinates*, it never tiles and never repeats — no 16px stamp, no variant pool
   needed (variants were a stepping stone; world-position fills subsume them).
2. **One shared mask.** Transitions are `base fill + (over fill × mask) + outline`.
   The mask is the terrain-*independent* 47-blob shape (from `overlayMask` geometry),
   evaluated per cell from its 8-neighbor config. **Any over on any base — cross-biome
   — for free. No per-pair tiles.**
3. **Outline/edge shade** drawn along the mask boundary at composite time.

Net: fills are the whole art surface; transitions are just masked fills + an edge.

## 3. World-position fills

`fill(terrain, wx, wy)` is one of two kinds, same interface:

- **Natural** (grass, soil, sand, water, snow, ash…): layered value noise / fbm at
  world coords, palette-locked, low-contrast, with an optional faint per-material
  grain (grass = whisper of vertical bias, water = horizontal drift). No stamp.
- **Authored art floors** (megalithic temple, mosaic, brick, tiled stone): a
  *structured* function of world coords — e.g. a slab lattice (3×2-tile blocks),
  mortar/grout lines, **per-slab shading off a consistent light** for depth, cracks
  and wear. Spans tiles as one coherent designed surface. **Authored features
  placeable at exact world positions** (a mosaic emblem at a temple's center, a
  shattered slab under a cave-in) — deterministic, same every build.

Both are just `fill()` — they composite identically and both transition via the mask.

## 4. Mask-composite transitions

- **Shared masks:** one set of 47 canonical blob stencils from `overlayMask`
  (depends only on `inset`/`round`/`irreg`/`seed` — NOT terrain). Seam-rounding
  tuning (this session's work) lives here now, defining the mask shapes. A few named
  mask *styles* (organic / crisp) cover per-scene character; still O(styles), not
  O(pairs).
- **Composite per cell:** base-terrain cell bordering an over-terrain → evaluate the
  cell's neighbor mask → `over` where mask carves in, `base` elsewhere.
- **Priority-layered junctions:** draw terrains bottom-up by priority, each masked;
  higher terrains paint over lower. 3+ way meetings resolve gracefully by
  construction — no binary-tile ambiguity, no hard step.
- **Animated masks:** the mask is `mask(x, y, t)`; a time term scrolls the edge →
  **waves on a shoreline, creeping lava crust, shimmering pool rims** — no baked
  animation frames, just a moving mask (validated: the prototype's coastline waves).

## 5. Outline / edge shading

Drawn from the mask boundary at composite time, reproducing what the baked tiles gave
for free: darkened over-edge, lit inner lip, drop shadow, and for liquids a **foam /
molten fringe** just inside the edge (bone for water, `atbGold` for lava — validated).
This is the part needing the most fidelity work vs. the old baked outline.

## 6. Rendering pipeline

- **Bake once per map at load:** stamp the composited ground into a single texture
  (the existing `ScaledGroundView` / `RenderTexture` pattern — the game already bakes
  ground textures at runtime, so this extends a proven path, not a new capability).
- **Animated regions** (shorelines, lava): re-composite only the affected band per
  frame, or drive the mask edge in a shader; the static ground bake is untouched.
- Deterministic (`h2`/`fbm` only), so a map's ground is reproducible build to build.

## 7. What it supersedes

- **Per-pair transition tiles** (reef/ice/lava/grove blob pairings) — dropped for the
  in-game path; the pairing *bakes* remain as dev/reference only.
- **`floorFill` single tiles + the variant idea** → world-position `fill()`.
- **The megalith special-case** → an authored art-floor `fill()`.
- **The two-system split** (cliffReef/etc. never wired in-game vs. tileset-based
  zones) → this becomes the *unified* in-game ground system.
- **Retained:** cliff *vertical* structure (wall faces, ramps, diagonals, plateau
  caps) stays baked — it's 3D-ish geometry, not flat ground. Only the flat-ground
  blob transitions move to the composite. The bespoke wall faces (glacier/coral/
  basalt) are unaffected.

## 8. Migration / phasing (each its own plan)

- **Phase G1 — Fill library.** `fill(terrain, wx, wy)` with the natural fills for the
  built grounds (desert/reef/ice/lava/grove families), palette-locked, world-position.
- **Phase G2 — Mask + composite (offline bake).** Shared 47-mask set from
  `overlayMask`; a bake pass that composites base + over·mask + outline into a ground
  texture; priority layering. Prove parity with a review scene.
- **Phase G3 — Runtime integration.** Wire the composite into the map renderer
  (`ScaledGroundView` bake) for one real zone; animated shoreline band.
- **Phase G4 — Authored art floors.** The megalith temple slab `fill()` + feature
  placement, for the Act 3 sunken ruins.
- Sequence G1 → G2 → G3, G4 after G2. Each is a normal spec → plan → build cycle with
  owner review gates.

## 9. Scope / non-goals

- Not an engine change — all on the current Phaser stack (extends `ScaledGroundView`).
- Independent of the AAP-64 palette migration, but they compose (fills draw from the
  palette; do palette first or in parallel).
- The parked grove biome: its ground *colors/recipes* fold into Phase G1 fills; its
  baked transition tiles are superseded by G2. Nothing shipped is lost.

## 10. Open questions (carry into the phase specs)

- Outline fidelity vs. the old baked edge (lit lip, drop shadow) — prototype further.
- Bake cost / texture size for large maps; animated-region update strategy.
- Art-floor authoring: procedural slab lattice params vs. hand-placed features.
- Whether a few mask *styles* suffice, or per-terrain-pair mask tweaks are ever needed.
