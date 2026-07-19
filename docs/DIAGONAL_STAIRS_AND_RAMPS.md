# Diagonal Stairs & Ramps — how the system works

> **Purpose.** This is the canonical, self-contained explainer for the desert
> diagonal stair/ramp art system so any fresh session can pick it up without
> re-deriving it from scratch. It captures the *design that is locked and
> approved by the owner*. If you are about to touch `tools/pipeline/src/cliffs/
> diagonalRamps.ts`, read this first. Related: the design spec + plan under
> `docs/superpowers/{specs,plans}/2026-07-18-desert-cliff-ramps-diagonal.*`,
> and the base cliff tileset in the same `cliffs/` folder.

## 0. The one thing to not get wrong

**It is an ISOMETRIC view. Each block is a cube of which you see exactly TWO
faces: the TOP and the FRONT.**

- **TOP face** = the horizontal **walking surface**. Colour role: `stoneLit`
  (stone stairs) or lit `sand` (sand ramp).
- **FRONT face** = the vertical face you look at. Colour role: rock
  (`stoneDark`/`stoneDeep` via `wallFace`).

This is *not* a head-on 2D side view and *not* a "tread + riser drawn as two
stacked rectangles" picture. If your render looks like a flat platformer
staircase, you have it wrong. (History: several early attempts drew it head-on
or as MC-Escher stacked cubes; the fix was always "top face = walking surface,
front face = vertical rock, seen isometric.")

Horizontal surfaces (tops, treads, ground, plateau) get the **floor** texture
(`floorFill`). Vertical surfaces (fronts, risers, retaining walls) get the
**wall** texture (`wallFace`). Keeping that split correct is 80% of getting it
right.

## 1. The parametric model (a cube generator)

The whole system is a function over stacked cubes. The owner's reference
generator (interactive) lives at:
`https://claude.ai/code/artifact/a48946f1-baf5-429e-b40e-4a88fdfc4c3c`

A cube has three dimensions, in **units**:

| Param | Meaning | Controls | Default |
|---|---|---|---|
| **block width** (`bw`) | horizontal run per step | **steepness / angle** | 2 |
| **block height** (`bh`) | riser height per step | **riser height** | 1 |
| **block depth** (`bd`) | how deep the top face is | **stair WIDTH** ("4-ft stairs") | 4 |

Projection (oblique "top + front", locked): for world `(x, y, z)` with
`x`=width→right, `y`=height→up, `z`=depth→receding:

```
screenX = x*unit*flip + z*skew*unit*flip
screenY = -y*unit - z*rise*unit
```

Locked constants: `unit=4`, `skew=0` (pure top+front, no side face),
`rise=0.5` (depth foreshortens to half). `flip=+1` for the `se` direction
(ascends to the right); `flip=-1` is the `sw` mirror (`sw = se.mirrorX()`).

The staircase is a **solid stack**: column `i` contains cubes `j = 0..i`, so
the mass fills down to the ground (the dark rock body under the run). The
**top cube's top face** is the visible tread; everything below is front-face
rock.

## 2. Angles = block width : height (this is the key relationship)

**The angle is set by the ratio of block width to block height** (rise over
run of a step). Three clean angles, chosen because they tile on the pixel grid:

| Angle | rise:run | `bw`,`bh` (at unit=4) | step px (right, up) | Tile period | Feel |
|---|---|---|---|---|---|
| **26.57°** | 1:2 | bw=2, bh=1 | 8 right, 4 up | **2 tiles wide × 1 tall** (`runA`,`runB`) | shallow — the owner's "standard stairs" default |
| **45°** | 1:1 | bw=1, bh=1 | 4 right, 4 up | 1 tile (`run`) | canonical |
| **63.43°** | 2:1 | bw=1, bh=2 | 4 right, 8 up | 2 tiles tall (`runU`,`runL`) | steep |

Read the same fact in **tile-fractions** (the owner's framing, most intuitive
for a tile map): a ramp/stair climbs a clean amount of height **per tile of
length** — **1/3, 1/2, or 1 tile of rise per tile** — and the **total height =
slope × length**. So a longer run is gentler; a short one is steep. A 3-tile
run at 1/2-per-tile climbs 1.5 tiles. "How long is it" therefore *sets* how
high it ends up.

**depth (`bd`) is independent of the angle** — it is the stair WIDTH (the
"4-ft" walking width), and it stays visually constant no matter the slope
(see §4).

## 3. Stairs (stoneSteps material) — the LOCKED recipe

Discrete stone steps: each step is a cube with a `stoneLit` **top** (walking
surface) over a rock **front**.

- **Top / tread**: lit `stoneLit` walking surface with sparse `stone` grain
  (~10%). A **shaded back lip** on the uphill/back ~28% of the foreshortened
  depth (`stone`/`stoneDark`) — this is the shadow the step above casts on the
  back of the tread. **Outline ONLY the top tread**, in `stoneDeep` (a 1px line
  along the tread's top edge). Do **not** outline every cube — the front is one
  continuous wall.
- **Front**: `wallFace("rock", RAMP_WALL_PARAMS)` sampled by **absolute screen
  position** so the whole front reads as a single continuous rock wall across
  every tile seam. `RAMP_WALL_PARAMS = {courses:3, blockSize:3,
  blocksPerCourse:3, stagger:0.5, tone:0.16, mortar:0.28, orderVsRandom:0.45}`
  (identical to the straight ramps + the desert cliff, so it matches).

## 4. Ramps (sandSlope material) — the LOCKED recipe

A ramp is the **smooth version of the exact same wedge**: instead of stepped
stone treads, ONE continuous sand incline is the walking surface, sitting on
the **same continuous rock body** as the stairs. "The incline IS the surface;
rock/cliff support sits below it." It is *not* a solid sand wedge.

Four locked properties:

1. **Eased ends.** The height profile is not linear — it eases in/out so the
   surface curves gently off the ground at the foot and into the plateau at
   the top, staying near the true slope through the middle:
   `h(x) = Rise * g(t)`, `t = x/Length`,
   `g(t) = (1-w)*t + w*smootherstep(t)`, with `w ≈ 0.5` (a single tunable
   knob). `smootherstep(t) = t³(t(6t−15)+10)`.

2. **Constant walking width.** The path must NOT narrow as it steepens. The
   sand band's vertical thickness is scaled by the **local** slope:
   `thickness = WPERP * sqrt(1 + localSlope²)` where `WPERP ≈ 8` (the 4-ft
   width in px). Using the *local* slope keeps the width constant through the
   eased ends too.

3. **Shading = light from above, lit at the downhill cliff-top lip.** Across
   the band depth `f = 0 (back/uphill) → 1 (front/downhill, the cliff-top
   lip)`: `f<0.28 → sandShade`, `f<0.70 → sand`, `f≥0.70 → sandLight`.
   The **lit** edge is the downhill lip at the top of the cliff; shade eases
   toward the uphill back edge. **The cliff BELOW must never appear to shade
   the surface ABOVE it** — putting the dark edge at the cliff boundary was a
   real bug; the leading edge there catches the highlight instead. `umber`
   outline on the far/uphill edge; sparse `umber` flecks in the shaded band.

4. **Variable rise.** Same 1/3, 1/2, 1/1-tile-per-tile slopes as the stairs;
   total height = slope × length; length sets steepness.

## 5. Tiling — how a run becomes placeable 16×16 tiles

Tiles are 16×16 and placed on a 16px grid. A run is defined by ONE **global
band sampler** `cell(gx, gy)` for the infinite run; tiles are sliced from it,
so seam continuity is **structural**, not hand-fixed.

The band has a **translational symmetry**: for 26.57°,
`cell(gx+32, gy−16) === cell(gx, gy)` — i.e. shifting **2 tiles right and 1
tile up** reproduces the band. Therefore the run repeats on that lattice with
exactly **two distinct tiles** (`runA` at even columns, `runB` at odd), placed
stepping 2-right / 1-up. 45° → symmetry `(16,−16)`, one `run` tile on a
1-right/1-up lattice. 63.43° → `(16,−32)`, two stacked tiles `runU`/`runL`.

Pieces per material per direction: **45°** `run`+`capTop`+`capBottom` (3);
**26.57°** `runA`+`runB`+caps (4); **63.43°** `runU`+`runL`+caps (4);
plus one angle-independent `landing` (the switchback pivot). Both directions
via `mirrorX`. Total **48 diagonal tiles** (2 materials × 2 dirs × 12).
Naming: `dramp{Mat}{Angle}_{dir}_{piece}` (e.g. `drampSteps2651_se_runA`),
landing drops the angle: `dramp{Mat}_{dir}_landing`.

**Known build snag (in progress):** the rock front carried under the surface
is thicker than one tile step, so a naïve single-row slice leaves gaps between
periods. The run must either carry the rock only to the tile bottom (letting
the map's cliff fill below) or be sliced as a thicker diagonal. This is the
one genuinely fiddly part and needs render-eyeball iteration (see the plan's
Task 1) — the *look* is locked; only the slice geometry is being tuned.

## 6. Non-negotiable pipeline rules

- **Palette-locked**: only colours from `src/shared/palette.ts`. Cells are
  `PaletteName | null`. Roles used here: `stoneLit` (tread top), `stone`
  (grain/lip), `stoneDark`/`stoneDeep` (rock front, outline), `slate` (INSIDE
  retaining wall), `sand`/`sandLight`/`sandShade`/`umber` (ramp surface +
  ground), `ink` (deepest separation).
- **Deterministic**: variation comes only from `h2(x,y,seed)` / `mulberry32`.
  **No `Math.random`, no `Date`.** Sheets are sha256-pinned in
  `tests/pipeline/determinism.test.ts`; the sheet is **additive-only** — never
  reorder existing frame indices; re-pin deliberately when you extend it.
- **Integration path**: `diagonalRampTiles(...)` → `generateTerrain` emits the
  `dramp*` names → `frames.ts` bakes them into `cliff.png` (padding is derived)
  → wired like `owMountains` (assets.ts → manifest.ts → index.ts). Re-pin
  `cliff.png` once after visual approval; land as a PR into `main` with a
  regular merge commit (never commit to `main`, never fast-forward).

## 7. Process lesson (so we don't repeat it)

When the owner draws an exact pixel grid or hands you a parametric generator,
**reproduce THAT exactly** — reconstruct it, then apply textures to the same
geometry. Do not freehand-guess the look from prose feedback; that cost ~10
wrong iterations here. The generator artifact (§1) and this doc are the source
of truth for the geometry; the palette file is the source of truth for colour.
