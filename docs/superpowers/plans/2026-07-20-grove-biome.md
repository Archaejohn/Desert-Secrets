# Grove/Cave Biome (`cliffGrove`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the grove/cave biome — four grounds (`groveGrass`/`groveMoss`/`groveWater`/`groveSoil`) all autotiling, a new `cliffGrove.png` sheet, and a bespoke damp-cave-stone wall face (dripping water + sparse moss).

**Architecture:** Full new biome, exact mirror of the lava build (commit `3009419`) — new `groveStone` material + bespoke face, new `GROVE_CLIFF` preset, new sheet + `faceRamp`. Additive.

**Tech Stack:** TypeScript, Vitest, the `tools/pipeline/` art pipeline.

## Global Constraints

- Palette-locked to `src/shared/palette.ts` (current palette; AAP-64 migration later).
- Deterministic: `h2`/`fbm` only. Additive-only: append after existing sheet key/pairings.
- **Desert (`cliff`), ice (`cliffIce`), reef (`cliffReef`), lava (`cliffLava`) MUST stay byte-identical.** Only a new `cliffGrove` pin.
- Priority `groveGrass < groveMoss < groveWater < groveSoil`; `over` = lower.
- Spec: `docs/superpowers/specs/2026-07-20-grove-biome-design.md`. Lava plan (`2026-07-20-lava-biome.md`) is the mechanical reference.

---

### Task 1: Grove ground keys + ramps + GROVE wall ramp

**Files:** Modify `tools/pipeline/src/cliffs/palette.ts`; Test `tests/pipeline/cliffs.test.ts`

- [ ] **Step 1:** Extend `TerrainKey` — after `| "lavaCrust";` insert `| "groveGrass" | "groveMoss" | "groveWater" | "groveSoil";` (replace the trailing `;` accordingly).
- [ ] **Step 2:** After the `lavaCrust: [...]` `TERRAIN_RAMPS` entry:

```ts
  // Grove/cave biome grounds (light -> dark). Lush grass, darker spotted moss on
  // darkened soil, spring water, and bare earth.
  groveGrass: ["mint", "jade", "teal", "tealDeep"],
  groveMoss: ["jade", "teal", "umber", "ink"],
  groveWater: ["skyBlue", "teal", "tealDeep", "indigo"],
  groveSoil: ["clay", "umber", "stoneDeep", "ink"],
```

- [ ] **Step 3:** After `export const LAVA: Ramp = [...]`:

```ts
// Damp cave stone with water/moss highlights (light -> dark stone), for the
// bespoke groveStone face. 8-slot like ROCK/ICE/REEF/LAVA.
export const GROVE: Ramp = ["mint", "skyBlue", "jade", "teal", "stoneDark", "stoneDeep", "tealDeep", "ink"];
```

- [ ] **Step 4:** Test + run + commit:

```ts
describe("grove biome ramps", () => {
  it.each(["groveGrass", "groveMoss", "groveWater", "groveSoil"] as const)("%s has a 4-entry ramp", (key) => {
    expect(TERRAIN_RAMPS[key]).toBeDefined();
    expect(TERRAIN_RAMPS[key]).toHaveLength(4);
  });
});
```

`npx vitest run tests/pipeline/cliffs.test.ts -t "grove biome ramps"` → PASS; `tsc` → 0.
```bash
git add tools/pipeline/src/cliffs/palette.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): grove biome ground keys + ramps + GROVE wall ramp"
```

---

### Task 2: `floorFill` recipes

**Files:** Modify `tools/pipeline/src/cliffs/terrains.ts` (before the `} else {` asphalt branch); Test `cliffs.test.ts`

- [ ] **Step 1:** Insert the four branches (before `} else {  // asphalt`):

```ts
      } else if (key === "groveGrass") {
        // Lush grass — mottled jade/teal body (ramp[1]/ramp[2]) with sparse bright
        // mint highlights (ramp[0]); smooth, low fleck density.
        idx = v < 0.5 ? 1 : 2;
        if (h2(x, y, seed + 31) > 0.90) idx = 0; // sparse mint highlight (~10%)
      } else if (key === "groveMoss") {
        // Darker + MORE spotted than grass, on darkened soil (owner direction):
        // umber soil base (ramp[2]) showing between generous mottled green moss
        // clumps (teal ramp[1] / jade ramp[0]); rare ink deep shadow (ramp[3]).
        const g = fbm(x, y, seed + 5);
        idx = g > 0.55 ? 1 : 2; // teal moss on fbm highs, umber soil elsewhere
        if (h2(x, y, seed + 31) > 0.80) idx = 0; // bright jade moss fleck (~20%)
        else if (h2(x, y, seed + 53) > 0.94) idx = 3; // rare ink shadow (~6%)
      } else if (key === "groveWater") {
        // Spring water — fbm-mottled teal/tealDeep body (ramp[1]/ramp[2]) with
        // sparse skyBlue ripples (ramp[0]).
        idx = v < 0.5 ? 1 : 2;
        if (h2(x, y, seed + 31) > 0.90) idx = 0; // sparse skyBlue ripple (~10%)
      } else if (key === "groveSoil") {
        // Bare earth — mottled umber/stoneDeep body (ramp[1]/ramp[2]) with sparse
        // clay light grit (ramp[0]) and rare ink specks (ramp[3]).
        idx = v < 0.5 ? 1 : 2;
        if (h2(x, y, seed + 31) > 0.92) idx = 0; // sparse clay grit (~8%)
        else if (h2(x, y, seed + 53) > 0.96) idx = 3; // rare ink speck (~4%)
```

- [ ] **Step 2:** Test + run + commit:

```ts
describe("grove biome floorFill", () => {
  it.each(["groveGrass", "groveMoss", "groveWater", "groveSoil"] as const)("%s fill is palette-locked", (key) => {
    const g = floorFill(key, 9090);
    const allowed = new Set<string>(TERRAIN_RAMPS[key]);
    g.forEach((_x, _y, c) => { if (c !== null) expect(allowed.has(c)).toBe(true); });
  });
  it.each(["groveGrass", "groveMoss", "groveWater", "groveSoil"] as const)("%s fill is deterministic", (key) => {
    expect(floorFill(key, 9090).diff(floorFill(key, 9090))).toBe(0);
  });
});
```

`npx vitest run tests/pipeline/cliffs.test.ts -t "grove biome floorFill"` → PASS; `tsc` → 0.
```bash
git add tools/pipeline/src/cliffs/terrains.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): floorFill recipes for grove grounds (moss on darkened soil)"
```

---

### Task 3: `groveStone` material (placeholder face) + faceRamp

**Files:** Modify `materials.ts` (`MaterialKey`; import `GROVE`; `wallFace` switch), `generate.ts` (import `GROVE`; faceRamp)

- [ ] **Step 1:** `MaterialKey` — add `| "groveStone"`.
- [ ] **Step 2:** Import `GROVE` into `materials.ts` (add to the `./palette` import). Add the placeholder case before `wallFace`'s closing brace:

```ts
    case "groveStone":
      // Placeholder (tier-2) until the bespoke damp-cave face (Task 7).
      return blockWallFace(GROVE, params, seed);
```

- [ ] **Step 3:** In `generate.ts`, import `GROVE`; extend the faceRamp conditional tail: `... : p.material === "basaltRock" ? LAVA : p.material === "groveStone" ? GROVE : undefined,`.
- [ ] **Step 4:** `tsc` → 0; commit:
```bash
git add tools/pipeline/src/cliffs/materials.ts tools/pipeline/src/cliffs/generate.ts
git commit -m "feat(cliffs): groveStone material (placeholder face) + GROVE faceRamp"
```

---

### Task 4: `GROVE_CLIFF` preset + all-pairs + test

**Files:** Modify `presets.ts` (after `LAVA_PRESETS`); Test `cliffs.test.ts` (import `GROVE_PRESETS`)

- [ ] **Step 1:** Add the preset (mirror `LAVA_CLIFF` with grove data):

```ts
const GROVE_CLIFF: TerrainParams = {
  material: "groveStone",
  courses: 3, blockSize: 3, blocksPerCourse: 3, stagger: 0.5,
  tone: 0.16, mortar: 0.24, orderVsRandom: 0.4,
  capBand: 4, capRoll: 0.45, capMaterial: "plateau", footer: 6, cliffHeight: 2,
  baseRounding: 3, topRounding: 3, outerCornerShade: 0.4, innerCornerDepth: 0.6,
  castShadow: 0.5, scree: true, litLip: true,
  // Floor blob edges — organic/flowing (owner) for the lush grove. Tuned at gate.
  edgeInset: 2, edgeIrregularity: 18, cornerRounding: 8, pocketRounding: 8,
  edgeOutline: true, dropShadow: true, linkPlateauCorners: true,
  // All four grounds autotile. Priority groveGrass < groveMoss < groveWater <
  // groveSoil; over = lower. Self first, cross-pairs appended (additive).
  pairings: [
    { over: "groveGrass", base: "groveGrass" },
    { over: "groveGrass", base: "groveMoss" },
    { over: "groveGrass", base: "groveWater" },
    { over: "groveGrass", base: "groveSoil" },
    { over: "groveMoss", base: "groveWater" },
    { over: "groveMoss", base: "groveSoil" },
    { over: "groveWater", base: "groveSoil" },
  ],
  plateauTop: "groveGrass",
  ground: "groveGrass",
  seed: 9090,
  ramps: ["sandSlope", "stoneSteps"],
  diagonalRamps: true,
};

export const GROVE_PRESETS: TerrainParams[] = [GROVE_CLIFF];
```

- [ ] **Step 2:** Test (import `GROVE_PRESETS`):

```ts
describe("generateTerrain + grove preset", () => {
  it("grove preset emits its full parity set (4 grounds, all-pairs = 7 pairings)", () => {
    const out = generateTerrain(GROVE_PRESETS[0]).map((o) => o.name);
    expect(out.filter((n) => n.startsWith("cliffGroveStone_")).length).toBe(15);
    expect(out.filter((n) => n.startsWith("groveGrassPlateau_")).length).toBe(47);
    for (const p of ["groveGrassGroveGrass", "groveGrassGroveMoss", "groveGrassGroveWater", "groveGrassGroveSoil", "groveMossGroveWater", "groveMossGroveSoil", "groveWaterGroveSoil"]) {
      expect(out.filter((n) => n.startsWith(`${p}_`)).length).toBe(47);
    }
    for (const f of ["groveGrassFill", "groveMossFill", "groveWaterFill", "groveSoilFill"]) expect(out).toContain(f);
    expect(out.filter((n) => n.endsWith("Fill")).length).toBe(4);
    expect(new Set(out).size).toBe(out.length);
    expect(out.length).toBe(559);
  });
});
```

`npx vitest run tests/pipeline/cliffs.test.ts -t "grove preset emits"` → PASS; `tsc` → 0.
```bash
git add tools/pipeline/src/cliffs/presets.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): GROVE_CLIFF preset + all-pairs pairings"
```

---

### Task 5: Sheet plumbing (`cliffGrove.png`)

Mirror the cliffLava plumbing exactly:
- [ ] **frames.ts:** import `GROVE_PRESETS`; add `cliffGroveTileNames` / `cliffGroveSheetFrames` (via `realEntriesFor`/`sheetFramesFor`) after the cliffLava exports.
- [ ] **assets.ts:** import `cliffGroveSheetFrames`; add `cliffGrove: PixelGrid;` after `cliffLava`; append `"cliffGrove"` to `SHEET_KEYS` (comma after `"cliffLava"`); append `cliffGrove: composeSheet(cliffGroveSheetFrames(), 8),` after the cliffLava composition.
- [ ] **manifest.ts:** import `cliffGroveTileNames`; add `cliffGrove: TileSetDef;`; append the `cliffGrove` manifest entry (comma after cliffLava).
- [ ] **index.ts:** append `["cliffGrove.png", assets.cliffGrove]` (comma after cliffLava).
- [ ] **cliffs.test.ts:** import `cliffGroveTileNames`/`cliffGroveSheetFrames`; add the sheet-structure test (mirror the cliffLava one, 559, `a.cliffGrove`).
- [ ] `tsc` → 0; `npx vitest run tests/pipeline/cliffs.test.ts -t "cliffGrove sheet"` → PASS.
```bash
git add tools/pipeline/src/cliffs/frames.ts tools/pipeline/src/assets.ts tools/pipeline/src/manifest.ts tools/pipeline/src/index.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): cliffGrove.png sheet plumbing"
```

---

### Task 6: Bake + review scene + pin (OWNER GATE)

- [ ] **Step 1:** `render-cliff-review.mts`: add `{ label: "grove", params: GROVE_PRESETS[0] }` to VARIANTS (import `GROVE_PRESETS`); add a grove transition demo block guarded on `params.pairings.some((pr) => pr.base === "groveMoss")` (patches of groveMoss/groveWater/groveSoil on the groveGrass field, blitting `groveGrass${cap(base)}_${canonical(m)}`).
- [ ] **Step 2:** `npm run art` → confirm `wrote cliffGrove.png`; other four sheets byte sizes unchanged.
- [ ] **Step 3:** `npx tsx tools/pipeline/render-cliff-review.mts` → `.review/grove-scene.png` (+ render the 6 grove pairs zoomed for review).
- [ ] **Step 4: OWNER REVIEW GATE.** Present grove grounds. Placeholder wall + organic seams provisional; tune seams in the tuner if wanted; re-bake. Do NOT pin until owner signs off.
- [ ] **Step 5:** Pin — determinism test fails only on `cliffGrove` (others pass); add the `cliffGrove` entry to `FROZEN` with a comment block.
- [ ] **Step 6:** Full verification + commit:
```bash
npx tsc --noEmit && npx vitest run && npm run build && npm run smoke
git add tools/pipeline/render-cliff-review.mts src/assets/generated/cliffGrove.png src/assets/generated/manifest.json tests/pipeline/determinism.test.ts
git commit -m "feat(cliffs): bake cliffGrove.png + review demo + pin (placeholder face)"
```

---

### Task 7: Bespoke `groveStone` damp-cave wall face (OWNER GATE)

**Files:** Modify `materials.ts` (`groveStoneWallFace`; route the case), `determinism.test.ts` (re-pin), `cliffs.test.ts` (face-ramp test)

- [ ] **Step 1:** Write `groveStoneWallFace(params, seed)` — model on `basaltRockWallFace`'s call shape. Palette-locked to `GROVE`, deterministic (`h2`/`fbm`/`n1`), seamless (wrap mod 16):
  - **Dark cave-stone body:** fbm-mottled `stoneDeep`/`stoneDark`, `ink` lows/undersides.
  - **Vertical water-drip streaks:** a few columns per tile chosen via tiling 1D noise (`n1(x, seed)`), each a 1px `skyBlue` streak running top→bottom with a `mint` glint bead near the top; wraps so streaks seam side-to-side.
  - **Sparse moss patches:** `h2`-placed clumps of `jade`/`teal` crusting ledges and streak edges (~sparse).
- [ ] **Step 2:** Route `case "groveStone"` from `blockWallFace(GROVE, …)` to `return groveStoneWallFace(params, seed);`.
- [ ] **Step 3:** Face-ramp test (mirror the lava one): `cliffGroveStone_mid_face` pixels ∈ `GROVE`.
- [ ] **Step 4: Re-bake + OWNER GATE.** `npm run art`; render; present `.review/grove-scene.png`. Iterate the face (dripping water + moss) with the owner until sign-off.
- [ ] **Step 5:** Re-pin `cliffGrove` + full verification + commit (comment: bespoke damp-cave face replaces placeholder; other four byte-identical).
- [ ] **Step 6:** Update memory — grove biome built; next biome = **sea** (last in the order).

---

## Self-Review

- **Spec coverage:** §3 grounds→T1, §4 ramps→T1, §5 floorFill (incl. moss-on-soil)→T2, §6 pairings→T4, §7 seams→T4/T6, §8 bespoke wall→T3(placeholder)+T7(bespoke), §9 plumbing→T5, §10 tests/pins→T4/T5/T6/T7.
- **Placeholder scan:** code concrete; hashes at bake time; T7 face describes the recipe + owner iteration (tier-3 process).
- **Type consistency:** `groveStone` material, `GROVE` ramp, keys `groveGrass`/`groveMoss`/`groveWater`/`groveSoil`, pair names `${over}${cap(base)}` (groveGrassGroveMoss, groveMossGroveWater, groveWaterGroveSoil, …), `cliffGroveStone_`, `groveGrassPlateau_`, 559 total — consistent.
