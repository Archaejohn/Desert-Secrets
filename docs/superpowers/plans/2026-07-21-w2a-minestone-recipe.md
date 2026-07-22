# Phase W2a — `minestone` Rock Recipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bespoke Cinnabar Mine rock recipe `minestone` — hewn dark warm-grey stone with sparse red **cinnabar ore** bodies — to the W1 wall generator, plus a review bake. Pipeline-only; no game wiring.

**Architecture:** Extend `tools/pipeline/src/walls/wallStyles.ts` with one new coursed recipe extrapolated from the existing `granite` `course` (blocky hewn masonry), swapping in a warm-dark face ramp and adding a **cinnabar ore** accent: sparse red `ell` bodies carrying their own muted-red `ORE` material, pushed among the blocks. Extend `bakeWallReview.mts` to render it.

**Tech Stack:** TypeScript, `tools/pipeline/src/walls/` (pure, node-testable), Vitest, `tsx` bake.

## Global Constraints

- **Reference/extrapolation base:** the existing `granite` recipe in `tools/pipeline/src/walls/wallStyles.ts` (its `course` structure) and the prototype `docs/prototypes/cliff-wall-raycast.html`. Follow the block-course pattern; don't redesign the machinery.
- **Reuse:** `h2` (`../cliffs/noise`), `shapedSlab`/`crestOff` (already in wallStyles), `MAT` (`./wallMaterials`), `ell` + types from `./primitives`. Do NOT redefine any.
- **Palette-lock:** every emitted colour is a `PaletteName` (AAP-64 = `CORE`). The `ORE` material's ramp is AAP-64 indices too. The renderer already snaps ramp hexes to `PaletteName` via `hexToName`.
- **Deterministic:** only `h2` + `Math`; no `Math.random`/`Date`/DOM.
- **Muted:** the recipe renders through the raised `WALL_WIN` from W1 (via `buildWall`'s `MAT(S.face, ...WALL_WIN)`); no change to `WALL_WIN`.
- **Additive:** append `minestone` to `STYLES`; do not alter `strata`/`granite` or any W1 file logic beyond adding the recipe + its imports.
- **Verification bar (pipeline-only):** `tsc --noEmit`, `vitest run`. (No `src/game/` change → smoke unaffected; not a sha-pinned sheet.)
- **Git:** branch `claude/runtime-walls-w2`; commit footers end with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Kji7iDdsHmjhHj3oMyRLk6
  ```

---

### Task 1: Add the `minestone` recipe (+ cinnabar `ORE` accent)

**Files:**
- Modify: `tools/pipeline/src/walls/wallStyles.ts` (add `ORE` const + `minestone` to `STYLES`; add imports for `MAT` and, if not already imported, `ell`)
- Test: `tests/pipeline/walls/wallStyles.test.ts` (extend); `tests/pipeline/walls/renderWall.test.ts` (extend)

**Interfaces:**
- Consumes: `h2`, `shapedSlab`, `MAT` (`./wallMaterials`), `ell` + `Material`/`Solid` (`./primitives`).
- Produces: `STYLES.minestone` (a `WallStyle`); `WallParams.style` (typed `keyof typeof STYLES`) now accepts `"minestone"`.

- [ ] **Step 1: Write the failing tests**

Extend `tests/pipeline/walls/wallStyles.test.ts`:
```ts
describe("minestone recipe", () => {
  it("exists with a face ramp + course fn", () => {
    expect(STYLES.minestone.face.length).toBeGreaterThanOrEqual(6);
    expect(typeof STYLES.minestone.course).toBe("function");
  });
  it("course pushes hewn blocks + sparse red cinnabar ore, deterministically", () => {
    const o = { bw: 0.48, relief: 0.45, frac: 0.4, irr: 0.55, face: { R: [], lo: 0, hi: 1 }, top: "chip" as const };
    const a: any[] = [], b: any[] = [];
    for (let y = 0; y < 6; y++) {            // several courses so the ~14% ore fires
      STYLES.minestone.course(a, y * 0.4, y * 0.4 + 0.4, 10, o);
      STYLES.minestone.course(b, y * 0.4, y * 0.4 + 0.4, 10, o);
    }
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBe(b.length);         // deterministic
    // at least one solid carries the ORE material (AAP index 3 = "#73172d" dark red)
    expect(a.some((s) => s.m && Array.isArray(s.m.R) && s.m.R.includes("#73172d"))).toBe(true);
  });
});
```
Extend `tests/pipeline/walls/renderWall.test.ts` (P0 is already defined there):
```ts
  it("minestone renders palette-locked and deterministically", () => {
    const g = renderWall({ ...P0, style: "minestone" });
    let opaque = 0;
    g.forEach((_x, _y, c) => { if (c !== null) { opaque++; expect(PALETTE).toHaveProperty(c); } });
    expect(opaque).toBeGreaterThan(200);
    expect(g.diff(renderWall({ ...P0, style: "minestone" }))).toBe(0);
  });
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run tests/pipeline/walls/wallStyles.test.ts tests/pipeline/walls/renderWall.test.ts`
Expected: FAIL — `STYLES.minestone` undefined; `renderWall` with `style:"minestone"` errors/typechecks-fail.

- [ ] **Step 3: Add the `ORE` material + `minestone` recipe**

In `tools/pipeline/src/walls/wallStyles.ts`, add imports (if missing): `import { MAT } from "./wallMaterials";` and ensure `ell` is imported from `./primitives`. Add near the top:
```ts
/** Cinnabar ore: sparse muted-red ore bodies threading the mine's hewn rock (dark
 *  maroon -> muted red; it is ore in stone, not lava, so it stays low on the ramp). */
const ORE = MAT([2, 3, 44, 45], 0.15, 0.75);
```
Add to `STYLES` (after `granite`):
```ts
  minestone: {
    name: "Hewn minestone",
    face: [0, 31, 32, 63, 62, 61, 60],   // near-black -> dark warm-grey -> tan (hewn stone)
    recess: [0, 0, 31], cap: [32, 63, 62, 61, 60, 59], talus: [31, 32, 63, 62, 61],
    crest: "jagged", top: "chip",
    // Blocky hewn masonry (granite's course structure, distinct seeds + warm-dark ramp),
    // threaded with sparse cinnabar ore bodies.
    course(P, y0, y1, W, o) {
      let x = 0, k = 0;
      const sd = Math.round(y0 * 97);
      const off = h2(sd, 21, 301) * o.bw * 1.4;
      while (x < W) {
        const w = o.bw * (0.9 + h2(sd, k, 302) * 1.4 * (0.4 + o.irr));
        const d = o.relief * (0.45 + h2(sd, k, 303) * 1.05);
        const g = o.frac * 0.10;
        const x0 = Math.max(0, x - off), x1 = Math.min(W, x + w - g - off);
        if (x1 > x0 + 0.05) {
          const cy = (y0 + y1) / 2, hh = (y1 - y0) / 2;
          shapedSlab(P, [(x0 + x1) / 2, cy, d / 2],
            [(x1 - x0) / 2, hh * (0.88 + h2(sd, k, 304) * 0.14), d / 2],
            (h2(sd, k, 305) - 0.5) * 0.58 * o.irr,
            (h2(sd, k, 306) - 0.5) * 0.40 * o.irr,
            (h2(sd, k, 307) - 0.5) * 0.22 * o.irr, o.face, 0.6,
            o.top, sd * 37 + k, o.irr);
          // cinnabar ore: sparse red body standing slightly proud of the block face.
          if (h2(sd, k, 308) < 0.14) {
            const ox = (x0 + x1) / 2 + (h2(sd, k, 309) - 0.5) * (x1 - x0) * 0.4;
            const oy = cy + (h2(sd, k, 310) - 0.5) * hh;
            const r = (x1 - x0) * 0.12 * (0.6 + h2(sd, k, 311) * 0.8);
            P.push(ell([ox, oy, d * 0.85], [r, r * (0.6 + h2(sd, k, 312) * 0.8), r * 0.7], ORE, 0.5));
          }
        }
        x += w; k++;
      }
    },
  },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/pipeline/walls/wallStyles.test.ts tests/pipeline/walls/renderWall.test.ts`
Expected: PASS (recipe present, ore body pushed, render palette-locked + deterministic).

- [ ] **Step 5: Typecheck + full walls suite**

Run: `npx tsc --noEmit` (clean), then `npx vitest run tests/pipeline/walls/` (all pass — `WallParams.style` accepting `"minestone"` should require no signature change if it's `keyof typeof STYLES`; if `style` is a hardcoded union, widen it to `keyof typeof STYLES`).

- [ ] **Step 6: Commit**

```bash
git add tools/pipeline/src/walls/wallStyles.ts tests/pipeline/walls/wallStyles.test.ts tests/pipeline/walls/renderWall.test.ts
git commit -m "feat(w2a): minestone rock recipe — hewn dark stone + cinnabar ore accent"
```

---

### Task 2: Render `minestone` in the review bake

**Files:**
- Modify: `tools/pipeline/src/walls/bakeWallReview.mts` (add `minestone` to the styles rendered)

**Interfaces:**
- Consumes: `renderWall`, `encodePng` (already imported in the bake).

- [ ] **Step 1: Add `minestone` to the bake loop**

In `tools/pipeline/src/walls/bakeWallReview.mts`, add `"minestone"` to the styles array the script iterates (alongside `"strata"`, `"granite"`), so it writes `wall-minestone.png`.

- [ ] **Step 2: Run the bake**

Run: `npx tsx tools/pipeline/src/walls/bakeWallReview.mts tools/pipeline/.bake`
Expected: prints three `wrote …` lines including `wall-minestone.png`; the file exists and is non-empty. Report its dimensions.

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (clean). Commit (script only; `.bake/` PNGs stay untracked):
```bash
git add tools/pipeline/src/walls/bakeWallReview.mts
git commit -m "feat(w2a): render minestone in the review bake"
```

*(Controller step, not the implementer's: Read `wall-minestone.png`; run the muted/ore-tuning loop with the owner — adjust the face ramp, the `ORE` material/probability, and the crest/top in Task 1's files until the owner approves the mine-rock look — before W2a is done.)*

---

## Self-Review

- **Spec coverage:** W2 spec §2 (minestone: hewn warm-dark ramp + cinnabar ore accent, jagged crest, chip top, extrapolated from granite) → Task 1; §6 W2a review bake → Task 2. Covered.
- **Placeholder scan:** the recipe + ore code and all tests are given inline; the granite-extrapolation base is a real committed file. No hand-waving.
- **Type consistency:** `ORE`/`minestone` use `MAT`/`ell`/`shapedSlab`/`h2` with the same signatures W1 established; `WallStyle` shape (name/face/recess/cap/talus/crest/top/course) matches `strata`/`granite`; `WallParams.style` extends via `keyof typeof STYLES`.
- **Determinism/no-repin:** only `h2`+`Math`; runtime-style, not added to `determinism.test.ts`.
