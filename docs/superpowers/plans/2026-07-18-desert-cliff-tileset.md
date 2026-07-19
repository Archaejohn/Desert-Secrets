# Desert Cliff + Floor + Cap Tileset Generator — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the vendored prototype (`docs/prototypes/cliff-suite-v6.html`) into a parametric, build-time terrain generator in `tools/pipeline/` that returns palette-locked `PixelGrid` tiles — cliff faces + cap + footer + 47-blob floor/plateau edges + fills — baked into one new sha256-pinned sheet `cliff.png` for the desert zones (US-95 / homestead / trail).

**Architecture:** A pure `generateTerrain(params)` function (in `tools/pipeline/src/cliffs/`) drives material/terrain/blob/cliff sub-builders; a `presets.ts` table names one param config per scene-terrain, and `frames.ts` bakes every preset into the sheet. Wired exactly like `owMountains` (`assets.ts` → `SHEET_KEYS` → `manifest.ts` `TileSetDef` → `index.ts`), sha256-pinned in `tests/pipeline/determinism.test.ts`. Design spec: `docs/superpowers/specs/2026-07-18-desert-cliff-tileset-design.md`.

**Tech Stack:** TypeScript, the existing pipeline toolkit (`PixelGrid`, `mulberry32`, `composeSheet`, `tileNames`), `vitest`, `pngjs`.

## Global Constraints

- **Palette-locked.** Every emitted pixel is a `PaletteName` from `src/shared/palette.ts`. **No new palette colors** — use only existing names. The prototype's free-RGB `scale(color,k)` / `mixc` shading is replaced by **ramp-index arithmetic** (see Quantization Strategy below).
- **Deterministic, no `Math.random`/`Date`.** Coherent noise uses the prototype's pure integer hash `h2` (ported verbatim — it is pure, so it satisfies the "never Math.random or Date" rule); top-level variation may also use `mulberry32(seed)`. Two `buildAssets()` runs must be byte-identical.
- **16×16 tiles** (`TILE_SIZE`), row-major sheets; `composeSheet` requires `columns` to divide the frame count exactly.
- **Additive-only, sha256-pinned.** `cliff` is a brand-new sheet key (no existing frame indices move). Its frame order, once pinned, is append-only. The `FROZEN` sha256 is filled in **after** visual review (Task 9 → Task 10).
- **Build-time only.** No runtime/scene wiring, no map editor, no solidity registration, no extra materials/entrances (later phases). Tile **names** are chosen now to anticipate solidity (`cliffRock_*`), but nothing in `src/game/` is touched.
- **Port fidelity.** The behavior is the prototype's. Cite `docs/prototypes/cliff-suite-v6.html` line ranges; adapt only what palette-locking + determinism require. Do not redesign the algorithms.
- Git: branch `claude/desert-cliff-tileset`, commit per task, never commit to `main`.

## Quantization Strategy (read once — every render task depends on it)

The prototype computes an RGB colour then multiplies it (`scale(c,k)`), mixes it (`mixc`), or darkens it (outline/shadow). We cannot store RGB. Instead each builder works in **ramp-index space**:

- A **ramp** is an ordered `PaletteName[]`, light→dark (e.g. `ROCK = ["sandLight","sand","amber","clay","rust","umber","plum","ink"]`).
- A pixel is computed as a **ramp index** (integer, or a float that gets rounded). `scale(c, k)` where `k<1` (darken) becomes **index += steps** (toward dark); `k>1` (lighten) becomes **index -= steps**. `mixc(a,b,t)` becomes `round(mix(indexA, indexB, t))`. Outline/shadow darkening = `index += 1` (or 2).
- Emit at the end: `grid.px(x, y, ramp[clamp(round(index), 0, ramp.length-1)])`.
- Helper: `quantize(level01, ramp)` maps a 0..1 brightness to `ramp[round((1-level01)*(ramp.length-1))]` (level 1 = lightest). And `shade(ramp, index, deltaSteps)` returns the clamped name.

The mapping from a prototype `scale(color, k)` factor to `deltaSteps` is: `deltaSteps = round((1 - k) * SHADE_SENSITIVITY)` with `SHADE_SENSITIVITY` (~4) tuned once in Task 6 against the visual review. Terrain fills (`floorTile`) already pick discrete palette indices by threshold, so they port **directly** (swap hex table for ramp names, keep the thresholds).

---

## File Structure

```
tools/pipeline/src/cliffs/
  noise.ts       h2, noise, fbm, n1, w1 (ported pure hash/noise) + partition
  palette.ts     RAMPS (ROCK + terrain fills) as PaletteName[]; quantize/shade helpers
  terrains.ts    floorFill(terrainKey, seed): PixelGrid
  blob47.ts      canonical, CANONICAL_MASKS (47), overlayMask, blobTiles(over, base, opts)
  materials.ts   wallFace(material, params, seed): PixelGrid  (rock in phase 1)
  cliffFace.ts   cliffTiles(params): PixelGrid[15]
  generate.ts    TerrainParams type + generateTerrain(params): {name, grid}[]
  presets.ts     DESERT_PRESETS: TerrainParams[]
  frames.ts      cliffSheetFrames(): PixelGrid[]; cliffTileNames(): string[]
tools/pipeline/src/assets.ts        (+cliff in BuiltAssets, SHEET_KEYS, buildAssets)
tools/pipeline/src/manifest.ts      (+cliff TileSetDef)
tools/pipeline/src/index.ts         (+["cliff.png", assets.cliff])
tools/pipeline/render-cliff-review.mts   (visual-review render → gitignored PNG)
tests/pipeline/cliffs.test.ts       (structure + determinism-of-shape tests)
tests/pipeline/determinism.test.ts  (+ cliff sha256 FROZEN block)
```

---

## Task 1: Noise + palette ramps + quantize helpers

**Files:**
- Create: `tools/pipeline/src/cliffs/noise.ts`, `tools/pipeline/src/cliffs/palette.ts`
- Test: `tests/pipeline/cliffs.test.ts`
- Reference: `docs/prototypes/cliff-suite-v6.html:219-244` (h2, sm, mix, clamp, noise, fbm, n1, w1, partition)

**Interfaces:**
- Produces `noise.ts`: `h2(i,j,s): number`, `noise(x,y,cells,s)`, `fbm(x,y,s)`, `n1(x,s)`, `w1(t,s)`, `partition(total,n,chaos,s): number[]`, plus `sm`, `mix`, `clamp` — all ported verbatim (pure).
- Produces `palette.ts`: `type Ramp = readonly PaletteName[]`; `ROCK: Ramp`; `TERRAIN_RAMPS: Record<TerrainKey, Ramp>` for `sand`/`frostSand`/`asphalt`; `shade(ramp, index, delta=0): PaletteName`; `quantize(level01, ramp): PaletteName`.

- [ ] **Step 1: Write failing test** in `tests/pipeline/cliffs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PALETTE } from "../../src/shared/palette";
import { h2, partition } from "../../tools/pipeline/src/cliffs/noise";
import { ROCK, TERRAIN_RAMPS, shade, quantize } from "../../tools/pipeline/src/cliffs/palette";

describe("cliffs palette + noise", () => {
  it("h2 is deterministic and in [0,1)", () => {
    expect(h2(3, 7, 11)).toBe(h2(3, 7, 11));
    const v = h2(3, 7, 11); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1);
  });
  it("partition sums to total", () => {
    const w = partition(16, 4, 0.5, 99); expect(w.reduce((a,b)=>a+b,0)).toBe(16);
    expect(w.every(n => n >= 1)).toBe(true);
  });
  it("every ramp entry is a real palette name", () => {
    for (const ramp of [ROCK, ...Object.values(TERRAIN_RAMPS)])
      for (const name of ramp) expect(PALETTE).toHaveProperty(name);
  });
  it("quantize maps brightness to ramp ends", () => {
    expect(quantize(1, ROCK)).toBe(ROCK[0]);            // lightest
    expect(quantize(0, ROCK)).toBe(ROCK[ROCK.length-1]); // darkest
  });
  it("shade clamps index shifts", () => {
    expect(shade(ROCK, 0, -5)).toBe(ROCK[0]);
    expect(shade(ROCK, ROCK.length-1, 5)).toBe(ROCK[ROCK.length-1]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/pipeline/cliffs.test.ts`) with "cannot find module".
- [ ] **Step 3: Implement `noise.ts`** — port `h2`, `sm`, `mix`, `clamp`, `noise`, `fbm`, `n1`, `w1`, `partition` verbatim from `cliff-suite-v6.html:219-244` as exported TS functions (replace the `T=16` reference with an imported `TILE_SIZE` or a local `const T = 16`). These are pure; no `Math.random`.
- [ ] **Step 4: Implement `palette.ts`**:
```ts
import type { PaletteName } from "../../../../src/shared/palette";
export type Ramp = readonly PaletteName[];
export const ROCK: Ramp = ["sandLight","sand","amber","clay","rust","umber","plum","ink"];
export type TerrainKey = "sand" | "frostSand" | "asphalt";
export const TERRAIN_RAMPS: Record<TerrainKey, Ramp> = {
  sand:      ["sandLight","sand","amber","sandShade"],
  frostSand: ["bone","sandLight","skyBlue","sandShade"],
  asphalt:   ["slate","indigo","plum","ink"],
};
const clampI = (i:number,n:number)=>Math.max(0,Math.min(n-1,Math.round(i)));
export const shade = (r:Ramp,i:number,d=0):PaletteName => r[clampI(i+d,r.length)];
export const quantize = (level:number,r:Ramp):PaletteName => r[clampI((1-level)*(r.length-1),r.length)];
```
(Note the relative depth `../../../../src/shared/palette` — verify against how `grid.ts` imports it: `../../../src/shared/palette` from `tools/pipeline/src/`, so from `tools/pipeline/src/cliffs/` it is `../../../../src/shared/palette`.)

- [ ] **Step 5: Run — expect PASS** (`npx vitest run tests/pipeline/cliffs.test.ts`).
- [ ] **Step 6: Commit**: `git add tools/pipeline/src/cliffs/noise.ts tools/pipeline/src/cliffs/palette.ts tests/pipeline/cliffs.test.ts && git commit -m "cliffs: noise + palette ramps + quantize helpers"`

---

## Task 2: Terrain floor fills

**Files:**
- Create: `tools/pipeline/src/cliffs/terrains.ts`
- Test: extend `tests/pipeline/cliffs.test.ts`
- Reference: `docs/prototypes/cliff-suite-v6.html:247-278` (TERRAINS table + `floorTile`)

**Interfaces:**
- Consumes: `noise.ts` (`fbm`, `noise`, `h2`), `palette.ts` (`TERRAIN_RAMPS`, `TerrainKey`).
- Produces: `floorFill(key: TerrainKey, seed: number): PixelGrid` — a 16×16 palette-locked fill.

- [ ] **Step 1: Write failing test**:
```ts
import { PixelGrid } from "../../tools/pipeline/src/grid";
import { floorFill } from "../../tools/pipeline/src/cliffs/terrains";
it("floorFill returns a 16x16 palette-locked deterministic tile", () => {
  const a = floorFill("sand", 1337), b = floorFill("sand", 1337);
  expect(a.width).toBe(16); expect(a.height).toBe(16);
  expect(a.diff(b)).toBe(0);
  a.forEach((_x,_y,c) => { if (c !== null) expect(PALETTE).toHaveProperty(c); });
  expect(a.countOpaque()).toBe(256); // fully opaque floor
});
it("different terrains differ", () => {
  expect(floorFill("sand",1).diff(floorFill("asphalt",1))).toBeGreaterThan(0);
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `floorFill` by porting `floorTile` (`:256-278`). The prototype already selects a discrete palette index by threshold (`col = P[v<0.36?1:...]`) — keep the exact threshold logic per terrain, but index into the `TERRAIN_RAMPS[key]` ramp names instead of the hex `P[]`. Write each pixel with `grid.px(x,y, ramp[idx])`. Map the prototype's 5-colour `cols` roles onto the 4-step ramps (the plan's ramps have 4 entries; collapse the prototype's `P[3]`/`P[4]` extremes onto the ramp ends — document the mapping in a comment). Sand/frostSand use the `fbm`/speckle branch; asphalt can reuse the generic branch (dark, low-variation).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**: `cliffs: palette-locked terrain floor fills`

---

## Task 3: 47-blob masks + geometry

**Files:**
- Create: `tools/pipeline/src/cliffs/blob47.ts` (masks + `overlayMask` only this task)
- Test: extend `tests/pipeline/cliffs.test.ts`
- Reference: `docs/prototypes/cliff-suite-v6.html:639-684` (`canonical`, the BLOB IIFE, `overlayMask`)

**Interfaces:**
- Produces: `canonical(m: number): number`; `CANONICAL_MASKS: number[]` (length **47**, stable order); `BLOB_INDEX: Map<number,number>`; `overlayMask(mask, inset, irreg, round, seed): Uint8Array` (16×16, 1 = over-terrain).
- **Mask convention (document at top of file):** N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128; set bit = same terrain that side. Self-contained; unrelated to the pipeline's 4-bit `roundedMask`.

- [ ] **Step 1: Write failing test**:
```ts
import { canonical, CANONICAL_MASKS, overlayMask } from "../../tools/pipeline/src/cliffs/blob47.ts";
it("canonical reduction yields exactly 47 masks", () => {
  expect(CANONICAL_MASKS.length).toBe(47);
  const set = new Set(CANONICAL_MASKS.map(canonical));
  expect(set.size).toBe(47); // already canonical, idempotent
});
it("fully-interior mask is all over-terrain", () => {
  const m = overlayMask(255, 2, 14, 2, 7);
  expect(Array.from(m).every(v => v === 1)).toBe(true);
});
it("island mask (no neighbours) retreats on every edge", () => {
  const m = overlayMask(0, 2, 14, 2, 7);
  // corners are base terrain (0) when inset>0
  expect(m[0]).toBe(0); expect(m[15]).toBe(0);
});
it("overlayMask is deterministic", () => {
  const a = overlayMask(64|16, 2, 14, 2, 7), b = overlayMask(64|16, 2, 14, 2, 7);
  expect(Array.from(a)).toEqual(Array.from(b));
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `canonical`, the canonical-set IIFE, `BLOB_INDEX`, and `overlayMask` ported from `:639-684`. Replace `n1(...)`/`h2(...)` calls with the `noise.ts` imports and thread `seed` through (the prototype closes over a module `seed`; make it an explicit param). Keep the corner-taper and convex-arc / concave-pocket math **exactly** — it is the seam-agreement contract. Verify `CANONICAL_MASKS` is built in the prototype's sort order (`(b===255)-(a===255) || a-b`).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**: `cliffs: 47-blob canonical masks + overlayMask geometry`

---

## Task 4: 47-blob tile rendering

**Files:**
- Modify: `tools/pipeline/src/cliffs/blob47.ts` (add `blobTiles`)
- Test: extend `tests/pipeline/cliffs.test.ts`
- Reference: `docs/prototypes/cliff-suite-v6.html:685-711` (`buildBlobTile`)

**Interfaces:**
- Consumes: `overlayMask`, `CANONICAL_MASKS`, a `base: PixelGrid` and `over: PixelGrid` fill (from `floorFill`).
- Produces: `blobTiles(over: PixelGrid, base: PixelGrid, opts): { mask:number; grid:PixelGrid }[]` (47 entries), where `opts = { inset, irreg, round, outline, shadow, seed }`.

- [ ] **Step 1: Write failing test**:
```ts
import { blobTiles } from "../../tools/pipeline/src/cliffs/blob47.ts";
import { floorFill } from "../../tools/pipeline/src/cliffs/terrains";
it("blobTiles yields 47 palette-locked deterministic tiles", () => {
  const over = floorFill("sand",1), base = floorFill("asphalt",1);
  const opts = { inset:2, irreg:14, round:2, outline:true, shadow:true, seed:7 };
  const a = blobTiles(over, base, opts), b = blobTiles(over, base, opts);
  expect(a.length).toBe(47);
  a.forEach((t,i) => { expect(t.grid.diff(b[i].grid)).toBe(0);
    t.grid.forEach((_x,_y,c)=>{ if(c!==null) expect(PALETTE).toHaveProperty(c); }); });
  const interior = a.find(t => t.mask === 255)!;   // all over-terrain
  expect(interior.grid.diff(over)).toBe(0);
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `blobTiles` porting `buildBlobTile` (`:685-711`). For each mask in `CANONICAL_MASKS`: run `overlayMask`, then per pixel pick `over` vs `base` cell; apply outline (darken edge by `shade(...,+1..2)`) and drop-shadow per the prototype's `on()`/neighbour logic — but **in palette space**: since `over`/`base` pixels are already `PaletteName`s, "darken by 0.72" becomes: look up that name's index in the source fill's ramp and shift +1 step. To do that, pass each fill's ramp alongside its grid (or expose a `nameToRampIndex` from `terrains.ts`). Keep the `on()` neighbour-lookup for outline/shadow exactly.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**: `cliffs: 47-blob palette-locked tile rendering`

---

## Task 5: Rock material wall face

**Files:**
- Create: `tools/pipeline/src/cliffs/materials.ts`
- Test: extend `tests/pipeline/cliffs.test.ts`
- Reference: `docs/prototypes/cliff-suite-v6.html:281-322` (`ROCK` colours, `faceTile` rock branch; the shared `partition`/`jitter`/`toneK`/`cube` helpers)

**Interfaces:**
- Produces: `type MaterialKey = "rock"`; `wallFace(material: MaterialKey, params: WallParams, seed: number): PixelGrid` where `WallParams = { courses, blockSize, blocksPerCourse, stagger, tone, mortar, orderVsRandom }`.

- [ ] **Step 1: Write failing test**:
```ts
import { wallFace } from "../../tools/pipeline/src/cliffs/materials";
const WP = { courses:3, blockSize:4, blocksPerCourse:4, stagger:0.5, tone:0.2, mortar:0.35, orderVsRandom:0.45 };
it("wallFace rock is 16x16, palette-locked, deterministic, opaque", () => {
  const a = wallFace("rock", WP, 7), b = wallFace("rock", WP, 7);
  expect(a.width).toBe(16); expect(a.diff(b)).toBe(0);
  a.forEach((_x,_y,c)=>{ if(c!==null) expect(PALETTE).toHaveProperty(c); });
  expect(a.countOpaque()).toBe(256);
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `wallFace` porting the rock branch of `faceTile` (`:286-322`): fill with the gap ramp step (mortar), then draw the stacked-stone `cube()` polygons per course/`partition`. Polygons in the prototype use canvas `fill+stroke`; reimplement as `PixelGrid.rect`/`px` spans (the cubes are small trapezoids — a per-scanline fill is fine and keeps it pixel-exact). Map `ROCK.top/right/left/gap` → `ROCK` ramp steps (top≈idx1, right≈idx3, left≈idx5, gap≈idx6), and `toneK` (`±tone`) → `shade(ROCK, base, ±1)`. Use `mulberry32(seed)` or the ported `h2` for the jitter (match the prototype's `h2`-based jitter for fidelity).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**: `cliffs: rock wall-face material`

---

## Task 6: Cliff set (15 tiles)

**Files:**
- Create: `tools/pipeline/src/cliffs/cliffFace.ts`
- Test: extend `tests/pipeline/cliffs.test.ts`
- Reference: `docs/prototypes/cliff-suite-v6.html:361-418` (`buildCliffTile`), `:284` (`wallTop`)

**Interfaces:**
- Consumes: `wallFace` (the face texture), `floorFill` (plateau top + ground), `palette.ts` (`ROCK`, `shade`).
- Produces: `cliffTiles(p: CliffParams): PixelGrid[]` — **15** grids in fixed order: for `variant` in `[outerW, mid, outerE, innerW, innerE]` (0..4), for `band` in `[rim, face, footer]` (0..2), matching the prototype's `variant`×`band` numbering. `CliffParams = { face: PixelGrid, top: PixelGrid, gnd: PixelGrid, cap, foot, cliffHeight, baseRounding, topRounding, outerShade, innerDepth, castShadow, scree, litLip, capMaterial, capRoll }`.

- [ ] **Step 1: Write failing test**:
```ts
import { cliffTiles } from "../../tools/pipeline/src/cliffs/cliffFace.ts";
import { wallFace } from "../../tools/pipeline/src/cliffs/materials";
import { floorFill } from "../../tools/pipeline/src/cliffs/terrains";
const mk = (over=0) => cliffTiles({
  face: wallFace("rock",{courses:3,blockSize:4,blocksPerCourse:4,stagger:.5,tone:.2,mortar:.35,orderVsRandom:.45},7),
  top: floorFill("sand",1), gnd: floorFill("sand",2),
  cap:4, foot:6, cliffHeight:2, baseRounding:3, topRounding:over, outerShade:.4,
  innerDepth:.6, castShadow:.5, scree:true, litLip:true, capMaterial:"plateau", capRoll:.45,
});
it("cliffTiles returns 15 palette-locked deterministic tiles", () => {
  const a = mk(), b = mk();
  expect(a.length).toBe(15);
  a.forEach((g,i)=>{ expect(g.diff(b[i])).toBe(0);
    g.forEach((_x,_y,c)=>{ if(c!==null) expect(PALETTE).toHaveProperty(c); }); });
});
it("topRounding=0 (hard corners) differs from rounded", () => {
  // rim tile of an outer-W variant: index 0 (variant0,band0)
  expect(mk(0)[0].diff(mk(3)[0])).toBeGreaterThan(0);
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `cliffTiles` porting `buildCliffTile` (`:361-418`) once per (variant, band). The prototype samples `get(A.face/top/gnd, x, y)` (RGB) — here sample the corresponding **`PixelGrid` cell name** and resolve its **ROCK/terrain ramp index** so the shading ops work in index space:
  - `scale(base, 1 - d*roll)` (cap roll-off) → `shade(ramp, idx, +round(d*roll*SHADE_SENSITIVITY))`.
  - `scale(base, 1.22)` (lit lip) → `shade(ramp, idx, -1)`.
  - contact `scale(face,0.45)`, cast shadow `scale(gnd, 1-ss*…)`, corner `cshade`/`ishade` → all index shifts via `SHADE_SENSITIVITY`.
  - `mixc(plate, wt, 0.5)` (cap "blend") → `round(mix(idxPlate, idxWallTop, 0.5))` on a shared ramp (or pick nearest).
  Keep the `bround`/`tround` quarter-circle corner-lift math exactly (it's geometry, not colour); `tround===0` yields hard corners (the test above). Tune `SHADE_SENSITIVITY` (~4) so the face reads as a lit top / mid-right / dark-left wall; this is the one value to eyeball in Task 9 and adjust.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**: `cliffs: directional cliff set (rim/face/footer x 5 corner variants)`

---

## Task 7: generateTerrain + desert presets

**Files:**
- Create: `tools/pipeline/src/cliffs/generate.ts`, `tools/pipeline/src/cliffs/presets.ts`
- Test: extend `tests/pipeline/cliffs.test.ts`
- Reference: `docs/prototypes/cliff-suite-v6.html:719-743` (`buildAll` — the param wiring)

**Interfaces:**
- Produces: `TerrainParams` (the full params object from the spec's Architecture §"core abstraction"); `generateTerrain(p: TerrainParams): { name: string; grid: PixelGrid }[]`; `DESERT_PRESETS: TerrainParams[]`.
- `generateTerrain` emits, per preset, named tiles: `cliffRock_{variant}_{band}` (15), `{plateauKey}Plateau_{mask}` (47), and for each `(over,base)` pairing `{over}{Base}_{mask}` (47 each), plus fills `{key}Fill`.

- [ ] **Step 1: Write failing test**:
```ts
import { generateTerrain, DESERT_PRESETS } from "../../tools/pipeline/src/cliffs/generate.ts";
it("desert preset generates the full named set, palette-locked, unique names", () => {
  const out = generateTerrain(DESERT_PRESETS[0]);
  const names = out.map(o=>o.name);
  expect(new Set(names).size).toBe(names.length);              // unique
  expect(names.filter(n=>n.startsWith("cliffRock_")).length).toBe(15);
  expect(names.filter(n=>/Plateau_/.test(n)).length).toBe(47);
  out.forEach(o=>o.grid.forEach((_x,_y,c)=>{ if(c!==null) expect(PALETTE).toHaveProperty(c); }));
});
it("generateTerrain is deterministic", () => {
  const a=generateTerrain(DESERT_PRESETS[0]), b=generateTerrain(DESERT_PRESETS[0]);
  a.forEach((o,i)=>expect(o.grid.diff(b[i].grid)).toBe(0));
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `TerrainParams` + `generateTerrain` (builds `top`/`gnd`/other fills via `floorFill`, the face via `wallFace`, then `cliffTiles` + `blobTiles` per pairing + plateau-edge set with `linkPlateauCorners`), and `presets.ts` with the desert preset(s): `material:"rock"`, `plateauTop:"sand"`, `ground:"sand"`, pairings `[{over:"sand",base:"sand"},{over:"sand",base:"asphalt"},{over:"sand",base:"frostSand"}]`, plus the cliff/blob params matching the prototype defaults. Name tiles per the interface. (Fill names use a `Fill` suffix to avoid colliding with the existing `sand`/`frostSand` tile names in `tiles.png`.)
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**: `cliffs: generateTerrain + desert presets`

---

## Task 8: Sheet assembly + pipeline wiring

**Files:**
- Create: `tools/pipeline/src/cliffs/frames.ts`
- Modify: `tools/pipeline/src/assets.ts` (import, `BuiltAssets.cliff`, `SHEET_KEYS`, `buildAssets`), `tools/pipeline/src/manifest.ts` (`Manifest.cliff`, `buildManifest`), `tools/pipeline/src/index.ts` (`sheets` array)
- Test: extend `tests/pipeline/cliffs.test.ts`
- Reference: `owMountains` wiring — `assets.ts:41,99,148,...`, `manifest.ts:273-278`, `index.ts` sheets array.

**Interfaces:**
- Produces: `cliffSheetFrames(): PixelGrid[]` (all presets concatenated in a fixed order), `cliffTileNames(): string[]` (same order). Frame count must be divisible by the chosen `columns` (pick `columns` = a divisor of the total; pad with a documented blank/`sandFill` frame only if unavoidable — prefer choosing columns to divide exactly).

- [ ] **Step 1: Write failing test**:
```ts
import { buildAssets, SHEET_KEYS } from "../../tools/pipeline/src/assets";
import { buildManifest } from "../../tools/pipeline/src/manifest";
import { cliffTileNames, cliffSheetFrames } from "../../tools/pipeline/src/cliffs/frames.ts";
it("cliff wired into assets + manifest, names align to frames", () => {
  expect(SHEET_KEYS).toContain("cliff");
  const a = buildAssets();
  expect(a.cliff).toBeDefined();
  const names = cliffTileNames(), frames = cliffSheetFrames();
  expect(names.length).toBe(frames.length);
  const m = buildManifest();
  expect(Object.keys(m.cliff.names).length).toBe(names.length);
  // every name maps to a valid frame index
  for (const n of names) expect(m.cliff.names[n]).toBeGreaterThanOrEqual(0);
});
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `frames.ts` (concatenate `generateTerrain(p)` over `DESERT_PRESETS`, dedupe shared fills, return grids + parallel names). Wire `assets.ts` (`import { cliffSheetFrames } from "./cliffs/frames"`; add `cliff: PixelGrid` to `BuiltAssets`; append `"cliff"` to `SHEET_KEYS` with an "appended only, never reordered" comment; `cliff: composeSheet(cliffSheetFrames(), COLUMNS)` in `buildAssets`). Wire `manifest.ts` (`import { cliffTileNames }`; add `cliff: TileSetDef` to `Manifest`; `cliff: { file:"cliff.png", tileSize: TILE_SIZE, columns: COLUMNS, names: tileNames(cliffTileNames()) }`). Wire `index.ts` (`["cliff.png", assets.cliff]`).
- [ ] **Step 4: Run** `npx vitest run tests/pipeline/cliffs.test.ts` (PASS) and `npm run art` (writes `src/assets/generated/cliff.png` + manifest). Confirm the PNG exists and `tsc --noEmit` is clean.
- [ ] **Step 5: Commit**: `cliffs: compose cliff.png + wire into assets/manifest/index`

---

## Task 9: Structure tests + visual-review render (STOP for approval)

**Files:**
- Create: `tools/pipeline/render-cliff-review.mts`
- Modify: `tests/pipeline/cliffs.test.ts` (structure asserts), `.gitignore` (review output dir)
- Reference: `docs/prototypes/cliff-suite-v6.html:754-806` (`drawScene`, the assembled scene) + `:132-153` for an opening.

- [ ] **Step 1:** Add structure tests: `cliffTileNames()` has no duplicates; count = 15 + 47 (plateau) + 47*(#pairings) + #fills; every name is a valid tile-name string (no spaces); the 15 cliff names cover all 5 variants × 3 bands.
- [ ] **Step 2:** Write `render-cliff-review.mts` — builds `assets.cliff`, upscales `cliff.png` ×6 to `tools/pipeline/.review/cliff-sheet.png`, AND renders an **assembled demo scene** (port `drawScene` `:754-806`): a small map with a `sand` field, a raised plateau using the cliff set with a **1-tile opening** in its south wall (framed by the inner-W/inner-E variants), and a sand-over-sand ledge — to `.review/cliff-scene.png`. Add `tools/pipeline/.review/` to `.gitignore`.
- [ ] **Step 3:** Run `npx tsx tools/pipeline/render-cliff-review.mts`; confirm both PNGs render.
- [ ] **Step 4: Commit** (code only; PNGs are gitignored): `cliffs: structure tests + visual-review render script`
- [ ] **Step 5: STOP.** Surface `cliff-sheet.png` and `cliff-scene.png` to the human for eyeball (cliff reads as a vertical lit-top/dark-left wall; cap rolls; footer shadow; opening framed cleanly; sand ledges read as low elevation). Adjust `SHADE_SENSITIVITY` / ramp assignments / params until approved. **Do not proceed to Task 10 until the look is approved** — the sha256 pin locks whatever is on screen.

---

## Task 10: Pin the sheet (after visual approval)

**Files:**
- Modify: `tests/pipeline/determinism.test.ts`
- Reference: the `owMountains` byte-stability block (`determinism.test.ts:73-92` pattern).

- [ ] **Step 1:** Compute the hash: run a one-off `node -e`/`tsx` that prints `createHash("sha256").update(encodePng(buildAssets().cliff)).digest("hex")` (or read it from a temporary failing pin).
- [ ] **Step 2:** Add a new block:
```ts
describe("cliff tileset byte-stability", () => {
  // sha256 of the desert cliff+floor+cap sheet (docs/.../desert-cliff-tileset).
  const FROZEN = { cliff: "<hash from step 1>" } as const;
  it("cliff.png is byte-stable", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});
```
- [ ] **Step 3:** Run the full pipeline gate: `npx vitest run tests/pipeline/` (determinism + cliffs pass), `npm run art` (byte-stable), `tsc --noEmit`, `npm run build`.
- [ ] **Step 4: Commit**: `cliffs: pin cliff.png sha256`
- [ ] **Step 5:** Open the PR into `main` (regular merge commit, per CLAUDE.md).

---

## Self-Review

**Spec coverage:** parametric generator (Task 7) · rock material as pluggable seam (Task 5) · 47-blob diagonal-aware, self-contained (Tasks 3–4) · cliff set with vertical shading + rounded/hard corners (Task 6) · sand-over-sand + sand↔asphalt + sand↔frostSand + plateau-edge (Task 7) · palette-locked, no new colours (Task 1 ramps) · deterministic + sha256-pinned (Tasks 1,10) · manifest/wiring like owMountains (Task 8) · visual review before pin (Task 9) · build-time only, names anticipate solidity, no `src/` changes (Global Constraints). All spec sections map to a task.

**Placeholder scan:** the only deferred value is the `FROZEN` sha256 (Task 10 step 1 computes it) and `COLUMNS`/`SHADE_SENSITIVITY` (chosen/tuned in Tasks 8/6 with stated defaults) — these are compute-and-fill, not vague requirements. Every render task cites exact prototype line ranges and states the RGB→ramp adaptation.

**Type consistency:** `PaletteName`, `PixelGrid`, `Ramp`, `TerrainKey`, `MaterialKey`, `WallParams`, `CliffParams`, `TerrainParams`, `generateTerrain`, `cliffTiles`, `blobTiles`, `wallFace`, `floorFill`, `cliffSheetFrames`/`cliffTileNames` are used consistently across tasks. `CANONICAL_MASKS`/`BLOB_INDEX` naming is stable between Tasks 3–4.

**Known risk:** the palette-quantization (Quantization Strategy) is the one place fidelity can drift from the prototype — Task 9's visual review is the explicit gate before the hash is locked, and `SHADE_SENSITIVITY` is the single tuning knob called out for it.
