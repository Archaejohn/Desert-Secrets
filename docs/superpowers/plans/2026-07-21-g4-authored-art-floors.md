# G4 — Authored Art Floors (Sun-Temple) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first *authored* ground fill (`templeSlab` — a structured slab lattice) plus a feature-placement pass (sun emblem, shattered slab), and wire the Act 3 Sun-Temple onto the runtime composite so it renders live.

**Architecture:** `templeSlab` slots into the existing world-position fill system (a new `TerrainKey` + ramp + `fill()` case + `GROUND_PRIORITY` entry). Features are a composite-time overlay (`paintFeatures`) that mutates the composited `PixelGrid` and marks painted pixels crisp via the `shadow` channel. `CompositeGroundView` applies features after compositing; `SunTempleScene` opts in via `ZoneConfig.compositeGround.features`.

**Tech Stack:** TypeScript, the `tools/pipeline/src/ground/` module (`fills.ts`, `composite.ts`, `groundRamps.ts`, new `features.ts`), Phaser runtime (`src/game/gfx/CompositeGroundView.ts`, `src/game/ZoneScene.ts`), Vitest, Playwright smoke, `tsx` bake scripts.

## Global Constraints

- **Palette-lock:** every `templeSlab` fill pixel is a `PaletteName` in `GROUND_RAMPS.templeSlab ∪ {"skyBlue"}` (the single off-ramp sheen accent). Feature pixels are `PaletteName`s (`amber`, `sandLight`, `indigo`, `ink`).
- **Ramp (light→dark):** `templeSlab: ["mauve", "plum", "indigo", "ink"]`. Roles: `P[0]` mauve = lit lip, `P[1]` plum = slab body, `P[2]` indigo = grout / shaded edge, `P[3]` ink = crack core. `R = GROUND_RAMPS.templeSlab`, `P = GROUND_ID_POS.templeSlab`.
- **Deterministic + world-position:** only `h2`/`ridged`/`striate`/`worldNoise`; no randomness, no time. Fill reads absolute world coords.
- **Additive only:** append `"templeSlab"` to the `TerrainKey` union, `TERRAIN_RAMPS`, and `ORDER` — never reorder existing entries. No baked sheet is re-pinned (the composite is not a pinned sheet; `determinism.test.ts` is untouched).
- **Slab lattice:** 3×2-tile blocks = **48×32 px**, on the absolute world grid.
- **Verification bar before done:** `tsc --noEmit`, `vitest run`, `npm run build`, `npm run smoke`, `npm run smoke:touch`.
- **Git:** work on `claude/ground-compositing-g4`; PR → `main` with a regular merge commit. Commit footers end with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Kji7iDdsHmjhHj3oMyRLk6
  ```

---

### Task 1: Register `templeSlab` (key + ramp + priority + minimal fill)

Wire the new terrain through every slot it must occupy, with a minimal working fill so the build/switch stay green. The art comes in Task 2.

**Files:**
- Modify: `tools/pipeline/src/cliffs/palette.ts` (TerrainKey union ~L42-61; TERRAIN_RAMPS ~L95)
- Modify: `tools/pipeline/src/ground/composite.ts` (ORDER ~L10-16)
- Modify: `tools/pipeline/src/ground/fills.ts` (fill switch — add case before `default`)
- Test: `tests/pipeline/ground/templeSlab.test.ts` (new)

**Interfaces:**
- Consumes: `GROUND_RAMPS`/`GROUND_ID_POS` (auto-built from `TERRAIN_RAMPS`), `GROUND_PRIORITY` (auto-built from `ORDER`).
- Produces: `TerrainKey` now includes `"templeSlab"`; `fill("templeSlab", wx, wy): PaletteName`; `GROUND_PRIORITY.templeSlab > GROUND_PRIORITY.reefSilt`.

- [ ] **Step 1: Write the failing test**

Create `tests/pipeline/ground/templeSlab.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";
import { GROUND_PRIORITY } from "../../../tools/pipeline/src/ground/composite";
import { GROUND_RAMPS } from "../../../tools/pipeline/src/ground/groundRamps";
import { fill } from "../../../tools/pipeline/src/ground/fills";
import { PALETTE } from "../../../src/shared/palette";

describe("templeSlab registration", () => {
  it("has a 4-entry ramp of mauve→plum→indigo→ink", () => {
    expect(TERRAIN_RAMPS.templeSlab).toEqual(["mauve", "plum", "indigo", "ink"]);
  });
  it("outranks reefSilt so the stone floor owns the seam", () => {
    expect(GROUND_PRIORITY.templeSlab).toBeGreaterThan(GROUND_PRIORITY.reefSilt);
  });
  it("fills palette-locked to its ramp ∪ {skyBlue}, deterministic", () => {
    const allowed = new Set<string>([...GROUND_RAMPS.templeSlab, "skyBlue"]);
    for (let wy = 0; wy < 40; wy++) for (let wx = 0; wx < 60; wx++) {
      const c = fill("templeSlab", wx, wy);
      expect(PALETTE).toHaveProperty(c);
      expect(allowed.has(c)).toBe(true);
      expect(fill("templeSlab", wx, wy)).toBe(c); // deterministic
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/pipeline/ground/templeSlab.test.ts`
Expected: FAIL — `templeSlab` not in `TERRAIN_RAMPS`/`GROUND_PRIORITY`; `fill` throws `unknown terrain`.

- [ ] **Step 3: Add the terrain key + ramp**

In `tools/pipeline/src/cliffs/palette.ts`, append to the `TerrainKey` union (after `"groveSoil"`):
```ts
  | "groveSoil"
  | "templeSlab";
```
And append to `TERRAIN_RAMPS` (after the `groveSoil` entry, before the closing `}`):
```ts
  // Submerged sun-temple flagstones (authored slab floor). Light→dark:
  // lit slab lip, plum body, indigo grout/shade, ink crack core.
  templeSlab: ["mauve", "plum", "indigo", "ink"],
```

- [ ] **Step 4: Add the priority entry**

In `tools/pipeline/src/ground/composite.ts`, append `"templeSlab"` to the END of `ORDER` (highest priority; it only ever meets `reefSilt`, and higher = owns the seam). This preserves every existing zone's *relative* terrain order, so their composites are byte-identical:
```ts
  "groveGrass", "groveMoss", "groveWater", "groveSoil",
  "templeSlab",
];
```

- [ ] **Step 5: Add a minimal `fill()` case**

In `tools/pipeline/src/ground/fills.ts`, add before `default:` in the `switch`:
```ts
    // ---- AUTHORED SLAB (temple flagstones) — filled out in Task 2 -------
    case "templeSlab": {
      idx = ditherRamp(0.5, wx, wy, seed + 17, P[1], P[2]); // placeholder plum↔indigo body
      break;
    }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/pipeline/ground/templeSlab.test.ts`
Expected: PASS (all three).

- [ ] **Step 7: Confirm no existing test regressed (priority/ramp invariants)**

Run: `npx vitest run tests/pipeline/ground/composite.test.ts tests/pipeline/cliffs.test.ts`
Expected: PASS — the distinct-priority + count invariant (`composite.test.ts`) and the "every terrain fill palette-locked" + 4-entry-ramp loops (`cliffs.test.ts`) now cover `templeSlab` and stay green.

- [ ] **Step 8: Commit**

```bash
git add tools/pipeline/src/cliffs/palette.ts tools/pipeline/src/ground/composite.ts tools/pipeline/src/ground/fills.ts tests/pipeline/ground/templeSlab.test.ts
git commit -m "feat(g4): register templeSlab terrain (key + ramp + priority + minimal fill)"
```

---

### Task 2: Author the `templeSlab` slab-lattice fill

Replace the placeholder with the full authored structure: slab lattice, per-slab body tone, per-slab light shading, grout, cracks/wear, and a faint water sheen.

**Files:**
- Modify: `tools/pipeline/src/ground/fills.ts` (the `case "templeSlab"` from Task 1)
- Test: `tests/pipeline/ground/templeSlab.test.ts` (extend)

**Interfaces:**
- Consumes: `h2`, `ridged`, `striate` (already imported in `fills.ts`), `clampIdx` (local), `R`/`P`/`seed`/`ix`/`iy` (in scope).
- Produces: `fill("templeSlab", …)` renders the authored slab field.

- [ ] **Step 1: Write the failing structural tests**

Extend `tests/pipeline/ground/templeSlab.test.ts`:
```ts
import { fillField } from "../../../tools/pipeline/src/ground/fills";

describe("templeSlab authored structure", () => {
  it("is not a 16px stamp: two tiles within one 48px block differ", () => {
    const a = fillField("templeSlab", 0, 0, 16, 16);
    const b = fillField("templeSlab", 16, 0, 16, 16);
    expect(a.diff(b)).toBeGreaterThan(0);
  });
  it("varies block to block (per-slab tone / cracks): adjacent blocks differ", () => {
    const a = fillField("templeSlab", 0, 0, 48, 32);
    const b = fillField("templeSlab", 48, 0, 48, 32);
    expect(a.diff(b)).toBeGreaterThan(0);
  });
  it("draws a dark grout joint along block boundaries", () => {
    // Column wx=0 (block left edge) is grout (indigo/ink); an interior column is not.
    const grout = fill("templeSlab", 0, 10);
    const interior = fill("templeSlab", 24, 16);
    expect(["indigo", "ink"]).toContain(grout);
    expect(["indigo", "ink"]).not.toContain(interior);
  });
});
```

- [ ] **Step 2: Run to confirm the new tests fail**

Run: `npx vitest run tests/pipeline/ground/templeSlab.test.ts`
Expected: the grout test FAILS (placeholder has no grout); the two variation tests may pass or fail — they must all pass after Step 3.

- [ ] **Step 3: Implement the authored fill**

Replace the `case "templeSlab"` body in `tools/pipeline/src/ground/fills.ts` with:
```ts
    // ---- AUTHORED SLAB (submerged temple flagstones) ---------------------
    // 3x2-tile (48x32) slab lattice on the world grid: per-slab flat body tone,
    // per-slab shading off a top-left light (lit lip + far-edge shade), dark grout
    // joints at block boundaries, a ridged crack network, sparse wear, and a faint
    // near-horizontal skyBlue water sheen (the one off-ramp accent).
    case "templeSlab": {
      const BW = 48, BH = 32;
      const bx = Math.floor(wx / BW), by = Math.floor(wy / BH);
      const lx = wx - bx * BW, ly = wy - by * BH;   // 0..BW-1 / 0..BH-1
      // per-slab flat body tone: small deterministic step around plum P[1].
      const tone = h2(bx, by, seed);
      let i = P[1];
      if (tone > 0.70) i = clampIdx(P[1] + 1, R.length);
      else if (tone < 0.30) i = clampIdx(P[1] - 1, R.length);
      // per-slab shading off a top-left light.
      if (lx < 2 || ly < 2) i = P[0];               // lit lip (mauve) inside top/left
      if (lx >= BW - 1 || ly >= BH - 1) i = P[2];   // shaded far edge (indigo)
      // grout joints along block boundaries (override the lit lip so joints stay dark).
      if (lx === 0 || ly === 0) i = (lx === 0 && ly === 0) ? P[3] : P[2];
      // crack network crossing slabs: creases settle to indigo, rare ink cores.
      const r = ridged(wx, wy, seed + 5);
      if (r > 0.90) i = P[2];
      if (r > 0.965 && h2(ix, iy, seed + 47) > 0.5) i = P[3];
      // rare wear fleck toward the lit tone.
      if (h2(ix, iy, seed + 71) > 0.985) i = P[0];
      // faint water sheen: sparse near-horizontal skyBlue glint (off-ramp accent).
      const sheen = striate(wx, wy, Math.PI / 2, 0.10, 3.0, seed + 11);
      if (sheen > 0.965) return "skyBlue";
      idx = i;
      break;
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/pipeline/ground/templeSlab.test.ts`
Expected: PASS (registration + structure + palette-lock incl. the `skyBlue` sheen).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add tools/pipeline/src/ground/fills.ts tests/pipeline/ground/templeSlab.test.ts
git commit -m "feat(g4): author templeSlab slab-lattice fill (grout, per-slab light, cracks, sheen)"
```

---

### Task 3: `paintFeatures` module (sun emblem + shattered slab)

A composite-time overlay that mutates the composited grid at tile positions and marks painted pixels crisp via the `shadow` channel.

**Files:**
- Create: `tools/pipeline/src/ground/features.ts`
- Test: `tests/pipeline/ground/features.test.ts` (new)

**Interfaces:**
- Consumes: `PixelGrid` (`../grid`), `PaletteName` (`src/shared/palette`).
- Produces: `GroundFeature` type; `paintFeatures(grid, terrainId, shadow, features, gridWidth): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/pipeline/ground/features.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PixelGrid } from "../../../tools/pipeline/src/grid";
import { paintFeatures, type GroundFeature } from "../../../tools/pipeline/src/ground/features";

function blank(wTiles: number, hTiles: number) {
  const W = wTiles * 16, H = hTiles * 16;
  const grid = new PixelGrid(W, H);
  grid.forEach((x, y) => grid.px(x, y, "plum"));
  return { grid, terrainId: new Uint8Array(W * H), shadow: new Uint8Array(W * H), W, H };
}

describe("paintFeatures", () => {
  it("sunEmblem paints amber near its tile center and marks it crisp", () => {
    const { grid, terrainId, shadow, W } = blank(3, 3);
    const feats: GroundFeature[] = [{ kind: "sunEmblem", tx: 1, ty: 1 }];
    paintFeatures(grid, terrainId, shadow, feats, W);
    const cx = 1 * 16 + 8, cy = 1 * 16 + 8;
    expect(grid.get(cx, cy)).toBe("amber");
    expect(shadow[cy * W + cx]).toBe(1);
  });
  it("shatter paints ink fissures", () => {
    const { grid, terrainId, shadow, W } = blank(3, 3);
    paintFeatures(grid, terrainId, shadow, [{ kind: "shatter", tx: 1, ty: 1, seed: 3 }], W);
    let inks = 0;
    grid.forEach((_x, _y, c) => { if (c === "ink") inks++; });
    expect(inks).toBeGreaterThan(0);
  });
  it("leaves pixels outside features untouched", () => {
    const { grid, terrainId, shadow, W } = blank(3, 3);
    paintFeatures(grid, terrainId, shadow, [{ kind: "sunEmblem", tx: 1, ty: 1 }], W);
    expect(grid.get(0, 0)).toBe("plum");
    expect(shadow[0]).toBe(0);
  });
  it("is deterministic", () => {
    const a = blank(3, 3), b = blank(3, 3);
    const f: GroundFeature[] = [{ kind: "shatter", tx: 1, ty: 1, seed: 9 }];
    paintFeatures(a.grid, a.terrainId, a.shadow, f, a.W);
    paintFeatures(b.grid, b.terrainId, b.shadow, f, b.W);
    expect(a.grid.diff(b.grid)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run tests/pipeline/ground/features.test.ts`
Expected: FAIL — module `features.ts` does not exist.

- [ ] **Step 3: Implement `features.ts`**

Create `tools/pipeline/src/ground/features.ts`:
```ts
/**
 * Authored ground FEATURES: art placed at exact tile positions on top of a
 * composited ground grid (the megalith temple's sun emblem, a shattered slab).
 * Mutates the grid in the PixelGrid/palette-name domain and marks every painted
 * pixel in `shadow` (=1) so the runtime `maskedBlur` leaves features crisp
 * (blur passes shadow pixels through and never averages across them).
 * Deterministic (`h2` only).
 */
import { PixelGrid } from "../grid";
import { h2 } from "../cliffs/noise";
import type { PaletteName } from "../../../../src/shared/palette";

export type GroundFeature =
  | { kind: "sunEmblem"; tx: number; ty: number; seed?: number }
  | { kind: "shatter"; tx: number; ty: number; seed?: number };

const T = 16;

export function paintFeatures(
  grid: PixelGrid,
  terrainId: Uint8Array,
  shadow: Uint8Array,
  features: readonly GroundFeature[],
  gridWidth: number,
): void {
  const mark = (px: number, py: number, name: PaletteName): void => {
    if (px < 0 || py < 0 || px >= grid.width || py >= grid.height) return;
    grid.px(px, py, name);
    shadow[py * gridWidth + px] = 1;
  };
  for (const f of features) {
    const ox = f.tx * T, oy = f.ty * T;
    if (f.kind === "sunEmblem") drawSunEmblem(mark, ox, oy);
    else drawShatter(mark, ox, oy, f.seed ?? 0);
  }
}

type Mark = (px: number, py: number, name: PaletteName) => void;

/** Amber sun-disc + short rays centered in the tile (reproduces the templeGlyph landmark). */
function drawSunEmblem(mark: Mark, ox: number, oy: number): void {
  const cx = ox + 8, cy = oy + 8;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d = dx * dx + dy * dy;
      if (d <= 9) mark(cx + dx, cy + dy, "amber");        // disc r≈3
    }
  }
  mark(cx, cy, "sandLight");                               // center highlight
  mark(cx - 1, cy - 1, "sandLight");
  // four short rays (N/E/S/W), 2px past the disc.
  for (const [rx, ry] of [[0, -6], [0, -5], [6, 0], [5, 0], [0, 6], [0, 5], [-6, 0], [-5, 0]] as const) {
    mark(cx + rx, cy + ry, "amber");
  }
}

/** A slab broken into shards: ink fissures splitting the tile, indigo displaced edges. */
function drawShatter(mark: Mark, ox: number, oy: number, seed: number): void {
  // Two deterministic diagonal fissures crossing near the tile center.
  const jitter = (n: number) => Math.floor(h2(ox + n, oy + n, seed) * 5) - 2; // -2..2
  const c = 8 + jitter(1);
  for (let t = 0; t < T; t++) {
    const a = c + Math.floor((t - 8) * 0.6) + jitter(t);   // main diagonal
    const b = c - Math.floor((t - 8) * 0.9) + jitter(t + 3); // cross diagonal
    mark(ox + t, oy + a, "ink");
    mark(ox + t, oy + a + 1, "indigo");                    // displaced edge
    mark(ox + b, oy + t, "ink");
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/pipeline/ground/features.test.ts`
Expected: PASS (all four).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (clean), then:
```bash
git add tools/pipeline/src/ground/features.ts tests/pipeline/ground/features.test.ts
git commit -m "feat(g4): paintFeatures — sun emblem + shattered slab, crisp via shadow channel"
```

---

### Task 4: Review bake script (visual proof of fill + features)

A standalone `tsx` script that composites a demo temple map (a slab island with emblem + shatter, surrounded by `reefSilt`), paints the features, and writes a PNG for visual review.

**Files:**
- Create: `tools/pipeline/src/ground/bakeTempleReview.mts`

**Interfaces:**
- Consumes: `compositeMapLayers` (`./composite`), `paintFeatures` (`./features`), `encodePng` (`../png`), `TerrainKey`.

- [ ] **Step 1: Write the bake script**

Create `tools/pipeline/src/ground/bakeTempleReview.mts`:
```ts
/** Review bake: composite a demo sun-temple floor (templeSlab island in reefSilt) with
 *  a sun emblem + shattered slabs, and write a PNG for visual review. Run:
 *    npx tsx tools/pipeline/src/ground/bakeTempleReview.mts <outPath>
 *  Not a test — an authoring aid. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { compositeMapLayers } from "./composite";
import { paintFeatures, type GroundFeature } from "./features";
import { encodePng } from "../png";
import type { TerrainKey } from "../cliffs/palette";

const W = 20, H = 14;
const map: TerrainKey[][] = [];
for (let y = 0; y < H; y++) {
  const row: TerrainKey[] = [];
  for (let x = 0; x < W; x++) {
    const inFloor = x >= 3 && x <= 16 && y >= 2 && y <= 11;
    row.push(inFloor ? "templeSlab" : "reefSilt");
  }
  map.push(row);
}
const { grid, terrainId, shadow } = compositeMapLayers(map);
const feats: GroundFeature[] = [
  { kind: "sunEmblem", tx: 9, ty: 6 },
  { kind: "shatter", tx: 5, ty: 9, seed: 3 },
  { kind: "shatter", tx: 14, ty: 4, seed: 7 },
];
paintFeatures(grid, terrainId, shadow, feats, grid.width);

const out = process.argv[2] ?? "temple-review.png";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, encodePng(grid));
console.log(`wrote ${out} (${grid.width}x${grid.height})`);
```

- [ ] **Step 2: Run the bake**

Run: `npx tsx tools/pipeline/src/ground/bakeTempleReview.mts tools/pipeline/.bake/temple-review.png`
Expected: prints `wrote … (320x224)` and the PNG exists. (The controller Reads this PNG for the visual gate — the implementer just confirms it runs and produces a non-empty file.)

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (clean), then:
```bash
git add tools/pipeline/src/ground/bakeTempleReview.mts
git commit -m "feat(g4): temple review-bake script (slab island + emblem + shatter → PNG)"
```

*(Controller step, not the implementer's: Read the PNG; iterate Task 2/3 if the lattice/emblem/shatter read wrong before continuing.)*

---

### Task 5: Live wiring — sun-temple onto the composite with features

Add the sun-temple ground→terrain table, plumb `features` through `CompositeGroundView` and `ZoneConfig`, and opt the scene in.

**Files:**
- Modify: `src/game/maps/groundTerrain.ts` (add SUNTEMPLE table + default)
- Modify: `src/game/gfx/CompositeGroundView.ts` (apply features)
- Modify: `src/game/ZoneScene.ts` (`ZoneConfig.compositeGround.features`; pass through)
- Modify: `src/game/scenes/SunTempleScene.ts` (opt in)
- Test: `tests/game/groundTerrain.test.ts` (extend)

**Interfaces:**
- Consumes: `GroundFeature`/`paintFeatures` (Task 3), `compositeMapLayers` (already imported in `CompositeGroundView`).
- Produces: `SUNTEMPLE_GROUND_TO_TERRAIN`, `SUNTEMPLE_DEFAULT_TERRAIN`; `ZoneConfig.compositeGround` accepts optional `features`.

- [ ] **Step 1: Write the failing table test**

Extend `tests/game/groundTerrain.test.ts`:
```ts
import { SUNTEMPLE_GROUND_TO_TERRAIN as STT, SUNTEMPLE_DEFAULT_TERRAIN as STDEF } from "../../src/game/maps/groundTerrain";
// (add to the existing import from groundTerrain, or a new import line)

describe("sun-temple table", () => {
  it("maps floor + glyph to templeSlab and water phases to reefSilt", () => {
    expect(groundNameToTerrainKey("templeFloor", STT)).toBe("templeSlab");
    expect(groundNameToTerrainKey("templeGlyph", STT)).toBe("templeSlab");
    expect(groundNameToTerrainKey("templeFloorShade", STT)).toBe("templeSlab"); // baseName strips dressing
    expect(groundNameToTerrainKey("seaWater", STT)).toBe("reefSilt");
    expect(groundNameToTerrainKey("seaWater2", STT)).toBe("reefSilt");
    expect(STDEF).toBe("reefSilt");
  });
});
```
(Ensure `groundNameToTerrainKey` is imported in this test file — it already is for the reef tables.)

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run tests/game/groundTerrain.test.ts`
Expected: FAIL — `SUNTEMPLE_GROUND_TO_TERRAIN` not exported.

- [ ] **Step 3: Add the sun-temple table**

In `src/game/maps/groundTerrain.ts`, append:
```ts
/** Sun-temple ground tile-names → TerrainKey. Floor + glyph become the authored
 *  templeSlab; the flooded surround composites as dark reefSilt seabed (both water
 *  animation phases). `baseName` folds the dressed `…Shade` variants in. */
export const SUNTEMPLE_GROUND_TO_TERRAIN: Readonly<Record<string, TerrainKey>> = {
  templeFloor: "templeSlab",
  templeGlyph: "templeSlab",
  seaWater: "reefSilt",
  seaWater2: "reefSilt",
};
export const SUNTEMPLE_DEFAULT_TERRAIN: TerrainKey = "reefSilt";
```

- [ ] **Step 4: Run the table test to verify it passes**

Run: `npx vitest run tests/game/groundTerrain.test.ts`
Expected: PASS.

- [ ] **Step 5: Plumb `features` through `ZoneConfig`**

In `src/game/ZoneScene.ts`, extend the `compositeGround` config type (currently `{ table; fallback }`) to:
```ts
  compositeGround?: {
    table: Readonly<Record<string, TerrainKey>>;
    fallback: TerrainKey;
    features?: readonly GroundFeature[];
  };
```
Add the import at the top:
```ts
import type { GroundFeature } from "../../../tools/pipeline/src/ground/features";
```
In `setupCompositeGround`, pass features into the view (change the existing `new CompositeGroundView(...)` call):
```ts
    this.compositeGroundView = new CompositeGroundView(this, grid, COMPOSITE_GROUND_DEPTH, { blur, features: cg.features });
```

- [ ] **Step 6: Apply features in `CompositeGroundView`**

In `src/game/gfx/CompositeGroundView.ts`:
- Add imports:
  ```ts
  import { paintFeatures, type GroundFeature } from "../../../tools/pipeline/src/ground/features";
  ```
- Extend the constructor `opts` type to `{ blur?: boolean; features?: readonly GroundFeature[] }`.
- After the `compositeMapLayers` destructure and before `pixelGridToRGBA`, apply features (they mutate `pg` and set `shadow=1` so the blur leaves them crisp):
  ```ts
  const { grid: pg, terrainId, shadow } = compositeMapLayers(grid);
  if (opts.features?.length) paintFeatures(pg, terrainId, shadow, opts.features, pg.width);
  ```

- [ ] **Step 7: Opt the sun-temple in**

In `src/game/scenes/SunTempleScene.ts`:
- Add imports:
  ```ts
  import { SUNTEMPLE_GROUND_TO_TERRAIN, SUNTEMPLE_DEFAULT_TERRAIN } from "../maps/groundTerrain";
  import type { GroundFeature } from "../../../tools/pipeline/src/ground/features";
  ```
- Define the feature list (module scope, above the class):
  ```ts
  const SUNTEMPLE_FEATURES: readonly GroundFeature[] = [
    { kind: "sunEmblem", tx: 7, ty: 7 },              // hall-center sun glyph (lore landmark)
    { kind: "shatter", tx: 6, ty: 5, seed: 3 },       // broken slab by a pillar
    { kind: "shatter", tx: 8, ty: 10, seed: 7 },
  ];
  ```
- Add to the returned `config()` object:
  ```ts
      compositeGround: {
        table: SUNTEMPLE_GROUND_TO_TERRAIN,
        fallback: SUNTEMPLE_DEFAULT_TERRAIN,
        features: SUNTEMPLE_FEATURES,
      },
  ```
  (Leave everything else — the `seaWater`/`seaWater2` `animateTilePair`, the glyph `InteractPoint`, pillars, lamp `LightMask` — unchanged.)

- [ ] **Step 8: Typecheck + full unit run**

Run: `npx tsc --noEmit` (clean), then `npx vitest run` (all pass).

- [ ] **Step 9: Commit**

```bash
git add src/game/maps/groundTerrain.ts src/game/gfx/CompositeGroundView.ts src/game/ZoneScene.ts src/game/scenes/SunTempleScene.ts tests/game/groundTerrain.test.ts
git commit -m "feat(g4): wire sun-temple onto the composite with authored slab + features"
```

---

### Task 6: Live capture + full verification

Prove the composited temple renders in-game, and run the full bar.

**Files:**
- Create: `tools/smoke/shots/g4-temple.spec.ts`

**Interfaces:**
- Consumes: the smoke kit (`seed`/`fixture`/`snapshot`/`jumpTo`), same pattern as `tools/smoke/shots/g3-reef.spec.ts` and `water-reef.spec.ts`.

- [ ] **Step 1: Write the capture spec**

Create `tools/smoke/shots/g4-temple.spec.ts`, modeled on `tools/smoke/shots/water-reef.spec.ts`:
```ts
/** G4 review capture — lands in the sun-temple (authored templeSlab floor + features)
 *  and screenshots the composited floor under the lamp. Not pass/fail. */
import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { snapshot } from "../kit/snapshot";
import { jumpTo } from "../kit/debug";

const BASE_FLAGS = { actComplete: true, act2Started: true, act2Complete: true, slitherJoined: true, act3Started: true };

test("g4 — sun-temple authored floor", async ({ page }, testInfo) => {
  await seed(page, fixture("act3-start"));
  await jumpTo(page, { zone: "sunTemple", flags: BASE_FLAGS, hp: 999, settleMs: 1400, stand: { x: 7, y: 8 }, standSettleMs: 500 });
  const s = await snapshot(page);
  expect(s.zoneKey, "reached sunTemple").toBe("sunTemple");
  await page.screenshot({ path: testInfo.outputPath("g4-temple.png") });
});
```
(Confirm the correct fixture name and `zone` key by checking `tools/smoke/kit/zones.ts` / an existing act3 shot; adjust `stand` to a floor tile near the glyph. Use whatever act3 fixture exists — the intent is: be in a save where the sun-temple is reachable.)

- [ ] **Step 2: Run the capture**

Run: `npx playwright test tools/smoke/shots/g4-temple.spec.ts`
Expected: PASS; `g4-temple.png` written. (Controller Reads it for the visual gate.)

- [ ] **Step 3: Full verification bar**

Run in sequence, all must pass:
```bash
npx tsc --noEmit
npx vitest run
npm run build
npm run smoke
npm run smoke:touch
```
(If a build churns `src/assets/generated/manifest.json` LF/CRLF, `git checkout -- src/assets/generated/manifest.json` before switching branches — it is not a source change.)

- [ ] **Step 4: Commit**

```bash
git add tools/smoke/shots/g4-temple.spec.ts
git commit -m "test(g4): live sun-temple composite-floor capture"
```

---

## Self-Review

- **Spec coverage:** §3 authored fill → Tasks 1–2; §4 features → Task 3; §5 wiring → Task 5; §6 review bake → Task 4, live capture + bar → Task 6. All covered.
- **Placeholder scan:** no TBD/vague steps; every code step shows the code. Task 6's fixture/stand note is a concrete verification instruction (check `zones.ts`), not a placeholder.
- **Type consistency:** `GroundFeature` defined in Task 3 and imported unchanged in Task 5; `paintFeatures(grid, terrainId, shadow, features, gridWidth)` signature identical across Tasks 3/5/4; `templeSlab` ramp/roles consistent Tasks 1–2.
- **Additive/no-repin:** only appends to `TerrainKey`/`TERRAIN_RAMPS`/`ORDER`; determinism pins untouched (composite is not a pinned sheet).
