# Runtime Wall / Elevation Engine — Design (Decision of Record)

**Date:** 2026-07-21
**Status:** design validated by a working prototype; foundational — decomposes into phased implementation plans
**Prototype:** `docs/prototypes/cliff-wall-raycast.html` (owner's concept — open it)
**Parent direction:** the "recipes over tiles" engine north star, and the ground-
compositing architecture (`docs/superpowers/specs/2026-07-20-ground-compositing-
architecture-design.md`) — this is the **vertical** half of the same engine.

## 1. Why — this is an engine capability, not "walls for Desert Secrets"

The real goal is a **recipe-driven procedural-graphics engine in Phaser**: a story
declares *what a place is* and the engine generates the pixels. The ground-compositing
pivot did this for flat ground (world-position fills + shared-mask transitions, baked at
runtime). This design does it for **vertical structure — walls, plateaus, cliffs,
borders, and the drop at a water's edge** — as the same kind of runtime-baked, recipe-
declared, non-repeating art. Desert Secrets is the first story to use it; nothing is
hardcoded to it.

**What exists today is greenfield.** The elaborate baked cliff-tile sheets (`cliff*`,
sha-pinned) were never placed in any map. Live verticality is the crude `dressing.ts`
**Face/Cap** trick (a wall tile whose south neighbour is walkable gets a flat vertical
"Face" + a lit "Cap"; no height data; name-based collision). This engine supersedes that
crude trick with generated rock, and gives the never-used baked cliff sheets a successor.

## 2. What the prototype proves

A cliff face built as **3D solids** (boxes / ellipsoids / oriented boxes) and **ray-cast
once** through the same camera + light as the game's props (**azimuth 0° / elevation 33°
— the "prop view"**, which already matches the game's faked-oblique art). Key ideas we
keep:
- **Cracks are real occlusion, not painted.** Gaps between blocks expose a dark recess
  plane behind; a depth-discontinuity AO pass darkens them. Same principle as G4's
  transparent shatter cracks — real depth, not a drawn line.
- Already **AAP-64** palette-locked and driven by the **same `h2` int32 hash** the
  pipeline uses. Banded + Bayer-dithered shading, ramp-index space.
- **~11 rock recipes** (strata, blocky granite, columnar basalt, sandstone, shale, chalk,
  conglomerate, tuff, schist, quartzite, glacier ice), each with face/recess/cap/talus
  ramps + a crest profile + block-top identity; plus **ramps/stairs** carved as solid
  wedges, **crest profiles** (domed/jagged/castellated/terraced…), **cap surfaces**
  (bare/grass/snow/sand), and **talus** scree at the foot.

It is **static art** — rendered once at the fixed angle, not a live view-dependent 3D
render. That is exactly what we want.

## 3. Architecture — a wall is vertical "terrain" in the same composite

A wall lives in a **band of tiles between a higher surface and a lower one**. The engine:
1. Generates one **coherent, non-repeating** rock face for that whole band (world-
   position, no 16px stamp) from a **rock recipe** + params.
2. **Composites the foot + talus onto the lower floor through the existing 47-blob
   `overlayMask` + soft-shadow** — the *same* machinery as floor-to-floor transitions.
   The **talus is the transition band** (or, talus off, the bare wall-foot masked onto
   the floor). "Wall meets ground" is authored exactly like "sand meets grass."
3. Bakes the result into a canvas texture at scene load (the `CompositeGroundView`
   runtime-bake pattern) and places it depth-sorted.

So a wall enters the composite as a **high-priority terrain**; the engine already knows
how to carve one terrain over another with an organic edge.

## 4. One system, height-parameterized

The band height is a parameter, which collapses three features into one generator:
- **Sub-tile lip** → the drop at a **water's edge**: bank → depressed seabed, wall-foot
  masks onto the bed, and the **water surface renders over it**. This *is* the deferred
  depressed-water-floor fix, delivered by the wall generator.
- **A few tiles** → a **plateau edge**, with the generator's **ramp/stairs** carving the
  walkable path up.
- **Full height** → a **zone-backdrop** cliff (canyon / mine / glacier): scenery + collision.

## 5. Elevation = discrete STACK LEVELS (not 3D)

Not continuous height and not 3D movement — a **discrete stack-level index** per walking
surface, generalising the game's existing **floor-prop vs overhead-prop** split from props
to *walkable surfaces*:
- A surface carries a `level` (0 = base ground, 1 = plateau, 2 = higher plateau…).
  Higher levels render **over** lower ones.
- The **player carries a `level`**; it changes **only by walking a ramp/stair** — no
  jump, no fall, no continuous height.
- Depth: the wall **face draws below actors**, the **crest/overhang draws on the overhead
  layer** (above actors) — so a lower-level player near the edge is occluded by the crest,
  and within a level actors still sort by **foot-Y** (the existing system). This is what
  turns the depth-sort "hard part" into "assign a level; draw higher over lower."

## 6. Recipe / data model (the map becomes a recipe canvas)

A zone declares a wall/plateau as **data**, e.g.:
```
wall: {
  region,                 // the band of tiles (between lower + upper surfaces)
  style: "granite",       // a rock recipe
  height,                 // tiles (sub-tile lip … full backdrop)
  crest, blockWidth, relief, fracture, irregularity,   // recipe params
  talus: true,            // talus transition on/off
  ramp?: { dir, type, width },   // carve a walkable path
  level: 1,               // the stack level of the surface it fronts
}
```
Same shape as the ground system's `compositeGround` / `groundTerrain` tables — engine
code any story invokes; the first zone only *proves* it.

## 7. Rendering / integration

- Runtime-baked at load, like `CompositeGroundView`: import the pipeline's pure wall
  functions, bake a canvas texture, add as depth-sorted scene children (face-below,
  crest-overhead). No sha-pinned sheet, no manifest/GID wiring.
- **Collision** stays name/region based, extended per stack level (a level's wall band is
  solid except the ramp gap; the ramp tiles are walkable).
- Deterministic (`h2` only), so a zone's wall reproduces build-to-build; **seeded per zone
  + world position** so every wall differs and nothing repeats. Runtime bakes are **not**
  sha-pinned — tested by golden-crop + palette-conformance + pure-function determinism
  (like the ground fills), not byte-pinned sheets.

## 8. Art direction

- **Muted, not bright** (owner, on the prototype): a near-vertical face only catches
  ~0.24–0.50 lambert, and the prototype's per-material **lambert windows** (`lo…hi`,
  default ~0.11–0.53) map the ramp a shade too bright. The port **lowers those windows /
  picks darker ramp entries** so cliffs read muted. Tuned at the review-bake gate (the
  same "render → owner calls it" loop as G1/G4).
- Palette-locked to AAP-64 `CORE`; cracks/recess read as genuine dark occlusion.

## 9. Reuses / supersedes

- **Reuses:** AAP-64 `src/shared/palette.ts`, `h2` (`tools/pipeline/src/cliffs/noise.ts`),
  the 47-blob `overlayMask` (`blob47.ts`), the `CompositeGroundView` runtime-bake pattern,
  and the composite's priority-layering + soft seam shadow.
- **Supersedes (in-game):** the `dressing.ts` Face/Cap 2.5D trick, and the never-placed
  baked `cliff*` sheets. Those sheets remain as dev/reference only, like the retired
  ground pairing bakes.
- The **cliff *tile* generator** (`tools/pipeline/src/cliffs/`) is a rich source of
  material recipes (`materials.ts` wall faces, ramps, diagonal flights) to draw on; the
  raycast approach is the new in-game renderer, not a rewrite of that library.

## 10. Phasing (each its own spec → plan → build, with owner review gates)

- **Phase W1 — Port the generator.** The raycast wall into the pipeline as pure, AAP-64-
  locked, `h2`-deterministic functions: 1–2 rock recipes first (e.g. strata + one biome
  face, tuned muted), core wall + crest + talus, a standalone **review bake** shown to the
  owner. No game wiring.
- **Phase W2 — Traversable plateau (owner's chosen first target).** Compose the wall as a
  terrain (talus masked onto the lower floor), add the **stack-level** model + a **ramp**,
  and prove it in **the first room inside Cinnabar Mine** (`MineScene` / `mineMap.ts`,
  today flat `mineWall` Face/Cap) — a raised ledge you walk up to.
- **Later:** the **water-lip** (depressed-floor fix in reefHollow), **zone-backdrop**
  cliffs, the remaining rock recipes, stairs vs ramps, crest/cap variety.

## 11. Scope / non-goals

- Not real 3D, no jump/fall, no per-frame raycasting — static art at the fixed prop angle,
  discrete stack levels only.
- Not an engine/renderer swap — extends the current Phaser stack (`CompositeGroundView`
  pattern) and the flat top-down camera.
- W1 ships no game change; W2 proves one plateau in one room. Widening is later phases.

## 12. Open questions (carry into the phase specs)

- Which rock recipes first, and how far to tune the muted look before W2.
- Exact **stack-level** plumbing: where `level` lives (map data + player state), render-
  order + collision by level, and the crest-overhead split at the edge.
- Ramp vs stairs for the first traversal; ramp collision + how `level` flips mid-ramp.
- Bake cost / texture size for a full-height backdrop; whether very wide walls tile in
  bands.
- Determinism/testing model for a runtime wall (golden-crop + conformance, as for fills).
