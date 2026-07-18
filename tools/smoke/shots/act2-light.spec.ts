/**
 * Act 2 lighting screenshot capture (not a pass/fail test) — drives into the
 * three ice zones and captures the LightMask lighting: amber lantern flicker
 * + blue ice pulse (crevasse, maze) and the frozen-lake blue wash (sanctum
 * epilogue). Ported from act2-light-shots.mjs onto the shared kit: seeds
 * straight into Act 2 via the committed fixture instead of a fresh NEW GAME +
 * manual flag list, then reuses the source's own zone/flag jump for the two
 * zones the fixture doesn't already sit in. PNGs go to the Playwright test
 * output dir (test-results/, already gitignored) as act2light-<name>.png.
 */
import { test, expect, type Page } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { snapshot } from "../kit/snapshot";
import { jumpTo } from "../kit/debug";

const FLAGS = {
  actComplete: true,
  act2Started: true,
  wardenDefeated: true,
  act2Complete: true,
  slitherJoined: true,
  minerMo: true,
  minerEdda: true,
  minerGus: true,
};

/** Jump into `zone` with FLAGS merged onto the seeded state, then stand at (tx,ty). */
async function jump(page: Page, zone: string, tx: number, ty: number) {
  // let the camera settle and the pulses reach a lit phase (900ms after standing)
  await jumpTo(page, { zone, flags: FLAGS, settleMs: 1400, stand: { x: tx, y: ty }, standSettleMs: 900 });
  return snapshot(page);
}

test("Act 2 lighting shots — crevasse, maze, sanctum", async ({ page }, testInfo) => {
  await seed(page, fixture("act2-start")); // lands in crevasse

  // Crevasse — amber lantern at the camp corner + blue ice crystals.
  let s = await jump(page, "crevasse", 5, 4);
  expect(s.zoneKey, "reached crevasse before screenshotting").toBe("crevasse");
  await page.screenshot({ path: testInfo.outputPath("act2light-crevasse.png") });

  // Maze — lantern posts at the junctions + blue crystals.
  s = await jump(page, "maze", 9, 4);
  expect(s.zoneKey, "reached maze before screenshotting").toBe("maze");
  await page.screenshot({ path: testInfo.outputPath("act2light-maze.png") });

  // Sanctum epilogue — the frozen lake's blue wash + crystals (no darkening).
  s = await jump(page, "sanctum", 12, 9);
  expect(s.zoneKey, "reached sanctum before screenshotting").toBe("sanctum");
  await page.screenshot({ path: testInfo.outputPath("act2light-sanctum.png") });
});
