# Phase W1 — Wall Generator Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the raycast rock-wall generator from the concept prototype into the pipeline as pure, AAP-64-palette-locked, `h2`-deterministic TypeScript that renders a static wall face at the fixed prop view (az 0° / el 33°), with two rock recipes (strata + granite) tuned muted, and a standalone review-bake script. No game wiring.

**Architecture:** New `tools/pipeline/src/walls/` module. Faithful port of the working JS in `docs/prototypes/cliff-wall-raycast.html`, with three pipeline adaptations everywhere: (1) reuse the existing `h2` (`tools/pipeline/src/cliffs/noise.ts`) instead of redefining it; (2) reuse AAP-64 and emit `PaletteName`s (a wall renders to a `PixelGrid`, palette-locked like every other pipeline output); (3) fix the camera at az 0° / el 33°. Ramps, cap surfaces (grass/snow/sand), glacier and the other 9 styles are OUT of W1 scope.

**Tech Stack:** TypeScript, `tools/pipeline/src/` (pure, node-testable), `PixelGrid` (`tools/pipeline/src/grid.ts`), `encodePng` (`tools/pipeline/src/png.ts`), `tsx` bake scripts, Vitest.

## Global Constraints

- **Reference is authoritative for logic:** `docs/prototypes/cliff-wall-raycast.html`. Port faithfully; do not redesign the raycaster/shading. Cited line ranges are for that file.
- **Reuse, don't redefine:** `h2` from `tools/pipeline/src/cliffs/noise.ts`; the AAP-64 hex list from `tools/pipeline/src/palette/aap64.ts` (`AAP64`); `PixelGrid`; `encodePng`. Do NOT copy the prototype's own `h2`/`AAP`/`hx`.
- **Palette-lock:** the renderer emits only `PaletteName`s (AAP-64 = `CORE` in `src/shared/palette.ts`). Every AAP index maps to a `PaletteName` via an AAP-hex→CORE-name table (build it like `groundRamps.ts` does, lines 24-29).
- **Determinism:** only `h2` + `Math` (no `Math.random`/`Date`). A given `(recipe, params, seed)` renders identical bytes build-to-build. Runtime-style output — NOT sha-pinned in `determinism.test.ts`; verified by golden-determinism + palette-conformance unit tests instead.
- **Muted art direction (owner):** cliffs read a shade too bright in the prototype. Port with **lowered lambert windows** (details in Task 2) — final tuning happens at the review-bake gate.
- **Fixed camera:** az 0° / el 33° (the prop view). `PPU = 16`.
- **Scope W1:** two coursed recipes (strata, granite), core wall (recess + courses + crest cap + talus + block-tops), review bake. No ramps, no cap surfaces, no glacier/other styles.
- **Git:** branch `claude/runtime-walls`; PR → `main` with a regular merge commit. Commit footers end with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Kji7iDdsHmjhHj3oMyRLk6
  ```

## File Structure

- `tools/pipeline/src/walls/raymath.ts` — camera frame (fixed 0°/33°), projection, light, vector helpers.
- `tools/pipeline/src/walls/primitives.ts` — solid primitives + `aabb` + `trace` (ray intersection).
- `tools/pipeline/src/walls/wallMaterials.ts` — `MAT` (ramp + lambert window), AAP-index→`PaletteName` mapping, muted windows.
- `tools/pipeline/src/walls/wallStyles.ts` — `strata` + `granite` recipes, `shapedSlab` (block tops), `crestOff` (crest profiles).
- `tools/pipeline/src/walls/buildWall.ts` — assemble primitives (recess + courses + lean + crest cap + talus).
- `tools/pipeline/src/walls/renderWall.ts` — raycast + AO + shade + palette-snap → `PixelGrid`.
- `tools/pipeline/src/walls/bakeWallReview.mts` — tsx review-bake script → PNG.
- Tests under `tests/pipeline/walls/`.

---

### Task 1: Ray math + primitives + trace

The geometric core: camera frame, projection, the solid primitives, and ray intersection.

**Files:**
- Create: `tools/pipeline/src/walls/raymath.ts`, `tools/pipeline/src/walls/primitives.ts`
- Test: `tests/pipeline/walls/primitives.test.ts`

**Interfaces:**
- Produces: `PPU`, `projX(P)`, `projY(P)`, `DIR`, `RX`, `UY`, `L`, `LM`, `nrm/crs/dt` (raymath); `Solid` union type, `box/ell/obb/eol/slab/ovalY/ovalZ`, `aabb(p): [lo,hi]`, `trace(p, O): {t, n} | null` (primitives).

- [ ] **Step 1: Write the failing test**

Create `tests/pipeline/walls/primitives.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { box, ell, aabb, trace } from "../../../tools/pipeline/src/walls/primitives";
import { DIR } from "../../../tools/pipeline/src/walls/raymath";

describe("primitives", () => {
  it("aabb of a box is its lo/hi", () => {
    expect(aabb(box([0, 0, 0], [2, 3, 4], { R: [], lo: 0, hi: 1 }))).toEqual([[0, 0, 0], [2, 3, 4]]);
  });
  it("a ray straight down -Z hits a box in front of it and returns a normal", () => {
    // DIR at 0/33 has +z; place origin in front (negative z) aiming through the box.
    const b = box([-1, -1, -1], [1, 1, 1], { R: [], lo: 0, hi: 1 });
    const O = [0, 0, -10];
    const h = trace(b, O);
    expect(h).not.toBeNull();
    expect(Math.hypot(h!.n[0], h!.n[1], h!.n[2])).toBeCloseTo(1, 5); // unit normal
  });
  it("a ray that misses returns null", () => {
    expect(trace(ell([100, 100, 0], 0.2, { R: [], lo: 0, hi: 1 }), [0, 0, -10])).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/pipeline/walls/primitives.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Port `raymath.ts`**

Port from the prototype: `RAD` (140), `setView`/frame (162-171) but FIXED at az 0 / el 33 (compute `RX/UY/DIR` once), `L`/`LM` (172), `PPU=16` (173), `projX`/`projY` (174-175), and `nrm`/`crs`/`dt` (188-190). Export them. No az/el params — hardcode the prop view. Type vectors as `[number, number, number]` (alias `Vec3`).

- [ ] **Step 4: Port `primitives.ts`**

Port the primitive constructors `box`/`ell`/`obb`/`eol`/`ovalY`/`ovalZ`/`slab` (177-199), `aabb` (200-209), and `trace` (210-250) verbatim in logic, adding TS types. Define `Material = { R: string[]; lo: number; hi: number }` (the `m` field; `R` is a ramp of AAP hex strings — Task 2 supplies real ones) and a `Solid` union (`{t:'box'|'ell'|'obb'|'eol', ...}`). `trace` uses `DIR` from raymath. Keep `ro` (roughness) on each solid.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/pipeline/walls/primitives.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` (clean). Commit:
```bash
git add tools/pipeline/src/walls/raymath.ts tools/pipeline/src/walls/primitives.ts tests/pipeline/walls/primitives.test.ts
git commit -m "feat(w1): wall ray math + solid primitives + trace"
```

---

### Task 2: Materials + AAP-64→PaletteName mapping (muted)

`MAT` (ramp + lambert window) and the mapping that keeps wall output palette-locked, with the muted windows.

**Files:**
- Create: `tools/pipeline/src/walls/wallMaterials.ts`
- Test: `tests/pipeline/walls/wallMaterials.test.ts`

**Interfaces:**
- Consumes: `AAP64` (`tools/pipeline/src/palette/aap64.ts`), `CORE`/`PaletteName` (`src/shared/palette.ts`).
- Produces: `MAT(ix: number[], lo: number, hi: number): Material` (ramp = AAP hexes at indices `ix`); `aapIndexToName(i: number): PaletteName`; `hexToName(hex: string): PaletteName`; the muted default window `WALL_WIN`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from "vitest";
import { MAT, aapIndexToName, WALL_WIN } from "../../../tools/pipeline/src/walls/wallMaterials";
import { PALETTE } from "../../../src/shared/palette";

describe("wallMaterials", () => {
  it("every AAP index maps to a real PaletteName", () => {
    for (let i = 0; i < 64; i++) expect(PALETTE).toHaveProperty(aapIndexToName(i));
  });
  it("MAT carries the ramp hexes + window", () => {
    const m = MAT([31, 32, 63], 0.1, 0.5);
    expect(m.R.length).toBe(3);
    expect(m.lo).toBe(0.1); expect(m.hi).toBe(0.5);
  });
  it("the muted default window sits lower than the prototype's 0.11-0.53", () => {
    expect(WALL_WIN[0]).toBeLessThanOrEqual(0.11);
    expect(WALL_WIN[1]).toBeLessThanOrEqual(0.50);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/pipeline/walls/wallMaterials.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `wallMaterials.ts`**

```ts
import { AAP64 } from "../palette/aap64";
import { CORE, hexToRgb, type PaletteName } from "../../../../src/shared/palette";
import type { Material } from "./primitives";

/** AAP-64 hex (lowercased) → CORE PaletteName. CORE holds exactly the 64 AAP-64 hexes. */
const HEX_TO_NAME: Record<string, PaletteName> = (() => {
  const m: Record<string, PaletteName> = {};
  for (const name of Object.keys(CORE) as PaletteName[]) m[CORE[name].toLowerCase()] = name;
  return m;
})();
export const hexToName = (hex: string): PaletteName => HEX_TO_NAME[hex.toLowerCase()];
export const aapIndexToName = (i: number): PaletteName => hexToName(AAP64[i]);

/** Muted default lambert window (owner: prototype cliffs read too bright). A near-vertical
 *  face catches ~0.24-0.50 lambert; a lower window keeps lit faces off the ramp's brightest
 *  entries. Per-recipe overrides may narrow this further. */
export const WALL_WIN: [number, number] = [0.06, 0.44];

/** A material = its AAP-64 ramp (hex strings, light->dark) spread across a lambert window. */
export const MAT = (ix: number[], lo: number, hi: number): Material => ({
  R: ix.map((i) => AAP64[i]), lo, hi,
});
```
Note: `hexToRgb` import is available if needed; `Material.R` stays hex strings (the renderer snaps to a `PaletteName` via `hexToName`).

- [ ] **Step 4: Run the test → PASS.** `npx vitest run tests/pipeline/walls/wallMaterials.test.ts`

- [ ] **Step 5: Typecheck + commit**
```bash
git add tools/pipeline/src/walls/wallMaterials.ts tests/pipeline/walls/wallMaterials.test.ts
git commit -m "feat(w1): wall materials + AAP-64->PaletteName mapping (muted windows)"
```

---

### Task 3: Rock recipes (strata + granite) + block-tops + crest

Port two coursed styles and their helpers.

**Files:**
- Create: `tools/pipeline/src/walls/wallStyles.ts`
- Test: `tests/pipeline/walls/wallStyles.test.ts`

**Interfaces:**
- Consumes: `h2` (`../cliffs/noise`), `MAT`/`WALL_WIN` (`./wallMaterials`), the primitives + `slab` (`./primitives`).
- Produces: `STYLES` (record with `strata`, `granite`), `shapedSlab(...)`, `crestOff(kind, x, W, amt)`. Each style: `{ name, face, recess, cap, talus, crest, top, course(P, y0, y1, W, o) }` where `face/recess/cap/talus` are AAP index arrays and `course` pushes `Solid`s into `P`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from "vitest";
import { STYLES, crestOff } from "../../../tools/pipeline/src/walls/wallStyles";

describe("wallStyles", () => {
  it("has strata + granite recipes with 7-entry face ramps", () => {
    for (const k of ["strata", "granite"] as const) {
      expect(STYLES[k].face.length).toBeGreaterThanOrEqual(6);
      expect(typeof STYLES[k].course).toBe("function");
    }
  });
  it("a course pushes solids deterministically", () => {
    const o = { bw: 0.48, relief: 0.25, frac: 0.4, irr: 0.55, face: { R: [], lo: 0, hi: 1 }, top: "flat" as const };
    const a: any[] = [], b: any[] = [];
    STYLES.strata.course(a, 0, 0.4, 8, o);
    STYLES.strata.course(b, 0, 0.4, 8, o);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBe(b.length); // deterministic
  });
  it("crestOff returns 0 for a flat crest and rises for domed", () => {
    expect(crestOff("flat", 4, 8, 1)).toBe(0);
    expect(crestOff("domed", 4, 8, 1)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** `npx vitest run tests/pipeline/walls/wallStyles.test.ts` → FAIL.

- [ ] **Step 3: Port `wallStyles.ts`**

Port `shapedSlab` (706-740) and `crestOff`/`CRESTS` (742-763) verbatim (add types; `h2` from `../cliffs/noise`; `slab`/`box`/`ell` from `./primitives`). Port `STYLES.strata` (266-287) and `STYLES.granite` (288-311) with their `face/recess/cap/talus/crest/top` fields and `course` functions. Type `o` as `WallOpts` (`{ bw, relief, frac, irr, face: Material, top: string }`). Do NOT port the other 9 styles. The `MAT`/`WALL_WIN` import supplies materials where the prototype built them inline; the RECESS/TALUS/CAP materials are built in Task 4's `buildWall`, so the style objects only carry the index arrays (as in the prototype).

- [ ] **Step 4: Run the test → PASS.**

- [ ] **Step 5: Typecheck + commit**
```bash
git add tools/pipeline/src/walls/wallStyles.ts tests/pipeline/walls/wallStyles.test.ts
git commit -m "feat(w1): strata + granite rock recipes, block-tops, crest profiles"
```

---

### Task 4: `buildWall` — assemble the solids

Assemble the wall's primitive list (no ramp, no cap surface).

**Files:**
- Create: `tools/pipeline/src/walls/buildWall.ts`
- Test: `tests/pipeline/walls/buildWall.test.ts`

**Interfaces:**
- Consumes: `STYLES` (`./wallStyles`), `MAT`/`WALL_WIN` (`./wallMaterials`), `box`/`crestOff`, `h2`.
- Produces: `buildWall(params: WallParams): { P: Solid[]; W: number; H: number; capTop: number }` where `WallParams = { style, W, H, ch, bw, relief, frac, irr, batter, talus, crest, crestAmt, top, seed }`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from "vitest";
import { buildWall } from "../../../tools/pipeline/src/walls/buildWall";

const P0 = { style: "strata" as const, W: 8, H: 5, ch: 0.34, bw: 0.48, relief: 0.45,
  frac: 0.4, irr: 0.55, batter: 0.15, talus: 0.45, crest: "flat" as const, crestAmt: 0.55, top: "auto" as const, seed: 11 };

describe("buildWall", () => {
  it("returns a non-empty primitive list including the recess plane", () => {
    const { P } = buildWall(P0);
    expect(P.length).toBeGreaterThan(5);
    expect(P[0].t).toBe("box"); // recess plane pushed first
  });
  it("is deterministic for the same params/seed", () => {
    expect(buildWall(P0).P.length).toBe(buildWall(P0).P.length);
  });
  it("more talus => more solids", () => {
    expect(buildWall({ ...P0, talus: 0.9 }).P.length).toBeGreaterThan(buildWall({ ...P0, talus: 0 }).P.length);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** → FAIL.

- [ ] **Step 3: Implement `buildWall.ts`**

Port `buildWall()` (765-1045) but **omit the ramp block (816-990)** and **the cap-surface block (1004-1031)** — W1 is bare rock. Keep: `o` params object (769-772) sourced from `WallParams` (not DOM `$()`); RECESS/TALUS/CAPM materials via `MAT(S.recess/…, …)` (773-774); `batter`/`applyLean` (775, 781-788); the recess plane (778); the course loop (793-804) or `S.build` if `S.whole` (skip — no whole styles in W1); `capTop`/`zCapF`/`crestKind`/`crestY` (805-811); the cap columns (992-1003); and talus (1032-1043). Replace every `+$('id').value` with the matching `WallParams` field. Return `{ P, W, H, capTop }`.

- [ ] **Step 4: Run the test → PASS.**

- [ ] **Step 5: Typecheck + commit**
```bash
git add tools/pipeline/src/walls/buildWall.ts tests/pipeline/walls/buildWall.test.ts
git commit -m "feat(w1): buildWall — assemble recess + courses + crest cap + talus"
```

---

### Task 5: `renderWall` — raycast + AO + shade → PixelGrid

The renderer: cast a ray per pixel, occlusion pass, banded/dithered shading snapped to `PaletteName`. This is the crux; port carefully.

**Files:**
- Create: `tools/pipeline/src/walls/renderWall.ts`
- Test: `tests/pipeline/walls/renderWall.test.ts`

**Interfaces:**
- Consumes: `buildWall` output, `projX`/`projY`/`DIR`/`RX`/`UY`/`L`/`LM`/`PPU` (raymath), `aabb`/`trace` (primitives), `h2` (`../cliffs/noise`), `hexToName` (`./wallMaterials`), `PixelGrid` (`../grid`), `BAYER`.
- Produces: `renderWall(params: WallParams, opts?: { bands?: number; dith?: number; ao?: number }): PixelGrid` — palette-name cells; `null` where no solid was hit (transparent).

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from "vitest";
import { renderWall } from "../../../tools/pipeline/src/walls/renderWall";
import { PALETTE } from "../../../src/shared/palette";

const P0 = { style: "strata" as const, W: 8, H: 5, ch: 0.34, bw: 0.48, relief: 0.45,
  frac: 0.4, irr: 0.55, batter: 0.15, talus: 0.45, crest: "flat" as const, crestAmt: 0.55, top: "auto" as const, seed: 11 };

describe("renderWall", () => {
  it("renders a palette-locked, non-trivial grid", () => {
    const g = renderWall(P0);
    expect(g.width).toBeGreaterThan(40);
    let opaque = 0; const seen = new Set<string>();
    g.forEach((_x, _y, c) => { if (c !== null) { opaque++; expect(PALETTE).toHaveProperty(c); seen.add(c); } });
    expect(opaque).toBeGreaterThan(200);   // real rock, not empty
    expect(seen.size).toBeGreaterThan(3);  // shaded, multiple tones
  });
  it("is deterministic", () => {
    expect(renderWall(P0).diff(renderWall(P0))).toBe(0);
  });
  it("granite renders too", () => {
    expect(renderWall({ ...P0, style: "granite" }).width).toBeGreaterThan(40);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** → FAIL.

- [ ] **Step 3: Implement `renderWall.ts`**

Port `renderWall()` (1047-1118) faithfully, with these adaptations:
- `buildWall` comes from Task 4 (`const { P, W, H } = buildWall(params)`), not the DOM.
- `bands`/`dith`/`ao` from `opts` (defaults: `bands: 6`, `dith: 0.30`, `ao: 0.50` — the prototype defaults).
- The projected-bounds pass (1052-1061), the per-pixel raycast (1063-1076: ray origin `O` from `RX`/`UY`, nearest hit by `h.t>best.t`, record `mid`/`dep`/`lam`), and the AO pass (1078-1088) port verbatim.
- Shading (1089-1100): compute `v` from lambert-window `t`, `+ h2(...)`-noise (reuse `h2`), `+ Bayer`, `- ao`, quantize to `bands`, index the material ramp `R` — but instead of writing RGB to an `img` array, **snap the chosen hex to a `PaletteName` via `hexToName(R[idx])` and `grid.px(x, y, name)`**. Where `mid[i] < 0`, leave the cell `null` (transparent).
- Skip the silhouette-outline block (1101-1112) and the canvas plumbing (1113-1117) — return the `PixelGrid`. (Outline is optional; defer.)
- Return a `new PixelGrid(CW, CH)` filled per the above.

- [ ] **Step 4: Run the test → PASS.** `npx vitest run tests/pipeline/walls/renderWall.test.ts`

- [ ] **Step 5: Typecheck + commit**
```bash
git add tools/pipeline/src/walls/renderWall.ts tests/pipeline/walls/renderWall.test.ts
git commit -m "feat(w1): renderWall — raycast + occlusion + banded shade to a palette-locked PixelGrid"
```

---

### Task 6: Review-bake script

A `tsx` script that renders strata + granite walls to PNGs for the owner's visual gate.

**Files:**
- Create: `tools/pipeline/src/walls/bakeWallReview.mts`

**Interfaces:**
- Consumes: `renderWall` (`./renderWall`), `encodePng` (`../png`).

- [ ] **Step 1: Write the script**
```ts
/** Review bake: render the W1 rock recipes to PNGs for visual review. Run:
 *    npx tsx tools/pipeline/src/walls/bakeWallReview.mts <outDir>
 *  Not a test — an authoring aid. */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderWall } from "./renderWall";
import { encodePng } from "../png";

const base = { W: 9, H: 5, ch: 0.34, bw: 0.48, relief: 0.45, frac: 0.4, irr: 0.55,
  batter: 0.15, talus: 0.45, crest: "auto" as const, crestAmt: 0.55, top: "auto" as const, seed: 11 };
const outDir = process.argv[2] ?? "tools/pipeline/.bake";
mkdirSync(outDir, { recursive: true });
for (const style of ["strata", "granite"] as const) {
  const g = renderWall({ ...base, style });
  writeFileSync(`${outDir}/wall-${style}.png`, encodePng(g));
  console.log(`wrote ${outDir}/wall-${style}.png (${g.width}x${g.height})`);
}
```

- [ ] **Step 2: Run the bake**

Run: `npx tsx tools/pipeline/src/walls/bakeWallReview.mts tools/pipeline/.bake`
Expected: prints two `wrote …` lines; both PNGs exist and are non-empty. (Controller Reads them for the visual gate + muted-tuning pass.)

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (clean). Commit (script only; `.bake/` PNGs stay untracked):
```bash
git add tools/pipeline/src/walls/bakeWallReview.mts
git commit -m "feat(w1): wall review-bake script (strata + granite -> PNG)"
```

*(Controller step: Read the PNGs; run the muted-tuning loop with the owner — adjust `WALL_WIN` / per-recipe windows / ramps in Task 2-3 files until the owner approves the look — before W1 is done.)*

---

## Self-Review

- **Spec coverage:** design-of-record §2 (raycast solids, real-occlusion cracks, AAP-64/`h2`, prop angle) → Tasks 1-5; §8 muted art → Task 2 `WALL_WIN` + Task 6 tuning; §10 W1 scope (2 recipes, core wall, review bake, no ramps/wiring) → all tasks. Covered.
- **Placeholder scan:** logic lives in the committed prototype (cited by line range); adaptation code (h2/AAP reuse, PixelGrid output, muted windows) is given inline. No hand-waving.
- **Type consistency:** `Material` defined in Task 1 (`primitives.ts`), consumed by `MAT` (Task 2) and the renderer (Task 5); `WallParams` shape identical across Tasks 4-6; `Solid` union from Task 1 used throughout; `hexToName`/`aapIndexToName` (Task 2) used by the renderer (Task 5).
- **Determinism/no-repin:** only `h2` + `Math`; output is a runtime-style `PixelGrid`, NOT added to `determinism.test.ts`.
