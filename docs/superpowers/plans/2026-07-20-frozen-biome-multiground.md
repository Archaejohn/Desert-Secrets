# Frozen Biome Multi-Ground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the frozen (`ICE_CLIFF`) cliff biome from one `ice` ground to four frozen grounds (`ice`, `snow`, `frozenLake`, `rimeMoss`) that all autotile with each other.

**Architecture:** Pure additive data change to the existing cliff generator, mirroring the reef M2 all-pairs work (commit `05f4b1c`). New `TerrainKey`s + ramps + `floorFill` recipes + `ICE_CLIFF` pairings; bake `cliffIce.png`; owner review; re-pin. No new material, sheet key, or generator code — the glacier wall face and sheet plumbing already exist.

**Tech Stack:** TypeScript, Vitest, the `tools/pipeline/` procedural art pipeline.

## Global Constraints

- Palette-locked to `src/shared/palette.ts` (this lands on the CURRENT 25-color palette; the AAP-64 migration re-colors it later).
- Deterministic: `h2`/`fbm` only, no `Math.random`/`Date`.
- Additive-only: append new pairings AFTER `{over:"ice",base:"ice"}`; never reorder existing tiles.
- **Desert (`cliff`) and reef (`cliffReef`) sheets MUST stay byte-identical** — only `cliffIce` re-pins.
- Priority order `ice < snow < frozenLake < rimeMoss`; `over` = the lower-priority ground.
- Design spec: `docs/superpowers/specs/2026-07-20-frozen-biome-multiground-design.md`.

---

### Task 1: Frozen ground palette keys + ramps

**Files:**
- Modify: `tools/pipeline/src/cliffs/palette.ts` (`TerrainKey` union ~L41-44; `TERRAIN_RAMPS` after the `glowMoss` entry ~L61)
- Test: `tests/pipeline/cliffs.test.ts`

**Interfaces:**
- Produces: `TerrainKey` gains `"snow" | "frozenLake" | "rimeMoss"`; `TERRAIN_RAMPS` gains 4-entry ramps for each, keyed by those names.

- [ ] **Step 1: Extend the `TerrainKey` union.** In `palette.ts`, change the union tail from `| "glowMoss";` to:

```ts
  | "glowMoss"
  | "snow"
  | "frozenLake"
  | "rimeMoss";
```

- [ ] **Step 2: Add the three ramps.** In `TERRAIN_RAMPS`, immediately after the `glowMoss: [...]` entry, add:

```ts
  // Frozen biome grounds (light -> dark). Pale packed snow, deep cracked
  // lake ice, and a frozen glow-moss accent — all in the existing frost family.
  snow: ["white", "bone", "skyBlue", "slate"],
  frozenLake: ["skyBlue", "slate", "indigo", "ink"],
  rimeMoss: ["mint", "jade", "teal", "tealDeep"],
```

- [ ] **Step 3: Write the failing test.** In `tests/pipeline/cliffs.test.ts`, add:

```ts
import { TERRAIN_RAMPS } from "../../tools/pipeline/src/cliffs/palette";

describe("frozen biome ramps", () => {
  it.each(["snow", "frozenLake", "rimeMoss"] as const)("%s has a 4-entry ramp", (key) => {
    expect(TERRAIN_RAMPS[key]).toBeDefined();
    expect(TERRAIN_RAMPS[key]).toHaveLength(4);
  });
});
```

- [ ] **Step 4: Run it.** `npx vitest run tests/pipeline/cliffs.test.ts -t "frozen biome ramps"` → PASS. Also `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit.**

```bash
git add tools/pipeline/src/cliffs/palette.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): frozen biome ground keys + ramps (snow/frozenLake/rimeMoss)"
```

---

### Task 2: `floorFill` recipes for the three grounds

**Files:**
- Modify: `tools/pipeline/src/cliffs/terrains.ts` (the `floorFill` if/else chain — insert after the `key === "ice"` branch, before the final `else`)
- Test: `tests/pipeline/cliffs.test.ts`

**Interfaces:**
- Consumes: `TERRAIN_RAMPS` from Task 1.
- Produces: `floorFill("snow"|"frozenLake"|"rimeMoss", seed)` returns a 16x16 `PixelGrid` using only that ramp's colors, deterministically.

- [ ] **Step 1: Add the three branches.** In `terrains.ts`, insert immediately before the final `} else {` (the `asphalt` branch):

```ts
      } else if (key === "snow") {
        // Packed snowdrift — warm pale body (bone, ramp[1]), brighter than the
        // white ice, with sparse white highlights (ramp[0]) and a rare cool
        // skyBlue shadow speck (ramp[2]). Low fleck density reads as smooth drift.
        idx = 1;
        if (h2(x, y, seed + 31) > 0.90) idx = 0; // sparse white highlight (~10%)
        else if (h2(x, y, seed + 53) > 0.97) idx = 2; // rare skyBlue shadow (~3%)
      } else if (key === "frozenLake") {
        // Cracked lake ice — fbm-mottled slate/skyBlue surface sheen
        // (ramp[1]/ramp[0]), bluer and darker than the white ice it sits below,
        // with sparse indigo crack flecks (ramp[2]) and rare deep ink cracks (ramp[3]).
        idx = v < 0.5 ? 1 : 0;
        if (h2(x, y, seed + 53) > 0.93) idx = 2; // sparse indigo crack (~7%)
        else if (h2(x, y, seed + 61) > 0.985) idx = 3; // rare deep ink crack (~1.5%)
      } else if (key === "rimeMoss") {
        // Frozen glow-moss — fbm-mottled teal/jade body (ramp[2]/ramp[1]) with
        // generous mint glow highlights (ramp[0]); the brightest frozen ground
        // (mirrors reef glowMoss / tileset3 mossGlow).
        idx = v < 0.5 ? 2 : 1;
        if (h2(x, y, seed + 31) > 0.85) idx = 0; // generous mint glow (~15%)
```

- [ ] **Step 2: Write the failing test.** In `tests/pipeline/cliffs.test.ts`:

```ts
import { floorFill } from "../../tools/pipeline/src/cliffs/terrains";

describe("frozen biome floorFill", () => {
  it.each(["snow", "frozenLake", "rimeMoss"] as const)("%s fill is palette-locked to its ramp", (key) => {
    const g = floorFill(key, 2026);
    const allowed = new Set(TERRAIN_RAMPS[key]);
    g.forEach((_x, _y, c) => { if (c !== null) expect(allowed.has(c)).toBe(true); });
  });
  it.each(["snow", "frozenLake", "rimeMoss"] as const)("%s fill is deterministic", (key) => {
    expect(floorFill(key, 2026).diff(floorFill(key, 2026))).toBe(0);
  });
});
```

- [ ] **Step 3: Run it.** `npx vitest run tests/pipeline/cliffs.test.ts -t "frozen biome floorFill"` → PASS. `npx tsc --noEmit` → exit 0.

- [ ] **Step 4: Commit.**

```bash
git add tools/pipeline/src/cliffs/terrains.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): floorFill recipes for snow/frozenLake/rimeMoss"
```

---

### Task 3: `ICE_CLIFF` all-pairs pairings + crisp seams

**Files:**
- Modify: `tools/pipeline/src/cliffs/presets.ts` (`ICE_CLIFF`: `edgeIrregularity` L~29, `pairings` L~36)
- Modify: `tests/pipeline/cliffs.test.ts` (ice count assertions)

**Interfaces:**
- Consumes: the three new `TerrainKey`s + ramps + fills (Tasks 1-2).
- Produces: `generateTerrain(ICE_PRESETS[0])` emits 7 pairing sets (`iceIce_`, `iceSnow_`, `iceFrozenLake_`, `iceRimeMoss_`, `snowFrozenLake_`, `snowRimeMoss_`, `frozenLakeRimeMoss_`, 47 each), 4 fills, total **559** named tiles.

- [ ] **Step 1: Crisp seam character.** In `ICE_CLIFF`, change `edgeIrregularity: 14,` to `edgeIrregularity: 6,` (crisp/faceted, per spec §7). Leave `edgeInset: 2` and `cornerRounding: 2` as-is (tight). Add a comment above them:

```ts
  // Floor blob edges — crisp/faceted default (low edgeIrregularity) to suit
  // glacial ice, distinct from reef's soft organic fingers. Starting values;
  // tuned live in the seam-rounding tuner at the review gate (Task 5).
```

- [ ] **Step 2: All-pairs pairings.** Replace `pairings: [{ over: "ice", base: "ice" }],` with:

```ts
  // All four frozen grounds autotile with each OTHER, not just ice-over-ice.
  // Priority ice < snow < frozenLake < rimeMoss; `over` = lower-priority field,
  // `base` = higher-priority ground carved in. Appended after ice-self so
  // existing tile order/indices are unchanged (additive). Flip a pair's
  // over/base to swap which ground owns that seam.
  pairings: [
    { over: "ice", base: "ice" },
    { over: "ice", base: "snow" },
    { over: "ice", base: "frozenLake" },
    { over: "ice", base: "rimeMoss" },
    { over: "snow", base: "frozenLake" },
    { over: "snow", base: "rimeMoss" },
    { over: "frozenLake", base: "rimeMoss" },
  ],
```

- [ ] **Step 3: Update the ice `generateTerrain` assertions.** In `tests/pipeline/cliffs.test.ts`, in the `it("ice preset emits its full parity set...")` test, replace the single `iceIce_` assertion block with all seven pairing counts and update the total, and rename the `it` title:

```ts
  it("ice preset emits its full parity set (4 grounds, all-pairs = 7 pairings), uniquely named", () => {
    const out = generateTerrain(ICE_PRESETS[0]).map((o) => o.name);
    expect(out.filter((n) => n.startsWith("cliffGlacier_")).length).toBe(15);
    expect(out.filter((n) => n.startsWith("icePlateau_")).length).toBe(47);
    expect(out.filter((n) => n.startsWith("iceIce_")).length).toBe(47);
    expect(out.filter((n) => n.startsWith("iceSnow_")).length).toBe(47);
    expect(out.filter((n) => n.startsWith("iceFrozenLake_")).length).toBe(47);
    expect(out.filter((n) => n.startsWith("iceRimeMoss_")).length).toBe(47);
    expect(out.filter((n) => n.startsWith("snowFrozenLake_")).length).toBe(47);
    expect(out.filter((n) => n.startsWith("snowRimeMoss_")).length).toBe(47);
    expect(out.filter((n) => n.startsWith("frozenLakeRimeMoss_")).length).toBe(47);
    expect(out.filter((n) => n === "iceFill").length).toBe(1);
    expect(out.filter((n) => n === "snowFill").length).toBe(1);
    expect(out.filter((n) => n === "frozenLakeFill").length).toBe(1);
    expect(out.filter((n) => n === "rimeMossFill").length).toBe(1);
    expect(out.filter((n) => n.startsWith("drampSand2657_")).length).toBe(28);
    expect(new Set(out).size).toBe(out.length);
    // 274 (1 pairing) + 6x47 pairings + 3 fills = 559.
    expect(out.length).toBe(559);
  });
```

- [ ] **Step 4: Update the sheet-structure count.** In the `it("cliffIce sheet is 16px frames padded to 8 columns, manifest-consistent")` test, change `expect(names.length).toBe(274);` to `expect(names.length).toBe(559); // 4 grounds, all-pairs`.

- [ ] **Step 5: Run it.** `npx vitest run tests/pipeline/cliffs.test.ts -t "ice preset emits"` → PASS. `npx tsc --noEmit` → exit 0. (Determinism will now fail — expected, fixed in Task 4.)

- [ ] **Step 6: Commit.**

```bash
git add tools/pipeline/src/cliffs/presets.ts tests/pipeline/cliffs.test.ts
git commit -m "feat(cliffs): ICE_CLIFF all-pairs pairings + crisp frozen seams"
```

---

### Task 4: Bake `cliffIce.png` + review scene (OWNER GATE)

**Files:**
- Modify: `tools/pipeline/render-cliff-review.mts` (add a frozen ground-transition demo block to the `ice` variant, biome-guarded)
- Generated: `src/assets/generated/cliffIce.png`, `src/assets/generated/manifest.json`

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: a regenerated `cliffIce.png` and a `.review/ice-transitions-crop.png` for owner sign-off.

- [ ] **Step 1: Add the ice transition demo.** In `render-cliff-review.mts`, mirror the reef step-9 block but guarded on the ice grounds and using `snow`/`frozenLake`/`rimeMoss` patches on the `ice` field. Add after the reef block:

```ts
  // Ice biome ground-transition demo — snow / frozenLake / rimeMoss patches in
  // the open ice field, each seam autotiled by the preset's ice<Base> pairings.
  // Biome-guarded: only the ice preset has these grounds.
  if (params.pairings.some((pr) => pr.base === "snow")) {
    type IcePatch = "snow" | "frozenLake" | "rimeMoss";
    const patches: { base: IcePatch; cells: [number, number][] }[] = [
      { base: "snow", cells: [[28,22],[29,22],[27,23],[28,23],[29,23],[30,23],[28,24],[29,24],[28,25]] },
      { base: "frozenLake", cells: [[36,23],[37,23],[38,23],[35,24],[36,24],[37,24],[38,24],[39,24],[36,25],[37,25],[38,25],[37,26]] },
      { base: "rimeMoss", cells: [[30,30],[31,30],[32,30],[29,31],[30,31],[31,31],[32,31],[33,31],[30,32],[31,32],[32,32],[31,33]] },
    ];
    const patchAt = new Map<string, IcePatch>();
    for (const p of patches) for (const [x, y] of p.cells) patchAt.set(`${x},${y}`, p.base);
    const patchOf = (x: number, y: number): IcePatch | undefined => patchAt.get(`${x},${y}`);
    for (const p of patches) { const fill = `${p.base}Fill`; for (const [x, y] of p.cells) blit(fill, x, y); }
    for (let y = 19; y <= 34; y++) for (let x = 24; x <= 40; x++) {
      if (patchOf(x, y)) continue;
      const nb = [patchOf(x,y-1),patchOf(x+1,y-1),patchOf(x+1,y),patchOf(x+1,y+1),patchOf(x,y+1),patchOf(x-1,y+1),patchOf(x-1,y),patchOf(x-1,y-1)];
      const base = nb.find((b): b is IcePatch => !!b);
      if (!base) continue;
      let m = 0;
      if (!patchOf(x,y-1)) m|=1; if (!patchOf(x+1,y-1)) m|=2; if (!patchOf(x+1,y)) m|=4; if (!patchOf(x+1,y+1)) m|=8;
      if (!patchOf(x,y+1)) m|=16; if (!patchOf(x-1,y+1)) m|=32; if (!patchOf(x-1,y)) m|=64; if (!patchOf(x-1,y-1)) m|=128;
      blit(`ice${cap(base)}_${canonical(m)}`, x, y);
    }
  }
```

- [ ] **Step 2: Regenerate assets.** `npm run art` → confirm output includes `wrote cliffIce.png`.

- [ ] **Step 3: Render the review scene.** `npx tsx tools/pipeline/render-cliff-review.mts` → produces `.review/ice-scene.png` (and the transition crop).

- [ ] **Step 4: OWNER REVIEW GATE.** Present the ice scene to the owner. The crisp seam values (`edgeIrregularity 6`) are provisional — the owner may tune them in the seam-rounding tuner artifact. If values change, apply them to `ICE_CLIFF` and re-run Steps 2-3. Do NOT proceed until the owner signs off on the frozen grounds + seams.

- [ ] **Step 5: Commit the demo + regenerated art (values may still change in Task 5).**

```bash
git add tools/pipeline/render-cliff-review.mts src/assets/generated/cliffIce.png src/assets/generated/manifest.json
git commit -m "feat(cliffs): bake frozen grounds into cliffIce + ice transition review demo"
```

---

### Task 5: Re-pin `cliffIce` + full verification

**Files:**
- Modify: `tests/pipeline/determinism.test.ts` (the `cliffIce` pin ~L452 + a comment block)

**Interfaces:**
- Consumes: the owner-approved `cliffIce.png` from Task 4.

- [ ] **Step 1: Get the new hash.** `npx vitest run tests/pipeline/determinism.test.ts -t "cliff.png encodes"` → it FAILS on `cliffIce`; copy the "Received" 64-char hash. Confirm `cliff` and `cliffReef` did NOT fail (they must stay byte-identical).

- [ ] **Step 2: Re-pin with a comment block.** In `determinism.test.ts`, above the `FROZEN` object add a comment noting: frozen biome expanded from 1 ground to 4 (snow/frozenLake/rimeMoss) all autotiling, +6 pairings +3 fills (274 → 559 tiles), crisp seams (edgeIrregularity 6); desert + reef byte-identical. Replace the `cliffIce` hash with the new value.

- [ ] **Step 3: Full verification.**

```bash
npx tsc --noEmit          # exit 0
npx vitest run            # all pass; cliff + cliffReef unchanged, cliffIce re-pinned
npm run build             # green
npm run smoke             # 8 passed (spine + 7 acts)
```

Expected: every check green.

- [ ] **Step 4: Commit.**

```bash
git add tests/pipeline/determinism.test.ts
git commit -m "test(cliffs): re-pin cliffIce for frozen multi-ground (desert/reef byte-identical)"
```

- [ ] **Step 5: Update memory.** Note in the project memory that the frozen biome now has 4 all-pairs grounds (extends `reef-transitions-two-systems`).

---

## Self-Review

- **Spec coverage:** §3 grounds/naming → Task 1. §4 ramps → Task 1. §5 floorFill → Task 2. §6 pairings/priority → Task 3. §7 crisp seams + tuning gate → Task 3 (values) + Task 4 (gate). §8 sheet/tests/re-pin → Tasks 3-5. §9 files → all match (no materials.ts/generate.ts/frames.ts/assets.ts changes needed). §10 verification → Task 5.
- **Placeholder scan:** all code steps show concrete code; hash filled at Task 5 Step 1 (can't be known before baking — that's a runtime value, not a placeholder).
- **Type consistency:** `IcePatch` type, `ice${cap(base)}_` names, `snowFill`/`frozenLakeFill`/`rimeMossFill`, 559 total — consistent across Tasks 3-4. Pairing names match generate.ts's `${over}${capitalize(base)}` convention.
