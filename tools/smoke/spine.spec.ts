/**
 * The spine — one test that plays the whole game for real, end to end, and
 * asserts ONLY the act-boundary wiring (each actNComplete/partOneComplete flag
 * from the returned beats) plus the inter-act hand-offs that the per-act flows
 * deliberately omitted (ported from tools/smoke/e2e.mjs). It is the thin gate:
 * the exhaustive per-beat assertions live in tools/smoke/acts/*.spec.ts, which
 * seed straight into each act from the fixtures this spine captures.
 *
 * In CAPTURE mode (CAPTURE=1) it also writes tools/smoke/fixtures/actN-start.json
 * at each boundary — the checkpoint state a returning player would CONTINUE from
 * at act N's entry zone, with that act's entry beat NOT yet consumed.
 */
import { test, expect } from "@playwright/test";
import { newGameStart, driveAct1 } from "./flows/act1.js";
import { driveAct2 } from "./flows/act2.js";
import { driveAct3 } from "./flows/act3.js";
import { driveAct4 } from "./flows/act4.js";
import { driveAct5 } from "./flows/act5.js";
import { driveAct6 } from "./flows/act6.js";
import { driveAct7 } from "./flows/act7.js";
import { captureCheckpoint } from "./kit/seed.js";
import { snapshot, waitFor, waitForBoot } from "./kit/snapshot.js";
import { tap, teleport, standAt, exitTo } from "./kit/actions.js";
import { SAVE_KEY } from "./kit/zones.js";

test.beforeEach(async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  (page as any)._smokePageErrors = errs;
});

test("spine — full playthrough wires every act boundary", async ({ page }) => {
  test.slow(); // real end-to-end run; give it the extra time budget
  await newGameStart(page);

  // ============================ ACT 1 ============================
  const a1 = await driveAct1(page);
  expect(a1.actComplete.state.flags.actComplete, "Act 1 boundary").toBe(true);

  // ---- Act 1 → Act 2 hand-off (owed by driveAct1; e2e.mjs:750-775) ----
  // Follow Piggy INTO the glowing ice: the walk-in rolls the END OF ACT card,
  // then SPACE hands off to the crevasse keeping all progress (xp unchanged).
  const xpBeforeAct2 = (await snapshot(page)).state.hero.xp;
  await teleport(page, 17, 2);
  await page.waitForTimeout(500);
  await tap(page, "Space");
  let s = await waitFor(page, (x) => x.zoneKey === "crevasse", 8000);
  expect(s.zoneKey, "following Piggy into the ice hands off to the crevasse").toBe("crevasse");
  expect(s.state.flags.act2Started, "Act 2 started with progress kept").toBe(true);
  expect(s.state.hero.xp, "xp unchanged across the Act 1→2 hand-off").toBe(xpBeforeAct2);

  // Reload + Continue restores the checkpoint save (returning-player path).
  // newGameStart registered a persistent addInitScript(localStorage.clear())
  // that re-runs on every load (including this reload), which a real browser
  // would never do and which would wipe the game's genuine crevasse save. Read
  // that OWN persisted save now and re-register it via a later init script (it
  // runs AFTER the clear) so CONTINUE restores the real checkpoint — faithfully
  // exercising the returning-player path while neutralising the harness artifact.
  const persistedSave = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
  expect(persistedSave, "game persisted a checkpoint save before reload").toBeTruthy();
  await page.addInitScript(
    ([k, v]) => localStorage.setItem(k, v),
    [SAVE_KEY, persistedSave ?? ""] as const
  );
  await page.reload();
  await waitForBoot(page);
  await waitFor(page, (x) => x.active?.includes("boot"));
  await tap(page, "Space"); // CONTINUE is first when a save exists
  s = await waitFor(page, (x) => x.zoneKey !== null, 12_000);
  expect(s.zoneKey, "reload + Continue restores the crevasse checkpoint").toBe("crevasse");
  expect(s.state.hero.xp, "reload + Continue keeps xp").toBe(xpBeforeAct2);

  await captureCheckpoint(page, "act2-start");

  // ============================ ACT 2 ============================
  const a2 = await driveAct2(page);
  expect(a2.act2Complete.state.flags.act2Complete, "Act 2 boundary").toBe(true);

  // ---- Act 2 → Act 3 hand-off (e2e.mjs:922-932) ----
  // Walk into the tunnel the penguins dove through → END OF ACT 2 card → dive
  // into the Sunless Sea, progress kept.
  await standAt(page, "sanctum", 23 * 16 + 8, 4 * 16 + 8);
  await page.waitForTimeout(700);
  await tap(page, "Space");
  s = await waitFor(page, (x) => x.zoneKey === "sunlessSea", 9000);
  expect(s.zoneKey, "the tunnel dives into the Sunless Sea").toBe("sunlessSea");
  expect(s.state.flags.act3Started, "Act 3 started with progress kept").toBe(true);
  await captureCheckpoint(page, "act3-start");

  // ============================ ACT 3 ============================
  const a3 = await driveAct3(page);
  expect(a3.act3Complete?.state.flags.act3Complete, "Act 3 boundary").toBe(true);

  // ---- Act 3 → Act 4 hand-off (e2e.mjs:1067-1072) ----
  // The ascent's top gate climbs into the Miners' Camp, progress kept.
  s = await snapshot(page);
  if (s.zoneKey !== "minersCamp") s = await exitTo(page, "seaAscent", "minersCamp");
  expect(s.zoneKey, "the ascent's top gate climbs into the Miners' Camp").toBe("minersCamp");
  expect(s.state.flags.act4Started, "Act 4 started with progress kept").toBe(true);
  await captureCheckpoint(page, "act4-start");

  // ============================ ACT 4 ============================
  const a4 = await driveAct4(page);
  expect(a4.act4Complete.state.flags.act4Complete, "Act 4 boundary").toBe(true);

  // ---- Act 4 → Act 5 hand-off (e2e.mjs:1186-1192) ----
  // Walk down the opened stairwell → Act 5's warm descent, progress kept.
  s = await exitTo(page, "campProper", "groveDescent");
  expect(s.zoneKey, "the stairwell descends into Act 5's warm descent").toBe("groveDescent");
  expect(s.state.flags.act5Started, "Act 5 started with progress kept").toBe(true);
  await captureCheckpoint(page, "act5-start");

  // ============================ ACT 5 ============================
  const a5 = await driveAct5(page);
  expect(a5.act5Complete.state.flags.act5Complete, "Act 5 boundary").toBe(true);

  // ---- Act 5 → Act 6 hand-off (e2e.mjs:1318-1324) ----
  // Walk through Sahra's hidden door → Act 6's drowned stair, progress kept.
  s = await exitTo(page, "sahraGrove", "reefDescent");
  expect(s.zoneKey, "Sahra's hidden door descends into Act 6's reef").toBe("reefDescent");
  expect(s.state.flags.act6Started, "Act 6 started with progress kept").toBe(true);
  await captureCheckpoint(page, "act6-start");

  // ============================ ACT 6 ============================
  const a6 = await driveAct6(page);
  expect(a6.act6Complete.state.flags.act6Complete, "Act 6 boundary").toBe(true);

  // ---- Act 6 → Act 7 hand-off (e2e.mjs:1457-1462) ----
  // Walk the crawlers' opened tunnel → Act 7's descent, progress kept.
  s = await exitTo(page, "reefCourt", "pizzaDescent");
  expect(s.zoneKey, "the crawlers' tunnel descends into Act 7's descent").toBe("pizzaDescent");
  expect(s.state.flags.act7Started, "Act 7 started with progress kept").toBe(true);
  await captureCheckpoint(page, "act7-start");

  // ============================ ACT 7 ============================
  const a7 = await driveAct7(page);
  expect(a7.act7Complete.state.flags.act7Complete, "Act 7 boundary").toBe(true);
  expect(a7.act7Complete.state.flags.partOneComplete, "Part One complete").toBe(true);

  // ---- the thin gate's own tail: a real, error-free playthrough ----
  const end = await snapshot(page);
  const pageErrors = (page as any)._smokePageErrors ?? [];
  expect(pageErrors, "no page errors").toEqual([]);
  expect(end).toBeTruthy();
});
