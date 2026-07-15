# Art Direction — the 2.5D upgrade

Target: SNES top-tier — **Final Fantasy VI** (FF3 US) world map + towns,
**Secret of Mana** organic zones. This document is the binding spec for
the art overhaul. Build agents follow it exactly; deviations need
architect sign-off. Engineering contracts that ship from this doc get
their own versioned section in `CONTRACTS.md`.

Everything stays inside the established pipeline philosophy: procedural,
palette-locked, deterministic, additive tile indices, sha256 re-pins as
the deliberate ritual for redrawn shipped pixels.

---

## 1. Global drawing rules (every tile, every sprite)

- **G1 Light from the top, biased screen-left (NNW).** Top surfaces are
  the lightest thing in a scene; south/east faces carry the shade. Never
  light from below/right.
- **G2 Shadows are palette ramp steps, cooler — never black, never
  alpha.** All shading via the shadow LUT (§3). Pure `ink` only for
  outlines' ground-contact edges, deep voids, eyes.
- **G3 3–4 values per material per tile, max.** More reads as noise.
- **G4 Value hierarchy, brightest→darkest:** lit tops (wall caps, mesa
  tops) → walkable floor → vertical faces → shadowed faces/cast shadows
  → void. A wall face must never be lighter than the floor it meets.
- **G5 Texture = 2–5 sparse motif clusters per tile** (tuft, pebble,
  crack, 2–4 px each), NOT per-pixel speckle. The current uniform
  speckle is the #1 thing being removed.
- **G6 Overworld anti-shimmer: minimum feature 2×2 px.** No isolated
  single pixels, no 1px checker dither, no 1px lines &gt;4px (except
  high-contrast structural lines: coastline lip, ridge crest) on any
  tile the Mode-7 plane samples. Interior tiles may be finer.
- **G7 Dither is seasoning:** 2px-cluster interleaving where two ramp
  values meet across a large area; &lt;15% of a tile's pixels; never
  full-tile checker.
- **G8 Sel-out outlines.** Contour color = darkest ramp value of the
  material itself; `ink` only along bottom contact edges. Uniform ink
  outline everywhere reads NES — retire it for terrain; keep it for
  small props/creatures where silhouette matters.
- **G9 Every terrain boundary is authored.** No hard butt-joints between
  materials. The higher/rougher material owns the border tiles.
- **G10 Orientation via texture direction:** floors/tops isotropic or
  horizontal-motif; vertical faces get horizontal courses (strata,
  brick) with a vertical light→dark gradient down the face and a 1px
  darkest foot line.

## 2. The floor/wall/edge grammar (the "2.5D" core)

Wall families gain three visual roles (new tiles, appended):

- **Cap** (`<wall>Cap`) — the lit horizontal top of a wall run: body in
  the wall material's top texture, a 2–3px lit lip along its south edge.
  Lightest tile in the family.
- **Face** (`<wall>Face`) — the vertical south-facing surface: horizontal
  courses, gradient value-2 (top) → value-4 (bottom), 1px `ink`/darkest
  foot line on the bottom row.
- **Foot shadow** — the floor tile south of a face is swapped to its
  `<floor>Shade` variant (shadow LUT recolor of the same art, top 8 rows
  for 1-tile walls with a 2px broken/dithered lower boundary).

North-facing edges (a room's bottom wall seen from behind) stay thin:
cap + 1–2px dark edge line, no tall face — the FF6/SoM asymmetry.
Chasm/water/void boundaries: floor tiles bordering void get a 1–2px
darkest edge on the void side and thinner texture within 4px (`G5`).

### The dressing pass (engineering centerpiece)

`src/game/maps/dressing.ts` — a **pure, deterministic** post-pass
`dressMap(map: ZoneMap): ZoneMap` applied inside each map builder
(wrapping its return). Rule-driven off a name registry:

- wall cell whose south neighbor is walkable → render as `<wall>Face`
  (if registered); wall cell above a face cell in the same run →
  `<wall>Cap`.
- walkable floor cell whose north neighbor is a face → `<floor>Shade`.
- registered terrain pairs get transition tiles by 4-neighbor adjacency
  (edge + outer corner variants; inner corners for hot pairs only).
- Idempotent: `dressMap(dressMap(m)) === dressMap(m)`; unit-tested.
- Variants inherit solidity from their base name (extend
  `SOLID_TILE_NAMES` mechanically: every `...Face`/`...Cap` of a solid
  base is solid; every `...Shade` of a walkable base is walkable). BFS
  reachability/enclosure tests must stay green with dressed maps.

Zones keep hand-authored `string[][]` maps; polish is derived. Maps may
still place dressed names explicitly where art needs a hand nudge.

## 3. Palette

The 19-name "desert dusk" palette stays the identity. Ramps and shadow
LUT (`tools/pipeline/src/fx.ts`, mirrored in manifest):

- Warm/terrain ramp: `bone → sandLight → sand → amber → clay → rust →
  umber → plum → ink`
- Vegetation ramp: `mint → jade → teal → tealDeep → ink`
- Water/ice ramp: `bone(glint) → skyBlue → slate → indigo → ink`
- Stone (warm rock): `sand → clay → mauve → plum → ink`; (cool stone/ice
  uses the water ramp).
- Universal shadow terminator: `plum` (not ink).

**Approved additions (append to `palette.ts`, max 4 total):**
- `umber: "#6e4036"` — dark warm brown: wall feet, wood shade, dune
  shadow lines, canopy crevices on warm plants.
- `sandShade: "#c69b7c"` — cooler sand one step down: large cast-shadow
  areas on sand/camp floors where `amber` reads too orange.

`shadowOf: Record<PaletteName, PaletteName>` LUT drives every cast
shadow, canopy south rim, and `...Shade` tile so shadow color is
consistent game-wide. Additional colors require architect visual
approval before merging.

## 4. Overworld (Mode-7) — flat art + true verticality

### 4a. Re-authored ground tiles (append to `tiles2`; the Mode-7
resolver and maps-test names already/must cover `tiles`+`tiles2`)

- **Sand plain**: rewrite `sand/sand2/sand3` (in place, re-pin): calm
  base, **paired dune ridge lines** — 1–2px wavy near-horizontal
  S-curves, `sandLight` crest over `amber`/`umber` shade — roughly one
  ridge per 1–2 tiles, designed to continue across tile boundaries.
  No speckle.
- **Scree/rock base** (`scree`, new): warm rock ground placed under
  mountain masses; sparse 2×2 pebble clusters, `clay`/`mauve`.
- **Sand↔scree transition** (edge + corner set, new): clustered-finger
  interpenetration per G7/G9, sand owns nothing — scree (rougher) owns
  the border.
- **Mountain foot shadow band** (`screeShade`, new): shadow-LUT scree
  for the row south of mountain masses — masses visibly *sit* on the
  plain.
- **Water + coast**: rewrite `water/water2`: 3-value ramp, 3–5px
  horizontal wave dashes (2/tile, loosely row-aligned). New **coast
  ring** tiles (edge + corners): land dark lip 1–2px → broken `bone`
  surf fringe → `skyBlue` shallow band 2–4px → open water. Land owns
  the border.
- **Mountain tiles 1–8**: redrawn (in place, re-pin) per the 3/4-view
  recipe — irregular peaks, `umber`/`plum` ridge zigzag along the
  crest, lit NW flank (`sand`/`clay`), shaded SE flank (`rust`/`plum`,
  ~50% of mass), darkened south foot. These remain for the
  flat-tilemap fallback and distant texture — the near-field 3D read
  comes from billboards (§4b).
- `overworldMap.ts` gains a pure autotile selection pass (coast ring,
  scree fingers, foot shadows) — deterministic, keeps enclosure/BFS/
  walkable&lt;⅓ invariants and both gates.

### 4b. Billboard layer (the genuine 3D)

- `src/core/mode7.ts` gains the **forward projection**
  `worldToScreen(cam, wx, wy)` → `{x, y, scale} | null` (inverse of
  `projectGround`; scale ∝ focal/depth), pure + unit-tested against
  `projectGround` round-trips.
- New sheet `owBillboards.png` (new contract, CONTRACTS §): mountain
  masses as **standing sprites** — 3 peak variants (~48×40 frame budget
  at the artist-agent's discretion, bottom-anchored), plus joshua tree,
  mine-mouth timber, truck landmark. Drawn with full FF6 3/4 mountain
  treatment: lit NW faces, shaded SE, snowless desert rock crests.
- `Mode7Ground`/`OverworldScene`: decor cells whose names are registered
  as billboards are **skipped when painting the ground texture**
  (ground under them = scree) and instead drawn as Phaser images,
  positioned/scaled per frame via `worldToScreen`, depth = screen y,
  haze-tinted toward `amber` and faded with depth (engine tint is
  presentation, not pixel art — allowed). Culled above horizon /
  beyond maxDepth. Clusters may merge to one billboard per 2×2 mountain
  block to keep counts ~≤120.
- Flat-tilemap fallback path is untouched (decor mountains still render
  as tiles there). WebGL failure must still degrade cleanly.

## 5. Zone tilesets (tiles, tiles3–tiles8) — per-family upgrades

Every zone floor loses speckle for motif clusters (G5); every wall
family gains Cap/Face; every principal floor gains `...Shade`; chasm/
water edges get lip tiles. School per R25: **geometric** (FF6) for
built spaces — station, camp interiors, temple, pizzeria; **organic**
(SoM, rounded hand-AA'd patch boundaries, no dither) for natural
spaces — oasis, grove, reef, ice caves.

Priorities per sheet (append; redraw-in-place where noted):
- `tiles`: sand family redraw (shared with overworld recipe), water
  redraw + shore lip, `brick`→cap/face pair, palm gets engine blob
  shadow instead of baked darkness.
- `tiles2`: mineWall cap/face, mineFloor motifs + `mineFloorShade`,
  station wall cap/face, asphalt weathering bands (no speckle).
- `tiles3` (ice): iceWallDeep cap/face with strata, iceFloor sheen
  bands, chasm edge lip set, `iceFloorShade`.
- `tiles4` (sea): seaWater wave recipe, floe edge ring (land-owns-
  border), templeFloor flagstone subgrid + `templeFloorShade`,
  templePillar reads base-lit.
- `tiles5` (camp): campWall cap/face, campFloor plank/parquet subgrid +
  shade, crates/barrel get lit-top/shaded-side per G1.
- `tiles6` (grove): organic school showcase — groveGrass↔groveMoss
  rounded transitions, riverbank lip on groveWater, sunbeam re-done as
  soft additive column (bone/mint sparse, no hard rectangle), caveWall
  cap/face, `groveGrassShade`.
- `tiles7` (reef): reefWall cap/face, glowMoss clusters, reefWater
  ripple recipe, silt↔floor organic transition.
- `tiles8` (pizzeria/lava): basaltWall cap/face, tileFloor checker
  subgrid + shade, lavaVent glow ramp (rust→amber→bone center),
  emberFloor motif clusters.

## 6. Sprites

- **Rules:** sel-out outlines (G8) — replace blanket `outline("ink")`
  with material-dark contours, ink at bottom contact; NNW shading —
  base + 1 shade low/right per material; 1px rim highlight on the
  head's upper-left arc; ≤4 values per material. Frame grids,
  dimensions, pose tables, animation indices are **frozen contracts**
  — pixels change, indices don't.
- **Engine grounding:** small elliptical blob shadow under actors in
  zone scenes and under the Mode-7 avatar (a generated `blobShadow`
  frame or Graphics ellipse in `plum` at low alpha — presentation
  layer, allowed).
- **New sheets:** `dusty.png` (giant pack rat, 24×24, replaces the
  jackrabbit stand-in in `TrailScene`), `sahra.png` (16×24 4-dir elder,
  replaces generic `npc` in `SahraGroveScene`).
- **Variants (cheap, procedural):** miner recolor params → Mo/Edda/Gus
  individuation; friendly reef-crawler recolor of `crystalcrawler`.
  These are stretch goals after the core lands.
- Story constraints hold: scarab family stays odd-but-terrestrial (no
  alien signifiers before Part 3); code ids and display names unchanged.

## 7. Engineering constraints (binding)

1. **Additive indices only.** New tiles append to their sheet's
   `*_NAMES`; new sheets are new files + manifest entries + CONTRACTS
   section. Never reorder or remove existing indices.
2. **Redraw-in-place is sanctioned** for this overhaul; every touched
   sheet's sha256 gets deliberately re-pinned in
   `tests/pipeline/determinism.test.ts` with a comment naming this art
   pass.
3. All pipeline invariants stay green: palette compliance, layout,
   determinism, motion deltas, non-emptiness, Act-2 legibility
   assertions (iceFloor vs iceWallDeep contrast etc. — the redraws must
   satisfy them, not weaken them).
4. `Mode7Ground.tileFrame` and the maps-test `KNOWN_NAMES` must cover
   every sheet the overworld map uses (widen both if any overworld tile
   lands outside tiles/tiles2).
5. `SOLID_TILE_NAMES` extended for every new solid variant; BFS
   enclosure/reachability tests green for all 38 zones with dressing
   applied; overworld keeps walkable &lt; ⅓ and exactly two gates.
6. Shared drawing helpers live in `tools/pipeline/src/fx.ts` — the
   copy-pasted per-tileset `tile()/stamp()/sandBase()` helpers migrate
   to it opportunistically (only in files being touched anyway).
7. Verification bar before "done": `tsc --noEmit`, `vitest run`,
   `npm run build`, `npm run smoke`, `npm run smoke:touch` — plus the
   **visual gate**: rendered sheet + in-scene screenshots reviewed by
   the architect; art that passes tests but looks flat gets iterated,
   not merged.

## 8. Execution phases

- **Phase F (foundation, sequential):** palette additions + `fx.ts`
  helpers (shadow LUT, ramps, motif scatter, cluster dither, ridge/
  lobe/strata/edge-finger generators, cap/face composers) + tests.
- **Phase O / Z / S (parallel, worktree-isolated):** Overworld (§4) /
  Zones (§2+§5) / Sprites (§6). Shared files (`assets.ts`,
  `manifest.ts`, `index.ts`, determinism pins, `types.ts`) get
  append-shaped edits; architect merges.
- **Phase I (integration):** merge, regenerate, full verification,
  screenshot review loop, independent code+art review, docs/CONTRACTS
  updates, push.
