# Smoke E2E Restructure — Thin Spine + Seeded Per-Act Suites

**Date:** 2026-07-18
**Status:** Approved design, pending implementation plan
**Scope:** All smoke scripts under `tools/smoke/`

## Problem

`tools/smoke/e2e.mjs` is a single 1618-line, ~150-check top-level script that
boots the built bundle once and drives one continuous keyboard playthrough from
a fresh save through the end of Part One (Act 1 → Act 7). Because every act
reads the live state the prior act produced, the run is strictly sequential.

Four concrete pains, all confirmed by the owner:

1. **Slow feedback** — a failure late in the run (e.g. Act 6) still pays for
   Acts 1–5 to get there. There is no way to run one act in isolation.
2. **Flaky / brittle** — a fixed `waitForTimeout` follows nearly every `tap`,
   so steps race the game loop; long chains accumulate timing drift.
3. **Not industry-standard** — bespoke `check(name, ok)` + `process.exit(1)`
   harness with console PASS/FAIL. No runner, reporter, retries, or traces.
4. **Hard to maintain** — 1618 lines in one file; the harness is duplicated
   (`touch-e2e.mjs` re-implements `check`, `tap`, `snapshot`, …). No shared kit.

## Goal

Restructure all smoke scripts into a **thin end-to-end spine plus deep,
independently-runnable, seeded per-act suites**, on a real test runner
(`@playwright/test`), sharing one harness module — fixing all four pains
without weakening coverage.

## Key enabler (already in production code)

The game persists a checkpoint save and boots from it:

- `src/game/state.ts`: every state write mirrors to
  `localStorage["desert-secrets-save-v1"]` as `{ v: 1, state }`.
- `loadSavedState()` merges a save **tolerantly over `newGame()`** (survives
  newly added flags/fields), and `BootScene.ts:208` does
  `this.scene.start(saved.zone, {})` — booting straight into the saved zone.

Therefore a test can seed `localStorage[SAVE_KEY]` with a checkpoint at the
**start of any act**, reload, and land directly in that act with no replay —
exercising the same load path players use.

## The honesty constraint

Seeded starting state must never be **hand-authored**, or a per-act test could
pass while the real inter-act handoff is broken (the test would be lying).
Therefore:

- Seeds are **captured from a real playthrough**, not written by hand.
- One **spine** still walks the whole chain for real on every gate run, so
  "does the whole game still connect?" is always verified end-to-end.

## Architecture

```
spine.spec.ts
  Fresh newGame() → plays the critical path end-to-end.
  Asserts ONLY act-boundary wiring per act: entry beat fires,
  act-complete flag sets, handoff reaches the next zone (~2–3 checks/boundary).
  Run with CAPTURE=1 → ALSO dumps each act's start checkpoint to
  fixtures/actN-start.json. One playthrough, two jobs: single source of truth
  for "how you actually progress".
        │ captures
        ▼
fixtures/act1-start.json … act7-start.json   (committed)
        │ seeds
        ▼
acts/actN.spec.ts  (×7, run in parallel)
  page.addInitScript sets localStorage[SAVE_KEY] = fixture →
  goto("/") → BootScene boots into that act's zone →
  runs THAT act's ~20 detailed checks (the bulk of the current 150).
  No replay of prior acts → fast + isolated.

kit/  (shared harness — removes the duplication)
  driver, actions (tap/teleport/talkThrough/fightThrough/talkToNpc/standAt…),
  snapshot/waitFor/readHp, seed(), the ZONE_KEYS list.
  Imported by spine, all 7 act specs, touch, walkout, shots.
```

### How each pain is addressed

- **Slow feedback** → `playwright test act5` seeds straight in, runs in seconds.
- **Flaky** → see Flakiness Strategy below (deterministic waits + retries +
  Trace Viewer + shorter chains).
- **Not industry-standard** → `@playwright/test`: parallel projects, fixtures,
  auto-retry, HTML report, Trace Viewer.
- **Maintainable** → seven ~150-line focused specs + a thin spine, plus one
  shared kit, replacing the 1618-line wall and its duplicated helpers.

## Runner & configuration

Runner: **`@playwright/test`** (chosen for the Trace Viewer, which directly
attacks the flakiness pain, plus parallelism/retries/reporting).

`playwright.config.ts` (repo root):

- **Custom Chromium:** `use.launchOptions.executablePath =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/opt/pw-browsers/chromium"` — same
  resolution the current scripts use, so CI is unchanged.
- **Serving:** a **`webServer`** block — `command: "npm run preview"`
  (vite preview over the built `dist/`), `url: "http://localhost:4173"`,
  `reuseExistingServer: !process.env.CI`. Specs use `baseURL` + `goto("/")`.
  Real HTTP origin (not `file://`) so `localStorage` seeding behaves exactly as
  in production.
- **Projects:** `spine`, `acts` (the 7 specs), `touch`, `walkout`, `shots`.
  Under CAPTURE runs, `acts` depends on `spine`; normally acts read committed
  fixtures and run independently in parallel.
- **Reliability:** `retries: process.env.CI ? 2 : 0`,
  `trace: "on-first-retry"`, `fullyParallel: true`, `workers` capped so
  parallel Chromium instances don't thrash.

Specs and kit are **TypeScript** (Playwright runs TS natively), consistent with
the rest of the repo — an upgrade from today's `.mjs`.

### Directory layout

```
tools/smoke/
  kit/            driver.ts, actions.ts, snapshot.ts, seed.ts, zones.ts
  fixtures/       act1-start.json … act7-start.json   (committed, captured)
  spine.spec.ts
  acts/           act1.spec.ts … act7.spec.ts
  touch/          touch.spec.ts  (+ kit/touch.ts for touch-only helpers)
  walkout.spec.ts
  shots/          act2-light, act5, act6, rest → screenshot specs on kit
playwright.config.ts
```

### package.json scripts

- `smoke` → `playwright test spine acts` — full coverage, fast (parallel +
  seeded). This is the verification-bar gate CLAUDE.md refers to.
- `smoke:spine` → `playwright test spine` — boundary gate only.
- `smoke:act` → e.g. `playwright test act5` — single act, seconds.
- `smoke:fixtures` → `CAPTURE=1 playwright test spine` — regenerate + commit
  fixtures when act boundaries or the state shape change.
- `smoke:touch` → `playwright test touch` (verification bar keeps working).
- `smoke:walkout`, `smoke:shots` → project filters.

## Seeding mechanism

Per-act specs seed **before page load**:

```
await page.addInitScript(({ key, save }) => {
  localStorage.setItem(key, save);
}, { key: "desert-secrets-save-v1", save: JSON.stringify({ v: 1, state: fixture }) });
await page.goto("/");
// BootScene reads the save and starts fixture.zone.
```

The fixture is the checkpoint state captured at that act's start. Kit exposes a
`seed(page, fixture)` helper wrapping this.

## Flakiness strategy (layered, most-effective first)

1. **Deterministic waits in the kit** — replace "tap then sleep N ms" with
   "tap then `waitFor(predicate)`" polling on real game state (`snapshot()`,
   `dialogueOpen`, `battle`, `zoneKey`, flag transitions). `waitFor` already
   exists; the kit makes it the default so specs assert *reached a state*, not
   *slept long enough*. Removes most flakiness at the source.
2. **Web-first assertions** — `expect.poll(() => snapshot(page))` retries until
   the condition holds or times out, with clean failure messages.
3. **Auto-retry + Trace Viewer** — `retries: 2` in CI, `trace: "on-first-retry"`.
   A surviving flake is captured with a full timeline+DOM trace to step through.
4. **Isolation dividend** — seeded per-act tests are one-act chains, so far less
   accumulated timing drift than the seven-act monolith.

## Touch / walkout / shots migration

- **Shared kit first** — extract `check/tap/snapshot/teleport/talkThrough/
  fightThrough/talkToNpc/waitFor/readHp` and the duplicated `ZONE_KEYS` list
  into `kit/`. Removes the `touch-e2e` duplication.
- **touch** → `touch/touch.spec.ts` on the kit; keep touch-only helpers
  (`canvasRect`, `tapRightSide`, `tapCampRest`) in `kit/touch.ts`. Kept as one
  input-focused flow first; split per-act later only if useful.
- **walkout** → `walkout.spec.ts` on the kit.
- **shots** (`act2-light`, `act5`, `act6`, `rest`) → screenshot specs on the
  kit; seed straight into their zone via fixtures instead of replaying (also
  faster).

## Rollout order (each step independently landable)

1. Kit + `playwright.config.ts` + `webServer`.
2. Spine + CAPTURE mode + committed fixtures.
3. The 7 act specs (seeded).
4. touch / walkout / shots migration onto the kit.
5. Delete the old `.mjs` monoliths (`e2e.mjs`, `touch-e2e.mjs`,
   `walkout-e2e.mjs`, `*-shots.mjs`).
6. Update CLAUDE.md's verification-bar commands.

## Non-goals

- No change to game behavior or `src/` (beyond nothing — tests only). If the
  seed path needs a test hook, prefer using the existing production load path.
- No splitting an act's internal steps into parallel tests — an act is stateful
  and runs as one ordered flow; parallelism is *across* acts.
- No new web framework or CI system; custom Chromium path is preserved.
