# G2 — Shared Masks + Composite Bake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Composite a `TerrainKey[][]` tilemap into a ground texture via one shared mask over G1's world-position fills — `base fill + over·mask + outline` — with priority-resolved junctions, in a new `tools/pipeline/src/ground/composite.ts`.

**Architecture:** Reuse `cliffs/blob47.ts` `overlayMask` (terrain-independent 47-blob stencil) and its `(over,base)` + `on()`/outline convention, but drive it from a map + a global priority order, sampling G1 `fill(terrain, wx, wy)` per pixel at absolute world coords. Per cell: seam to the single highest-priority intruding neighbor; 3+ junctions degrade gracefully. Static bake only (animation/game-wiring = G3).

**Tech Stack:** TypeScript, Node/tsx pipeline, Vitest. Deterministic (`h2`/`fill`/`overlayMask` only; no `Math.random`/`Date`).

## Global Constraints

- **Palette-lock:** every composited pixel is a `PaletteName`; reuse `blobTiles`' `shade()`/ramp-index outline (no raw hex). (CONTRACTS)
- **Reuse, don't reinvent:** import `overlayMask` from `cliffs/blob47`, `fill`/`fillField` from `ground/fills`, `TERRAIN_RAMPS`/`TerrainKey` from `cliffs/palette`, `shade`/`nameToRampIndex` from `cliffs/palette` + `cliffs/terrains`. Keep `blobTiles`' `(over,base)` semantics: mask=1 → over (the cell's field), mask=0 → base (the carved-in higher terrain). (spec §2)
- **World-position:** fills sampled at `(ox+px, oy+py)` — never tile-local. (spec §3)
- **Priority:** higher priority owns the seam (carves into lower). Single global `GROUND_PRIORITY`. (spec §4)
- **Default seam style** (owner-tuned reef): `inset 3, irreg 20, round 8, pocketRound 8, seed 7439`.
- **Leave untouched:** `floorFill`, baked sheets, the 40 determinism pins, `blob47.ts`, `fills.ts`. G2 is additive.
- **Verification bar:** `tsc --noEmit`, `vitest run`, `npm run build`. Owner review gate at the composite render (Task 5).

## Direction bits (used throughout)

8-neighbor bits per `overlayMask`: `N=1(0,-1) NE=2(1,-1) E=4(1,0) SE=8(1,1) S=16(0,1) SW=32(-1,1) W=64(-1,0) NW=128(-1,-1)`.

---

## Task 1: Global priority + neighbor config

**Files:**
- Create: `tools/pipeline/src/ground/composite.ts` (start it)
- Test: `tests/pipeline/ground/composite.test.ts`

**Interfaces:**
- Produces: `GROUND_PRIORITY: Record<TerrainKey, number>`; `DIRS: {bit:number,dx:number,dy:number}[]`; `neighborConfig(at: (dx:number,dy:number)=>boolean): number` — the 8-bit over-side config (bit set = that neighbor is on the over/field side, i.e. NOT carving in).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/pipeline/ground/composite.test.ts
import { describe, it, expect } from "vitest";
import { GROUND_PRIORITY, neighborConfig } from "../../../tools/pipeline/src/ground/composite";
import { TERRAIN_RAMPS } from "../../../tools/pipeline/src/cliffs/palette";

describe("GROUND_PRIORITY", () => {
  it("ranks every terrain and preserves the per-biome orders", () => {
    const P = GROUND_PRIORITY;
    for (const k of Object.keys(TERRAIN_RAMPS)) expect(typeof P[k as keyof typeof P]).toBe("number");
    expect(P.reefFloor).toBeLessThan(P.reefSilt);
    expect(P.reefSilt).toBeLessThan(P.reefWater);
    expect(P.reefWater).toBeLessThan(P.glowMoss);
    expect(P.ice).toBeLessThan(P.snow);
    expect(P.emberRock).toBeLessThan(P.lava);
    expect(P.groveGrass).toBeLessThan(P.groveSoil);
    expect(new Set(Object.values(P)).size).toBe(Object.keys(TERRAIN_RAMPS).length); // all distinct
  });
});

describe("neighborConfig", () => {
  it("sets a bit where the neighbor is on the over side, clears where it carves in", () => {
    // E neighbor carves in (returns false), all others over-side (true)
    const cfg = neighborConfig((dx, dy) => !(dx === 1 && dy === 0));
    expect(cfg & 4).toBe(0);            // E bit cleared
    expect(cfg & 1).toBe(1);            // N bit set
    expect(neighborConfig(() => true)).toBe(255);  // fully surrounded by over
    expect(neighborConfig(() => false)).toBe(0);   // fully carved
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/pipeline/ground/composite.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement (priority + config)**

```ts
// tools/pipeline/src/ground/composite.ts
import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";

/** Global seam priority; higher = owns the seam (carves into lower). Seeded from
 *  the per-biome orders in presets.ts, biomes ordered desert<reef<ice<lava<grove. */
const ORDER: TerrainKey[] = [
  "sand", "asphalt", "frostSand",
  "reefFloor", "reefSilt", "reefWater", "glowMoss",
  "ice", "snow", "frozenLake", "rimeMoss",
  "emberRock", "ash", "lava", "lavaCrust",
  "groveGrass", "groveMoss", "groveWater", "groveSoil",
];
export const GROUND_PRIORITY: Record<TerrainKey, number> = Object.fromEntries(
  ORDER.map((k, i) => [k, i]),
) as Record<TerrainKey, number>;
// safety: ORDER must cover every terrain
for (const k of Object.keys(TERRAIN_RAMPS)) if (!(k in GROUND_PRIORITY)) throw new Error(`priority missing ${k}`);

export const DIRS = [
  { bit: 1, dx: 0, dy: -1 }, { bit: 2, dx: 1, dy: -1 }, { bit: 4, dx: 1, dy: 0 }, { bit: 8, dx: 1, dy: 1 },
  { bit: 16, dx: 0, dy: 1 }, { bit: 32, dx: -1, dy: 1 }, { bit: 64, dx: -1, dy: 0 }, { bit: 128, dx: -1, dy: -1 },
];

/** 8-bit config: bit SET where `atOverSide(dx,dy)` is true (neighbor on the field
 *  side), CLEARED where it carves in. Feeds `overlayMask` directly. */
export function neighborConfig(atOverSide: (dx: number, dy: number) => boolean): number {
  let cfg = 0;
  for (const d of DIRS) if (atOverSide(d.dx, d.dy)) cfg |= d.bit;
  return cfg;
}
```

- [ ] **Step 4: Run to pass**

Run: `npx vitest run tests/pipeline/ground/composite.test.ts`
Expected: PASS (both suites).

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/ground/composite.ts tests/pipeline/ground/composite.test.ts
git commit -m "feat(ground): G2 global priority + neighbor-config helper"
```

---

## Task 2: Composite one cell (base + over·mask, no outline yet)

**Files:**
- Modify: `tools/pipeline/src/ground/composite.ts`
- Test: `tests/pipeline/ground/composite.test.ts`

**Interfaces:**
- Consumes: `overlayMask` (`cliffs/blob47`), `fill` (`ground/fills`), `GROUND_PRIORITY`/`DIRS`/`neighborConfig` (Task 1), `PixelGrid` (`../grid`).
- Produces:
  - `SEAM = { inset: 3, irreg: 20, round: 8, pocketRound: 8, seed: 7439 }`.
  - `compositeCell(map: TerrainKey[][], cx: number, cy: number, ox: number, oy: number): PixelGrid` — a 16×16 cell composited from world-position fills. No outline (Task 4 adds it).

- [ ] **Step 1: Write the failing tests**

```ts
// add to composite.test.ts
import { compositeCell } from "../../../tools/pipeline/src/ground/composite";
import { TERRAIN_RAMPS as R } from "../../../tools/pipeline/src/cliffs/palette";

describe("compositeCell", () => {
  // 3×3 map: center reefFloor (low), east neighbor glowMoss (high) → moss carves in from east
  const map = [
    ["reefFloor", "reefFloor", "reefFloor"],
    ["reefFloor", "reefFloor", "glowMoss"],
    ["reefFloor", "reefFloor", "reefFloor"],
  ] as any;
  it("is palette-locked to the two involved ramps and deterministic", () => {
    const allowed = new Set([...R.reefFloor, ...R.glowMoss]);
    const g = compositeCell(map, 1, 1, 1000, 1000);
    g.forEach((_x, _y, c) => { if (c) expect(allowed.has(c as any), `off-ramp ${c}`).toBe(true); });
    const h = compositeCell(map, 1, 1, 1000, 1000);
    g.forEach((x, y, c) => expect(h.get(x, y)).toBe(c)); // pure
  });
  it("carves the higher terrain in from the higher-neighbor side", () => {
    const g = compositeCell(map, 1, 1, 0, 0);
    // east column should contain glowMoss (base) pixels; west edge should be reefFloor (over)
    const eastHasMoss = [...Array(16).keys()].some((y) => R.glowMoss.includes(g.get(15, y) as any));
    const westIsFloor = [...Array(16).keys()].every((y) => R.reefFloor.includes(g.get(0, y) as any));
    expect(eastHasMoss).toBe(true);
    expect(westIsFloor).toBe(true);
  });
  it("a cell with no higher neighbor is pure fill(T)", () => {
    const g = compositeCell(map, 0, 0, 0, 0); // corner reefFloor, no higher neighbor
    g.forEach((_x, _y, c) => { if (c) expect(R.reefFloor.includes(c as any)).toBe(true); });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/pipeline/ground/composite.test.ts`
Expected: FAIL (`compositeCell` not defined).

- [ ] **Step 3: Implement `compositeCell`**

```ts
// add to composite.ts
import { PixelGrid } from "../grid";
import { overlayMask } from "../cliffs/blob47";
import { fill } from "./fills";

const T = 16;
export const SEAM = { inset: 3, irreg: 20, round: 8, pocketRound: 8, seed: 7439 };

const terrainAt = (map: TerrainKey[][], cx: number, cy: number): TerrainKey | null =>
  (cy >= 0 && cy < map.length && cx >= 0 && cx < map[cy].length) ? map[cy][cx] : null;

export function compositeCell(map: TerrainKey[][], cx: number, cy: number, ox: number, oy: number): PixelGrid {
  const g = new PixelGrid(T, T);
  const self = map[cy][cx];
  const wx0 = ox + cx * T, wy0 = oy + cy * T;

  // highest-priority neighbor that outranks `self`
  let over: TerrainKey = self, overPri = GROUND_PRIORITY[self];
  for (const d of DIRS) {
    const n = terrainAt(map, cx + d.dx, cy + d.dy);
    if (n && GROUND_PRIORITY[n] > overPri) { over = n; overPri = GROUND_PRIORITY[n]; }
  }
  if (over === self) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.px(x, y, fill(self, wx0 + x, wy0 + y));
    return g;
  }
  // config: bit SET where the neighbor is NOT carving in (priority <= self); the
  // carved terrain `over` (higher) reaches in from cleared-bit directions.
  const cfg = neighborConfig((dx, dy) => {
    const n = terrainAt(map, cx + dx, cy + dy);
    return !n || GROUND_PRIORITY[n] <= GROUND_PRIORITY[self];
  });
  const m = overlayMask(cfg, SEAM.inset, SEAM.irreg, SEAM.round, SEAM.seed, SEAM.pocketRound);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // mask=1 → field (self); mask=0 → carved higher terrain (over)
    const terr = m[y * T + x] === 1 ? self : over;
    g.px(x, y, fill(terr, wx0 + x, wy0 + y));
  }
  return g;
}
```

- [ ] **Step 4: Run to pass**

Run: `npx vitest run tests/pipeline/ground/composite.test.ts`
Expected: PASS. (If "carves from east" fails, the config's over-side sense is inverted — re-check that a HIGHER east neighbor clears the E bit so `overlayMask` retreats the field on the east.)

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/ground/composite.ts tests/pipeline/ground/composite.test.ts
git commit -m "feat(ground): G2 per-cell composite from world-position fills"
```

---

## Task 3: Composite a whole map region

**Files:**
- Modify: `tools/pipeline/src/ground/composite.ts`
- Test: `tests/pipeline/ground/composite.test.ts`

**Interfaces:**
- Produces: `compositeMap(map: TerrainKey[][], ox = 0, oy = 0): PixelGrid` — assembles `compositeCell` over the whole grid into a `(w*16)×(h*16)` texture.

- [ ] **Step 1: Write the failing test**

```ts
// add to composite.test.ts
import { compositeMap } from "../../../tools/pipeline/src/ground/composite";
describe("compositeMap", () => {
  const map = [
    ["reefFloor", "reefSilt", "reefWater"],
    ["reefSilt", "glowMoss", "reefWater"],
    ["reefFloor", "reefFloor", "glowMoss"],
  ] as any;
  it("assembles a w*16 x h*16 texture, palette-locked and deterministic", () => {
    const g = compositeMap(map);
    expect(g.width).toBe(48); expect(g.height).toBe(48);
    const allowed = new Set(["reefFloor","reefSilt","reefWater","glowMoss"].flatMap((k) => (R as any)[k]));
    g.forEach((_x, _y, c) => { if (c) expect(allowed.has(c as any)).toBe(true); });
    const h = compositeMap(map);
    g.forEach((x, y, c) => expect(h.get(x, y)).toBe(c));
  });
  it("does not throw on a 3-terrain junction cell", () => {
    // center touches reefSilt, glowMoss, reefWater, reefFloor — composites, no off-palette
    expect(() => compositeMap(map)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/pipeline/ground/composite.test.ts`
Expected: FAIL (`compositeMap` not defined).

- [ ] **Step 3: Implement**

```ts
// add to composite.ts
export function compositeMap(map: TerrainKey[][], ox = 0, oy = 0): PixelGrid {
  const h = map.length, w = map[0].length;
  const out = new PixelGrid(w * T, h * T);
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    out.blit(compositeCell(map, cx, cy, ox, oy), cx * T, cy * T);
  }
  return out;
}
```

- [ ] **Step 4: Run to pass**

Run: `npx vitest run tests/pipeline/ground/composite.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/ground/composite.ts tests/pipeline/ground/composite.test.ts
git commit -m "feat(ground): G2 whole-map composite assembly"
```

---

## Task 4: Outline / edge shading

**Files:**
- Modify: `tools/pipeline/src/ground/composite.ts` (extend `compositeCell`)
- Test: `tests/pipeline/ground/composite.test.ts`

**Interfaces:** unchanged signatures; adds outline/shadow to the composited output.

- [ ] **Step 1: Write the failing test**

```ts
// add to composite.test.ts — outline introduces darker edge pixels not present without it
import { shade, nameToRampIndex } from ... // if needed; otherwise assert structurally
describe("outline", () => {
  const map = [["reefFloor","glowMoss"],["reefFloor","reefFloor"]] as any;
  it("darkens the field edge along the seam (introduces an over-ramp shade beyond the flat fill)", () => {
    const g = compositeCell(map, 0, 0, 0, 0); // reefFloor with glowMoss to the E
    // at least one column near the seam contains a reefFloor ramp color darker than the
    // fill body — the outline edge. (Structural: the seam column has >1 distinct reefFloor tone.)
    const tonesNearSeam = new Set<string>();
    for (let y = 0; y < 16; y++) for (let x = 10; x < 16; x++) { const c = g.get(x, y); if (c && (R as any).reefFloor.includes(c)) tonesNearSeam.add(c as string); }
    expect(tonesNearSeam.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/pipeline/ground/composite.test.ts`
Expected: FAIL (no outline yet — only the flat fill tones near the seam).

- [ ] **Step 3: Implement the outline pass** — port `blobTiles`' outline/shadow into `compositeCell`. After choosing `terr`/`name` per pixel, reuse the same `on(x,y)` boundary test (built from `m` + the 8-neighbor bits of `cfg`) and shading:

```ts
// inside compositeCell, replace the fill loop with a mask + on() + shade version.
// Imports (top of file): `shade` + `TERRAIN_RAMPS` from "../cliffs/palette";
// `nameToRampIndex` from "../cliffs/terrains".
// ... after computing m and cfg:
const N = !!(cfg & 1), NE = !!(cfg & 2), E = !!(cfg & 4), SE = !!(cfg & 8),
      S = !!(cfg & 16), SW = !!(cfg & 32), W = !!(cfg & 64), NW = !!(cfg & 128);
const on = (x: number, y: number): number => {
  const ox2 = x < 0 ? -1 : x >= T ? 1 : 0, oy2 = y < 0 ? -1 : y >= T ? 1 : 0;
  if (ox2 === 0 && oy2 === 0) return m[y * T + x];
  let bit: boolean;
  if (ox2 === 0) bit = oy2 < 0 ? N : S; else if (oy2 === 0) bit = ox2 < 0 ? W : E;
  else bit = ox2 < 0 ? (oy2 < 0 ? NW : SW) : (oy2 < 0 ? NE : SE);
  if (!bit) return 0;
  const cxp = Math.max(0, Math.min(T - 1, x)), cyp = Math.max(0, Math.min(T - 1, y));
  return m[cyp * T + cxp];
};
const overRamp = TERRAIN_RAMPS[self], baseRamp = TERRAIN_RAMPS[over];
for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
  const isOver = m[y * T + x] === 1;
  const terr = isOver ? self : over;
  let name = fill(terr, wx0 + x, wy0 + y);
  if (isOver) {
    if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1))
      name = shade(overRamp, nameToRampIndex(self, name), 1);       // darkened over-edge
    else if (on(x, y - 1) && !on(x, y - 2))
      name = shade(overRamp, nameToRampIndex(self, name), -1);      // lit inner lip
  } else if (on(x, y - 1) || on(x - 1, y - 1)) {
    name = shade(baseRamp, nameToRampIndex(over, name), 2);         // drop shadow on base
  }
  g.px(x, y, name);
}
```
(Note: `nameToRampIndex(key, name)` returns -1 if `name` isn't in that key's 4-color ramp — G1 fills emit enriched `GROUND_RAMPS` tones, so guard: if index is -1, skip the shade for that pixel. Keep the flat fill in that case. Document this; the outline still lands on the ID-tone pixels.)

- [ ] **Step 4: Run to pass**

Run: `npx vitest run tests/pipeline/ground/composite.test.ts`
Expected: PASS (seam column now has >1 reefFloor tone). Re-run full `composite.test.ts` — palette-lock still green (shaded names are ramp members).

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/ground/composite.ts tests/pipeline/ground/composite.test.ts
git commit -m "feat(ground): G2 outline/edge + drop-shadow pass"
```

---

## Task 5: Review scene + owner gate

**Files:**
- Create: `tools/pipeline/src/ground/buildCompositeReview.mts`
- Create (output): `docs/superpowers/artifacts/ground-composite-review.html`

- [ ] **Step 1: Write the review builder** — compose two hand-built maps and render each large (scale ×4, `image-rendering:pixelated`):
  1. **Same-biome junction:** a reef map where all four reef grounds meet (reefFloor field with reefSilt / reefWater / glowMoss patches adjacent), showing 4-way seams.
  2. **Cross-biome transition:** e.g. a `sand` field meeting a `groveGrass` patch (proves any-to-any works with no per-pair tile).

```ts
// tools/pipeline/src/ground/buildCompositeReview.mts
import { writeFileSync } from "node:fs";
import { encodePng } from "../png";
import { compositeMap } from "./composite";
import type { TerrainKey } from "../cliffs/palette";

const reef: TerrainKey[][] = [
  ["reefFloor","reefFloor","reefFloor","reefFloor","reefFloor","reefFloor"],
  ["reefFloor","reefSilt","reefSilt","reefFloor","reefWater","reefWater"],
  ["reefFloor","reefSilt","reefFloor","reefFloor","reefWater","reefFloor"],
  ["reefFloor","reefFloor","reefFloor","glowMoss","glowMoss","reefFloor"],
  ["reefFloor","reefWater","reefFloor","glowMoss","reefFloor","reefFloor"],
  ["reefFloor","reefFloor","reefFloor","reefFloor","reefFloor","reefFloor"],
];
const cross: TerrainKey[][] = [
  ["sand","sand","sand","sand","sand"],
  ["sand","sand","groveGrass","groveGrass","sand"],
  ["sand","groveGrass","groveGrass","groveGrass","sand"],
  ["sand","sand","groveGrass","sand","sand"],
  ["sand","sand","sand","sand","sand"],
];
const uri = (m: TerrainKey[][]) => "data:image/png;base64," + encodePng(compositeMap(m)).toString("base64");
const scene = (title: string, m: TerrainKey[][]) =>
  `<figure><figcaption>${title}</figcaption><img style="width:${m[0].length*16*4}px" src="${uri(m)}"></figure>`;
writeFileSync("docs/superpowers/artifacts/ground-composite-review.html",
  `<!doctype html><meta charset=utf8><title>G2 composite</title><style>
   body{font:14px system-ui;background:#1b1b1f;color:#eee;margin:20px}
   img{image-rendering:pixelated;border:1px solid #333}figcaption{color:#cbd;margin-bottom:6px;font-weight:600}
   figure{margin:0 0 28px}</style>
   <h1>G2 mask-composite — world-position fills + shared mask + outline</h1>
   <p style="color:#999">Transitions composited from G1 fills through one shared 47-blob mask; no per-pair tiles.</p>
   ${scene("Same-biome 4-way reef junction", reef)}
   ${scene("Cross-biome: sand ↔ grove", cross)}`);
console.log("wrote docs/superpowers/artifacts/ground-composite-review.html");
```

- [ ] **Step 2: Run it**

Run: `npx tsx tools/pipeline/src/ground/buildCompositeReview.mts`
Expected: writes the HTML.

- [ ] **Step 3: OWNER REVIEW GATE.** Present the render. Owner confirms the seams read right and iterates the **outline/edge look** (§5 — the taste area). Apply tweaks to the outline shading / `SEAM` params, re-run. If the base edge lands well and the owner wants it, add the liquid **foam/molten fringe** (bone inside water edges, `atbGold` inside lava) as a follow-up step here. Do not finalize until owner signs off.

- [ ] **Step 4: Commit**

```bash
git add tools/pipeline/src/ground/buildCompositeReview.mts docs/superpowers/artifacts/ground-composite-review.html
git commit -m "feat(ground): G2 composite review scene for owner gate"
```

---

## Task 6: Full verification

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npx vitest run` → fully green (composite tests pass; the 40 baked determinism pins + all other suites UNCHANGED — confirm nothing rebaked).
- [ ] **Step 3:** `npm run build` → green.
- [ ] **Step 4:** Open the PR into `main` (regular merge commit per CLAUDE.md).

---

## Self-Review Notes

- **Spec coverage:** priority + shared mask reuse (§2,§4) = T1-2; per-cell + whole-map composite from world-position fills (§3) = T2-3; outline/edge (§5) = T4; parity/conformance/determinism (§6) = T1-4 tests; review scene + gate (§7) = T5; verification (§9) = T6.
- **Out of scope (intentional):** animated masks + game wiring (G3), authored floors (G4), foam/molten fringe (fast-follow in T5 only if the base edge lands).
- **Risk:** the `neighborConfig` over-side sense (which bit-state carves in) is the one thing to verify — the Task 2 "carves from east" test pins it. `nameToRampIndex` returns -1 for enriched-ramp tones not in the 4-color `TERRAIN_RAMPS`; the outline guards that (skips the shade), so the edge treatment lands on ID-tone pixels — acceptable for G2, revisit if the edge reads too sparse.
- **Type consistency:** `GROUND_PRIORITY`, `neighborConfig`, `compositeCell(map,cx,cy,ox,oy)`, `compositeMap(map,ox,oy)`, `SEAM` used identically across tasks.
