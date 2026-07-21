# AAP-64 Palette Migration (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the game's 25-color palette with the 64-color AAP-64 palette as `CORE`, by re-hexing the 25 existing named colors to their nearest AAP-64 values and appending the remaining 39, then regenerating all sheets and re-pinning determinism.

**Architecture:** The pipeline is palette-*name*-based (every `PixelGrid` cell is a `PaletteName`; names become RGB only in the PNG encoder). So the migration is a **re-hex-in-place**: the 25 current names keep their identity and positions but get new hex values (their assigned AAP-64 targets), and 39 more AAP-64 colors are appended under new names. No art literal changes; the ~3,159 name references and 43 runtime `PALETTE.x` consumers keep working. `palette.ts` is restructured into `CORE` (64 AAP-64 colors) + `BIOME_ACCENTS` (empty for now). The assignment is an **injective** 25→distinct-AAP-64 mapping (redmean ΔE) that **preserves each ramp's light→dark luminance order**.

**Tech Stack:** TypeScript, Node/tsx pipeline (`tools/pipeline/`), Vitest, Vite, Phaser 3. Deterministic integer-hash noise only (no `Math.random`/`Date`).

## Global Constraints

- **Palette-lock, name-based:** every pixel is a `PaletteName`; NEVER introduce hardcoded hex in `tools/pipeline/src`. (verbatim from CONTRACTS/inventory)
- **CORE = canonical AAP-64, imported verbatim from Lospec `aap-64`, never hand-typed from memory.** (spec §2)
- **Embrace-remap (clean refresh):** snap the 25 shipped colors to nearest AAP-64; NO preservation accents; `BIOME_ACCENTS` starts empty. (addendum)
- **Injective mapping:** the 25 map to 25 *distinct* AAP-64 colors (no collisions collapsing a ramp step). (addendum)
- **Ramp monotonicity — SOFT, report don't force (corrected during T2):** `cliffFace`/`quantize` index ramps by `ramp.indexOf(name)`, so light→dark ordering matters *visually*, but a small luminance near-tie is cosmetically negligible and some shipped ramps (e.g. `frostSand`) are already ~0.02 non-monotonic. Diagnostic finding: forcing strict monotonicity cascades dark/purple colors to near-black (plum ΔE 166) while injective nearest-match keeps worst inversion at 0.087 and worst color ΔE at 70. **Decision: injective nearest-match with NO destructive repair; a `rampInversions()` reporter surfaces any residual inversion in the swatch for the owner to judge/override.** (inventory §2 + T2 diagnostic)
- **Append-only ordering contract:** the 25 existing PALETTE entries keep their name AND position; the 39 new colors are appended after them. (inventory §1)
- **Determinism this plan:** still under the OLD full-pin rule — all 42 sha256 pins get re-pinned as a coherent set. (Plan B relaxes the rule later; not this plan.)
- **Verification bar:** `tsc --noEmit`, `vitest run`, `npm run build`, `npm run smoke`, `npm run smoke:touch`. Owner review gates at the remap (Task 3) and the regenerated look (Task 7).

---

## File Structure

- **Create** `tools/pipeline/src/palette/aap64.ts` — the 64 canonical AAP-64 hexes (Lospec order) + provenance comment. Single responsibility: hold the immutable source-of-truth list.
- **Create** `tools/pipeline/src/palette/remap.ts` — pure functions: redmean ΔE, injective assignment, ramp-monotonicity repair, core-color naming. No I/O.
- **Create** `tools/pipeline/src/palette/buildRemap.mts` — script: runs `remap.ts` over the current 25 + AAP-64, writes the reviewed mapping table + an HTML swatch to `docs/superpowers/artifacts/` for the owner gate.
- **Create** `tests/pipeline/paletteRemap.test.ts` — unit tests for `remap.ts` (injectivity, coverage, monotonicity).
- **Modify** `src/shared/palette.ts` — restructure to `CORE` (64) + `BIOME_ACCENTS` (empty); 25 names re-hexed, 39 appended; keep `PALETTE`/`PaletteName`/`PALETTE_HEX`/`hexToRgb`/`hexToInt` exports.
- **Modify** `tests/pipeline/manifest.test.ts` — update the embedded-palette assertion to 64 colors.
- **Modify** `tests/pipeline/determinism.test.ts` — re-pin all 42 sha256 hashes.
- **Modify** (optional, Task 6) `src/game/updateCheck.ts` + the ~15 stray `#241827xx`/`0xffffff`/`0x000000` gfx sites — route through `PALETTE`.

---

## Task 1: Import + pin canonical AAP-64

**Files:**
- Create: `tools/pipeline/src/palette/aap64.ts`
- Test: `tests/pipeline/aap64.test.ts`

**Interfaces:**
- Produces: `export const AAP64: readonly string[]` — 64 lowercase `#rrggbb` hexes in canonical Lospec order.

- [ ] **Step 1: Fetch the canonical list.** Fetch `https://lospec.com/palette-list/aap-64.json` (fields `{ name, colors: string[] }`, `colors` are 6-digit hex WITHOUT `#`). Confirm `colors.length === 64`. If the JSON endpoint is unreachable, fetch the `.hex` export `https://lospec.com/palette-list/aap-64.hex` (one 6-digit hex per line). Do NOT type the hexes from memory.

- [ ] **Step 2: Write the failing test**

```ts
// tests/pipeline/aap64.test.ts
import { describe, it, expect } from "vitest";
import { AAP64 } from "../../tools/pipeline/src/palette/aap64";

describe("AAP64 canonical list", () => {
  it("has exactly 64 unique lowercase #rrggbb colors", () => {
    expect(AAP64).toHaveLength(64);
    for (const c of AAP64) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(AAP64).size).toBe(64);
  });
  it("matches the pinned provenance checksum", () => {
    // Guards against accidental edits to the canonical list.
    const { createHash } = require("node:crypto");
    const sum = createHash("sha256").update(AAP64.join(",")).digest("hex");
    expect(sum).toBe(PINNED_AAP64_SHA); // fill from Step 4
  });
});
const PINNED_AAP64_SHA = "PLACEHOLDER"; // replaced in Step 4 with the real digest
```

- [ ] **Step 3: Write `aap64.ts` from the fetched data**

```ts
// tools/pipeline/src/palette/aap64.ts
/**
 * Canonical AAP-64 palette (Adigun A. Polack), imported verbatim from
 * Lospec `aap-64` (https://lospec.com/palette-list/aap-64) on 2026-07-20.
 * Order is Lospec's. NEVER hand-edit — re-fetch to change.
 */
export const AAP64: readonly string[] = [
  // 64 entries, each "#rrggbb" lowercase, pasted from the fetch (Step 1).
];
```

- [ ] **Step 4: Pin the checksum.** Run the test once, read the actual digest from the failure, paste it into `PINNED_AAP64_SHA`.

Run: `npx vitest run tests/pipeline/aap64.test.ts`
Expected: first run FAILS on the checksum with the real digest in the message; after pasting, PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/palette/aap64.ts tests/pipeline/aap64.test.ts
git commit -m "feat(palette): pin canonical AAP-64 color list"
```

---

## Task 2: Redmean + injective remap tool

**Files:**
- Create: `tools/pipeline/src/palette/remap.ts`
- Test: `tests/pipeline/paletteRemap.test.ts`

**Interfaces:**
- Consumes: `AAP64` (Task 1); `PALETTE`, `PaletteName`, `hexToRgb` from `src/shared/palette.ts`; `TERRAIN_RAMPS`, `ROCK`, `ICE`, `REEF`, `LAVA`, `GROVE` from `tools/pipeline/src/cliffs/palette.ts`.
- Produces:
  - `export function redmean(a: [number,number,number], b: [number,number,number]): number` — perceptual color distance.
  - `export function luminance(hex: string): number` — Rec.601 relative luminance 0–1.
  - `export function assignInjective(sourceHexes: string[], targetHexes: string[]): number[]` — returns, for each source index, the chosen target index; all distinct; greedy by ascending ΔE.
  - `export function remapPalette(current: Record<string,string>, ramps: readonly (readonly string[])[]): Record<string,string>` — returns `{ oldName: newHex }` for all 25, injective over AAP-64, adjusted so every ramp in `ramps` stays luminance-monotonic (resolved names → hexes).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/pipeline/paletteRemap.test.ts
import { describe, it, expect } from "vitest";
import { redmean, luminance, assignInjective, remapPalette } from "../../tools/pipeline/src/palette/remap";
import { PALETTE } from "../../src/shared/palette";
import { TERRAIN_RAMPS } from "../../tools/pipeline/src/cliffs/palette";

describe("redmean", () => {
  it("is zero for identical colors and positive otherwise", () => {
    expect(redmean([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(redmean([0, 0, 0], [255, 255, 255])).toBeGreaterThan(0);
  });
});

describe("assignInjective", () => {
  it("maps every source to a DISTINCT target", () => {
    const src = ["#000000", "#010101", "#ff0000"];
    const tgt = ["#000000", "#020202", "#fe0000", "#00ff00"];
    const idx = assignInjective(src, tgt);
    expect(idx).toHaveLength(3);
    expect(new Set(idx).size).toBe(3); // no collisions
  });
});

describe("remapPalette (real palette)", () => {
  const ramps = Object.values(TERRAIN_RAMPS).map((r) => r as readonly string[]);
  const mapping = remapPalette(PALETTE as Record<string, string>, ramps);

  it("remaps all 25 names to distinct AAP-64 hexes", () => {
    const names = Object.keys(PALETTE);
    expect(Object.keys(mapping).sort()).toEqual(names.sort());
    expect(new Set(Object.values(mapping)).size).toBe(names.length);
  });

  it("keeps every terrain ramp luminance-monotonic (light→dark)", () => {
    for (const [key, ramp] of Object.entries(TERRAIN_RAMPS)) {
      const lums = (ramp as readonly string[]).map((n) => luminance(mapping[n]));
      for (let i = 1; i < lums.length; i++) {
        expect(lums[i], `${key} ramp not monotonic at ${i}`).toBeLessThanOrEqual(lums[i - 1] + 1e-9);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/pipeline/paletteRemap.test.ts`
Expected: FAIL with "redmean is not a function" (module not implemented).

- [ ] **Step 3: Implement `remap.ts`**

```ts
// tools/pipeline/src/palette/remap.ts
import { AAP64 } from "./aap64";

type RGB = [number, number, number];
const toRgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Redmean perceptual distance (https://en.wikipedia.org/wiki/Color_difference#sRGB). */
export function redmean(a: RGB, b: RGB): number {
  const rbar = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + rbar / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rbar) / 256) * db * db);
}

/** Rec.601 relative luminance in [0,1]. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Greedy injective assignment: each source → a distinct target, best ΔE first. */
export function assignInjective(sourceHexes: string[], targetHexes: string[]): number[] {
  const srgb = sourceHexes.map(toRgb), trgb = targetHexes.map(toRgb);
  const pairs: { s: number; t: number; d: number }[] = [];
  for (let s = 0; s < srgb.length; s++)
    for (let t = 0; t < trgb.length; t++) pairs.push({ s, t, d: redmean(srgb[s], trgb[t]) });
  pairs.sort((p, q) => p.d - q.d || p.s - q.s || p.t - q.t);
  const out = new Array<number>(sourceHexes.length).fill(-1);
  const usedT = new Set<number>();
  let assigned = 0;
  for (const { s, t } of pairs) {
    if (assigned === sourceHexes.length) break;
    if (out[s] !== -1 || usedT.has(t)) continue;
    out[s] = t; usedT.add(t); assigned++;
  }
  return out;
}

/**
 * Injective 25→AAP-64 remap, then per-ramp monotonicity repair: if a ramp's
 * mapped luminances aren't non-increasing, re-assign the offending name to the
 * nearest still-free AAP-64 hex that restores order. Deterministic.
 */
export function remapPalette(
  current: Record<string, string>,
  ramps: readonly (readonly string[])[],
): Record<string, string> {
  const names = Object.keys(current);
  const srcHex = names.map((n) => current[n]);
  const idx = assignInjective(srcHex, AAP64 as string[]);
  const used = new Set(idx);
  const mapping: Record<string, string> = {};
  names.forEach((n, i) => (mapping[n] = AAP64[idx[i]]));

  // Monotonicity repair pass (bounded; deterministic order).
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const ramp of ramps) {
      for (let i = 1; i < ramp.length; i++) {
        const prev = luminance(mapping[ramp[i - 1]]);
        const cur = luminance(mapping[ramp[i]]);
        if (cur > prev + 1e-9) {
          // find nearest free AAP-64 hex darker than prev, closest to current target
          const want = toRgb(mapping[ramp[i]]);
          let best = -1, bestD = Infinity;
          for (let t = 0; t < AAP64.length; t++) {
            if (used.has(t)) continue;
            if (luminance(AAP64[t]) > prev + 1e-9) continue;
            const d = redmean(want, toRgb(AAP64[t]));
            if (d < bestD) { bestD = d; best = t; }
          }
          if (best >= 0) {
            used.delete(AAP64.indexOf(mapping[ramp[i]]));
            mapping[ramp[i]] = AAP64[best];
            used.add(best);
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
  return mapping;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/pipeline/paletteRemap.test.ts`
Expected: PASS (all four tests). If the monotonicity test still fails on a specific ramp, the repair couldn't find a free darker color — widen the search or nudge that ramp's assignment; note the ramp for the owner gate.

- [ ] **Step 5: Commit**

```bash
git add tools/pipeline/src/palette/remap.ts tests/pipeline/paletteRemap.test.ts
git commit -m "feat(palette): injective redmean remap with ramp-monotonicity repair"
```

---

## Task 3: Generate the remap + owner review gate

**Files:**
- Create: `tools/pipeline/src/palette/buildRemap.mts`
- Create (output): `docs/superpowers/artifacts/palette-remap-review.html`

**Interfaces:**
- Consumes: `remapPalette`, `luminance` (Task 2); `PALETTE`; `TERRAIN_RAMPS` + all wall ramps.

- [ ] **Step 1: Write the review-builder script**

```ts
// tools/pipeline/src/palette/buildRemap.mts
import { writeFileSync } from "node:fs";
import { PALETTE } from "../../../../src/shared/palette";
import { TERRAIN_RAMPS, ROCK, ICE, REEF, LAVA, GROVE } from "../cliffs/palette";
import { remapPalette } from "./remap";

const ramps = [...Object.values(TERRAIN_RAMPS), ROCK, ICE, REEF, LAVA, GROVE] as readonly (readonly string[])[];
const mapping = remapPalette(PALETTE as Record<string, string>, ramps);

// Emit an HTML swatch: for each of the 25, old hex vs new hex side by side,
// plus each ramp rendered old vs new so the owner can judge gradients.
const rows = Object.entries(PALETTE).map(([name, oldHex]) =>
  `<tr><td>${name}</td>
     <td style="background:${oldHex}">${oldHex}</td>
     <td style="background:${mapping[name]}">${mapping[name]}</td></tr>`).join("");
const rampBlock = (label: string, ramp: readonly string[]) =>
  `<h3>${label}</h3><div class="ramp">` +
  ramp.map((n) => `<span style="background:${(PALETTE as any)[n]}"></span>`).join("") +
  `</div><div class="ramp">` +
  ramp.map((n) => `<span style="background:${mapping[n]}"></span>`).join("") + `</div>`;
const ramps2 = Object.entries(TERRAIN_RAMPS).map(([k, r]) => rampBlock(k, r as readonly string[])).join("");

writeFileSync("docs/superpowers/artifacts/palette-remap-review.html",
  `<!doctype html><meta charset=utf8><style>
   body{font:14px sans-serif;background:#222;color:#eee}
   table{border-collapse:collapse}td{padding:4px 10px;border:1px solid #444}
   .ramp span{display:inline-block;width:40px;height:24px}</style>
   <h1>AAP-64 remap review (old → new)</h1>
   <table><tr><th>name</th><th>current</th><th>AAP-64</th></tr>${rows}</table>
   <h2>Ramps (top=current, bottom=AAP-64)</h2>${ramps2}`);
console.log(JSON.stringify(mapping, null, 2));
```

- [ ] **Step 2: Run it**

Run: `npx tsx tools/pipeline/src/palette/buildRemap.mts`
Expected: prints the `{ name: newHex }` JSON and writes `docs/superpowers/artifacts/palette-remap-review.html`.

- [ ] **Step 3: OWNER REVIEW GATE.** Present the swatch to the owner (open the HTML / publish as an Artifact). The owner confirms the recolor or requests per-color overrides. Record any overrides as an explicit `OVERRIDES: Record<string,string>` at the top of `buildRemap.mts` and re-run. **Do not proceed to Task 4 until the owner signs off on the final mapping.**

- [ ] **Step 4: Commit the reviewed mapping**

```bash
git add tools/pipeline/src/palette/buildRemap.mts docs/superpowers/artifacts/palette-remap-review.html
git commit -m "feat(palette): remap review swatch + owner-approved mapping"
```

---

## Task 4: Rewrite `palette.ts` to CORE + BIOME_ACCENTS

**Files:**
- Modify: `src/shared/palette.ts`
- Test: extend `tests/pipeline/manifest.test.ts` (palette assertion)

**Interfaces:**
- Consumes: the owner-approved `mapping` (Task 3); `AAP64` (Task 1).
- Produces: `CORE` (64 named), `BIOME_ACCENTS` (empty `{}`), unchanged public exports `PALETTE`, `PaletteName`, `PALETTE_HEX`, `hexToRgb`, `hexToInt`.

- [ ] **Step 1: Assign names to the 39 unused AAP-64 colors.** Every AAP-64 hex not targeted by the 25 gets a stable name: `<family><n>` where family ∈ {red, orange, yellow, green, teal, blue, purple, brown, grey} by HSL hue bucket (grey if saturation < 0.12), `n` = lightness rank within the family. Owner may rename at review. The 25 mapped colors KEEP their current names.

- [ ] **Step 2: Rewrite `src/shared/palette.ts`**

```ts
// src/shared/palette.ts  (structure — hexes filled from Task 3 mapping + Task 1 AAP64)
/**
 * CORE = canonical AAP-64 (see tools/pipeline/src/palette/aap64.ts). The 25
 * legacy names keep their identity but now hold their AAP-64 target hex
 * (embrace-remap, 2026-07-20). Append-only: legacy names first (positions
 * frozen), then the 39 remaining AAP-64 colors.
 */
export const CORE = {
  // --- 25 legacy names, re-hexed to AAP-64 targets (order UNCHANGED) ---
  ink: "<mapping.ink>", plum: "<mapping.plum>", /* … all 25 … */ stoneDeep: "<mapping.stoneDeep>",
  // --- 39 appended AAP-64 colors (family-named) ---
  // red0: "#…", teal3: "#…", …
} as const;

/** Per-biome signature accents beyond CORE. Empty until biomes need them. */
export const BIOME_ACCENTS = {} as const;

export const PALETTE = CORE; // back-compat alias; consumers unchanged
export type PaletteName = keyof typeof CORE;
export const PALETTE_HEX: readonly string[] = Object.values(CORE);
export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const hexToInt = (hex: string): number => parseInt(hex.slice(1), 16);
```

- [ ] **Step 3: Verify types compile.** The `PaletteName` union now has 64 members; the 25 old names still exist so no consumer breaks.

Run: `npx tsc --noEmit`
Expected: PASS (no missing-name errors — all legacy names retained).

- [ ] **Step 4: Verify no positional PALETTE_HEX misuse.** Confirm nothing reads `PALETTE_HEX[i]` expecting a specific legacy index.

Run: `git grep -n "PALETTE_HEX\[" src tools`
Expected: no index-based reads that assume the old 25-length. (If any exist, fix them to look up by name.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/palette.ts
git commit -m "feat(palette): CORE=AAP-64 (re-hex 25 legacy + append 39), empty BIOME_ACCENTS"
```

---

## Task 5: Shade-LUT repair + regenerate sheets + re-pin determinism

**Files:**
- Modify: `tools/pipeline/src/fx.ts` (2 `shadowOf` retargets)
- Modify: `tests/pipeline/fx.test.ts` (2 assertions: appended-hex snapshot + the strict-darker invariant now holds)
- Modify: `tests/pipeline/determinism.test.ts` (all 42 pins — recomputed programmatically)
- Modify: `tests/pipeline/manifest.test.ts` (embedded-palette assertion → 64, if not already green from Task 4)
- Regenerated (not committed by hand): `src/assets/generated/*.png`, `src/assets/generated/manifest.json`

- [ ] **Step 0 (discovered in T4): repair the 2 shadowOf inversions the remap introduced.** Post-remap two `shadowOf` entries violate the "shadow strictly darker" invariant: `shadowOf[indigo]=plum` (plum L56.1 > indigo L48.7) and `shadowOf[hpRed]=rust` (rust L94.8 > hpRed L94.3). Retarget to a darker same-family core: `shadowOf[indigo] = "blue1"` (#242234, L35.7) and `shadowOf[hpRed] = "red0"` (#73172d, L44.1). These are the ONLY two 25-color inversions; the 39 appended-color chains already satisfy strict-darker. Also update the `palette additions (§3)` test's hardcoded hexes (`umber`→`#71413b`, `sandShade`→`#c7b08b`, stone ramp → new values). Verify `npx vitest run tests/pipeline/fx.test.ts` → all 36 pass. Commit this as its own step before regenerating (it changes indigo/hpRed-shaded pixels). Flag both retargets for the Task 7 owner look review.

- [ ] **Step 1: Regenerate all art**

Run: `npm run art`
Expected: rewrites every PNG + `manifest.json` under `src/assets/generated/` with the new colors.

- [ ] **Step 2: Run determinism + manifest tests to see them fail**

Run: `npx vitest run tests/pipeline/determinism.test.ts tests/pipeline/manifest.test.ts`
Expected: FAIL — all 42 hashes changed + manifest now has 64 palette entries. Each failure prints `Received` (the new hash).

- [ ] **Step 3: Re-pin.** Replace every `FROZEN` hash in `determinism.test.ts` with its new `Received` value (copy from the test output — do NOT hand-compute). Update the `manifest.test.ts` palette assertion to expect the 64 CORE colors.

- [ ] **Step 4: Verify determinism green + two-run stability**

Run: `npx vitest run tests/pipeline/determinism.test.ts tests/pipeline/manifest.test.ts`
Expected: PASS (all 42 re-pinned; two-run byte-identical + cell-identical tests still pass — the generators are unchanged, only palette hexes moved).

- [ ] **Step 5: Commit**

```bash
git add tests/pipeline/determinism.test.ts tests/pipeline/manifest.test.ts src/assets/generated
git commit -m "chore(palette): regenerate sheets + re-pin 42 hashes for AAP-64"
```

---

## Task 6: Reconcile stray hardcoded hex in game runtime (small)

**Files:**
- Modify: `src/game/updateCheck.ts:35-38` and the `#241827xx` / `0xffffff` / `0x000000` sites listed in the inventory (§4).

**Interfaces:**
- Consumes: `PALETTE`, `hexToInt` from `src/shared/palette.ts`.

- [ ] **Step 1: Replace the 4 duplicated constants** in `updateCheck.ts` with palette lookups. The mislabeled `BONE="#eec48f"` is `sand`'s legacy hex and `PLUM="#75485e"` is `mauve`'s — after remap these hexes are stale, so they MUST be re-sourced from `PALETTE`:

```ts
const INK = PALETTE.ink, GOLD = PALETTE.atbGold, BODY = PALETTE.sand, ACCENT = PALETTE.mauve;
```

- [ ] **Step 2: Route the ink-with-alpha text backgrounds** (`"#24182799"` etc.) through a helper so they follow `PALETTE.ink`:

```ts
const inkAlpha = (a: string) => PALETTE.ink + a; // e.g. inkAlpha("99")
```
Apply at the ~9 sites (`ZoneScene`, `ui/touch`, `ui/Hud`, `DepthsScene`, `LightMaskDemo`, `updateCheck`).

- [ ] **Step 3: Leave `0xffffff`/`0x000000` light-mask literals as-is** IF they are pure white/black math (light masks, not palette art). Only swap the `"#ffffff"` string in `gfx/LightMask.ts:606` to `PALETTE.white` if it represents palette white. Document the decision inline.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game
git commit -m "refactor(palette): route stray game-runtime hex through PALETTE"
```

---

## Task 7: Full verification + owner look review

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: PASS (all pins re-pinned, invariants green).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: green (art bake + vite build).

- [ ] **Step 4: Smoke (keyboard + touch)**

Run: `npm run smoke && npm run smoke:touch`
Expected: spine + all 7 acts pass.

- [ ] **Step 5: OWNER LOOK REVIEW GATE.** Launch the app (or `/run`) and let the owner review the recolored game across a few zones (desert home, reef, ice, lava, grove). Confirm the shift reads as intended. Capture screenshots if helpful.

- [ ] **Step 6: Open the PR.** Push `claude/aap64-palette-migration`, open a PR into `main`, land with a regular merge commit (per CLAUDE.md — no fast-forward).

---

## Self-Review Notes

- **Spec coverage:** Plan A §5 tasks all covered — import/pin AAP-64 (T1), remap w/ redmean (T2) + owner review (T3), restructure `palette.ts` into CORE+BIOME_ACCENTS (T4), update generators (unchanged by design — name-based, T4 note), regenerate sheets (T5). Determinism stays old-rule (re-pin, T5); Plan B is out of scope. Addendum decisions (embrace, injective, monotonicity, naming, collisions) are in Global Constraints + T2/T3.
- **Out of scope (intentional):** hand-rebalancing ramps to use the 39 new colors; BIOME_ACCENTS population; Plan B determinism relaxation; Plan C runtime generative content; G1 fills.
- **Risk:** the monotonicity repair (T2 Step 4) may not satisfy a pathological ramp — surfaced at the owner gate, not silently. If it fails, widen the repair search (allow the 2nd/3rd-nearest free color) or flag that ramp for a manual override in Task 3's `OVERRIDES`.
</content>
</invoke>
