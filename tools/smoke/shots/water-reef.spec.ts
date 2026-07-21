/** Water-surface review capture — lands in reefHollow (composite seabed + water surface)
 *  and screenshots two frames a beat apart to show the caustic motion. Not pass/fail. */
import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { snapshot } from "../kit/snapshot";
import { jumpTo } from "../kit/debug";

const BASE_FLAGS = {
  actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
  slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
  act4Started: true, act4Complete: true, gotSocks: true,
  act5Started: true, act5Complete: true, fluffballJoined: true, gotOranges: true,
  act6Started: true, sawReefGarden: true, sawReefWarren: true, sawReefHollow: true,
};

test("water — reef hollow surface", async ({ page }, testInfo) => {
  await seed(page, fixture("act6-start"));
  await jumpTo(page, { zone: "reefHollow", flags: BASE_FLAGS, hp: 999, settleMs: 1400, stand: { x: 10, y: 6 }, standSettleMs: 500 });
  const s = await snapshot(page);
  expect(s.zoneKey, "reached reefHollow").toBe("reefHollow");
  await page.screenshot({ path: testInfo.outputPath("water-1.png") });
  await page.waitForTimeout(550);
  await page.screenshot({ path: testInfo.outputPath("water-2.png") });
});
