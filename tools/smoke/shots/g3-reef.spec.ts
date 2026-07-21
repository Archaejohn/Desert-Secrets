/**
 * G3 review capture (not a pass/fail test) — lands in the reef garden with the
 * runtime composite ground live (CompositeGroundView) and screenshots it, blur
 * off then on (?groundblur). PNGs go to the Playwright test output dir.
 */
import { test, expect, type Page } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { snapshot } from "../kit/snapshot";
import { jumpTo } from "../kit/debug";

const BASE_FLAGS = {
  actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
  slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
  act4Started: true, act4Complete: true, gotSocks: true,
  act5Started: true, act5Complete: true, fluffballJoined: true, gotOranges: true,
  act6Started: true, sawReefGarden: true,
};

async function jumpReef(page: Page) {
  await jumpTo(page, { zone: "reefGarden", flags: BASE_FLAGS, hp: 999, settleMs: 1300, stand: { x: 21, y: 9 }, standSettleMs: 500 });
  return snapshot(page);
}

test("G3 reef garden composite ground — blur off + on", async ({ page }, testInfo) => {
  await seed(page, fixture("act6-start")); // lands in reefDescent

  let s = await jumpReef(page); // default now: texture blur ON
  expect(s.zoneKey, "reached reefGarden").toBe("reefGarden");
  await page.screenshot({ path: testInfo.outputPath("g3-reef-default.png") });

  // opt out with ?noblur (no reload) and re-enter so setupCompositeGround re-reads it
  await page.evaluate(() => history.replaceState(null, "", "/?noblur"));
  s = await jumpReef(page);
  expect(s.zoneKey, "reached reefGarden (noblur)").toBe("reefGarden");
  await page.screenshot({ path: testInfo.outputPath("g3-reef-noblur.png") });
});
