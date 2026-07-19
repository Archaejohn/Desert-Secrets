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
walking width; **6 ft / `bd=6` / 12px is the locked default** — wider reads
better than the old 4-ft), and it stays visually constant no matter the slope
(see §4).

**Riser height** (`bh*unit`) should be a **clean divisor of 16 — use 4 or 8
px** — so whole steps pack evenly into 16px tiles. (Riser height is a separate
knob from the angle; the angle is the `bh:bw` *ratio*.)

## 3. Stairs (stoneSteps material) — the LOCKED algorithm

Generated as an **algorithm over stacked cubes** (never hand-drawn). Per step
(the top cube of column `i`) you see two faces: a `stoneLit` **top** (walking
surface) over a rock **front**. Solid stack fills the body to the ground.

**Dimensions** (units → px at `unit=4`, `rise=0.5`):

| Unit param | Meaning | px | Note |
|---|---|---|---|
| `bw` (run) | horizontal run per step | `bw*4` | sets steepness (angle) |
| `bh` (riser) | riser height per step | `bh*4` | **use 4 or 8 px — must divide 16** for clean tiling |
| `bd` (depth) | stair WIDTH | `bd*2` | **6 ft default → bd=6 → 12px tread depth** |

Wider is better: a 12px (6-ft) tread gives the shading room to read; narrow
treads were hard to parse.

**Per-face rules:**

- **FRONT face (riser + body)**, at `z=0` → `wallFace("rock", RAMP_WALL_PARAMS)`
  sampled by **absolute screen position** so the whole front is one continuous
  rock wall across every seam. `RAMP_WALL_PARAMS = {courses:3, blockSize:3,
  blocksPerCourse:3, stagger:0.5, tone:0.16, mortar:0.28, orderVsRandom:0.45}`
  (identical to the straight ramps + desert cliff).
- **TOP face (walking surface)** of the top cube → `stoneLit` + sparse `stone`
  grain (~10%, from `h2`).
- **Tread shading = the step separator (NO outlines).** A slight shade on the
  walking surface along its **UP-SLOPE edge** — for `se` (ascends right) that
  is the tread's **RIGHT** edge; for `sw`, the **LEFT** — the edge that butts
  against the **next step's riser**. Recipe: at the up-slope edge, 1px
  `stoneDark` contact crease, then 1px `stone`, then the lit surface. In the
  band sampler this is `lx = gx mod (bw*unit)`; shade where `lx` is at the
  up-slope end.

> **CRITICAL — verified against the 3D cube model (the artifact), do not
> re-derive by eye.** The shade goes on the tread's **up-slope (right for `se`)
> edge**, the edge against the NEXT step's riser. It does **NOT** go on the
> tread's top/back edge: that edge recedes up the screen and is the high-`z`
> side **against the INSIDE WALL**, so shading there is wrong (it reads as the
> wall shadowing the tread). An earlier version made exactly this mistake — if
> your steps look like they're lit from behind a wall, you shaded the wrong
> edge. Confirm by rendering the explicit cubes and marking one tread + the
> next step's riser (they meet at the tread's up-slope edge).

- **No per-tread outline.** In a multi-step run, outlining each tread makes a
  mess of stacked lines; the up-slope cast-shadow crease alone separates steps.

> **45° tuning (render-verified, 2026-07).** At the 45° cadence (4px treads)
> the full recipe above over-fragments — against the busy boulder face the
> treads read as separate slivers. The shipped 45° surface is deliberately
> calmer: solid `stoneLit` body (no grain), a single soft `stone` crease at
> the up-slope edge (same edge rule as above), a 1px `stone` shade at the
> uphill back edge + `stoneDeep` contact line vs the rock, a continuous 2px
> `stoneLit` lip at the downhill edge, and each tread's 4px riser FRONT face
> drawn as `slate` between `stoneDeep` contact lines (see §5). The 26.57°
> tiles should start from the original recipe (8px treads have room for it).

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

## 5. Tiling — surface-only overlay pieces over the real cliff autotile

Tiles are 16×16 and placed on a 16px grid. A run is defined by ONE **global
band sampler** `cell(gx, gy)` for the infinite run; tiles are sliced from it,
so seam continuity is **structural**, not hand-fixed.

**The flight tiles carry ONLY the walking surface** (transparent everywhere
else) and are composited over the map's ordinary autotiled cliff
(rim / face / footer). This resolved the old "build snag" (a rock body baked
into the run tiles fought the cliff autotile and had to be clipped at the
base, chopping treads): the rock around/above/below the band now **IS** the
`cliffRock_*_face` texture — identical by construction — the plateau cap
shows over the flight's top tread, and the footer's contact-shadow + scree
line runs STRAIGHT across beneath the foot. No special rock alignment, no
clipping.

The band has a **translational symmetry**: for 45°,
`cell(gx+16, gy−16) === cell(gx, gy)` — shifting 1 tile right and 1 tile up
reproduces the band — so the run repeats on the **1-right / 1-up lattice**.
The band is thicker than one tile's 16px drop (12px tread + riser / ≈17px
sand width), so each lattice cell is a vertical PAIR: `run` (upper) +
`runLower` (its spill into the tile below).

**The five pieces (45°, per material, `se`)** — for a flight with top column
`c0` on rim row `y0` over `H` face rows (footer at `y0+H+1`):

| piece | where | what |
|---|---|---|
| `top` | `(c0, y0)` | flat top tread in the rim tile's rock rows (12–15); plateau + cap show above — *"the top landing is just an extension of the plateau"*. Stone: a TREAD-wide (12px) landing with a 4px rock shoulder east; sand: eased from flat into the incline (doc §4). |
| `topLower` | `(c0, y0+1)` | the top tread's spill into the face row |
| `run` | `(c0−k, y0+k)`, k=1..H | the repeating diagonal band |
| `runLower` | `(c0−k, y0+k+1)`, k<H | its spill |
| `foot` | `(c0−H, y0+H+1)` | the last spill, in the FOOTER row: `runLower` cut at the footer's contact row (in-tile row 9) so the final tread sits on the straight contact line and ground + scree continue unbroken |

The phase is exact: the top tread's lip is the rim's rock-face start (row
12), each following tread drops 4px (the first riser is 6px, absorbing the
rim-row-12 vs footer-ground-row-10 2px offset), and the final tread bottoms
out on the footer contact line. Within the band, stone steps follow the
locked cube cadence (§2: 4px run / 4px riser at 45°), each tread showing its
lit top face over a `slate` riser front face (the retaining-cut inside-wall
role, §6) — the slate keeps step fronts legible against the boulder face.
The stone surface is deliberately **calm** (solid `stoneLit`, no grain): the
busy boulder texture around it is what makes the cut read as a cut.

`sw` is the structural mirror: every piece `mirrorX()`, stamped ascending
left. 26.57° (`(32,−16)` symmetry, two-column period) and 63.43° will reuse
the same overlay model when built; only 45° exists today
(`diagonalFlightTiles` in `diagonalRamps.ts`, demoed in
`render-cliff-review.mts` step 6).

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
