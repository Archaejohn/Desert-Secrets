# Biome Cliff/Plateau Terrain Sets — M0 + M1 (Ice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the desert cliff generator so any biome can be re-skinned through it (M0, desert output byte-identical), then build the **ice** biome end-to-end — baked `cliffIce.png`, sha-pinned, with a review scene — proving both the plumbing and the tier-3 bespoke-face path (M1).

**Architecture:** The cliff pipeline (`tools/pipeline/src/cliffs/`) is already parametric on `material` + terrain `pairings`. M0 pushes the last hardcoded colors out: the wall face becomes ramp-parametric (`blockWallFace(ramp, …)`), and the diagonal-flight *slope* material takes a ground ramp (defaulting to `sand`, so desert is unchanged). M1 adds the ice ramp/terrain/preset, bakes a dedicated per-biome sheet, and swaps a placeholder recolor face for a bespoke crystalline face (Fable-authored) before pinning.

**Tech Stack:** TypeScript, pure procedural pixel-art generators (`PixelGrid`, `h2`/`fbm` hashing — no `Math.random`), Vitest, node PNG encoder. Sheets baked to `src/assets/generated/*.png` + `manifest.json`, sha256-pinned.

## Global Constraints

- **Palette-locked:** every pixel color MUST be a `PaletteName` from `src/shared/palette.ts`. No raw hex, no new colors.
- **Deterministic:** no `Math.random`/`Date`; only seeded `h2`/`fbm`. Same input → same bytes.
- **Additive-only sheets:** never reorder existing frame indices; extending a sheet requires deliberately re-pinning its sha. Desert `cliff.png` sha in `tests/pipeline/determinism.test.ts` MUST NOT change during M0.
- **Per-biome sheets:** each biome bakes its own `cliff<Biome>.png`; desert `cliff.png` stays byte-identical.
- **No runtime wiring in this plan:** do NOT touch `BootScene`/`ZoneScene`/maps. Baked + pinned + unplaced is the target state (Spec B handles placement).
- **Tile prefix:** `generate.ts` names cliff tiles `cliff${capitalize(material)}_…` (capitalize uppercases only the first char). Ice material `"glacier"` → `cliffGlacier_…`.
- **Ramp shape:** a wall `Ramp` is an 8-slot light→dark `PaletteName[]`; role indices are idx1=block top, idx3=right plane, idx5=left plane, idx6=gap/mortar (idx0 = lit lip). Ground ramps are 4-slot `[light, mid, shade, dark]`.
- **Verification bar (every task that changes generated output):** `npx tsc --noEmit`, `npx vitest run`, and where noted the review render. Commit after each green task.

All commands run from the repo root: `C:/Users/cpjel/Desktop/Desert_Secrets/Desert-Secrets`.

---

## M0 — Generalization refactor (desert output byte-identical)

### Task 1: Make the wall face ramp-parametric (`blockWallFace`)

**Files:**
- Modify: `tools/pipeline/src/cliffs/materials.ts` (rename `rockWallFace` → `blockWallFace`, add `ramp` param; route `wallFace("rock")` through it)
- Test: `tests/pipeline/determinism.test.ts` (existing desert pin is the acceptance gate — no edit), `tests/pipeline/cliffs.test.ts` (existing)

**Interfaces:**
- Consumes: `ROCK`, `shade`, `Ramp` from `./palette`; `WallParams` (unchanged).
- Produces: `export function blockWallFace(ramp: Ramp, params: WallParams, seed: number): PixelGrid`. `wallFace(material, params, seed)` signature unchanged.

- [ ] **Step 1: Run the desert determinism test first (baseline green)**

Run: `npx vitest run tests/pipeline/determinism.test.ts -t "cliff tileset byte-stability"`
Expected: PASS (desert `cliff.png` matches its frozen sha). This is the invariant the refactor must preserve.

- [ ] **Step 2: Refactor `rockWallFace` → `blockWallFace(ramp, …)`**

In `materials.ts`, change the function to take the ramp as its first parameter and use it everywhere the module-level `ROCK` was read. The role-index constants stay (they index into whatever ramp is passed):

```ts
// was: function rockWallFace(params: WallParams, seed: number): PixelGrid {
export function blockWallFace(ramp: Ramp, params: WallParams, seed: number): PixelGrid {
  const grid = new PixelGrid(T, T);
  const { courses: C, blockSize: bsize, blocksPerCourse: per, stagger: stag, tone, mortar } = params;
  const chaos = params.orderVsRandom;
  const rowH = T / C;

  grid.rect(0, 0, T, T, shade(ramp, ROCK_GAP, Math.round(mortar * 2)));
  // ...unchanged body, but every `ROCK` reference below becomes `ramp`:
  //   shade(ramp, ROCK_TOP, shift), shade(ramp, ROCK_RIGHT, shift), shade(ramp, ROCK_LEFT, shift)
```

Add the `Ramp` type to the existing palette import:
```ts
import { ROCK, shade, type Ramp } from "./palette";
```

Route the switch through it:
```ts
export function wallFace(material: MaterialKey, params: WallParams, seed: number): PixelGrid {
  switch (material) {
    case "rock":
      return blockWallFace(ROCK, params, seed);
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no other file referenced `rockWallFace` — it was module-private).

- [ ] **Step 4: Run the determinism + cliffs tests (desert unchanged)**

Run: `npx vitest run tests/pipeline/determinism.test.ts tests/pipeline/cliffs.test.ts`
Expected: PASS. The cliff sha is unchanged → the refactor is byte-safe. If it FAILS, `blockWallFace(ROCK, …)` diverged from the original; diff the two until bytes match.

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/cliffs/materials.ts
git commit -m "refactor(cliffs): make wall face ramp-parametric (blockWallFace)"
```

---

### Task 2: Thread the ground ramp through the diagonal *slope* material

**Files:**
- Modify: `tools/pipeline/src/cliffs/diagonalRamps.ts` (add optional `groundRamp` param, default sand; replace sand literals in `sandSurface` + sand ground-contact with ramp lookups)
- Modify: `tools/pipeline/src/cliffs/generate.ts` (pass the plateau ramp when emitting diagonal flights)
- Test: `tests/pipeline/determinism.test.ts` + `tests/pipeline/cliffs.test.ts` (existing; desert must stay green)

**Interfaces:**
- Consumes: `TERRAIN_RAMPS`, `Ramp` from `./palette`.
- Produces: `diagonalFlightTiles(material, dir, p, angle?, groundRamp?: Ramp)` — new optional trailing param, defaulting to `TERRAIN_RAMPS.sand`. Stone-steps path and rock body are unchanged (shared across biomes).

- [ ] **Step 1: Add the ramp param + import**

In `diagonalRamps.ts`, import the ramp source and extend the signature (default preserves current behavior):

```ts
import { TERRAIN_RAMPS, type Ramp } from "./palette";

export function diagonalFlightTiles(
  material: DiagonalMaterial,
  dir: DiagonalDir,
  p: DiagonalRampParams,
  angle: DiagonalAngle = "45",
  groundRamp: Ramp = TERRAIN_RAMPS.sand
): { piece: DiagonalPiece; grid: PixelGrid }[] {
```

Thread `groundRamp` down to wherever `sandSurface(...)` and the sand ground-contact line are called (the per-cell helpers `runCell`/`footCell`/`runTopCell`/`capTopCell`). Add it as a parameter on each rather than closing over a literal.

- [ ] **Step 2: Replace the sand literals with ramp lookups**

The `sand` terrain ramp is `["sandLight", "sand", "sandShade", "umber"]`, so the current literals map exactly: `sandLight → ramp[0]`, `sand → ramp[1]`, `sandShade → ramp[2]`, `umber → ramp[3]`. In `sandSurface(...)`:

```ts
// was: if (rel < 1 && !noUphillOutline) return "umber";
if (rel < 1 && !noUphillOutline) return groundRamp[3];
// f < 0.28 band:
return hh(...) < 0.1 ? groundRamp[3] : groundRamp[2];   // umber : sandShade
// f < 0.7 band:
return hh(...) < 0.06 ? groundRamp[0] : groundRamp[1];  // sandLight : sand
// tail:
return groundRamp[0];                                    // sandLight
```

Also replace the `"sandShade"` ground-contact literal in `footCell` (the sand foot line) with `groundRamp[2]`. Leave the `stoneSurface`, `stepBandPixel`, `"stoneDeep"` stone-contact, and the `wallFace("rock", …)` rock body untouched — stone steps and the rock body stay shared.

- [ ] **Step 3: Pass the plateau ramp from `generate.ts`**

In `generate.ts`, the diagonal emission (both the 45° block and the extra-angles block) currently calls `diagonalFlightTiles(m, dir, { seed: p.seed })` / `(…, angle)`. Pass the preset's plateau ramp so biomes re-skin the slope; desert (`plateauTop: "sand"`) passes the sand ramp = the default = identical bytes:

```ts
import { TERRAIN_RAMPS } from "./palette";
// ...
const groundRamp = TERRAIN_RAMPS[p.plateauTop];
// 45° block:
const tiles = diagonalFlightTiles(m, dir, { seed: p.seed }, "45", groundRamp);
// extra-angles block:
const tiles = diagonalFlightTiles(m, dir, { seed: p.seed }, angle, groundRamp);
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Run determinism + cliffs (desert byte-identical)**

Run: `npx vitest run tests/pipeline/determinism.test.ts tests/pipeline/cliffs.test.ts`
Expected: PASS — the sand ramp default reproduces every former literal, so the desert `cliff.png` sha is unchanged. If it FAILS, an index is mismatched (e.g. `sandShade` mapped to the wrong slot).

- [ ] **Step 6: Commit**

```bash
git add tools/pipeline/src/cliffs/diagonalRamps.ts tools/pipeline/src/cliffs/generate.ts
git commit -m "refactor(cliffs): thread ground ramp through diagonal slope material"
```

---

## M1 — Ice biome (end-to-end)

### Task 3: Ice ramps + ground terrain

**Files:**
- Modify: `tools/pipeline/src/cliffs/palette.ts` (add `ICE` wall ramp; extend `TerrainKey` + `TERRAIN_RAMPS` with `ice`)
- Modify: `tools/pipeline/src/cliffs/terrains.ts` (add an `ice` recipe branch in `floorFill`)
- Test: `tests/pipeline/cliffs.test.ts` (add ice floor-fill test)

**Interfaces:**
- Produces: `export const ICE: Ramp`; `TerrainKey` gains `"ice"`; `TERRAIN_RAMPS.ice`. `floorFill("ice", seed)` returns a 16×16 grid using only `TERRAIN_RAMPS.ice` colors.

- [ ] **Step 1: Write the failing test**

In `tests/pipeline/cliffs.test.ts`:

```ts
import { floorFill } from "../../tools/pipeline/src/cliffs/terrains";
import { TERRAIN_RAMPS } from "../../tools/pipeline/src/cliffs/palette";

it("ice floorFill is palette-locked to the ice ground ramp and deterministic", () => {
  const a = floorFill("ice", 1337);
  const b = floorFill("ice", 1337);
  const allowed = new Set(TERRAIN_RAMPS.ice);
  expect(a.width).toBe(16);
  expect(a.height).toBe(16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      expect(allowed.has(a.get(x, y)!)).toBe(true);
      expect(a.get(x, y)).toBe(b.get(x, y)); // deterministic
    }
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/pipeline/cliffs.test.ts -t "ice floorFill"`
Expected: FAIL — `"ice"` is not a `TerrainKey` (type error / undefined ramp).

- [ ] **Step 3: Add the ice ramps in `palette.ts`**

```ts
/** Glacial ice cliff ramp: white lit facets → deep indigo shadow. */
export const ICE: Ramp = ["white", "skyBlue", "slate", "slate", "indigo", "indigo", "indigo", "ink"];

export type TerrainKey = "sand" | "frostSand" | "asphalt" | "ice";

export const TERRAIN_RAMPS: Record<TerrainKey, Ramp> = {
  sand: ["sandLight", "sand", "sandShade", "umber"],
  frostSand: ["bone", "sandLight", "skyBlue", "sandShade"],
  asphalt: ["slate", "indigo", "plum", "ink"],
  ice: ["white", "skyBlue", "slate", "indigo"],
};
```

- [ ] **Step 4: Add the ice recipe branch in `terrains.ts` `floorFill`**

Insert an explicit `ice` branch before the asphalt default (so ice gets a glinting-frost recipe instead of the asphalt speckle). Ground ramp is `[white, skyBlue, slate, indigo]`:

```ts
} else if (key === "ice") {
  idx = 1;                                      // skyBlue body
  if (h2(x, y, seed + 31) > 0.94) idx = 0;      // white glint
  else if (h2(x, y, seed + 53) > 0.95) idx = 2; // slate hairline crack
} else {
  // asphalt — generic/default branch (unchanged)
```

- [ ] **Step 5: Run the test + type-check**

Run: `npx tsc --noEmit && npx vitest run tests/pipeline/cliffs.test.ts -t "ice floorFill"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/pipeline/src/cliffs/palette.ts tools/pipeline/src/cliffs/terrains.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): add ice ramps and ice ground floorFill"
```

---

### Task 4: Ice cliff preset + placeholder `glacier` face

**Files:**
- Modify: `tools/pipeline/src/cliffs/materials.ts` (`MaterialKey` gains `"glacier"`; `wallFace` case routes to `blockWallFace(ICE, …)` — a tier-2 placeholder until Task 8's bespoke face)
- Modify: `tools/pipeline/src/cliffs/presets.ts` (`ICE_CLIFF` preset + `ICE_PRESETS` export)
- Test: `tests/pipeline/cliffs.test.ts` (ice preset name/count asserts)

**Interfaces:**
- Consumes: `blockWallFace`, `ICE`.
- Produces: `MaterialKey` includes `"glacier"`; `export const ICE_PRESETS: TerrainParams[]`. Generated tile prefixes: `cliffGlacier_*`, `icePlateau_*`, `iceIce_*`, `iceFill`, `rampSand_*`/`rampSteps_*`, `drampSand*`/`drampSteps*`.

- [ ] **Step 1: Add the `glacier` material (placeholder face)**

In `materials.ts`:
```ts
import { ROCK, ICE, shade, type Ramp } from "./palette";

export type MaterialKey = "rock" | "glacier";

export function wallFace(material: MaterialKey, params: WallParams, seed: number): PixelGrid {
  switch (material) {
    case "rock":
      return blockWallFace(ROCK, params, seed);
    case "glacier":
      return blockWallFace(ICE, params, seed); // placeholder recolor — bespoke face lands in Task 8
  }
}
```

- [ ] **Step 2: Add the `ICE_CLIFF` preset**

In `presets.ts`, mirror `DESERT_ROCK_CLIFF` with ice material/terrain and tier-2 wall params (bigger, lower-mortar blocks read as glacial masonry). Pairing is ice-over-ice:

```ts
const ICE_CLIFF: TerrainParams = {
  material: "glacier",
  // tier-2 structure: larger low-mortar blocks
  courses: 3, blockSize: 4, blocksPerCourse: 2, stagger: 0.5,
  tone: 0.12, mortar: 0.15, orderVsRandom: 0.3,
  // cliff assembly — desert defaults
  capBand: 4, capRoll: 0.45, capMaterial: "plateau", footer: 6,
  cliffHeight: 2, baseRounding: 3, topRounding: 3,
  outerCornerShade: 0.4, innerCornerDepth: 0.6, castShadow: 0.5,
  scree: true, litLip: true,
  // floor blob edges — desert defaults
  edgeInset: 2, edgeIrregularity: 14, cornerRounding: 2,
  edgeOutline: true, dropShadow: true, linkPlateauCorners: true,
  pairings: [{ over: "ice", base: "ice" }],
  plateauTop: "ice", ground: "ice",
  seed: 2026,
  ramps: ["sandSlope", "stoneSteps"],
  diagonalRamps: true,
};

export const ICE_PRESETS: TerrainParams[] = [ICE_CLIFF];
```

- [ ] **Step 3: Write the ice preset name/count test**

In `tests/pipeline/cliffs.test.ts`:
```ts
import { ICE_PRESETS } from "../../tools/pipeline/src/cliffs/presets";

it("ice preset emits its full parity set, uniquely named", () => {
  const out = generateTerrain(ICE_PRESETS[0]).map((o) => o.name);
  expect(out.filter((n) => n.startsWith("cliffGlacier_")).length).toBe(15);
  expect(out.filter((n) => n.startsWith("icePlateau_")).length).toBe(47);
  expect(out.filter((n) => n.startsWith("iceIce_")).length).toBe(47);
  expect(out.filter((n) => n === "iceFill").length).toBe(1);
  expect(out.filter((n) => n.startsWith("drampSand2657_")).length).toBe(28);
  expect(new Set(out).size).toBe(out.length); // all unique
  // total is preset-dependent (1 pairing): run once, then pin the number you get.
  expect(out.length).toBe(274);
});
```

- [ ] **Step 4: Run + confirm the total**

Run: `npx tsc --noEmit && npx vitest run tests/pipeline/cliffs.test.ts -t "ice preset"`
Expected: PASS. If the total assertion fails, read the actual `out.length` from the failure message and set `expect(out.length).toBe(<actual>)` — the count is determined by pairing choice, not guessed.

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/cliffs/materials.ts tools/pipeline/src/cliffs/presets.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): add ice cliff preset with placeholder glacier face"
```

---

### Task 5: Bake `cliffIce.png` (frames + assets + manifest)

**Files:**
- Modify: `tools/pipeline/src/cliffs/frames.ts` (generalize to `(presets)` builders; add `cliffIceSheetFrames`/`cliffIceTileNames`)
- Modify: `tools/pipeline/src/assets.ts` (add `cliffIce` sheet key + composition)
- Modify: `tools/pipeline/src/manifest.ts` (register `cliffIce` name→index)
- Test: `tests/pipeline/cliffs.test.ts` (cliffIce dims/manifest)

**Interfaces:**
- Consumes: `ICE_PRESETS`, `generateTerrain`.
- Produces: `cliffIceSheetFrames(): PixelGrid[]`, `cliffIceTileNames(): string[]`; `buildAssets().cliffIce`; `manifest.cliffIce`.

- [ ] **Step 1: Generalize `frames.ts`**

Extract the preset-walking core into helpers parametrized by a preset list, keep the desert exports calling with `DESERT_PRESETS`, and add ice exports calling with `ICE_PRESETS`:

```ts
import { ICE_PRESETS } from "./presets";

function realEntriesFor(presets: TerrainParams[]): { name: string; grid: PixelGrid }[] {
  const seen = new Set<string>();
  const out: { name: string; grid: PixelGrid }[] = [];
  for (const preset of presets)
    for (const entry of generateTerrain(preset)) {
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      out.push(entry);
    }
  return out;
}
function sheetFramesFor(presets: TerrainParams[]): PixelGrid[] {
  const frames = realEntriesFor(presets).map((e) => e.grid);
  const pad = (COLUMNS - (frames.length % COLUMNS)) % COLUMNS;
  for (let i = 0; i < pad; i++) frames.push(new PixelGrid(16, 16));
  return frames;
}

export const cliffTileNames = (): string[] => realEntriesFor(DESERT_PRESETS).map((e) => e.name);
export const cliffSheetFrames = (): PixelGrid[] => sheetFramesFor(DESERT_PRESETS);
export const cliffIceTileNames = (): string[] => realEntriesFor(ICE_PRESETS).map((e) => e.name);
export const cliffIceSheetFrames = (): PixelGrid[] => sheetFramesFor(ICE_PRESETS);
```

Import `TerrainParams` type: `import type { TerrainParams } from "./generate";`.

- [ ] **Step 2: Add the sheet in `assets.ts`**

Add `cliffIce` to `SHEET_KEYS` (append — never reorder), import the builder, and add the composition line beside `cliff`:

```ts
import { cliffSheetFrames, cliffIceSheetFrames } from "./cliffs/frames";
// ...in buildAssets() return object:
    cliff: composeSheet(cliffSheetFrames(), 8),
    cliffIce: composeSheet(cliffIceSheetFrames(), 8),
```

- [ ] **Step 3: Register in `manifest.ts`**

Import `cliffIceTileNames` and add a sibling entry beside `cliff`:

```ts
    cliff: { file: "cliff.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(cliffTileNames()) },
    cliffIce: { file: "cliffIce.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(cliffIceTileNames()) },
```

- [ ] **Step 4: Write the cliffIce structure test**

In `tests/pipeline/cliffs.test.ts`:
```ts
import { cliffIceTileNames, cliffIceSheetFrames } from "../../tools/pipeline/src/cliffs/frames";

it("cliffIce sheet is 16px frames padded to 8 columns, manifest-consistent", () => {
  const names = cliffIceTileNames();
  const frames = cliffIceSheetFrames();
  expect(names.length).toBe(274);
  expect(frames.length % 8).toBe(0);
  frames.forEach((f) => { expect(f.width).toBe(16); expect(f.height).toBe(16); });
  const a = buildAssets();
  expect(a.cliffIce.width).toBe(8 * 16);
  expect(Object.keys(a.manifest.cliffIce.names).length).toBe(names.length);
});
```
(Set `274` to the total confirmed in Task 4 Step 4.)

- [ ] **Step 5: Type-check + test**

Run: `npx tsc --noEmit && npx vitest run tests/pipeline/cliffs.test.ts -t "cliffIce sheet"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/pipeline/src/cliffs/frames.ts tools/pipeline/src/assets.ts tools/pipeline/src/manifest.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): bake cliffIce.png sheet + manifest"
```

---

### Task 6: Emit the PNG/manifest artifacts + pin the sha

**Files:**
- Modify: `src/assets/generated/cliffIce.png` (new, generated), `src/assets/generated/manifest.json` (regenerated)
- Modify: `tests/pipeline/determinism.test.ts` (add `cliffIce` sha to `FROZEN`)

**Interfaces:**
- Consumes: the asset build/generate npm script that writes `src/assets/generated/`.
- Produces: committed `cliffIce.png` + updated `manifest.json`; pinned `cliffIce` sha.

- [ ] **Step 1: Regenerate the committed assets**

Run the project's asset-writing script (the one that emits `src/assets/generated/*.png` + `manifest.json`; check `package.json` scripts — likely `npm run assets` or `npm run build:assets`):

Run: `npm run assets`
Expected: writes `src/assets/generated/cliffIce.png` and rewrites `manifest.json` with the `cliffIce` block. `cliff.png` MUST be unchanged (git shows only additions).

- [ ] **Step 2: Capture the cliffIce sha and add it to `FROZEN`**

Get the sha the determinism test will compute (encode the composed sheet, sha256). Easiest: run the determinism test once — it will FAIL and print the actual hash for a placeholder entry. First add a placeholder line:
```ts
  const FROZEN = {
    cliff: "a3fc497935e7407176b668ce07070973d243c0b97421941ed29c348860f0efbd",
    cliffIce: "0000000000000000000000000000000000000000000000000000000000000000",
  } as const;
```
Run: `npx vitest run tests/pipeline/determinism.test.ts -t "cliff tileset byte-stability"`
Expected: FAIL on `cliffIce.png changed`, printing the received hash. Copy that hash into `cliffIce`.

- [ ] **Step 3: Re-run — desert unchanged, ice pinned**

Run: `npx vitest run tests/pipeline/determinism.test.ts`
Expected: PASS for both `cliff` (unchanged) and `cliffIce` (newly pinned).

- [ ] **Step 4: Full suite + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS (nothing runtime-wired, so `smoke` is unaffected but should stay green if run).

- [ ] **Step 5: Commit**

```bash
git add src/assets/generated/cliffIce.png src/assets/generated/manifest.json tests/pipeline/determinism.test.ts
git commit -m "chore(cliffs): bake + pin cliffIce.png (placeholder glacier face)"
```

---

### Task 7: Ice review scene (generalize the review renderer)

**Files:**
- Modify: `tools/pipeline/render-cliff-review.mts` (derive tile-name prefixes from the preset; render ice scene + crops)

**Interfaces:**
- Consumes: `ICE_PRESETS`, `generateTerrain`. Produces `.review/ice-scene.png` (+ `ice-diag-crop.png` etc.). Throwaway inspection script — not part of the deterministic build.

- [ ] **Step 1: Parametrize `buildScene` by preset-derived prefixes**

Replace the hardcoded `"sandFill"` / `sandPlateau_` / `sandSand_` / `cliffRock_` strings with values derived from the preset:
```ts
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const groundFill = `${params.ground}Fill`;             // "iceFill"
const plateau = (m: number) => `${params.plateauTop}Plateau_${canonical(m)}`;
const pairSelf = (m: number) => `${params.plateauTop}${cap(params.plateauTop)}_${canonical(m)}`; // "iceIce_.."
const cliff = (v: string, band: string) => `cliff${cap(params.material)}_${v}_${band}`;           // "cliffGlacier_.."
```
Swap these into steps 1–8 of `buildScene`. The diagonal-flight `stampDiagonalFlight*` helpers already take `params.seed`; leave the flight tile lookups (`rampSand_*`, `dramp*`, `cliffRock_*` → `cliff(...)`) driven by these helpers.

- [ ] **Step 2: Loop over the biome presets**

```ts
import { ICE_PRESETS } from "./src/cliffs/presets";
const VARIANTS = [
  { label: "desert", params: DESERT_PRESETS[0] },
  { label: "ice", params: ICE_PRESETS[0] },
];
```
Write each label's scene + crops to `.review/<label>-scene.png` / `.review/<label>-diag-crop.png` (parametrize the existing output paths by `label`).

- [ ] **Step 3: Render**

Run: `npx tsx tools/pipeline/render-cliff-review.mts`
Expected: writes `.review/ice-scene.png`, `.review/desert-scene.png`, and the diagonal crops. No errors (`missing tile:` would mean a prefix is wrong).

- [ ] **Step 4: Surface the ice scene to the owner (review gate)**

Send `.review/ice-scene.png` (and the diagonal crop) to the owner. **Do not proceed to Task 8 until the owner has seen the placeholder ice cliff** — this is the "example scene per type" gate. Note explicitly that the face is the tier-2 placeholder recolor; the bespoke crystalline face is Task 8.

- [ ] **Step 5: Commit the renderer change**

```bash
git add tools/pipeline/render-cliff-review.mts
git commit -m "chore(cliffs): generalize review renderer for per-biome scenes"
```

---

### Task 8: Author the bespoke crystalline `glacier` face (Fable) — creative, review-gated

**Files:**
- Modify: `tools/pipeline/src/cliffs/materials.ts` (add `glacierWallFace(params, seed)`; route `case "glacier"` to it)
- Modify: `tests/pipeline/determinism.test.ts` (re-pin `cliffIce` sha — pixels change, counts do not)
- Modify: `src/assets/generated/cliffIce.png` + `manifest.json` (regenerate)

**Interfaces:**
- Produces: `function glacierWallFace(params: WallParams, seed: number): PixelGrid` — palette-locked to the ICE family (`white, skyBlue, slate, indigo, ink`), deterministic (`h2`/`fbm` only), same 16×16 opaque contract as `blockWallFace`, and reading as **crystalline/faceted glacial ice** rather than stacked stone. Its silhouette must fill the tile edge-to-edge (like `blockWallFace`) so the cliff rim/face/footer and diagonal-flight bodies composit seamlessly.

This is genuine pixel-art design, not mechanical code — dispatch **Fable** (project convention for hard visual reworks) and iterate against the review scene. It is **not** a fake-TDD task; its gates are the palette/determinism tests plus owner sign-off on the rendered scene.

- [ ] **Step 1: Dispatch Fable to author `glacierWallFace`**

Brief: "Write `glacierWallFace(params: WallParams, seed: number): PixelGrid` in `materials.ts` — a 16×16 fully-opaque, seamless, deterministic wall-face texture reading as faceted glacial ice. Palette-locked to `white, skyBlue, slate, indigo, ink` only. Large angular translucent facets with bright `white`/`skyBlue` lit edges catching light from the north, `indigo`/`ink` fracture lines and deep crevices; smoother and glassier than the stacked-stone `blockWallFace`. Use only `h2`/`fbm` for variation (no `Math.random`). Match `blockWallFace`'s edge-to-edge coverage so it tiles into the cliff set. Keep it a single self-contained function beside `blockWallFace`."

- [ ] **Step 2: Route the material to the bespoke face**

```ts
    case "glacier":
      return glacierWallFace(params, seed);
```

- [ ] **Step 3: Palette-lock + determinism unit check**

Run: `npx vitest run tests/pipeline/cliffs.test.ts -t "ice preset"` and a palette-lock assertion (every pixel of `wallFace("glacier", ICE_PRESETS[0]-params, seed)` ∈ ICE family). Expected: PASS (counts unchanged — only pixels differ).

- [ ] **Step 4: Regenerate + re-render + owner sign-off**

Run: `npm run assets && npx tsx tools/pipeline/render-cliff-review.mts`
Send the new `.review/ice-scene.png` to the owner. Iterate with Fable until approved.

- [ ] **Step 5: Re-pin the cliffIce sha**

The pixels changed, so `cliffIce`'s sha moved (desert `cliff` still unchanged). Run the determinism test, copy the new received `cliffIce` hash into `FROZEN`, re-run to green.

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/pipeline/src/cliffs/materials.ts src/assets/generated/cliffIce.png src/assets/generated/manifest.json tests/pipeline/determinism.test.ts
git commit -m "feat(cliffs): bespoke crystalline glacier wall face"
```

---

### Task 9: Land M0+M1 as a PR

- [ ] **Step 1: Push + open PR**

```bash
git push -u origin claude/biome-cliff-terrain-sets
gh pr create --title "Biome cliff terrain sets: M0 generalization + M1 ice" --body "..."
```

- [ ] **Step 2: Merge with a regular merge commit**

```bash
gh pr merge <n> --merge --delete-branch
```

---

## Follow-on (separate plans, not this one)

- **M2–M5:** Reef (tier-3 coral), Lava (tier-3 cracked basalt + ember), Grove (tier-2), Sea (tier-2). Each is a repeat of Tasks 3–8 with that biome's ramp/preset/face; per-biome PR + review scene. Reef/Lava get a bespoke face task like Task 8; Grove/Sea stay tier-2 (skip Task 8, keep the `blockWallFace(ramp, params)` face with tuned `WallParams`).
- **Spec B:** runtime placement — elevation data model + blob-mask autotiler + `BootScene`/`ZoneScene` wiring + map placement (lights up every biome incl. the already-baked desert). This is the terrain-shaper foundation.

## Self-Review notes

- **Spec coverage:** §5 generalization → Tasks 1,2 (+3,4 for palette/materials); §6.1 baking → Tasks 5,6; §6.2 review renderer → Task 7; §7 ice palette → Task 3; §4.2 tier-3 bespoke → Task 8; §8 M0 acceptance (desert byte-identical) → Tasks 1,2 Step-4/5 gates; §9 verification → Task 6 Step 4 + Task 8 Step 5. M2–M5 explicitly deferred.
- **Type consistency:** `blockWallFace(ramp, params, seed)`, `glacierWallFace(params, seed)`, `diagonalFlightTiles(…, groundRamp?)`, `cliffIceSheetFrames/cliffIceTileNames`, `MaterialKey = "rock" | "glacier"`, `TerrainKey` adds `"ice"` — used consistently across tasks.
- **Placeholder note:** the `274` totals in Tasks 4/5 are computed (1 pairing) but explicitly instructed to be reconciled to the actual generated length on first run — a deliberate confirm step, not an unresolved TBD. Task 8 is creative-by-nature (Fable) with test + review gates rather than literal code, which is correct for bespoke pixel art.
