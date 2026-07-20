# Lava Biome (`cliffLava`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the lava/volcanic biome to the cliff generator at desert parity — four grounds (`emberRock`/`ash`/`lava`/`lavaCrust`) that all autotile, a new `cliffLava.png` sheet, and a tier-3 bespoke basalt-with-molten-fissures wall face.

**Architecture:** Full new biome mirroring reef M2 — new `MaterialKey` (`basaltRock`), new `LAVA_CLIFF` preset, new per-biome sheet + `faceRamp`, then a bespoke face. Additive; the generator, sheet plumbing, and diagonal machinery all already exist and are proven by reef/ice.

**Tech Stack:** TypeScript, Vitest, the `tools/pipeline/` procedural art pipeline.

## Global Constraints

- Palette-locked to `src/shared/palette.ts` (lands on the current 25-color palette; AAP-64 migration re-colors it later).
- Deterministic: `h2`/`fbm` only, no `Math.random`/`Date`.
- Additive-only: append new sheet key / pairings after existing ones; never reorder.
- **Desert (`cliff`), ice (`cliffIce`), reef (`cliffReef`) sheets MUST stay byte-identical.** Only a new `cliffLava` pin is added.
- Priority order `emberRock < ash < lava < lavaCrust`; `over` = lower.
- Design spec: `docs/superpowers/specs/2026-07-20-lava-biome-design.md`. Reef M2 plan (`2026-07-20-biome-cliff-terrain-sets-m2-reef.md`) is the mechanical reference.

---

### Task 1: Lava ground keys + ramps + LAVA wall ramp

**Files:**
- Modify: `tools/pipeline/src/cliffs/palette.ts` (`TerrainKey` union tail; `TERRAIN_RAMPS` after `rimeMoss`; `LAVA` wall ramp after the `REEF` const ~L34)
- Test: `tests/pipeline/cliffs.test.ts`

**Interfaces:**
- Produces: `TerrainKey` gains `"emberRock" | "ash" | "lava" | "lavaCrust"`; `TERRAIN_RAMPS` gains 4-entry ramps for each; `export const LAVA: Ramp` (8-slot).

- [ ] **Step 1: Extend `TerrainKey`.** Change the union tail `| "rimeMoss";` to:

```ts
  | "rimeMoss"
  | "emberRock"
  | "ash"
  | "lava"
  | "lavaCrust";
```

- [ ] **Step 2: Add the 4 ground ramps.** After the `rimeMoss: [...]` entry in `TERRAIN_RAMPS`:

```ts
  // Lava biome grounds (light -> dark). Warm dark basalt, pale ash, vivid molten
  // flow, and cooling crust with red fissures — on the current warm/stone palette.
  emberRock: ["clay", "rust", "stoneDeep", "ink"],
  ash: ["bone", "sandShade", "stone", "stoneDark"],
  lava: ["atbGold", "amber", "hpRed", "rust"],
  lavaCrust: ["hpRed", "rust", "stoneDeep", "ink"],
```

- [ ] **Step 3: Add the LAVA wall ramp.** After `export const REEF: Ramp = [...]`:

```ts
// Basalt wall with molten fissures (light molten glow -> dark basalt), for the
// bespoke basaltRock face (Task 7). Mirrors ROCK/ICE/REEF's 8-slot shape.
export const LAVA: Ramp = ["atbGold", "amber", "hpRed", "rust", "stoneDark", "stoneDeep", "stoneDeep", "ink"];
```

- [ ] **Step 4: Write the failing test.** In `tests/pipeline/cliffs.test.ts`:

```ts
describe("lava biome ramps", () => {
  it.each(["emberRock", "ash", "lava", "lavaCrust"] as const)("%s has a 4-entry ramp", (key) => {
    expect(TERRAIN_RAMPS[key]).toBeDefined();
    expect(TERRAIN_RAMPS[key]).toHaveLength(4);
  });
});
```

- [ ] **Step 5: Run + commit.** `npx vitest run tests/pipeline/cliffs.test.ts -t "lava biome ramps"` → PASS; `npx tsc --noEmit` → 0.

```bash
git add tools/pipeline/src/cliffs/palette.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): lava biome ground keys + ramps + LAVA wall ramp"
```

---

### Task 2: `floorFill` recipes for the four grounds

**Files:**
- Modify: `tools/pipeline/src/cliffs/terrains.ts` (insert before the final `} else {` asphalt branch)
- Test: `tests/pipeline/cliffs.test.ts`

**Interfaces:**
- Produces: `floorFill("emberRock"|"ash"|"lava"|"lavaCrust", seed)` → 16x16 `PixelGrid`, palette-locked to its ramp, deterministic.

- [ ] **Step 1: Add the four branches** (insert before `} else {  // asphalt`):

```ts
      } else if (key === "emberRock") {
        // Dark basalt floor (ramp[2]/ramp[3]) with sparse warm ember-glow flecks
        // (ramp[0]) — the low-contrast background the other three sit against.
        idx = v < 0.5 ? 2 : 3;
        if (h2(x, y, seed + 31) > 0.94) idx = 0; // sparse ember glow (~6%)
        else if (h2(x, y, seed + 53) > 0.97) idx = 1; // rare warm rust speck (~3%)
      } else if (key === "ash") {
        // Pale grey ash drift — bone/sandShade body (ramp[0]/ramp[1]), smooth,
        // low fleck density, with a rare darker cinder speck (ramp[3]).
        idx = v < 0.5 ? 0 : 1;
        if (h2(x, y, seed + 53) > 0.96) idx = 3; // rare cinder speck (~4%)
      } else if (key === "lava") {
        // Molten flow — fbm-mottled amber/hpRed body (ramp[1]/ramp[2]) with
        // generous bright gold glow (ramp[0]); the most saturated ground.
        idx = v < 0.5 ? 1 : 2;
        if (h2(x, y, seed + 31) > 0.82) idx = 0; // generous gold glow (~18%)
      } else if (key === "lavaCrust") {
        // Cooling crust — dark body (ramp[2]/ramp[3]) with sparse red fissure
        // flecks (ramp[0], glowing) reading as cracks in the black crust.
        idx = v < 0.5 ? 2 : 3;
        if (h2(x, y, seed + 31) > 0.90) idx = 0; // sparse red fissure (~10%)
        else if (h2(x, y, seed + 53) > 0.96) idx = 1; // rarer rust ember (~4%)
```

- [ ] **Step 2: Write the failing test.** In `tests/pipeline/cliffs.test.ts`:

```ts
describe("lava biome floorFill", () => {
  it.each(["emberRock", "ash", "lava", "lavaCrust"] as const)("%s fill is palette-locked", (key) => {
    const g = floorFill(key, 8888);
    const allowed = new Set<string>(TERRAIN_RAMPS[key]);
    g.forEach((_x, _y, c) => { if (c !== null) expect(allowed.has(c)).toBe(true); });
  });
  it.each(["emberRock", "ash", "lava", "lavaCrust"] as const)("%s fill is deterministic", (key) => {
    expect(floorFill(key, 8888).diff(floorFill(key, 8888))).toBe(0);
  });
});
```

- [ ] **Step 3: Run + commit.** `npx vitest run tests/pipeline/cliffs.test.ts -t "lava biome floorFill"` → PASS; `tsc` → 0.

```bash
git add tools/pipeline/src/cliffs/terrains.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): floorFill recipes for emberRock/ash/lava/lavaCrust"
```

---

### Task 3: `basaltRock` material (placeholder face) + faceRamp

**Files:**
- Modify: `tools/pipeline/src/cliffs/materials.ts` (`MaterialKey` L63; `wallFace` switch ~L379-387)
- Modify: `tools/pipeline/src/cliffs/generate.ts` (faceRamp conditional ~L136; import `LAVA`)

**Interfaces:**
- Consumes: `LAVA` ramp (Task 1).
- Produces: `MaterialKey` gains `"basaltRock"`; `wallFace("basaltRock", …)` returns a tier-2 placeholder (`blockWallFace(LAVA, …)`) until Task 7 replaces it.

- [ ] **Step 1: Extend `MaterialKey`.** Change L63 to:

```ts
export type MaterialKey = "rock" | "glacier" | "coralRock" | "basaltRock";
```

- [ ] **Step 2: Add the placeholder case.** In `wallFace`'s switch, before `default`:

```ts
    case "basaltRock":
      // Placeholder (tier-2) until the bespoke Worley-lava face (Task 7).
      return blockWallFace(LAVA, params, seed);
```

Ensure `LAVA` is imported into `materials.ts` from `./palette` (add to the existing palette import).

- [ ] **Step 3: Thread the faceRamp.** In `generate.ts`, change the faceRamp conditional (currently `p.material === "glacier" ? ICE : p.material === "coralRock" ? REEF : undefined`) to append:

```ts
      faceRamp: p.material === "glacier" ? ICE : p.material === "coralRock" ? REEF : p.material === "basaltRock" ? LAVA : undefined,
```

Add `LAVA` to the palette import in `generate.ts`.

- [ ] **Step 4: Run + commit.** `npx tsc --noEmit` → 0 (no new test — exercised via the preset in Task 4).

```bash
git add tools/pipeline/src/cliffs/materials.ts tools/pipeline/src/cliffs/generate.ts
git commit -m "feat(cliffs): basaltRock material (placeholder face) + LAVA faceRamp"
```

---

### Task 4: `LAVA_CLIFF` preset + all-pairs + generateTerrain test

**Files:**
- Modify: `tools/pipeline/src/cliffs/presets.ts` (add `LAVA_CLIFF` + `LAVA_PRESETS` after `REEF_PRESETS`)
- Test: `tests/pipeline/cliffs.test.ts`

**Interfaces:**
- Consumes: grounds/ramps/fills (Tasks 1-2), `basaltRock` material (Task 3).
- Produces: `LAVA_PRESETS: TerrainParams[]`; `generateTerrain(LAVA_PRESETS[0])` emits `cliffBasaltRock_`=15, `emberRockPlateau_`=47, 7 pairing sets (47 each), 4 fills, total **559**.

- [ ] **Step 1: Add the preset.** After `export const REEF_PRESETS = [REEF_CLIFF];`, mirroring `REEF_CLIFF` with lava data:

```ts
const LAVA_CLIFF: TerrainParams = {
  material: "basaltRock",
  // Wall structure — tier-2 placeholder under the bespoke face (Task 7).
  courses: 3, blockSize: 3, blocksPerCourse: 3, stagger: 0.5,
  tone: 0.16, mortar: 0.24, orderVsRandom: 0.4,
  // Cliff assembly — mirrors REEF_CLIFF (== desert defaults).
  capBand: 4, capRoll: 0.45, capMaterial: "plateau", footer: 6, cliffHeight: 2,
  baseRounding: 3, topRounding: 3, outerCornerShade: 0.4, innerCornerDepth: 0.6,
  castShadow: 0.5, scree: true, litLip: true,
  // Floor blob edges — organic/flowing (owner-picked) to suit molten lava/ash.
  // Starting values; tuned in the seam-rounding tuner at the review gate.
  edgeInset: 2, edgeIrregularity: 18, cornerRounding: 8, pocketRounding: 8,
  edgeOutline: true, dropShadow: true, linkPlateauCorners: true,
  // All four grounds autotile with each OTHER. Priority emberRock < ash < lava
  // < lavaCrust; over = lower. Self first, cross-pairs appended (additive).
  pairings: [
    { over: "emberRock", base: "emberRock" },
    { over: "emberRock", base: "ash" },
    { over: "emberRock", base: "lava" },
    { over: "emberRock", base: "lavaCrust" },
    { over: "ash", base: "lava" },
    { over: "ash", base: "lavaCrust" },
    { over: "lava", base: "lavaCrust" },
  ],
  plateauTop: "emberRock",
  ground: "emberRock",
  seed: 8888,
  ramps: ["sandSlope", "stoneSteps"],
  diagonalRamps: true,
};

export const LAVA_PRESETS: TerrainParams[] = [LAVA_CLIFF];
```

- [ ] **Step 2: Write the failing test.** In `tests/pipeline/cliffs.test.ts` (import `LAVA_PRESETS` from presets):

```ts
describe("generateTerrain + lava preset", () => {
  it("lava preset emits its full parity set (4 grounds, all-pairs = 7 pairings)", () => {
    const out = generateTerrain(LAVA_PRESETS[0]).map((o) => o.name);
    expect(out.filter((n) => n.startsWith("cliffBasaltRock_")).length).toBe(15);
    expect(out.filter((n) => n.startsWith("emberRockPlateau_")).length).toBe(47);
    for (const p of ["emberRockEmberRock", "emberRockAsh", "emberRockLava", "emberRockLavaCrust", "ashLava", "ashLavaCrust", "lavaLavaCrust"]) {
      expect(out.filter((n) => n.startsWith(`${p}_`)).length).toBe(47);
    }
    for (const f of ["emberRockFill", "ashFill", "lavaFill", "lavaCrustFill"]) expect(out).toContain(f);
    expect(out.filter((n) => n.endsWith("Fill")).length).toBe(4);
    expect(new Set(out).size).toBe(out.length);
    expect(out.length).toBe(559); // 4 fills + 15 cliff + 47 plateau + 7x47 + 32 ramps + 132 diag
  });
});
```

- [ ] **Step 3: Run + commit.** `npx vitest run tests/pipeline/cliffs.test.ts -t "lava preset emits"` → PASS; `tsc` → 0.

```bash
git add tools/pipeline/src/cliffs/presets.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): LAVA_CLIFF preset + all-pairs pairings"
```

---

### Task 5: Sheet plumbing (`cliffLava.png`) + structure test

**Files:**
- Modify: `tools/pipeline/src/cliffs/frames.ts`, `tools/pipeline/src/assets.ts`, `tools/pipeline/src/manifest.ts`, `tools/pipeline/src/index.ts`
- Test: `tests/pipeline/cliffs.test.ts`

**Interfaces:**
- Produces: `cliffLavaTileNames()`, `cliffLavaSheetFrames()`, `assets.cliffLava`, `manifest.cliffLava`, and `cliffLava.png` on disk.

- [ ] **Step 1: frames.ts.** Add `LAVA_PRESETS` to the presets import, then after the `cliffReefSheetFrames` export:

```ts
export const cliffLavaTileNames = (): string[] => realEntriesFor(LAVA_PRESETS).map((e) => e.name);
export const cliffLavaSheetFrames = (): PixelGrid[] => sheetFramesFor(LAVA_PRESETS);
```

- [ ] **Step 2: assets.ts.** Add `cliffLavaSheetFrames` to the frames import (L42); add `cliffLava: PixelGrid;` after `cliffReef: PixelGrid;` in the assets interface; append `"cliffLava"` after `"cliffReef"` in `SHEET_KEYS`; append after the `cliffReef: composeSheet(...)` line:

```ts
    cliffLava: composeSheet(cliffLavaSheetFrames(), 8),
```

- [ ] **Step 3: manifest.ts.** Add `cliffLavaTileNames` to the frames import; add `cliffLava: TileSetDef;` after `cliffReef: TileSetDef;`; append after the `cliffReef` manifest entry (add a comma to the reef entry):

```ts
    cliffLava: { file: "cliffLava.png", tileSize: TILE_SIZE, columns: 8, names: tileNames(cliffLavaTileNames()) }
```

- [ ] **Step 4: index.ts.** Add a comma after the `cliffReef.png` entry and append:

```ts
  ["cliffLava.png", assets.cliffLava]
```

- [ ] **Step 5: Structure test.** In `tests/pipeline/cliffs.test.ts` (import `cliffLavaTileNames`, `cliffLavaSheetFrames`):

```ts
  it("cliffLava sheet is 16px frames padded to 8 columns, manifest-consistent (559)", () => {
    const names = cliffLavaTileNames();
    const frames = cliffLavaSheetFrames();
    expect(names.length).toBe(559);
    expect(frames.length % 8).toBe(0);
    frames.forEach((f) => { expect(f.width).toBe(16); expect(f.height).toBe(16); });
    const a = buildAssets();
    expect(a.cliffLava.width).toBe(8 * 16);
    expect(Object.keys(a.manifest.cliffLava.names).length).toBe(names.length);
  });
```

- [ ] **Step 6: Run + commit.** `npx tsc --noEmit` → 0; `npx vitest run tests/pipeline/cliffs.test.ts -t "cliffLava sheet"` → PASS.

```bash
git add tools/pipeline/src/cliffs/frames.ts tools/pipeline/src/assets.ts tools/pipeline/src/manifest.ts tools/pipeline/src/index.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): cliffLava.png sheet plumbing (frames/assets/manifest/index)"
```

---

### Task 6: Bake `cliffLava.png` + review scene + pin (OWNER GATE)

**Files:**
- Modify: `tools/pipeline/render-cliff-review.mts` (add lava variant + transition demo)
- Modify: `tests/pipeline/determinism.test.ts` (add `cliffLava` pin)
- Generated: `src/assets/generated/cliffLava.png`, `manifest.json`

- [ ] **Step 1: Add the lava variant + demo.** In `render-cliff-review.mts`: add `{ label: "lava", params: LAVA_PRESETS[0] }` to `VARIANTS` (import `LAVA_PRESETS`), and add a lava ground-transition demo block guarded on `params.pairings.some((pr) => pr.base === "ash")`, mirroring the ice block (patches of `ash`/`lava`/`lavaCrust` on the `emberRock` field, blitting `emberRock${cap(base)}_${canonical(m)}`).

- [ ] **Step 2: Bake.** `npm run art` → confirm `wrote cliffLava.png`. Confirm `cliff.png`, `cliffIce.png`, `cliffReef.png` byte sizes unchanged.

- [ ] **Step 3: Render review.** `npx tsx tools/pipeline/render-cliff-review.mts` → `.review/lava-scene.png`.

- [ ] **Step 4: OWNER REVIEW GATE.** Present the lava scene. The placeholder wall face + organic seams (`edgeIrregularity 18`) are provisional. Tune seams in the tuner if the owner wants; re-bake. Do NOT pin until the owner signs off on the grounds/seams. (The bespoke face comes in Task 7.)

- [ ] **Step 5: Pin.** `npx vitest run tests/pipeline/determinism.test.ts -t "cliff.png encodes"` → fails only on `cliffLava` (cliff/cliffIce/cliffReef must pass); copy the Received hash. Add a `cliffLava` entry to `FROZEN` with a comment block. Confirm the other three unchanged.

- [ ] **Step 6: Full verification + commit.**

```bash
npx tsc --noEmit && npx vitest run && npm run build && npm run smoke
git add tools/pipeline/render-cliff-review.mts src/assets/generated/cliffLava.png src/assets/generated/manifest.json tests/pipeline/determinism.test.ts
git commit -m "feat(cliffs): bake cliffLava.png + review scene + pin (placeholder face)"
```

---

### Task 7: Bespoke `basaltRock` Worley-lava wall face (OWNER GATE)

**Files:**
- Modify: `tools/pipeline/src/cliffs/materials.ts` (`basaltRockWallFace` draw fn; route `case "basaltRock"` to it)
- Modify: `tests/pipeline/determinism.test.ts` (re-pin `cliffLava`)

- [ ] **Step 1: Write `basaltRockWallFace(params, seed)`.** Model on `coralRockWallFace`/`glacierWallFace`'s call shape. Use the **Worley-lava recipe** already in the codebase (`tileset8` / `cliffs/generate.ts`) as the starting point: packed dark basalt cells (`stone`/`stoneDark`/`stoneDeep`/`ink`) with molten fissures glowing along cell boundaries (`hpRed`/`amber`/`atbGold`) — the LAVA ramp's dark slots for the body, light slots for the fissures. Palette-locked, deterministic (`h2`/`fbm`), seamless, full-tile.

- [ ] **Step 2: Route it.** Change the `case "basaltRock"` in `wallFace` from `blockWallFace(LAVA, params, seed)` to `return basaltRockWallFace(params, seed);`.

- [ ] **Step 3: Verify face pixels come from LAVA.** Add a test (mirror the reef `it("reef wall-face pixels come from the REEF ramp")`) asserting `cliffBasaltRock_mid_face` pixels ∈ `LAVA`.

- [ ] **Step 4: Re-bake + OWNER GATE.** `npm run art`; `npx tsx tools/pipeline/render-cliff-review.mts`; present `.review/lava-scene.png`. Iterate the face with the owner (Fable-authored) until sign-off.

- [ ] **Step 5: Re-pin `cliffLava` + full verification + commit.** Get the new hash, update the `cliffLava` pin (comment: bespoke basaltRock face replaces placeholder; other three byte-identical).

```bash
npx tsc --noEmit && npx vitest run && npm run build && npm run smoke
git add tools/pipeline/src/cliffs/materials.ts src/assets/generated/cliffLava.png src/assets/generated/manifest.json tests/pipeline/determinism.test.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): bespoke basaltRock Worley-lava wall face"
```

- [ ] **Step 6: Update memory** — note the lava biome exists (4 all-pairs grounds + bespoke basalt face), extending the biome set.

---

## Self-Review

- **Spec coverage:** §3 grounds → T1. §4 ramps → T1. §5 floorFill → T2. §6 pairings → T4. §7 seams → T4 (values) + T6 (gate). §8 wall face → T3 (placeholder) + T7 (bespoke). §9 sheet plumbing → T5. §10 tests/pins → T4/T5/T6/T7. §11 verification → T6/T7.
- **Placeholder scan:** all code steps concrete; hashes filled at bake time (runtime values). The bespoke face (T7 S1) describes the recipe + owner-iteration rather than final pixels — matches the tier-3 Fable process reef R3 used.
- **Type consistency:** `basaltRock` material, `LAVA` ramp, `emberRock`/`ash`/`lava`/`lavaCrust` keys, pairing names `${over}${cap(base)}` (emberRockAsh, ashLava, lavaLavaCrust, …), `cliffBasaltRock_`, `emberRockPlateau_`, 559 total — consistent across T1-T7.
