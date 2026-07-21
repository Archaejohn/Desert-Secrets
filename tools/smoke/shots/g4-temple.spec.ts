/** G4 review capture — lands in the sun-temple (authored templeSlab floor + features)
 *  and screenshots the composited floor under the lamp. Not pass/fail. */
import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { snapshot } from "../kit/snapshot";
import { jumpTo } from "../kit/debug";

const BASE_FLAGS = { actComplete: true, act2Started: true, act2Complete: true, slitherJoined: true, act3Started: true, sawTempleEntry: true };

test("g4 — sun-temple authored floor", async ({ page }, testInfo) => {
  await seed(page, fixture("act3-start"));
  // Stand a few tiles off the glyph (7,7) so the player + its interact prompt don't occlude the sun emblem.
  await jumpTo(page, { zone: "sunTemple", flags: BASE_FLAGS, hp: 999, settleMs: 1400, stand: { x: 7, y: 10 }, standSettleMs: 500 });
  const s = await snapshot(page);
  expect(s.zoneKey, "reached sunTemple").toBe("sunTemple");
  await page.screenshot({ path: testInfo.outputPath("g4-temple.png") });
});
