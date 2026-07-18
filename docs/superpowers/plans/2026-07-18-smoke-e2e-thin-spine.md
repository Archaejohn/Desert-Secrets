# Smoke E2E Thin-Spine Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic 1618-line `tools/smoke/e2e.mjs` with a thin end-to-end spine plus seven independently-runnable, seeded per-act suites on `@playwright/test`, sharing one harness kit — fixing slow feedback, flakiness, non-standard tooling, and maintainability at once.

**Architecture:** One `spine.spec.ts` plays the whole game for real (fresh `newGame()` → End of Part One), asserting only act-boundary wiring, and — in CAPTURE mode — dumps each act's start checkpoint to `fixtures/actN-start.json`. Per-act traversal lives once in `flows/actN.ts` as a `driveActN(page)` function that returns a record of named beat-snapshots; the spine composes all seven flows, and each `acts/actN.spec.ts` seeds straight into its act (via the production `localStorage` save + BootScene CONTINUE path) and asserts that act's detail against the same returned beats. A shared `kit/` removes the helper duplication that `touch-e2e.mjs` currently has.

**Tech Stack:** TypeScript, `@playwright/test`, Playwright `webServer` (`vite preview`), custom Chromium via `PLAYWRIGHT_EXECUTABLE_PATH`, existing Phaser game exposed as `window.__game`.

## Global Constraints

- **No `src/` game-behavior changes.** Tests exercise the existing production load path (`loadSavedState` + `BootScene` CONTINUE). Do not add game features to serve tests.
- **Save format is fixed:** `localStorage["desert-secrets-save-v1"] = JSON.stringify({ v: 1, state })` where `state` is an `Act1State`. `loadSavedState()` merges tolerantly over `newGame()`.
- **Seeds are captured, never hand-authored.** Every `fixtures/actN-start.json` is produced by `CAPTURE=1 npm run smoke:spine`, never edited by hand.
- **Custom Chromium:** when `PLAYWRIGHT_EXECUTABLE_PATH` is set (CI), use it; when unset (local dev), let Playwright use its managed browser. Never hardcode `/opt/pw-browsers/chromium` as an unconditional path.
- **Serving:** built `dist/` served by `vite preview` on `http://localhost:4173`; specs use `baseURL` + `page.goto("/")`. `npm run smoke` assumes `dist/` already built (`npm run build` runs first, per the verification bar).
- **Software WebGL is mandatory.** The game renders via Phaser WebGL; headless Chromium has no GPU, so without software-GL flags it fails with "Framebuffer Unsupported" and no scenes ever start. Launch flags (verified on this repo):
  - CI (older pinned chromium at `PLAYWRIGHT_EXECUTABLE_PATH`): `["--no-sandbox", "--use-gl=swiftshader"]`
  - Local dev (Playwright's managed Chrome-for-Testing ≥149, where `--use-gl=swiftshader` is a no-op): `["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"]`
  Select by whether `PLAYWRIGHT_EXECUTABLE_PATH` is set.
- **Boot is not instant.** `window.__game` appears *before* scenes register; tests must wait for the `boot` scene to be **active** (`g.scene.getScene("boot")?.scene.isActive()`), not merely for `__game` to be defined.
- **The zone key list** (`ZONE_KEYS`) and `SAVE_KEY` live in exactly one module (`kit/zones.ts`); no other file re-declares them.
- Git: work on branch `claude/smoke-e2e-thin-spine`, commit per task, never commit to `main`.

---

## File Structure

```
playwright.config.ts                      (new — runner + webServer + projects)
tools/smoke/
  kit/
    zones.ts        SAVE_KEY, ZONE_KEYS, activeZoneKey()
    snapshot.ts     Snap type, snapshot(), waitForBoot(), waitFor(), readHp()
    actions.ts      tap, teleport, talkThrough, fightThrough, talkToNpc,
                    fightIfBattle, healUp, restPointCheck, walkUntilNear,
                    standAt, talkAllNpcs, driveTriggersUntil, exitTo
    seed.ts         SAVE_KEY re-export, fixture(), seed(), captureCheckpoint()
    touch.ts        canvasRect, tapRightSide, tapCampRest (touch-only helpers)
  flows/
    act1.ts … act7.ts   driveActN(page): Promise<Record<string, Snap>>
  fixtures/
    act2-start.json … act7-start.json   (captured; act1 needs none — fresh newGame)
  spine.spec.ts     composes all flows, boundary asserts, CAPTURE dumps fixtures
  acts/
    act1.spec.ts … act7.spec.ts   seed + drive one act + detailed asserts
  touch/touch.spec.ts
  walkout.spec.ts
  shots/act2-light.spec.ts, act5.spec.ts, act6.spec.ts, rest.spec.ts
```

The current `e2e.mjs`, `touch-e2e.mjs`, `walkout-e2e.mjs`, and `*-shots.mjs` remain in place until Task 15 deletes them — they are the reference source the ports copy from.

---

## Task 1: Runner harness (config + webServer + install)

Stand up `@playwright/test` end-to-end with a trivial boot check before porting anything, so the browser/serve/config plumbing is proven in isolation.

**Files:**
- Create: `playwright.config.ts`
- Create: `tools/smoke/harness.smoke.spec.ts` (temporary, deleted at end of this task)
- Modify: `package.json` (devDependency + scripts)

**Interfaces:**
- Produces: `baseURL` = `http://localhost:4173`; a served, built `dist/`; `window.__game` available after boot.

- [ ] **Step 1: Install the runner**

Run:
```bash
npm install --save-dev @playwright/test@^1.61.1
npx playwright install chromium   # local managed browser; CI uses PLAYWRIGHT_EXECUTABLE_PATH
```
Expected: `@playwright/test` added to `devDependencies`; chromium downloaded locally.

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
// Software WebGL: headless Chromium has no GPU. The legacy `--use-gl=swiftshader`
// only works on the older pinned CI chromium; local managed Chrome needs the
// ANGLE form. See Global Constraints.
const glArgs = executablePath
  ? ["--no-sandbox", "--use-gl=swiftshader"]
  : ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"];

export default defineConfig({
  testDir: "./tools/smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    launchOptions: { ...(executablePath ? { executablePath } : {}), args: glArgs },
  },
  projects: [
    { name: "spine",   testMatch: /spine\.spec\.ts$/ },
    { name: "acts",    testMatch: /acts[\\/].*\.spec\.ts$/ },
    { name: "touch",   testMatch: /touch[\\/]touch\.spec\.ts$/ },
    { name: "walkout", testMatch: /walkout\.spec\.ts$/ },
    { name: "shots",   testMatch: /shots[\\/].*\.spec\.ts$/ },
  ],
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Write the temporary boot check**

`tools/smoke/harness.smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("built bundle boots and exposes __game", async ({ page }) => {
  await page.goto("/");
  // __game appears before scenes register — wait for the boot scene to be ACTIVE.
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    return !!(g && g.scene && g.scene.getScene("boot") && g.scene.getScene("boot").scene.isActive());
  }, null, { timeout: 25_000 });
  expect(true).toBe(true); // reaching here means WebGL + boot succeeded
});
```

- [ ] **Step 4: Add scripts to `package.json`**

Replace the three `smoke*` script lines with:
```json
"smoke": "playwright test --project=spine --project=acts",
"smoke:spine": "playwright test --project=spine",
"smoke:fixtures": "cross-env-shell CAPTURE=1 playwright test --project=spine",
"smoke:touch": "playwright test --project=touch",
"smoke:walkout": "playwright test --project=walkout",
"smoke:shots": "playwright test --project=shots",
"smoke:report": "playwright show-report"
```
Note: `smoke:fixtures` sets `CAPTURE=1`. If `cross-env` is not already a dep, either add it (`npm i -D cross-env`) or, since the team runs bash, use `"smoke:fixtures": "CAPTURE=1 playwright test --project=spine"`. Prefer the plain form; the CAPTURE env is read in `kit/seed.ts`.

- [ ] **Step 5: Build then run the harness check**

Run:
```bash
npm run build
npx playwright test harness.smoke.spec.ts
```
Expected: `1 passed`. Playwright starts `vite preview`, loads `http://localhost:4173/`, confirms `__game` boots.

- [ ] **Step 6: Delete the temporary spec and commit**

```bash
rm tools/smoke/harness.smoke.spec.ts
git add playwright.config.ts package.json package-lock.json
git commit -m "test(smoke): add @playwright/test harness (config, webServer, scripts)"
```

---

## Task 2: Shared kit — zones, snapshot, actions

Port the helpers from `e2e.mjs` verbatim (behavior-preserving) into typed kit modules. These are the only source of these helpers after migration.

**Files:**
- Create: `tools/smoke/kit/zones.ts`, `tools/smoke/kit/snapshot.ts`, `tools/smoke/kit/actions.ts`
- Reference (copy from): `tools/smoke/e2e.mjs:19-231`, `:779-837`

**Interfaces:**
- Produces:
  - `zones.ts`: `export const SAVE_KEY: string`, `export const ZONE_KEYS: string[]`
  - `snapshot.ts`: `export type Snap`, `export function snapshot(page): Promise<Snap>`, `export function waitForBoot(page): Promise<void>`, `export function waitFor(page, pred: (s: Snap) => boolean, timeoutMs?): Promise<Snap>`, `export function readHp(page): Promise<number>`
  - `actions.ts`: `tap`, `teleport`, `talkThrough`, `fightThrough`, `talkToNpc`, `fightIfBattle`, `healUp`, `restPointCheck`, `walkUntilNear`, `standAt`, `talkAllNpcs`, `driveTriggersUntil`, `exitTo` (all `async`, first param `page: Page`)

- [ ] **Step 1: Write `kit/zones.ts`**

Copy the zone-key array that appears (identically) at `e2e.mjs:35` and `:54` into a single constant:
```ts
export const SAVE_KEY = "desert-secrets-save-v1";

export const ZONE_KEYS = [
  "crash","oasis","shed","overworld","mineEntrance","trail","mine","depths",
  "crevasse","maze","galleries","sanctum","sunlessSea","kelpForest","sunTemple",
  "fluffballBed","deepBed","seaAscent","minersCamp","campProper","laundryNook",
  "campGallery","campLedge","groveDescent","groveApproach","groveGrotto",
  "groveChamber","sahraGrove","reefDescent","reefGarden","reefWarren","reefHollow",
  "reefCourt","pizzaDescent","pizzaVent","pizzaApproach","pizzeria","pizzaAscent",
] as const;
```

- [ ] **Step 2: Write `kit/snapshot.ts`**

Port `snapshot` (`e2e.mjs:31-46`), `waitFor` (`:176-191`), `readHp` (`:142`); add `waitForBoot`. Use `ZONE_KEYS` from `zones.ts` inside the `page.evaluate` by passing it in (evaluate can't close over Node imports):
```ts
import type { Page } from "@playwright/test";
import { ZONE_KEYS } from "./zones";

export type Snap = Awaited<ReturnType<typeof snapshot>>;

export async function waitForBoot(page: Page): Promise<void> {
  // __game is set before scenes register — wait for the boot scene to be active,
  // else the first snapshot() reads an empty scene manager.
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    return !!(g && g.scene && g.scene.getScene("boot") && g.scene.getScene("boot").scene.isActive());
  }, null, { timeout: 25_000 });
}

export function snapshot(page: Page) {
  return page.evaluate((zoneKeys) => {
    const g = (window as any).__game;
    const active = g.scene.getScenes(true).map((s: any) => s.scene.key);
    const zoneKey = active.find((k: string) => zoneKeys.includes(k));
    const battle = active.includes("battle");
    const out: any = { active, zoneKey: zoneKey ?? null, battle, state: g.registry.get("act1") };
    if (zoneKey) {
      const w = g.scene.getScene(zoneKey);
      out.dialogueOpen = w.dialogue?.isOpen ?? false;
      out.choices = w.dialogue?.runner?.choices?.map((c: any) => c.text) ?? null;
      out.px = w.player?.x;
      out.py = w.player?.y;
    }
    return out;
  }, ZONE_KEYS as unknown as string[]);
}

export async function waitFor(
  page: Page,
  pred: (s: Awaited<ReturnType<typeof snapshot>>) => boolean,
  timeoutMs = 15_000
) {
  const start = Date.now();
  // Date.now is fine here (Node runtime, not a Workflow script).
  let last = await snapshot(page);
  while (!pred(last)) {
    if (Date.now() - start > timeoutMs) return last;
    await page.waitForTimeout(120);
    last = await snapshot(page);
  }
  return last;
}

export function readHp(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__game.registry.get("act1").hp);
}
```
Preserve the original `waitFor` loop shape/timing from `e2e.mjs:176-191` if it differs; the key is behavior parity.

- [ ] **Step 3: Write `kit/actions.ts`**

Port each helper verbatim from the cited lines, converting `function foo(page, …)` signatures to typed `export async function foo(page: Page, …)`. Sources:
`tap` `:25-29`, `teleport` `:49-62`, `talkThrough` `:65-81`, `fightThrough` `:84-93`, `talkToNpc` `:96-123`, `fightIfBattle` `:125-132`, `healUp` `:134-154`, `restPointCheck` `:156-174` (drop its internal `check()` — return the boolean/label instead so the caller asserts), `walkUntilNear` `:193-205`, `standAt` `:206-214`, `talkAllNpcs` `:779-793`, `driveTriggersUntil` `:795-820`, `exitTo` `:822-837`. Import `snapshot`, `waitFor` from `./snapshot`. Any that call `snapshot`/`tap` internally now import them.

Note on `restPointCheck`: it currently calls `check(...)` directly. Change its return type to `Promise<{ ok: boolean; label: string; detail?: string }>` so specs assert with `expect`.

- [ ] **Step 4: Typecheck the kit**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: no errors from `tools/smoke/kit/*`. (If `tools/` is excluded from the root tsconfig, run `npx playwright test --list` in a later task to compile-check instead; add a `tools/smoke/tsconfig.json` extending the root if needed.)

- [ ] **Step 5: Commit**

```bash
git add tools/smoke/kit/zones.ts tools/smoke/kit/snapshot.ts tools/smoke/kit/actions.ts
git commit -m "test(smoke): extract shared kit (zones, snapshot, actions)"
```

---

## Task 3: Seed & fixture-capture module

The mechanism that makes per-act isolation possible and keeps seeds honest.

**Files:**
- Create: `tools/smoke/kit/seed.ts`
- Reference: `src/game/state.ts` (SAVE_KEY, shape), `src/game/scenes/BootScene.ts:201-218` (CONTINUE is first option when a save exists)

**Interfaces:**
- Produces:
  - `export function fixture(name: string): unknown` — reads `fixtures/<name>.json`
  - `export async function seed(page: Page, state: unknown): Promise<Snap>` — installs the save, boots, selects CONTINUE, returns the first in-zone snapshot
  - `export async function captureCheckpoint(page: Page, name: string): Promise<void>` — in `CAPTURE` mode writes `fixtures/<name>.json` from current `snapshot().state`

- [ ] **Step 1: Write `kit/seed.ts`**

```ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { SAVE_KEY } from "./zones";
import { snapshot, waitForBoot, waitFor, type Snap } from "./snapshot";
import { tap } from "./actions";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, `${name}.json`), "utf8"));
}

/** Seed a checkpoint save, boot, and CONTINUE straight into its zone. */
export async function seed(page: Page, state: unknown): Promise<Snap> {
  await page.addInitScript(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify({ v: 1, state })] as const
  );
  await page.goto("/");
  await waitForBoot(page);
  // Title menu is up; with a save present CONTINUE is the first, highlighted option.
  await waitFor(page, (x) => x.active?.includes("boot"));
  await tap(page, "Space");
  const zone = (state as any).zone as string;
  return waitFor(page, (x) => x.zoneKey === zone, 12_000);
}

/** In CAPTURE mode, dump the current checkpoint state to fixtures/<name>.json. */
export async function captureCheckpoint(page: Page, name: string): Promise<void> {
  if (!process.env.CAPTURE) return;
  const s = await snapshot(page);
  mkdirSync(fixturesDir, { recursive: true });
  writeFileSync(path.join(fixturesDir, `${name}.json`), JSON.stringify(s.state, null, 2) + "\n");
}
```

- [ ] **Step 2: Sanity-check the seed path with a throwaway spec**

Create `tools/smoke/kit/seed.smoke.spec.ts` (temporary):
```ts
import { test, expect } from "@playwright/test";
import { newGameLikeOasis } from "./_seedfixture.js"; // inline below instead

test("seed boots into the saved zone", async ({ page }) => {
  // Minimal hand-made state ONLY for this throwaway check (not a committed fixture):
  const state = { zone: "oasis", hero: { xp: 5 }, flags: {}, hp: 32, items: {} };
  const { seed } = await import("./seed.js");
  const s = await seed(page, state as any);
  expect(s.zoneKey).toBe("oasis");
});
```
Run:
```bash
npm run build
npx playwright test seed.smoke.spec.ts --project=acts
```
Expected: PASS — proves `addInitScript` + CONTINUE lands in `oasis`. (If the merge in `loadSavedState` rejects the sparse state, flesh it out from `newGame()`'s shape until it boots — this validates the seed contract.)

- [ ] **Step 3: Delete the throwaway and commit**

```bash
rm tools/smoke/kit/seed.smoke.spec.ts
git add tools/smoke/kit/seed.ts
git commit -m "test(smoke): add seed + captureCheckpoint (localStorage save + CONTINUE boot)"
```

---

## Task 4: Act 1 flow + spec (the template all acts follow)

Establishes the `driveActN` → beats → spec pattern concretely. Act 1 starts fresh (`newGame()` via NEW GAME), so it needs no fixture, but the flow still returns beats and the spine still captures the **act2-start** checkpoint at the end of Act 1's walk-out.

**Files:**
- Create: `tools/smoke/flows/act1.ts`, `tools/smoke/acts/act1.spec.ts`
- Reference (port drive + checks from): `tools/smoke/e2e.mjs:227-771`

**Interfaces:**
- Produces: `export async function driveAct1(page: Page): Promise<Record<string, Snap>>` returning beats keyed by name (below). Also `export async function newGameStart(page: Page): Promise<Snap>` (boots fresh, taps NEW GAME, returns the crash snapshot) — reused by the spine and act1 spec.
- Consumes: everything from `kit/`.

- [ ] **Step 1: Write `flows/act1.ts`**

Structure: `newGameStart(page)` clears storage, waits for boot, taps Space (NEW GAME is first when no save), waits for `crash`. `driveAct1(page)` performs the Act-1 navigation from `e2e.mjs:227-760` **without `check()` calls**, capturing a snapshot into a `beats` record at each existing assertion point, and returns `beats`. Beat keys to capture (one per current check cluster, in order): `crashStart`, `playerMoves`, `rosa`, `coldPack`, `frostFeatherXp`, `oasisEast`, `overworldNorth`, `mineEntrance`, `mineOpenThreshold`, `overworldSouth`, `parents`, `tutorialStart`, `respawn`, `tutorialWon`, `shed`, `bucketPickup`, `inventoryEquip`, `spigotFill`, `choreComplete`, `trail`, `randomEncounter`, `chips`, `jackrabbit`, `mineEnter`, `leverForeman`, `depths`, `levelPerks`, `queenBattle`, `queenResolved`, `actComplete`, `noAutoTeleport`. Each beat value is the `snapshot(page)` taken where the corresponding `check()` reads state today.

- [ ] **Step 2: Write `acts/act1.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { newGameStart, driveAct1 } from "../flows/act1.js";

test("Act 1 — crash to Dust Queen cliffhanger", async ({ page }) => {
  await newGameStart(page);
  const b = await driveAct1(page);

  // One expect per original check(); convert check(name, cond, extra) →
  // expect(cond, name).toBeTruthy().  Examples (port the full set from
  // e2e.mjs:238-760):
  expect(b.crashStart.zoneKey, "New Game starts the crash site").toBe("crash");
  expect(b.playerMoves.px, "player moves").toBeGreaterThan(b.crashStart.px + 10);
  expect(b.coldPack.state.items.coldPack === true, "cold pack granted").toBeTruthy();
  // …continue through every check in e2e.mjs:238-760…
  expect(b.actComplete.state.flags.actComplete, "act completes (cliffhanger played)").toBe(true);
  expect(b.noAutoTeleport.zoneKey, "no auto-teleport: still in depths").toBe("depths");
});
```

**Conversion rule (applies to every act spec):** each `check(name, cond, extra)` in the source becomes one `expect(cond, name)` assertion against the matching beat snapshot; `check(name, a === b)` → `expect(a, name).toBe(b)`; boolean conditions → `.toBeTruthy()`. No `check()` or `process.exit` survives.

- [ ] **Step 3: Build and run Act 1 in isolation**

Run:
```bash
npm run build
npx playwright test act1.spec.ts --project=acts
```
Expected: `1 passed`, all Act-1 assertions green, in a fraction of the old full-run time.

- [ ] **Step 4: Commit**

```bash
git add tools/smoke/flows/act1.ts tools/smoke/acts/act1.spec.ts
git commit -m "test(smoke): Act 1 flow + seeded spec (template)"
```

---

## Tasks 5–10: Acts 2–7 (same pattern)

Each task mirrors Task 4: create `flows/actN.ts` (port that act's navigation from the cited `e2e.mjs` range, capturing named beats, no `check()`), then `acts/actN.spec.ts` (`seed(page, fixture("actN-start"))` → `driveActN(page)` → one `expect` per source check via the conversion rule). Fixtures do not exist yet — Task 11 generates them — so during Tasks 5–10, run each act spec with a **temporary local capture**: run the spine up to that act once with `CAPTURE=1` (or reuse the fixture produced after Task 11 and reorder). Recommended: implement flows in Tasks 5–10, then run Task 11 to generate all fixtures, then the act specs go green. Mark each act spec's run step as "green after Task 11."

Per-act specifics:

### Task 5: Act 2 — miners rescue → Rime Warden
- **Files:** `tools/smoke/flows/act2.ts`, `tools/smoke/acts/act2.spec.ts`. Port from `e2e.mjs:773-921` (helpers `talkAllNpcs`/`driveTriggersUntil`/`exitTo` now come from `kit/actions.ts`).
- **Seed:** `fixture("act2-start")` (checkpoint: player in `crevasse` after Act 1 walk-out).
- **Boundary flag:** `act2Complete` (source `:916-917`); plus "does NOT auto-advance — still in `sanctum`" (`:921`).
- **Beat keys:** `mo`, `reopenMo`, `maze`, `edda`, `slither`, `galleries`, `gus`, `minersBonus`, `slitherJoined`, `sanctum`, `warden`, `wardenParty`, `act2Complete`, `noAutoAdvance`.

### Task 6: Act 3 — the Sunless Sea (six-zone chain)
- **Files:** `flows/act3.ts`, `acts/act3.spec.ts`. Port from `e2e.mjs:923-1055`.
- **Seed:** `fixture("act3-start")` (checkpoint zone `sunlessSea`, `:935`).
- **Boundary flag:** `act3Complete` (`:1054-1055`).
- **Beat keys (one per check):** include `sunlessSeaCheckpoint`, `sawChase`, `kelpForest`, `sawKelpForest`, `sunTemple`, `sawTemple`, `backToKelp`, … through `act3Complete`. Enumerate every `check()` in the range as a beat.

### Task 7: Act 4 — miners' camp
- **Files:** `flows/act4.ts`, `acts/act4.spec.ts`. Port from `e2e.mjs:1057-1185`.
- **Seed:** `fixture("act4-start")` (checkpoint `minersCamp`, `:1075`).
- **Boundary flag:** `act4Complete` (`:1181-1182`); plus "does NOT auto-advance — still in `campProper`" (`:1185`).
- **Beat keys:** `minersCampCheckpoint`, `campProper`, `campGallery`, `sawGallery`, `campLedge`, `fluffballLedge`, `backToGallery`, `backToCampProper`, `act4Complete`, `noAutoAdvance`.

### Task 8: Act 5 — the underground orange grove
- **Files:** `flows/act5.ts`, `acts/act5.spec.ts`. Port from `e2e.mjs:1187-1317` (includes local helper `sahraTextWith` at `:1272` — move it into `flows/act5.ts` as a file-local function).
- **Seed:** `fixture("act5-start")` (checkpoint `groveDescent`, `:1192`).
- **Boundary flag:** `act5Complete` (`:1313-1314`); plus "does NOT auto-advance — still in `sahraGrove`" (`:1317`).
- **Beat keys:** `groveDescentCheckpoint`, `sawGroveDescent`, `groveApproach`, `sawGroveApproach`, `sawGroveChase`, `groveGrotto`, `sawGroveGrotto`, `groveChamber`, `sawGroveChamber`, `fluffballJoined`, `sunwasp`, `sahraGrove`, `sawSahraGrove`, `act5Complete`, `noAutoAdvance`.

### Task 9: Act 6 — the drowned reef
- **Files:** `flows/act6.ts`, `acts/act6.spec.ts`. Port from `e2e.mjs:1319-1456`.
- **Seed:** `fixture("act6-start")` (checkpoint `reefDescent`, `:1324`).
- **Boundary flag:** `act6Complete` (`:1452-1453`); plus "does NOT auto-advance — still in `reefCourt`" (`:1456`).
- **Beat keys:** `reefDescentCheckpoint`, `sawReefDescent`, `reefGarden`, `sawReefGarden`, `reefStalker`, `reefWarren`, `sawReefWarren`, `sawReefChase`, `reefHollow`, `sawReefHollow`, `reefCourt`, `sawReefCourt`, `avoidableFight`, `act6Complete`, `noAutoAdvance`.

### Task 10: Act 7 — La Pizzeria Sotterranea → End of Part One
- **Files:** `flows/act7.ts`, `acts/act7.spec.ts`. Port from `e2e.mjs:1459-end` (includes the cooking minigame, the reunion, the reveal, the finale card, and the Part-Two-opening cutscene + return-to-title).
- **Seed:** `fixture("act7-start")` (checkpoint `pizzaDescent`).
- **Boundary flags:** `act7Complete` + `partOneComplete` (`:1567-1572`); plus the Part-Two-opening cutscene playing four radio lines and returning to `boot`.
- **Beat keys:** `pizzaDescentCheckpoint`, `sawPizzaDescent`, `pizzaVent`, `sawPizzaVent`, `pizzaApproach`, `sawPizzaApproach`, `pizzeria`, `metTestudo`, `cookOpen`, `baked`, `pizzaBaked`, `piggyCaught`, `heardReveal`, `noAutoAdvanceReveal`, `pizzaAscent`, `sawPizzaAscent`, `act7Complete`, `partTwoOpening`, `fourRadioLines`, `backAtTitle`.

Each task ends with: `git add tools/smoke/flows/actN.ts tools/smoke/acts/actN.spec.ts && git commit -m "test(smoke): Act N flow + seeded spec"`. Run steps for act specs are validated in Task 11 once fixtures exist.

---

## Task 11: Spine spec + generate committed fixtures

Compose all seven flows into the real end-to-end gate, capture the honest fixtures, and turn the act specs green.

**Files:**
- Create: `tools/smoke/spine.spec.ts`
- Create (generated): `tools/smoke/fixtures/act2-start.json` … `act7-start.json`
- Modify: `.gitignore` (ensure fixtures are NOT ignored — they are committed)

**Interfaces:**
- Consumes: `newGameStart`, `driveAct1`…`driveAct7`, `captureCheckpoint`.

- [ ] **Step 1: Write `tools/smoke/spine.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { newGameStart, driveAct1 } from "./flows/act1.js";
import { driveAct2 } from "./flows/act2.js";
import { driveAct3 } from "./flows/act3.js";
import { driveAct4 } from "./flows/act4.js";
import { driveAct5 } from "./flows/act5.js";
import { driveAct6 } from "./flows/act6.js";
import { driveAct7 } from "./flows/act7.js";
import { captureCheckpoint } from "./kit/seed.js";
import { snapshot } from "./kit/snapshot.js";

test("spine — full playthrough wires every act boundary", async ({ page }) => {
  test.slow(); // real end-to-end run; give it the extra time budget
  await newGameStart(page);

  const a1 = await driveAct1(page);
  expect(a1.actComplete.state.flags.actComplete, "Act 1 boundary").toBe(true);
  // OWED BY driveAct1 (deferred from Act 1 spec as cross-act plumbing — port
  // these two from e2e.mjs:760-775, they are the spine's responsibility):
  //  1. Following Piggy into the ice rolls the end card and hands off to the
  //     crevasse with progress kept: after the walk-out,
  //     expect zoneKey === "crevasse", flags.act2Started === true, and hero.xp
  //     unchanged across the handoff (=== the xp captured just before it).
  //  2. Reload + Continue restores the checkpoint save (reload the page, pick
  //     CONTINUE, expect the same zone/flags come back).
  // Do #1 here right before capturing the act2-start fixture; do #2 as a short
  // reload check at this boundary.
  await captureCheckpoint(page, "act2-start");

  const a2 = await driveAct2(page);
  expect(a2.act2Complete.state.flags.act2Complete, "Act 2 boundary").toBe(true);
  await captureCheckpoint(page, "act3-start");

  const a3 = await driveAct3(page);
  expect(a3.act3Complete?.state.flags.act3Complete, "Act 3 boundary").toBe(true);
  await captureCheckpoint(page, "act4-start");

  const a4 = await driveAct4(page);
  expect(a4.act4Complete.state.flags.act4Complete, "Act 4 boundary").toBe(true);
  await captureCheckpoint(page, "act5-start");

  const a5 = await driveAct5(page);
  expect(a5.act5Complete.state.flags.act5Complete, "Act 5 boundary").toBe(true);
  await captureCheckpoint(page, "act6-start");

  const a6 = await driveAct6(page);
  expect(a6.act6Complete.state.flags.act6Complete, "Act 6 boundary").toBe(true);
  await captureCheckpoint(page, "act7-start");

  const a7 = await driveAct7(page);
  expect(a7.act7Complete.state.flags.act7Complete, "Act 7 boundary").toBe(true);
  expect(a7.act7Complete.state.flags.partOneComplete, "Part One complete").toBe(true);

  const end = await snapshot(page);
  const pageErrors = (page as any)._smokePageErrors ?? [];
  expect(pageErrors, "no page errors").toEqual([]);
  expect(end).toBeTruthy();
});
```
Note: the capture point for `actN-start` is taken **at the moment the spine has walked into act N's entry zone**. If a `driveActN` ends by walking out into act N+1's first zone, capture there; otherwise, add a one-line "walk into next zone" step before the capture so the fixture's `state.zone` equals act N+1's entry zone. Verify each captured `state.zone` matches the seed zone the corresponding act spec expects (crevasse, sunlessSea, minersCamp, groveDescent, reefDescent, pizzaDescent).

- [ ] **Step 2: Wire page-error capture (parity with old `pageErrors`)**

In a `test.beforeEach` in `spine.spec.ts` (and later reused), attach:
```ts
test.beforeEach(async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  (page as any)._smokePageErrors = errs;
});
```

- [ ] **Step 3: Generate the fixtures**

Run:
```bash
npm run build
CAPTURE=1 npx playwright test --project=spine
```
Expected: spine passes end-to-end; `tools/smoke/fixtures/act2-start.json` … `act7-start.json` written. Confirm each file's `zone` field matches the expected act entry zone.

- [ ] **Step 4: Run the full act suite green**

Run:
```bash
npx playwright test --project=acts
```
Expected: 7 passed, in parallel, each seeded straight into its act.

- [ ] **Step 5: Commit spine + fixtures**

```bash
git add tools/smoke/spine.spec.ts tools/smoke/fixtures/*.json
git commit -m "test(smoke): thin spine gate + captured act-start fixtures"
```

---

## Task 12: Migrate touch → touch.spec.ts

**Files:**
- Create: `tools/smoke/kit/touch.ts`, `tools/smoke/touch/touch.spec.ts`
- Reference: `tools/smoke/touch-e2e.mjs` (esp. `canvasRect` `:51`, `tapRightSide` `:98`, `tapCampRest` `:442`, and its duplicated `check`/`tap`/`snapshot` at `:22-` which are now deleted in favor of `kit/`)

- [ ] **Step 1:** Write `kit/touch.ts` exporting `canvasRect`, `tapRightSide`, `tapCampRest` (ported), importing `tap`/`snapshot` from `kit/`.
- [ ] **Step 2:** Write `tools/smoke/touch/touch.spec.ts`: one `test("touch — …")` that reproduces `touch-e2e.mjs`'s flow using the kit + `kit/touch.ts`, converting `check()` → `expect()`. Keep it a single input-focused flow (do not split per-act yet).
- [ ] **Step 3:** Run `npm run build && npx playwright test --project=touch`. Expected: PASS.
- [ ] **Step 4:** Commit `test(smoke): migrate touch-e2e onto shared kit`.

---

## Task 13: Migrate walkout → walkout.spec.ts

**Files:** Create `tools/smoke/walkout.spec.ts`; Reference `tools/smoke/walkout-e2e.mjs` (191 lines).

- [ ] **Step 1:** Port `walkout-e2e.mjs` into `walkout.spec.ts` on the kit; `check()` → `expect()`. Seed into the relevant zone via `seed()` if the walkout starts mid-game (use the nearest committed fixture); otherwise start fresh.
- [ ] **Step 2:** Run `npm run build && npx playwright test --project=walkout`. Expected: PASS.
- [ ] **Step 3:** Commit `test(smoke): migrate walkout-e2e onto shared kit`.

---

## Task 14: Migrate screenshot scripts → shots/*.spec.ts

**Files:** Create `tools/smoke/shots/act2-light.spec.ts`, `act5.spec.ts`, `act6.spec.ts`, `rest.spec.ts`; Reference `tools/smoke/act2-light-shots.mjs`, `act5-shots.mjs`, `act6-shots.mjs`, `rest-shots.mjs`.

- [ ] **Step 1:** Port each shots script onto the kit. Replace its bespoke navigation with `seed(page, fixture("actN-start"))` into the relevant act, then drive to the shot location and `await page.screenshot({ path: … })`. Keep output paths identical to the current scripts.
- [ ] **Step 2:** Run `npm run build && npx playwright test --project=shots`. Expected: PASS; screenshots written to the same locations as before.
- [ ] **Step 3:** Commit `test(smoke): migrate screenshot scripts onto shared kit + fixtures`.

---

## Task 15: Delete monoliths, finalize scripts & docs

**Files:**
- Delete: `tools/smoke/e2e.mjs`, `tools/smoke/touch-e2e.mjs`, `tools/smoke/walkout-e2e.mjs`, `tools/smoke/act2-light-shots.mjs`, `tools/smoke/act5-shots.mjs`, `tools/smoke/act6-shots.mjs`, `tools/smoke/rest-shots.mjs`
- Modify: `package.json` (confirm final scripts), `CLAUDE.md` (verification bar), `docs/CONTRACTS.md` if it references the old smoke entrypoints
- Also remove: untracked `src/assets/generated/tiles2-old.png` if still present (unrelated leftover — confirm with owner first)

- [ ] **Step 1: Confirm nothing references the old scripts**

Run:
```bash
grep -rn "smoke/e2e.mjs\|touch-e2e.mjs\|walkout-e2e.mjs\|-shots.mjs" --exclude-dir=node_modules .
```
Expected: only matches inside files being deleted/updated this task.

- [ ] **Step 2: Delete the monoliths**

```bash
git rm tools/smoke/e2e.mjs tools/smoke/touch-e2e.mjs tools/smoke/walkout-e2e.mjs \
       tools/smoke/act2-light-shots.mjs tools/smoke/act5-shots.mjs \
       tools/smoke/act6-shots.mjs tools/smoke/rest-shots.mjs
```

- [ ] **Step 3: Update `CLAUDE.md` verification bar**

Change the bar line to the new commands. New bar:
`tsc --noEmit`, `vitest run`, `npm run build`, `npm run smoke` (spine + all acts, keyboard e2e), `npm run smoke:touch` (touch-emulated e2e). Add a note: regenerate fixtures with `npm run smoke:fixtures` (then commit) whenever act boundaries or the save `state` shape change.

- [ ] **Step 4: Full verification pass**

Run:
```bash
npm run typecheck
npx vitest run
npm run build
npm run smoke
npm run smoke:touch
```
Expected: all green. The full smoke (spine + 7 acts) runs in parallel and finishes far faster than the old single linear run.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(smoke): remove monolithic e2e scripts; finalize scripts + verification bar"
```

- [ ] **Step 6: Open the PR** (per CLAUDE.md git flow — regular merge commit into `main`, not fast-forward)

```bash
git push -u origin claude/smoke-e2e-thin-spine
gh pr create --base main --title "Smoke E2E: thin spine + seeded per-act suites on @playwright/test" \
  --body "$(cat docs/superpowers/plans/2026-07-18-smoke-e2e-thin-spine.md | head -40)"
```

---

## Self-Review

**Spec coverage:**
- Thin spine → Task 11. Seeded per-act suites → Tasks 4–10. Shared kit → Tasks 2–3. `@playwright/test` + webServer + custom Chromium → Task 1. Captured (honest) fixtures → Task 3 (mechanism) + Task 11 (generation). Flakiness strategy: deterministic `waitFor` in kit (Task 2), `expect.poll`/`expect` assertions (Tasks 4–10), retries + trace (Task 1 config), short seeded chains (Tasks 5–10). touch/walkout/shots migration → Tasks 12–14. Delete monoliths + CLAUDE.md → Task 15. Rollout order matches the spec's 6 steps. All spec sections covered.

**Placeholder scan:** Per-act check lists are specified as a precise mechanical port from cited `e2e.mjs` line ranges plus enumerated beat keys and boundary flags — the assertions exist verbatim in the repo, so this is a concrete transformation, not a "TODO". The one conversion rule (`check(name,cond)` → `expect(cond,name)`) is stated once in Task 4 and referenced by act tasks intentionally (it is a rule, not omitted code).

**Type consistency:** `snapshot()`/`Snap`, `waitFor`, `seed`, `captureCheckpoint`, `fixture`, `driveActN`, `newGameStart` names are used identically across Tasks 2–11. `SAVE_KEY` defined once in `kit/zones.ts`. Beat records are `Record<string, Snap>` accessed by the keys each act task enumerates.

**Known risk to watch during execution:** the fixture `state.zone` for each act must equal that act spec's seed zone; Task 11 Step 1 calls this out explicitly and Task 11 Step 3 verifies it. If a `driveActN` leaves the player in the prior act's terminal zone rather than the next act's entry zone, add the one-line walk-in before `captureCheckpoint`.
