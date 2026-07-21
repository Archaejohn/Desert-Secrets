# HANDOFF — Ground Compositing Architecture (next-session catch-up)

**Written:** 2026-07-20, end of the biome-cliff-terrain-sets session.
**One-line:** the cliff-generator biomes are built + merged, and we have decided to
**pivot the whole ground-rendering approach** to runtime mask-compositing. This doc
is the map to that decision and the next steps.

---

## 1. Where things stand (all MERGED)

PR **#41** merged into `main` (merge commit `06c37d9`). It landed:
- **Cliff-generator biomes at parity** — desert (`cliff`), reef (`cliffReef`), ice
  (`cliffIce`), lava (`cliffLava`), grove (`cliffGrove`). Each: **4 ground types
  that all autotile with each other**, baked into its own sha-pinned sheet.
  - Reef: bespoke coral bio-rock wall face; corner rounding decoupled into
    `cornerRounding` (INNER) + new `pocketRounding` (OUTER) in `blob47.ts`;
    owner-tuned seams.
  - Ice: grew 1→4 grounds (ice/snow/frozenLake/rimeMoss), crisp seams.
  - Lava: bespoke basalt Worley-lava wall face (`basaltRockWallFace`).
  - Grove: groveGrass/groveMoss/groveWater/groveSoil; moss = teal-dominant with
    darkened `umber` soil showing through. **Bespoke damp-cave wall face was NEVER
    built** (its Task 7 was skipped when we pivoted).
- **Two decision-of-record specs** (see §3).

Verification at merge: `tsc` clean, `vitest` 1544 passing, `npm run build` green,
determinism pins intact for all 5 cliff sheets.

Git: this branch (`claude/biome-cliff-terrain-sets`) was reset to the merged `main`.
Per CLAUDE.md, restart it from latest `main` before follow-up work.

---

## 2. THE PIVOT — why we're changing direction (read this)

Building biomes one-by-one exposed three compounding problems:
1. **Per-pair transition tiles explode** — every `(over, base, mask)` is pre-baked
   (7 pairings × 47 = 329 tiles/biome). This is why "all types autotile", 3-way
   junctions, and cross-biome transitions were painful/impossible.
2. **`floorFill` is one tile per ground, recolored** — every biome's floor uses the
   same `fbm`-mottle + speckle recipe, so a tiled field reads as a repeating textile
   (the owner caught this on the grove grounds).
3. **No home for authored floors** — the megalithic temple-slab floor (Act 3 sunken
   ruins) doesn't fit a per-16px-tile model.

**The fix (one architecture, validated by two prototypes):** render the ground by
**compositing at bake time from WORLD position**, not by placing pre-baked tiles:
- **World-position fills** — `fill(terrain, worldX, worldY) -> color`. Reads absolute
  world coords, so it never tiles/repeats (subsumes the "variants" idea). Two kinds,
  same interface: *natural* (noise: grass/soil/water…) and *authored art floors*
  (structured: megalith slabs with per-slab shading, mosaic, brick).
- **One shared 47-blob mask** — terrain-independent stencils from `overlayMask`.
  Transition = `base fill + over·mask + outline`. **Any over on any base, cross-biome,
  for free — no per-pair tiles.** The mask can be `mask(x,y,t)` → **animated** (waves
  on a shoreline, creeping lava). Junctions resolve by priority-layering.
- **Outline/shade** drawn along the mask edge at composite time.

This retires: per-pair transition tiles, single-tile floorFill, the variant idea,
the megalith special-case, and the two-system split (below) — the fills survive,
reborn as world-position functions.

---

## 3. Documents to read (in order)

1. **`docs/superpowers/specs/2026-07-20-ground-compositing-architecture-design.md`**
   — THE architecture + the 4-phase plan (G1–G4). Read first.
2. `docs/superpowers/specs/2026-07-20-palette-architecture-and-determinism-design.md`
   — AAP-64 core + per-biome accents; relax determinism to golden-samples +
   palette-conformance invariants; baked vs runtime split. (Independent of the
   compositing work but composes with it; not started.)
3. Biome specs/plans (reference for what's built): `2026-07-20-frozen-biome-*`,
   `2026-07-20-lava-biome.md`, `2026-07-20-grove-biome-*`.
4. `CLAUDE.md`, `docs/CONTRACTS.md`, `docs/DIAGONAL_STAIRS_AND_RAMPS.md`.

## 4. Prototypes (they PROVE the architecture — poke them)

- **Mask-composite** (the big one — live transitions, no baked tiles, animated
  shoreline waves): https://claude.ai/code/artifact/8de13b4a-9d28-43a1-b0e0-5a65467dbd34
- **Fill-variant tuner** (subtle world-position fills, edge-mating):
  https://claude.ai/code/artifact/b01118b6-3a00-4e0d-92a3-c8ee53f7cc99
- **Seam-rounding tuner** (the corner-rounding knobs, now destined for the shared
  mask): https://claude.ai/code/artifact/e2f94184-245f-4ee4-b0af-54c098353c66

---

## 5. NEXT STEPS — phased plan (from the architecture spec)

- **G1 — world-position `fill()` library.** Natural fills for the built ground
  families (desert/reef/ice/lava/grove), palette-locked, world-position, with a
  faint per-material grain. The prototype's `fillRGB` is a working reference.
- **G2 — shared masks + offline composite bake.** One 47-mask set from
  `overlayMask`; a bake pass = base + over·mask + outline; priority layering. Prove
  parity with a review scene.
- **G3 — runtime integration.** Wire the composite into the map renderer
  (`ScaledGroundView` bake) for one real zone; animated shoreline band.
- **G4 — authored art floors.** Megalith temple slab `fill()` + world-placed
  features, for the Act 3 sunken ruins.

Sequence **G1 → G2 → G3**, G4 after G2. **Immediate next action: start Phase G1**
(brainstorm → spec → plan → build). The owner was mid-"proceed to G1" at handoff.

---

## 6. Key context / gotchas

- **Two-system split (important):** the cliff-generator sheets (`cliffReef` etc.)
  were **never wired in-game** — the actual zones render grounds via `tileset2-8` +
  `src/game/maps/dressing.ts` (8-directional edge sets). The new compositing
  architecture is meant to become the **unified in-game ground system**, replacing
  both. See memory `reef-transitions-two-systems`.
- **What stays baked:** cliff *vertical* structure — wall faces (glacier/coral/
  basalt), ramps, diagonal flights, plateau caps. Only **flat-ground transitions**
  move to the composite.
- **Seam rounding lives in the mask now:** `blob47.ts` `overlayMask` geometry (the
  `cornerRounding`/`pocketRounding`/`inset`/`irreg` work) defines the shared 47-mask
  shapes in G2. Not wasted.
- **Rendering path exists:** the game already bakes ground textures at runtime
  (`src/game/gfx/ScaledGroundView.ts`, `LightMask.ts`, `Mode7Ground.ts` use
  `textures.createCanvas` / `RenderTexture`). G3 extends this, not a new capability.
- **Determinism relaxation** (palette spec) pairs naturally with the fill approach —
  you can't sha-pin infinite world-position output; pin golden samples + invariants.
- **Palette:** currently 25 colors; AAP-64 migration is planned but not started.
  G1 fills draw from the palette; do palette migration first, in parallel, or fold
  it in — owner's call.

## 7. How to catch up fast
Read §2 (the why) and doc #1 (the architecture), poke the mask-composite prototype
(§4), then start Phase G1 per §5.
