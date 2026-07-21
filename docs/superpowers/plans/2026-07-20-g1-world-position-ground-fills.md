# G1 — World-Position Ground Fill Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `fill(terrain, worldX, worldY) -> PaletteName` — a deterministic, palette-locked, world-position (non-repeating) ground surface for the 19 built ground families, in a new `tools/pipeline/src/ground/` module.

**Architecture:** World-position value noise (non-wrapping continuous lattice) replaces the shipped tile-local toroidal noise, killing the 16px repeat. Each terrain layers its approved `floorFill` recipe (same ramps + fleck densities) + a low-frequency macro tonal drift + a faint per-material grain ("de-tile + enrich"). Output is always a `PaletteName` from that terrain's `TERRAIN_RAMPS` ramp. `floorFill` and every baked sheet are left untouched.

**Tech Stack:** TypeScript, Node/tsx pipeline, Vitest. Deterministic integer-hash noise only (`h2`/`worldFbm`) — no `Math.random`/`Date`.

## Global Constraints

- **Palette-lock, name-based:** `fill()` returns a `PaletteName` from `TERRAIN_RAMPS[terrain]`; NEVER emit raw hex. (CONTRACTS)
- **World-position, non-repeating:** noise is sampled at absolute world coords on a NON-wrapping lattice. No `mod cells` wrap. (spec §3)
- **Reuse `h2`/`sm`/`mix` from `tools/pipeline/src/cliffs/noise.ts`** — do NOT fork the hash. (spec §3)
- **De-tile + enrich:** approved recipe base + macro tonal drift + per-material grain. (owner decision)
- **Leave `floorFill` + all baked sheets + the 40 determinism pins byte-identical** — G1 is a parallel module; nothing rebakes. (spec §5)
- **Deterministic:** `fill(t, wx, wy)` pure; same inputs → same output.
- **Verification bar:** `tsc --noEmit`, `vitest run`, `npm run build`. No smoke needed (no game/sheet change). Owner review gate at the render (Task 5).

## File Structure

- **Create** `tools/pipeline/src/ground/worldNoise.ts` — non-wrapping world noise: `worldNoise`, `worldFbm`, `worldMacro`.
- **Create** `tools/pipeline/src/ground/fills.ts` — `fill(terrain, wx, wy)`, the `GRAIN` table, `keySeed`, and `fillField(key, ox, oy, w, h)` (renders a `PixelGrid` — used by tests + the review render).
- **Create** `tests/pipeline/ground/worldNoise.test.ts`, `tests/pipeline/ground/fills.test.ts`.
- **Create** `tools/pipeline/src/ground/buildFillReview.mts` — old-`floorFill`-tiled vs new-`fill` HTML render for the owner gate.

---

## Task 1: World-position noise primitives

**Files:**
- Create: `tools/pipeline/src/ground/worldNoise.ts`
- Test: `tests/pipeline/ground/worldNoise.test.ts`

**Interfaces:**
- Produces: `worldNoise(wx,wy,freq,s): number` (0..1), `worldFbm(wx,wy,s): number` (0..1), `worldMacro(wx,wy,s): number` (0..1).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/pipeline/ground/worldNoise.test.ts
import { describe, it, expect } from "vitest";
import { worldNoise, worldFbm, worldMacro } from "../../../tools/pipeline/src/ground/worldNoise";

describe("worldNoise", () => {
  it("is deterministic and in [0,1)", () => {
    for (const [x, y] of [[0, 0], [1000.5, -37.2], [1e5, 1e5]]) {
      const a = worldFbm(x, y, 3), b = worldFbm(x, y, 3);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });
  it("does NOT repeat with period 16 (world-position, not tile-local)", () => {
    // a tile-local noise would give worldFbm(x)==worldFbm(x+16); world noise must not.
    let differ = 0;
    for (let i = 0; i < 32; i++) if (worldFbm(i, 0, 5) !== worldFbm(i + 16, 0, 5)) differ++;
    expect(differ).toBeGreaterThan(24); // essentially all differ
  });
  it("varies continuously (neighbors are close)", () => {
    const a = worldNoise(100, 100, 0.125, 1), b = worldNoise(100.1, 100, 0.125, 1);
    expect(Math.abs(a - b)).toBeLessThan(0.2);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/pipeline/ground/worldNoise.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `worldNoise.ts`**

```ts
// tools/pipeline/src/ground/worldNoise.ts
/**
 * World-position value noise — a NON-wrapping continuous lattice sampled at
 * absolute world coords. Unlike cliffs/noise.ts `noise()` (which wraps mod
 * cells and so tiles every 16px), this never repeats. Reuses the shared `h2`
 * hash (seam math depends on it). Safe at world magnitudes: lattice indices
 * stay well under 2^53 for any realistic map (< ~1e6 tiles).
 */
import { h2, sm, mix } from "../cliffs/noise";

export function worldNoise(wx: number, wy: number, freq: number, s: number): number {
  const fx = wx * freq, fy = wy * freq;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = sm(fx - x0), ty = sm(fy - y0);
  const v = (i: number, j: number) => h2(i, j, s);
  return mix(mix(v(x0, y0), v(x0 + 1, y0), tx), mix(v(x0, y0 + 1), v(x0 + 1, y0 + 1), tx), ty);
}

/** Three octaves at the shipped fbm's texture SCALE (2/4/8 cells over a 16px tile). */
export function worldFbm(wx: number, wy: number, s: number): number {
  return worldNoise(wx, wy, 0.125, s) * 0.55
       + worldNoise(wx, wy, 0.25, s + 1) * 0.30
       + worldNoise(wx, wy, 0.5, s + 2) * 0.15;
}

/** Low-frequency enrichment drift (period ~64px). */
export function worldMacro(wx: number, wy: number, s: number): number {
  return worldNoise(wx, wy, 0.015, s);
}
```

- [ ] **Step 4: Run tests to pass**

Run: `npx vitest run tests/pipeline/ground/worldNoise.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/ground/worldNoise.ts tests/pipeline/ground/worldNoise.test.ts
git commit -m "feat(ground): world-position (non-wrapping) noise primitives"
```

---

## Task 2: Fill engine + desert grounds

**Files:**
- Create: `tools/pipeline/src/ground/fills.ts`
- Test: `tests/pipeline/ground/fills.test.ts`

**Interfaces:**
- Consumes: `worldFbm`, `worldMacro` (Task 1); `h2` (`cliffs/noise`); `TERRAIN_RAMPS`, `TerrainKey` (`cliffs/palette`); `PixelGrid` (`../grid`); `PaletteName` (`src/shared/palette`).
- Produces:
  - `fill(key: TerrainKey, wx: number, wy: number): PaletteName`
  - `fillField(key: TerrainKey, ox: number, oy: number, w: number, h: number): PixelGrid` — renders a `w×h` field with world origin `(ox,oy)`.
  - `GRAIN: Record<TerrainKey,[number,number]>`, `keySeed(key: string): number`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/pipeline/ground/fills.test.ts
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { fill, fillField } from "../../../tools/pipeline/src/ground/fills";
import { encodePng } from "../../../tools/pipeline/src/png";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";

const DESERT = ["sand", "frostSand", "asphalt"] as const;
// golden-crop pins — re-pin ONLY on an intentional recipe change (Step 4 fills these).
const FROZEN: Record<string, string> = { sand: "PLACEHOLDER", frostSand: "PLACEHOLDER", asphalt: "PLACEHOLDER" };

describe("fill — desert", () => {
  it("is deterministic and palette-locked to each terrain's ramp", () => {
    for (const k of DESERT) {
      const ramp = new Set(TERRAIN_RAMPS[k]);
      const g = fillField(k, 500, 500, 48, 48);
      g.forEach((_x, _y, c) => { if (c !== null) expect(ramp.has(c as any), `${k} pixel ${c} off-ramp`).toBe(true); });
      expect(fill(k, 500, 500)).toBe(fill(k, 500, 500)); // pure
    }
  });
  it("does NOT tile with period 16 (world-position)", () => {
    for (const k of DESERT) {
      const a = fillField(k, 0, 0, 16, 16), b = fillField(k, 16, 0, 16, 16);
      expect(a.diff(b), `${k} repeats every 16px`).toBeGreaterThan(0);
    }
  });
  it("matches its golden-crop pin (64x64 @ world 1000,1000)", () => {
    for (const k of DESERT) {
      const hash = createHash("sha256").update(encodePng(fillField(k, 1000, 1000, 64, 64))).digest("hex");
      expect(hash, `${k} crop changed`).toBe(FROZEN[k]);
    }
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/pipeline/ground/fills.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `fills.ts` (engine + desert branches)**

```ts
// tools/pipeline/src/ground/fills.ts
/**
 * World-position ground fills. Each terrain re-expresses its approved
 * `cliffs/terrains.ts` `floorFill` recipe at absolute world coords (killing
 * the 16px repeat), plus a low-freq macro tonal drift and a per-material
 * grain ("de-tile + enrich"). Output is a PaletteName from the terrain's ramp.
 */
import { PixelGrid } from "../grid";
import { h2 } from "../cliffs/noise";
import { worldFbm, worldMacro } from "./worldNoise";
import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";
import type { PaletteName } from "../../../../src/shared/palette";

/** Per-material grain: [xScale,yScale] applied to world coords before worldFbm.
 *  A scale < 1 on an axis STRETCHES features along it. */
export const GRAIN: Record<TerrainKey, [number, number]> = {
  groveGrass: [1, 0.6], rimeMoss: [1, 0.7], glowMoss: [1, 0.7],   // vertical bias
  reefWater: [0.6, 1], groveWater: [0.6, 1], lava: [0.6, 1],      // horizontal drift
  sand: [1, 1], frostSand: [1, 1], asphalt: [1, 1], reefFloor: [1, 1], reefSilt: [1, 1],
  snow: [1, 1], ice: [1, 1], frozenLake: [1, 1], emberRock: [1, 1], ash: [1, 1],
  lavaCrust: [1, 1], groveMoss: [1, 1], groveSoil: [1, 1],
};

/** Stable, per-key distinct seed (replaces floorFill's collision-prone key.length*13). */
export const keySeed = (k: string): number =>
  [...k].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

const clampIdx = (i: number, n: number): number => (i < 0 ? 0 : i >= n ? n - 1 : i);

export function fill(key: TerrainKey, wx: number, wy: number): PaletteName {
  const ramp = TERRAIN_RAMPS[key];
  const seed = keySeed(key);
  const [gx, gy] = GRAIN[key];
  const drift = (worldMacro(wx, wy, seed + 7) - 0.5) * 0.15;     // broad tonal drift
  const v = worldFbm(wx * gx, wy * gy, seed) + drift;            // grain via gx/gy
  const ix = Math.floor(wx), iy = Math.floor(wy);               // integer world cell for flecks
  let idx: number;

  switch (key) {
    case "sand":
    case "frostSand":
      idx = 1;
      if (h2(ix, iy, seed + 31) > 0.95) idx = 0;
      else if (h2(ix, iy, seed + 53) > 0.96) idx = 2;
      if (v > 0.62) idx = clampIdx(idx - 1, ramp.length);        // macro light patch
      else if (v < 0.38) idx = clampIdx(idx + 1, ramp.length);   // macro dark patch
      break;
    case "asphalt":
      idx = v < 0.58 ? 2 : v < 0.82 ? 1 : 3;
      if (h2(ix, iy, seed + 77) > 0.93) idx = 0;
      break;
    default:
      idx = 1; // reef/ice/lava/grove branches added in Tasks 3-4
  }
  return ramp[clampIdx(idx, ramp.length)];
}

export function fillField(key: TerrainKey, ox: number, oy: number, w: number, h: number): PixelGrid {
  const g = new PixelGrid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.px(x, y, fill(key, ox + x, oy + y));
  return g;
}
```

- [ ] **Step 4: Pin the desert golden crops.** Run the test; it fails on the crop hashes printing the actual `Received`. Paste each into `FROZEN`. Re-run → green.

Run: `npx vitest run tests/pipeline/ground/fills.test.ts`
Expected: after pinning, PASS (all 3 tests, 3 terrains).

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/ground/fills.ts tests/pipeline/ground/fills.test.ts
git commit -m "feat(ground): fill engine + desert grounds (world-position, de-tile+enrich)"
```

---

## Task 3: Reef + ice grounds

**Files:**
- Modify: `tools/pipeline/src/ground/fills.ts` (add 8 `switch` branches)
- Modify: `tests/pipeline/ground/fills.test.ts` (extend to reef + ice)

**Interfaces:** unchanged (`fill`/`fillField`).

- [ ] **Step 1: Extend the test** to cover `["reefFloor","reefSilt","reefWater","glowMoss","ice","snow","frozenLake","rimeMoss"]` — the SAME three assertions (palette-lock, non-tiling, golden-crop) as Task 2. Add these 8 keys to `DESERT`→rename the arrays or add a second `describe`; add 8 `FROZEN` entries (PLACEHOLDER).

- [ ] **Step 2: Run to see it fail** (off-ramp: the `default` branch returns `ramp[1]` so palette-lock passes, but the golden crops are unpinned → fail on hash).

Run: `npx vitest run tests/pipeline/ground/fills.test.ts`
Expected: FAIL on the 8 new golden-crop hashes.

- [ ] **Step 3: Add the 8 branches**, porting each recipe VERBATIM from `tools/pipeline/src/cliffs/terrains.ts` `floorFill` (same thresholds), swapping `fbm(x,y,seed…)`→ the world `v`, and `h2(x,y,seed…)`→`h2(ix,iy,seed…)`. The recipes to mirror (from `terrains.ts`):

```ts
    case "reefFloor": // idx=1; h2>0.97 -> 2; else h2>0.985 -> 0
      idx = 1;
      if (h2(ix, iy, seed + 53) > 0.97) idx = 2;
      else if (h2(ix, iy, seed + 31) > 0.985) idx = 0;
      break;
    case "reefSilt": // idx=1; h2>0.94 -> 3; else h2>0.98 -> 0
      idx = 1;
      if (h2(ix, iy, seed + 53) > 0.94) idx = 3;
      else if (h2(ix, iy, seed + 31) > 0.98) idx = 0;
      break;
    case "reefWater": // v<0.5?1:2; h2>0.92 -> 0
      idx = v < 0.5 ? 1 : 2;
      if (h2(ix, iy, seed + 31) > 0.92) idx = 0;
      break;
    case "glowMoss": // v<0.5?2:1; h2>0.88 -> 0
      idx = v < 0.5 ? 2 : 1;
      if (h2(ix, iy, seed + 31) > 0.88) idx = 0;
      break;
    case "ice": // white body idx0; h2>0.88 -> 1 (skyBlue accent); rare seam skipped (Voronoi is tile-local — see note)
      idx = 0;
      if (h2(ix, iy, seed + 31) > 0.88) idx = 1;
      break;
    case "snow": // idx=1; h2>0.90 -> 0; else h2>0.97 -> 2
      idx = 1;
      if (h2(ix, iy, seed + 31) > 0.90) idx = 0;
      else if (h2(ix, iy, seed + 53) > 0.97) idx = 2;
      break;
    case "frozenLake": // v<0.5?1:0; h2>0.93 -> 2; else h2>0.985 -> 3
      idx = v < 0.5 ? 1 : 0;
      if (h2(ix, iy, seed + 53) > 0.93) idx = 2;
      else if (h2(ix, iy, seed + 61) > 0.985) idx = 3;
      break;
    case "rimeMoss": // v<0.5?2:1; h2>0.85 -> 0
      idx = v < 0.5 ? 2 : 1;
      if (h2(ix, iy, seed + 31) > 0.85) idx = 0;
      break;
```
**Note (ice):** `floorFill`'s `ice` had a tile-local toroidal-Voronoi hairline seam; that construction is inherently tile-periodic and is intentionally DROPPED for the world-position fill (the scattered skyBlue accent is kept). Record this in the report; the owner sees it at the render gate.

- [ ] **Step 4: Pin the 8 golden crops** (paste actual hashes), re-run green.

Run: `npx vitest run tests/pipeline/ground/fills.test.ts`
Expected: PASS (11 terrains now).

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/ground/fills.ts tests/pipeline/ground/fills.test.ts
git commit -m "feat(ground): reef + ice world-position grounds"
```

---

## Task 4: Lava + grove grounds

**Files:**
- Modify: `tools/pipeline/src/ground/fills.ts` (add 8 branches)
- Modify: `tests/pipeline/ground/fills.test.ts` (extend to lava + grove)

- [ ] **Step 1: Extend the test** to `["emberRock","ash","lava","lavaCrust","groveGrass","groveMoss","groveWater","groveSoil"]` — same three assertions + 8 PLACEHOLDER `FROZEN` entries.

- [ ] **Step 2: Run to see it fail** on the 8 unpinned crops.

Run: `npx vitest run tests/pipeline/ground/fills.test.ts`
Expected: FAIL on the 8 new hashes.

- [ ] **Step 3: Add the 8 branches**, porting from `terrains.ts` (same thresholds; `fbm`→`v`, `h2(x,y…)`→`h2(ix,iy…)`):

```ts
    case "emberRock": // v<0.5?2:3; h2>0.94 -> 0; else h2>0.97 -> 1
      idx = v < 0.5 ? 2 : 3;
      if (h2(ix, iy, seed + 31) > 0.94) idx = 0;
      else if (h2(ix, iy, seed + 53) > 0.97) idx = 1;
      break;
    case "ash": // v<0.5?0:1; h2>0.96 -> 3
      idx = v < 0.5 ? 0 : 1;
      if (h2(ix, iy, seed + 53) > 0.96) idx = 3;
      break;
    case "lava": // v<0.5?1:2; h2>0.82 -> 0
      idx = v < 0.5 ? 1 : 2;
      if (h2(ix, iy, seed + 31) > 0.82) idx = 0;
      break;
    case "lavaCrust": // v<0.5?2:3; h2>0.90 -> 0; else h2>0.96 -> 1
      idx = v < 0.5 ? 2 : 3;
      if (h2(ix, iy, seed + 31) > 0.90) idx = 0;
      else if (h2(ix, iy, seed + 53) > 0.96) idx = 1;
      break;
    case "groveGrass": // v<0.5?1:2; h2>0.90 -> 0
      idx = v < 0.5 ? 1 : 2;
      if (h2(ix, iy, seed + 31) > 0.90) idx = 0;
      break;
    case "groveMoss": // idx=1; fbm(x,y,seed+5)<0.42 -> 2; h2>0.82 -> 0; else h2>0.95 -> 3
      idx = 1;
      if (worldFbm(wx, wy, seed + 5) < 0.42) idx = 2;
      if (h2(ix, iy, seed + 31) > 0.82) idx = 0;
      else if (h2(ix, iy, seed + 53) > 0.95) idx = 3;
      break;
    case "groveWater": // v<0.5?1:2; h2>0.90 -> 0
      idx = v < 0.5 ? 1 : 2;
      if (h2(ix, iy, seed + 31) > 0.90) idx = 0;
      break;
    case "groveSoil": // v<0.5?1:2; h2>0.92 -> 0; else h2>0.96 -> 3
      idx = v < 0.5 ? 1 : 2;
      if (h2(ix, iy, seed + 31) > 0.92) idx = 0;
      else if (h2(ix, iy, seed + 53) > 0.96) idx = 3;
      break;
```
Then remove the `default` branch's role (keep a `default` that throws `Error(\`unknown terrain \${key}\`)` so a missing key is caught, since all 19 are now covered).

- [ ] **Step 4: Pin the 8 golden crops**, re-run green (all 19 terrains).

Run: `npx vitest run tests/pipeline/ground/fills.test.ts`
Expected: PASS (19 terrains × 3 assertions).

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/ground/fills.ts tests/pipeline/ground/fills.test.ts
git commit -m "feat(ground): lava + grove world-position grounds (all 19 covered)"
```

---

## Task 5: Review render + owner gate

**Files:**
- Create: `tools/pipeline/src/ground/buildFillReview.mts`
- Create (output): `docs/superpowers/artifacts/ground-fills-review.html`

- [ ] **Step 1: Write the review builder.** For each of the 19 terrains, render TWO fields at a visible scale: (a) the OLD look — `floorFill(key, 1)` tiled across a large area (shows the repeat); (b) the NEW look — `fillField(key, 0, 0, W, H)` (shows no repeat + enrichment). Encode both to PNG data URIs (reuse `encodePng`), embed side-by-side scaled ×3-4 with `image-rendering:pixelated`. Use a field big enough to reveal repeats, e.g. `W=H=96`.

```ts
// tools/pipeline/src/ground/buildFillReview.mts
import { writeFileSync } from "node:fs";
import { PixelGrid } from "../grid";
import { encodePng } from "../png";
import { floorFill } from "../cliffs/terrains";
import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";
import { fillField } from "./fills";

const N = 96;
const tiled = (key: TerrainKey): PixelGrid => {           // OLD: floorFill stamped NxN
  const t = floorFill(key, 1); const g = new PixelGrid(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.px(x, y, t.get(x % t.width, y % t.height));
  return g;
};
const uri = (g: PixelGrid) => "data:image/png;base64," + encodePng(g).toString("base64");
const keys = Object.keys(TERRAIN_RAMPS) as TerrainKey[];
const items = keys.map((k) => `<div class="item"><div class="lab">${k}</div><div class="imgs">
  <figure><img style="width:${N*3}px" src="${uri(tiled(k))}"><figcaption>old (tiled floorFill)</figcaption></figure>
  <figure><img style="width:${N*3}px" src="${uri(fillField(k,0,0,N,N))}"><figcaption>new (world-position fill)</figcaption></figure></div></div>`).join("");
writeFileSync("docs/superpowers/artifacts/ground-fills-review.html",
  `<!doctype html><meta charset=utf8><title>G1 ground fills</title><style>
   body{font:14px system-ui;background:#1b1b1f;color:#eee;margin:20px}
   img{image-rendering:pixelated;border:1px solid #333;display:block}
   .grid{display:flex;flex-wrap:wrap;gap:22px}.imgs{display:flex;gap:10px}
   .lab{font-weight:600;color:#cbd;margin-bottom:4px}figure{margin:0}figcaption{font-size:11px;color:#999;text-align:center}
   </style><h1>G1 ground fills — old tiled vs new world-position</h1><div class="grid">${items}</div>`);
console.log("wrote docs/superpowers/artifacts/ground-fills-review.html");
```

- [ ] **Step 2: Run it**

Run: `npx tsx tools/pipeline/src/ground/buildFillReview.mts`
Expected: writes the HTML.

- [ ] **Step 3: OWNER REVIEW GATE.** Present the render. The owner confirms the repeat is gone and the enrichment (macro drift + grain) reads well, or requests per-terrain tweaks (grain amount, macro strength). Apply tweaks in `fills.ts`/`GRAIN`, re-pin affected golden crops, regenerate. Do not finalize until the owner signs off.

- [ ] **Step 4: Commit**

```bash
git add tools/pipeline/src/ground/buildFillReview.mts docs/superpowers/artifacts/ground-fills-review.html
git commit -m "feat(ground): old-vs-new fill review render for owner gate"
```

---

## Task 6: Full verification

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npx vitest run` → fully green (worldNoise + fills tests pass; the 40 existing determinism pins + all other suites UNCHANGED — confirm nothing rebaked).
- [ ] **Step 3:** `npm run build` → green.
- [ ] **Step 4:** Open the PR into `main` (regular merge commit per CLAUDE.md).

---

## Self-Review Notes

- **Spec coverage:** worldNoise (§3) = T1; fill engine + macro/grain + all 19 recipes (§2,§4) = T2-4; golden-crop + conformance + non-tiling tests (§6) = T2-4; review render + gate (§7) = T5; verification (§8) = T6.
- **Out of scope (intentional):** masks/compositing (G2), game wiring (G3), authored floors (G4), ramp re-tuning. The tile-local ice Voronoi seam is dropped (recorded in T3).
- **Determinism:** golden-crop pins are this module's own; the 40 existing sheet pins and `floorFill` are untouched (T6 confirms).
- **Type consistency:** `fill(key,wx,wy):PaletteName`, `fillField(key,ox,oy,w,h):PixelGrid`, `GRAIN`, `keySeed` used identically across tasks.
